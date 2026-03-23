---
phase: 19-photo-upload-to-supabase-storage-with-full-offline-support
verified: 2026-03-23T12:25:00Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Take a photo and tap Keep — verify spinner appears on thumbnail then transitions to green check after upload"
    expected: "Thumbnail shows spinning upload indicator immediately, then green checkmark once Supabase Storage receives the file"
    why_human: "Async UI state transitions and Supabase Storage write cannot be verified programmatically"
  - test: "Go offline, take a photo, tap Keep, then reconnect — verify upload completes"
    expected: "Thumbnail shows spinner while offline (pending), upload completes with green check after reconnect"
    why_human: "Requires device network toggle and observable real-time state transition"
  - test: "Tap a thumbnail in failed (red) state — verify upload retries"
    expected: "Tapping the red retry icon triggers retryFailedUploads, icon transitions back to spinner then green check"
    why_human: "Requires inducing a failure state and observing retry behavior in the UI"
  - test: "Open the app on a second device (or incognito) as admin — verify photos display via signed URLs"
    expected: "Photos that were uploaded to Storage render correctly without local Dexie blobs"
    why_human: "Cross-device signed URL fallback requires two browser sessions; cannot be verified by grep"
  - test: "Export a session with uploaded photos from a device with no local blobs — verify base64 data present"
    expected: "JSON export contains base64 photo data downloaded from Supabase Storage"
    why_human: "Storage download fallback requires an admin session without local blobs"
  - test: "Verify migration banner appears and auto-dismisses for existing pre-Phase-19 Dexie photos"
    expected: "Banner shows 'Uploading N photos...' count, decrements to zero, then disappears"
    why_human: "Requires pre-existing Dexie photo data and observing real-time useLiveQuery reactive updates"
---

# Phase 19: Photo Upload to Supabase Storage Verification Report

**Phase Goal:** Photo upload to Supabase Storage with full offline support — capture photos, queue uploads, sync when online, signed URL fallback display, export with Storage download, and migration of existing photos.
**Verified:** 2026-03-23T12:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Supabase has a photos table with RLS policies matching session ownership | VERIFIED | `supabase/migrations/20260320200000_create_photos.sql` — `create table public.photos`, `private.is_admin()`, session-ownership join policies |
| 2 | Supabase has a private photos Storage bucket | VERIFIED | Migration contains `insert into storage.buckets (id, name, public) values ('photos', 'photos', false)` with `bucket_id = 'photos'` RLS policies |
| 3 | Dexie v8 schema includes photoUploadQueue table | VERIFIED | `src/db/index.ts` line 104: `db.version(8).stores(...)` with `photoUploadQueue: '++id, status, dexiePhotoId, itemId, createdAt'` |
| 4 | Photo upload queue service can enqueue, drain with bounded concurrency=2, retry with exponential backoff | VERIFIED | `src/services/photoUploadQueue.ts` exports `enqueuePhotoUpload`, `drainPhotoQueue`, `retryFailedUploads`; CONCURRENCY=2, MAX_RETRIES=3, `Math.pow(4, ...)` backoff; all 15 queue tests pass |
| 5 | Photo upload is triggered automatically when user taps Keep (fire-and-forget) | VERIFIED | `src/components/PhotoCapture.tsx` line 131: `enqueuePhotoUpload({...}).then(() => drainPhotoQueue()).catch(() => {})` — non-blocking after `db.photos.add` |
| 6 | Thumbnail strip shows sync status overlay on each photo | VERIFIED | `PhotoCapture.tsx` Thumbnail uses `usePhotoUploadStatus(photo.id)`; renders `animate-spin` (pending/uploading), `bg-green-500` checkmark (uploaded), `bg-red-500` retry icon (failed) |
| 7 | Reconnection drain order is write-ahead -> fetchSessions -> photos -> audio | VERIFIED | `AppLayout.tsx` lines 29-33: `await processWriteAheadQueue()` then `await fetchSessions()` then `await drainPhotoQueue()` then `drainQueue()` — confirmed by 3/3 drain-order tests |
| 8 | Photos display from local Dexie blob when available, falling back to Supabase signed URL | VERIFIED | `src/hooks/usePhotoUrl.ts` — prefers local blob URL, calls `createSignedUrl(storagePath, 3600)` when no local blob; all 4 hook tests pass |
| 9 | Export reads local Dexie blobs first, downloads from Storage when missing | VERIFIED | `src/utils/export.ts` lines 87-89: `supabase.storage.from('photos').download(sp.storage_path)` as fallback when local blobs absent; export tests pass |
| 10 | Existing Dexie photos are detected and queued for upload on app load | VERIFIED | `src/services/photoMigration.ts` — `detectUnuploadedPhotos` + `migrateExistingPhotos` with localStorage flag `photo_migration_v1_complete`; all 8 migration tests pass |
| 11 | Migration runs in background with progress indicator and does not re-queue already-queued photos | VERIFIED | `PhotoMigrationBanner.tsx` uses `useLiveQuery` on `photoUploadQueue.status`; `migrateExistingPhotos` builds `handledIds` set before queuing; flag check prevents re-run |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260320200000_create_photos.sql` | photos table, private bucket, RLS policies | VERIFIED | Contains all required SQL; note: renamed from `20260320100000` to avoid timestamp conflict |
| `src/db/index.ts` | Dexie v8 with photoUploadQueue table | VERIFIED | `db.version(8).stores(...)` with `photoUploadQueue` + `EntityTable<PhotoUploadEntry, "id">` |
| `src/db/types.ts` | PhotoUploadEntry interface | VERIFIED | `export interface PhotoUploadEntry` with `dexiePhotoId`, `storagePath`, `status: 'pending' \| 'uploading' \| 'uploaded' \| 'failed'` |
| `src/services/photoUploadQueue.ts` | drainPhotoQueue, enqueuePhotoUpload, retryFailedUploads | VERIFIED | All 3 functions exported; CONCURRENCY=2, MAX_RETRIES=3, exponential backoff, mutex guard |
| `src/components/PhotoCapture.tsx` | Upload trigger in handleKeep, sync overlay on thumbnails | VERIFIED | `enqueuePhotoUpload` called after `db.photos.add`; spinner/check/retry overlays on Thumbnail |
| `src/layouts/AppLayout.tsx` | Photo queue drain in reconnect sequence | VERIFIED | `drainPhotoQueue` imported and awaited between `fetchSessions` and `drainQueue` (audio) |
| `src/hooks/usePhotoUploadStatus.ts` | Hook returning upload status per dexiePhotoId | VERIFIED | `usePhotoUploadStatus` using `useLiveQuery` on `db.photoUploadQueue` |
| `src/pages/ItemEntry.tsx` | PhotoCapture with sessionId prop | VERIFIED | Line 191: `sessionId={sessionId!}` passed to `<PhotoCapture` |
| `src/hooks/usePhotoUrl.ts` | Hook returning blob URL or signed URL fallback | VERIFIED | `usePhotoUrl(blob, storagePath)` — blob preferred, `createSignedUrl` fallback |
| `src/utils/export.ts` | Export with Storage download fallback | VERIFIED | `supabase.storage.from('photos').download(sp.storage_path)` at lines 87-89 |
| `src/services/photoMigration.ts` | detectUnuploadedPhotos, migrateExistingPhotos | VERIFIED | Both functions exported; localStorage flag check; `enqueuePhotoUpload` + `drainPhotoQueue` wired |
| `src/components/PhotoMigrationBanner.tsx` | Background progress indicator | VERIFIED | `useLiveQuery` on pending/failed counts; shows "Uploading N photos..." and failure message |
| `src/tests/photo-upload-queue.test.ts` | 15 test stubs covering queue behaviors | VERIFIED | 15/15 tests pass |
| `src/tests/photo-migration.test.ts` | 8 test stubs for migration | VERIFIED | 8/8 tests pass |
| `src/tests/photo-url-fallback.test.ts` | 4 test stubs for signed URL fallback | VERIFIED | 4/4 tests pass |
| `src/tests/app-layout-drain.test.ts` | 3 test stubs for drain order | VERIFIED | 3/3 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/photoUploadQueue.ts` | `src/db/index.ts` | `db.photoUploadQueue` reads/writes | WIRED | `db.photoUploadQueue.add/update/where` calls throughout service |
| `src/services/photoUploadQueue.ts` | Supabase Storage | `supabase.storage.from('photos').upload()` | WIRED | Lines 68 and 78: `storage.from('photos').upload(entry.storagePath, ...)` and thumbnail path |
| `src/components/PhotoCapture.tsx` | `src/services/photoUploadQueue.ts` | `enqueuePhotoUpload + drainPhotoQueue` | WIRED | Line 7 import; line 131 `enqueuePhotoUpload({...}).then(() => drainPhotoQueue())` |
| `src/layouts/AppLayout.tsx` | `src/services/photoUploadQueue.ts` | `drainPhotoQueue` in reconnect handler | WIRED | Line 7 import; line 32 `await drainPhotoQueue()` |
| `src/pages/ItemEntry.tsx` | `src/components/PhotoCapture.tsx` | `sessionId` prop | WIRED | Line 191: `sessionId={sessionId!}` |
| `src/hooks/usePhotoUrl.ts` | Supabase Storage | `createSignedUrl` | WIRED | Line 29: `supabase.storage.from('photos').createSignedUrl(storagePath, 3600)` |
| `src/utils/export.ts` | Supabase Storage | `storage.from('photos').download()` | WIRED | Lines 87-89: `supabase.storage.from('photos').download(sp.storage_path)` fallback |
| `src/services/photoMigration.ts` | `src/services/photoUploadQueue.ts` | `enqueuePhotoUpload + drainPhotoQueue` | WIRED | Line 3 import; line 66 `enqueuePhotoUpload({...})`, line 76 `drainPhotoQueue()` |
| `src/layouts/AppLayout.tsx` | `src/services/photoMigration.ts` | `migrateExistingPhotos` on mount | WIRED | Line 8 import; line 40 `migrateExistingPhotos().catch(() => {})` |
| `src/layouts/AppLayout.tsx` | `src/components/PhotoMigrationBanner.tsx` | JSX render | WIRED | Line 9 import; line 53 `<PhotoMigrationBanner />` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| PHOTO-UPLOAD-01 | 19-00, 19-01, 19-02 | Photos upload to Supabase Storage immediately after capture (fire-and-forget) | SATISFIED | PhotoCapture enqueues + drains on Keep tap; non-blocking `.then()` chain |
| PHOTO-UPLOAD-02 | 19-00, 19-01 | Dedicated photo upload queue with bounded concurrency (2) and exponential backoff retry (3 attempts) | SATISFIED | `CONCURRENCY=2`, `MAX_RETRIES=3`, `Math.pow(4, newRetryCount) * 1000` in photoUploadQueue.ts |
| PHOTO-UPLOAD-03 | 19-02 | Thumbnails show sync status overlay (uploading spinner, uploaded check, failed retry icon) | SATISFIED | Thumbnail component renders three distinct status overlays; verified by code inspection |
| PHOTO-UPLOAD-04 | 19-00, 19-04 | Existing Dexie photos migrate to Storage automatically on app load (background, non-blocking) | SATISFIED | `migrateExistingPhotos()` in AppLayout useEffect; localStorage flag prevents re-run |
| PHOTO-UPLOAD-05 | 19-03 | Photos display from local Dexie blob when available, falling back to Supabase signed URL | SATISFIED | `usePhotoUrl` hook; all 4 fallback tests pass |
| PHOTO-UPLOAD-06 | 19-00, 19-02 | Reconnection drain order is metadata -> photos -> audio | SATISFIED | AppLayout: `processWriteAheadQueue` -> `fetchSessions` -> `drainPhotoQueue` -> `drainQueue`; 3/3 drain-order tests pass |
| PHOTO-UPLOAD-07 | 19-03 | Export reads local blobs first, downloads from Storage when missing | SATISFIED | export.ts Storage download fallback; verified by grep and export tests |
| PHOTO-UPLOAD-08 | 19-04 | Human verification confirms end-to-end photo upload flow | NEEDS HUMAN | 19-04 SUMMARY records human checkpoint "approved" — requires re-confirmation from user |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | Phase 19 files are clean |

Note: The full test suite shows 34 pre-existing failures in non-Phase-19 test files (`item-crud.test.ts`, `sessions.test.ts`, `account-management.test.tsx`, `item-list.test.tsx`, `re-record.test.ts`, `export-history.test.ts`). These existed before Phase 19 began (oldest commit trace is `b4552a3 feat(06-01)` and `978b22f test(quick-4)`). All 30 Phase-19 tests pass.

### Human Verification Required

The automated tests and code verification confirm all implementation exists and is wired correctly. The following behaviors require human observation to fully confirm PHOTO-UPLOAD-08:

#### 1. New Photo Upload with Sync Status

**Test:** Open the app, create a house visit session, take a photo, tap "Keep"
**Expected:** Thumbnail appears immediately with a spinning indicator in the corner, which transitions to a green checkmark after the upload completes in Supabase Storage
**Why human:** Async UI state transitions triggered by Dexie live query cannot be observed by grep; requires watching the actual component re-render

#### 2. Offline Capture then Reconnect

**Test:** Toggle device to airplane mode, take a photo, tap "Keep", toggle back to online
**Expected:** Thumbnail shows spinner while offline (upload pending), then automatically completes with green check once connection is restored
**Why human:** Requires device network control and real-time observation of AppLayout reconnect handler firing drainPhotoQueue

#### 3. Failed Upload Manual Retry

**Test:** If a photo shows the red retry icon, tap the thumbnail
**Expected:** The tap calls retryFailedUploads, icon switches to spinner, then to green check on success
**Why human:** Requires inducing a failure state and verifying the tap handler routes to retryFailedUploads instead of lightbox

#### 4. Cross-Device Signed URL Fallback

**Test:** On a second device or incognito window logged in as admin, navigate to a session with uploaded photos
**Expected:** Photos render correctly via signed URLs (no local Dexie blobs present)
**Why human:** Requires two separate browser sessions; signed URL fetch is a network call that cannot be mocked in verification

#### 5. Export with Storage Download Fallback

**Test:** As admin (no local blobs), export a session that has uploaded photos
**Expected:** Exported JSON contains base64 photo data downloaded from Supabase Storage
**Why human:** Requires an admin session without local blobs to exercise the Storage download fallback path

#### 6. Photo Migration Banner

**Test:** On a device with existing pre-Phase-19 Dexie photos (and `photo_migration_v1_complete` flag not set), load the app
**Expected:** Banner shows "Uploading N photos..." with a decreasing count, then disappears when all uploads complete
**Why human:** Requires pre-existing test data state and observation of useLiveQuery reactive updates over time

### Gaps Summary

No automated gaps found. All 11 observable truths are verified by code inspection and passing tests (30/30 Phase-19 tests pass). The phase is marked `human_needed` because PHOTO-UPLOAD-08 explicitly requires human end-to-end verification — the 19-04 SUMMARY records a human checkpoint approval, but this verification cannot confirm that independently without a human retest.

---

_Verified: 2026-03-23T12:25:00Z_
_Verifier: Claude (gsd-verifier)_
