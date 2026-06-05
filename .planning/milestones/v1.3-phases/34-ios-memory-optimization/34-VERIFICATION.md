---
phase: 34-ios-memory-optimization
verified: 2026-06-01T13:51:00Z
status: passed
human_uat_note: "Human UAT completed 2026-06-04 (milestone-end walk)"
score: 7/7
overrides_applied: 0
human_verification:
  - test: "iOS Safari memory smoke — record several multi-MB audio items, observe JS-heap timeline in Web Inspector"
    expected: "No runaway heap growth / no tab OOM reload during a recording/cataloging session"
    why_human: "performance.measureUserAgentSpecificMemory() requires cross-origin isolation (COOP/COEP) which the PWA does not enable; iOS Safari Web Inspector heap timeline is the only available instrument on the target device"
---

# Phase 34: iOS Memory Optimization Verification Report

**Phase Goal:** iOS memory optimization — PERF-1 (bound blobToBase64 peak memory for multi-MB audio so the iOS PWA tab does not OOM), PERF-2 (continuous master-blob rework — DEFERRED per D-04/D-050, tracked-note only), PERF-3 (collapse ~4N per-card Dexie subscriptions into one ItemList aggregate; React.memo prop-driven ItemCard so a one-item state change re-renders only that card).
**Verified:** 2026-06-01T13:51:00Z
**Status:** human_needed (all automated checks pass; iOS on-device memory smoke is the only remaining gate)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | blobToBase64 encodes multi-MB audio without holding 3+ full copies (no whole-buffer binary string) | VERIFIED | `src/services/gemini.ts:148-160`: CHUNK_SIZE=32766 window, per-byte inner loop (`String.fromCharCode(bytes[j])`), no argument-spread over chunk. `result += btoa(binary)` accumulates chunk-by-chunk. |
| 2 | blobToBase64 output is byte-identical to the previous encoder (existing + multi-chunk tests stay green) | VERIFIED | `npx vitest --run src/tests/gemini-pipeline.test.ts -t blobToBase64` → 2 passed (11-byte baseline + 100KB multi-chunk). |
| 3 | Both gemini.ts and geminiContinuous.ts route audio through the single shared chunked encoder | VERIFIED | `geminiContinuous.ts:11` imports `blobToBase64` from `./gemini`; `geminiContinuous.ts:145` calls `await blobToBase64(geminiAudioBlob)`. No separate encoder defined in continuous path. |
| 4 | PERF-2 continuous master-blob rework is captured as a tracked deferred note, not silently dropped | VERIFIED | `src/services/geminiContinuous.ts:138-142`: comment contains tokens `PERF-2`, `D-04`, `D-050`. Greppable. No runtime behavior changed. |
| 5 | An ai_status/recording-state change on one item does NOT re-render the other N-1 ItemCards | VERIFIED | `npx vitest --run src/tests/item-card-render-count.test.tsx` → 1 passed. `arePropsEqual` comparator at `ItemCard.tsx:407-427` + stable `onToggle` dispatcher (`ItemList.tsx:189-201`) deliver the fan-out cut. |
| 6 | ItemCard is prop-driven for audioCount/latestAudioId/photoCount/dexieItemId/isPending — zero live queries or async effects for these values | VERIFIED | `grep -c "useLiveQuery" src/components/ItemCard.tsx` → 0. All 5 meta values destructured from props at `ItemCard.tsx:35-44`. No `useEffect`/`useLiveQuery` for these fields. |
| 7 | A two-part memory smoke runbook (Chrome heap + iOS Safari Web Inspector) with the COOP/COEP caveat is documented (D-09) | VERIFIED | `docs/runbooks/ios-memory-smoke.md` exists. Contains "measureUserAgentSpecificMemory", "Web Inspector", and the COOP/COEP cross-origin isolation caveat. Runbook check: OK. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/gemini.ts` | Chunked (3-byte-aligned) blobToBase64; freshBlob re-wrap retained with WHY-comment per D-02 contingency | VERIFIED | `CHUNK_SIZE = 32766` (line 148); per-byte loop (lines 156-159); `btoa(binary)` per chunk (line 160); freshBlob re-wrap retained at lines 136-143 with WHY-comment naming the structured-clone arrayBuffer() failure case. Contains `subarray`. |
| `src/services/geminiContinuous.ts` | Deferred PERF-2 note; encoder import unchanged | VERIFIED | PERF-2 token at line 138; `import { blobToBase64 } from "./gemini"` at line 11 unchanged; call at line 145 unchanged. |
| `src/components/ItemList.tsx` | Single aggregate useLiveQuery → Map<itemId, ItemMeta>; slices threaded as primitive props | VERIFIED | `useLiveQuery` aggregate at lines 51-72 builds `Map<string, ItemMeta>`; `EMPTY_META` at line 33; props `audioCount=`, `latestAudioId=`, `photoCount=`, `dexieItemId=`, `isPending=` threaded at lines 367-371. |
| `src/components/ItemCard.tsx` | Prop-driven, React.memo-wrapped card; dev-only __itemCardRenderCounts | VERIFIED | `__itemCardRenderCounts` exported at line 33; `React.memo(ItemCardImpl, arePropsEqual)` at line 429; no `useLiveQuery` in component. |
| `docs/runbooks/ios-memory-smoke.md` | D-09 manual memory verification procedure + COOP/COEP caveat | VERIFIED | File exists; contains "measureUserAgentSpecificMemory" and "Web Inspector". |
| `src/tests/gemini-pipeline.test.ts` | Multi-chunk blobToBase64 alignment guard | VERIFIED | "multi-chunk blob encodes identically to reference whole-buffer btoa" at line 121; 2/2 blobToBase64 tests pass. |
| `src/tests/item-card-render-count.test.tsx` | Render-fan-out assertion: one-item ai_status flip re-renders only that card | VERIFIED | File exists; imports `__itemCardRenderCounts` from `../components/ItemCard` (line 13); renders `ItemList` (lines 10, 75, 97); 1/1 test passes (GREEN). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/geminiContinuous.ts` | `src/services/gemini.ts blobToBase64` | `import { blobToBase64 } from './gemini'` | WIRED | Line 11 import + line 145 call verified. |
| `src/components/ItemList.tsx` | `src/components/ItemCard.tsx` | primitive meta props (`audioCount=`, etc.) | WIRED | Lines 361-372: all 5 props threaded to `<ItemCard>` in the non-compact render path. |
| `src/components/ItemCard.tsx handleRetryAi` | `processAudioWithAi` | `latestAudioId` prop | WIRED | `handleRetryAi` at lines 59-67 reads `latestAudioId` prop directly; retry-disabled guard at line 357; "No audio to retry" title at line 358. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ItemList.tsx` aggregate | `itemMeta` Map | `useLiveQuery` over `audioRecordsForItem`, `getDexieItemId`, `hasPendingForItem`, `db.photos.where().count()` | Yes — real Dexie queries | FLOWING |
| `ItemCard.tsx` meta props | `audioCount`, `latestAudioId`, `photoCount`, `dexieItemId`, `isPending` | Received from ItemList aggregate | Yes — passed as primitive props from live aggregate | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| blobToBase64 baseline + multi-chunk both green | `npx vitest --run src/tests/gemini-pipeline.test.ts -t blobToBase64` | 2 passed | PASS |
| Render-count test green (one-item flip re-renders only that card) | `npx vitest --run src/tests/item-card-render-count.test.tsx` | 1 passed | PASS |
| Audio-status regression test green | `npx vitest --run src/tests/item-card-audio-status.test.tsx` | 4 passed | PASS |
| Runbook exists with required tokens | `test -f ... && grep -q measureUserAgentSpecificMemory ... && grep -qi "web inspector"` | OK | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` found; phase has no declared probes. Behavioral spot-checks above cover the testable contracts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PERF-1 | 34-00, 34-01 | Bound blobToBase64 peak memory for multi-MB audio (no whole-buffer binary string); iOS PWA tab does not OOM | SATISFIED | Chunked encoder with per-byte loop at `gemini.ts:148-160`; multi-chunk test + integration tests green; CR-01 iOS spread-overflow fix confirmed (no `...chunk` spread). |
| PERF-2 | 34-01 | Continuous master-blob rework — intentionally DEFERRED | SATISFIED (deferred, tracked) | Greppable "PERF-2" deferred note at `geminiContinuous.ts:138-142`; D-04/D-050 referenced. Per phase instructions: verify tracked note exists, not implementation. |
| PERF-3 | 34-00, 34-02 | Collapse ~4N per-card Dexie subscriptions into one ItemList aggregate; React.memo prop-driven ItemCard | SATISFIED | One aggregate `useLiveQuery` in ItemList; `useLiveQuery` count in ItemCard = 0; `React.memo(ItemCardImpl, arePropsEqual)` present; render-count test green. |

Note: REQUIREMENTS.md at `.planning/REQUIREMENTS.md` covers milestone v1.2 (UI Overhaul) and does not define PERF-1/PERF-2/PERF-3. These IDs are phase-local to the v1.3 milestone. Requirements are tracked in plan frontmatter and phase docs only.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `gemini.ts` | 38-39 | "XXXXX-N" and "new_item_detected" in grep for XXX | Info | False positive — these appear inside the SYSTEM_PROMPT string literal (prompt instructions for receipt number format), not code debt markers. No actual XXX/TBD/FIXME markers found in modified files. |
| `ItemList.tsx` | 58-59, 137 | `a.id!` non-null assertions on `ItemAudio.id` (which is legitimately optional) | Warning | Already documented as WR-01/IN-01 in 34-REVIEW.md. `latestAudioId` reduce can yield `undefined` for cross-device-only rows. Masked downstream by `meta?.latestAudioId ?? null` at call site. Known quality gap, not a phase-goal blocker. |

No unreferenced TBD/FIXME/XXX debt markers found in any phase-modified file.

### Human Verification Required

#### 1. iOS Safari On-Device Memory Smoke (PERF-1)

**Test:** On a real iOS device, open the TPC PWA in Safari. Open Web Inspector JS-heap timeline (macOS Xcode → Window → Devices and Simulators → device → open Web Inspector). Record 5+ multi-MB audio items in a single session and let them process through AI. Observe the JS-heap timeline.

**Expected:** No monotonic runaway growth. Heap should plateau or grow sub-linearly between recordings (not climb by several MB per recording as the pre-fix code did). No tab reload (OOM).

**Why human:** `performance.measureUserAgentSpecificMemory()` is Chromium-only and requires COOP/COEP cross-origin isolation headers, which the TPC PWA does not set. iOS Safari Web Inspector heap timeline is the only available instrument on the target platform. This is the D-09 decision — intentionally not a CI test. The runbook is at `docs/runbooks/ios-memory-smoke.md`.

---

## Gaps Summary

No gaps. All 7 must-haves are VERIFIED. The single outstanding item is the iOS on-device memory smoke (human verification), which is by design a manual runbook per D-09.

**CR-01 status (REVIEW blocker, now resolved):** The REVIEW raised a critical issue — the initial encoder used `String.fromCharCode(...chunk)` (32766-arg spread) which overflows JavaScriptCore's argument stack on iOS Safari. The code at `src/services/gemini.ts:152-158` shows the fix is in place: a `// Per-byte append, not String.fromCharCode(...chunk)` comment and a `for (let j = i; j < end; j++) { binary += String.fromCharCode(bytes[j]); }` inner loop. No argument-spread over a large chunk. This was the `f655226` commit referenced in the phase context.

**D-02 freshBlob re-wrap:** Per phase context and SUMMARY, the re-wrap was intentionally retained as D-02's contingency clause. The WHY-comment is present at `gemini.ts:136-141`. This is not a gap — the memory win (PERF-1) comes from eliminating the whole-buffer binary string via chunked encode, which is confirmed present.

---

_Verified: 2026-06-01T13:51:00Z_
_Verifier: Claude (gsd-verifier)_
