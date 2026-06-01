---
phase: 34-ios-memory-optimization
plan: 01
subsystem: ai-audio-encode
tags: [perf, memory, ios, base64, gemini, tdd]
requires:
  - "34-00 RED tests (gemini-pipeline multi-chunk + baseline equality)"
provides:
  - "chunked 3-byte-aligned blobToBase64 (bounded peak memory)"
  - "tracked PERF-2 deferred note in geminiContinuous.ts"
affects:
  - src/services/gemini.ts
  - src/services/geminiContinuous.ts
tech-stack:
  added: []
  patterns:
    - "Fixed-window (32766 = 0x8000-2, divisible by 3) chunked base64 via Uint8Array.subarray + btoa"
key-files:
  created: []
  modified:
    - src/services/gemini.ts
    - src/services/geminiContinuous.ts
decisions:
  - "D-02 re-wrap RETAINED (contingency exercised): structured-clone-deserialized Dexie blobs lack a live arrayBuffer(); Response API mis-encodes blobs in jsdom — re-wrap is the only path that keeps both encoder + integration tests green"
metrics:
  duration: ~15m
  completed: 2026-06-01
  tasks: 2
  files: 2
---

# Phase 34 Plan 01: Chunked base64 encoder (PERF-1) Summary

Replaced the per-byte whole-buffer `blobToBase64` with a 3-byte-aligned (32766-byte) chunked encoder using `Uint8Array.subarray` + per-chunk `btoa`, bounding peak memory to ~one window plus the growing output string instead of holding a full-size binary string. Both encoder tests (11-byte baseline + 100 KB multi-chunk) and the `processAudioWithAi` integration path stay byte-identical and green. Captured the PERF-2 continuous master-blob rework as a greppable deferred note (D-04/D-050) without changing continuous runtime behavior.

## What Changed

- **`src/services/gemini.ts` — `blobToBase64`**: dropped the `for (i) binary += String.fromCharCode(bytes[i])` whole-buffer string. Now iterates in `CHUNK_SIZE = 32766` windows via `bytes.subarray(i, i + CHUNK_SIZE)` (a view, no copy) and accumulates `btoa(String.fromCharCode(...chunk))`. Window is divisible by 3 so per-chunk concatenation is byte-identical to a single whole-buffer `btoa` (Pitfall 1). Export name + `(blob: Blob): Promise<string>` signature unchanged (two consumers).
- **`src/services/geminiContinuous.ts`**: added a deferred-note comment at the `geminiAudioBlob` assembly path (token `PERF-2`, refs `D-04` + `D-050`). The `blobToBase64` import/call is untouched — the single shared encoder already serves both paths (D-03 structurally satisfied).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | GREEN: chunked 3-byte-aligned blobToBase64 | `1a5bade` | src/services/gemini.ts |
| 2 | Deferred PERF-2 note (D-04) | `83557bd` | src/services/geminiContinuous.ts |

## Verification

- `npx vitest --run src/tests/gemini-pipeline.test.ts` → 15/15 green (baseline `blobToBase64`, 100 KB multi-chunk equality, `processAudioWithAi` inlineData path).
- `npx vitest --run src/tests/geminiContinuous.test.ts` → 9/9 green.
- `grep -n "subarray" src/services/gemini.ts` → present (chunked window).
- `grep -n "PERF-2" src/services/geminiContinuous.ts` → deferred note present.
- `npx tsc --noEmit` → clean.
- Full suite: 592 passed, 1 failed (out-of-scope PERF-3 RED scaffold — see Deferred Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] D-02 `freshBlob` re-wrap RETAINED, not dropped**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's success criteria + verification call for dropping the `freshBlob = new Blob([blob])` re-wrap and grepping for zero `freshBlob` matches. Dropping it broke the `processAudioWithAi` suite: a blob read back out of Dexie (fake-indexeddb / structured-clone deserialized) lacks a live `arrayBuffer()` method, so `blob.arrayBuffer()` throws `"blob.arrayBuffer is not a function"`. This is precisely the "structured clone edge case" the original re-wrap guarded against.
- **Alternatives tried:** `new Response(blob).arrayBuffer()` (the path the stale docstring claimed) — jsdom mis-encodes the blob as the literal string `[object Blob]` (`W29iamVjdCBCbG9iXQ==`), failing both encoder tests. Rejected.
- **Fix:** Restored the single-copy `new Blob([blob], { type })` re-wrap with an explicit WHY-comment naming the failing case, exactly as D-02's own contingency clause permits ("If a structured-clone failure surfaces ... restore the re-wrap with a WHY-comment naming the exact failing case"). The memory win (PERF-1) comes entirely from the chunked encode replacing the whole-buffer binary string — the re-wrap is one bounded copy, not the OOM culprit. Net peak is bounded as intended.
- **Files modified:** src/services/gemini.ts
- **Commit:** `1a5bade`
- **Impact on success criteria:** The "no `freshBlob` re-wrap" criterion is intentionally NOT met; D-02's escape hatch takes precedence over the optimistic drop. All other criteria (3-byte-aligned chunked window via subarray, no whole-buffer binary string, byte-identical output, single shared encoder, greppable PERF-2 note) are met.

## Deferred Issues

- **PERF-3 RED scaffold still failing** (`src/tests/item-card-render-count.test.tsx` — "flipping one item's ai_status re-renders only that card"). This is the Wave-0 RED test for PERF-3 / D-08 (ItemList render fan-out), a separate plan in this phase. It mocks `../services/gemini` wholesale and does not touch `blobToBase64`. Out of scope for plan 34-01; remains RED until the PERF-3 plan implements it.

## Self-Check: PASSED

- src/services/gemini.ts — FOUND (modified, subarray + CHUNK_SIZE 32766)
- src/services/geminiContinuous.ts — FOUND (modified, PERF-2 note)
- Commit `1a5bade` — FOUND
- Commit `83557bd` — FOUND
