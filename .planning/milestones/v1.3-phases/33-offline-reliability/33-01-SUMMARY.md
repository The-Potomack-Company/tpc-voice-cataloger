---
phase: 33-offline-reliability
plan: 01
subsystem: infra
tags: [offline-queue, backoff, gemini, supabase, retry, denial-of-wallet]

# Dependency graph
requires:
  - phase: 33-00
    provides: "src/utils/backoff.ts (isInBackoff/nextEligibleAt/ATTEMPT_CAP), src/utils/aiErrorClass.ts (classifyAiError), items.claimed_at + items.ai_attempts columns"
provides:
  - "offlineQueue drain reads claimed_at + ai_attempts and skips items inside their full-jitter backoff window"
  - "persisted attempt counter: transient failures re-queue + increment; ATTEMPT_CAP (5) reached -> ai_status='failed'"
  - "permanent errors (classifyAiError) fail-fast without burning further attempts"
  - "MAX_RETRIES immediate-retry loop removed (online-flip retry storm eliminated)"
affects: [33-02, offline-reliability, gemini-cost]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persisted-attempt backoff: drain reads claimed_at/ai_attempts off the row, skips via isInBackoff, persists attempt count on failure"
    - "Error-class-gated terminal failure: permanent (4xx/Zod) fails immediately; transient ages out via the attempt cap"

key-files:
  created: []
  modified:
    - src/services/offlineQueue.ts
    - src/tests/offline-queue.test.ts

key-decisions:
  - "Permanent errors fail-fast instead of consuming an attempt (Rule 2 wallet hardening; deviates from literal plan text)"
  - "QueuedItem carries claimedAt: Date|null + aiAttempts: number; getQueuedItems maps both off the select"

patterns-established:
  - "Backoff-skip replaces unconditional re-process: isInBackoff(claimedAt, aiAttempts) gates each item before any Gemini call"
  - "Read-then-write attempt persistence on the claim-winner row (atomic claim is REL-2/33-02)"

requirements-completed: [REL-1]

# Metrics
duration: 12min
completed: 2026-06-01
---

# Phase 33 Plan 01: Persisted-attempt backoff drain (REL-1) Summary

**Replaced the MAX_RETRIES=2 immediate-retry loop in offlineQueue with a persisted full-jitter backoff drain that skips cooling-down items, increments ai_attempts on transient failure, fails fast on permanent errors, and terminally marks items 'failed' at ATTEMPT_CAP — killing the per-online-flip Gemini retry storm.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-01T15:53:00Z
- **Completed:** 2026-06-01T15:57:24Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Drain now reads `claimed_at` + `ai_attempts` and skips any item still inside its full-jitter backoff window (no `processAudioWithAi` call), eliminating the retry storm on every `online` event.
- On transient AI failure (offline/network/5xx/429, folds in #17 net-abort-requeue) the claim-winner row is re-queued with `ai_attempts` incremented; once the next attempt reaches `ATTEMPT_CAP` (5) the item is set `ai_status='failed'` instead of re-queued.
- Permanent errors (4xx/Zod via `classifyAiError`) fail immediately, sparing the remaining Gemini attempts on un-retryable failures (T-33-02 denial-of-wallet).
- Reused the Wave-0 helpers (`isInBackoff`, `nextEligibleAt`, `ATTEMPT_CAP`, `classifyAiError`) — no backoff/classification reimplemented.
- Preserved both `navigator.onLine` short-circuits, the `draining` per-tab mutex, and the no-audio → `failed` path.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 (RED): failing REL-1 backoff-skip + attempt-cap cases** - `0e30dd2` (test)
2. **Task 1 (GREEN): persisted-attempt backoff drain** - `83803eb` (feat)

REFACTOR: not needed — implementation was clean at GREEN.

## Files Created/Modified
- `src/services/offlineQueue.ts` - Removed `MAX_RETRIES` const + immediate-retry loop. Extended `getQueuedItems` select/map with `claimed_at` + `ai_attempts`; `QueuedItem` now carries `claimedAt: Date|null` and `aiAttempts: number`. Renamed `processWithRetry` → `processItem`: backoff-skip via `isInBackoff`, fast-fail on permanent errors, re-queue+increment on transient below cap, terminal `failed` at `ATTEMPT_CAP`.
- `src/tests/offline-queue.test.ts` - Added `REL-1: backoff window + persisted attempt cap` describe block (6 new cases): backoff-skip, eligible-process, below-cap requeue+increment, cap→failed, permanent fast-fail, getQueuedItems claimed_at/ai_attempts mapping. Extended `setupQueuedItemsResponse` to accept the new columns.

## Decisions Made
- **Permanent errors fail-fast (deviation, see below).** Rather than consuming an attempt as the literal plan text described, a `classifyAiError(err) === "permanent"` result sets `ai_status='failed'` immediately. The shared classifier is conservative (only clear 4xx/Zod/unsupported-format → permanent; unknown defaults to transient/retry), so fast-failing those is safe and is the stronger denial-of-wallet protection (T-33-02).
- `getQueuedItems` maps `claimed_at` to `Date|null` and `ai_attempts` with `?? 0` fallback, so legacy rows with null/absent values are treated as eligible-now / zero-attempts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Permanent errors fail-fast instead of consuming an attempt**
- **Found during:** Task 1 (GREEN implementation)
- **Issue:** The plan action said "permanent classification still consumes an attempt," which would call `classifyAiError` but discard its result — leaving a dead call and burning attempts (and re-queuing) on un-retryable 4xx/Zod errors. That undercuts the plan's own denial-of-wallet objective (T-33-02): a permanent failure would still bounce through 5 attempts before terminal failure.
- **Fix:** Branch on the classifier — `permanent` → immediate `ai_status='failed'`; `transient` → re-queue + increment / cap. Added a test asserting an HTTP 422 / Zod error fails immediately without re-queue.
- **Files modified:** src/services/offlineQueue.ts, src/tests/offline-queue.test.ts
- **Verification:** `npx vitest run src/tests/offline-queue.test.ts` (10 passed), including the new permanent-fast-fail case.
- **Committed in:** 83803eb (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / wallet hardening)
**Impact on plan:** Strengthens the stated denial-of-wallet mitigation; conservative classifier keeps misclassification risk negligible. All plan acceptance criteria still satisfied (MAX_RETRIES=0, isInBackoff + ai_attempts wired, both onLine guards intact, backoff-skip + cap→failed tests green). No scope creep.

## Issues Encountered
None. The Wave-0 helpers and `items` column types were present on the base as documented, so the drain wiring was straightforward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 33-02 (REL-2) layers the DB-atomic claim onto this same `offlineQueue.ts` and `depends_on` this plan. The read-then-write attempt persistence here is the pre-claim narrowing; 33-02 makes the claim atomic. No structural blockers.
- `ai_status='failed'` is now reachable from the drain (cap + permanent) — any UI surfacing failed items will see these rows.

## TDD Gate Compliance
- RED gate: `0e30dd2` test commit (4 new cases failed against pre-change drain). PASS.
- GREEN gate: `83803eb` feat commit after RED. PASS.
- REFACTOR: not required.

## Self-Check: PASSED
- src/services/offlineQueue.ts — FOUND
- src/tests/offline-queue.test.ts — FOUND
- 33-01-SUMMARY.md — FOUND
- commit 0e30dd2 (RED) — FOUND
- commit 83803eb (GREEN) — FOUND
- STATE.md / ROADMAP.md — untouched (diff vs base shows only the 3 intended files)

---
*Phase: 33-offline-reliability*
*Completed: 2026-06-01*
