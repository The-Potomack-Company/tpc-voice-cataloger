---
phase: quick
plan: 4
subsystem: database
tags: [bugfix, sortOrder, items, TDD]
dependency_graph:
  requires: []
  provides: [correct-sort-order-after-deletion]
  affects: [item-list-ordering]
tech_stack:
  added: []
  patterns: [max-sortOrder-calculation]
key_files:
  created: []
  modified:
    - src/db/items.ts
    - src/tests/item-crud.test.ts
decisions:
  - Use max(sortOrder)+1 instead of count() for new item sortOrder assignment
metrics:
  duration: 1min
  completed: "2026-03-16T15:12:00Z"
---

# Quick Task 4: Fix sortOrder Calculation in createBlankItem

**One-liner:** Fix createBlankItem to use max(sortOrder)+1 instead of count, preventing new items from appearing between existing items after deletions.

## What Changed

### Problem
`createBlankItem` used `table.where("sessionId").equals(sessionId).count()` to determine sortOrder. After deleting items, the count becomes less than the max sortOrder, causing new items to be inserted between existing items instead of at the end.

### Solution
Replaced count-based sortOrder with max-sortOrder-based calculation:
- Query all items for the session sorted by sortOrder
- Take the last item's sortOrder as the max
- New item gets `max + 1` (or `0` if no items exist)

## TDD Execution

### RED Phase (commit: 978b22f)
- Added test: "assigns sortOrder after max existing sortOrder when items have been deleted" -- creates 3 items, deletes middle, verifies new item gets sortOrder 3
- Added test: "assigns sortOrder 0 when all items deleted" -- creates and deletes item, verifies new item gets sortOrder 0
- Updated existing test description to "creates a blank house item with correct sortOrder"
- Confirmed new test fails with expected 3, received 2

### GREEN Phase (commit: 341385c)
- Changed `createBlankItem` in `src/db/items.ts` to query items sorted by sortOrder and use max+1
- All 11 tests pass
- TypeScript compiles without errors

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- All 11 item-crud tests pass
- TypeScript compiles cleanly (`npx tsc --noEmit`)

## Self-Check: PASSED

- [x] src/db/items.ts exists
- [x] src/tests/item-crud.test.ts exists
- [x] Commit 978b22f (RED phase) exists
- [x] Commit 341385c (GREEN phase) exists
