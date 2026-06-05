---
phase: 32-audio-blob-supabase-persistence
plan: 04
subsystem: recorder-ai-pipeline-wiring
tags: [audio, recorder, gemini, storage-fallback, completed-at, audio-lookup, cross-device, tdd-green, d-02, d-05, d-07]

# Dependency graph
requires:
  - phase: 32-audio-blob-supabase-persistence
    plan: 03
    provides: "enqueueAudioUpload/drainAudioQueue + Dexie v10 audioUploadQueue + extFromMime + ItemAudio.sessionId"
  - phase: 32-audio-blob-supabase-persistence
    plan: 02
    provides: "live public.audio table + items.completed_at column in database.types.ts"
provides:
  - "useAudioRecorder.onstop threads sessionId onto the Dexie audio row + fire-and-forget enqueueAudioUpload().then(drainAudioQueue) (D-05)"
  - "src/services/processAudioWithAi.ts — Dexie-first audio-blob resolver with cross-device Supabase Storage fallback keyed by item_id UUID (Pitfall 4)"
  - "gemini.ts processAudioWithAi delegates blob resolution to the new resolver; sets items.completed_at on AI-done (D-07)"
  - "audioRecordsForItem unions Supabase audio rows (best-effort) for cross-device visibility (W-3 rule a, Dexie-authoritative)"
affects: [32-05-item-card-pill-and-delete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget background upload after db.audio.add mirroring PhotoCapture.tsx:130-136 — rejected enqueue/drain swallowed, never blocks resolve or AI trigger (D-05)"
    - "Cross-device read fallback resolves the audio metadata row by item_id (UUID) then downloads storage_path from the 'audio' bucket — never keyed by the local integer dexieAudioId (Pitfall 4 / T-32-12)"
    - "Best-effort Supabase union in audioRecordsForItem: a remote query failure degrades to the Dexie-authoritative result, never throws out of the lookup"

key-files:
  created:
    - src/services/processAudioWithAi.ts
  modified:
    - src/hooks/useAudioRecorder.ts
    - src/services/gemini.ts
    - src/db/audioLookup.ts
    - src/tests/audio-lookup.test.ts

key-decisions:
  - "Created a standalone src/services/processAudioWithAi.ts blob-resolver to match the locked plan-01 test scaffold (which imports `../services/processAudioWithAi` with an object signature `{ itemId, dexieAudioId }`), rather than rewriting gemini.ts's positional processAudioWithAi(audioId, itemId, sessionId) signature used by 5 callers. gemini delegates blob resolution to it."
  - "Fallback resolves the audio row via `.eq('item_id', itemId)` returning an array and takes `[0]`, NOT `.maybeSingle()` — the locked test mock resolves `.eq` directly to `{ data: [...] }`. Build-to-the-test (per plan-03 precedent: locked scaffold > plan interfaces note)."
  - "W-3 rule (a) Dexie-authoritative: Supabase audio rows are contributed to audioRecordsForItem ONLY when no Dexie row exists for the item, with id left undefined (raises count, not the integer latestAudioId reduce / useAudioUploadStatus pill). Accepted limitation: pure cross-device session shows audio count but a silent status pill — no useAudioUploadStatus type widening."
  - "enqueueAudioUpload is passed `mimeType` (not a precomputed `ext`) — matching the plan-03 reconciled signature; ext is derived internally via extFromMime."
  - "No re-cache of the downloaded Storage blob into Dexie (CONTEXT discretion declined): the resolver is a pure read; re-caching would couple the read path to a Dexie write and complicate the test contract for no plan-required benefit."

patterns-established:
  - "Audio AI read path is Dexie-first, Storage-fallback (by item_id UUID), best-effort union for lookup — local IndexedDB authoritative, Supabase as the non-primary cross-device source"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-06-01
---

# Phase 32 Plan 04: Recorder + AI Pipeline Wiring Summary

**Wired the durable-audio plumbing into the live flow: the recorder now threads `sessionId` onto the Dexie audio row and fires a non-blocking `enqueueAudioUpload().then(drainAudioQueue)` after `db.audio.add` (D-05); a new `processAudioWithAi.ts` resolver gives the AI pipeline a cross-device Storage download fallback keyed by `item_id` UUID (Pitfall 4); `items.completed_at` is stamped on AI-done (D-07 retention clock); and `audioRecordsForItem` unions Supabase audio for cross-device visibility — turning the plan-01 `audio-storage-fallback` scaffold GREEN and the extended `audio-lookup` suite GREEN.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **Recorder enqueue** (`src/hooks/useAudioRecorder.ts`): `onstop` now writes `sessionId: sessionIdRef.current` onto the `db.audio.add` row (D-02 path token) and, after the add resolves, fires `enqueueAudioUpload({ dexieAudioId, itemId: itemIdRef.current /* UUID string */, sessionId, mimeType }).then(() => drainAudioQueue()).catch(() => {})`. Fire-and-forget: a rejected enqueue/drain is swallowed and never blocks `stopResolveRef` resolution or the AI trigger (`RecordButton.tsx` unchanged, D-05). The upload keys on the UUID `itemIdRef.current`, never the `as unknown as number` coercion the Dexie row uses (T-32-13).
- **Storage fallback resolver** (`src/services/processAudioWithAi.ts`, NEW): `processAudioWithAi({ itemId, dexieAudioId })` returns `{ blob, mimeType }`. Dexie-first; when `db.audio.get(dexieAudioId)?.blob` is absent it resolves the audio metadata row via `supabase.from('audio').select('storage_path, mime_type').eq('item_id', itemId)` (by UUID, **not** the integer id — Pitfall 4 / T-32-12), downloads `storage_path` from the `'audio'` bucket, and throws a clear error when both sources miss.
- **gemini.ts** (`src/services/gemini.ts`): `processAudioWithAi` now delegates blob resolution to the new resolver (aliased `resolveAudioForAi`) instead of the inline `db.audio.get` throw; the base-mime strip uses the resolved `mimeType`. The AI-done `supabaseUpdate` gains `completed_at: new Date().toISOString()` (D-07 — the daily pg_cron purge keys on this). Removed the now-unused `db` import. Continuous-mode write-paths (`geminiContinuous.ts`, `continuousModeStore.ts`) left untouched (D-050 out of scope).
- **Audio lookup** (`src/db/audioLookup.ts`): `audioRecordsForItem` keeps the DAT-7 `byUuid + byLegacy` Dexie union (and the `seen` dedupe) and additionally unions Supabase `audio` rows — but only when no Dexie row exists for the item, with `id` left undefined (raises `.length`/count without participating in the integer `latestAudioId` reduce). The remote query is **best-effort**: any Supabase failure (offline/RLS/network) degrades to the Dexie-authoritative result rather than throwing.

## Task Commits

1. **Task 1: thread sessionId + fire-and-forget enqueue in useAudioRecorder.onstop** — `28f2ec4` (feat)
2. **Task 2: Storage download fallback (by item_id) + completed_at on AI-done** — `eb55bb2` (feat)
3. **Task 3: union Supabase audio into audioRecordsForItem (+ best-effort guard)** — `3e4229d` (feat)

## TDD Gate Compliance

This plan made plan-01 / extended Wave-0 scaffolds GREEN (RED commits live in plan 01). GREEN gate verified:

- `src/tests/audio-storage-fallback.test.ts` — **2/2 pass** (downloads from Storage resolving by item_id UUID when the Dexie blob is missing; uses the local blob and does NOT hit Storage when present).
- `src/tests/audio-lookup.test.ts` — **7/7 pass** (4 pre-existing DAT-7 cases preserved + 3 new: Dexie-only union unchanged, cross-device Supabase-only count > 0 with undefined id, no double-count when both describe the item).
- `npx tsc --noEmit` clean; eslint clean on all changed files.
- Full suite: **540 passed**; the only 2 remaining failing files are the plan-05 RED scaffolds (out of scope — see below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `audioRecordsForItem` Supabase union broke `offline-queue.test.ts` (regression introduced by Task 3)**
- **Found during:** post-Task-3 full-suite run.
- **Issue:** `offlineQueue.findAudioForItem` calls `audioRecordsForItem`. After Task 3, when an item has no Dexie audio the helper now queries `supabase.from('audio')`. The offline-queue test mocks `supabase.from` to handle only the `items` table and returns `{}` for `audio`, so `.select(...)` threw a `TypeError`, propagating out of `processWithRetry` and skipping the `ai_status: 'failed'` update the test asserts.
- **Fix:** Wrapped the Supabase union query in try/catch in `audioRecordsForItem`, degrading to the Dexie-authoritative result on any failure. This is correct regardless of the test — a remote failure (offline/RLS/network) must never break the local-authoritative audio lookup. Cross-device visibility is best-effort by design.
- **Files modified:** `src/db/audioLookup.ts` (folded into the Task 3 commit, same file/concern).
- **Commit:** `3e4229d`

### Contract reconciliations (plan interfaces note vs. locked Wave-0 test)

The plan's `<interfaces>`/PATTERNS specified modifying `gemini.ts:189-202` in place with `.maybeSingle()`. The locked plan-01 scaffold (`audio-storage-fallback.test.ts`) is the GREEN source of truth and dictated otherwise (per the plan-03 precedent "build to the tests"):

- The scaffold imports `processAudioWithAi` from **`../services/processAudioWithAi`** (a separate module) with an **object signature** `{ itemId, dexieAudioId }` — so a standalone resolver module was created rather than rewriting gemini's positional `processAudioWithAi(audioId, itemId, sessionId)` signature (used by 5 callers: ItemList, ItemCard, RecordButton, offlineQueue, ItemEntry). gemini delegates to it.
- The scaffold mock resolves `.eq('item_id', itemId)` **directly to `{ data: [...] }`** (an array), so the resolver uses `.eq(...).then` + `data[0]`, **not** `.maybeSingle()`.

These satisfy the plan's behavioral intent (Dexie-first, Storage fallback keyed by item_id UUID, clear throw when both miss) — only module-path/signature/array-shape reconciliations to the locked harness.

## Out-of-Scope (left RED, by design — plan 05)

Per the execution brief, plan 05 owns these scaffolds — they remain failing and were NOT touched:

- `src/tests/item-card-audio-status.test.tsx` (plan 05 ItemCard pill)
- `src/tests/sessionStore-audio-delete.test.ts` (plan 05 `deleteItem` audio cleanup)

Also out of scope (D-050 continuous gated off): `geminiContinuous.ts` and `continuousModeStore.ts` `completed_at` wiring — intentionally NOT wired.

## Known Limitations

- **Cross-device-only audio: count visible, status pill silent.** When audio is recorded on device A and viewed on device B with no local Dexie row, `audioRecordsForItem` surfaces the Supabase row so the ItemCard audio **count** is correct, but the row has no Dexie integer `id`, so `useAudioUploadStatus` (keyed on the Dexie int) cannot drive the upload-status pill — the pill is silent for that row. Accepted for Phase 32 (W-3 rule a); no `useAudioUploadStatus` type widening, no surrogate-UUID projection.

## Threat Surface

The three threat-register mitigations assigned to this plan are satisfied:

- **T-32-12** (fallback keyed by local integer audioId leaks/misses cross-device): the resolver resolves by `item_id` UUID via `.eq('item_id', itemId)`, never the integer `dexieAudioId`.
- **T-32-13** (upload path reuses the legacy-int itemId coercion → wrong RLS path scope): the recorder enqueues with `itemIdRef.current` (UUID string), not the `as unknown as number` coercion.
- **T-32-14** (rejected enqueue/upload aborts onstop or blocks AI): fire-and-forget `.catch(() => {})`; AI trigger (RecordButton) untouched (D-05).
- **T-32-SC** (npm supply chain): no new package installs.

No new security surface introduced beyond the plan's threat model.

## Self-Check: PASSED

- `src/services/processAudioWithAi.ts` — present ✓
- `src/hooks/useAudioRecorder.ts` (sessionId on row + enqueueAudioUpload) — present ✓
- `src/services/gemini.ts` (delegates to resolver + completed_at) — present ✓
- `src/db/audioLookup.ts` (Supabase union + best-effort guard) — present ✓
- Commits `28f2ec4`, `eb55bb2`, `3e4229d` — all found in git log ✓
- Target suites GREEN (`audio-storage-fallback` 2/2, `audio-lookup` 7/7); `tsc --noEmit` clean; eslint clean ✓

---
*Phase: 32-audio-blob-supabase-persistence*
*Completed: 2026-06-01*
