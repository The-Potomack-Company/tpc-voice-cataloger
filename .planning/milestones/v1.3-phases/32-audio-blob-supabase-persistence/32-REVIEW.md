---
phase: 32-audio-blob-supabase-persistence
reviewed: 2026-06-01T15:02:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/services/audioUploadQueue.ts
  - src/services/processAudioWithAi.ts
  - src/services/gemini.ts
  - src/hooks/useAudioRecorder.ts
  - src/hooks/useAudioUploadStatus.ts
  - src/db/audioLookup.ts
  - src/db/index.ts
  - src/db/types.ts
  - src/utils/audio.ts
  - src/stores/sessionStore.ts
  - src/components/ItemCard.tsx
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
criticals_resolved: 2
status: criticals_resolved
---

## Resolution (2026-06-01)

Both Critical findings fixed in commit `fix(32): resolve 2 critical clone-parity
findings from code review` (full suite 544 passed, tsc + eslint clean):

- **AppLayout.tsx:62** — wired `drainAudioQueue()` into `handleReconnect` (mount +
  `online`), so pending audio stranded by app-close/offline-record now resumes.
- **useAudioUploadStatus.ts** — moved the Dexie query inside the `useLiveQuery`
  callback (photo-analog shape) so the pill reacts to status transitions; updated
  the masking unit-test mock to invoke the querier (real reactive path).

The 5 Warnings + 4 Info remain as advisory follow-ups — all are either inherited
from the photo path (global retry scope, missing-blob handling, console tracing,
v10 store re-declaration) or accepted Phase-32 limitations (cross-device retry
dead-end, empty-blob placeholder, UUID-in-number type lie). None block the phase.


# Phase 32: Code Review Report

**Reviewed:** 2026-06-01T15:02:00Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Deep review of the Phase 32 audio-blob-Supabase-persistence client surface. The
upload-queue/retry engine, the Storage download fallback in `processAudioWithAi`,
the `completed_at` retention stamp, and the D-04 hard-delete orphan cleanup are
all correct and faithful clones of the photo path. The fire-and-forget enqueue in
`useAudioRecorder` threads `sessionId` and the UUID `itemId` correctly, derives the
extension from the runtime mime, and cannot block AI processing (D-05 honored).

Two BLOCKERs stem from **clone-parity drift** — fixes the photo path already has
that the audio clone dropped:

1. The audio upload queue is **never drained on app mount or on the `online`
   reconnect event** — `AppLayout` wires the AI offline queue there, not
   `drainAudioQueue`, so any `pending` audio left after app close or an offline
   recording session is stranded forever. This defeats the durability goal of the
   phase for exactly the offline scenario it exists to cover.
2. `useAudioUploadStatus` reimplements the reactive hook in a way that breaks
   Dexie live-query tracking — the querier returns a pre-built promise instead of
   performing the Dexie read inside the tracked callback, so the pill never reacts
   to status transitions. The test masks this by stubbing `useLiveQuery` to ignore
   its querier.

Remaining warnings cover a misleading-comment landmine, the cross-device retry
dead-end in the UI, and a couple of robustness gaps shared with the photo path.

## Narrative Findings (AI reviewer)

src/layouts/AppLayout.tsx:62: Critical: The audio upload queue is never drained on app mount or `online` reconnect. `drainQueue()` here is `offlineQueue.drainQueue` (the AI-retry queue, imported line 6), NOT `drainAudioQueue` from `audioUploadQueue.ts` — the comment "Audio last" is wrong. The photo path wires `drainPhotoQueue()` into both mount and the `online` handler (line 61). Consequence: an audio entry left `pending` because the app was closed mid-upload, or recorded while offline, will never resume — `drainAudioQueue` is only ever invoked immediately post-record (`useAudioRecorder:214`), via the backoff `setTimeout`, and on manual retry. This strands durable-upload for precisely the offline case the phase targets. Fix: `import { drainAudioQueue } from "../services/audioUploadQueue"` and call it inside `handleReconnect` after `drainPhotoQueue()` (and keep the AI `drainQueue()` too): add `await drainAudioQueue();`.

src/hooks/useAudioUploadStatus.ts:23-25: Critical: The reactive status hook is broken — it does not re-fire on queue mutations. It eagerly calls `lookup(dexieAudioId)` *outside* the `useLiveQuery` callback (line 23), then passes the already-started promise into `useLiveQuery(() => pending, ...)` (line 25). Dexie's `liveQuery` only subscribes to the table reads that happen *synchronously inside* the querier callback; here the callback just returns a pre-resolved promise and performs no tracked read, so the observable captures zero subscriptions and never re-emits when the row transitions pending→uploading→uploaded/failed. The pill shows the first sampled value and then goes stale. The photo analog (`usePhotoUploadStatus.ts:13-20`) correctly runs the `db.photoUploadQueue.where(...).first()` *inside* the callback. The unit test (`audio-upload-status.test.ts:23-30`) hides this by mocking `useLiveQuery` to `void querier` and return a static value, so it passes regardless. Fix: mirror the photo hook exactly — perform the query inside the callback: `const entry = useLiveQuery(() => dexieAudioId === undefined ? undefined : db.audioUploadQueue.where("dexieAudioId").equals(dexieAudioId).first(), [dexieAudioId]);` and drop the `lookup`/`pending` indirection.

src/components/ItemCard.tsx:71: Warning: `handleRetryAi` passes `latestAudioId` (a Dexie integer) as the first arg to `processAudioWithAi(audioId, itemId, sessionId)`. On a cross-device card, `audioRecordsForItem` returns only the Supabase row with `id` undefined, so `latestAudioId` is `null` and the retry button is correctly gated (line 69 / disabled at 377). But when a stale Dexie row exists whose blob was evicted, `processAudioWithAi`→`resolveAudioForAi` will still fall back by `item_id` and work. The real gap: the documented cross-device case (count>0, latestAudioId null) leaves the user with a visible audio count and a permanently disabled AI-retry — no way to trigger cross-device AI from this device. Acceptable per `audioLookup.ts:30` "KNOWN LIMITATION" if intended, but the UI gives no signal *why* retry is disabled beyond the "No audio to retry" tooltip, which is misleading (audio exists, just not locally). Fix: either allow retry keyed on `item.id` when `audioCount > 0 && latestAudioId == null`, or change the tooltip to "Audio is on another device — open it there to retry".

src/components/ItemCard.tsx:206: Warning: The failed-upload retry calls `retryFailedUploads()`, which resets **all** failed audio queue entries across every item/session to pending (`audioUploadQueue.ts:159-176`), not just this card's upload. Tapping one card's "Failed — retry" silently re-drives unrelated failed uploads too. The photo path has the same global-retry shape, so this is inherited rather than newly introduced, but it is still a correctness/UX surprise on a per-item affordance (D-06 says "re-enqueues the upload", singular). Fix: scope a retry to the card's `latestAudioId` (reset only the matching queue entry then `drainAudioQueue()`), or document that the pill is a global "retry all failed audio" control.

src/services/audioUploadQueue.ts:62-67: Warning: When the Dexie audio blob is missing for a `pending` entry (e.g. the local row was evicted before its first upload), `processOneAudioUpload` marks the queue entry `failed` permanently with no retry and no metadata row — the blob is then unrecoverable (it never reached Storage). This mirrors the photo path, but for audio it is more consequential because the Storage copy is the durability guarantee. Consider whether a missing local blob with no Storage counterpart should surface differently than an upload failure. Fix (optional): distinguish "blob gone, never uploaded" from "upload failed" so the UI/telemetry doesn't imply a retry can help when it cannot.

src/services/audioUploadQueue.ts:71-78: Warning: `upsert: true` on the Storage upload combined with `ignoreDuplicates: true` on the metadata upsert (line 89) means a retry that re-uploads the blob but then no-ops the metadata row is fine — but if a *first* attempt uploaded the object successfully and then crashed before the metadata upsert, the retry re-uploads (idempotent) and inserts metadata (good). However, if two different recordings for the same item collide on `audio/{sessionId}/{itemId}/{dexieAudioId}.{ext}` only when `dexieAudioId` repeats — which cannot happen for distinct Dexie rows — so path collision is not a real risk. No fix required; flagged only to confirm the idempotency reasoning holds. (Downgrade to Info if preferred.)

src/db/audioLookup.ts:60: Warning: Cross-device remote rows are mapped with `blob: new Blob([])` (empty placeholder) and `id: undefined`. Any consumer that treats `audioRecordsForItem(...)` results as playable/uploadable blobs would get a zero-byte blob. Currently only `count` and the integer-keyed `latestAudioId` reduce consume this, both of which ignore the placeholder, so it is safe today — but the empty-blob is a latent trap for the next consumer (e.g. a future "play audio" affordance) that iterates the union. Fix: add a discriminator field (e.g. `remote: true` / `storagePath`) or omit `blob` and widen the type, so a placeholder can't be mistaken for real audio.

src/hooks/useAudioRecorder.ts:192: Info: `itemId: itemIdRef.current as unknown as number` stores a UUID string into a field typed `number` (`ItemAudio.itemId: number`). This is the pre-existing DAT-7 dual-form situation that `audioLookup.ts` exists to paper over, not a new bug — the comment at line 207 correctly notes the upload uses the real UUID string. Flagged only so the type lie stays on the radar for the eventual normalization phase. No fix this phase.

src/db/index.ts:135-147: Info: The v10 store definition re-lists every prior table verbatim. Dexie only requires the *changed/added* table in a new version's `.stores()`; re-declaring unchanged tables is harmless and matches the v8/v9 precedent, but it is duplication that has already drifted once is a risk (any future edit must touch every version block). No fix required — consistent with established pattern.

src/services/audioUploadQueue.ts:53,103: Info: `console.log`/`console.error` upload tracing left in (mirrors photo path). Not debug-artifact noise to remove necessarily — it matches the existing convention — but worth confirming it is intended for production. No fix required.

src/services/processAudioWithAi.ts:33-37: Info: The fallback query `.eq("item_id", itemId)` with `rows?.[0]` silently picks the first row when an item has multiple audio recordings, with no ordering. For single-recording items (the norm) this is fine; if multi-recording-per-item becomes real, the fallback may resolve the wrong (e.g. oldest) blob. Fix (future): `.order("created_at", { ascending: false }).limit(1)` to deterministically pick the latest.

---

_Reviewed: 2026-06-01T15:02:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
