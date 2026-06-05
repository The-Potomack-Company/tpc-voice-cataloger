---
phase: 33-offline-reliability
plan: 04
subsystem: audio-recorder
tags: [REL-4, recorder, indexeddb, retry, resilience, D-11, D-12]
requires:
  - 33-00 (phase foundation)
provides:
  - "recordingStore.recorderError + retryBuffer (retained blob for manual re-save)"
  - "useAudioRecorder.stopRecording() always settles on db.audio.add failure"
affects:
  - src/stores/recordingStore.ts
  - src/hooks/useAudioRecorder.ts
tech-stack:
  added: []
  patterns:
    - "retry-then-always-settle on the MediaRecorder onstop IndexedDB write"
    - "widened resolve-ref type to honor a Promise<T | undefined> settle contract"
key-files:
  created:
    - none
  modified:
    - src/stores/recordingStore.ts
    - src/hooks/useAudioRecorder.ts
    - src/tests/audio-recorder.test.ts
decisions:
  - "D-11 honored: stopRecording() signature stays Promise<number | undefined>; no caller try/catch."
  - "D-12 implemented: retry db.audio.add 2x (3 attempts total) then ALWAYS settle to undefined; retain blob + set error."
metrics:
  tasks-completed: 2
  files-modified: 3
  tests: "15 passing (4 new)"
  completed: 2026-06-01
---

# Phase 33 Plan 04: Recorder Always-Settles + Blob Retention Summary

REL-4: `useAudioRecorder.stopRecording()` now always settles even when `db.audio.add` rejects — it retries the IndexedDB write twice, then resolves `undefined` while stashing the recorded blob in `recordingStore.retryBuffer` and setting `recorderError`, eliminating the indefinite recorder hang and the silent loss of a recording.

## What was built

### Task 1 — recordingStore retry buffer + error (commit `86d597d`, test `ad8d2c6`)
- Added `recorderError: string | null` (default `null`) and `retryBuffer: { blob: Blob; itemId: string; durationMs: number } | null` (default `null`) to `RecordingState`.
- Added setters `setRecorderError(msg)` and `stashForRetry(buf)` mirroring the `setLastSaved` setter shape.
- Both new fields are cleared in `reset()`, keeping the reset contract complete.

### Task 2 — retry-then-always-settle onstop (commit `2d78dc1`, test `58c2f12`)
- Widened `stopResolveRef` from `((id: number) => void) | null` to `((id: number | undefined) => void) | null` so the always-settle path can resolve `undefined` without breaking D-11.
- Rewrote the `onstop` handler: `db.audio.add` is attempted up to 3 times total (initial + 2 retries). On success, the existing success-settle path runs unchanged (resolve id, fire-and-forget upload, null the ref).
- On final failure: `console.error` for diagnostics, then `setRecorderError(...)` with a user-facing message, `stashForRetry({ blob, itemId, durationMs })`, and `stopResolveRef.current?.(undefined)` + null the ref. WHY-comment cites the original hang (useAudioRecorder.ts:202-204) and T-33-09/T-33-10.
- `stopRecording()` signature unchanged: `Promise<number | undefined>` (D-11).

## Tests
- 4 new cases in `src/tests/audio-recorder.test.ts`:
  - store exposes `recorderError`/`retryBuffer` (default null) + setters
  - `reset()` clears both new fields
  - always-reject → `stopRecording()` resolves `undefined` within timeout (no hang), `add` called 3×, error set, blob stashed with correct `itemId`
  - reject-once-then-succeed → resolves with id, no error, no stash
- Full file: 15 tests passing. Typecheck (`tsc --noEmit`) clean. ESLint clean on all three touched files.

## Threat model coverage
- **T-33-09 (DoS — stopRecording hang):** mitigated — retry 2× then always settle; the promise can never hang.
- **T-33-10 (data loss — blob lost):** mitigated — blob retained in `recordingStore.retryBuffer` for manual re-save.
- **T-33-SC (tampering — npm installs):** accept — zero packages installed.

## Deviations from Plan
None — plan executed exactly as written.

## TDD Gate Compliance
Both tasks followed RED → GREEN. RED commits: `ad8d2c6` (store), `58c2f12` (onstop, verified hang/timeout before fix). GREEN commits: `86d597d`, `2d78dc1`. No refactor commits needed.

## Known Stubs
None. The retry buffer is wired end-to-end from the failure path; consuming UI for manual re-save is out of scope for this plan (recordingStore exposes the data for a future re-save surface).

## Notes for downstream
- A future UI surface can read `useRecordingStore().retryBuffer` + `recorderError` to offer a "retry save" affordance; call `stashForRetry(null)` / `setRecorderError(null)` (or `reset()`) once the manual re-save succeeds.

## Self-Check: PASSED
- src/stores/recordingStore.ts — FOUND (modified, committed `86d597d`)
- src/hooks/useAudioRecorder.ts — FOUND (modified, committed `2d78dc1`)
- src/tests/audio-recorder.test.ts — FOUND (modified, committed `ad8d2c6`/`58c2f12`)
- Commits ad8d2c6, 86d597d, 58c2f12, 2d78dc1 — all present in git log.

## Deferred (D-12 manual re-save UI)

Code review WR-02 flagged that D-12's recovery surface was only half-shipped:
the hang fix landed (`stopRecording()` always settles; the blob is stashed in
`recordingStore.retryBuffer` and `recorderError` is set), but **the manual
re-save UI that consumes `retryBuffer` + `recorderError` does not exist** — no
component reads either field, so a user whose final `db.audio.add` fails still
has no error surface and no way to re-save the stashed blob (which is lost on
`reset()`/reload).

This is **deferred to a follow-up phase**, not fixed here, to keep Phase 33
scoped to the reliability/correctness defects. The write-side of D-12 (settle +
stash) is shipped and tested; the read-side (a banner/toast for `recorderError`
plus a "retry save" action that replays `db.audio.add` from `retryBuffer` then
clears it via `stashForRetry(null)` / `setRecorderError(null)`) is the deferred
work. Until then, the user-facing "manual re-save" claim in D-12 is not yet met.
