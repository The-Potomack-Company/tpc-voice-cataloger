---
phase: 05-ai-pipeline
plan: 05
subsystem: ui
tags: [react, dexie, ai-status, retry, itemcard]

requires:
  - phase: 05-ai-pipeline
    provides: "processAudioWithAi function and aiStatus field on items"
provides:
  - "Visual AI status indicators (Failed, Processing badges) on ItemCard"
  - "Retry AI button for failed items in expanded section"
affects: [05-ai-pipeline, 09-deferred-items]

tech-stack:
  added: []
  patterns: ["Combined useLiveQuery returning multiple derived values from single query"]

key-files:
  created: []
  modified: [src/components/ItemCard.tsx]

key-decisions:
  - "Combined audioCount and latestAudioId into single useLiveQuery to avoid extra DB query"
  - "Hide mic button during processing state to prevent conflicting recordings"

patterns-established:
  - "Combined useLiveQuery: derive multiple values (count + latestId) from single Dexie query"

requirements-completed: [AI-01, AI-03]

duration: 1min
completed: 2026-03-16
---

# Phase 5 Plan 05: AI Status Indicators and Retry Summary

**Red/blue status badges on ItemCard collapsed row with retry button for failed AI processing**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T14:51:50Z
- **Completed:** 2026-03-16T14:53:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added red "Failed" badge on collapsed card row for items with aiStatus=failed
- Added blue "Processing..." badge with pulse animation for items with aiStatus=processing
- Added "Retry AI" button in expanded section that re-triggers processAudioWithAi
- Combined audio query to return both count and latestAudioId from single DB read

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AI status indicators and retry button to ItemCard** - `4bc5716` (feat)

## Files Created/Modified
- `src/components/ItemCard.tsx` - Added isFailed/isProcessing states, Failed/Processing badges, Retry AI button, combined audio query

## Decisions Made
- Combined audioCount and latestAudioId into a single useLiveQuery to avoid an extra database query for retry functionality
- Hidden mic button during processing state to prevent conflicting recordings while AI is running

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI status indicators complete - users can see failed/processing states and retry
- Phase 9 deferred items can proceed

---
*Phase: 05-ai-pipeline*
*Completed: 2026-03-16*

## Self-Check: PASSED
