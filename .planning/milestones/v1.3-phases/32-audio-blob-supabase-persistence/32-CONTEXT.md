# Phase 32: audio-blob-supabase-persistence - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Make per-item audio durable. Today `db.audio` blobs live only in Dexie/IndexedDB — lost on device wipe or cache clear, can't retry AI from another device, AI-failure recovery is local-only. This phase pushes each recorded blob to a Supabase Storage `audio` bucket in the background, records its storage path + upload status, lets `processAudioWithAi` fall back to Storage when the local Dexie blob is missing (cross-device retry), and surfaces durability state in the UI.

**In scope:** Supabase Storage `audio` bucket + session-owner-scoped RLS (mirror the SEC-4 photos pattern with the Phase 31 column-scope fix baked in); a Supabase `audio` metadata table + a Dexie `audioUploadQueue`; background upload on `db.audio.add`; Storage read-fallback in `processAudioWithAi`; `audioRecordsForItem` union to include Supabase audio; ItemCard upload-status UI + manual retry; 30-day retention + pg_cron purge + storage-orphan cleanup on hard-delete.

**Out of scope (scope anchor — confirmed with user):**
- **Continuous / session master blobs** (`sessionAudio`). Only per-item `ItemAudio` persists. Continuous mode is gated off via D-050; revisit if/when re-enabled.
- PERF-1 base64-memory rework and PERF-2 continuous-blob streaming (separate phases per ROADMAP).
- REL-4 `stopRecording` hang fix (Phase 33 offline-reliability).

</domain>

<decisions>
## Implementation Decisions

### Status home + table shape
- **D-01:** Mirror the photos pattern **fully**. Add (a) a new Supabase `audio` metadata table — `storage_path`, `upload_status`, FK to `items` `ON DELETE CASCADE`, session/owner columns needed for RLS path-scoping — and (b) a new Dexie `audioUploadQueue` table that reuses the existing photo drain/retry engine. Rationale: least surprise, reuses proven `drainPhotoQueue` mechanics, and gives a Supabase-side audit row for cross-device retry.
- **D-02:** Bucket name `audio`; storage path `audio/{sessionId}/{itemId}/{audioId}.opus` (or the recorded mime's natural extension — see code_context note on webm/opus). RLS scopes on path token `[2]` = `sessionId` matched to `sessions.created_by`/`assigned_to`, fully qualifying `storage.objects.name` per the column-scope fix.

### Cleanup + orphan policy
- **D-03:** Retain Storage blobs **30 days after the item reaches `done`**, then purge via a **pg_cron scheduled sweep**.
- **D-04:** On item **hard-delete**, delete the Storage blob too — i.e. **close the storage-orphan gap that photos currently have** (metadata rows cascade-delete today but the Storage objects are left orphaned). Audio must not repeat that leak. Planner to decide blob-delete mechanism (cascade trigger calling Storage API vs. the pg_cron sweep also reaping objects whose metadata row is gone).

### Upload vs AI-processing order
- **D-05:** Keep AI processing **immediate from the local Dexie blob**; run the Storage upload **in parallel in the background**. `processAudioWithAi` is NOT blocked on upload. Reuse photo retry defaults (concurrency 2, `4^retryCount * 1000ms` backoff, max 3 retries). Storage is the fallback source only when the local blob is gone (cross-device / cache-cleared), not the primary read path on the recording device.

### UI surface + failed affordance
- **D-06:** Surface `pending / uploaded / failed` on **ItemCard**, reusing the photo `usePhotoUploadStatus` pattern (an `useAudioUploadStatus` analog). On `failed`, show a **manual retry button** that re-enqueues the upload.

### Claude's Discretion
- Exact Supabase `audio` table column set + migration filename/timestamp (follow `supabase/migrations/<ts>_<name>.sql`).
- Whether orphan blob deletion on hard-delete is a DB trigger, an Edge function, or folded into the pg_cron sweep.
- Dexie schema version bump + index for `audioUploadQueue` (follow the photo queue's v8 precedent).
- Storage-fallback hydration detail in `processAudioWithAi` (download → blob → base64; whether to re-cache into Dexie after a Storage fetch).
- Exact pg_cron schedule cadence.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase source + ROADMAP entry
- `.planning/ROADMAP.md` (Phase 32 entry, lines ~81–90) — the phase definition: bucket, path convention, fallback, union-helper, cleanup, tests, risk.
- `docs/audit-consolidated-backlog-2026-05-27.md` — origin of the v1.3 durability/audit backlog this phase belongs to.

### Storage + RLS templates (the pattern to mirror)
- `supabase/migrations/20260320200000_create_photos.sql` — photos table + `photos` bucket + FK `ON DELETE CASCADE` to items. Template for the `audio` table + bucket.
- `supabase/migrations/20260527000001_scope_photos_storage_rls.sql` — **SEC-4 pattern**: session-scoped Storage RLS (path token `[2]` = sessionId vs `sessions.created_by`/`assigned_to`).
- `supabase/migrations/20260528000002_fix_sec4_photo_policy_column_scope.sql` — **column-scope fix** (Phase 31 Codex pass): fully-qualify `storage.objects.name` in the RLS subquery so `storage.foldername()` resolves the file path, not `session.name`. MUST be baked into the audio RLS from the start.

### Upload-queue + status template
- `src/services/photoUploadQueue.ts` — `enqueuePhotoUpload`, `processOneUpload`, `drainPhotoQueue` (concurrency 2, `4^n` backoff, max 3, offline-pause). The retry engine to reuse for audio.
- `src/hooks/usePhotoUploadStatus.ts` — reactive upload-status hook; template for `useAudioUploadStatus`.
- `src/hooks/usePhotoUrl.ts` — `createSignedUrl` read pattern for Storage.

### Audio touchpoints to change
- `src/db/types.ts:65-72` — `ItemAudio` interface (id, itemId, itemType, blob, mimeType, durationMs, createdAt). No sessionId/storage_path/status today.
- `src/db/index.ts` — Dexie schema; `db.audio` table + version history (add `audioUploadQueue` table + version bump here).
- `src/services/gemini.ts:165-391` — `processAudioWithAi(audioId, itemId, sessionId)`; loads blob via `db.audio.get` (line ~190) then base64 (line ~202). Add Storage fallback when the Dexie blob is missing.
- `src/db/audioLookup.ts:13-20` — `audioRecordsForItem` DAT-7 union (byUuid + byLegacy); extend to include Supabase audio.
- `src/hooks/useAudioRecorder.ts:180-291` — recorder; `db.audio.add` at ~line 187. Enqueue the upload here (post-add, fire-and-forget).
- `src/lib/supabase.ts:1-21` — supabase-js singleton; `supabase.storage.from('audio')`.
- `src/hooks/useOnlineStatus.ts` — online/offline detection the drain loop respects.
- `src/stores/sessionStore.ts:492-537` — `deleteItem`; where item hard-delete happens (cascade entry point for orphan cleanup).

### Cross-app decisions
- `../_workspace/Decisions/D-001-shared-supabase.md` — shared DB; this bucket/table/RLS is a cross-app schema event.
- `../_workspace/Decisions/D-046-claude-owns-schema-auth-codex-barred.md` — RLS/migration work is Claude-owned; Codex reviews adversarially but does not implement. Mandatory Codex review before `supabase db push`.
- `../_workspace/Decisions/D-003-anon-key-public-rls-boundary.md` — anon key is public; RLS + grants are the only boundary (why the column-scope fix matters).
- `../_workspace/Schema/schema.md` — canonical shared schema; update first when adding the `audio` table.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`photoUploadQueue.ts` drain/retry engine** — copy near-verbatim for `audioUploadQueue` (enqueue → drain, concurrency 2, exp backoff, max 3, offline pause).
- **`usePhotoUploadStatus.ts`** — clone as `useAudioUploadStatus` for the ItemCard pill.
- **SEC-4 RLS migrations** (`20260527000001` + `20260528000002`) — copy the session-scoped, column-qualified policy idiom for the `audio` bucket.
- **`audioRecordsForItem`** already does Dexie union (UUID + legacy-int id mapping) — extend, don't replace.

### Established Patterns
- Migrations: `supabase/migrations/<ts>_<name>.sql`; prod applied via `supabase db push` after **mandatory Codex review** (D-046).
- After any migration: regen `src/db/database.types.ts` via `npm run db:types`.
- Storage path convention is `{bucket}/{sessionId}/{itemId}/...` (photos uses `full-{n}.jpg` / `thumb-{n}.jpg`; audio uses `{audioId}.{ext}`).
- FK `ON DELETE CASCADE` to `items` (and items→sessions) handles metadata-row cleanup; **Storage objects are NOT auto-reaped** — that is the known photo gap this phase closes for audio (D-04).

### Integration Points
- `db.audio.add` (in `useAudioRecorder.stopRecording`) is the upload-enqueue trigger.
- `processAudioWithAi` is the Storage read-fallback seam (cross-device retry).
- `deleteItem` (sessionStore) is the hard-delete orphan-cleanup seam.
- ItemCard is the status-surface seam (mirror photos).

### Notable mismatches to resolve in planning
- `ItemAudio.itemId` is coerced to/handled as both UUID and legacy int (see `audioLookup`). The Supabase `audio` table + storage path need a stable UUID `itemId` + `sessionId`; recorder currently stores `itemId` and `itemType` but **no `sessionId`** on the audio row — planner must thread `sessionId` through to the upload (path token `[2]` for RLS).
- Recorded mime is runtime-detected (`audio/webm;codecs=opus` preferred, fallbacks mp4/ogg) — the storage extension must follow the actual blob mime, not a hardcoded `.opus`.

</code_context>

<specifics>
## Specific Ideas

- "Mirror the SEC-4 photos pattern" is the explicit design directive throughout — audio infra should look like photo infra (queue table, metadata table, status hook, RLS shape) so the codebase stays uniform.
- Close the photo storage-orphan leak *for audio* now (D-04); the equivalent photo fix is noted as a candidate future sweep but is out of this phase's scope.

</specifics>

<deferred>
## Deferred Ideas

- **Continuous / session master-blob persistence** (`sessionAudio`) — out of scope; continuous mode gated off (D-050). Future phase if re-enabled.
- **Backfilling the photo storage-orphan cleanup** — this phase only fixes it for audio; photos keep the leak until a dedicated cleanup phase.
- **PERF-1 (base64 memory) / PERF-2 (continuous blob streaming)** — separate ROADMAP phases.
- **REL-4 `stopRecording` settle-on-reject hang** — Phase 33 (offline-reliability).

None of these are blockers for Phase 32.

</deferred>

---

*Phase: 32-audio-blob-supabase-persistence*
*Context gathered: 2026-05-29*
