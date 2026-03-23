---
phase: 19-photo-upload-to-supabase-storage-with-full-offline-support
plan: 01
subsystem: database
tags: [supabase, storage, dexie, offline-queue, rls, photos]

requires:
  - phase: 19-00
    provides: test stubs for photo upload queue
  - phase: 11-01
    provides: Supabase schema patterns, RLS session-ownership pattern
  - phase: 14-01
    provides: Dexie idMapping, write-ahead queue pattern

provides:
  - Supabase photos table with UUID PK, item_id FK, RLS policies
  - Private Storage bucket "photos" with authenticated upload/read policies
  - Dexie v8 schema with photoUploadQueue table
  - PhotoUploadEntry type in db/types.ts
  - photoUploadQueue service with enqueue, drain, processOneUpload, retryFailedUploads

affects: [19-02, 19-03, 19-04]

tech-stack:
  added: []
  patterns: [bounded-concurrency-photo-upload, exponential-backoff-retry, dexie-queue-drain-mutex]

key-files:
  created:
    - supabase/migrations/20260320100000_create_photos.sql
    - src/services/photoUploadQueue.ts
  modified:
    - src/db/index.ts
    - src/db/types.ts
    - src/tests/photo-upload-queue.test.ts

key-decisions:
  - "Concurrency of 2 for photo uploads (lower than audio queue's 4 due to larger payload size)"
  - "Exponential backoff: 4^retryCount * 1000ms (1s, 4s, 16s) with max 3 retries"
  - "Storage path convention: photos/{sessionId}/{itemId}/full-{sortOrder}.jpg"
  - "enqueue alias exported for backward compat with test stubs"

patterns-established:
  - "Photo upload queue pattern: Dexie queue table + bounded drain + exponential backoff"
  - "Storage bucket RLS: authenticated users can upload/read, table RLS via session ownership join"

requirements-completed: [PHOTO-UPLOAD-01, PHOTO-UPLOAD-02]

duration: 3min
completed: 2026-03-23
---

# Phase 19 Plan 01: Photo Upload Infrastructure Summary

**Supabase photos table with RLS, private Storage bucket, Dexie v8 queue, and photo upload queue service with bounded concurrency and exponential backoff retry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T14:10:04Z
- **Completed:** 2026-03-23T14:13:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Supabase migration creates photos table with UUID PK, item_id FK (cascade delete), storage_path, thumbnail_path, sort_order, upload_status CHECK constraint
- Private Storage bucket "photos" with RLS: authenticated INSERT and SELECT, table-level session-ownership policies matching items pattern
- Dexie v8 adds photoUploadQueue table with status, dexiePhotoId, itemId, createdAt indexes
- Photo upload queue service: enqueue with correct paths, drain with concurrency=2 + mutex, processOneUpload (full blob + thumbnail + metadata), retry with exponential backoff (4^n * 1s), retryFailedUploads resets and re-drains
- All 15 photo-upload-queue tests and 11 db tests pass (26 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration + Dexie v8 schema + types** - `362a191` (feat) -- committed in plan 19-00 prep
2. **Task 2: Photo upload queue service** - `bcee492` (feat, TDD)

**Plan metadata:** (pending)

## Files Created/Modified
- `supabase/migrations/20260320100000_create_photos.sql` - Photos table, private bucket, RLS policies, storage policies
- `src/db/index.ts` - Dexie v8 with photoUploadQueue table
- `src/db/types.ts` - PhotoUploadEntry interface
- `src/services/photoUploadQueue.ts` - Queue service: enqueue, drain, processOneUpload, retryFailedUploads
- `src/tests/photo-upload-queue.test.ts` - 15 tests covering all queue behaviors

## Decisions Made
- Concurrency of 2 for photo uploads (lower than audio queue's 4 due to larger payload size)
- Exponential backoff uses 4^retryCount * 1000ms (1s, 4s, 16s) with max 3 retries before marking failed
- Storage path convention: `photos/{sessionId}/{itemId}/full-{sortOrder}.jpg` and `thumb-{sortOrder}.jpg`
- Added `_resetDraining()` test helper to reset mutex state between tests
- Added `enqueue` alias export for backward compatibility with test stubs from plan 19-00

## Deviations from Plan

None - plan executed exactly as written. Task 1 artifacts were pre-created during plan 19-00 test stub phase.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Photos table and Storage bucket ready for upload integration
- Queue service ready for use by photo capture components
- Plans 19-02 (UI integration), 19-03 (online/offline sync), 19-04 (signed URL display) can proceed

---
*Phase: 19-photo-upload-to-supabase-storage-with-full-offline-support*
*Completed: 2026-03-23*
