---
phase: 32-audio-blob-supabase-persistence
plan: 03
subsystem: client-data-layer
tags: [dexie, supabase-storage, upload-queue, retry-backoff, tdd-green, audio, react-hook]

# Dependency graph
requires:
  - phase: 32-audio-blob-supabase-persistence
    plan: 02
    provides: "live public.audio table + regenerated database.types.ts so supabase.from('audio') typechecks"
provides:
  - "Dexie v10 audioUploadQueue table (carries v9 store set forward unchanged)"
  - "AudioUploadEntry interface + ItemAudio.sessionId in src/db/types.ts"
  - "audioUploadQueue.ts service: enqueueAudioUpload/enqueue, processOneAudioUpload, drainAudioQueue, retryFailedUploads, _resetDraining"
  - "extFromMime(mime) helper in src/utils/audio.ts (webm/mp4/ogg, strips ;codecs=, never .opus)"
  - "useAudioUploadStatus reactive hook"
affects: [32-04-recorder-enqueue, 32-05-item-card-pill-and-delete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audio upload queue clones the proven photoUploadQueue engine: single-blob (no thumbnail), contentType from runtime mimeType"
    - "DAT-5 idempotent metadata upsert keyed on unique storage_path (onConflict:'storage_path', ignoreDuplicates:true)"
    - "D-05 retry contract reused verbatim: CONCURRENCY 2, MAX_RETRIES 3, 4^retryCount*1000 backoff, navigator.onLine pause, Promise.allSettled batching"
    - "Storage path audio/{sessionId}/{itemId}/{dexieAudioId}.{ext} with mime-derived ext + UUID-string itemId (never int coercion)"

key-files:
  created:
    - src/services/audioUploadQueue.ts
    - src/hooks/useAudioUploadStatus.ts
  modified:
    - src/db/types.ts
    - src/db/index.ts
    - src/utils/audio.ts
    - src/tests/db.test.ts

key-decisions:
  - "AudioUploadEntry carries mimeType (not a precomputed ext) to match the locked Wave-0 test contract; ext is derived at enqueue time via extFromMime"
  - "audio/mp4 maps to the 'mp4' extension (not 'm4a') per the audio-upload-queue.test.ts assertion — the locked scaffold is the source of truth over the plan's interfaces note"
  - "Service export named processOneAudioUpload (not processOneUpload) to match the test scaffold's import"

patterns-established:
  - "Audio surface mirrors the photo upload queue minus thumbnail/sortOrder, plus mimeType; single blob, runtime content-type"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-06-01
---

# Phase 32 Plan 03: Audio Upload Queue + Status Hook Summary

**Built the client audio-upload data layer — Dexie v10 `audioUploadQueue` table + `AudioUploadEntry` type + `ItemAudio.sessionId`, the `audioUploadQueue.ts` service (single-blob clone of `photoUploadQueue` with mime-derived ext + idempotent metadata upsert + D-05 retry contract), the `extFromMime` helper, and the reactive `useAudioUploadStatus` hook — turning the plan-01 Wave-0 scaffolds GREEN.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **Dexie v10** (`src/db/index.ts`): `db.version(10)` copies the entire v9 store set verbatim and appends `audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt"`; `audioUploadQueue: EntityTable<AudioUploadEntry,"id">` registered on the `db` type. Additive table, no `.upgrade()` callback (v9 data preserved).
- **Types** (`src/db/types.ts`): `AudioUploadEntry` interface (mirrors `PhotoUploadEntry` minus `thumbnailPath`/`sortOrder`, plus `mimeType`); `ItemAudio.sessionId?: string` added.
- **Service** (`src/services/audioUploadQueue.ts`): structural clone of `photoUploadQueue.ts`. `enqueueAudioUpload` (+ `enqueue` alias) builds `audio/{sessionId}/{itemId}/{dexieAudioId}.{ext}` with the UUID-string itemId. `processOneAudioUpload` does a SINGLE blob upload with `contentType: entry.mimeType` (no thumbnail), then the DAT-5 idempotent metadata upsert (`onConflict:'storage_path', ignoreDuplicates:true`). `drainAudioQueue`/`retryFailedUploads`/`_resetDraining` carry the D-05 retry contract verbatim (CONCURRENCY 2, MAX_RETRIES 3, 4^n*1000 backoff, offline pause, `Promise.allSettled`).
- **Helper** (`src/utils/audio.ts`): `extFromMime` strips `;codecs=…` then maps `audio/webm→webm`, `audio/mp4→mp4`, `audio/ogg→ogg`, default `webm` — never the hardcoded `.opus` (Pitfall 5 / T-32-10).
- **Hook** (`src/hooks/useAudioUploadStatus.ts`): clone of `usePhotoUploadStatus` over `db.audioUploadQueue.where('dexieAudioId')`; returns `pending|uploading|uploaded|failed|none` reactively.

## Task Commits

1. **Task 1: Dexie v10 + AudioUploadEntry + ItemAudio.sessionId** — `89b3bc6` (feat)
2. **Task 2: audioUploadQueue service + extFromMime** — `cbb3238` (feat)
3. **Task 3: useAudioUploadStatus hook** — `d80f7d4` (feat)
4. **Deviation fix: db schema table-count invariant (v10)** — `66feae6` (test)

## TDD Gate Compliance

This plan made the plan-01 RED scaffolds GREEN (the RED commits live in plan 01: `da5a8db`). GREEN gate verified:

- `src/tests/audio-upload-queue.test.ts` — **7/7 pass** (enqueue path/mime-ext/UUID-itemId, mp4 ext, drain concurrency 2, processOne DAT-5 upsert, 4^n backoff-pending, MAX_RETRIES failed).
- `src/tests/audio-upload-status.test.ts` — **6/6 pass** (none / undefined / pending / uploading / uploaded / failed).
- Combined: **13/13 GREEN**. Full suite: 535 passed; the only remaining 4 failures are the plan-04/05 RED scaffolds (out of scope — see below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] db.test.ts table-count invariant broke on the v10 bump**
- **Found during:** post-Task-3 full-suite run.
- **Issue:** `src/tests/db.test.ts` asserts the exact Dexie table set and `toHaveLength(10)` in two places. Adding the 11th table (`audioUploadQueue`) in Task 1 correctly invalidated both assertions.
- **Fix:** Updated both assertions to include `audioUploadQueue` and `toHaveLength(11)`; renamed the second test to reference the v10 migration. This is a structural-invariant test reflecting the new (correct) schema — not a TDD scaffold being weakened.
- **Files modified:** `src/tests/db.test.ts`
- **Commit:** `66feae6`

### Contract reconciliations (plan interfaces note vs. locked Wave-0 test)

The plan's `<interfaces>` block specified an `ext` parameter/field and an `m4a` mapping, but the locked plan-01 scaffold (`audio-upload-queue.test.ts`) is the GREEN source of truth and dictated otherwise. Built to the tests (per the execution brief "do not weaken the tests to pass"):

- `enqueueAudioUpload` takes **`mimeType`** (not `ext`); `AudioUploadEntry` stores **`mimeType`**; ext is derived internally via `extFromMime`.
- `audio/mp4` → **`mp4`** extension (test asserts `…/11.mp4`), not `m4a`.
- Single-blob processor is exported as **`processOneAudioUpload`** (test import), not `processOneUpload`.

These are not behavioral deviations from the plan's intent (mime-derived ext, UUID itemId, single-blob, DAT-5 upsert, D-05 retry all hold) — only naming/shape reconciliations to satisfy the locked harness.

## Out-of-Scope (left RED, by design)

The following remain failing — they are the plan-01 Wave-0 scaffolds for plans **04/05**, not this plan:

- `src/tests/audio-storage-fallback.test.ts` (plan 04 `processAudioWithAi`)
- `src/tests/item-card-audio-status.test.tsx` (plan 05 ItemCard pill)
- `src/tests/sessionStore-audio-delete.test.ts` (plan 05 `deleteItem` audio cleanup)

## Threat Surface

The three threat-register mitigations assigned to this plan are satisfied:

- **T-32-09** (legacy-int itemId → wrong RLS scope): `enqueueAudioUpload` threads the UUID itemId string only; asserted by `audio-upload-queue.test.ts` ("keeps itemId as a UUID string").
- **T-32-10** (wrong content-type/ext): `extFromMime` + `contentType: entry.mimeType` from the runtime mime; no hardcoded `.opus`.
- **T-32-11** (retry storm DoS): MAX_RETRIES 3 + 4^n backoff + offline pause cloned verbatim from `photoUploadQueue` (D-05).

No new security surface introduced beyond the plan's threat model.

## Self-Check: PASSED

- `src/services/audioUploadQueue.ts` — present ✓
- `src/hooks/useAudioUploadStatus.ts` — present ✓
- `src/db/types.ts` (AudioUploadEntry + ItemAudio.sessionId) — present ✓
- `src/db/index.ts` (`db.version(10)` + audioUploadQueue) — present ✓
- `src/utils/audio.ts` (extFromMime) — present ✓
- Commits `89b3bc6`, `cbb3238`, `d80f7d4`, `66feae6` — all found in git log ✓
- Target suites GREEN (13/13); `tsc --noEmit` clean; eslint clean ✓

---
*Phase: 32-audio-blob-supabase-persistence*
*Completed: 2026-06-01*
