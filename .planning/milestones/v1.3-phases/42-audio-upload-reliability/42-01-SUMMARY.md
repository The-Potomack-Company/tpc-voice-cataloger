---
phase: 42-audio-upload-reliability
plan: 01
subsystem: audio-durability
tags: [audio, offline-queue, reliability, reconciliation, self-heal]
requires:
  - audioUploadQueue (drainAudioQueue, retryFailedUploads, idempotent upsert DAT-5)
  - offlineQueue (drainQueue pending-reclaim union, processItem ATTEMPT_CAP)
  - AppLayout handleReconnect (boot + online drain orchestration)
provides:
  - resweepFailedUploads — bounded failed→pending audio-upload self-heal (boot + online)
  - audio↔item reconcile edge — stuck pre-AI items (pending|failed) with uploaded audio re-queued
  - AppLayout boot/online resweep wiring
affects:
  - src/services/audioUploadQueue.ts
  - src/services/offlineQueue.ts
  - src/layouts/AppLayout.tsx
tech-stack:
  added: []   # zero new deps (constraint)
  patterns:
    - "Bounded attempt cap on a boot/online resweep (RESWEEP_CAP), retryCount preserved — mirrors Phase-41 anti-storm pattern"
    - "Union-then-conditional-update reconcile (read audio by item_id IN, then update .eq(ai_status, stuckStatus).select) generalized over multiple stuck states"
key-files:
  created: []
  modified:
    - src/services/audioUploadQueue.ts
    - src/services/offlineQueue.ts
    - src/layouts/AppLayout.tsx
    - src/tests/audio-upload-queue.test.ts
    - src/tests/offline-queue.test.ts
decisions:
  - "RESWEEP_CAP = 6 (> MAX_RETRIES 3): each resweep cycle that re-fails bumps the persisted retryCount, so a cap measured against retryCount ages a permanently-failing entry out instead of re-arming on every online event"
  - "resweepFailedUploads preserves retryCount (never resets to 0) — the unconditional reset-to-0 stays exclusive to the manual ItemCard retryFailedUploads one-shot"
  - "Reconcile generalized to cover BOTH 'pending' and 'failed' stuck states with one union-then-conditional-update loop; the 'failed' pass closes GAP-4 (item marked failed for missing audio that has since uploaded)"
  - "Re-queued items stay bounded by processItem's existing ATTEMPT_CAP rather than introducing a new bound (T-42-02)"
metrics:
  duration: ~9 min
  tasks: 3
  files: 5
  completed: 2026-06-04
---

# Phase 42 Plan 01: Audio Upload Reliability Summary

Closed the audio-upload stranding precondition (SC-1) by making the upload durable and self-healing: a bounded `failed→pending` resweep fired on app boot + every `online` event, plus a reconcile edge so an item whose audio reaches `upload_status='uploaded'` becomes drainable again — both reusing existing Phase-41 machinery (idempotent upsert, attempt cap, union-then-conditional-update). Zero schema changes, zero new deps.

## What Was Built

### Task 1 — Bounded `failed→pending` resweep (`audioUploadQueue.ts`)
`resweepFailedUploads()` reads `db.audioUploadQueue.where("status").equals("failed")` and flips entries back to `pending` **only** while their persisted `retryCount` is below `RESWEEP_CAP` (6). It preserves `retryCount` (never zeroes it) so a permanently-failing entry ages out across resweep cycles instead of re-arming forever on every `online` event (the Phase-33/41 retry-storm bug, RESEARCH Pitfall 3 / T-42-01). After resetting at least one entry it fires `drainAudioQueue()` fire-and-forget, which reuses the existing idempotent `upsert(onConflict:storage_path, ignoreDuplicates)` (DAT-5 / T-42-04) so a resurfaced upload can't duplicate the Storage object or audio row. The manual `retryFailedUploads` one-shot (ItemCard pill) is left untouched.

### Task 2 — Audio↔item reconcile edge (`offlineQueue.ts`)
Generalized `drainQueue`'s pending-reclaim block into a loop over two stuck pre-AI states — `'pending'` (Phase-41 anchor that missed audio) and `'failed'` (GAP-4: item marked failed because `findAudioForItem` saw no audio at the time, but the upload-queue resweep has since landed it). Both use the identical union-then-conditional-update shape: read `audio.item_id IN (stuckIds)`, de-dup, then `update({ai_status:"queued"}).in("id", idsWithAudio).eq("ai_status", stuckStatus).select("id")`. The `.select` keeps winner-detection real (SHARED-2 / Pitfall 1). Reconcile keys on `item_id` (UUID) under existing session-owner RLS — no service-role, no cross-session broadening (T-42-03 / SHARED-4). A re-queued item remains bounded by `processItem`'s existing `ATTEMPT_CAP` (T-42-02). Items with no audio row are never touched (never fabricate work).

### Task 3 — Boot + online wiring (`AppLayout.tsx`)
Added `void resweepFailedUploads();` in `handleReconnect` immediately before `void drainAudioQueue();`. `handleReconnect` runs on mount-if-online and on every window `'online'` event, so the self-heal trigger fires on both boot and reconnect.

## TDD Gate Compliance

Both behavior-adding tasks followed RED → GREEN:

| Gate | Commit | Notes |
|------|--------|-------|
| RED (Task 1) | `522028e` test(42-01) | 4 failing resweep cases (`resweepFailedUploads is not a function`) |
| GREEN (Task 1) | `8cf2b00` feat(42-01) | 11/11 audio-upload-queue tests green |
| RED (Task 2) | `4b50918` test(42-01) | 2 failing reconcile cases (stuck item not re-queued) |
| GREEN (Task 2) | `c5fac00` feat(42-01) | 18/18 offline-queue tests green |
| Glue (Task 3) | `76c3e51` feat(42-01) | type=auto, no RED required (per plan) |

## Verification

- `npx vitest --run src/tests/audio-upload-queue.test.ts` — 11/11 green
- `npx vitest --run src/tests/offline-queue.test.ts` — 18/18 green
- `npx tsc -p tsconfig.app.json --noEmit` — exits 0
- `npm test` full suite — **705 passed, 0 failed** (49 todo, 4 skipped files pre-existing)
- Acceptance greps: `resweepFailedUploads` exported (1), `RESWEEP_CAP` present, no `retryCount: 0` in resweep body (0), `in("item_id"` present, `service_role` count 0, `.eq("ai_status", stuckStatus).select("id")` present, `resweepFailedUploads` in AppLayout (2: import + call)

## Constraint Compliance

- **No schema changes:** `git diff` of the 5 plan commits touches no `supabase/migrations/*`, no `database.types.ts`, no schema files.
- **No new npm deps:** plan commits touch no `package.json` / `package-lock.json`.
- **Auth-of-record (D-002):** untouched.
- **Recorder hot path:** untouched — durability comes only from the resumable queue + reconcile (Pitfall 4 respected; `stopRecording`/`onstop` not made to await uploads).
- **Branch:** committed locally on `gsd/v1.3-maturation`; not pushed (v1.3 push deferred to milestone end).

## Deviations from Plan

None — plan executed exactly as written. One supporting adjustment within Task 2's scope: the existing `reclaims pending items` test mock was updated to add `.select` to its `update().in().eq()` chain to match the new conditional-write contract (the prior mock would have swallowed a `.select is not a function` error). Committed with the Task 2 GREEN commit.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface beyond the threat register in PLAN.md (all dispositions `mitigate`, all applied).

## Manual UAT Owed

Per `42-VALIDATION.md`, the genuine multi-device + live-RLS self-heal path (device A records offline → reconnect → audio row lands; device B opens item → failure banner Retry resolves via Storage) is batched to the v1.3 milestone-end on-device UAT. Plan 02 (F2 / banner) lands the banner Retry leg of that UAT.

## Self-Check: PASSED

All 5 modified files present; all 5 plan commits (`522028e`, `8cf2b00`, `4b50918`, `c5fac00`, `76c3e51`) present in git log.
