---
phase: 18-update-tutorial-walkthrough-to-be-thorough
plan: 01
subsystem: walkthrough
tags: [walkthrough, supabase, migration, rls, hooks, step-definitions]
dependency_graph:
  requires: [profiles table, authStore, supabase client]
  provides: [walkthrough_completed column, useWalkthroughStatus hook, walkthroughSteps data]
  affects: [Walkthrough.tsx (Plan 02), Sessions.tsx (Plan 02), Settings.tsx (Plan 02)]
tech_stack:
  added: []
  patterns: [optimistic state update, single-query data fetch, role-aware step arrays]
key_files:
  created:
    - supabase/migrations/20260320100000_add_walkthrough_completed.sql
    - src/components/walkthrough/useWalkthroughStatus.ts
    - src/components/walkthrough/walkthroughSteps.tsx
  modified:
    - src/db/database.types.ts
decisions:
  - RLS self-update policy allows users to update any column on their own profiles row (acceptable because specialist UI does not expose dangerous columns)
  - Single Supabase query fetches both walkthrough_completed and role to avoid extra round trips
  - Error fallback shows walkthrough (safe default) and assumes specialist role
metrics:
  duration: 3 min
  completed: "2026-03-20T18:41:00Z"
---

# Phase 18 Plan 01: Walkthrough Data Layer & Step Definitions Summary

Migration adds walkthrough_completed boolean to profiles with self-update RLS policy; useWalkthroughStatus hook fetches completion and role in single query; 14 step definitions across shared/admin/specialist arrays with Heroicon SVGs matching UI-SPEC copywriting contract verbatim.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supabase migration, RLS policy, database types, and useWalkthroughStatus hook | 3a7def3 | 3 files (1 created migration, 1 modified types, 1 created hook) |
| 2 | Create walkthrough step definitions with role-aware content | 6d2bb66 | 1 file (walkthroughSteps.tsx) |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **RLS self-update policy scope:** The policy allows users to update any column on their own row, not just walkthrough_completed. This is acceptable because the app UI never exposes role or is_active fields to specialists, and the profiles table has server-side CHECK constraints on role values.

2. **Single-query pattern:** useWalkthroughStatus fetches both walkthrough_completed and role in one `.select('walkthrough_completed, role')` call, avoiding the double-query pitfall identified in RESEARCH.md.

3. **Error fallback:** On Supabase query error, the hook defaults to `walkthroughCompleted: false` (show walkthrough) and `role: 'specialist'` (safe default that shows fewer steps).

## Verification

- Migration file contains `walkthrough_completed boolean NOT NULL DEFAULT false` and RLS self-update policy
- database.types.ts profiles Row/Insert/Update all include walkthrough_completed
- useWalkthroughStatus.ts exports completeWalkthrough, resetWalkthrough, walkthroughCompleted, role, loading
- walkthroughSteps.tsx exports SHARED_STEPS (8), ADMIN_STEPS (4), SPECIALIST_STEPS (2), getStepsForRole
- getStepsForRole('admin') returns 12 steps, getStepsForRole(anything else) returns 10 steps
- All step descriptions match UI-SPEC copywriting contract
- Existing test suite: 35 passed, 8 failed (pre-existing), 5 skipped -- no regressions
