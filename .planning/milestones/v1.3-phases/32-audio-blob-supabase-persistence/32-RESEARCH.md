# Phase 32: audio-blob-supabase-persistence - Research

**Researched:** 2026-06-01
**Domain:** Supabase Storage durability + RLS scoping, Dexie upload-queue mirroring, pg_cron retention, cross-device AI fallback
**Confidence:** HIGH (codebase-verified; pg_cron mechanism CITED from Supabase docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Mirror the photos pattern **fully**. Add (a) a new Supabase `audio` metadata table — `storage_path`, `upload_status`, FK to `items` `ON DELETE CASCADE`, session/owner columns needed for RLS path-scoping — and (b) a new Dexie `audioUploadQueue` table that reuses the existing photo drain/retry engine.
- **D-02:** Bucket name `audio`; storage path `audio/{sessionId}/{itemId}/{audioId}.<ext>` where `<ext>` follows the recorded blob's natural mime (webm/opus preferred; NOT a hardcoded `.opus`). RLS scopes on path token `[2]` = `sessionId` matched to `sessions.created_by`/`assigned_to`, fully qualifying `storage.objects.name` per the column-scope fix.
- **D-03:** Retain Storage blobs **30 days after the item reaches `done`**, then purge via a **pg_cron scheduled sweep**.
- **D-04:** On item **hard-delete**, delete the Storage blob too — close the storage-orphan gap photos currently have. Planner decides mechanism (trigger/Edge/cron-sweep).
- **D-05:** AI processing stays **immediate from the local Dexie blob**; Storage upload runs **in parallel in background**, `processAudioWithAi` NOT blocked on upload. Reuse photo retry defaults (concurrency 2, `4^retryCount * 1000ms` backoff, max 3). Storage is fallback source only when local blob is gone.
- **D-06:** Surface `pending / uploaded / failed` on **ItemCard**, reusing the `usePhotoUploadStatus` pattern (`useAudioUploadStatus` analog). On `failed`, show a manual retry button that re-enqueues the upload.

### Claude's Discretion
- Exact Supabase `audio` table column set + migration filename/timestamp.
- Whether orphan blob deletion on hard-delete is a DB trigger, Edge function, or folded into the pg_cron sweep.
- Dexie schema version bump + index for `audioUploadQueue` (follow photo queue v8 precedent).
- Storage-fallback hydration detail in `processAudioWithAi` (download → blob → base64; whether to re-cache into Dexie after a Storage fetch).
- Exact pg_cron schedule cadence.

### Deferred Ideas (OUT OF SCOPE)
- Continuous / session master-blob persistence (`sessionAudio`) — gated off via D-050.
- Backfilling the photo storage-orphan cleanup — audio-only this phase.
- PERF-1 (base64 memory) / PERF-2 (continuous blob streaming) — separate phases.
- REL-4 `stopRecording` settle-on-reject hang — Phase 33.
</user_constraints>

## Summary

This is a "mirror the photos pattern" phase with a decision-rich CONTEXT — the WHAT is locked, the research surfaces the HOW. Every needed primitive already exists in the codebase: the photo upload-queue engine, the SEC-4 session-scoped Storage RLS (with the Phase-31-class column-scope fix), the `usePhotoUploadStatus` hook, the signed-URL read pattern, and a clean Dexie schema-version-bump precedent (v8 added `photoUploadQueue`). The audio work is largely a structural copy of these with five real deltas: (1) audio rows carry **no `sessionId`** today — it must be threaded from the recorder; (2) the storage extension must follow the **runtime-detected mime**, not a hardcoded `.opus`; (3) `processAudioWithAi` needs a **Storage→blob→base64 fallback** when the Dexie blob is missing; (4) the `audio` metadata-table RLS must bake in the column-scope fix **from the first migration**; (5) two net-new server mechanisms — **pg_cron retention** and **Storage-object hard-delete** — neither of which exists in this project yet.

The two genuinely new and highest-risk areas are the server-side cleanup mechanisms. **pg_cron is not yet enabled** in this project (no `create extension`/`cron.schedule` in any migration) and **no `storage.remove()` call exists anywhere** — photos never delete their Storage objects, which is precisely the orphan leak D-04 says audio must not repeat. Critically, `DELETE FROM storage.objects` only removes the metadata row and **leaves the actual S3 binary orphaned** [CITED: github.com/GaryAustin1/supa-file-helper]; correct deletion requires the Storage REST API (via `pg_net`/`http` extension from Postgres, or an Edge function, or the client `supabase.storage.remove()`).

A scoping mismatch needs the planner's attention: D-03 says "30 days after the item reaches `done`", but `items` has **no `done` lifecycle column** — the only `done` in the schema is `items.ai_status = 'done'`. The retention query almost certainly keys on `ai_status='done'` plus a timestamp; flag this for confirmation (see Assumptions Log A1).

**Primary recommendation:** Structurally clone `photoUploadQueue.ts` → `audioUploadQueue.ts`, `usePhotoUploadStatus.ts` → `useAudioUploadStatus.ts`, and the two SEC-4 photo migrations → one consolidated `audio` migration with the column-qualified RLS baked in. For D-04 hard-delete cleanup, prefer **client-side `supabase.storage.from('audio').remove([paths])` in `deleteItem`** (simplest, reuses the existing authenticated session and the new delete RLS policy) with the pg_cron sweep as the orphan backstop. For D-03 retention, enable pg_cron + `pg_net` and have the cron job call the Storage REST API to delete blobs for items `done` > 30 days.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Background blob upload to Storage | Browser / Client | API (RLS gate) | Mirrors photos; client drains a Dexie queue, RLS authorizes |
| Audio metadata row (audit / cross-device) | Database | Client (writes via PostgREST) | Supabase `audio` table is the cross-device source of truth |
| Storage object authorization | Database (RLS on `storage.objects`) | — | anon key is public (D-003); RLS + grants are the only boundary |
| AI processing (immediate) | Client → Edge proxy | — | Reads local Dexie blob, posts to Gemini proxy (unchanged) |
| Cross-device AI fallback (blob missing) | Client (Storage read) | Database (signed URL / RLS) | `processAudioWithAi` downloads from Storage when Dexie blob absent |
| 30-day retention purge | Database (pg_cron + pg_net) | — | Scheduled server-side sweep; no client involvement |
| Hard-delete orphan cleanup | Client (`storage.remove`) OR Database (trigger+pg_net) | Database (cron backstop) | Metadata cascades via FK; the binary must be explicitly removed |
| Upload-status UI | Browser / Client | — | Reactive Dexie live-query on the queue table |

## Standard Stack

No new npm packages required. Everything uses the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | (installed) | Storage upload/download/remove, PostgREST writes | Already the client singleton (`src/lib/supabase.ts`) |
| `dexie` | (installed) | `audioUploadQueue` table + live-query status | Already used for `photoUploadQueue` |
| `dexie-react-hooks` | (installed) | `useLiveQuery` for `useAudioUploadStatus` | Pattern proven in `usePhotoUploadStatus.ts` |
| `vitest` | ^4.0.18 | unit tests | Project test runner (`npm test`) |
| `@playwright/test` | ^1.60.0 | e2e (cross-device) | Already present; e2e under `tests/e2e/` |

### Supporting (server-side, new to this project)
| Extension | Purpose | When to Use |
|-----------|---------|-------------|
| `pg_cron` | Schedule the 30-day retention sweep | D-03 — required |
| `pg_net` | Async HTTP from Postgres to the Storage REST API (correct object deletion) | D-03/D-04 if deletion is server-driven |

**Installation (server):**
```sql
-- In the new migration. Supabase pre-provisions these; enable in the `extensions` schema.
create extension if not exists pg_cron;
create extension if not exists pg_net;
```
[CITED: supabase.com/docs/guides/database/extensions/pg_cron] — enable via Dashboard → Database → Extensions or `create extension if not exists pg_cron;`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron + pg_net REST delete | Edge function on a cron trigger | Edge fn is more code + a new deploy surface; project already has Edge fns (`admin-*`) so it's viable, but pg_cron-only keeps it in-DB |
| Client `storage.remove()` on hard-delete | DB trigger + pg_net REST delete | Trigger fires even on server/admin deletes (more robust) but adds pg_net dependency to the delete path; client-side is simpler and reuses the user's session |
| `DELETE FROM storage.objects` in cron | Storage REST API delete | **Raw DELETE leaves the S3 binary orphaned** [CITED] — do NOT use it as the deletion mechanism |

## Package Legitimacy Audit

No external packages installed this phase (all dependencies pre-existing). pg_cron and pg_net are first-party Supabase/Postgres extensions, not registry packages — no slopcheck applicable. **Disposition: N/A — no new package installs.**

## Architecture Patterns

### System Architecture Diagram

```
                    RECORDING DEVICE (device A)
  ┌──────────────────────────────────────────────────────────────┐
  │ useAudioRecorder.onstop                                        │
  │   db.audio.add({itemId, sessionId*, blob, mimeType, ...})      │   *NEW: thread sessionId
  │        │                          │                            │
  │        │ (D-05 parallel)          │ (D-05 parallel)            │
  │        ▼                          ▼                            │
  │  processAudioWithAi        enqueueAudioUpload(...)             │
  │   reads LOCAL blob          → db.audioUploadQueue.add(pending) │
  │   → base64 → Gemini         → drainAudioQueue()               │
  │   proxy (Edge)                    │                            │
  └───────────────────────────────────┼────────────────────────────┘
                                       │ supabase.storage.from('audio').upload(path, blob)
                                       │ + supabase.from('audio').upsert(metadata)
                                       ▼
            ┌─────────────────── SUPABASE ───────────────────────┐
            │  storage.objects (bucket 'audio')  ← RLS: sessionId │
            │     path = audio/{sessionId}/{itemId}/{audioId}.ext │   path token [2] = sessionId
            │  public.audio (metadata, FK→items ON DELETE CASCADE)│
            └──────────────────────────┬──────────────────────────┘
                                       │ signed URL / download
                    RETRY DEVICE (device B, no local blob)
  ┌────────────────────────────────────┼────────────────────────────┐
  │ processAudioWithAi: db.audio.get → MISSING                       │
  │   → fallback: supabase.storage.from('audio').download(path)      │
  │   → blob → base64 → Gemini  (optionally re-cache into Dexie)     │
  └───────────────────────────────────────────────────────────────┘

  CLEANUP PATHS
  ─ hard-delete (deleteItem):  items DELETE → FK cascade drops audio row;
       client storage.remove([paths])  ← D-04: also remove the binary
  ─ retention (pg_cron):  daily sweep → items ai_status='done' AND done>30d
       → pg_net DELETE to Storage REST API  ← D-03
  ─ orphan backstop (pg_cron):  reap storage.objects with no audio metadata row
```

### Recommended File Structure (new/changed)
```
src/
├── services/
│   └── audioUploadQueue.ts        # NEW — clone of photoUploadQueue.ts
├── hooks/
│   ├── useAudioUploadStatus.ts    # NEW — clone of usePhotoUploadStatus.ts
│   └── useAudioRecorder.ts        # CHANGE — thread sessionId, enqueue on add
├── services/
│   └── gemini.ts                  # CHANGE — Storage fallback in processAudioWithAi
├── db/
│   ├── types.ts                   # CHANGE — ItemAudio gains sessionId; new AudioUploadEntry
│   ├── index.ts                   # CHANGE — v10 adds audioUploadQueue table
│   └── audioLookup.ts             # CHANGE — union Supabase audio rows
├── stores/
│   └── sessionStore.ts            # CHANGE — deleteItem removes Storage blob (D-04)
├── components/
│   └── ItemCard.tsx               # CHANGE — upload-status pill + retry (D-06)
supabase/migrations/
└── <ts>_create_audio.sql          # NEW — table + bucket + RLS (column-scoped) + pg_cron
```

### Pattern 1: Mirror the photo upload queue (D-01, D-05)
**What:** Copy `src/services/photoUploadQueue.ts` near-verbatim. Same constants (`CONCURRENCY=2`, `MAX_RETRIES=3`, `BACKOFF_BASE=1000` giving `4^n*1000` = 1s/4s/16s), same `draining` mutex, same `navigator.onLine` pause, same `Promise.allSettled` batching.
**When to use:** This is the locked D-05 retry contract.
**Example (the enqueue, adapted):**
```typescript
// Source: src/services/photoUploadQueue.ts:16-34 (verified pattern)
export async function enqueueAudioUpload(params: {
  dexieAudioId: number;
  itemId: string;       // Supabase UUID, NOT the legacy int
  sessionId: string;    // NEW — needed for RLS path token [2]
  ext: string;          // derived from blob mime, NOT hardcoded
}): Promise<void> {
  const { dexieAudioId, itemId, sessionId, ext } = params;
  await db.audioUploadQueue.add({
    dexieAudioId, itemId, sessionId,
    storagePath: `audio/${sessionId}/${itemId}/${dexieAudioId}.${ext}`,
    status: "pending", retryCount: 0, createdAt: new Date(),
  });
}
```
The `processOneUpload` analog uploads ONE blob (no thumbnail), with `contentType: audioRecord.mimeType`, then upserts the `audio` metadata row `{ item_id, storage_path, upload_status: 'uploaded' }` with `onConflict: 'storage_path', ignoreDuplicates: true` (DAT-5 idempotency — add the unique index on `audio.storage_path` like `photos_storage_path_key`).

### Pattern 2: Enqueue on add, fire-and-forget (D-05)
**What:** In `useAudioRecorder.onstop` (currently `src/hooks/useAudioRecorder.ts:180-205`), after `db.audio.add(...)`, call `enqueueAudioUpload(...).then(() => drainAudioQueue()).catch(() => {})` — exactly how `PhotoCapture.tsx:131-136` does it. AI processing in `RecordButton.tsx:23` stays unchanged (parallel, immediate).
**When to use:** The locked D-05 ordering — never block AI on upload.

### Pattern 3: Storage fallback in processAudioWithAi (cross-device, D-05)
**What:** At `src/services/gemini.ts:190-202`, `db.audio.get(audioId)` may return undefined on a device that never recorded this item. Add a fallback: look up the metadata row's `storage_path` (by `audioId`/`itemId`), `supabase.storage.from('audio').download(path)`, then feed that blob to `blobToBase64`.
**Example:**
```typescript
// Source seam: src/services/gemini.ts:190-202 (verified)
let blob = (await db.audio.get(audioId))?.blob;
if (!blob) {
  const { data: row } = await supabase.from("audio")
    .select("storage_path, mime_type").eq("id", audioId).maybeSingle();
  if (!row) throw new Error(`Audio ${audioId} not in Dexie or Storage`);
  const { data: dl } = await supabase.storage.from("audio").download(row.storage_path);
  if (!dl) throw new Error(`Storage blob missing for ${row.storage_path}`);
  blob = dl;
  // discretion (CONTEXT): optionally re-cache into Dexie here
}
const base64Audio = await blobToBase64(blob);
```
**Note:** `processAudioWithAi(audioId, itemId, sessionId)` is keyed by the Dexie **integer** `audioId`. On a cross-device retry the integer id won't exist locally — the planner must decide whether the fallback path keys on `audioId` looked up in the Supabase `audio` table by `item_id` instead. This is a real threading question (see Open Questions).

### Pattern 4: Session-scoped Storage RLS with the column-scope fix baked in (D-02)
**What:** The `audio`-bucket `storage.objects` policies must use the **fully-qualified** `storage.objects.name` from day one (the bug Phase 31's photo follow-up fixed — unqualified `name` inside `from public.sessions s` binds to `s.name`, the session label, not the file path, so foldername returns `[]` and the policy always denies).
**Example (the corrected idiom — verified from `20260528000002`):**
```sql
-- Source: supabase/migrations/20260528000002_fix_sec4_photo_policy_column_scope.sql:21-31
create policy "Specialists read own audio objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]  -- fully qualified
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
```
Need the same shape for `select`, `insert` (with check), `update` (using + with check — upsert UPDATEs an existing object), and `delete` (D-04 needs delete). Plus an admin "full access to audio objects" policy mirroring `20260527000001:21-25`.

### Anti-Patterns to Avoid
- **`DELETE FROM storage.objects` as the deletion mechanism** — removes the metadata row but **leaves the S3 binary orphaned** [CITED: GaryAustin1/supa-file-helper]. This is exactly the photo leak. Use `supabase.storage.remove()` (client) or the Storage REST API via pg_net (server).
- **Hardcoding `.opus`** — the recorder runtime-detects mime (`getPreferredMimeType` prefers `audio/webm;codecs=opus`, falls back to mp4/ogg). Derive the extension from the actual blob mime.
- **Unqualified `name` in the RLS subquery** — the Phase 31 photo bug; the new audio RLS must avoid it from the start.
- **Keying the metadata insert on the Dexie integer id** — `item_id` in the `audio` table must be the Supabase UUID, never the legacy int (see `PhotoCapture.tsx:133` comment "Always use Supabase UUID, not dexieItemId").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upload retry/backoff/concurrency | Custom retry loop | Clone `photoUploadQueue.ts` | Proven mutex + offline-pause + `4^n` backoff (D-05 locked) |
| Reactive status pill | Manual state subscription | Clone `usePhotoUploadStatus.ts` (`useLiveQuery`) | Reactive Dexie query already solved |
| Signed-URL/blob read fallback | Custom fetch | `usePhotoUrl.ts` pattern (`createSignedUrl`) / `storage.download` | Race-safe blob-vs-signed-URL precedent |
| Storage object deletion | `DELETE FROM storage.objects` | `supabase.storage.remove()` / pg_net REST | Raw DELETE orphans the binary |
| Idempotent retry inserts | Dedup logic | unique index on `storage_path` + `upsert ignoreDuplicates` | DAT-5 precedent (`photos_storage_path_key`) |

**Key insight:** The entire client-side surface of this phase is a structural copy of existing, tested photo code. The only genuinely novel engineering is the two server-side cleanup mechanisms (pg_cron retention + correct Storage-object deletion).

## Runtime State Inventory

This is an additive feature phase, not a rename/refactor — but two existing-data realities matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing Dexie `db.audio` rows have **no `sessionId`** and an `itemId` that may be UUID-string OR legacy-int (DAT-7, `audioLookup.ts:13-20`). New uploads need a stable UUID `itemId` + `sessionId`. | Code edit (thread sessionId on new recordings). A backfill of pre-existing local audio (à la `photoMigration.ts`) is **optional** — flag to planner whether existing local-only audio should be uploaded (Open Q3). |
| Live service config | No pg_cron jobs, no Storage buckets named `audio` exist yet. | Migration creates bucket + cron job. |
| OS-registered state | None — verified, this is web-app + Supabase only. | None |
| Secrets/env vars | pg_net Storage REST calls need a service-role key / project URL available to the cron job. Edge functions already use `_shared` secrets. | If server-side deletion chosen, store service-role key for pg_net (or use the Edge-function route which already has it). |
| Build artifacts | After the migration, regen `src/db/database.types.ts` via `npm run db:types` (the `audio` table must appear in generated types for `supabase.from('audio')` to typecheck). | Run `npm run db:types` post-migration. |

## Common Pitfalls

### Pitfall 1: RLS column-scope collision (the Phase 31 photo bug)
**What goes wrong:** Unqualified `name` inside `from public.sessions s` binds to `s.name`; `storage.foldername('Test')` → `[]`; `[2]` is null; policy denies for everyone including the owner.
**Why it happens:** Postgres prefers the inner table's column when the name is ambiguous.
**How to avoid:** Always write `storage.foldername(storage.objects.name)`. Caught in photos during UAT 2026-05-28 (`20260528000002` header).
**Warning signs:** Owner can't upload/read their own blobs; uploads 403 despite correct path.

### Pitfall 2: Orphaned S3 binaries (the photo leak D-04 must not repeat)
**What goes wrong:** FK `ON DELETE CASCADE` drops the `audio` metadata row, but the Storage binary persists forever. Confirmed: `grep` for `storage.*remove`/`storage.*delete` finds **zero** deletion calls in app code — photos never clean up.
**Why it happens:** Storage objects live in S3, not Postgres; the FK cascade only touches `public.*` and `storage.objects` rows it references — and nothing references the binary.
**How to avoid:** Explicitly `supabase.storage.from('audio').remove([paths])` on hard-delete, plus a pg_cron orphan backstop.
**Warning signs:** Storage usage grows monotonically; `storage.objects` rows with no matching `audio` row.

### Pitfall 3: `done` lifecycle mismatch
**What goes wrong:** D-03 says "30 days after the item reaches `done`" but `items` has no `done` status column; the only `done` is `ai_status='done'`. A retention query against a nonexistent column silently matches nothing (or errors).
**Why it happens:** "done" is an informal term; the schema models per-item completion via `ai_status`.
**How to avoid:** Confirm the retention key is `items.ai_status='done'` and add the timestamp the 30-day window measures from (there is **no `done_at`/`updated_at` on items** — `items` only has `created_at`). The planner likely needs a new `audio.done_at` or to add an item-completion timestamp. **This is a schema gap, not just a query.** (Assumption A1.)
**Warning signs:** Cron job deletes nothing, or deletes too aggressively from `created_at`.

### Pitfall 4: Cross-device audioId keying
**What goes wrong:** `processAudioWithAi(audioId, ...)` uses a Dexie **integer** id that doesn't exist on a second device.
**How to avoid:** On the fallback path, resolve the audio by `item_id` in the Supabase `audio` table, not by the local integer id.

### Pitfall 5: Mime/extension drift
**What goes wrong:** Hardcoded `.opus` while the blob is actually `audio/mp4` (Safari) → wrong content-type, broken playback/AI.
**How to avoid:** Derive `ext` and `contentType` from `audioRecord.mimeType` (strip `;codecs=...` for content-type as `gemini.ts:225` already does).

## Code Examples

### Dexie schema bump (follow v8/v9 precedent)
```typescript
// Source: src/db/index.ts:106-130 (v8 added photoUploadQueue, v9 added sessionAudio).
// Add v10:
db.version(10).stores({
  // ...all v9 stores unchanged...
  audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt",
});
```
`ItemAudio` (`src/db/types.ts:65-73`) gains `sessionId?: string` and optionally `storagePath?: string` / `uploadStatus?`. New `AudioUploadEntry` interface mirrors `PhotoUploadEntry` (`types.ts:100-112`) minus `thumbnailPath`/`sortOrder`, plus `ext`.

### pg_cron retention sweep (D-03)
```sql
-- Source pattern: CITED supabase.com/docs/guides/database/extensions/pg_cron
-- Daily at 03:00 UTC. Deletes audio for items done > 30 days.
-- NOTE: requires an item-completion timestamp (see Pitfall 3 / A1).
select cron.schedule(
  'purge-old-audio',
  '0 3 * * *',
  $$
    -- For each expired row: call Storage REST DELETE via pg_net, THEN drop metadata.
    -- (raw DELETE FROM storage.objects would orphan the binary)
    -- ... pg_net.http_delete(...) per storage_path ...
  $$
);
```

### Hard-delete cleanup in deleteItem (D-04, recommended client-side)
```typescript
// Source seam: src/stores/sessionStore.ts:492-537 (deleteItem)
// Before the items DELETE (or after, since cascade only drops metadata):
const { data: rows } = await supabase.from("audio")
  .select("storage_path").eq("item_id", itemId);
if (rows?.length) {
  await supabase.storage.from("audio").remove(rows.map(r => r.storage_path));
}
// then existing supabase.from("items").delete().eq("id", itemId)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Audio lives only in Dexie/IndexedDB | Durable in Supabase Storage + metadata audit row | This phase | Survives device wipe; cross-device AI retry |
| Storage objects never deleted (photo leak) | Explicit `storage.remove` + pg_cron sweep | This phase (audio only) | Storage doesn't grow unbounded |
| `DELETE FROM storage.objects` | Storage REST API via pg_net/client `.remove()` | pg_net delete-body support landed Mar 2025 [CITED] | Binaries actually freed, not orphaned |

**Deprecated/outdated:**
- Treating `DELETE FROM storage.objects` as a complete deletion — it is not; binary remains.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Item reaches `done`" (D-03) maps to `items.ai_status='done'`, and a NEW completion timestamp is required because `items` has only `created_at` (no `done_at`/`updated_at`). | Pitfalls/Retention | Retention deletes nothing or deletes from the wrong baseline; possible data loss or unbounded growth |
| A2 | pg_cron + pg_net are available to enable on this Supabase plan. | Standard Stack | Server-side deletion must fall back to an Edge-function cron trigger |
| A3 | The Dexie `db.audio.add` integer id is acceptable as `{audioId}` in the storage path. | D-02 path | If a stable UUID is preferred for the path, the queue must mint/carry one |
| A4 | Existing local-only audio rows do NOT need a one-time backfill upload this phase (new recordings only). | Runtime State | Pre-migration audio stays device-local (still loses durability) |
| A5 | Client-side `storage.remove()` in `deleteItem` is acceptable for D-04 (vs a DB trigger). | D-04 | Admin/server-path deletes that bypass `deleteItem` would still orphan; cron backstop mitigates |

## Open Questions

1. **Retention timestamp source.** `items` has no completion timestamp. Add `audio.done_marked_at`, add `items.updated_at`/`done_at`, or have the cron compute from analytics? Recommendation: add a timestamp column the cron can key on; confirm with user (A1).
2. **Cross-device fallback keying.** Should `processAudioWithAi` resolve audio by `item_id` (UUID) on the fallback path instead of the local integer `audioId`? Recommendation: yes — look up the `audio` row by `item_id`.
3. **Backfill existing local audio?** `photoMigration.ts` exists as a precedent. Out-of-scope per "new recordings only" reading, but pre-existing local audio stays non-durable. Recommendation: defer unless user wants parity (A4).
4. **Deletion mechanism for D-04.** Client `.remove()` (simple, session-scoped) vs DB trigger + pg_net (covers all delete paths). Recommendation: client-side primary + pg_cron orphan backstop.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (prod `wgrknodfxdjtddsirldw`) | All | ✓ | — | — |
| Vendored Supabase CLI | Migration push | ✓ | 2.81.3 (`node_modules/.bin/supabase`) | — |
| pg_cron extension | D-03 retention | ✗ (not enabled; no migration uses it) | — | Edge function on external cron trigger |
| pg_net extension | D-03/D-04 server-side Storage delete | ✗ (not enabled) | — | Client `.remove()` + Edge function |
| Edge functions infra | optional cleanup route | ✓ | `admin-create-user`, `admin-update-user`, `_shared` exist | — |
| `npm run db:types` | regen types post-migration | ✓ | — | — |

**Missing dependencies with no fallback:** none — pg_cron/pg_net are enable-on-demand on Supabase.
**Missing dependencies with fallback:** pg_cron/pg_net both have Edge-function/client fallbacks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (unit, jsdom) + Playwright ^1.60.0 (e2e) |
| Config file | `vite.config.ts` (test block, setup `src/tests/setup.ts`); e2e under `tests/e2e/` |
| Quick run command | `npx vitest --run src/tests/audio-upload-queue.test.ts` |
| Full suite command | `npm test` (vitest --run) |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Enqueue on `db.audio.add`; drain with concurrency 2 / `4^n` backoff / max 3 | unit (mock supabase+Dexie, mirror `photo-upload-queue.test.ts`) | `npx vitest --run src/tests/audio-upload-queue.test.ts` | ❌ Wave 0 |
| `useAudioUploadStatus` reflects pending/uploading/uploaded/failed | unit (renderHook + Dexie live query) | `npx vitest --run src/tests/audio-upload-status.test.ts` | ❌ Wave 0 |
| Storage fallback in `processAudioWithAi` when Dexie blob missing (mirror `photo-url-fallback.test.ts`) | unit (mock `storage.download`) | `npx vitest --run src/tests/audio-storage-fallback.test.ts` | ❌ Wave 0 |
| Path/extension follows runtime mime, not `.opus` | unit | `npx vitest --run src/tests/audio-upload-queue.test.ts` | ❌ Wave 0 |
| `audioRecordsForItem` unions Supabase audio | unit (extend `audio-lookup.test.ts`) | `npx vitest --run src/tests/audio-lookup.test.ts` | ✅ extend |
| `deleteItem` removes Storage blob (D-04) | unit (assert `storage.remove` called with paths) | `npx vitest --run src/tests/...` | ❌ Wave 0 |
| ItemCard shows pill + retry on failed | unit (RTL) | `npx vitest --run src/tests/item-card-audio-status.test.tsx` | ❌ Wave 0 |
| **Cross-user RLS denies blob read** (security) | RLS/SQL assertion | psql/Mgmt-API: user-B JWT `select` on user-A path → denied | ❌ manual/SQL |
| **Cross-device retry** (device A records, device B retries from Storage) | e2e/manual | Playwright two-context or manual UAT | ❌ manual |
| **Blob purged on hard-delete** (binary gone, not just metadata) | integration/manual | delete item → assert `storage.objects` row + binary gone | ❌ manual |
| pg_cron purge after 30d done | manual/SQL | invoke cron job body manually with a backdated row | ❌ manual |

### Sampling Rate
- **Per task commit:** `npx vitest --run <the touched test file>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full vitest suite green + manual RLS/cross-device/hard-delete-binary checks before `/gsd:verify-work`. **Mandatory Codex adversarial review of the migration before `supabase db push`** (D-046).

### Wave 0 Gaps
- [ ] `src/tests/audio-upload-queue.test.ts` — drain/retry/backoff/mime (clone `photo-upload-queue.test.ts`)
- [ ] `src/tests/audio-upload-status.test.ts` — status hook (clone `photo-url-fallback`/`usePhotoUploadStatus` test style)
- [ ] `src/tests/audio-storage-fallback.test.ts` — Storage download fallback
- [ ] `src/tests/item-card-audio-status.test.tsx` — pill + retry
- [ ] Extend `src/tests/audio-lookup.test.ts` for Supabase-audio union
- [ ] RLS assertion script (SQL) for cross-user denial — manual, no automated harness exists (`supabase/tests/` absent)

## Security Domain

`security_enforcement` is absent in `.planning/config.json` (= enabled). The anon key is public (D-003) — RLS + grants are the only boundary, so this section is load-bearing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase JWT; uploads/reads `to authenticated` only |
| V3 Session Management | no | Handled by supabase-js |
| V4 Access Control | **yes (critical)** | Session-scoped RLS on `storage.objects` (path token [2] = sessionId) + `audio` table RLS via item→session ownership; admin full-access policy |
| V5 Input Validation | yes | `upload_status` CHECK constraint; FK integrity; storage path derived, not user-supplied free-text |
| V6 Cryptography | no | Storage encryption is Supabase-managed; no hand-rolled crypto |

### Known Threat Patterns for Supabase Storage + shared anon key
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Specialist reads another session's audio by guessing path | Information Disclosure | Session-scoped `select` RLS on `storage.objects`, fully-qualified `name` (Pitfall 1) |
| Specialist overwrites/uploads into another session's path | Tampering | Scoped `insert`/`update` RLS with both `using` + `with check` |
| Specialist deletes another session's blob | Tampering/DoS | Scoped `delete` RLS (D-04 needs delete, but only own sessions) |
| Column-scope collision silently denies legitimate access | DoS (self-inflicted) | Phase-31 fix baked in from first migration |
| Orphaned binaries leak data after item delete | Information Disclosure / cost | D-04 explicit `storage.remove` + cron backstop |

## Sources

### Primary (HIGH confidence — codebase-verified)
- `supabase/migrations/20260320200000_create_photos.sql` — photos table + bucket + FK cascade template
- `supabase/migrations/20260527000001_scope_photos_storage_rls.sql` — SEC-4 session-scoped Storage RLS idiom
- `supabase/migrations/20260528000002_fix_sec4_photo_policy_column_scope.sql` — the column-scope fix (D-02 requires)
- `supabase/migrations/20260529000000_lock_profiles_self_update.sql` + `_workspace/Urgent/sec-profiles-self-update-escalation.md` — Phase 31 grant/column-scope discipline
- `src/services/photoUploadQueue.ts` — drain/retry engine (D-05 contract)
- `src/hooks/usePhotoUploadStatus.ts`, `src/hooks/usePhotoUrl.ts` — status + read-fallback patterns
- `src/components/PhotoCapture.tsx:120-143`, `src/services/photoMigration.ts` — enqueue trigger + backfill precedent
- `src/db/types.ts`, `src/db/index.ts`, `src/db/audioLookup.ts` — audio types, schema versions, DAT-7 union
- `src/hooks/useAudioRecorder.ts`, `src/utils/audio.ts`, `src/components/RecordButton.tsx` — recorder, mime detection, AI trigger
- `src/services/gemini.ts:130-260`, `src/services/offlineQueue.ts` — processAudioWithAi seam, blobToBase64, retry caller
- `src/stores/sessionStore.ts:492-537` — deleteItem (D-04 seam)
- `_workspace/Schema/schema.md` — items/photos schema, buckets, FK graph (no `done` column; no item completion timestamp)
- `src/tests/photo-upload-queue.test.ts`, `src/tests/photo-url-fallback.test.ts` — test patterns to clone

### Secondary (MEDIUM — official docs)
- supabase.com/docs/guides/database/extensions/pg_cron — enable + `cron.schedule` syntax [CITED]
- supabase.com/docs/guides/database/postgres/data-deletion [CITED]

### Tertiary (LOW — community, cross-checked)
- github.com/GaryAustin1/supa-file-helper — `DELETE FROM storage.objects` orphans the binary; pg_net delete-body since Mar 2025 [CITED]
- github.com/orgs/supabase/discussions/37979, /28864 — auto storage delete + scheduled record purge patterns

## Metadata

**Confidence breakdown:**
- Standard stack / client patterns: HIGH — direct verbatim photo precedents in-repo.
- RLS / column-scope: HIGH — exact fix migration read; D-02 directive explicit.
- pg_cron / Storage deletion: MEDIUM — mechanism CITED from docs but not yet present in this project; live extension availability unverified (A2).
- Retention semantics: MEDIUM-LOW — `done` mapping and missing completion timestamp is a genuine gap needing user confirmation (A1).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable codebase; pg_cron/pg_net availability should be confirmed live during planning)

## RESEARCH COMPLETE

**Phase:** 32 - audio-blob-supabase-persistence
**Confidence:** HIGH (client mirror) / MEDIUM (server cleanup)

### Key Findings
- Entire client surface is a structural clone of existing tested photo code (`photoUploadQueue`, `usePhotoUploadStatus`, `usePhotoUrl`, SEC-4 RLS). No new npm packages.
- Audio rows carry **no sessionId** today and `itemId` is UUID-or-legacy-int (DAT-7) — planner must thread `sessionId` from the recorder and use the UUID `item_id` for Storage path token [2].
- The column-scope RLS fix (Phase 31 photo bug) MUST be baked into the audio migration from the start (fully qualify `storage.objects.name`).
- **No `storage.remove()` exists anywhere** — photos never delete their binaries (the D-04 leak). `DELETE FROM storage.objects` orphans the S3 file; use client `.remove()` or pg_net REST.
- **Two genuine gaps for user confirmation:** (A1) D-03 "done" has no schema column/timestamp — `items` only has `created_at`; (A2) pg_cron/pg_net not yet enabled in this project.

### File Created
`.planning/milestones/v1.3-phases/32-audio-blob-supabase-persistence/32-RESEARCH.md`

### Ready for Planning
Research complete. Resolve Open Questions 1 (retention timestamp) and 4 (deletion mechanism) early in planning, and confirm A1/A2 with the user before locking the migration shape.
