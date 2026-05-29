# Phase 31: sec-profiles-self-update-hardening - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Close a **live-on-prod P0 privilege-escalation vector**: any authenticated specialist can `PATCH /rest/v1/profiles?id=eq.<their-uid> {role:'admin', is_active:true}` and become admin. The deliverable is a Supabase migration (+ Codex review + prod apply) that scopes what a non-admin may self-update on `public.profiles`, plus a defense-in-depth guard trigger — without breaking the two legitimate self-writes (walkthrough, theme) or the admin account-management Edge path.

**In scope:** `public.profiles` UPDATE grants, the self-update RLS policy, a role/is_active guard trigger, migration authoring + Codex review + `supabase db push`, prod admin-list audit, regen of `database.types.ts`, Tier-2 smoke.

**Out of scope:** the SEC-1 signup trigger (already fixed, PR #19); the rest of the 2026-05-27 audit backlog (other v1.3 phases); any column_privileges audit of tables other than `profiles`; self-service `display_name` rename (deferred).

</domain>

<verified_prod_state>
## Verified Live State (prod `wgrknodfxdjtddsirldw`, read-only, 2026-05-29)

The threat premise was confirmed against the live DB before planning:

1. **RLS policy** `"Users can update own walkthrough status"` — `FOR UPDATE TO authenticated`, `USING ((select auth.uid()) = id)`, `WITH CHECK ((select auth.uid()) = id)`, **permissive, NOT column-scoped** (despite the name). Defined on disk in `supabase/migrations/20260320100000_add_walkthrough_completed.sql`.
2. **Column grants** — **both `authenticated` AND `anon`** hold `UPDATE` on `role`, `is_active`, `display_name`, `email`, `id`, `walkthrough_completed` (and `theme`). These grants are **untracked** (Supabase defaults / not from a committed migration) → treat as drift; the fix migration must `REVOKE` explicitly, not assume disk state.
3. **Triggers** — none on `public.profiles` (no guard).
4. **Restrictive policy** `profiles_no_dev_data_for_non_dev_viewers` (polpermissive=false) does NOT mitigate — its `id = auth.uid()` branch passes for a self-row edit.
5. `anon` is blocked from the row only because the RLS `USING` needs `auth.uid() = id`; the grants themselves are still over-broad.

</verified_prod_state>

<decisions>
## Implementation Decisions

### Self-editable column allowlist
- **D-01:** After `REVOKE`, `authenticated` may self-UPDATE **only `walkthrough_completed` and `theme`**. These are the exact columns the client writes per-user (`src/components/walkthrough/useWalkthroughStatus.ts`, `src/stores/themeStore.ts`). 
- **D-02:** `display_name` is **NOT** self-editable (it is server-set at `admin-create-user` time today; no client self-edit exists). Self-service rename deferred. *(This corrects the Urgent doc, which proposed granting `(walkthrough_completed, display_name)` and predates the Phase 25 `theme` column — granting its list verbatim would silently break dark-mode persistence and add an unused rename grant.)*
- **D-03:** `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` then `GRANT UPDATE (walkthrough_completed, theme) ON public.profiles TO authenticated;`. `anon` gets no UPDATE grant back.

### Defense-in-depth guard
- **D-04:** Keep the existing `"Users can update own walkthrough status"` RLS policy as-is (it is correct once grants are column-scoped). Column-scoped grants are the primary control.
- **D-05:** Add a `BEFORE UPDATE` trigger on `public.profiles` that **raises** if `role` or `is_active` is being changed (`NEW.role IS DISTINCT FROM OLD.role` / same for `is_active`) **unless** the caller is a legitimate admin path. Defense against any future broad re-grant.
- **D-06:** The trigger MUST NOT break the legitimate admin mutation path. `admin-update-user` (`supabase/functions/admin-update-user/index.ts`) toggles `is_active` via **service_role**. Guard exemption: allow the change when `private.is_admin()` is true OR the caller is the service role (e.g. `auth.role() = 'service_role'` / `current_user`/`session_user` is the service role). Researcher/planner to pin exact predicate; the invariant is "a non-admin authenticated session can never change role/is_active; admin Edge path and admins still can."

### Apply + verification path
- **D-07:** Ship in-phase: author migration → mandatory Codex adversarial review (auth/schema change, **D-046** — Claude-owned, Codex barred from implementing) → `supabase db push` to prod within Phase 31. P0 live vector + standing authorization to apply migrations autonomously.
- **D-08:** Run the **admin-list audit** as an explicitly-authorized prod read during execution: `select id, display_name, role, created_at from profiles where role='admin'` — confirm only the known admin set (no prior self-promotion). *(Blocked from the discuss step by the prod-read classifier; it belongs in execution under a named prod authorization.)*
- **D-09:** Regen `src/db/database.types.ts` via `npm run db:types` after apply (grants/trigger don't change the row shape, so expect a no-op diff — run anyway to confirm no drift). Then Tier-2 smoke.

### Claude's Discretion
- Exact trigger function name, schema (`private` vs `public`), and the service-role/admin predicate syntax.
- Whether to also add a column-restricting `WITH CHECK` to the RLS policy as belt-and-suspenders (trigger already covers it — optional).
- Migration filename/timestamp (follow the `supabase/migrations/<ts>_lock_profiles_self_update.sql` convention).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Threat spec + sibling vector
- `../_workspace/Urgent/sec-profiles-self-update-escalation.md` — the P0 threat write-up, prod verification, proposed fix plan (note: its grant list is corrected by D-01/D-02 above).
- `../_workspace/Urgent/sec-role-escalation-signup.md` — SEC-1, the *signup* vector (already fixed); confirms this is independent.

### Offending + template migrations (in this repo)
- `supabase/migrations/20260320100000_add_walkthrough_completed.sql` — defines the over-broad self-update RLS policy (the bug).
- `supabase/migrations/20260318000005_rls_policies.sql` — the admin SELECT/UPDATE policies + `private.is_admin()` usage to reuse in the trigger.
- `supabase/migrations/20260318000000_create_profiles.sql` — profiles table definition (columns: id, role, display_name, is_active, created_at, email, walkthrough_completed, theme).
- `supabase/migrations/20260527000000_harden_handle_new_user_role.sql` — **SEC-1 fix pattern**: trigger hardcodes role; template for "guard role in a trigger".
- `supabase/migrations/20260527000001_scope_photos_storage_rls.sql` — **SEC-4 pattern**: column/owner-scoped GRANT + WITH CHECK on both old+new; the closest precedent for scoping.

### Legitimate admin path (must keep working)
- `supabase/functions/admin-update-user/index.ts` — toggles `is_active` via service_role; the guard trigger must exempt it.
- `supabase/functions/admin-create-user/index.ts` — sets `role='specialist'` server-side; confirms role is never client-assigned.

### Client self-writes (must keep working)
- `src/components/walkthrough/useWalkthroughStatus.ts:39,48` — writes `walkthrough_completed`.
- `src/stores/themeStore.ts:86` — writes `theme`.
- `src/db/database.types.ts:299` — profiles Row/Update shape; regen target.

### Cross-app decisions
- `../_workspace/Decisions/D-046-claude-owns-schema-auth-codex-barred.md` — auth/schema plumbing is Claude-owned; Codex reviews but does not implement.
- `../_workspace/Decisions/D-001-shared-supabase.md` — shared DB; this fix is global across all 3 apps.
- `../_workspace/Decisions/D-003-anon-key-public-rls-boundary.md` — anon key is public; RLS + grants are the only boundary (why this vector matters).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `private.is_admin()` — existing SECURITY-helper already used by the profiles policies; reuse in the guard trigger's admin-exemption.
- SEC-4 storage RLS migration (`20260527000001`) — copy its column/owner-scoping idiom for the GRANT.
- SEC-1 `handle_new_user` trigger (`20260527000000`) — copy its "guard a privileged column inside a trigger" idiom.

### Established Patterns
- Migrations live in `supabase/migrations/<timestamp>_<name>.sql`; prod applied via `supabase db push`.
- `private` schema holds security helpers (`is_admin`, `is_dev_user`); guard trigger likely belongs there.
- Auth/schema changes require Codex adversarial review before merge/apply (D-046, D-044 dual-vendor).

### Integration Points
- `admin-update-user` service_role Edge Function is the ONLY legitimate role/is_active writer besides admins — the trigger exemption is the critical compatibility seam.
- Client theme + walkthrough writes hit the column-scoped grant — Tier-2 smoke must exercise both post-apply.

</code_context>

<specifics>
## Specific Ideas

- Verification mirrors the Urgent doc's checklist: re-query `information_schema.column_privileges` to prove `authenticated`/`anon` no longer hold UPDATE on `role`/`is_active`; specialist `PATCH {role:'admin'}` → 403/no-op; specialist `PATCH {walkthrough_completed:true}` and `{theme:'dark'}` → succeed; `admin-update-user` still toggles `is_active`; admin-list audit clean.
- Merge-ordering note from the Urgent doc: the receipt-NULL migration (`20260527000003`) could destroy ~7 prod rows on the same push — keep this hardening migration's push isolated/sequenced so it doesn't drag an unsafe sibling along.

</specifics>

<deferred>
## Deferred Ideas

- **Self-service `display_name` rename** for specialists — not now; would need its own UX + grant. (D-02)
- **Repo-wide `column_privileges` audit** of other tables for the same over-broad-grant pattern — separate hardening sweep, not this phase.
- Adding a column-restricting `WITH CHECK` to the RLS policy — optional belt-and-suspenders; trigger already covers role/is_active.

None of these are blockers for Phase 31.

</deferred>

---

*Phase: 31-sec-profiles-self-update-hardening*
*Context gathered: 2026-05-29*
