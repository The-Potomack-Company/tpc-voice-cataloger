---
phase: 08-offline-queue
plan: 02
subsystem: ui
tags: [offline, queue, connectivity, recording, export, indicator, dexie, react]

requires:
  - phase: 08-offline-queue
    provides: drainQueue service, useOnlineStatus hook, AiStatus "queued" type, uiStore isOnline
  - phase: 05-ai-pipeline
    provides: processAudioWithAi function for AI processing pipeline
provides:
  - Offline intercept in RecordButton and ItemCard (sets aiStatus="queued" when offline)
  - Queued item styling with greyed-out appearance and "Queued" badge
  - Queued item locking (expanded section shows waiting message, not editable fields)
  - OfflineIndicator component with wifi-off icon
  - Queue drain wiring on app mount and online event in AppLayout
  - Export button disabled with queued count message
affects: [09-deferred-items]

tech-stack:
  added: []
  patterns: [navigator-onLine-check-before-ai, queued-item-locking, reactive-queued-count]

key-files:
  created:
    - src/components/OfflineIndicator.tsx
  modified:
    - src/components/RecordButton.tsx
    - src/components/ItemCard.tsx
    - src/layouts/AppLayout.tsx
    - src/pages/SessionDetail.tsx

key-decisions:
  - "Queued items fully locked -- expanded section replaced with waiting message rather than showing empty editable fields"
  - "Mic re-record button hidden for queued items to prevent confusion"
  - "Export icon hidden (not just disabled) when queued items exist, showing text-only message"

patterns-established:
  - "navigator.onLine gate pattern: check connectivity before fire-and-forget AI calls"
  - "Conditional expanded section: different content based on item status"

requirements-completed: [OFFL-01, OFFL-02, OFFL-03, OFFL-04]

duration: 4min
completed: 2026-03-16
---

# Phase 8 Plan 02: Offline Queue UI Wiring Summary

**Offline intercept in RecordButton/ItemCard with queued item styling, wifi-off indicator, export disable, and queue drain wiring in AppLayout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T15:43:57Z
- **Completed:** 2026-03-16T15:44:27Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- RecordButton and ItemCard check navigator.onLine before AI processing, setting aiStatus="queued" when offline
- ItemCard shows greyed-out styling with "Queued" badge and locked expanded section for queued items
- OfflineIndicator component renders wifi-off icon when offline, hidden when online
- AppLayout mounts useOnlineStatus hook and queue drain effect (on mount + online event)
- Export button disabled with "X items still queued" message using reactive useLiveQuery count
- End-to-end verification passed all 12 steps (offline record, queued badge, wifi icon, export disable, auto-drain on reconnect)

## Task Commits

Each task was committed atomically:

1. **Task 1: Offline intercept in RecordButton and ItemCard, OfflineIndicator, queue drain wiring** - `e1fe01a` (feat)
2. **Task 2: Export button disabled when queued items exist** - `92ab24d` (feat)
3. **Task 3: Verify offline queue end-to-end** - human verification passed (no code commit)

## Files Created/Modified
- `src/components/OfflineIndicator.tsx` - Wifi-off icon shown when offline via useOnlineStatus hook
- `src/components/RecordButton.tsx` - Added navigator.onLine check before processAudioWithAi, sets queued when offline
- `src/components/ItemCard.tsx` - Same offline check + queued item styling (opacity, badge, locked expand, hidden mic)
- `src/layouts/AppLayout.tsx` - Mounts OfflineIndicator, useOnlineStatus, and drainQueue effect
- `src/pages/SessionDetail.tsx` - Export button disabled with queued count via useLiveQuery

## Decisions Made
- Queued items fully locked: expanded section shows "Waiting for connectivity to process..." instead of empty editable fields
- Mic re-record button hidden for queued items (no point re-recording while waiting for connectivity)
- Export icon hidden when queued items exist, replaced with text-only "X items still queued" message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 8 complete: full offline queue system operational
- Recording works identically online/offline
- Queue drains automatically on reconnect
- Ready for Phase 9 deferred items

## Self-Check: PASSED

All 5 files verified present. Both task commits (e1fe01a, 92ab24d) verified in git log. 151 tests passing, TypeScript compiles clean.

---
*Phase: 08-offline-queue*
*Completed: 2026-03-16*
