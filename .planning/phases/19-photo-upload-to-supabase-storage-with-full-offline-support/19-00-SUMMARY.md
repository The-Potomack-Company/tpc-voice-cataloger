---
phase: 19-photo-upload-to-supabase-storage-with-full-offline-support
plan: 00
subsystem: photo-upload
tags: [tests, stubs, wave-0, offline-queue, migration, photo-url]
dependency_graph:
  requires: []
  provides:
    - test-stubs-photo-upload-queue
    - test-stubs-photo-migration
    - test-stubs-photo-url-fallback
    - test-stubs-app-layout-drain
  affects:
    - src/tests/photo-upload-queue.test.ts
    - src/tests/photo-migration.test.ts
    - src/tests/photo-url-fallback.test.ts
    - src/tests/app-layout-drain.test.ts
tech_stack:
  added: []
  patterns:
    - vi.hoisted + vi.mock for Supabase storage mocking
    - vi.hoisted + vi.mock for Dexie table mocking
    - Dynamic import pattern for future module stubs
key_files:
  created:
    - src/tests/photo-upload-queue.test.ts
    - src/tests/photo-migration.test.ts
    - src/tests/photo-url-fallback.test.ts
    - src/tests/app-layout-drain.test.ts
  modified: []
decisions:
  - Dynamic import in test stubs (await import) so tests fail with module-not-found until implementation plans create the modules
  - Mock pattern matches existing project convention (vi.hoisted + vi.mock with factory)
metrics:
  duration: 2 min
  completed: "2026-03-23"
---

# Phase 19 Plan 00: Test Stubs for Photo Upload Summary

Wave 0 test scaffolds for Phase 19 photo upload -- 30 test stubs across 4 files covering upload queue, migration, URL fallback, and drain order.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create photo-upload-queue test stubs | d32eebc | src/tests/photo-upload-queue.test.ts |
| 2 | Create photo-migration, photo-url-fallback, and app-layout-drain test stubs | 80c85c2 | src/tests/photo-migration.test.ts, src/tests/photo-url-fallback.test.ts, src/tests/app-layout-drain.test.ts |

## What Was Built

### Task 1: photo-upload-queue test stubs (15 test cases)
- `describe("enqueue")` -- 2 stubs for pending status and path storage
- `describe("drainPhotoQueue")` -- 4 stubs for processing, concurrency, mutex, offline guard
- `describe("processOneUpload")` -- 4 stubs for full-size upload, thumbnail upload, metadata insert, queue entry update
- `describe("retry with exponential backoff")` -- 4 stubs for 1s/4s delays, 3-attempt failure, status reset
- `describe("retryFailedUploads")` -- 1 stub for manual retry reset
- Mocks: supabase.storage.from().upload(), supabase.from().insert(), db.photoUploadQueue, db.photos

### Task 2: Three additional test stub files (15 test cases)
- **photo-migration.test.ts** (8 stubs): detectUnuploadedPhotos (3), migrateExistingPhotos (5)
  - Mocks: db.photos, db.photoUploadQueue, getDexieItemId, drainPhotoQueue
- **photo-url-fallback.test.ts** (4 stubs): usePhotoUrl blob URL, signed URL, undefined fallback, preference order
  - Mocks: supabase.storage.from().createSignedUrl()
- **app-layout-drain.test.ts** (3 stubs): processWriteAheadQueue before drainPhotoQueue, drainPhotoQueue before drainQueue, full sequence verification
  - Mocks: processWriteAheadQueue, drainPhotoQueue, drainQueue with call-order tracking

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Dynamic import pattern**: Each test stub uses `await import("../services/photoUploadQueue")` (or equivalent) so tests fail with module-not-found until the implementation plan creates the service. This follows Wave 0 convention.
2. **Mock convention**: All mocks use `vi.hoisted()` + `vi.mock()` factory pattern matching the existing `offline-queue.test.ts` convention.

## Verification

All 4 test files exist with 30 total test stubs (exceeds 27+ requirement). Test stubs reference correct future module paths: `../services/photoUploadQueue`, `../services/photoMigration`, `../hooks/usePhotoUrl`. Drain order stubs verify processWriteAheadQueue -> drainPhotoQueue -> drainQueue sequence.

## Self-Check: PASSED

- [x] src/tests/photo-upload-queue.test.ts exists
- [x] src/tests/photo-migration.test.ts exists
- [x] src/tests/photo-url-fallback.test.ts exists
- [x] src/tests/app-layout-drain.test.ts exists
- [x] Commit d32eebc exists (Task 1)
- [x] Commit 80c85c2 exists (Task 2)
