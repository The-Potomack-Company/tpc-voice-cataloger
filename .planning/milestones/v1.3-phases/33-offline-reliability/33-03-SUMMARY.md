---
phase: 33-offline-reliability
plan: 03
subsystem: offline-reliability
tags: [write-ahead-queue, error-classification, offline, ui-badge, REL-3]
requires:
  - "src/utils/aiErrorClass.ts (classifyAiError — Wave-0 / 33-00)"
  - "src/ui/Badge.tsx (tone=err primitive)"
provides:
  - "classify-driven write-ahead drain (permanent drop+continue / transient halt)"
  - "BlockedQueueBadge (blocked-count badge + detail list, D-10)"
affects:
  - "src/hooks/useWriteAheadQueue.ts"
  - "src/layouts/AppLayout.tsx"
tech-stack:
  added: []
  patterns:
    - "classifyAiError-driven branch in queue drains (D-08/D-09)"
    - "render-nothing-when-empty badge mirroring OfflineIndicator (D-10)"
key-files:
  created:
    - "src/components/BlockedQueueBadge.tsx"
  modified:
    - "src/hooks/useWriteAheadQueue.ts"
    - "src/layouts/AppLayout.tsx"
    - "src/tests/write-ahead-queue.test.ts"
    - "src/tests/blocked-badge.test.tsx"
decisions:
  - "Normalize Supabase PostgrestError plain-objects to Error before classifyAiError, since the locked Wave-0 classifier only reads .message off Error instances."
metrics:
  duration: "~25m"
  completed: "2026-06-01"
  tasks: 2
  files: 5
---

# Phase 33 Plan 03: Write-Ahead Classify + Blocked-Count Badge Summary

REL-3: replaced the write-ahead drain's unconditional break-on-first-failure with `classifyAiError`-driven behavior (permanent → drop failing entry + same-item dependents and continue; transient → halt preserving FIFO), and added a `tone="err"` blocked-count badge next to OfflineIndicator that opens a detail list of `ai_status='failed'` items.

## What Was Built

### Task 1 — Classify-driven drop/continue vs halt (TDD)
- `src/hooks/useWriteAheadQueue.ts`: the unconditional `break` in the drain catch block is replaced with `const kind = classifyAiError(toError(err))`.
  - **PERMANENT** (4xx / validation): delete the failing entry and every queued entry for the same item (matched by `payload.id` or `tempId`, reusing the `hasPendingForItem` filter idiom), then `continue` — one bad write no longer head-of-line-blocks the queue (T-33-06).
  - **TRANSIENT** (offline / timeout / 429 / 5xx): `break` to halt-and-backoff, preserving FIFO so later updates don't run before their inserts land.
- Added `toError()` helper: Supabase surfaces failures as plain `PostgrestError` objects (`{message, code}`), but the locked Wave-0 `classifyAiError` only reads `.message` off `Error` instances. `toError()` wraps the plain object into an `Error` carrying its message (+ `HTTP <status>` when a numeric `status`/`code` is present) so codes flow through the classifier's existing regex without modifying the classifier.
- do-NOT-emit-analytics WHY-comment preserved verbatim; no `trackEvent` in the failure path (T-33-07). FIFO `orderBy("createdAt")` unchanged.

### Task 2 — BlockedQueueBadge mounted next to OfflineIndicator (D-10)
- `src/components/BlockedQueueBadge.tsx` (new): queries items with `ai_status='failed'` (mirrors `getQueuedItems` query shape), refreshes on mount + the `online` event. Renders `null` at count 0 (mirrors OfflineIndicator); otherwise a clickable `<Badge tone="err">{count}</Badge>` (`data-testid="blocked-queue-badge"`) that toggles a detail `<ul data-testid="blocked-queue-detail">` of blocked item ids.
- `src/layouts/AppLayout.tsx`: `<BlockedQueueBadge />` mounted immediately after `<OfflineIndicator />`. The `handleReconnect` drain order (processWriteAheadQueue → fetchSessions → drainPhotoQueue → drainAudioQueue → drainQueue) is untouched.

## TDD Gate Compliance
- Task 1: RED commit `479a2a0` (failing permanent-drop-continue case) → GREEN commit `b4977ff`. Transient-halt case already passed under the old break (FIFO preserved) — expected, the old behavior matched the transient contract.

## Verification

- `npx vitest run src/tests/write-ahead-queue.test.ts` → 13/13 pass (incl. permanent-drop-continue + transient-halt-FIFO).
- `npx vitest run src/tests/blocked-badge.test.tsx` → 5/5 pass (un-skipped from Wave-0 stub; tone=err render, count text, render-nothing-at-0, click-to-detail, mount-adjacency).
- `npx vitest run src/tests/layout.test.tsx src/tests/app-layout-drain.test.ts` → 9/9 pass (no AppLayout regressions).
- `npx tsc --noEmit` clean; `eslint` clean on all changed files.
- Acceptance greps: `classifyAiError` present, single `break` (transient only), `do NOT emit` comment present, no `trackEvent` call; badge `tone="err"` present + mounted next to OfflineIndicator; drain order unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase error objects not classifiable by the locked Wave-0 classifier**
- **Found during:** Task 1 (GREEN)
- **Issue:** The drain throws the raw Supabase `error` (a plain `{message,...}` object). `classifyAiError` only reads `.message` for `Error` instances, so plain objects stringify to `"[object Object]"` and always classify as transient — the permanent branch would never fire on real Supabase failures.
- **Fix:** Added a `toError()` normalizer in `useWriteAheadQueue.ts` that wraps non-Error throwables into an `Error` (appending `HTTP <status>` when present), preserving the classifier as locked Wave-0 code.
- **Files modified:** src/hooks/useWriteAheadQueue.ts
- **Commit:** b4977ff

**2. [Rule 1 - Lint] Removed render-phase / effect setState in BlockedQueueBadge**
- **Found during:** Task 2
- **Issue:** Initial draft auto-collapsed the detail panel via `setOpen(false)` (first render-phase, then effect) — both flagged by the project's `react-hooks/set-state-in-effect` rule.
- **Fix:** Gated the detail panel on `count > 0` (whole component returns null at 0), so a stale `open=true` can never leak a panel — no setState needed.
- **Files modified:** src/components/BlockedQueueBadge.tsx
- **Commit:** a6ff051

## Threat Surface

No new trust boundaries beyond the plan's `<threat_model>`. T-33-06 (head-of-line block) and T-33-07 (analytics re-enqueue) mitigations implemented as specified; badge read is a read-only `ai_status` count under existing RLS.

## Known Stubs

None. The badge is wired to a live Supabase `items.ai_status='failed'` query; no placeholder data.

## Self-Check: PASSED

- Created files exist: `src/components/BlockedQueueBadge.tsx`, `33-03-SUMMARY.md`.
- All commits present: `479a2a0` (RED), `b4977ff` (GREEN Task 1), `a6ff051` (Task 2), `d1f1cbc` (SUMMARY).
- STATE.md / ROADMAP.md untouched (worktree mode — orchestrator owns shared files).
