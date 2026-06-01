---
phase: 33-offline-reliability
plan: 02
subsystem: offline-queue
tags: [REL-2, cross-tab, supabase, denial-of-wallet, atomic-claim]
requires: [33-00, 33-01]
provides: ["DB-atomic cross-tab claim", "stale-claim reclaim pass"]
affects: [offlineQueue, drainQueue]
tech-stack:
  added: []
  patterns:
    - "PostgREST conditional update as a single-winner lock: .update().eq(id).eq(ai_status,'queued').select('id')"
    - "Stale-claim self-heal: .update({ai_status:'queued'}).eq('ai_status','processing').lt('claimed_at', cutoff)"
key-files:
  created: []
  modified:
    - src/services/offlineQueue.ts
    - src/tests/offline-queue.test.ts
decisions:
  - "D-01: DB-atomic conditional claim is the cross-tab coordination primitive; .select('id') is mandatory or PostgREST returns null data and winner-detection silently no-ops (Pitfall 1)"
  - "D-02: STALE_MS = 300_000 (~2x the 5min backoff cap) so a live-but-slow attempt is never yanked while a dead tab self-heals within one drain"
  - "D-03: no cross-tab message bus; the DB row IS the coordination point"
metrics:
  duration: ~5 min
  completed: 2026-06-01
  tasks: 1
  files: 2
  commits: 2
---

# Phase 33 Plan 02: DB-atomic cross-tab claim + stale reclaim Summary

REL-2: a DB-atomic conditional claim (`.update().eq(id).eq(ai_status,'queued').select('id')`) makes duplicate Gemini spend structurally impossible across tabs/processes/devices — only the row-returning tab proceeds — plus a stale-claim reclaim pass that re-queues items stranded in `processing` past STALE_MS (5min), all layered onto the existing 33-01 backoff drain with no message bus (D-03).

## What Was Built

- **DB-atomic claim** in `processItem` (after the 33-01 backoff-skip + `navigator.onLine` check + audio lookup, immediately before `processAudioWithAi`): conditionally flips the row to `processing`/`claimed_at=now()` only while still `queued`, chained with `.select("id")`. Empty/null result → `return` (another tab won). This is the T-33-02 denial-of-wallet mitigation.
- **`.select("id")` enforced** with a WHY-comment documenting RESEARCH Pitfall 1 (PostgREST `.update().eq()` returns `data:null` without an explicit select, which would make winner-detection a silent no-op). T-33-05 mitigation.
- **Stale-claim reclaim** at the top of `drainQueue` (after the `draining` mutex acquire, before `getQueuedItems`): `.update({ai_status:'queued'}).eq('ai_status','processing').lt('claimed_at', now - STALE_MS)`. Reclaimed rows join the same drain pass. T-33-04 (dead-tab stranding) mitigation.
- **`STALE_MS = 300_000`** constant with WHY-comment (~2x the 5min backoff cap).
- **Per-tab `draining` boolean retained** as the cheap local short-circuit only — explicitly NOT the coordination mechanism.
- **No BroadcastChannel / message bus** (D-03) — `grep -c "BroadcastChannel"` returns 0.

## Tests

Extended `src/tests/offline-queue.test.ts` (10 → 12 cases, all green):
- **REL-2 exactly-once across 4 concurrent drains**: claim mock returns `[{id}]` on first execution and `[]` thereafter → `processAudioWithAi` called exactly once.
- **REL-2 stale reclaim**: asserts `update({ai_status:'queued'})` then `.eq('ai_status','processing').lt('claimed_at', <iso>)` runs before the drain.
- Upgraded the shared `setupQueuedItemsResponse` harness and the no-audio inline mock to a chainable `update` supporting all three write shapes (plain `.eq`, claim `.eq.eq.select`, reclaim `.eq.lt`) so the 33-01 cases stay green.

TDD gates: RED commit `7eb00b4` (stale-reclaim case failing against claim-less code) → GREEN commit `8d88a3d`. No refactor commit needed (minimal diff).

## Deviations from Plan

None — plan executed as written. One in-flight adjustment worth noting: the original WHY-comment contained the literal word "BroadcastChannel", which tripped the acceptance criterion `grep -c "BroadcastChannel" == 0`; reworded to "cross-tab message bus" (still cites D-03).

## TDD Gate Compliance

- RED gate: `test(33-02): ...` (`7eb00b4`) — stale-reclaim case failed against pre-claim code.
- GREEN gate: `feat(33-02): ...` (`8d88a3d`).
- Note: the exactly-once case passed at RED time because the per-tab `draining` boolean already dedupes within a single tab; the case still documents the cross-tab single-winner contract via the claim mock. The stale-reclaim case is the load-bearing RED proof.

## Verification

- `npx vitest run src/tests/offline-queue.test.ts` → 12 passed.
- `npx vitest run src/tests/app-layout-drain.test.ts` → 3 passed (no regression; it mocks drainQueue).
- `npx tsc --noEmit -p tsconfig.app.json` → no offlineQueue errors.
- Acceptance greps: `.eq("ai_status", "queued")` present; `.select(` count = 5; `STALE_MS` present; `.lt("claimed_at", ...)` present; `BroadcastChannel` count = 0.

## Known Stubs

None.

## Self-Check: PASSED

- SUMMARY.md present
- src/services/offlineQueue.ts present
- RED commit 7eb00b4 in history
- GREEN commit 8d88a3d in history
