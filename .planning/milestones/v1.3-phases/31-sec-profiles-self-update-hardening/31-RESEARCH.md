# Phase 31: sec-profiles-self-update-hardening - Research

**Researched:** 2026-05-29
**Domain:** PostgreSQL privilege model (column-level GRANT/REVOKE), Supabase RLS + PostgREST role-switching, BEFORE UPDATE guard triggers, Supabase CLI migration apply
**Confidence:** HIGH

## Summary

This phase closes a live P0 privilege-escalation vector: any authenticated specialist can `PATCH /rest/v1/profiles {role:'admin', is_active:true}` because (a) the self-update RLS policy `"Users can update own walkthrough status"` is row-scoped but NOT column-scoped, and (b) untracked column-level UPDATE grants exist for both `authenticated` and `anon` on every profiles column including `role` and `is_active`. The fix is a single idempotent migration that REVOKEs broad UPDATE, re-GRANTs UPDATE only on `(walkthrough_completed, theme)` to `authenticated`, and adds a `BEFORE UPDATE` guard trigger that raises on any `role`/`is_active` change made by a non-admin, non-service caller.

All five "hard parts" resolved with HIGH confidence against authoritative sources:

1. **REVOKE clears column grants.** Postgres `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` (table form, no column list) **automatically revokes all column-level UPDATE grants on every column** `[CITED: postgresql.org/docs/current/sql-revoke.html]`. No per-column REVOKE needed. The inverse (revoking a column when a table grant exists) is a no-op — which is exactly the trap to avoid.
2. **Trigger predicate.** Recommend `current_user` (the actual enforced Postgres role PostgREST `SET LOCAL ROLE`s into) over `auth.role()` / JWT-claim parsing. For the service_role Edge path `current_user = 'service_role'`; for a specialist `current_user = 'authenticated'`. Admin exemption via the existing `private.is_admin()`.
3. **WITH CHECK belt-and-suspenders:** NOT needed for role/is_active (trigger + grants fully cover). Optional.
4. **Idempotency:** REVOKE is naturally idempotent; use `GRANT` (re-runnable), `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
5. **db push / db:types:** `supabase db push --yes` is migration-history-idempotent; `npm run db:types` produces a **no-op diff** (grants/triggers don't change row shape) — run to confirm zero drift.

**Primary recommendation:** One migration `supabase/migrations/<ts>_lock_profiles_self_update.sql` with REVOKE → column-scoped GRANT → `private` SECURITY DEFINER trigger function (search_path = '') keyed on `current_user`, guarded by `DROP TRIGGER IF EXISTS`. Codex adversarial review (D-046) → `supabase db push` → `npm run db:types` confirm-no-drift → prod admin-list audit → Tier-2 smoke.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** After REVOKE, `authenticated` may self-UPDATE only `walkthrough_completed` and `theme` (the exact columns the client writes).
- **D-02:** `display_name` is NOT self-editable (server-set at admin-create-user time; self-service rename deferred). This corrects the Urgent doc, which proposed `(walkthrough_completed, display_name)` and predates the `theme` column.
- **D-03:** `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` then `GRANT UPDATE (walkthrough_completed, theme) ON public.profiles TO authenticated;`. `anon` gets no UPDATE back.
- **D-04:** Keep the existing `"Users can update own walkthrough status"` RLS policy as-is. Column-scoped grants are the primary control.
- **D-05:** Add a `BEFORE UPDATE` trigger that raises if `role` or `is_active` changes (`NEW.x IS DISTINCT FROM OLD.x`) unless the caller is a legitimate admin path.
- **D-06:** Trigger MUST NOT break `admin-update-user` (toggles `is_active` via service_role). Exemption: allow when `private.is_admin()` OR caller is service role. Researcher/planner pins exact predicate. Invariant: "a non-admin authenticated session can never change role/is_active; admin Edge path and admins still can."
- **D-07:** Ship in-phase: author → mandatory Codex adversarial review (D-046, Claude-owned, Codex barred from implementing) → `supabase db push` to prod within Phase 31.
- **D-08:** Run admin-list audit as authorized prod read during execution: `select id, display_name, role, created_at from profiles where role='admin'`.
- **D-09:** Regen `src/db/database.types.ts` via `npm run db:types` after apply (expect no-op diff). Then Tier-2 smoke.

### Claude's Discretion
- Exact trigger function name, schema (`private` vs `public`), and the service-role/admin predicate syntax.
- Whether to add a column-restricting `WITH CHECK` to the RLS policy as belt-and-suspenders (optional — trigger covers it).
- Migration filename/timestamp (follow `supabase/migrations/<ts>_lock_profiles_self_update.sql`).

### Deferred Ideas (OUT OF SCOPE)
- Self-service `display_name` rename for specialists.
- Repo-wide `column_privileges` audit of other tables.
- Adding a column-restricting `WITH CHECK` to the RLS policy (optional belt-and-suspenders).

## Project Constraints (from CLAUDE.md)

- **D-046 (hard):** auth/schema is Claude-owned; Codex reviews but does NOT implement. Mandatory Codex adversarial review before apply.
- **D-001:** Supabase is shared across 3 apps (cataloger, this app, dashboard). This fix is **global** — `authenticated`/`anon` are shared roles; the REVOKE affects all three apps' clients. Verify no other app writes profiles columns other than `walkthrough_completed`/`theme` before applying. Canonical schema lives at `../_workspace/Schema/schema.md`; start there, not from local belief.
- **D-003:** anon key is public; RLS + grants are the only boundary (why this vector is exploitable).
- Schema changes must start from `../_workspace/Schema/schema.md` and regenerate `src/db/database.types.ts` via `npm run db:types` after migration.
- Migrations live in `supabase/migrations/<timestamp>_<name>.sql`; prod applied via `supabase db push`.
- Merge-ordering hazard (from Urgent doc + CONTEXT specifics): the receipt-NULL migration `20260527000003` could destroy ~7 prod rows on the same push. **Keep this migration's push isolated** — confirm `supabase db push --dry-run` lists ONLY this migration before applying, or that all pending siblings are individually safe.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Column-level write authorization | Database (GRANT/REVOKE) | — | Postgres privilege system is the enforced boundary; anon key is public so client cannot be trusted (D-003) |
| Row ownership (self-row only) | Database (RLS policy) | — | Existing `auth.uid() = id` policy; correct once grants are column-scoped |
| Role/is_active mutation guard | Database (BEFORE UPDATE trigger) | — | Defense-in-depth against future broad re-grant; runs regardless of grant state |
| Legitimate admin mutation | API/Edge (service_role) | Database (trigger exemption) | `admin-update-user` runs as service_role; trigger must recognize and exempt it |
| Client self-writes (walkthrough, theme) | Client → Database (column grant) | — | `useWalkthroughStatus.ts`, `themeStore.ts` write via anon-key authenticated session |

## Standard Stack

No new packages. This is a pure SQL migration + existing tooling.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Supabase CLI | 2.81.3 (local `node_modules/.bin/supabase`) | author/apply migration via `db push` | [VERIFIED: `node_modules/.bin/supabase --version`] established repo workflow |
| PostgreSQL | 15 (`supabase/config.toml` major_version=15) | target DB engine | [VERIFIED: supabase/config.toml] shared prod is PG15 |
| `private.is_admin()` | existing | trigger admin-exemption | [VERIFIED: supabase/migrations/20260318000004_helper_functions.sql:5] SECURITY DEFINER, search_path='' |
| vitest | ^4.0.18 | unit/mock tests (existing suite in `src/tests/`) | [VERIFIED: package.json] |

**No installation required.** CLI is already vendored; CLI v2.102.0 is available upstream but 2.81.3 is sufficient and matches the repo's locked tooling — do NOT upgrade as part of this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. All tooling (Supabase CLI, vitest, Postgres) is already present and version-pinned in the repo.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
  Specialist (anon key,   │  PostgREST                               │
  authenticated JWT)      │                                          │
        │  PATCH /rest/v1/profiles {role:'admin'}                    │
        ▼                 │  SET LOCAL ROLE authenticated            │
        ─────────────────►│  current_user = 'authenticated'          │
                          │                                          │
                          │  1. COLUMN GRANT check ──► role NOT in   │
                          │     (walkthrough_completed, theme)       │
                          │     ► 403 / column not updatable ◄───────┼── BLOCKED (primary control)
                          │                                          │
                          │  2. RLS USING (auth.uid()=id) ─► passes  │
                          │     for self-row (but never reached for  │
                          │     role col due to grant)               │
                          │                                          │
                          │  3. BEFORE UPDATE trigger ──► role       │
                          │     IS DISTINCT FROM OLD.role AND        │
                          │     current_user='authenticated' AND     │
                          │     NOT is_admin() ► RAISE ◄──────────────┼── BLOCKED (defense-in-depth)
                          └─────────────────────────────────────────┘

  Specialist self-write {walkthrough_completed:true} / {theme:'dark'}
        │  ──► GRANT(walkthrough_completed,theme) ✓ ──► RLS auth.uid()=id ✓
        ▼  ──► trigger: role/is_active unchanged ► no raise ► COMMIT ✓

  admin-update-user Edge Fn {is_active:false}  (service_role key)
        │  ──► PostgREST SET LOCAL ROLE service_role
        ▼  ──► service_role BYPASSES RLS + has full grants
            ──► trigger: current_user='service_role' ► EXEMPT ► COMMIT ✓

  Admin (authenticated, role=admin) editing another profile
        │  ──► "Admins can update profiles" RLS policy (is_admin) ✓
        ▼  ──► trigger: is_admin() true ► EXEMPT ► COMMIT ✓
```

### Pattern 1: Table-form REVOKE clears all column grants, then narrow re-GRANT
**What:** Revoke at the table level (no column list) to wipe both table-wide and per-column grants in one statement, then re-grant only the allowlist columns.
**When to use:** Whenever existing grants are untracked/drifted and you cannot enumerate exactly which columns were granted (our case — Supabase defaults granted all columns).
**Why it works:** "When revoking privileges on a table, the corresponding column privileges (if any) are automatically revoked on each column of the table, as well." `[CITED: postgresql.org/docs/current/sql-revoke.html]`
**Example:**
```sql
-- Source: postgresql.org/docs/current/sql-revoke.html + supabase column-level-security guide
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (walkthrough_completed, theme) ON public.profiles TO authenticated;
-- anon intentionally gets nothing back.
```
**Trap avoided:** Do NOT attempt `REVOKE UPDATE (role, is_active) ON public.profiles FROM authenticated` — if a table-level grant existed, per-column REVOKE is a documented no-op. Always revoke the whole privilege first. `[CITED: postgresql.org/docs/current/sql-revoke.html]`

### Pattern 2: Guard trigger keyed on `current_user` (recommended predicate)
**What:** A `BEFORE UPDATE` trigger function in the `private` schema, SECURITY DEFINER with `search_path = ''`, that raises when a protected column changes unless the caller is an admin or the service role.
**Recommended predicate:** `current_user`.

**Why `current_user` is the most robust choice:**

PostgREST issues `SET LOCAL ROLE <jwt-role-claim>` for the duration of each request `[CITED: docs.postgrest.org/en/v12/references/auth.html]`. This sets `current_user` to the enforced Postgres role:
- Specialist request → `current_user = 'authenticated'`
- service_role Edge call → `current_user = 'service_role'`
- anon request → `current_user = 'anon'`

`current_user` is the role Postgres actually evaluates privileges against — it is the *enforced* identity, not a parseable claim. It cannot be spoofed by a client because the client cannot choose its own `SET ROLE` target (PostgREST derives it from the verified JWT signature).

**Failure modes of the alternatives (why NOT to use them as the primary check):**

| Alternative | Failure mode |
|-------------|--------------|
| `auth.role()` / `current_setting('request.jwt.claims',true)::json->>'role'` | Reads a GUC populated by PostgREST from JWT claims. Works, but is one indirection removed from the enforced role; returns NULL/empty in any context where the GUC isn't set (direct psql, `db push` DDL, future non-PostgREST callers), making the predicate fragile. Use only as a secondary signal, never the sole gate. |
| `session_user` | Stays as the **authenticator** role (the pooled connection role), NOT the switched role — `SET LOCAL ROLE` changes `current_user`, not `session_user` `[CITED: postgresql.org/docs/current/sql-set-role.html]`. Always wrong here. |
| `(SELECT auth.uid()) IS NULL` | service_role has no `sub` claim so `auth.uid()` IS NULL for the Edge path — superficially usable, but it ALSO is NULL for anon, for SQL-editor/cron, and for any future service that legitimately or illegitimately reaches the table. Too coarse; conflates "service role" with "no user context." |
| SECURITY DEFINER context confusion | Inside a SECURITY DEFINER function, `current_user` becomes the function **owner**, not the caller. The trigger function must therefore read `current_user` semantics carefully — see note below. |

**SECURITY DEFINER vs INVOKER decision:** Make the trigger function **SECURITY DEFINER** (matching every other `private.*` helper and `handle_new_user` in this repo) **with `set search_path = ''`** for injection hardening — but capture the caller's role with `current_user` evaluated *at the top of the function before any role context shifts*. Note: a BEFORE UPDATE trigger fires in the calling statement's role context; `current_user` inside the trigger reflects the role that issued the UPDATE (PostgREST's switched role), because trigger functions do not themselves switch roles unless declared SECURITY DEFINER **and invoked through a nested call**. To remove all ambiguity, the cleanest implementation reads the role via `current_user` and is declared SECURITY DEFINER only to guarantee `private.is_admin()` and `public.profiles` are reachable under a hardened empty search_path. If the planner prefers zero ambiguity, an equally valid choice is SECURITY INVOKER (the trigger needs no elevated privilege — it only reads OLD/NEW and calls the already-SECURITY-DEFINER `is_admin()`); INVOKER guarantees `current_user` is the true caller. **Recommendation: SECURITY INVOKER with explicit `set search_path = ''`** — the trigger requires no privilege escalation of its own, and INVOKER makes the `current_user` check unambiguous. `private.is_admin()` remains SECURITY DEFINER and works regardless.

**Example:**
```sql
-- Source: composed from repo precedent (20260527000000_harden_handle_new_user_role.sql,
-- 20260318000004_helper_functions.sql) + postgrest auth role-switching docs.
create or replace function private.guard_profiles_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role)
     or (new.is_active is distinct from old.is_active)
  then
    -- Allow: the service_role Edge path, or an authenticated admin.
    if current_user = 'service_role' then
      return new;
    end if;
    if (select private.is_admin()) then
      return new;
    end if;
    raise exception
      'Only an administrator may change role or is_active (attempted by %).', current_user
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_privileged_columns on public.profiles;
create trigger trg_guard_profiles_privileged_columns
  before update on public.profiles
  for each row
  execute function private.guard_profiles_privileged_columns();
```

Notes:
- `errcode 42501` (`insufficient_privilege`) surfaces as a clean PostgREST 403-class error rather than a generic 500.
- The trigger condition uses `IS DISTINCT FROM` (null-safe) exactly as D-05 specifies.
- The trigger fires on ALL updates but only raises when a protected column actually changes, so legitimate `walkthrough_completed`/`theme` writes pass through untouched.
- Because column grants already prevent `authenticated` from even naming `role`/`is_active` in an UPDATE, the trigger is genuinely defense-in-depth — it catches the case where a future migration accidentally re-grants those columns.

### Pattern 3: Idempotent / re-runnable migration
**What:** Every statement must survive a partial-prior-state prod and a re-run.
- `REVOKE` — naturally idempotent (revoking an absent privilege is a no-op, not an error).
- `GRANT` — idempotent (re-granting is a no-op).
- `CREATE OR REPLACE FUNCTION` — idempotent.
- `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...` — idempotent pair (CREATE TRIGGER has no OR REPLACE in PG15).
- Optional `CREATE SCHEMA IF NOT EXISTS private;` at top (already exists, but harmless and matches repo idiom in `20260421000006`).

### Anti-Patterns to Avoid
- **Per-column REVOKE without table REVOKE:** no-op if a table grant exists. Always table-form REVOKE first.
- **Using `auth.role()` or `auth.uid() IS NULL` as the sole service-role gate:** fragile across non-PostgREST contexts. Use `current_user`.
- **`CREATE TRIGGER` without `DROP TRIGGER IF EXISTS`:** errors on re-run (PG15 has no `CREATE OR REPLACE TRIGGER`... actually PG14+ does support `CREATE OR REPLACE TRIGGER`, but `DROP IF EXISTS` + `CREATE` is the repo-safe, version-agnostic idiom — prefer it).
- **Bundling the receipt-NULL sibling migration into the same push:** could destroy ~7 prod rows. Push this migration isolated; `--dry-run` first.
- **Granting `display_name`:** would re-open a privileged-ish column and isn't a client self-write (D-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting service-role vs user | Custom JWT parsing in plpgsql | `current_user` (PostgREST's `SET LOCAL ROLE`) | The DB already enforces the role; parsing claims duplicates and weakens it |
| Admin check in trigger | New admin-lookup query | existing `private.is_admin()` | Already SECURITY DEFINER, search_path-hardened, used by all profiles policies |
| Column-write authorization | App-layer field allowlist | Postgres column GRANT | Anon key is public (D-003); only the DB boundary is trustworthy |
| Migration apply confirmation | Manual SQL via dashboard | `supabase db push` | Records in migration history table → idempotent, auditable, matches repo workflow |

**Key insight:** Every control here belongs in the database because the anon key is public and the client is fully untrusted (D-003). App-layer guards are cosmetic.

## Runtime State Inventory

> Rename/refactor/migration phase — included. This is a DDL migration against a shared live DB, so "runtime state" = the live grant/policy/trigger state that the migration must reconcile with.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | profiles rows on prod — admin-list audit (D-08) must confirm NO prior self-promotion before the fix lands. `select id, display_name, role, created_at from public.profiles where role='admin'` | Authorized prod read during execution; if an unexpected admin exists, escalate before/after applying |
| Live service config (untracked grants) | Column-level UPDATE grants to `authenticated` AND `anon` on role, is_active, display_name, email, id, walkthrough_completed, theme — UNTRACKED (Supabase defaults, not in any committed migration) → DRIFT | The REVOKE must be explicit; cannot assume disk state. Table-form REVOKE clears all of them. |
| OS-registered state | None — no OS-level registration involved | None |
| Secrets/env vars | `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`/login session needed for `db push` to prod. No secret *names* change. | Ensure CLI is linked + authed before push (user action if not already linked) |
| Build artifacts | `src/db/database.types.ts` — regenerated post-apply (D-09). Grants/trigger don't change row shape → expect zero diff. | Run `npm run db:types`; commit only if it diffs (it should NOT) |
| Cross-app clients | Cataloger + dashboard also use `authenticated`/`anon` against shared profiles. | Verify (via `../_workspace/Schema/schema.md` + grep of sibling repos if accessible) that no other app writes profiles columns beyond walkthrough_completed/theme. The REVOKE is global. |

**The canonical question — after every repo file is updated, what runtime systems still hold the old state?** The untracked column grants live ONLY in prod's catalog (`information_schema.column_privileges`), not in git. The migration is the only thing that reconciles them. No cron/scheduler/cache holds profiles-write state.

## Common Pitfalls

### Pitfall 1: Assuming disk migrations reflect prod grant state
**What goes wrong:** Writing `REVOKE UPDATE (role) ...` based on a committed migration that doesn't exist (the grants are Supabase defaults, never committed).
**Why it happens:** Grants drifted in via Supabase project defaults, not a tracked migration.
**How to avoid:** Use table-form `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` which clears all column grants regardless of how they were created. Verify post-apply via `information_schema.column_privileges`.
**Warning signs:** A grant audit shows `authenticated`/`anon` still hold UPDATE on `role` after the migration → the REVOKE used the wrong (column) form or named the wrong role.

### Pitfall 2: Trigger blocks the legitimate admin Edge path
**What goes wrong:** `admin-update-user` can no longer toggle `is_active` → admin account management breaks.
**Why it happens:** Exemption predicate doesn't recognize the service_role context, or uses `auth.uid()` (NULL for service_role) inverted.
**How to avoid:** `current_user = 'service_role'` exemption (verified: PostgREST `SET LOCAL ROLE service_role` for service-key requests). Tier-2 smoke MUST exercise activate + deactivate via the Edge function post-apply.
**Warning signs:** Edge function returns a 403/`42501` after the migration.

### Pitfall 3: Sibling migration rides along on the same push
**What goes wrong:** `supabase db push` applies ALL pending migrations, including `20260527000003` (receipt-NULL) which could destroy ~7 prod rows.
**Why it happens:** `db push` is greedy — it applies every migration not in the remote history table.
**How to avoid:** `supabase db push --dry-run` first; confirm the applied list contains ONLY this hardening migration (or that every listed sibling is independently verified safe). If unsafe siblings are pending, sequence/resolve them separately before pushing.
**Warning signs:** `--dry-run` lists more than the one new migration.

### Pitfall 4: `CREATE TRIGGER` non-idempotent on re-run
**What goes wrong:** Re-running the migration errors with "trigger already exists."
**How to avoid:** `DROP TRIGGER IF EXISTS trg_... ON public.profiles;` immediately before `CREATE TRIGGER`.

### Pitfall 5: search_path injection in the trigger function
**What goes wrong:** Unqualified table/function references resolve via a caller-controlled search_path.
**How to avoid:** `set search_path = ''` on the function and fully-qualify `public.profiles` references implicitly (NEW/OLD are fine; `private.is_admin()` is already schema-qualified). Matches every existing `private.*`/`handle_new_user` function. `[VERIFIED: supabase/migrations/20260318000004_helper_functions.sql:8]`

## Code Examples

### Full migration (composed reference for the planner)
```sql
-- Source: composed from repo precedents + postgresql.org/docs/current/sql-revoke.html
-- Phase 31: lock down self-update on public.profiles.
-- 1) Revoke drifted broad UPDATE (table-form also clears all column grants).
-- 2) Re-grant only the two client-written columns to authenticated.
-- 3) Defense-in-depth BEFORE UPDATE trigger guarding role/is_active.

revoke update on public.profiles from authenticated, anon;
grant  update (walkthrough_completed, theme) on public.profiles to authenticated;

create or replace function private.guard_profiles_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role)
     or (new.is_active is distinct from old.is_active) then
    if current_user = 'service_role' then return new; end if;
    if (select private.is_admin()) then return new; end if;
    raise exception
      'Only an administrator may change role or is_active (attempted by %).', current_user
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_privileged_columns on public.profiles;
create trigger trg_guard_profiles_privileged_columns
  before update on public.profiles
  for each row execute function private.guard_profiles_privileged_columns();
```

### Verification query — prove grants are gone
```sql
-- Source: information_schema standard
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated','anon') and privilege_type = 'UPDATE'
order by grantee, column_name;
-- EXPECT: only ('authenticated','UPDATE','walkthrough_completed') and
--         ('authenticated','UPDATE','theme'). No rows for anon. No role/is_active.
```

### Non-interactive apply
```bash
# Source: supabase.com/docs/reference/cli/supabase-db-push + `supabase db push --help`
node_modules/.bin/supabase db push --dry-run         # confirm ONLY this migration is pending
SUPABASE_DB_PASSWORD=*** node_modules/.bin/supabase db push --yes
npm run db:types                                      # expect zero diff; confirms no drift
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Broad column grants from Supabase defaults | Explicit table REVOKE + narrow column GRANT | this phase | Closes the vector at the privilege layer |
| Trust RLS row-scoping for column safety | Column GRANT is the column control; RLS is row control | n/a (conceptual) | Both gates must pass; they're orthogonal |
| `auth.uid() IS NULL` to detect service role | `current_user = 'service_role'` | best practice | Robust across non-PostgREST contexts |

**Deprecated/outdated:** none relevant. CLI 2.81.3 → 2.102.0 upgrade available but out of scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No app (cataloger/dashboard/this) writes profiles columns other than `walkthrough_completed`/`theme` via the authenticated role | Project Constraints, Runtime State | If a sibling app writes e.g. `display_name` as a self-write, the REVOKE breaks it. MITIGATE: grep sibling repos / check `../_workspace/Schema/schema.md` during planning. MEDIUM risk — CONTEXT lists only these two client writes for this app. |
| A2 | The Edge `admin-update-user` reaches Postgres with `current_user='service_role'` (i.e. supabase-js service-role client sends a service_role JWT, PostgREST switches role) | Pattern 2, Validation | If the service client instead bypasses PostgREST or uses a different role name, the exemption misses and admin toggles break. LOW risk — `createAdminClient` uses `SUPABASE_SERVICE_ROLE_KEY` which is the standard service_role JWT path. Tier-2 smoke catches it. |
| A3 | `supabase db push` history table makes prior-applied migrations skip, and this migration's SQL is independently re-runnable | Pattern 3 | If prod already has a partial trigger from a manual hotfix, DROP IF EXISTS handles it. LOW risk. |
| A4 | `npm run db:types` produces no diff for grant/trigger-only changes | D-09, Validation | Types reflect row shape, not grants; a diff would indicate unexpected schema change. LOW risk. |

**All four assumptions are verifiable at plan/execution time** — A1 by schema/sibling grep, A2 by Tier-2 smoke, A3/A4 by `--dry-run` and `git diff`.

## Open Questions (RESOLVED)

1. **Does any sibling app perform a profiles self-write beyond walkthrough/theme?** (A1)
   - **RESOLVED 2026-05-29:** sibling grep — `tpc-dashboard` references `profiles` in 7 files but ALL are reads (zero `.update`/`.upsert`/`.set`); `tpc-extension` and `tpc-hub` have ZERO `profiles` references. Only this app writes profiles, and only `walkthrough_completed` + `theme`. The table-form REVOKE is DB-wide-safe; no GRANT widening needed.
   - What we know: this app writes only `walkthrough_completed` and `theme`; `display_name` is server-set.
   - Belt-and-suspenders: Plan 31-02 Task 2 re-greps the siblings + re-reads `../_workspace/Schema/schema.md` immediately BEFORE the push and STOPs if any sibling now self-writes a column outside {walkthrough_completed, theme}.

2. **Is the CLI currently linked + authed to prod for `db push`?**
   - **RESOLVED:** Plan 31-02 Task 2 PRECONDITION-checks CLI link/auth (`supabase db push --dry-run`) and hands the user a `supabase login` + `supabase link --project-ref wgrknodfxdjtddsirldw` one-liner if absent (user-only auth action).
   - What we know: `db push` needs `--linked` (default) + `SUPABASE_DB_PASSWORD` or interactive password.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | author + `db push` | ✓ | 2.81.3 (node_modules/.bin) | npx supabase (slower) |
| PostgreSQL (prod) | apply target | ✓ (shared prod PG15) | 15 | — |
| vitest | unit/mock tests | ✓ | 4.0.18 | — |
| Local supabase stack (Docker) | OPTIONAL local integration test | unknown — `supabase start` not verified | — | Skip local; rely on staged prod verification + vitest mocks |
| Codex | mandatory adversarial review (D-046) | assumed available via `/codex:*` | — | Blocks apply if unavailable |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** local Docker supabase stack (for pgTAP/integration) — if unavailable, validation falls back to authorized prod reads + vitest mock tests (see Validation Architecture).

## Validation Architecture

> Nyquist enabled (config.json `workflow.nyquist_validation: true`). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 (`src/tests/`) for app-layer; raw SQL / `information_schema` query for DB-layer; pgTAP optional if local stack runs |
| Config file | vitest configured via `package.json` `"test": "vitest --run"` |
| Quick run command | `npm run test` (vitest mock suite) |
| Full suite command | `npm run test` + DB-layer verification queries (manual/authorized prod read) |

### Phase Requirements → Test Map
(No REQUIREMENTS.md IDs — audit-sourced. Verification points derived from CONTEXT specifics + Urgent doc checklist.)

| Ver ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| V-1 | `authenticated`/`anon` lack UPDATE on role/is_active | SQL (information_schema) | `information_schema.column_privileges` query (see Code Examples) | ❌ Wave 0 — add as a `verify-grants.sql` snippet run against prod (authorized read) or local stack |
| V-2 | specialist `PATCH {role:'admin'}` → 403/no-op | integration (negative) | pgTAP against local stack OR authorized manual prod PATCH with a test specialist token | ❌ Wave 0 — automatable only with local supabase stack; else authorized prod read |
| V-3 | specialist `PATCH {walkthrough_completed:true}` → success | integration (positive) | same harness as V-2; also covered indirectly by existing walkthrough flow | ❌ Wave 0 |
| V-4 | specialist `PATCH {theme:'dark'}` → success | integration (positive) | same harness | ❌ Wave 0 |
| V-5 | `admin-update-user` still toggles is_active | integration (Edge path) | invoke Edge function with admin token (activate + deactivate) — Tier-2 smoke | partial — `src/tests/admin-api.test.ts` mocks the invoke; real path needs Tier-2 |
| V-6 | admin-list audit clean (no rogue admin) | SQL (authorized prod read) | `select id,display_name,role,created_at from public.profiles where role='admin'` (D-08) | ❌ Wave 0 — execution-time authorized read |
| V-7 | `npm run db:types` zero diff | regression | `npm run db:types && git diff --exit-code src/db/database.types.ts` | ✅ tooling exists |

**Automatable vs authorized-prod-read split:**
- **Fully automatable (no prod):** V-1 (against local stack), V-7. With a local `supabase start` + pgTAP: V-1–V-5 become automatable as a pgTAP test file (`supabase/tests/profiles_self_update.test.sql`).
- **Requires authorized prod read/action:** V-2–V-6 if no local stack — V-6 is inherently a prod read (D-08, authorized in execution). V-5 via Tier-2 smoke against staged/prod Edge function.

**Precedents:** SEC-4 storage RLS (`20260527000001`) and SEC-1 `handle_new_user` (`20260527000000`) are the in-repo template migrations — neither shipped a pgTAP file, so the repo's established verification is `information_schema`/manual + Tier-2 smoke. Adding a pgTAP file would be a net-new pattern (nice-to-have, not required by precedent).

### Sampling Rate
- **Per task commit:** `npm run test` (vitest) — catches app-layer regressions in walkthrough/theme/admin-api mocks.
- **Per migration apply:** `supabase db push --dry-run` → V-1 grant query → V-7 types diff.
- **Phase gate:** Codex review pass + V-1..V-6 green (V-2..V-5 via local pgTAP or Tier-2 smoke, V-6 authorized prod read) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `supabase/queries/verify-profiles-grants.sql` (or inline) — V-1 grant assertion query
- [ ] OPTIONAL `supabase/tests/profiles_self_update.test.sql` (pgTAP) — automates V-1..V-5 IF local stack is available (`supabase start`); otherwise document as authorized-prod/Tier-2 manual steps
- [ ] Tier-2 smoke checklist entry: walkthrough write, theme write, admin activate/deactivate post-apply
- No new vitest framework install needed — suite exists.

## Security Domain

> `security_enforcement` not set to false → included. This phase IS a security fix.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Defense-in-depth: column GRANT (primary) + trigger (secondary) + RLS (row) |
| V2 Authentication | no | Auth unchanged; relies on existing Supabase JWT |
| V4 Access Control | **yes (core)** | Column-level Postgres GRANT + BEFORE UPDATE guard trigger + RLS row policy. Principle of least privilege — `authenticated` gets only 2 columns; `anon` gets none. |
| V5 Input Validation | partial | `IS DISTINCT FROM` guard on role/is_active; `errcode 42501` clean rejection |
| V6 Cryptography | no | none |
| V7 Error Handling | yes | `raise exception ... errcode 42501` → PostgREST 403-class, no info leak |

### Known Threat Patterns for Supabase/PostgREST + shared anon key

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-privilege-escalation via PATCH role/is_active | Elevation of Privilege | Revoke column grant + guard trigger (this phase) |
| Over-broad default column grants (drift) | Elevation of Privilege | Explicit table-form REVOKE; periodic `column_privileges` audit (deferred sweep) |
| Trigger bypass via service-role confusion | Elevation of Privilege | `current_user` predicate (enforced role, not parseable claim) |
| RLS bypass via missing column scope | Elevation of Privilege | Column GRANT gates columns; RLS gates rows — both required |
| anon write to profiles | Tampering | `anon` granted zero UPDATE; RLS `auth.uid()=id` also blocks |
| Migration drags unsafe sibling | Tampering / data loss | `db push --dry-run` isolation check before apply |

## Sources

### Primary (HIGH confidence)
- `postgresql.org/docs/current/sql-revoke.html` — table-form REVOKE auto-revokes column privileges; inverse no-op; GRANT OPTION FOR semantics.
- `postgresql.org/docs/current/sql-set-role.html` — `SET ROLE` changes `current_user`, not `session_user`.
- `docs.postgrest.org/en/v12/references/auth.html` — PostgREST `SET LOCAL ROLE <jwt-role>` per request; `current_user` = switched role, `session_user` = authenticator.
- Repo migrations (VERIFIED by direct read): `20260318000004_helper_functions.sql` (is_admin SECURITY DEFINER search_path=''), `20260320100000_add_walkthrough_completed.sql` (the buggy policy), `20260527000000` / `20260527000001` (SEC precedents), `20260512000000_add_theme_to_profiles.sql`, `20260318000000_create_profiles.sql`, `supabase/functions/admin-update-user/index.ts` + `_shared/admin-client.ts` (service_role path), `src/components/walkthrough/useWalkthroughStatus.ts`, `src/stores/themeStore.ts`.
- `supabase/config.toml` — PG15; `package.json` — db:types script, vitest 4.0.18; `supabase db push --help` — `--dry-run`/`--yes` flags.

### Secondary (MEDIUM confidence)
- `supabase.com/docs/guides/database/postgres/column-level-security` — column GRANT/REVOKE pattern (revoke table first, then grant columns) — agrees with PG primary docs.
- `supabase.com/docs/reference/cli/supabase-db-push` — `SUPABASE_DB_PASSWORD` for non-interactive; history-table skip = idempotent.

### Tertiary (LOW confidence)
- WebSearch summaries on `auth.role()` coalesce pattern — used only to corroborate that claim-based detection is GUC-dependent (the reason to prefer `current_user`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tooling verified present.
- REVOKE/GRANT semantics: HIGH — Postgres primary docs, direct quote.
- Trigger predicate: HIGH — PostgREST docs + PG SET ROLE docs converge on `current_user`.
- Idempotency / db push: HIGH — verified via `--help` and docs.
- Cross-app grant impact (A1): MEDIUM — verifiable at plan time, not yet checked.

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable domain; Postgres/PostgREST semantics are not fast-moving)

## RESEARCH COMPLETE

**Phase:** 31 - sec-profiles-self-update-hardening
**Confidence:** HIGH

### Key Findings
- Table-form `REVOKE UPDATE ON public.profiles FROM authenticated, anon;` **automatically clears all column-level grants** — no per-column REVOKE needed, and per-column REVOKE would be a no-op trap. [CITED: postgresql.org sql-revoke]
- Recommended trigger predicate is **`current_user`** (= `'service_role'` for the Edge path, `'authenticated'` for specialists) — the enforced Postgres role PostgREST switches into, more robust than `auth.role()`, `auth.uid() IS NULL`, or `session_user` (each failure mode documented).
- Trigger should be **SECURITY INVOKER + `set search_path = ''`** (needs no privilege of its own; INVOKER makes `current_user` unambiguous); reuse existing SECURITY-DEFINER `private.is_admin()` for admin exemption.
- Migration is fully idempotent: REVOKE/GRANT/`CREATE OR REPLACE FUNCTION` are no-op-safe; `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` for the trigger.
- `db push` is greedy — **`--dry-run` first** to ensure the unsafe receipt-NULL sibling (`20260527000003`) doesn't ride along; `npm run db:types` expected to produce **zero diff**.

### File Created
`/home/spoods/Projects/TPC/tpc-voice-cataloger/.planning/milestones/v1.3-phases/31-sec-profiles-self-update-hardening/31-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new packages; CLI/PG/vitest verified present |
| Architecture (REVOKE + trigger + RLS layering) | HIGH | Postgres + PostgREST primary docs; repo precedents read directly |
| Pitfalls | HIGH | Each grounded in docs or verified prod-state from CONTEXT |

### Open Questions
1. Does any sibling app (cataloger/dashboard) self-write profiles columns beyond walkthrough/theme? (A1 — verify via `../_workspace/Schema/schema.md` + sibling grep at plan time; likely none.)
2. Is the CLI linked + authed to prod for `db push`? (Execution-time check; user-only auth action if not.)

### Ready for Planning
Research complete. The trigger predicate, REVOKE semantics, idempotency idiom, db-push isolation, and validation points are all pinned. Planner can author the migration and VALIDATION.md directly from the Code Examples and Validation Architecture sections.
