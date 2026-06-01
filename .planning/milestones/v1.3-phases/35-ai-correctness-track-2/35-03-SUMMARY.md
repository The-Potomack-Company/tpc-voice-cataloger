---
phase: 35-ai-correctness-track-2
plan: 03
subsystem: ui
tags: [ai-failure, item-card, parity, tdd]
requires:
  - "35-01 (RED test src/tests/item-card-ai-failure.test.tsx)"
provides:
  - "Shared AiFailureBanner component (list + detail visual parity)"
  - "Full-width inline AI-failure row on failed item cards (SC-4)"
affects:
  - src/components/ItemCard.tsx
  - src/pages/ItemEntry.tsx
tech-stack:
  added: []
  patterns:
    - "Lift presentational component to shared module; callers supply data via props"
    - "Forward-compatible optional-param call via local type alias (cross-plan signature change in 35-04)"
key-files:
  created:
    - src/components/AiFailureBanner.tsx
  modified:
    - src/pages/ItemEntry.tsx
    - src/components/ItemCard.tsx
decisions:
  - "D-07: failed card shows full-width inline AiFailureBanner row, not a terse Failed badge"
  - "D-08: retry reuses existing processAudioWithAi; no new retry plumbing"
metrics:
  duration: "~6 min"
  completed: "2026-06-01"
  tasks: 2
  files: 3
---

# Phase 35 Plan 03: Failed-card AI-failure row (list/detail parity) Summary

Lifted the detail-page `AiFailureBanner` into a shared `src/components/AiFailureBanner.tsx` and rendered it as a full-width inline failure row on failed item cards, replacing the terse `<Badge tone="err">Failed</Badge>` — one component now backs both list and detail views (D-07), reusing the existing `processAudioWithAi` retry path (D-08). Turns SC-4 green.

## What changed

- **`src/components/AiFailureBanner.tsx` (new):** Exports `AiFailureBanner({ itemId, sessionId, latestAudioId })`. Same `role="alert"` markup, `border-err`/`bg-err-wash` palette, `tpc-status-dot-err`, "AI processing failed" copy, and spinner Retry button lifted verbatim from ItemEntry's local copy. `latestAudioId` is a PROP (not a local `useLiveQuery`) so the card passes its prop and the detail page passes its own query result. Keeps the `retrying` state and `if (latestAudioId == null) return null;` guard. Retry calls `processAudioWithAi(latestAudioId, itemId, sessionId, true)` (isRetry=true, O-1).
- **`src/pages/ItemEntry.tsx`:** Deleted the local `AiFailureBanner` function, imported the shared one, added a page-level `useLiveQuery(audioRecordsForItem)` (`bannerLatestAudioId`) and passes it to the banner at the existing render site. Dropped the now-unused `processAudioWithAi` import.
- **`src/components/ItemCard.tsx`:** Imported `AiFailureBanner`, removed the terse Failed badge from the indicator row, and render the shared banner as a full-width row (border-t separator) beneath the collapsed row, gated on `isFailed`. Passes the card's existing `latestAudioId` prop. Card's own `handleRetryAi`/`retrying` kept — still used by the expanded "Stuck? Retry Processing" button (`isProcessing` path).

## Verification

- `npx vitest --run src/tests/item-card-ai-failure.test.tsx` → 2/2 green (alert + "AI processing failed" + Retry on failed; no alert on done)
- `item-card-audio-status.test.tsx` → 4/4 still green (no regression)
- `grep -c "function AiFailureBanner" src/pages/ItemEntry.tsx` → 0 (local copy lifted)
- `grep -c "AiFailureBanner" src/components/ItemCard.tsx` → 3 (import + render + comment)
- `grep -c 'tone="err">Failed' src/components/ItemCard.tsx` → 0 (terse badge gone)
- `npx tsc --noEmit -p tsconfig.app.json` → clean (exit 0)
- STATE.md / ROADMAP.md untouched (worktree mode — orchestrator owns those)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forward-compatible `isRetry` 4th-arg call**
- **Found during:** Task 1
- **Issue:** The plan instructs passing `processAudioWithAi(..., true)` (4th `isRetry` arg), but that optional param is added by Plan 35-04, which runs in a disjoint concurrent worktree and is NOT a dependency of 35-03 (depends_on: ["35-01"]). The live 3-arg signature in this worktree caused `error TS2554: Expected 3 arguments, but got 4`.
- **Fix:** Added a local type alias `ProcessAudioWithAi` (with optional `isRetry?: boolean`) and call through `processAudioWithAiRetry`, a cast of the imported function. Typecheck is clean now and the cast remains correct (no-op) once 35-04's real optional param merges. Service file (`src/services/gemini.ts`) was NOT touched — it is owned by 35-02/35-04.
- **Files modified:** src/components/AiFailureBanner.tsx
- **Commit:** b38e227

## Threat Flags

None. No new network/auth/file/schema surface — the row is a presentational read of the server-authored `ai_status`. Threat register dispositions (T-35-04 accept, T-35-05 accept, T-35-SC mitigate/no-installs) hold; no npm installs this plan.

## Known Stubs

None.

## TDD Gate Compliance

This plan is the GREEN half of the RED test added in 35-01 (`src/tests/item-card-ai-failure.test.tsx`). The RED gate (`test(...)` commit) was landed in 35-01; this plan provides the GREEN gate (`feat(...)` commits b38e227, a2f0145). The test was confirmed failing on the "failed" case before Task 2 and passing (2/2) after. No REFACTOR commit needed.

## Self-Check: PASSED

- FOUND: src/components/AiFailureBanner.tsx
- FOUND: src/pages/ItemEntry.tsx (modified)
- FOUND: src/components/ItemCard.tsx (modified)
- FOUND commit: b38e227 (Task 1)
- FOUND commit: a2f0145 (Task 2)
