---
phase: 14-data-migration
plan: 04
subsystem: ui
tags: [zustand, supabase, react, dexie, migration, offline]

requires:
  - phase: 14-01
    provides: sessionStore with Supabase CRUD and persist scoping
  - phase: 14-02
    provides: useSessions hooks, rewritten db/sessions.ts and db/items.ts
  - phase: 14-03
    provides: useDataMigration hook, MigrationSplash, write-ahead queue
provides:
  - All pages and components wired to Zustand/Supabase data source
  - ProtectedRoute orchestrates scoping, migration, and initial fetch
  - Offline banner and pending sync badge UI
  - ID mapping bridge for Dexie blob lookups on migrated items
affects: [15-session-assignment, 16-polish, 18-tutorial]

tech-stack:
  added: []
  patterns:
    - "ProtectedRoute orchestrates post-login sequence: scope stores -> migrate -> fetch"
    - "getDexieItemId bridge for photo/audio blob lookups on migrated items"
    - "useSessionStore selectors replace all useLiveQuery for metadata"
    - "snake_case field access for all Supabase row types"

key-files:
  created: []
  modified:
    - src/components/ProtectedRoute.tsx
    - src/pages/Sessions.tsx
    - src/pages/SessionDetail.tsx
    - src/pages/NewSession.tsx
    - src/pages/ItemEntry.tsx
    - src/pages/Settings.tsx
    - src/components/ItemList.tsx
    - src/components/ItemCard.tsx
    - src/components/RecordButton.tsx
    - src/components/ExportHistoryList.tsx
    - src/components/PhotoCapture.tsx
    - src/components/RecordingsList.tsx
    - src/components/SessionCard.tsx
    - src/hooks/useAudioRecorder.ts
    - src/tests/protected-route.test.tsx

key-decisions:
  - "ItemEntry.tsx retains useLiveQuery for photos (blobs stay in Dexie) -- acceptance criteria adjusted"
  - "SessionCard updated to accept Tables<'sessions'> type (blocking dependency for Sessions.tsx)"
  - "Removed archive/unarchive/soft-delete UI entirely -- Supabase schema has no soft-delete"
  - "useAudioRecorder stores string UUID as itemId in Dexie audio table -- Dexie accepts both types"
  - "Settings version bumped from v1.0 to v1.1"

patterns-established:
  - "getDexieItemId fallback pattern: getDexieItemId(uuid).then(id => setDexieItemId(id ?? uuid))"
  - "hasPendingForItem for pending sync badge on ItemCard"
  - "Offline banner in Sessions.tsx using useUIStore(s => s.isOnline)"

requirements-completed: [INFRA-03]

duration: 12min
completed: 2026-03-18
---

# Phase 14 Plan 04: Page & Component Wiring Summary

**All pages and components wired to Supabase-backed Zustand store with ProtectedRoute orchestrating scoping, migration, and fetch -- completing the Dexie-to-Supabase data migration**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-18T20:27:43Z
- **Completed:** 2026-03-18T20:39:25Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 15

## Accomplishments
- ProtectedRoute orchestrates full post-login sequence: scope UI/session stores to user, check/run migration, show splash if needed, fetch sessions after migration
- All pages (Sessions, SessionDetail, NewSession, ItemEntry, Settings) read from Zustand store instead of Dexie useLiveQuery
- All mutations go through sessionStore actions with optimistic updates
- Route params work with UUID strings (no more Number() conversion)
- Blob-dependent components (PhotoCapture, RecordingsList, ItemCard) use getDexieItemId bridge for migrated items
- Offline banner on Sessions page, pending sync badge on ItemCard
- Removed soft-delete/archive UI from Settings and SessionDetail (no longer in Supabase schema)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire ProtectedRoute with scoping, migration, and initial fetch** - `5e68074` (feat)
2. **Task 2: Update all pages and components from Dexie to Zustand/Supabase** - `f38e9f0` (feat)
3. **Task 3: Verify end-to-end data migration flow** - checkpoint:human-verify (pending)

## Files Created/Modified
- `src/components/ProtectedRoute.tsx` - Orchestrates scoping, migration, and fetch on login
- `src/tests/protected-route.test.tsx` - Updated tests with mocks for all new dependencies
- `src/pages/Sessions.tsx` - Supabase types, offline banner, removed soft-delete
- `src/pages/SessionDetail.tsx` - Zustand selectors, snake_case fields, removed archive UI
- `src/pages/NewSession.tsx` - Updated updateItemField to pass sessionId + snake_case
- `src/pages/ItemEntry.tsx` - Zustand for session/items, ID mapping for photos
- `src/pages/Settings.tsx` - Removed deleted sessions section
- `src/components/ItemList.tsx` - Zustand selector replaces useLiveQuery
- `src/components/ItemCard.tsx` - Supabase item type, ID mapping, pending sync badge
- `src/components/RecordButton.tsx` - String IDs, removed Dexie table access
- `src/components/ExportHistoryList.tsx` - Supabase query replaces useLiveQuery
- `src/components/PhotoCapture.tsx` - String itemId, ID mapping for blobs
- `src/components/RecordingsList.tsx` - String itemId, ID mapping for blobs
- `src/components/SessionCard.tsx` - Supabase session type, snake_case fields
- `src/hooks/useAudioRecorder.ts` - String itemId/sessionId params

## Decisions Made
- ItemEntry.tsx retains useLiveQuery for photos since blobs must stay in Dexie -- this is a minor discrepancy with the acceptance criteria which says "0 matches in src/pages/*.tsx" but the plan itself describes keeping useLiveQuery for photos
- SessionCard was updated to accept the Supabase Tables<'sessions'> type even though it was not in the plan's files_modified list -- required as a blocking dependency for Sessions.tsx to compile
- Settings page version bumped from v1.0 to v1.1 to reflect the new architecture
- useAudioRecorder passes string UUID as itemId to Dexie audio.add -- Dexie stores value as-is and the index works correctly with both number and string lookups

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated SessionCard to accept Supabase session type**
- **Found during:** Task 2 (Sessions.tsx update)
- **Issue:** SessionCard used old `Session` type from db/types with `archivedAt`, `deletedAt` as Date and `id?: number` -- incompatible with `Tables<'sessions'>` which has string id, ISO string dates, no archivedAt/deletedAt
- **Fix:** Rewrote SessionCard interface to use `Tables<'sessions'>`, updated formatRelativeTime to accept string dates, removed archivedAt badge
- **Files modified:** src/components/SessionCard.tsx
- **Verification:** No TypeScript errors, Sessions page renders with new session type
- **Committed in:** f38e9f0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for SessionCard to accept the new Supabase session type. No scope creep.

## Issues Encountered
- Pre-existing test failures in sessions.test.ts, item-crud.test.ts, re-record.test.ts, export-history.test.ts, and layout.test.tsx -- these tests reference the old Dexie-based API functions (softDeleteSession, archiveSession, etc.) that were removed in Plan 02. Not caused by this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 data migration is complete pending human verification of end-to-end flow
- All pages are Supabase-authoritative
- Ready for Phase 15 (Session Assignment) once verification passes

---
*Phase: 14-data-migration*
*Completed: 2026-03-18*
