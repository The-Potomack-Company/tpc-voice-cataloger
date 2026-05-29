---
phase: 31-sec-profiles-self-update-hardening
plan: 01
subsystem: db-auth
tags: [security, rls, grants, trigger, profiles, privilege-escalation, P0]
dependency_graph:
  requires: []
  provides:
    - "supabase/migrations/20260529000000_lock_profiles_self_update.sql (lock-down migration, authored not applied)"
    - "supabase/queries/verify-profiles-grants.sql (V-1 grant assertion query)"
  affects:
    - "public.profiles UPDATE grants (authenticated, anon) — applied in Plan 31-02"
    - "private.guard_profiles_privileged_columns() trigger fn — applied in Plan 31-02"
tech_stack:
  added: []
  patterns:
    - "Table-form REVOKE clears drifted column grants, then narrow column GRANT (PG sql-revoke semantics)"
    - "BEFORE UPDATE guard trigger keyed on current_user (PostgREST-switched role), security invoker + search_path=''"
    - "Reuse existing security-definer private.is_admin() for admin exemption"
    - "Idempotent migration: REVOKE/GRANT/CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS/CREATE TRIGGER"
key_files:
  created:
    - "supabase/migrations/20260529000000_lock_profiles_self_update.sql"
    - "supabase/queries/verify-profiles-grants.sql"
  modified: []
decisions: [D-01, D-02, D-03, D-04, D-05, D-06]
metrics:
  duration: "~8 min"
  completed: "2026-05-29"
  tasks: 2
  files: 2
---

# Phase 31 Plan 01: Lock Profiles Self-Update Summary

Authored the idempotent SQL migration that closes the live P0 profiles self-update privilege-escalation vector (table-form REVOKE + narrow column GRANT + BEFORE UPDATE guard trigger), plus the V-1 `information_schema.column_privileges` assertion query. Authoring only — zero prod side-effects; the migration is applied in Plan 31-02 after the mandatory Codex review.

## What Was Built

- **`supabase/migrations/20260529000000_lock_profiles_self_update.sql`** — four-part composite migration (timestamp sorts after the latest sibling `20260528000003`):
  - SEC header naming the offending row-scoped RLS policy (`20260320100000_add_walkthrough_completed.sql:7-12`) + the untracked drifted column grants; cites the Urgent doc, D-046, D-001, D-003.
  - `revoke update on public.profiles from authenticated, anon;` (table form — auto-clears all column grants) then `grant update (walkthrough_completed, theme) on public.profiles to authenticated;`. No `display_name`, no anon re-grant (D-01/D-02/D-03).
  - `private.guard_profiles_privileged_columns()` — `security invoker`, `set search_path = ''`, raises `42501` when `role`/`is_active` `is distinct from old`, exempting `current_user = 'service_role'` (admin Edge path, D-06) and `(select private.is_admin())` (authenticated admins). Reuses the existing helper; no inline profiles re-query.
  - Idempotent `drop trigger if exists trg_guard_profiles_privileged_columns ... ; create trigger ... before update on public.profiles ...`.
  - Existing "Users can update own walkthrough status" RLS policy left untouched (D-04).
- **`supabase/queries/verify-profiles-grants.sql`** — read-only V-1 query over `information_schema.column_privileges` for `public.profiles` UPDATE grants to authenticated/anon, with a trailing comment documenting the expected post-migration result (only `walkthrough_completed` + `theme` for authenticated; nothing for anon/role/is_active).

## Verification

- `npm run test` — 519 passed, 5 files skipped, 55 todo. No app-layer regression (this plan touches only SQL files). The pre-existing `localStorage.clear` failures noted in STATE.md did not surface in this run; suite exits green.
- Task 1 automated gate: `information_schema.column_privileges` + `walkthrough_completed` present in the query file. PASS.
- Task 2 automated grep gate (all 11 required substrings present, `display_name` absent): PASS.
- Scope guard honored: no `supabase db push`, no `supabase` invocation against prod, no `src/db/database.types.ts` change. Wave-2 / Plan 31-02 owns those.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Grep-gate literal alignment in the migration**
- **Found during:** Task 2 (running the plan's own automated verify gate).
- **Issue:** Two formatting choices tripped the literal substring gate: (a) a comment reading "display_name is intentionally NOT granted" caused `! grep -qi "display_name"` to fail; (b) `grant  update` (two-space alignment, mirroring RESEARCH's pretty-printed snippet) failed the `grant update (...)` single-space check.
- **Fix:** Reworded the comment to "No other column is granted: the user-facing name is server-set..." (same meaning, no forbidden token) and normalized to single-space `grant update`. No behavioral change to the SQL.
- **Files modified:** `supabase/migrations/20260529000000_lock_profiles_self_update.sql`
- **Commit:** 002b346

Otherwise the plan was executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None — both files are complete deliverables. The migration is intentionally not applied (authoring-only plan; apply is Plan 31-02).

## Self-Check: PASSED

- FOUND: supabase/migrations/20260529000000_lock_profiles_self_update.sql
- FOUND: supabase/queries/verify-profiles-grants.sql
- FOUND commit af68e37 (Task 1, verify query)
- FOUND commit 002b346 (Task 2, migration)
