---
phase: 19-photo-upload-to-supabase-storage-with-full-offline-support
plan: 02
subsystem: ui
tags: [photo-upload, dexie, live-query, thumbnails, offline-queue, supabase-storage]

requires:
  - phase: 19-01
    provides: photoUploadQueue service (enqueuePhotoUpload, drainPhotoQueue, retryFailedUploads)
provides:
  - Upload trigger wired into PhotoCapture handleKeep (fire-and-forget)
  - Sync status overlay on photo thumbnails (spinner/check/retry)
  - Photo queue drain integrated into AppLayout reconnect sequence
  - usePhotoUploadStatus hook for reactive upload status
  - sessionId prop plumbed through ItemEntry to PhotoCapture
affects: [19-03, 19-04]

tech-stack:
  added: []
  patterns: [fire-and-forget enqueue pattern, Dexie live query for queue status, sync overlay on thumbnails]

key-files:
  created:
    - src/hooks/usePhotoUploadStatus.ts
  modified:
    - src/components/PhotoCapture.tsx
    - src/layouts/AppLayout.tsx
    - src/pages/ItemEntry.tsx

key-decisions:
  - "Fire-and-forget pattern: enqueue + drain chained with .then(), not awaited in UI flow"
  - "Failed thumbnail tap retries upload instead of opening lightbox"

patterns-established:
  - "Sync overlay: small corner indicator on thumbnails for background upload status"
  - "usePhotoUploadStatus: Dexie live query on photoUploadQueue for reactive per-photo status"

requirements-completed: [PHOTO-UPLOAD-01, PHOTO-UPLOAD-03, PHOTO-UPLOAD-06]

duration: 3min
completed: 2026-03-23
---

# Phase 19 Plan 02: UI Integration Summary

**Fire-and-forget photo upload on Keep tap with sync status overlays and reconnect drain order**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T14:15:48Z
- **Completed:** 2026-03-23T14:18:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PhotoCapture fires enqueuePhotoUpload after db.photos.add in handleKeep (non-blocking)
- Thumbnail strip shows sync status overlay (spinner for pending/uploading, green check for uploaded, red retry for failed)
- AppLayout reconnect drain order: write-ahead -> fetchSessions -> drainPhotoQueue -> drainQueue (audio)
- ItemEntry passes sessionId prop through to PhotoCapture

## Task Commits

Each task was committed atomically:

1. **Task 1: Upload trigger in PhotoCapture + drain order in AppLayout + ItemEntry sessionId** - `384e3a1` (feat)
2. **Task 2: Sync status overlay on thumbnails + usePhotoUploadStatus hook** - `9d2ba55` (feat)

## Files Created/Modified
- `src/hooks/usePhotoUploadStatus.ts` - Hook returning reactive upload status per dexiePhotoId via Dexie live query
- `src/components/PhotoCapture.tsx` - Added upload trigger in handleKeep, sync overlays on Thumbnail, sessionId prop
- `src/layouts/AppLayout.tsx` - Added drainPhotoQueue between fetchSessions and audio drainQueue
- `src/pages/ItemEntry.tsx` - Passes sessionId prop to PhotoCapture component

## Decisions Made
- Fire-and-forget pattern: enqueuePhotoUpload + drainPhotoQueue chained with .then(), not awaited in handleKeep UI flow
- Failed thumbnail tap triggers retryFailedUploads instead of opening lightbox (matches "manual retry" user decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI integration complete, ready for Plan 03 (Supabase Storage bucket policies and RLS)
- Photo upload infrastructure + UI wiring both in place

---
*Phase: 19-photo-upload-to-supabase-storage-with-full-offline-support*
*Completed: 2026-03-23*
