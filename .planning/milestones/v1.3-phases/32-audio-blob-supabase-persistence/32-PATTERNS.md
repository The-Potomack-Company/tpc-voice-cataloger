# Phase 32: audio-blob-supabase-persistence - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 13 (4 new, 9 modified) + 1 new edge function
**Analogs found:** 12 / 13 (1 net-new server mechanism has no in-repo analog)

The entire client surface is a structural clone of the **photos subsystem** (D-01 "mirror photos fully"). The only genuinely novel engineering is the two server-side cleanup mechanisms (pg_cron retention + correct Storage-object deletion). Photos is the explicit analog throughout; deltas are called out per file.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/audioUploadQueue.ts` | service | batch / file-I/O | `src/services/photoUploadQueue.ts` | exact |
| `src/hooks/useAudioUploadStatus.ts` | hook | event-driven (live query) | `src/hooks/usePhotoUploadStatus.ts` | exact |
| `supabase/migrations/<ts>_create_audio.sql` | migration | DDL + RLS | `20260320200000_create_photos.sql` + `20260527000001` + `20260528000002` (consolidated) | exact (3-way) |
| `supabase/functions/purge-audio/index.ts` (or similar) | edge function | service-role file-I/O | `supabase/functions/admin-update-user/index.ts` + `_shared/admin-client.ts` | role-match |
| `src/db/types.ts` | model | — | self (`PhotoUploadEntry` for `AudioUploadEntry`) | exact |
| `src/db/index.ts` | config (Dexie schema) | — | self (v8 `photoUploadQueue` precedent) | exact |
| `src/services/gemini.ts` (`processAudioWithAi`) | service | request-response + file-I/O | `src/hooks/usePhotoUrl.ts` (Storage fallback read) | role-match |
| `src/db/audioLookup.ts` | utility | transform (union) | self (extend existing union) | exact |
| `src/hooks/useAudioRecorder.ts` | hook | event-driven | `src/components/PhotoCapture.tsx:130-136` (enqueue-on-add) | role-match |
| `src/stores/sessionStore.ts` (`deleteItem`) | store | CRUD + file-I/O | self + new `storage.remove` (no in-repo `.remove()` analog) | partial |
| `src/components/ItemCard.tsx` | component | event-driven | `src/components/PhotoCapture.tsx:33,38` (status pill + retry) | role-match |
| `items.completed_at` migration + write-path (D-07) | migration + service | DDL + CRUD | `gemini.ts:314-317` (where `ai_status:'done'` is set) | partial |
| `src/tests/audio-*.test.ts` | test | — | `src/tests/photo-upload-queue.test.ts` | exact |

## Pattern Assignments

### `src/services/audioUploadQueue.ts` (NEW — service, batch/file-I/O)

**Analog:** `src/services/photoUploadQueue.ts` (whole file — copy near-verbatim).

**Constants to copy verbatim** (`photoUploadQueue.ts:6-10`):
```typescript
const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // delay = 4^retryCount * 1000 => 1s, 4s, 16s
let draining = false;
```

**Enqueue** (analog `photoUploadQueue.ts:16-34`) — delta: single blob (no thumbnail), `ext` derived from mime, NEW `sessionId` carried for the path:
```typescript
export async function enqueueAudioUpload(params: {
  dexieAudioId: number;
  itemId: string;     // Supabase UUID, NEVER the legacy int (see PhotoCapture.tsx:133)
  sessionId: string;  // NEW — RLS path token [2]; recorder must thread this
  ext: string;        // from blob mime, NOT hardcoded ".opus"
}): Promise<void> {
  await db.audioUploadQueue.add({
    dexieAudioId: params.dexieAudioId,
    itemId: params.itemId,
    sessionId: params.sessionId,
    storagePath: `audio/${params.sessionId}/${params.itemId}/${params.dexieAudioId}.${params.ext}`,
    status: "pending", retryCount: 0, createdAt: new Date(),
  });
}
```

**processOneUpload** (analog `photoUploadQueue.ts:47-138`) — delta: ONE `storage.upload` call (drop the thumbnail upload at lines 77-85), `contentType: audioRecord.mimeType` (analog hardcodes `image/jpeg` at line 71), read from `db.audio` not `db.photos` (analog line 59). The metadata upsert keeps the **exact DAT-5 idempotency idiom** (analog lines 89-99):
```typescript
const { error: insertError } = await supabase.from("audio").upsert(
  { item_id: entry.itemId, storage_path: entry.storagePath, upload_status: "uploaded" },
  { onConflict: "storage_path", ignoreDuplicates: true }
);
```
Requires a unique index on `audio.storage_path` (mirror `photos_storage_path_key`).

**drainAudioQueue + retryFailedUploads + _resetDraining** — copy `photoUploadQueue.ts:145-190` verbatim, swapping `photoUploadQueue` → `audioUploadQueue`. Keep the `navigator.onLine` pause (line 156) and `Promise.allSettled` batching (line 158). Keep `setTimeout(() => drainAudioQueue(), Math.pow(4, n) * BACKOFF_BASE)` backoff (lines 134-135). Keep the `export { enqueueAudioUpload as enqueue }` alias (analog line 37) — the test stubs reference it.

---

### `src/hooks/useAudioUploadStatus.ts` (NEW — hook, live-query)

**Analog:** `src/hooks/usePhotoUploadStatus.ts` (whole file, 27 lines — clone verbatim).

Swap `dexiePhotoId` → `dexieAudioId` and `db.photoUploadQueue` → `db.audioUploadQueue`:
```typescript
export function useAudioUploadStatus(dexieAudioId: number | undefined): UploadStatus {
  const entry = useLiveQuery(() => {
    if (dexieAudioId === undefined) return undefined;
    return db.audioUploadQueue.where("dexieAudioId").equals(dexieAudioId).first();
  }, [dexieAudioId], undefined);
  return entry ? entry.status : "none";
}
```
`UploadStatus` type (analog line 4) unchanged: `"pending" | "uploading" | "uploaded" | "failed" | "none"`.

---

### `supabase/migrations/<ts>_create_audio.sql` (NEW — migration, DDL + RLS)

**Analogs (consolidate all three into ONE migration):**
- `20260320200000_create_photos.sql` — table + bucket + table-RLS shape
- `20260527000001_scope_photos_storage_rls.sql` — session-scoped storage.objects RLS
- `20260528000002_fix_sec4_photo_policy_column_scope.sql` — **column-scope fix; bake in from line one**

**`audio` table** (analog `create_photos.sql:1-19`) — delta: drop `thumbnail_path`/`sort_order`; add `mime_type`, `session_id` (or derive via item join), and the D-07 retention hook:
```sql
create table public.audio (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  mime_type text not null,
  upload_status text not null default 'pending'
    check (upload_status in ('pending','uploading','uploaded','failed')),
  created_at timestamptz not null default now()
);
alter table public.audio enable row level security;
create unique index audio_storage_path_key on public.audio (storage_path); -- DAT-5
create index idx_audio_item_id on public.audio (item_id);
insert into storage.buckets (id, name, public) values ('audio','audio',false);
```

**Table RLS** — copy the four `create_photos.sql:26-69` policies (admin all + specialist select/insert/delete via `items i join sessions s` ownership), s/photos/audio/.

**Storage RLS — use the COLUMN-SCOPED form from `20260528000002` (NOT the buggy `20260527000001` form).** Critical idiom (`20260528000002:21-31`):
```sql
create policy "Specialists read own audio objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]  -- FULLY QUALIFIED
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
```
Create all four scoped policies (select / insert-with-check / update-using+with-check / **delete** — D-04 needs delete) plus the admin "full access to audio objects" policy (mirror `20260527000001:21-25`). The `update` policy is required because `storage.upload({ upsert: true })` issues an UPDATE on retry (see analog comment `20260527000001:55-56`).

**pg_cron + pg_net** (NO in-repo analog — net-new; CITED from RESEARCH `pg_cron` docs):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- select cron.schedule('purge-old-audio','0 3 * * *', $$ ... pg_net.http_post(edge fn) ... $$);
```

**Process gate:** RLS/migration is Claude-owned (D-046) — mandatory Codex adversarial review before `supabase db push`. After push, regen `src/db/database.types.ts` via `npm run db:types` so `supabase.from("audio")` typechecks.

---

### `supabase/functions/purge-audio/index.ts` (NEW — edge function, service-role file-I/O)

**Analog:** `supabase/functions/admin-update-user/index.ts` + `_shared/admin-client.ts`. This is the D-08 service-role `storage.remove()` reaper invoked by the pg_cron sweep (Postgres can't delete S3 binaries; `DELETE FROM storage.objects` orphans them).

**Service-role client** (`_shared/admin-client.ts:3-8` verbatim):
```typescript
export function createAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}
```

**Handler skeleton** (analog `admin-update-user/index.ts:5-30`) — delta: gate on a service/cron secret instead of `verifyAdmin` (this is server-to-server, not a user admin call), then:
```typescript
const supabaseAdmin = createAdminClient()
// select expired/orphaned audio rows, then:
await supabaseAdmin.storage.from('audio').remove(paths)
// then delete the metadata rows
```
Keep the `Deno.serve` + CORS-OPTIONS preamble (analog lines 5-9) and JSON error/response shape (analog lines 16-19, 80-83).

---

### `src/db/types.ts` (MODIFIED — model)

**Analog:** existing `PhotoUploadEntry` (`types.ts:100-112`) for the new `AudioUploadEntry`.

- Extend `ItemAudio` (`types.ts:65-73`): add `sessionId?: string` (NEW — see prominent issue below), optionally `storagePath?: string` / `uploadStatus?`.
- Add `AudioUploadEntry` mirroring `PhotoUploadEntry` **minus** `thumbnailPath`/`sortOrder`, **plus** `ext: string`:
```typescript
export interface AudioUploadEntry {
  id?: number;
  dexieAudioId: number;
  itemId: string;
  sessionId: string;
  ext: string;
  storagePath: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  createdAt: Date;
  lastAttemptAt?: Date;
}
```

---

### `src/db/index.ts` (MODIFIED — Dexie schema)

**Analog:** v8 added `photoUploadQueue` (`index.ts:106-116`); v9 added `sessionAudio` (`index.ts:119-130`). Add **v10** copying the full v9 store set unchanged + the new table, and register the EntityTable type at `index.ts:15-26`:
```typescript
db.version(10).stores({
  // ...all v9 stores verbatim...
  audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt",  // mirrors photoUploadQueue index (line 129)
});
```

---

### `src/services/gemini.ts` — `processAudioWithAi` (MODIFIED — Storage fallback)

**Analog:** `usePhotoUrl.ts:18-35` (Storage read-fallback when local blob absent).

Seam is `gemini.ts:190-202`. Today `db.audio.get(audioId)` throws if missing (line 191-193). Add the cross-device fallback before `blobToBase64` (line 202):
```typescript
let blob = (await db.audio.get(audioId))?.blob;
if (!blob) {
  const { data: row } = await supabase.from("audio")
    .select("storage_path").eq("item_id", itemId).maybeSingle(); // resolve by item_id, NOT integer audioId
  if (!row) throw new Error(`Audio for ${itemId} not in Dexie or Storage`);
  const { data: dl } = await supabase.storage.from("audio").download(row.storage_path);
  if (!dl) throw new Error(`Storage blob missing for ${row.storage_path}`);
  blob = dl; // CONTEXT discretion: optionally re-cache into Dexie here
}
const base64Audio = await blobToBase64(blob);
```
Keep the existing `mimeType.split(";")[0]` content-type strip (`gemini.ts:225`). **Note the keying problem below** — fallback must resolve by `item_id` UUID, not the local integer `audioId`.

---

### `src/db/audioLookup.ts` (MODIFIED — union helper)

**Analog:** self. `audioRecordsForItem` (`audioLookup.ts:13-20`) already unions byUuid + byLegacy Dexie rows. Extend (don't replace) to also include Supabase `audio` rows for the item (so cross-device audio shows up in ItemCard). Preserve the dedupe-by-id `seen` Set pattern (lines 18-19). The DAT-7 comment (lines 5-12) already documents the UUID-vs-legacy-int reality — keep it.

---

### `src/hooks/useAudioRecorder.ts` (MODIFIED — enqueue on add)

**Analog:** `PhotoCapture.tsx:130-136` (fire-and-forget enqueue after `db.photos.add`).

Seam is `useAudioRecorder.ts:180-205` (the `onstop` handler). `sessionIdRef` ALREADY exists (`useAudioRecorder.ts:43`, set at line 139) — it's just never written onto the audio row or passed to upload. Two deltas:
1. Persist `sessionId` on the Dexie audio row at the `db.audio.add` call (`useAudioRecorder.ts:187-194`) — add `sessionId: sessionIdRef.current`.
2. After the add resolves (after line 194), enqueue exactly like `PhotoCapture.tsx:131-136`:
```typescript
const ext = extFromMime(detectedMimeTypeRef.current); // derive, NOT hardcoded ".opus"
enqueueAudioUpload({
  dexieAudioId: id as number,
  itemId: itemIdRef.current,  // UUID string (do NOT use the `as unknown as number` coercion from line 188)
  sessionId: sessionIdRef.current,
  ext,
}).then(() => drainAudioQueue()).catch(() => {});
```
AI trigger in `RecordButton.tsx:23` stays unchanged (D-05 parallel/immediate).

---

### `src/stores/sessionStore.ts` — `deleteItem` (MODIFIED — D-04 orphan cleanup)

**Analog:** self (`sessionStore.ts:492-537`); the `storage.remove()` call has **NO in-repo analog** (photos never delete binaries — that's the leak D-04 closes for audio).

Before the existing `supabase.from("items").delete()` (`sessionStore.ts:506-510`), add:
```typescript
const { data: rows } = await supabase.from("audio").select("storage_path").eq("item_id", itemId);
if (rows?.length) {
  await supabase.storage.from("audio").remove(rows.map(r => r.storage_path));
}
```
The FK `ON DELETE CASCADE` (audio→items) still drops the metadata row; this adds the binary removal. pg_cron orphan sweep (purge-audio edge fn) is the backstop for delete paths that bypass `deleteItem`. Keep the existing optimistic-delete + revert + trackEvent structure (lines 496-536) intact.

---

### `src/components/ItemCard.tsx` (MODIFIED — D-06 status pill + retry)

**Analog:** `PhotoCapture.tsx:33,38` (status hook + failed→retry click).

ItemCard already computes `latestAudioId` via `audioRecordsForItem` (`ItemCard.tsx:48-62`) and has a `handleRetryAi` pattern (`ItemCard.tsx:63-72`). Wire the upload pill the photo way:
```typescript
const uploadStatus = useAudioUploadStatus(latestAudioId ?? undefined);
// render pending/uploaded/failed pill; on "failed":
onClick={() => uploadStatus === "failed" ? retryFailedUploads() : ...}
```
`retryFailedUploads` comes from the new `audioUploadQueue.ts` (analog `photoUploadQueue.ts:168-185`), imported alongside it like `PhotoCapture.tsx:7`.

---

### `items.completed_at` (D-07) — NEW column migration + write-path

**Analog (write-path):** `gemini.ts:314-317` — the single-item AI-done write, the only in-scope terminal-state seam.

`items` has no completion timestamp today (only `created_at`) — this is RESEARCH gap A1, resolved by D-07. Add `alter table public.items add column completed_at timestamptz;` (own migration or folded into the audio migration). Set it wherever `ai_status: "done"` is written:
- **In scope:** `gemini.ts:315-317` — add `completed_at: new Date().toISOString()` to the `supabaseUpdate` object.
- **Out of scope (D-050 continuous gated off):** `geminiContinuous.ts:212` and `continuousModeStore.ts:118` — note but do not wire unless continuous is re-enabled.

The D-03 30-day purge clock (pg_cron) keys off `items.completed_at`, NOT `created_at` or `ai_status` record-time.

---

### `src/tests/audio-*.test.ts` (NEW + extend — test)

**Analog:** `src/tests/photo-upload-queue.test.ts` (mock structure clone) + extend `src/tests/audio-lookup.test.ts`.

Clone the `vi.hoisted` mock harness (`photo-upload-queue.test.ts:4-59`): `mockStorageFrom/Upload`, `mockSupabaseFrom/Upsert`, and the Dexie table mock (swap `photoUploadQueue`/`photos` → `audioUploadQueue`/`audio`). Reuse `setupWhereChain` (lines 61-70) for the drain query. New files per RESEARCH Wave 0: `audio-upload-queue.test.ts`, `audio-upload-status.test.ts`, `audio-storage-fallback.test.ts`, `item-card-audio-status.test.tsx`; extend `audio-lookup.test.ts`.

## Shared Patterns

### Session-scoped Storage RLS (column-qualified)
**Source:** `supabase/migrations/20260528000002_fix_sec4_photo_policy_column_scope.sql:21-31`
**Apply to:** every `storage.objects` policy in the audio migration.
Always write `storage.foldername(storage.objects.name)` — never bare `name`. Inside `from public.sessions s`, an unqualified `name` binds to `s.name` (session label), `foldername` returns `[]`, and the policy silently denies the owner. This is the Phase 31 photo bug; bake the fix in from line one.

### DAT-5 idempotent metadata upsert
**Source:** `photoUploadQueue.ts:89-99`
**Apply to:** the audio metadata write in `processOneUpload`.
`upsert({...}, { onConflict: "storage_path", ignoreDuplicates: true })` + a unique index on `storage_path` — a retry can't create a duplicate row.

### Fire-and-forget enqueue after Dexie add
**Source:** `PhotoCapture.tsx:130-136`
**Apply to:** `useAudioRecorder.onstop`.
`enqueue(...).then(() => drain()).catch(() => {})` — never block AI processing (D-05).

### Storage read-fallback when local blob absent
**Source:** `usePhotoUrl.ts:18-35`
**Apply to:** `processAudioWithAi` cross-device fallback.
Prefer local blob; fall back to Storage. (Photos uses `createSignedUrl`; audio uses `storage.download` to get a blob for base64.)

### Service-role edge function
**Source:** `supabase/functions/_shared/admin-client.ts` + `admin-update-user/index.ts:5-30`
**Apply to:** the purge-audio edge function.
`createAdminClient()` (service-role key) + `Deno.serve` + CORS-OPTIONS + JSON error envelope.

### Dexie version-bump precedent
**Source:** `db/index.ts:106-130` (v8 `photoUploadQueue`, v9 `sessionAudio`)
**Apply to:** the v10 `audioUploadQueue` bump.
Copy the entire prior version's store set unchanged; append the one new table.

## Prominent Issues to Flag for Planner

1. **`ItemAudio.itemId` UUID-vs-legacy-int coercion.** The recorder stores `itemId` via `as unknown as number` (`useAudioRecorder.ts:188`), and `audioLookup.ts:13-20` (DAT-7) has to query both UUID and mapped-legacy-int forms because the column is stored inconsistently. The Supabase `audio.item_id` column and the storage path MUST use the stable **UUID** (`itemIdRef.current` directly, as `PhotoCapture.tsx:133` does — "Always use Supabase UUID, not dexieItemId"). The metadata insert and the cross-device fallback must key on the UUID `item_id`, never the local integer. Do NOT propagate the `as unknown as number` coercion into the upload path.

2. **Audio rows have no `sessionId` today.** `ItemAudio` (`types.ts:65-73`) carries `itemId` + `itemType` but no `sessionId`. The recorder already holds it in `sessionIdRef` (`useAudioRecorder.ts:43,139`) but never writes it onto the row. RLS path token `[2]` = `sessionId` (D-02), so the upload path is blocked without it. Thread `sessionIdRef.current` onto both the Dexie row and `enqueueAudioUpload`.

3. **Cross-device `audioId` keying.** `processAudioWithAi(audioId, ...)` takes a Dexie **integer** id that won't exist on a second device. The Storage fallback must resolve the row by `item_id` (UUID), not by integer `audioId` (RESEARCH Pitfall 4 / Open Q2).

4. **Mime/extension drift.** Recorder runtime-detects mime (`detectedMimeTypeRef`, prefers `audio/webm;codecs=opus`, Safari falls back to mp4). Derive `ext` and `contentType` from the actual blob mime — never hardcode `.opus` (RESEARCH Pitfall 5).

5. **No `storage.remove()` anywhere in the repo.** Photos never delete binaries — confirmed zero deletion calls. `DELETE FROM storage.objects` orphans the S3 binary. The D-04 client `.remove()` in `deleteItem` and the D-08 service-role edge reaper are both net-new; there is no in-repo deletion analog to copy.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| pg_cron / pg_net extension enablement in migration | migration | scheduled | No migration in this repo enables either extension (RESEARCH A2 — availability unverified live) |
| `supabase.storage.remove()` deletion logic | service/edge | file-I/O | No deletion call exists anywhere in the codebase (the photo leak); use RESEARCH `storage.remove` / pg_net pattern, not a local analog |

## Metadata

**Analog search scope:** `src/services/`, `src/hooks/`, `src/db/`, `src/components/`, `src/stores/`, `supabase/migrations/`, `supabase/functions/`, `src/tests/`
**Files read:** 16
**Pattern extraction date:** 2026-06-01

## PATTERN MAPPING COMPLETE

**Phase:** 32 - audio-blob-supabase-persistence
**Files classified:** 13 + 1 edge function
**Analogs found:** 12 / 13

### Coverage
- Files with exact analog: 7 (audioUploadQueue, useAudioUploadStatus, migration RLS+table, types, Dexie bump, audioLookup, tests)
- Files with role-match analog: 4 (edge fn, gemini fallback, recorder enqueue, ItemCard pill)
- Files with partial / no analog: 2 (deleteItem `storage.remove`, completed_at write-path) + pg_cron/pg_net (no analog)

### Key Patterns Identified
- Client surface is a verbatim photo clone: `photoUploadQueue.ts` (constants 6-10, enqueue 16-34, processOne 47-138, drain 145-190) and `usePhotoUploadStatus.ts` map 1:1 to audio with the thumbnail dropped and `ext`/`sessionId` added.
- Storage RLS MUST use the column-qualified `storage.foldername(storage.objects.name)` from `20260528000002` (the Phase 31 fix), not the buggy unqualified form — baked into the first audio migration.
- Two genuinely novel mechanisms have no in-repo analog: pg_cron/pg_net retention and any `storage.remove()` deletion (the photo orphan leak D-04 closes for audio).

### File Created
`.planning/milestones/v1.3-phases/32-audio-blob-supabase-persistence/32-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog file:line per plan action. Flag the four threading issues (UUID-vs-int itemId, missing sessionId, cross-device audioId keying, mime/ext) early in the upload/recorder plans.
