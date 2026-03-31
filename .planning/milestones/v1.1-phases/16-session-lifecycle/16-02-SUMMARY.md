---
phase: 16-session-lifecycle
plan: 02
subsystem: ui
tags: [react, lifecycle, role-aware, session-detail, submit, return, export]

# Dependency graph
requires:
  - phase: 16-session-lifecycle
    provides: "16-01 lifecycle sections, hooks, ReturnDialog, SessionCard status pills"
  - phase: 15-session-assignment
    provides: "useUserRole hook, admin reassignment in SessionDetail"
provides:
  - "SessionDetail lifecycle controls: Submit for Review, Export Session, Return to Specialist in header area"
  - "Role-aware read-only lock (specialist locked on submitted/exported, admin never locked)"
  - "Status banners: blue submitted banner, sticky amber returned/review-notes banner"
  - "Export with status update to 'exported' after download"
  - "ReturnDialog integration with review_notes persistence"
affects: [16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["role-aware lifecycle button placement in header area", "isLifecycleLocked derivation for specialist read-only gating"]

key-files:
  created: []
  modified: [src/pages/SessionDetail.tsx, src/utils/export.ts, src/db/types.ts]

key-decisions:
  - "All lifecycle buttons (Submit, Export, Return) placed in header area per CONTEXT.md locked decisions; Delete remains at bottom"
  - "Replaced direct db/sessions updateSession/deleteSession imports with sessionStore methods for optimistic updates"
  - "Export no longer shows confirmation dialog for active sessions (admin-only now, admin makes the call)"
  - "Updated Session type in types.ts to include all lifecycle statuses (was still using 'active' | 'completed')"

patterns-established:
  - "isLifecycleLocked pattern: specialist + submitted = locked; admin never locked by status"
  - "storeUpdateSession pattern: all session mutations go through Zustand store for optimistic updates"

requirements-completed: [LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 16 Plan 02: Session Detail Lifecycle Summary

**Full submit-review-return-export lifecycle on SessionDetail with role-aware header buttons, status banners, read-only lock, and ReturnDialog integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T17:20:09Z
- **Completed:** 2026-03-20T17:24:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote SessionDetail with complete lifecycle controls: Submit for Review (specialist), Export Session (admin-only), Return to Specialist (admin) all in header area
- Added role-aware read-only lock (isLifecycleLocked) so submitted/exported sessions are locked for specialist but never for admin
- Added blue submitted status banner and sticky amber returned/review-notes banner with proper dark mode support
- Removed Mark Complete and Reopen Session buttons, replaced with lifecycle flow
- Updated export utility and Session type to include all lifecycle statuses

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite SessionDetail with lifecycle controls in header area, banners, and read-only logic** - `93368c5` (feat)
2. **Task 2: Update export utility to support status update pattern** - `8ee3f5b` (feat)

## Files Created/Modified
- `src/pages/SessionDetail.tsx` - Complete lifecycle UI: submit, read-only lock, admin edit, return, banners, export gating
- `src/utils/export.ts` - Updated status type cast from "active" | "completed" to full lifecycle set
- `src/db/types.ts` - Updated Session interface status field to include submitted/returned/exported

## Decisions Made
- All lifecycle buttons (Submit, Export, Return) placed in header area per CONTEXT.md locked decisions; Delete stays at bottom as only button in bottom action section
- Replaced direct db/sessions updateSession/deleteSession imports with sessionStore methods (storeUpdateSession, store deleteSession) for consistent optimistic updates with revert-on-error
- Export no longer shows confirmation dialog for active sessions -- admin-only now, admin makes the call directly
- Updated Session type in types.ts to include all lifecycle statuses (blocking type mismatch with ExportSchema)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated Session type in types.ts for lifecycle statuses**
- **Found during:** Task 2
- **Issue:** Session interface in types.ts had `status: "active" | "completed"` which is used by ExportSchema -- updating export.ts cast without updating the type would cause type mismatch
- **Fix:** Changed Session.status to `"active" | "submitted" | "returned" | "exported"`
- **Files modified:** src/db/types.ts
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** 8ee3f5b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type update necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SessionDetail lifecycle fully functional for Plan 03 (testing) and Plan 04 (polish)
- Submit, Export, Return flows all wired through sessionStore with optimistic updates
- ReturnDialog integrated with review_notes persistence

---
*Phase: 16-session-lifecycle*
*Completed: 2026-03-20*
