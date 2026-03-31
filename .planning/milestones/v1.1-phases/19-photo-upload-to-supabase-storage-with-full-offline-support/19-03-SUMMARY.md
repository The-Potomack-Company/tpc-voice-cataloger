---
phase: 19-photo-upload-to-supabase-storage-with-full-offline-support
plan: 03
subsystem: ui
tags: [supabase-storage, signed-url, photo-display, export, offline-first, react-hooks]

# Dependency graph
requires:
  - phase: 19-01
    provides: "Photos table migration, Dexie schema, PhotoUploadEntry type"
  - phase: 19-02
    provides: "Upload trigger, sync overlays, photoUploadQueue with storagePath/thumbnailPath"
provides:
  - "usePhotoUrl hook: local blob preferred, Supabase signed URL fallback (3600s expiry)"
  - "Export with Storage download fallback when Dexie blobs unavailable"
affects: [photo-display, export, admin-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["blob-first-signed-url-fallback for photo display", "Dexie-first-Storage-download for export"]

key-files:
  created:
    - src/hooks/usePhotoUrl.ts
  modified:
    - src/components/PhotoCapture.tsx
    - src/components/PhotoLightbox.tsx
    - src/utils/export.ts
    - src/tests/photo-url-fallback.test.ts
    - src/tests/export.test.ts

key-decisions:
  - "usePhotoUrl checks blob (not blobUrl) to avoid React effect timing race -- useBlobUrl returns undefined on first render"
  - "Export filters to upload_status='uploaded' photos only when downloading from Storage"
  - "Failed Storage downloads excluded gracefully (try/catch + null filter) rather than throwing"

patterns-established:
  - "Blob-first display: usePhotoUrl(blob, storagePath) prefers local blob, falls back to signed URL"
  - "Export fallback: Dexie blobs first, Supabase Storage download when local blobs missing"

requirements-completed: [PHOTO-UPLOAD-05, PHOTO-UPLOAD-07]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 19 Plan 03: URL Fallback & Export Summary

**usePhotoUrl hook with signed URL fallback (3600s) for photo display, plus export download fallback from Supabase Storage when Dexie blobs unavailable**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T14:20:34Z
- **Completed:** 2026-03-23T14:25:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created usePhotoUrl hook: prefers local Dexie blob URL, falls back to Supabase Storage signed URL (1 hour expiry)
- Updated PhotoCapture Thumbnail and PhotoLightbox to use usePhotoUrl with queue entry paths
- Added export fallback: downloads from Supabase Storage when Dexie has no local blobs
- 8 new tests (4 hook tests + 4 export fallback tests), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: usePhotoUrl hook with signed URL fallback + update display components** - `1d79561` (feat)
2. **Task 2: Export fallback to download from Supabase Storage** - `763e543` (feat)

## Files Created/Modified
- `src/hooks/usePhotoUrl.ts` - New hook: blob URL preferred, signed URL fallback from Supabase Storage
- `src/components/PhotoCapture.tsx` - Thumbnail uses usePhotoUrl with thumbnailPath from upload queue
- `src/components/PhotoLightbox.tsx` - LightboxImage uses usePhotoUrl with storagePath from upload queue
- `src/utils/export.ts` - Conditional photo export: Dexie blobs first, Storage download fallback
- `src/tests/photo-url-fallback.test.ts` - 4 tests for usePhotoUrl hook behavior
- `src/tests/export.test.ts` - 4 new tests for Storage download fallback + updated mock to include storage

## Decisions Made
- usePhotoUrl checks `blob` (not `blobUrl`) in effect dependency to avoid race condition: useBlobUrl returns undefined on first render before effect creates object URL, which would trigger unnecessary signed URL fetch
- Export queries photos table with `upload_status='uploaded'` filter to only download successfully uploaded photos
- Failed Storage downloads return null and are filtered out (no crash on partial failures)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed usePhotoUrl effect dependency race condition**
- **Found during:** Task 1 (usePhotoUrl hook implementation)
- **Issue:** Plan used `blobUrl` in effect dependency, but useBlobUrl returns undefined on first render (before its effect runs), causing unnecessary createSignedUrl calls
- **Fix:** Changed effect dependency to check `blob` (the raw Blob input) instead of `blobUrl` (the derived object URL)
- **Files modified:** src/hooks/usePhotoUrl.ts
- **Verification:** All 4 hook tests pass, including "prefers blob URL" which asserts createSignedUrl is never called
- **Committed in:** 1d79561 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed existing test mock missing photos table handler**
- **Found during:** Task 2 (export fallback)
- **Issue:** Existing `setupFullResponse` helper in export.test.ts didn't handle `supabase.from("photos")`, causing "select is not a function" when export code falls through to Storage fallback path
- **Fix:** Added photos table handler to setupFullResponse returning empty array
- **Files modified:** src/tests/export.test.ts
- **Verification:** All 15 export tests pass
- **Committed in:** 763e543 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Photo display fallback complete: admin on different device sees signed URLs
- Export fallback complete: admin can export sessions with photos even without local Dexie blobs
- Ready for Plan 19-04 (cleanup/drain integration) or Plan 19-05 if applicable

---
*Phase: 19-photo-upload-to-supabase-storage-with-full-offline-support*
*Completed: 2026-03-23*
