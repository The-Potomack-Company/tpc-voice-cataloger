---
phase: quick
plan: 260402-doe
subsystem: session-store
tags: [bugfix, rls, optimistic-ui, supabase]
dependency_graph:
  requires: []
  provides: [rls-silent-failure-detection]
  affects: [deleteItem, deleteSession, SessionDetail]
tech_stack:
  added: []
  patterns: [supabase-delete-select-chain, rls-silent-failure-revert]
key_files:
  created: []
  modified:
    - src/stores/sessionStore.ts
    - src/pages/SessionDetail.tsx
    - src/tests/session-store.test.ts
decisions:
  - "Use .select('id') after .delete() to detect RLS silent failures instead of { count: 'exact' } header"
  - "Console.error for RLS blocks rather than toast -- revert is sufficient user feedback"
  - "Mock zustand persist middleware in tests to avoid jsdom localStorage incompatibility with zustand 5"
metrics:
  duration: ~7min
  completed: "2026-04-02"
  tasks: 2
  tests_added: 5
  files_modified: 3
---

# Quick Task 260402-doe: Specialists Unable to Delete Items - Summary

Detect and revert Supabase RLS silent delete failures in sessionStore deleteItem/deleteSession using .select("id") chained after .delete() to get deleted row count.

## What Changed

### deleteItem (sessionStore.ts)
- Changed `.delete().eq("id", itemId)` to `.delete().eq("id", itemId).select("id")`
- Added check: if `deleted` array is empty (0 rows), revert the optimistic UI removal
- Logs `console.error` when RLS silently blocks the delete

### deleteSession (sessionStore.ts)
- Same `.select("id")` chain pattern as deleteItem
- Changed return type from `Promise<void>` to `Promise<boolean>`
- Returns `true` on success, `false` when RLS blocks or error occurs

### SessionDetail.tsx
- `handleConfirm` delete branch now checks `deleteSession` return value
- Only navigates away (`navigate("/")`) when delete succeeds
- On failure, stays on page (item reappears via optimistic revert)

### Test Infrastructure Fix
- Mocked zustand persist middleware in session-store.test.ts to bypass jsdom localStorage incompatibility with zustand 5 (pre-existing issue affecting all 12 tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing test infrastructure failure**
- **Found during:** Task 1 verification
- **Issue:** All 12 existing session-store tests were failing with `storage.setItem is not a function` due to zustand 5's persist middleware being incompatible with vitest 4 + jsdom's localStorage implementation
- **Fix:** Added `vi.mock("zustand/middleware")` to replace persist with a pass-through function in tests
- **Files modified:** src/tests/session-store.test.ts
- **Commit:** c3710fa (included in Task 1 commit)

## Commits

| Task | Commit  | Description |
|------|---------|-------------|
| 1    | c3710fa | fix: detect RLS silent failures in deleteItem and deleteSession |
| 2    | b44106a | test: add RLS silent-failure revert tests (5 new tests) |

## Verification

- TypeScript: compiles cleanly (`npx tsc --noEmit` -- no errors)
- Tests: 17/17 pass (12 existing + 5 new)

## Known Stubs

None.

## Self-Check: PASSED
