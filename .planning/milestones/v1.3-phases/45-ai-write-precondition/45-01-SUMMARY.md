---
phase: 45-ai-write-precondition
plan: 01
subsystem: ai-write-back
tags: [concurrency, optimistic-locking, lost-write, gemini, preconditionUpdate]
requires:
  - "src/db/optimisticUpdate.ts:preconditionUpdate (Phase 39 Plan 03)"
provides:
  - "preconditionUpdate-routed single-item AI success write with compare-and-skip reconcile"
affects:
  - "src/services/gemini.ts processAudioWithAi success write-path"
tech-stack:
  added: []
  patterns:
    - "Single-item AI write mirrors geminiContinuous reconcile: catalog field changed since AI read → yield (D-06); control + untouched fields re-apply against fresh token"
key-files:
  created:
    - src/tests/gemini-precondition.test.ts
  modified:
    - src/services/gemini.ts
    - src/tests/gemini-pipeline.test.ts
decisions:
  - "Single-item CATALOG_FIELDS includes receipt_number (continuous MERGE_FIELDS omits it because continuous locks the receipt; the single-item path writes it, so it must be in the yield set)"
  - "hasExistingData merge-context heuristic switched from `!== null` to `!= null` so the added updated_at column (always non-null) can't force MERGE mode, and a missing-column fixture is treated like a null row"
metrics:
  duration: 3 min
  completed: 2026-06-04
  tasks: 2
  files: 3
---

# Phase 45 Plan 01: AI Write Precondition Summary

Routed the dominant single-item AI write-back (`processAudioWithAi`) through `preconditionUpdate` with a per-field compare-and-skip reconcile, closing the SEAM-3 lost-write gap: a concurrent human edit (another tab/device) to an untouched catalog field between the AI snapshot read and write is no longer silently clobbered.

## What was built

- **Task 1 (RED):** `src/tests/gemini-precondition.test.ts` mocks `../db/optimisticUpdate` with a hoisted `mockPreconditionUpdate` and asserts (A) the fresh success write calls `preconditionUpdate({ table:"items", id, prevUpdatedAt: <snapshot updated_at> })` with a patch carrying `ai_status:"done"` + `completed_at` (and NO bare catalog `.update().eq("id")`), and (B) the captured `reconcile` drops a concurrently-changed catalog field (`fresh.title !== valueAtRead.title`) while keeping control + untouched fields. Failed RED on the unfixed `gemini.ts`. Commit `e73a826`.
- **Task 2 (GREEN):** `src/services/gemini.ts` — imported `preconditionUpdate` + `ReconcileFn`, added a single-item `CATALOG_FIELDS` yield set, extended the snapshot read to also select `updated_at` (capturing `prevUpdatedAt` + a `valueAtRead` catalog snapshot), and replaced the bare `supabase.from("items").update(supabaseUpdate).eq("id", itemId)` with `preconditionUpdate({ table:"items", id:itemId, prevUpdatedAt, patch:supabaseUpdate, reconcile })`. The reconcile mirrors `geminiContinuous.ts:286-303`. Commit `3a3375c`.

The `flagged` (user-edited) per-device skip, the claim guard, clear-on-fresh, `trackEvent`, store refresh, and the control-only failure-path write are all preserved unchanged. `updated_at` is never put in the patch (the trigger owns the bump); no loop (preconditionUpdate owns the bounded retry + exhaustion toast).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `hasExistingData` would force MERGE mode after adding `updated_at` to the select**
- **Found during:** Task 2
- **Issue:** The original `Object.values(currentItem).some(v => v !== null)` over the exact selected catalog columns became always-true once `updated_at` (always non-null) was added to the select — every recording would have been sent with the MERGE prompt instead of the simple-extraction prompt on a first recording.
- **Fix:** Compute `hasExistingData` over `CATALOG_FIELDS` only (excluding the concurrency token), using `!= null` so a missing column / undefined is treated like a null row.
- **Files modified:** src/services/gemini.ts
- **Commit:** 3a3375c

**2. [Rule 1 - Bug] gemini-pipeline.test.ts encoded the superseded bare-write contract**
- **Found during:** Task 2
- **Issue:** Four `gemini-pipeline` tests asserted the catalog success write via the bare `.update().eq("id")` mock chain. Routing through the real `preconditionUpdate` appends an `updated_at` precondition + terminal `.select()` (`.update(patch).eq("id").eq("updated_at").select()`), which the mock didn't support — the write threw and fell to the failure path, flipping the recorded last write to `ai_status:"failed"`.
- **Fix:** Extended `createMockFrom`'s `update().eq()` chain to support the precondition write shape (a second `.eq()` → `.select()` resolving an applied row). The catalog patch is still captured in `updateCalls` at `update()` time, so every existing assertion holds unchanged. This is the same superseded-contract re-point precedent as Phase 39 Plan 03 (`geminiContinuous.test.ts`).
- **Files modified:** src/tests/gemini-pipeline.test.ts
- **Commit:** 3a3375c

Scope note: the plan's `files_modified` listed two files; the pipeline-test re-point is a required, contract-superseding consequence of the production change (mirrors the Phase 39 P03 precedent) rather than new scope. No edits to `optimisticUpdate.ts`, `geminiContinuous.ts`, schema, or `database.types.ts`.

## Verification

- `npx vitest --run src/tests/gemini-precondition.test.ts` — PASS (2/2; was RED before Task 2).
- `npx vitest --run src/tests/gemini-no-clobber.test.ts src/tests/gemini-pipeline.test.ts` — PASS (flagged-skip + pipeline behavior unregressed).
- `npx tsc -b` — exit 0.
- Full suite: 721 passed, 4 files skipped, 49 todo.
- `grep -n 'preconditionUpdate({' src/services/gemini.ts` → line 476 (match). `grep '.update(supabaseUpdate)'` → gone.

## Threat Model

- **T-45-01 (mitigated):** the single-item AI write no longer does last-writer-wins; a field another writer changed since the AI read yields (D-06). Locked by `gemini-precondition.test.ts` Case B.
- **T-45-02 (accepted, unchanged):** failure-path `ai_status`-only write is control-only; left as-is.

## Self-Check: PASSED

- FOUND: src/tests/gemini-precondition.test.ts
- FOUND: src/services/gemini.ts (preconditionUpdate import + call)
- FOUND commit e73a826 (RED), 3a3375c (GREEN)

## TDD Gate Compliance

RED commit `e73a826` (`test(45-01)`) precedes GREEN commit `3a3375c` (`feat(45-01)`). No refactor commit needed. Gate sequence satisfied.
