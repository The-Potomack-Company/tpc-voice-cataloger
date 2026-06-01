---
phase: 32-audio-blob-supabase-persistence
plan: 05
subsystem: client-delete-cleanup-and-ui-durability
tags: [supabase-storage, storage-remove, orphan-cleanup, item-card, upload-status-pill, tdd-green, audio, d-04, d-06]

# Dependency graph
requires:
  - phase: 32-audio-blob-supabase-persistence
    plan: 03
    provides: "useAudioUploadStatus reactive hook + retryFailedUploads (audioUploadQueue) + enqueueAudioUpload"
provides:
  - "deleteItem removes the item's audio Storage blobs (storage.from('audio').remove) on hard-delete — closes the audio orphan leak (D-04)"
  - "ItemCard audio upload-status pill (pending/uploaded/failed) with a failed->retry control that re-enqueues (D-06)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First supabase.storage.from(bucket).remove() in the codebase — select storage_path by item_id then remove the exact paths (photos never delete binaries; this is the leak D-04 closes for audio)"
    - "Storage.remove() failure is non-fatal: logged + swallowed so the item delete proceeds; the plan-01 pg_cron purge-audio reaper is the orphan backstop"
    - "ItemCard reuses the LIB Badge primitive for the durability pill (no ad-hoc inline styles, v1.2 LIB-primitive convention); failed pill wraps Badge in a button calling retryFailedUploads()"

key-files:
  created: []
  modified:
    - src/stores/sessionStore.ts
    - src/components/ItemCard.tsx
    - src/tests/session-store.test.ts

key-decisions:
  - "Pill labels are 'Pending' / 'Uploaded' / 'Failed — retry' (contain the status word) to satisfy the locked item-card-audio-status.test.tsx regexes (/pending/i, /uploaded/i, /failed/i) — the locked Wave-0 scaffold overrides the plan's 'Uploading'/'Saved' wording"
  - "audioRows?.length guard skips storage.remove() when the item has no audio; remove() error/throw is logged + continues (pg_cron reaper backstop), never aborts the item delete or throws"

patterns-established:
  - "Client-side Storage orphan cleanup on hard-delete: explicit .remove() of metadata-derived paths, FK cascade handles only the row"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-06-01
---

# Phase 32 Plan 05: Hard-Delete Audio Cleanup + ItemCard Durability Pill Summary

**Closed the audio Storage-orphan gap on item hard-delete (D-04) by wiring `deleteItem` to select the item's audio `storage_path`s and `supabase.storage.from('audio').remove(paths)` before the items delete (non-fatal — pg_cron reaper backstops), and surfaced upload durability in `ItemCard` (D-06) via a `useAudioUploadStatus`-driven LIB Badge pill with a failed→retry control that re-enqueues through `retryFailedUploads()` — turning the plan-01 `sessionStore-audio-delete.test.ts` and `item-card-audio-status.test.tsx` scaffolds GREEN.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-06-01
- **Tasks:** 2 (+1 sibling-mock fix)
- **Files modified:** 3

## Accomplishments

- **D-04 hard-delete cleanup** (`src/stores/sessionStore.ts` `deleteItem`): before the existing `from('items').delete().eq('id', itemId)`, queries `from('audio').select('storage_path').eq('item_id', itemId)` and, guarded by `audioRows?.length`, calls `supabase.storage.from('audio').remove(paths)`. The FK `ON DELETE CASCADE` still drops the metadata row; this adds the binary removal — the first `storage.remove()` in the codebase (photos never delete binaries). A `remove()` error/throw is logged and swallowed so the item delete proceeds; the plan-01 pg_cron `purge-audio` reaper is the documented orphan backstop. No `DELETE FROM storage.objects`. Optimistic-delete set(), RLS-failure revert, and both `trackEvent` calls left intact.
- **D-06 durability pill** (`src/components/ItemCard.tsx`): `const uploadStatus = useAudioUploadStatus(latestAudioId ?? undefined)` drives a LIB `Badge` pill in the indicator cluster — `pending`/`uploading` → `info` "Pending", `uploaded` → `ok` "Uploaded", `failed` → `err` "Failed — retry" wrapped in a `button` whose `onClick` calls `retryFailedUploads()`, `none` → renders nothing. All carry `data-testid="audio-upload-pill"`. Mirrors the PhotoCapture status-hook + failed→retry idiom; Badge tones only, no ad-hoc inline styles. Existing AI-status badges + `handleRetryAi` untouched.

## Task Commits

1. **Task 1: Remove audio Storage blobs on item hard-delete (D-04)** — `eb0c3ea` (feat)
2. **Task 2: ItemCard audio upload-status pill + failed-retry (D-06)** — `99fe471` (feat)
3. **Deviation fix: extend session-store mock for the new D-04 cleanup path** — `67939c7` (test)

## TDD Gate Compliance

This plan made the plan-01 RED scaffolds GREEN (RED commits live in plan 01). GREEN gate verified:

- `src/tests/sessionStore-audio-delete.test.ts` — **3/3 pass** (selects paths by item_id + removes exactly those; no-audio rows?.length guard; storage.remove failure swallowed, items delete still runs).
- `src/tests/item-card-audio-status.test.tsx` — **4/4 pass** (pending pill, uploaded pill, failed pill + retryFailedUploads on click, none → no pill).
- Full suite: **544 passed, 0 failed** (5 files / 55 todo skipped) — all plan-01 Wave-0 scaffolds across plans 03/04/05 now GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] session-store.test.ts mock broke on the new D-04 audio cleanup path**
- **Found during:** post-Task-1 full-suite run.
- **Issue:** `deleteItem` now issues `from('audio').select('storage_path').eq('item_id', id)` (select→eq terminal) in addition to the items `delete().eq().select()` (select terminal) shape. The pre-existing single-chain `setupDeleteChain` mock only modeled the items shape, so `from('audio').select(...).eq` was "not a function" — 3 deleteItem tests failed.
- **Fix:** Made `setupDeleteChain` table-aware (audio chain: `select().eq()` resolving to `{ data: [] }` so the `audioRows?.length` guard skips the cleanup and item-state assertions stay isolated) and added a `storage.from().remove()` mock to the hoisted supabase mock. Structural mock update reflecting the new correct behavior — not a weakened TDD scaffold.
- **Files modified:** `src/tests/session-store.test.ts`
- **Commit:** `67939c7`

### Contract reconciliation (plan wording vs. locked Wave-0 test)

The plan's `<interfaces>` specified pill labels "Uploading"/"Saved", but the locked `item-card-audio-status.test.tsx` asserts the pill text matches `/pending/i`, `/uploaded/i`, `/failed/i`. Built to the locked scaffold (per the brief "do not weaken tests to pass"): labels are "Pending" / "Uploaded" / "Failed — retry". Tone mapping (info/ok/err) and behavior (none→nothing, failed→retryFailedUploads) match the plan intent exactly.

## Threat Surface

The three threat-register mitigations assigned to this plan hold:

- **T-32-06** (orphaned binaries after delete): `deleteItem` `storage.remove` (Task 1, D-04) is the primary cleanup; the plan-01 pg_cron `purge-audio` reaper backstops delete paths that bypass `deleteItem`.
- **T-32-15** (cross-session blob delete): the plan-02 column-scoped DELETE storage RLS denies cross-session `remove`; `deleteItem` only operates on items already RLS-authorized.
- **T-32-16** (remove failure aborts item delete): `remove()` failure is logged + swallowed; the item delete proceeds; reaper reaps the orphan.

No new security surface beyond the plan's threat model — no new endpoints, schema, or trust boundaries introduced.

## Self-Check: PASSED

- `src/stores/sessionStore.ts` (`storage.from("audio").remove`) — present ✓
- `src/components/ItemCard.tsx` (`useAudioUploadStatus` + `retryFailedUploads` + `audio-upload-pill`) — present ✓
- Commits `eb0c3ea`, `99fe471`, `67939c7` — all found in git log ✓
- Target suites GREEN (3/3 + 4/4); full suite 544 passed / 0 failed; `tsc --noEmit` clean; eslint clean ✓

---
*Phase: 32-audio-blob-supabase-persistence*
*Completed: 2026-06-01*
