---
phase: 34-ios-memory-optimization
plan: 00
subsystem: testing
tags: [tdd, red-first, perf, base64, react-memo, render-fanout]
requires: []
provides:
  - "multi-chunk blobToBase64 alignment guard (PERF-1)"
  - "RED render-fan-out test forward-referencing __itemCardRenderCounts (PERF-3, D-08)"
affects:
  - "Plan 01 (chunked base64 encoder) must keep this green"
  - "Plan 02 (ItemList aggregate + React.memo ItemCard) turns the render test green"
tech-stack:
  added: []
  patterns:
    - "RED-first TDD: tests authored before production code"
    - "reference-oracle base64 (whole-buffer btoa) avoids tautology"
    - "forward-referenced dev-only render counter export (__itemCardRenderCounts)"
key-files:
  created:
    - src/tests/item-card-render-count.test.tsx
  modified:
    - src/tests/gemini-pipeline.test.ts
decisions:
  - "Reference oracle builds the binary string in 8192-byte slices then btoa once — avoids String.fromCharCode(...spread) stack overflow on 100k bytes while staying chunk-free (no per-chunk btoa, so it cannot share the alignment bug it guards against)."
  - "Mock useSessionItems (../hooks/useSessions) rather than Dexie internals to drive ItemList's 3 deterministic items; flip ai_status by returning a new array between renders."
metrics:
  duration: 1 min
  completed: 2026-06-01
---

# Phase 34 Plan 00: Wave 0 RED Tests Summary

Authored two TDD tests that pin the PERF-1 and PERF-3 behavioral contracts before any production code: a multi-chunk `blobToBase64` alignment guard (green against the current encoder, fails if Plan 01 picks a non-3-aligned chunk window) and a RED render-fan-out test that forward-references `__itemCardRenderCounts` and `React.memo` (delivered by Plan 02).

## What Was Built

### Task 1 — Multi-chunk base64 alignment guard (PERF-1)
- Added a sibling `it("multi-chunk ...")` inside the existing `describe("blobToBase64")` block in `src/tests/gemini-pipeline.test.ts`.
- Builds a deterministic 100,000-byte `Uint8Array` (`bytes[i] = i % 256`), wraps it in a `Blob`, and asserts `blobToBase64(blob)` equals a reference base64 computed by encoding the whole buffer in one pass (`btoa` over a slice-built binary string).
- Passes today against the current per-byte encoder. Once Plan 01 chunks the encoder, this is the only test that catches a non-3-byte-aligned window (Pitfall 1) — the existing 11-byte test passes regardless of alignment.
- Commit: `ef5c206`

### Task 2 — RED render-fan-out test (PERF-3, D-08)
- Created `src/tests/item-card-render-count.test.tsx` reusing the mock harness from `item-card-audio-status.test.tsx`.
- Mocks `useSessionItems` to feed `ItemList` 3 deterministic items; renders `<ItemList sessionId="session-uuid-1" mode="house" />`, flips one item's `ai_status` (`queued` → `done`) on rerender, and asserts only the flipped card's render count incremented.
- Imports `{ __itemCardRenderCounts }` from `../components/ItemCard` — a symbol Plan 02 introduces. Today it resolves to `undefined`, so `__itemCardRenderCounts.clear()` throws: genuinely RED.
- Commit: `7b7481b`

## Verification

- `npx vitest --run src/tests/gemini-pipeline.test.ts -t blobToBase64` → 2 passed (existing 11-byte + new multi-chunk), current encoder. GREEN.
- `npx vitest --run src/tests/item-card-render-count.test.tsx` → fails with `TypeError: Cannot read properties of undefined (reading 'clear')` on `__itemCardRenderCounts`. Verify command prints `RED-OK`. Genuinely RED (forward-reference unresolved).

## TDD Gate Compliance

Both tasks are `test(...)` commits (RED gate for the phase). No `feat(...)` here by design — this is Wave 0, the RED-first wave. Plan 01 (encoder GREEN) and Plan 02 (render-count GREEN + refactor) provide the GREEN gates. Note: Task 1's test is GREEN-on-arrival against the current encoder by design — it is an alignment *guard* that only goes RED under a future mis-aligned chunk choice; the genuinely-RED gate for the phase is Task 2.

## Deviations from Plan

None — plan executed exactly as written. No production source touched.

## Self-Check: PASSED

- FOUND: src/tests/gemini-pipeline.test.ts (modified)
- FOUND: src/tests/item-card-render-count.test.tsx (created)
- FOUND: commit ef5c206 (Task 1)
- FOUND: commit 7b7481b (Task 2)
