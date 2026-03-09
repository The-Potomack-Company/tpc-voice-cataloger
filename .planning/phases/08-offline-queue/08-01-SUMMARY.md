---
phase: 08-offline-queue
plan: 01
subsystem: services
tags: [offline, queue, concurrency, connectivity, zustand, dexie, browser-events]

requires:
  - phase: 05-ai-pipeline
    provides: processAudioWithAi function for AI processing pipeline
  - phase: 01-foundation
    provides: Dexie database with indexed aiStatus field, Zustand UI store
provides:
  - AiStatus type extended with "queued" value
  - Non-persisted isOnline/setOnline fields in uiStore
  - useOnlineStatus hook for reactive connectivity tracking
  - drainQueue service with FIFO processing, concurrency=4, retry=2, offline-aware
  - getQueuedItems query across both item tables
affects: [08-02-offline-queue, ui-components, record-button]

tech-stack:
  added: []
  patterns: [queue-drain-with-mutex, navigator-onLine-events, partialize-persist]

key-files:
  created:
    - src/hooks/useOnlineStatus.ts
    - src/services/offlineQueue.ts
    - src/tests/offline-queue.test.ts
  modified:
    - src/db/types.ts
    - src/stores/uiStore.ts

key-decisions:
  - "isOnline excluded from persist via partialize to reflect live state only"
  - "Queue drain uses external retry pattern -- resets aiStatus to queued between retries rather than modifying processAudioWithAi"
  - "findAudioForItem selects highest-id audio record (most recent) for processing"

patterns-established:
  - "Partialize pattern: exclude transient state from Zustand persist middleware"
  - "Module-level mutex flag for preventing concurrent async operations"
  - "Batch processing with Promise.allSettled for fault-tolerant concurrency"

requirements-completed: [OFFL-01, OFFL-02, OFFL-04]

duration: 3min
completed: 2026-03-09
---

# Phase 8 Plan 01: Offline Queue Data Layer Summary

**Queue drain service with FIFO processing, concurrency limit of 4, 2 retries, and useOnlineStatus hook syncing browser connectivity events to Zustand store**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T15:38:33Z
- **Completed:** 2026-03-09T15:41:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended AiStatus type with "queued" value for offline queue support
- Added non-persisted isOnline/setOnline to uiStore with partialize exclusion
- Created useOnlineStatus hook syncing browser online/offline events to Zustand store
- Built drainQueue service: FIFO across both item tables, concurrency=4, retry=2, offline-aware pause, mutex-protected
- 12 passing tests covering all queue behaviors via TDD

## Task Commits

Each task was committed atomically:

1. **Task 1: Data layer -- AiStatus type, uiStore isOnline, useOnlineStatus hook** - `25ff15b` (feat)
2. **Task 2: Queue drain service with concurrency control and retry** - `146dab0` (feat)

## Files Created/Modified
- `src/db/types.ts` - Added "queued" to AiStatus union type
- `src/stores/uiStore.ts` - Added isOnline/setOnline with partialize to exclude from persistence
- `src/hooks/useOnlineStatus.ts` - Reactive hook syncing navigator.onLine + window events to store
- `src/services/offlineQueue.ts` - Queue drain with getQueuedItems, processWithRetry, drainQueue
- `src/tests/offline-queue.test.ts` - 12 tests covering type, hook, and all queue behaviors

## Decisions Made
- Used partialize on persist middleware to exclude isOnline/setOnline from localStorage (transient state should reflect live connectivity)
- Queue drain retries externally by resetting aiStatus to "queued" before re-calling processAudioWithAi, avoiding modification of the existing battle-tested function
- findAudioForItem selects the highest-id audio record (most recent), matching RecordButton behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer and services complete, ready for Plan 02 to wire into UI
- useOnlineStatus hook ready for OfflineIndicator component
- drainQueue ready to be called on online event in AppLayout
- RecordButton needs offline check intercept (Plan 02 scope)

## Self-Check: PASSED

All 6 files verified present. Both task commits (25ff15b, 146dab0) verified in git log. 151 tests passing, TypeScript compiles clean.

---
*Phase: 08-offline-queue*
*Completed: 2026-03-09*
