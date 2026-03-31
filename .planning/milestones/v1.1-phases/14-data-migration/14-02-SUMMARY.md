---
phase: 14-data-migration
plan: 02
subsystem: database
tags: [supabase, zustand, dexie, data-access-layer, gemini, export, offline-queue]

# Dependency graph
requires:
  - phase: 14-data-migration
    provides: Zustand sessionStore with Supabase CRUD, idMapping utilities, Dexie v7 schema
  - phase: 11-supabase-setup
    provides: Supabase schema with sessions/items/export_history tables and generated types
  - phase: 12-auth
    provides: Auth store with user.id for created_by field
provides:
  - Supabase-backed session CRUD (sessions.ts delegates to sessionStore)
  - Supabase-backed item CRUD (items.ts delegates to sessionStore)
  - Zustand selector hooks replacing useLiveQuery (useSessions.ts)
  - AI pipeline writing results to Supabase items table (gemini.ts)
  - Hybrid export reading metadata from Supabase and blobs from Dexie (export.ts)
  - Offline queue querying Supabase for queued items with UUID-based IDs (offlineQueue.ts)
affects: [14-data-migration, 15-session-assignment, 16-session-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-crud-delegation, zustand-selector-hooks, hybrid-blob-metadata-split, uuid-to-dexie-id-bridge]

key-files:
  created:
    - src/tests/supabase-sessions.test.ts
    - src/tests/supabase-items.test.ts
  modified:
    - src/db/sessions.ts
    - src/db/items.ts
    - src/hooks/useSessions.ts
    - src/services/gemini.ts
    - src/services/offlineQueue.ts
    - src/utils/export.ts
    - src/tests/gemini-pipeline.test.ts
    - src/tests/export.test.ts
    - src/tests/offline-queue.test.ts

key-decisions:
  - "getSessionById is synchronous (reads from in-memory Zustand store, not async Dexie query)"
  - "useDeletedSessions and useArchivedSessions return empty arrays (no soft-delete/archive in Supabase schema)"
  - "processAudioWithAi signature changed to (audioId, itemId: string, sessionId: string) for Supabase UUID compatibility"
  - "Export reads session/items from Supabase, photos/audio from Dexie via getDexieItemId bridge"

patterns-established:
  - "Data access delegation: db/sessions.ts and db/items.ts delegate to sessionStore.getState() actions"
  - "Zustand selectors replace useLiveQuery: useSessionStore(s => s.sessions.filter(...))"
  - "Hybrid blob access: metadata from Supabase, blobs from Dexie via getDexieItemId UUID-to-integer bridge"
  - "Supabase direct update in services: supabase.from('items').update({...}).eq('id', itemId) pattern"

requirements-completed: [INFRA-03]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 14 Plan 02: Data Access Layer Rewrite Summary

**Sessions/items CRUD delegates to Zustand sessionStore, AI pipeline writes to Supabase, export reads metadata from Supabase with blob access via Dexie ID mapping bridge**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T20:16:59Z
- **Completed:** 2026-03-18T20:24:20Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Data access layer fully rewritten: sessions.ts, items.ts, useSessions.ts use Supabase/Zustand instead of Dexie
- AI pipeline (gemini.ts) writes processing status and results to Supabase items table while still reading audio blobs from Dexie
- Export module reads session/item metadata from Supabase and photos/audio from Dexie via getDexieItemId bridge
- Offline queue queries Supabase for queued items with UUID-based IDs and uses getDexieItemId for audio lookup
- 34 tests passing across 5 test files with no regressions

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests for sessions.ts and items.ts** - `0b56d77` (test)
2. **Task 1 GREEN: Rewrite data access layer** - `e967c28` (feat)
3. **Task 2 RED: Failing tests for gemini, export, offline queue** - `a22d6d3` (test)
4. **Task 2 GREEN: Rewrite gemini, export, offline queue** - `3887600` (feat)

## Files Created/Modified
- `src/db/sessions.ts` - Supabase-backed session CRUD delegating to sessionStore (no Dexie imports)
- `src/db/items.ts` - Supabase-backed item CRUD delegating to sessionStore (no Dexie imports)
- `src/hooks/useSessions.ts` - Zustand selector hooks replacing useLiveQuery (useActiveSessions, useCompletedSessions, useSession, useSessionItemCount)
- `src/services/gemini.ts` - AI pipeline writing results to Supabase items table; audio blobs still from Dexie
- `src/services/offlineQueue.ts` - Queued items from Supabase; audio lookup via getDexieItemId bridge
- `src/utils/export.ts` - Hybrid export: session/items from Supabase, photos/audio from Dexie via ID mapping
- `src/tests/supabase-sessions.test.ts` - 6 tests for Supabase-backed sessions.ts (NEW)
- `src/tests/supabase-items.test.ts` - 5 tests for Supabase-backed items.ts (NEW)
- `src/tests/gemini-pipeline.test.ts` - 8 tests rewritten for Supabase-based AI pipeline
- `src/tests/export.test.ts` - 11 tests rewritten for Supabase-based export
- `src/tests/offline-queue.test.ts` - 4 tests rewritten for Supabase-based offline queue

## Decisions Made
- getSessionById changed from async (Dexie query) to synchronous (Zustand in-memory find) -- consumers must update accordingly
- Removed softDeleteSession, restoreSession, archiveSession, unarchiveSession -- no Postgres equivalents; useDeletedSessions and useArchivedSessions return empty arrays as stubs
- processAudioWithAi signature changed from (audioId, itemId: number, itemType: string) to (audioId, itemId: string, sessionId: string) for UUID compatibility
- Export version counting moved from Dexie exportHistory to Supabase export_history table
- Offline queue item status updates (queued/failed) now go through Supabase instead of Dexie table updates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All data access functions now use Supabase as the source of truth for metadata
- Components consuming sessions.ts, items.ts, useSessions.ts will see the same API shape (string IDs instead of number)
- Plan 14-03 (migration + write-ahead queue) can build on this foundation
- Plan 14-04 (component updates) will update consumers that use changed function signatures

## Self-Check: PASSED

All 11 created/modified files verified present. All 4 task commits verified in git history.

---
*Phase: 14-data-migration*
*Completed: 2026-03-18*
