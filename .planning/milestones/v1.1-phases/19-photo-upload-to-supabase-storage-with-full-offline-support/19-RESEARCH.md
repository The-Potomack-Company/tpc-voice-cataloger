# Phase 19: Photo Upload to Supabase Storage with Full Offline Support - Research

**Researched:** 2026-03-20
**Domain:** Supabase Storage, offline upload queuing, Dexie-to-Storage migration
**Confidence:** HIGH

## Summary

This phase adds Supabase Storage as the server-authoritative store for photo blobs, while preserving the existing Dexie-first local experience. The implementation requires: (1) a new Supabase migration creating a `photos` table and a private Storage bucket with RLS, (2) a dedicated Dexie-based photo upload queue with bounded concurrency and retry logic, (3) integration into the existing reconnection drain pipeline, (4) sync status UI overlays on thumbnails, and (5) one-time migration of existing Dexie photos to Storage.

The codebase already has all the patterns needed. The audio offline queue (`offlineQueue.ts`) provides the exact template for bounded concurrency + retry. The write-ahead queue provides the drain-on-reconnect pattern. PhotoCapture's `handleKeep` is the natural trigger point. The main new complexity is the Storage API integration (upload + signed URLs) and the migration detection for pre-existing Dexie photos.

**Primary recommendation:** Build the photo upload queue as a standalone service (`src/services/photoUploadQueue.ts`) modeled directly on `offlineQueue.ts`, with a dedicated Dexie v8 table for queue entries. Integrate into AppLayout's drain sequence between write-ahead and audio queues.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Photos upload immediately after user taps "Keep" (fire-and-forget, non-blocking)
- Both full-size (2048px) and thumbnail (200px) blobs upload to Supabase Storage
- Upload happens in background -- user sees local thumbnail instantly from Dexie
- Subtle sync icon overlay on each thumbnail: uploading (spinner), uploaded (check), failed (retry tap)
- New dedicated photo upload queue (separate Dexie table, not reusing write-ahead or audio queues)
- Retry with exponential backoff: 3 attempts (1s, 4s, 16s), then mark failed
- Failed uploads have manual retry option (same pattern as audio queue retry)
- Bounded concurrency: 2 simultaneous uploads
- Drain order on reconnect: metadata (write-ahead) -> photos -> audio AI processing
- Single Supabase Storage bucket ("photos"), private access
- Nested path structure: `photos/{session_id}/{item_id}/full-{sort_order}.jpg` and `photos/{session_id}/{item_id}/thumb-{sort_order}.jpg`
- Private bucket with short-lived signed URLs for display
- New `photos` table in Supabase Postgres: id, item_id, storage_path, thumbnail_path, sort_order, upload_status, created_at
- RLS on photos table ties to session ownership (same pattern as items table)
- Prefer local Dexie blob if available (instant, works offline)
- Fallback to Supabase Storage signed URL when no local blob
- Export JSON continues to use base64-encoded photo data (no change to Chrome extension)
- Export reads from local Dexie blobs when available, falls back to downloading from Storage
- One-time migration: detect un-uploaded Dexie photos on app load (post-auth) and queue them for upload
- Background upload with progress indicator (small progress bar or badge, not blocking splash)
- Keep local Dexie blobs as cache after upload (fast display + offline viewing)
- No Dexie blob deletion -- device storage is manageable for 2-5 person team

### Claude's Discretion
- Exact signed URL expiration time
- Photo upload queue Dexie table schema details
- Progress indicator placement and styling
- Migration detection logic (how to identify un-uploaded photos)
- RLS policy details for photos bucket and table

### Deferred Ideas (OUT OF SCOPE)
- Photo reordering (drag to set hero shot) -- already tracked as PHOTO-01 in future requirements
- Photo deletion from Supabase Storage (when item is deleted) -- handle in a cleanup phase
- Clear local cache button in Settings -- could free device storage for power users
- Photo compression quality settings -- current 0.85 JPEG quality is sufficient
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.2 (latest: 2.99.3) | Storage upload, signed URLs, Postgres photos table | Already the project's backend SDK |
| dexie | ^4.3.0 | Photo upload queue table, existing photo blob storage | Already the project's local DB |
| dexie-react-hooks | (installed) | useLiveQuery for reactive upload status | Already used for photo queries |

### No New Dependencies
This phase requires zero new packages. Supabase Storage is accessed through the existing `@supabase/supabase-js` client. The upload queue uses Dexie. Retry timing uses `setTimeout`. All patterns exist in the codebase.

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    photoUploadQueue.ts     # NEW: Queue management, drain, retry (modeled on offlineQueue.ts)
  db/
    index.ts                # MODIFY: Add v8 with photoUploadQueue table
    types.ts                # MODIFY: Add PhotoUploadEntry interface
  components/
    PhotoCapture.tsx         # MODIFY: Trigger upload after Dexie save
    Thumbnail.tsx            # EXTRACT/MODIFY: Add sync status overlay icon
    PhotoMigrationBanner.tsx # NEW: Background migration progress indicator
  hooks/
    useBlobUrl.ts            # MODIFY: Accept signed URL fallback
    usePhotoUploadStatus.ts  # NEW: Hook for per-photo upload status from queue
  utils/
    export.ts                # MODIFY: Add Storage download fallback for missing Dexie blobs
  layouts/
    AppLayout.tsx            # MODIFY: Insert photo drain between write-ahead and audio
supabase/
  migrations/
    XXXXXXXX_create_photos.sql  # NEW: photos table + bucket + RLS policies
```

### Pattern 1: Dedicated Upload Queue (Dexie Table)
**What:** A new Dexie table (`photoUploadQueue`) stores pending upload entries with status tracking. Each entry references the Dexie photo ID and target Storage path. The queue service processes entries with bounded concurrency.
**When to use:** For all photo uploads (new captures + migration backfill).
**Recommended schema:**
```typescript
// New Dexie type
interface PhotoUploadEntry {
  id?: number;
  dexiePhotoId: number;     // FK to Dexie photos table
  itemId: string;           // Supabase item UUID
  sessionId: string;        // Supabase session UUID
  sortOrder: number;
  storagePath: string;      // e.g. "photos/{session_id}/{item_id}/full-0.jpg"
  thumbnailPath: string;    // e.g. "photos/{session_id}/{item_id}/thumb-0.jpg"
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  createdAt: Date;
  lastAttemptAt?: Date;
}

// Dexie v8 addition
db.version(8).stores({
  // ... existing tables unchanged ...
  photoUploadQueue: '++id, status, dexiePhotoId, itemId, createdAt'
});
```

### Pattern 2: Fire-and-Forget Upload Trigger
**What:** After `db.photos.add()` in `handleKeep`, immediately enqueue a photoUploadQueue entry and call `drainPhotoQueue()`. The drain is non-blocking (not awaited). User sees the local thumbnail instantly.
**When to use:** Every time a photo is captured and kept.
**Example:**
```typescript
// In PhotoCapture.handleKeep(), after db.photos.add():
const photoId = await db.photos.add({ /* ... */ });
await db.photoUploadQueue.add({
  dexiePhotoId: photoId,
  itemId: itemId,
  sessionId: sessionId,
  sortOrder: photos.length,
  storagePath: `photos/${sessionId}/${itemId}/full-${photos.length}.jpg`,
  thumbnailPath: `photos/${sessionId}/${itemId}/thumb-${photos.length}.jpg`,
  status: 'pending',
  retryCount: 0,
  createdAt: new Date(),
});
drainPhotoQueue(); // Fire-and-forget, non-blocking
```

### Pattern 3: Bounded Concurrency with Exponential Backoff
**What:** Process up to 2 uploads simultaneously. On failure, retry with exponential backoff (1s, 4s, 16s). After 3 failures, mark as `failed` for manual retry.
**When to use:** In the photo upload queue drain function.
**Example (modeled on offlineQueue.ts):**
```typescript
const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // 1s, 4s, 16s (4^n * 1000)

async function processOneUpload(entry: PhotoUploadEntry): Promise<void> {
  if (!navigator.onLine) return;

  await db.photoUploadQueue.update(entry.id!, { status: 'uploading' });

  const photo = await db.photos.get(entry.dexiePhotoId);
  if (!photo) { /* mark failed, return */ }

  try {
    // Upload full-size
    const { error: fullErr } = await supabase.storage
      .from('photos')
      .upload(entry.storagePath, photo.blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year (immutable content)
        upsert: false,
      });
    if (fullErr) throw fullErr;

    // Upload thumbnail
    const { error: thumbErr } = await supabase.storage
      .from('photos')
      .upload(entry.thumbnailPath, photo.thumbnail!, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });
    if (thumbErr) throw thumbErr;

    // Insert metadata row in Supabase photos table
    await supabase.from('photos').insert({
      item_id: entry.itemId,
      storage_path: entry.storagePath,
      thumbnail_path: entry.thumbnailPath,
      sort_order: entry.sortOrder,
      upload_status: 'uploaded',
    });

    // Mark queue entry done
    await db.photoUploadQueue.update(entry.id!, { status: 'uploaded' });
  } catch {
    const newRetry = entry.retryCount + 1;
    if (newRetry >= MAX_RETRIES) {
      await db.photoUploadQueue.update(entry.id!, {
        status: 'failed', retryCount: newRetry, lastAttemptAt: new Date()
      });
    } else {
      const delay = Math.pow(4, newRetry) * BACKOFF_BASE;
      await db.photoUploadQueue.update(entry.id!, {
        status: 'pending', retryCount: newRetry, lastAttemptAt: new Date()
      });
      setTimeout(() => drainPhotoQueue(), delay);
    }
  }
}
```

### Pattern 4: Drain Order Integration in AppLayout
**What:** Insert photo queue drain between write-ahead and audio in the reconnection handler.
**Current order:** write-ahead -> fetchSessions -> audio
**New order:** write-ahead -> fetchSessions -> photos -> audio
**Example:**
```typescript
const handleReconnect = async () => {
  await processWriteAheadQueue();
  await fetchSessions();
  await drainPhotoQueue();  // NEW: after metadata synced, before audio
  drainQueue();             // Audio queue last
};
```

### Pattern 5: Signed URL Fallback in Display
**What:** Extend the display logic to use signed URLs when Dexie blob is missing (admin on different device, cleared cache).
**Recommended signed URL expiration:** 3600 seconds (1 hour) -- long enough for a viewing session, short enough for security.
**Example:**
```typescript
// Enhanced useBlobUrl or new usePhotoUrl hook
function usePhotoUrl(
  blob: Blob | undefined,
  storagePath: string | undefined
): string | undefined {
  const blobUrl = useBlobUrl(blob);
  const [signedUrl, setSignedUrl] = useState<string>();

  useEffect(() => {
    if (blobUrl || !storagePath) return;
    supabase.storage.from('photos')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => { if (data) setSignedUrl(data.signedUrl); });
  }, [blobUrl, storagePath]);

  return blobUrl ?? signedUrl;
}
```

### Pattern 6: Migration Detection for Existing Photos
**What:** On app load (post-auth), scan Dexie photos table for entries that have no corresponding photoUploadQueue entry with status 'uploaded'. Queue those for upload.
**Example:**
```typescript
async function detectUnuploadedPhotos(): Promise<number> {
  const allPhotos = await db.photos.toArray();
  const uploadedIds = new Set(
    (await db.photoUploadQueue.where('status').equals('uploaded').toArray())
      .map(e => e.dexiePhotoId)
  );

  const unuploaded = allPhotos.filter(p => !uploadedIds.has(p.id!));
  // Queue each for upload...
  return unuploaded.length;
}
```

### Anti-Patterns to Avoid
- **Storing blobs in Supabase Postgres:** Storage is for blobs, Postgres is for metadata only. The `photos` Postgres table stores paths, not binary data.
- **Awaiting upload in handleKeep:** The upload MUST be fire-and-forget. Blocking the UI while uploading defeats the offline-first architecture.
- **Reusing the write-ahead queue for photo uploads:** Photo uploads are large binary operations with different retry semantics (exponential backoff vs stop-on-first-failure). A dedicated queue is correct.
- **Using public bucket:** Private bucket + signed URLs is the correct choice for user-uploaded content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to cloud | Custom multipart uploader | `supabase.storage.from().upload()` | Handles chunking, auth headers, error codes |
| Signed URL generation | Custom token/URL builder | `supabase.storage.from().createSignedUrl()` | Handles cryptographic signing, expiration |
| RLS on storage | Custom auth middleware | Supabase Storage RLS policies on `storage.objects` | Runs at database level, cannot be bypassed |
| Upload retry timing | Custom scheduler | setTimeout with exponential backoff | Simple, no library needed for 3 retries |

**Key insight:** Supabase Storage handles all the hard parts (auth, signing, access control). The project's job is queue management and UI status tracking, both of which have existing patterns in the codebase.

## Common Pitfalls

### Pitfall 1: Storage Path Collisions
**What goes wrong:** If sort_order changes (reordering, deletion+re-add), paths like `full-{sort_order}.jpg` may collide with existing uploads.
**Why it happens:** Sort order is mutable but storage paths are immutable once uploaded.
**How to avoid:** Use the Dexie photo `id` (auto-increment, unique) in the path instead of sort_order, OR accept that sort_order at upload time is "baked in" and handle reordering separately. Since reordering is deferred (PHOTO-01), using sort_order is fine for now but document this assumption.
**Warning signs:** Upload errors with "duplicate key" or "already exists."

### Pitfall 2: Race Between Metadata Sync and Photo Upload
**What goes wrong:** Photo upload references an `item_id` that hasn't been synced to Supabase yet (write-ahead queue still has the insert pending).
**Why it happens:** If the user is offline when creating an item, the item exists in write-ahead but not in Supabase. Photo upload tries to insert into `photos` table with FK to `items`, which fails.
**How to avoid:** The drain order (write-ahead -> photos -> audio) prevents this. Additionally, the photo upload service should verify the item exists in Supabase before uploading, or handle FK violation gracefully by re-queuing.
**Warning signs:** Foreign key constraint violations on `photos.item_id`.

### Pitfall 3: Signed URL Expiration During Long Sessions
**What goes wrong:** Admin opens a session, views photos (signed URLs generated), then leaves browser tab open for hours. URLs expire, images break.
**Why it happens:** Signed URLs have a fixed TTL.
**How to avoid:** Use a generous expiration (3600s = 1 hour). For the rare admin case of very long sessions, the component could detect a failed image load and re-fetch the signed URL. This is an edge case for 2-5 users.
**Warning signs:** Broken image icons after prolonged viewing.

### Pitfall 4: Dexie Photo ID Type Mismatch
**What goes wrong:** Dexie photos table stores `itemId` as `number` (from v1 schema), but post-migration items use string UUIDs stored via `as unknown as number` cast.
**Why it happens:** The existing codebase already handles this with the `dexieItemId ?? itemId` pattern (see 14-05 decision). The photo upload queue must use the same pattern.
**How to avoid:** When creating photoUploadQueue entries, always store the Supabase UUID as `itemId` (string). When looking up the Dexie photo blob, use the `getDexieItemId` bridge or fallback pattern.
**Warning signs:** Photos not found during upload, empty uploads.

### Pitfall 5: Large Upload Blocking Main Thread
**What goes wrong:** Uploading a 2048px JPEG (typically 200-500KB) blocks UI while the fetch is in progress.
**Why it happens:** `supabase.storage.upload()` is async/await but still uses the main thread for encoding.
**How to avoid:** The bounded concurrency of 2 prevents overload. Each upload is a single fetch call, which the browser handles off-thread. This is unlikely to be a real issue at these file sizes.
**Warning signs:** UI jank during rapid photo capture.

### Pitfall 6: Migration Running Multiple Times
**What goes wrong:** The migration detection runs on every app load and re-queues already-queued photos.
**Why it happens:** No flag tracking whether migration has completed.
**How to avoid:** Check if a photoUploadQueue entry already exists for each Dexie photo before enqueuing. Or use a simple localStorage flag like `photo_migration_v1_complete`.
**Warning signs:** Duplicate upload queue entries, duplicate files in Storage.

## Code Examples

### Supabase Migration SQL: photos table + bucket + RLS
```sql
-- Create photos table
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  thumbnail_path text not null,
  sort_order integer not null default 0,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create index idx_photos_item_id on public.photos (item_id);

-- Create private storage bucket
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false);
```

### RLS Policies for photos table (session ownership pattern from items)
```sql
-- Admins full access
create policy "Admins full access to photos"
  on public.photos for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists view photos in their sessions
create policy "Specialists view own photos"
  on public.photos for select
  to authenticated
  using (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists insert photos for their items
create policy "Specialists create own photos"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
```

### Storage RLS Policies (on storage.objects)
```sql
-- Allow authenticated users to upload to photos bucket (path-based auth)
create policy "Users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
  );

-- Allow authenticated users to read their photos via signed URLs
create policy "Users can read photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
  );
```

### Supabase Storage Upload Call
```typescript
// Source: Supabase JS SDK docs
const { data, error } = await supabase.storage
  .from('photos')
  .upload('photos/session-uuid/item-uuid/full-0.jpg', blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',  // 1 year, photos are immutable
    upsert: false,
  });
```

### Supabase Signed URL
```typescript
// Source: Supabase JS SDK docs
const { data, error } = await supabase.storage
  .from('photos')
  .createSignedUrl('photos/session-uuid/item-uuid/full-0.jpg', 3600);
// data.signedUrl contains the time-limited URL
```

### Batch Signed URLs (for thumbnail strip)
```typescript
// Source: Supabase JS SDK docs
const { data, error } = await supabase.storage
  .from('photos')
  .createSignedUrls(
    ['path/to/thumb-0.jpg', 'path/to/thumb-1.jpg'],
    3600
  );
// data is array of { signedUrl, path, error }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Photos only in Dexie (v1.0-v1.1) | Photos in Supabase Storage + Dexie cache | Phase 19 | Server-authoritative, viewable cross-device |
| No photo metadata in Postgres | photos table with paths + status | Phase 19 | Enables admin viewing, export fallback |
| Direct Dexie blob display | Local blob preferred, signed URL fallback | Phase 19 | Works offline + cross-device |

## Open Questions

1. **Storage path: sort_order vs unique ID**
   - What we know: CONTEXT.md specifies `full-{sort_order}.jpg` in paths
   - What's unclear: If photo reordering (PHOTO-01) is implemented later, existing paths become misleading
   - Recommendation: Use sort_order as specified. Paths are opaque identifiers -- the Postgres photos table tracks the actual sort_order. When PHOTO-01 is implemented, only the Postgres sort_order changes, not the storage path.

2. **Storage RLS granularity**
   - What we know: Need INSERT and SELECT on storage.objects for the photos bucket
   - What's unclear: Whether to restrict storage paths to match session/item ownership (complex RLS with path parsing) or rely on the Postgres photos table RLS for access control
   - Recommendation: Use simple bucket-level policies on storage.objects (INSERT/SELECT where bucket_id = 'photos'). The signed URL generation goes through the Postgres photos table which has proper session-ownership RLS. This means the storage-level RLS just ensures authenticated users, while the Postgres-level RLS ensures ownership.

3. **Export fallback: downloading from Storage**
   - What we know: Export needs base64-encoded photo data. Normally reads from Dexie blobs.
   - What's unclear: Exact pattern for downloading a blob from Storage when Dexie blob is missing
   - Recommendation: Use `supabase.storage.from('photos').download(storagePath)` which returns a Blob directly. Then base64-encode as normal. Only triggers for the admin-on-different-device case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vite.config.ts (inline vitest config) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P19-01 | Photo upload queue enqueue + drain | unit | `npx vitest run src/tests/photo-upload-queue.test.ts -x` | No - Wave 0 |
| P19-02 | Exponential backoff retry logic | unit | `npx vitest run src/tests/photo-upload-queue.test.ts -x` | No - Wave 0 |
| P19-03 | Drain order (write-ahead -> photos -> audio) | unit | `npx vitest run src/tests/app-layout-drain.test.ts -x` | No - Wave 0 |
| P19-04 | Migration detection (un-uploaded photos) | unit | `npx vitest run src/tests/photo-migration.test.ts -x` | No - Wave 0 |
| P19-05 | Signed URL fallback when no local blob | unit | `npx vitest run src/tests/photo-url-fallback.test.ts -x` | No - Wave 0 |
| P19-06 | Export fallback to Storage download | unit | `npx vitest run src/tests/export.test.ts -x` | Yes (needs extension) |
| P19-07 | Supabase migration SQL runs clean | manual-only | Run via `supabase db push` | N/A |
| P19-08 | Sync icon overlay states | manual-only | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/photo-upload-queue.test.ts` -- covers P19-01, P19-02
- [ ] `src/tests/photo-migration.test.ts` -- covers P19-04
- [ ] `src/tests/photo-url-fallback.test.ts` -- covers P19-05
- [ ] Extend `src/tests/export.test.ts` -- covers P19-06 (Storage download fallback)
- [ ] Dexie v8 schema in `src/db/index.ts` -- photoUploadQueue table

## Sources

### Primary (HIGH confidence)
- Codebase: `src/services/offlineQueue.ts` -- audio queue pattern (bounded concurrency, retry, drain mutex)
- Codebase: `src/hooks/useWriteAheadQueue.ts` -- write-ahead queue pattern (FIFO, stop-on-first-failure, online trigger)
- Codebase: `src/components/PhotoCapture.tsx` -- current photo capture flow, handleKeep trigger point
- Codebase: `src/db/index.ts` -- Dexie schema v1-v7, photos table structure
- Codebase: `src/db/types.ts` -- ItemPhoto interface (blob, thumbnail, itemId, sortOrder)
- Codebase: `supabase/migrations/20260318000005_rls_policies.sql` -- RLS pattern (session ownership joins)
- Codebase: `supabase/migrations/20260318000002_create_items.sql` -- table creation pattern
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- RLS on storage.objects
- [Supabase JS SDK: upload](https://supabase.com/docs/reference/javascript/storage-from-upload) -- upload API
- [Supabase JS SDK: createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) -- signed URL API
- [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) -- bucket configuration

### Secondary (MEDIUM confidence)
- [Supabase Discussion: Storage bucket SQL migration](https://github.com/orgs/supabase/discussions/3528) -- `insert into storage.buckets` pattern
- [Supabase Discussion: Signed URL RLS](https://github.com/orgs/supabase/discussions/20366) -- RLS checked at URL creation time, not at access time

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all APIs verified against installed versions and official docs
- Architecture: HIGH -- all patterns directly modeled on existing codebase (offlineQueue.ts, writeAheadQueue.ts)
- Pitfalls: HIGH -- derived from analyzing actual code paths and FK relationships in existing schema
- Supabase Storage API: HIGH -- verified against official docs, SDK version 2.99.x

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no fast-moving dependencies)
