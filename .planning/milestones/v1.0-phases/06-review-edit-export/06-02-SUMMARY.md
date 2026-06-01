---
phase: 06-review-edit-export
plan: 02
subsystem: ui, components
tags: [react, expandable-cards, inline-editing, export, swipe-to-delete, audio-recording, dexie]

requires:
  - phase: 06-review-edit-export
    provides: Item CRUD operations, EditableField component, export pipeline
  - phase: 05-ai-pipeline
    provides: processAudioWithAi for re-record mic button
provides:
  - Expandable ItemCard component with collapsed/expanded states
  - Refactored ItemList with Set-based expand state management
  - Export button on SessionDetail with active session warning
  - Re-record mic icon on collapsed cards
  - Add Item button creating blank items for manual entry
affects: [07-chrome-extension]

tech-stack:
  added: []
  patterns: [div role=button for nested interactive elements, Set-based expand state in React]

key-files:
  created:
    - src/components/ItemCard.tsx
    - src/tests/item-list.test.tsx
    - src/tests/re-record.test.ts
  modified:
    - src/components/ItemList.tsx
    - src/pages/SessionDetail.tsx

key-decisions:
  - "ItemCard collapsed row uses div role=button instead of button element to allow nested mic button without HTML violation"
  - "Expand state managed as Set<number> in ItemList local state (not Zustand) for simplicity"
  - "Floating Add Item button calls createBlankItem directly instead of navigating to ItemEntry page"

patterns-established:
  - "Expandable card pattern: collapsed preview + expanded detail with EditableField instances"
  - "Set-based toggle state: add/remove from Set for multi-expand tracking"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EXPO-01, EXPO-03]

duration: 4min
completed: 2026-03-09
---

# Phase 6 Plan 02: Review UI with Expandable Cards, Export Button Summary

**Expandable ItemCard with inline editing, swipe-to-delete, re-record mic icon, and export button with active session warning on SessionDetail**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T13:08:22Z
- **Completed:** 2026-03-09T13:12:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ItemCard component with collapsed preview (item number, title, description) and expanded section with all EditableField instances
- Re-record mic icon on collapsed cards wired to useAudioRecorder and processAudioWithAi
- SwipeableRow wrapping for swipe-to-delete plus button delete with ConfirmDialog
- Export button on SessionDetail with active session warning dialog, spinner state, and download/share
- RecordingIndicator and RecordingToast overlays added to SessionDetail for re-record visibility
- 8 new tests (4 item-list + 2 re-record + existing suite), all 139 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: ItemCard component with expandable view, inline editing, delete, and mic icon** - `93f9c32` (feat)
2. **Task 2: Export button on SessionDetail with active session warning** - `8c6ce24` (feat)

## Files Created/Modified
- `src/components/ItemCard.tsx` - Expandable item card with collapsed/expanded states, inline editing, delete, mic icon
- `src/components/ItemList.tsx` - Refactored to use ItemCard with Set-based expand state, Add Item button
- `src/pages/SessionDetail.tsx` - Export button, active session warning, createBlankItem, RecordingIndicator/Toast
- `src/tests/item-list.test.tsx` - 4 tests for item list rendering with expandable cards
- `src/tests/re-record.test.ts` - 2 tests for appendToItemField re-record logic

## Decisions Made
- ItemCard collapsed row uses `div role="button"` instead of `<button>` to allow nested mic button without HTML nesting violation
- Expand state managed as `Set<number>` in ItemList local state (not Zustand) for simplicity
- Floating Add Item button changed from navigating to `/item/new` to calling `createBlankItem` directly, keeping user on the review page
- Add Item button always visible (not just for active sessions) since reviewing/editing completed sessions should also allow manual additions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nested button HTML violation**
- **Found during:** Task 1 (ItemCard component)
- **Issue:** Collapsed row was a `<button>` containing a nested mic `<button>`, causing invalid HTML
- **Fix:** Changed outer element to `<div role="button" tabIndex={0}>` with keyboard handlers
- **Files modified:** src/components/ItemCard.tsx
- **Verification:** Tests pass without HTML nesting warnings
- **Committed in:** 93f9c32 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for valid HTML. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Review UI complete with expandable cards, inline editing, delete, re-record, and export
- All 139 tests passing, zero regressions
- Ready for Phase 7 (Chrome Extension) which consumes the export JSON

---
*Phase: 06-review-edit-export*
*Completed: 2026-03-09*
