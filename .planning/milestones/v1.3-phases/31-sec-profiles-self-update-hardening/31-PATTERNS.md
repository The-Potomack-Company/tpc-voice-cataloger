# Phase 31: sec-profiles-self-update-hardening - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 3 (1 new migration, 1 new verification SQL snippet, 1 optional pgTAP test)
**Analogs found:** 3 / 3 (migration: strong; verify SQL: role-match; pgTAP: no analog)

This phase produces ONE primary deliverable — a single idempotent SQL migration — plus a verification snippet and an optional pgTAP test. Every excerpt below is a real line from an in-repo precedent the executor should mirror, not invent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/<ts>_lock_profiles_self_update.sql` | migration (DDL: REVOKE/GRANT + guard function + trigger) | transform (privilege/schema reconcile) | `supabase/migrations/20260527000001_scope_photos_storage_rls.sql` (REVOKE/scope precedent) + `20260527000000_harden_handle_new_user_role.sql` (guard-a-column-in-a-trigger) + `20260318000004_helper_functions.sql` (SECURITY DEFINER + `search_path=''` + `DROP/CREATE TRIGGER`) | exact (composite) |
| `supabase/queries/verify-profiles-grants.sql` | config / verification SQL (read-only assertion) | request-response (read) | none in-repo (no `supabase/queries/` dir exists) — closest sibling is the `information_schema` query in 31-RESEARCH.md §Code Examples | role-match (template from RESEARCH) |
| `supabase/tests/profiles_self_update.test.sql` *(OPTIONAL)* | test (pgTAP) | request-response (assert) | none — neither SEC precedent shipped a pgTAP file | no analog |

## Pattern Assignments

### `supabase/migrations/<ts>_lock_profiles_self_update.sql` (migration, transform)

**Primary analog:** `supabase/migrations/20260527000001_scope_photos_storage_rls.sql`
**Secondary analogs:** `20260527000000_harden_handle_new_user_role.sql`, `20260318000004_helper_functions.sql`, `20260320100000_add_walkthrough_completed.sql`

This migration has four idiomatic parts; each maps to a specific analog excerpt. Copy structure, naming, lowercase-DDL style, and comment style verbatim.

---

**(A) Header comment convention** — copy the SEC-4 / SEC-1 header style: lead with the SEC/audit id, name the offending file with line numbers, state what changes, cite the Urgent/backlog doc + decisions.

From `20260527000001_scope_photos_storage_rls.sql:1-12`:
```sql
-- SEC-4: storage-bucket RLS ownership scoping.
-- The original photos-bucket policies (20260320200000_create_photos.sql:76-85)
-- gated only on bucket_id = 'photos', so any authenticated specialist could
-- read or overwrite (upsert) another specialist's blobs by path. The photos
-- *table* RLS is already session-scoped; this migration brings storage.objects
-- to the same ownership model.
-- ...
-- See _workspace/Urgent + audit-consolidated-backlog-2026-05-27.md, D-046, D-051.
```
From `20260527000000_harden_handle_new_user_role.sql:1-5` (tighter SEC-id header):
```sql
-- SEC-1: handle_new_user trusted raw_user_meta_data->>'role', allowing
-- self-assigned admin via supabase.auth.signUp({data:{role:'admin'}}) when
-- public signup is enabled. Hardcode 'specialist'; admin elevation stays
-- strictly on the admin-only Edge Function path. See _workspace/Urgent/
-- sec-role-escalation-signup.md and audit-consolidated-backlog-2026-05-27.md.
```
**Executor action:** Write a header naming the offending policy file `20260320100000_add_walkthrough_completed.sql:7-12`, the untracked drifted grants, the fix, and citing `../_workspace/Urgent/sec-profiles-self-update-escalation.md`, D-046, D-001, D-003.

---

**(B) REVOKE + narrow column GRANT** — there is no exact "column GRANT/REVOKE" line in the repo (SEC-4 scopes via RLS policies, not column grants), so the canonical text comes from 31-RESEARCH.md §Pattern 1 / §Code Examples (Postgres primary docs). Mirror the lowercase-DDL house style of every analog migration:
```sql
-- 1) Revoke drifted broad UPDATE (table-form also clears all column grants).
-- 2) Re-grant only the two client-written columns to authenticated.
revoke update on public.profiles from authenticated, anon;
grant  update (walkthrough_completed, theme) on public.profiles to authenticated;
-- anon intentionally gets nothing back.
```
**Trap (RESEARCH Pattern 1 / Pitfall 1):** do NOT use `revoke update (role, is_active) ...` — per-column REVOKE is a documented no-op when a table grant exists. Table-form first. The columns `walkthrough_completed` (added `20260320100000`) and `theme` (added `20260512000000`) are the ONLY client self-writes per D-01; `display_name` is server-set (D-02) and must NOT be granted.

---

**(C) Guard trigger FUNCTION** — copy the function envelope from `is_admin()` and the SEC-1 trigger function (language/security/search_path stanza), with the `IS DISTINCT FROM` + `raise exception` body from RESEARCH §Pattern 2.

Function envelope to mirror — from `20260318000004_helper_functions.sql:5-9`:
```sql
create or replace function private.is_admin()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
```
SEC-1 trigger-function form (returns trigger) — from `20260527000000_harden_handle_new_user_role.sql:6-10`:
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
```
Composed guard body (31-RESEARCH.md §Code Examples — note RESEARCH recommends **SECURITY INVOKER** for this one so `current_user` is unambiguously the PostgREST-switched caller; `private.is_admin()` stays SECURITY DEFINER):
```sql
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
```
**Reuse, don't rebuild:** the admin exemption MUST call the existing `private.is_admin()` (`20260318000004:5`) — do not write a new admin-lookup query (RESEARCH §Don't Hand-Roll). The `private` schema already exists (`20260318000004:2 create schema if not exists private;`); re-asserting it at the top is harmless and matches repo idiom.

---

**(D) Idempotent trigger creation** — copy the `create trigger` form from `20260318000004:53-55`, but prepend `drop trigger if exists` (PG15-safe re-run; Pitfall 4):

Analog `create trigger` form — `20260318000004_helper_functions.sql:53-55`:
```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```
SEC-4 already establishes the `drop ... if exists` guard idiom — `20260527000001:15-16`:
```sql
drop policy if exists "Users can upload photos" on storage.objects;
drop policy if exists "Users can read photos" on storage.objects;
```
**Executor action** (compose the two):
```sql
drop trigger if exists trg_guard_profiles_privileged_columns on public.profiles;
create trigger trg_guard_profiles_privileged_columns
  before update on public.profiles
  for each row execute function private.guard_profiles_privileged_columns();
```

---

**(E) RLS policy being KEPT (do not touch)** — the existing self-update policy is correct once grants are column-scoped (D-04). Do NOT drop or rewrite it. For reference, it is `20260320100000_add_walkthrough_completed.sql:7-12`:
```sql
CREATE POLICY "Users can update own walkthrough status"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ( (SELECT auth.uid()) = id )
  WITH CHECK ( (SELECT auth.uid()) = id );
```
The admin write path it coexists with — `20260318000005_rls_policies.sql:18-21`:
```sql
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using ( (select private.is_admin()) );
```

---

### `supabase/queries/verify-profiles-grants.sql` (config/verification, request-response)

**Analog:** none in-repo (`supabase/queries/` does not exist yet — executor creates the dir). Use the `information_schema` template from 31-RESEARCH.md §Code Examples (V-1):
```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated','anon') and privilege_type = 'UPDATE'
order by grantee, column_name;
-- EXPECT: only ('authenticated','UPDATE','walkthrough_completed') and
--         ('authenticated','UPDATE','theme'). No rows for anon. No role/is_active.
```
**Match quality note:** role-match only — there is no precedent verification-SQL file in the repo; the repo's established post-migration verification is `information_schema` queries + Tier-2 smoke (neither SEC-1 nor SEC-4 shipped a separate query/test file). Keep this snippet minimal and authorized-prod-read friendly (D-08).

---

### `supabase/tests/profiles_self_update.test.sql` *(OPTIONAL — pgTAP)* (test, request-response)

**Analog:** none. Neither `20260527000000` nor `20260527000001` shipped a pgTAP test (RESEARCH §Validation Architecture, Precedents). `supabase/tests/` does not exist. This would be a **net-new pattern** — only add it if a local `supabase start` stack is confirmed available; otherwise fall back to the `information_schema` query (V-1) + Tier-2 smoke as the repo precedent dictates. Planner should mark it optional/skippable, not blocking.

## Shared Patterns

### Lowercase DDL house style
**Source:** all `2026031800000*` + `2026052700000*` migrations.
**Apply to:** the entire new migration.
SEC-era migrations use **lowercase** `create`/`revoke`/`grant`/`drop`/`as $$ ... $$`. (Only the older `20260320100000` uses uppercase `CREATE POLICY` — do NOT match that one; follow the newer SEC convention.)

### SECURITY DEFINER + `search_path = ''` for `private.*` helpers
**Source:** `20260318000004_helper_functions.sql:8`, `:24`, `:39`; `20260527000000:9`.
**Apply to:** the new guard function (RESEARCH recommends INVOKER for the *trigger* fn specifically, but `set search_path = ''` is non-negotiable on every function in this repo — Pitfall 5).
```sql
language plpgsql
security definer set search_path = ''   -- (use `security invoker` for the guard trigger per RESEARCH §Pattern 2)
```

### Reuse `private.is_admin()` for admin checks
**Source:** `20260318000004_helper_functions.sql:5-18`; used by `20260318000005:21` and `20260527000001:24`.
**Apply to:** the guard trigger's admin exemption. Call `(select private.is_admin())` — never re-query the profiles table inline.

### Legitimate admin mutation path the trigger MUST NOT break
**Source:** `supabase/functions/admin-update-user/index.ts:30,45-48,68-71`.
**Apply to:** the guard trigger exemption (D-06). This Edge fn runs as `createAdminClient()` (service_role) and does exactly:
```ts
const supabaseAdmin = createAdminClient()
// ...
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .update({ is_active: true })   // (and { is_active: false } on deactivate, :68-71)
  .eq('id', userId)
```
Because this client uses the service_role JWT, PostgREST `SET LOCAL ROLE service_role` → `current_user = 'service_role'` → the trigger's first exemption branch (`if current_user = 'service_role' then return new;`) lets it through. **Tier-2 smoke MUST exercise activate AND deactivate via this Edge fn post-apply (V-5).** This is the critical compatibility seam.

### Client self-writes the column GRANT must keep working
**Source (for the executor's awareness, not edited):** `src/components/walkthrough/useWalkthroughStatus.ts:39,48` writes `walkthrough_completed`; `src/stores/themeStore.ts:86` writes `theme`. These are the exact two columns in the re-GRANT (D-01). Smoke both post-apply (V-3, V-4).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/queries/verify-profiles-grants.sql` | verification SQL | read | No `supabase/queries/` precedent; template lives in RESEARCH, not the codebase |
| `supabase/tests/profiles_self_update.test.sql` *(optional)* | pgTAP test | assert | No pgTAP in repo; SEC-1/SEC-4 precedents shipped none. Net-new, optional, local-stack-gated |

## Metadata

**Analog search scope:** `supabase/migrations/` (all profiles/SEC migrations), `supabase/functions/admin-update-user/`, plus existence checks for `supabase/queries/` and `supabase/tests/`.
**Files scanned:** 7 migrations + 1 Edge function (read in full).
**Profiles columns (current shape, for the GRANT allowlist sanity check):** `id, role, display_name, is_active, created_at` (`20260318000000`), `+ walkthrough_completed` (`20260320100000`), `+ theme` (`20260512000000`), `+ email` (drift/elsewhere). GRANT only `(walkthrough_completed, theme)`.
**Pattern extraction date:** 2026-05-29

## PATTERN MAPPING COMPLETE

**Phase:** 31 - sec-profiles-self-update-hardening
**Files classified:** 3
**Analogs found:** 3 / 3 (migration exact-composite; verify SQL role-match via RESEARCH template; pgTAP no-analog/optional)

### Coverage
- Files with exact analog: 1 (the migration — composite of three SEC/helper migrations)
- Files with role-match analog: 1 (verify SQL — templated from RESEARCH, no in-repo file)
- Files with no analog: 1 (optional pgTAP test — net-new, local-stack-gated)

### Key Patterns Identified
- Migration is a 4-part composite: SEC-id header (SEC-4/SEC-1 style) + table-form REVOKE → narrow column GRANT + `private` guard function (is_admin envelope, INVOKER, `search_path=''`) + `DROP TRIGGER IF EXISTS` → `CREATE TRIGGER` idempotent pair.
- All recent SEC migrations use lowercase DDL and `set search_path = ''`; reuse `private.is_admin()` rather than re-querying profiles.
- The guard trigger's only compatibility seam is `admin-update-user/index.ts` (service_role → `current_user='service_role'` exemption); Tier-2 smoke of activate/deactivate is mandatory.

### File Created
`/home/spoods/Projects/TPC/tpc-voice-cataloger/.planning/milestones/v1.3-phases/31-sec-profiles-self-update-hardening/31-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog excerpt (file:line) directly in the migration's action section, the verification snippet, and the optional pgTAP decision.
