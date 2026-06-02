---
phase: 39-optimistic-locking
plan: 03
subsystem: ai-merge / offline-queue / optimistic-concurrency
wave: 2
status: complete
tasks_completed: 2
tasks_total: 2
requirements: [DAT-3]
tags: [optimistic-locking, ai-merge, write-ahead-queue, reconcile, no-clobber]
requires:
  - "39-02: src/db/optimisticUpdate.ts:preconditionUpdate (shared 0-row + bounded reconcile helper)"
  - "39-02: offline enqueue payload carries updated_at snapshot (D-04)"
  - "39-01: items.updated_at trigger (prod) + database.types.ts + RED specs"
provides:
  - "mergeFieldsIntoItem (exported) — AI continuous-merge composes preconditionUpdate with D-06 per-field compare-and-skip (AI yields to user)"
  - "useWriteAheadQueue flush — items-update branch applies .eq(updated_at) precondition + reconcile + Pitfall-5 retain + Pitfall-6 legacy fallback"
  - "WriteAheadEntry.payload updated_at snapshot convention documented (no Dexie bump)"
affects:
  - "continuous-merge path is dormant (CONTINUOUS_MODE_ENABLED=false, D-050) — correct for revival, not enabled here"
tech-stack:
  added: []
  patterns:
    - "AI-yields reconcile: drop catalog fields where fresh server value !== value-at-read (D-06), re-apply the rest + control fields"
    - "offline flush re-read-then-precondition fallback for legacy snapshot-less entries"
    - "skip stale in-memory queue entry already dropped by a permanent-failure cascade"
key-files:
  created: []
  modified:
    - src/services/geminiContinuous.ts
    - src/hooks/useWriteAheadQueue.ts
    - src/db/types.ts
    - src/tests/write-ahead-queue.test.ts
    - src/tests/geminiContinuous.test.ts
decisions:
  - "D-06: on AI-merge conflict, any catalog field the user changed since value-at-read is skipped (AI yields); untouched fields + ai_status re-apply against the fresh token"
  - "D-04: offline flush honors the updated_at precondition; 0-row exhaustion retains the queue entry (no silent lost write, Pitfall 5)"
  - "Pitfall 6: a legacy entry without an updated_at snapshot re-reads the current token then preconditions — never an unconditional last-writer-wins write"
commits:
  - 5f74aca
  - 704f7f6
  - cc0de52
metrics:
  duration_min: 9
  completed: "2026-06-02"
---

# Phase 39 Plan 03: AI continuous-merge + offline-flush no-clobber Summary

Closed the two remaining lost-update write paths by composing the Plan 02 `preconditionUpdate` helper: the AI continuous-merge (`mergeFieldsIntoItem`) gained D-06 per-field compare-and-skip so it yields to any field the user changed since the merge read (the HEADLINE race), and the offline write-ahead flush now applies the `updated_at` precondition, reconciles 0-row results without dropping the queue entry, and tolerates legacy snapshot-less entries.

## What was built

### Task 1 — `mergeFieldsIntoItem` D-06 compare-and-skip (commit 5f74aca)
`src/services/geminiContinuous.ts`. The merge stopped writing field-by-field through `sessionStore.updateItemField` (which uses the user-edit reconcile — last human intent wins, the WRONG policy for the AI) and now:

1. **Captures value-at-read:** reads the item row (`select("*").eq("id").maybeSingle()`) before the write, snapshotting per-field `valueAtRead` for the 7 catalog `MERGE_FIELDS` plus the `updated_at` token. No extra Gemini round-trip — the snapshot is this DB read, not a model call.
2. **Builds the formatted AI patch** (toAllCaps/title, spoken-punctuation, estimate/category/measurements formatting unchanged) plus `ai_status: "done"`.
3. **Composes `preconditionUpdate`** with a custom AI-yields reconcile: on a 0-row conflict, for each catalog field, `fresh[field] !== valueAtRead[field]` → the user changed it → drop it (D-06/D-08); control fields (`ai_status`) and untouched catalog fields re-apply against the fresh token. An all-skipped patch becomes a `noop` (helper's empty-patch short-circuit).
4. Exported (`export async function`) so the HEADLINE test drives it directly; refreshes local state via `fetchItems(sessionId)` for dormant-UI revival (D-050).

The Phase-35 `userEditedFields` guard in `db/items.ts` is untouched — it gates the AI **retry** path; this gates the continuous **merge** path (complementary guards, different write paths).

### Task 2 — offline flush precondition + reconcile + legacy fallback (commit 704f7f6)
`src/hooks/useWriteAheadQueue.ts` update branch:

- **Precondition on flush:** destructure `updated_at` OUT of the patch (snapshot WHERE-token, not a SET column — the trigger owns the bump), compose `preconditionUpdate` (`.update(rest).eq("id").eq("updated_at", snapshot).select()`).
- **Pitfall 5 (no silent lost write):** an `exhausted` result (precondition keeps missing, row still present) retains the queue entry — only `applied`/`noop` entries are deleted.
- **Pitfall 6 (legacy fallback):** a pre-Phase-39 entry with no `updated_at` re-reads the row's current token first, then preconditions — never an unconditional last-writer-wins write, never a crash.
- **Stale-entry guard:** skip an in-memory entry already removed by a prior iteration's permanent-failure same-item cascade (D-09), so its write isn't re-issued (this also prevented a regression in the existing permanent-drop test now that the update branch re-reads).
- Insert/delete branches, `classifyAiError` permanent/transient classification, FIFO ordering, and WR-05 transient re-drain are unchanged.

`src/db/types.ts`: added a WHY-comment on `WriteAheadEntry.payload` documenting the `updated_at` snapshot convention. No structural change, no Dexie version bump (payload is already an open Record).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract supersession] `src/tests/geminiContinuous.test.ts` (commit cc0de52)**
- **Found during:** Task 1 full-suite verification.
- **Issue:** 6 pre-existing tests asserted `mergeFieldsIntoItem` writes per-field via `sessionStore.updateItemField`. That contract is exactly what Plan 03 supersedes — the new HEADLINE contract (RED spec from Plan 01) requires the merge to write through `preconditionUpdate`/supabase with the AI-yields reconcile, and mocks `updateItemField` as inert. The two contracts are mutually exclusive for the same function.
- **Fix:** Updated mock plumbing + assertions to inspect the recorded `preconditionUpdate` patch (`[itemId, patch]`) instead of `updateItemField` calls, and added `fetchItems` to the sessionStore mock. The tests' *intent* (correct fields → correct item, FIFO serialization, stale-snapshot routing, abort behavior) is fully preserved.
- **Commit:** cc0de52

**2. [Rule 1 - Mock plumbing] `write-ahead-queue.test.ts` legacy-routing test (commit 704f7f6)**
- **Found during:** Task 2.
- **Issue:** The pre-existing "calls update().eq('id')" test (a legacy `{id,title}` entry, no `updated_at`) used a single-`.eq()` terminal mock that the new re-read-then-precondition path would crash on.
- **Fix:** Mock plumbing only — made the mock support the re-read (`select().eq().maybeSingle()`) + double-`.eq().select()` chain. The original routing assertions (`update({title})`, `.eq("id","uuid-1")`) are unchanged and still hold.
- **Commit:** 704f7f6

No architectural (Rule 4) changes. No new dependencies. No schema/migration/database.types.ts changes. No Supabase/auth/RLS work.

## TDD Gate Compliance
This is the GREEN wave of a `type: tdd` plan: the RED specs were committed in Plan 01 (`test(39-01)` 8881693, predating this wave). This wave's `feat(39-03)` commits turn them GREEN; the supporting `test(39-03)` commit updates a superseded sibling contract. RED→GREEN sequence holds across the plan.

## Verification

- `continuous-merge-no-clobber.test.ts` — **1/1 GREEN** (HEADLINE: user-changed field dropped, untouched field re-applied).
- `write-ahead-queue.test.ts` — **17/17 GREEN** (3 Phase-39 precondition/reconcile/legacy + 14 pre-existing FIFO/permanent-drop/transient-redrain all green).
- `optimistic-update.test.ts` — **4/4 GREEN** (Plan 02, no regression).
- `geminiContinuous.test.ts` — **9/9 GREEN** (re-pointed to the new write path).
- Full suite: **708 passed, 0 failed**, 49 todo, 4 skipped (96 files).
- `npm run build` (tsc + vite): **clean** (only the pre-existing advisory chunk-size note).

## Known Stubs
None. The continuous-merge path is dormant by config (`CONTINUOUS_MODE_ENABLED=false`, D-050) — not a stub; the logic is correct and test-proven for revival.

## Self-Check: PASSED
- `src/services/geminiContinuous.ts` — FOUND (modified)
- `src/hooks/useWriteAheadQueue.ts` — FOUND (modified)
- `src/db/types.ts` — FOUND (modified)
- Commit 5f74aca — FOUND
- Commit 704f7f6 — FOUND
- Commit cc0de52 — FOUND
