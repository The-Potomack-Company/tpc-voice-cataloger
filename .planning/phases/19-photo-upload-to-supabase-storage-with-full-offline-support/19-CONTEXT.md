# Phase 19: Photo Upload to Supabase Storage with Full Offline Support - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Move photos from Dexie IndexedDB to Supabase Storage as the server-authoritative store for photo blobs. Photos upload immediately after capture (fire-and-forget), queue offline, and sync when connectivity returns. A new Postgres photos table tracks metadata and upload status. Existing Dexie photos migrate automatically. Photo reordering, AI-based photo analysis, and video recording are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Upload timing & trigger
- Photos upload immediately after user taps "Keep" (fire-and-forget, non-blocking)
- Both full-size (2048px) and thumbnail (200px) blobs upload to Supabase Storage
- Upload happens in background — user sees local thumbnail instantly from Dexie
- Subtle sync icon overlay on each thumbnail: uploading (spinner), uploaded (check), failed (retry tap)

### Offline queue strategy
- New dedicated photo upload queue (separate Dexie table, not reusing write-ahead or audio queues)
- Retry with exponential backoff: 3 attempts (1s, 4s, 16s), then mark failed
- Failed uploads have manual retry option (same pattern as audio queue retry)
- Bounded concurrency: 2 simultaneous uploads
- Drain order on reconnect: metadata (write-ahead) → photos → audio AI processing

### Storage organization
- Single Supabase Storage bucket ("photos"), private access
- Nested path structure: `photos/{session_id}/{item_id}/full-{sort_order}.jpg` and `photos/{session_id}/{item_id}/thumb-{sort_order}.jpg`
- Private bucket with short-lived signed URLs for display
- New `photos` table in Supabase Postgres: id, item_id, storage_path, thumbnail_path, sort_order, upload_status, created_at
- RLS on photos table ties to session ownership (same pattern as items table)

### Photo display strategy
- Prefer local Dexie blob if available (instant, works offline)
- Fallback to Supabase Storage signed URL when no local blob (e.g., admin viewing on different device)

### Export behavior
- Export JSON continues to use base64-encoded photo data (no change to Chrome extension)
- Export reads from local Dexie blobs when available, falls back to downloading from Storage

### Migration & Dexie cleanup
- One-time migration: detect un-uploaded Dexie photos on app load (post-auth) and queue them for upload
- Background upload with progress indicator (small progress bar or badge, not blocking splash)
- Keep local Dexie blobs as cache after upload (fast display + offline viewing)
- No Dexie blob deletion — device storage is manageable for 2-5 person team

### Claude's Discretion
- Exact signed URL expiration time
- Photo upload queue Dexie table schema details
- Progress indicator placement and styling
- Migration detection logic (how to identify un-uploaded photos)
- RLS policy details for photos bucket and table

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Photo capture (current implementation)
- `src/components/PhotoCapture.tsx` — Current photo capture flow, Dexie storage, thumbnail strip, keep/retake UX
- `src/components/PhotoLightbox.tsx` — Full-size photo display component
- `src/utils/image.ts` — resizeImage utility (2048px full, 200px thumbnail, JPEG 0.85 quality)
- `src/hooks/useBlobUrl.ts` — Blob URL management for display

### Offline queue patterns (to replicate)
- `src/services/offlineQueue.ts` — Audio offline queue: bounded concurrency (4), retry logic, drain pattern, manual retry
- `src/hooks/useWriteAheadQueue.ts` — Write-ahead queue: FIFO, stop-on-first-failure, drain on reconnect

### Database & types
- `src/db/index.ts` — Dexie schema (photos table at v1, current v7)
- `src/db/types.ts` — ItemPhoto interface, ItemAudio interface (pattern reference)
- `src/db/idMapping.ts` — getDexieItemId bridge for migrated items

### Data migration reference
- `src/db/migration.ts` — Phase 14 Dexie-to-Supabase migration pattern (one-time detection + queue)
- `src/components/MigrationSplash.tsx` — Migration UI pattern (this phase uses background indicator instead)

### Export
- `src/utils/export.ts` — buildExportData reads photos from Dexie, base64-encodes for JSON export

### Supabase
- `src/lib/supabase.ts` — Supabase client singleton

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resizeImage()` — Already produces both full and thumbnail blobs; no change needed
- `PhotoCapture` component — Needs upload trigger added after `db.photos.add()`
- `useBlobUrl` hook — Can be extended to accept signed URL fallback
- `getDexieItemId` — Needed for migration to map Dexie photo itemIds to Supabase item UUIDs
- `offlineQueue.ts` drain pattern — Template for new photo upload queue (concurrency, retry, online check)
- `useWriteAheadQueue` hook — Pattern for triggering queue drain on online status change

### Established Patterns
- Fire-and-forget processing: audio uses this exact pattern (save locally, process async)
- Write-ahead queue: FIFO with stop-on-first-failure for metadata
- Online status from `useUIStore` via `useOnlineStatus` hook
- Drain order in AppLayout: write-ahead first, then audio — photos will slot in between
- Optimistic updates with revert-on-error throughout the Zustand store layer

### Integration Points
- `PhotoCapture.handleKeep()` — Trigger upload after Dexie save
- `AppLayout` — Add photo queue drain to the reconnection sequence (after write-ahead, before audio)
- Supabase Storage API — `supabase.storage.from('photos').upload()` and `.createSignedUrl()`
- New Supabase migration — CREATE TABLE photos + RLS policies + Storage bucket creation
- `buildExportData()` — May need fallback to fetch from Storage when Dexie blob missing

</code_context>

<specifics>
## Specific Ideas

- Manual retry for failed photo uploads should match the existing audio retry UX pattern
- Sync icon overlay on thumbnails (uploading/uploaded/failed states) — subtle, not distracting from cataloging flow
- Background migration progress indicator after login — not a blocking splash screen
- Drain order explicitly: metadata → photos → audio (ensures item records exist before photo uploads reference them)

</specifics>

<deferred>
## Deferred Ideas

- Photo reordering (drag to set hero shot) — already tracked as PHOTO-01 in future requirements
- Photo deletion from Supabase Storage (when item is deleted) — handle in a cleanup phase
- Clear local cache button in Settings — could free device storage for power users
- Photo compression quality settings — current 0.85 JPEG quality is sufficient

</deferred>

---

*Phase: 19-photo-upload-to-supabase-storage-with-full-offline-support*
*Context gathered: 2026-03-20*
