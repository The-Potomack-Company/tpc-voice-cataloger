---
phase: 33-offline-reliability
verified: 2026-06-01T12:35:00Z
status: passed
human_uat_note: "Human UAT completed 2026-06-04 (milestone-end walk)"
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Real 4-tab concurrent drain produces zero duplicate Gemini calls"
    expected: "Queue one item offline, open 4 tabs, go online — Gemini billed exactly once (network tab / proxy logs confirm a single processAudioWithAi call)"
    why_human: "Unit tests assert the DB-atomic claim returns rows for exactly one caller, but true multi-tab behavior against a live Supabase instance can only be confirmed by a human with browser tabs open. No runnable server is available to the verifier."
  - test: "Blocked badge renders next to OfflineIndicator with correct count after a permanent failure"
    expected: "A tone='err' Badge with the failed item count appears in the AppLayout header; clicking it reveals the detail list of blocked item IDs"
    why_human: "Pixel placement and visual correctness of the Badge inside the header are not verifiable via grep. BlockedQueueBadge.test.tsx covers the component contract (count=0 renders null, count>0 renders badge + detail), but visual co-location with OfflineIndicator requires a live browser."
  - test: "Recorder always-settle: force a 3× db.audio.add failure in a real browser session"
    expected: "stopRecording() resolves (does not hang), recorderError is set in recordingStore, retryBuffer holds the blob — no UI surface yet (D-12 manual re-save UI is deferred)"
    why_human: "The hang fix and stash are fully tested by the audio-recorder.test.ts suite (15 tests green, 3-attempt retry scenario covered). Real IndexedDB quota failure in a browser validates the path more concretely than the mock, but this is a belt-and-suspenders check, not a blocker."
---

# Phase 33: offline-reliability Verification Report

**Phase Goal:** Harden the offline/sync pipeline against four reliability defects — retry storm (REL-1), cross-tab duplicate Gemini spend (REL-2), permanent-failure head-of-line block (REL-3), and recorder indefinite hang (REL-4).
**Verified:** 2026-06-01T12:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | REL-1: exponential full-jitter backoff replaces MAX_RETRIES loop; attempt counter persisted server-side; cap 5 → failed | VERIFIED | `backoff.ts:10-31` exports `ATTEMPT_CAP=5`, `BACKOFF_BASE_MS=5000`, `BACKOFF_CAP_MS=300000`; `offlineQueue.ts:95` calls `isInBackoff` before processing; lines 152-176 persist `ai_attempts` increment + re-stamp `claimed_at` on transient fail; cap branch at line 153 writes `ai_status='failed'`; no `MAX_RETRIES` symbol present anywhere in `offlineQueue.ts` |
| 2 | REL-2: DB-atomic `queued→processing` claim via `.select("id")` + stale-reclaim that cannot race a live worker (STALE_MS=600000 + heartbeat) | VERIFIED | `offlineQueue.ts:118-124` — conditional update `.eq("ai_status","queued").select("id")`; claim-winner check at line 124; `STALE_MS=600_000` at line 18; heartbeat `setInterval` at lines 130-136 re-stamps `claimed_at` every 60 s while a call is in-flight; `clearInterval(heartbeat)` in `finally` at line 178; no BroadcastChannel import |
| 3 | REL-3: `classifyAiError` drives permanent-drop-continue vs transient-halt-self-reschedule in write-ahead queue; blocked-count Badge `tone="err"` in AppLayout refreshes on drain completion | VERIFIED | `useWriteAheadQueue.ts:115` calls `classifyAiError(toError(err))`; permanent path at lines 116-133 deletes entry + same-item dependents + `continue`; transient path at lines 135-140 calls `scheduleTransientRedrain()` + `break`; `BlockedQueueBadge.tsx` mounted at `AppLayout.tsx:85` next to `OfflineIndicator`; badge subscribes to `drainTick` (line 46-54 in BlockedQueueBadge.tsx); `drainSignalStore.ts` — `notifyDrainComplete()` called in `offlineQueue.ts:213` and `useWriteAheadQueue.ts:147` `finally` blocks |
| 4 | REL-4: `stopRecording()` always settles (`Promise<number\|undefined>` preserved) even when `db.audio.add` rejects (3 attempts); blob stashed in `recordingStore.retryBuffer`; D-12 manual re-save UI deferred | VERIFIED | `useAudioRecorder.ts:199-255` — MAX_ATTEMPTS=3 loop; success path settles at line 229; final-failure path: sets `recorderError`, calls `stashForRetry`, resolves `undefined` at line 253; `recordingStore.ts:22-31` — `recorderError: string\|null` and `retryBuffer: {blob,itemId,durationMs}\|null` with setters and `reset()` clear; D-11 signature `Promise<number\|undefined>` confirmed at lines 17 and 294; deferred UI explicitly documented in 33-04-SUMMARY |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/backoff.ts` | Full-jitter backoff helpers | VERIFIED | `nextEligibleAt`, `isInBackoff`, `ATTEMPT_CAP`, `BACKOFF_BASE_MS`, `BACKOFF_CAP_MS` — pure, no side effects |
| `src/utils/aiErrorClass.ts` | D-08 permanent/transient taxonomy | VERIFIED | WR-06 anchored regex `(?:Proxy returned HTTP (\d{3})|\(HTTP (\d{3})\)$)` prevents SQLSTATE mis-classification |
| `src/services/offlineQueue.ts` | REL-1 backoff + REL-2 atomic claim | VERIFIED | MAX_RETRIES removed; backoff skip; DB claim with `.select("id")`; heartbeat; stale-reclaim STALE_MS=600000; `notifyDrainComplete()` in finally |
| `src/hooks/useWriteAheadQueue.ts` | REL-3 classify-driven drain | VERIFIED | permanent → drop+continue; transient → scheduleTransientRedrain + break; `toError` normalizer with WR-06 fix; `notifyDrainComplete()` in finally |
| `src/components/BlockedQueueBadge.tsx` | REL-3 D-10 badge | VERIFIED | `tone="err"` Badge; subscribes to `drainTick`; refreshes on `online`; renders null when count=0; click toggles detail list |
| `src/layouts/AppLayout.tsx` | Badge mounted next to OfflineIndicator | VERIFIED | `<BlockedQueueBadge />` at line 85; `<OfflineIndicator />` at line 84 |
| `src/stores/drainSignalStore.ts` | WR-04 drain-completion signal | VERIFIED | monotonic `drainTick`; `notifyDrainComplete()` non-hook accessor |
| `src/hooks/useAudioRecorder.ts` | REL-4 always-settle onstop | VERIFIED | 3-attempt loop; always-settle final failure path; D-11 signature preserved |
| `src/stores/recordingStore.ts` | REL-4 retry buffer + error state | VERIFIED | `recorderError`, `retryBuffer`, setters, `reset()` clears both |
| `supabase/migrations/20260601000100_add_items_claim_columns.sql` | `claimed_at + ai_attempts` columns | VERIFIED | `add column if not exists claimed_at timestamptz` + `ai_attempts integer not null default 0`; no GRANT; no enum DDL |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `offlineQueue.drainQueue` | `backoff.isInBackoff` | import + call at line 95 | WIRED | Skip-if-in-backoff gates every `processItem` call |
| `offlineQueue.processItem` | `classifyAiError` | import + call at line 145 | WIRED | Permanent vs transient on catch |
| `offlineQueue.drainQueue` (finally) | `notifyDrainComplete` | import + call at line 213 | WIRED | Badge refresh after every drain |
| `useWriteAheadQueue.processWriteAheadQueue` | `classifyAiError` via `toError` | lines 115-116 | WIRED | Same classifier for write-ahead entries |
| `useWriteAheadQueue.processWriteAheadQueue` (finally) | `notifyDrainComplete` | line 147 | WIRED | Badge refresh after write-ahead drain |
| `BlockedQueueBadge` | `drainSignalStore.drainTick` | `useDrainSignalStore` at line 46; `useEffect` dep at line 54 | WIRED | Re-fetches on every drain completion |
| `AppLayout` | `BlockedQueueBadge` | import + JSX at line 85 | WIRED | Badge rendered in header |
| `useAudioRecorder.onstop` | `recordingStore.stashForRetry` + `setRecorderError` | lines 242-248 | WIRED | Final-failure path writes both fields |
| `useAudioRecorder.stopRecording` | `stopResolveRef` (undefined settle) | line 253 `stopResolveRef.current?.(undefined)` | WIRED | Always-settle path reachable |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BlockedQueueBadge` | `items` (failed items) | `fetchBlockedItems()` → Supabase `.eq("ai_status","failed")` | Yes — live DB query | FLOWING |
| `offlineQueue.getQueuedItems` | queued items list | Supabase `.eq("ai_status","queued")` + `.select("id,...,claimed_at,ai_attempts")` | Yes — live DB query with new columns | FLOWING |
| `recordingStore.retryBuffer` | stashed blob | set by `useAudioRecorder.onstop` on final `db.audio.add` failure | Yes — real blob from MediaRecorder | FLOWING (write-only; read-side UI is deferred per D-12) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `backoff.ts` pure exports exist | `node -e "const {isInBackoff,nextEligibleAt,ATTEMPT_CAP}=require('./src/utils/backoff.ts')"` | N/A — ESM/TS; covered by vitest | SKIP (test suite covers) |
| Full vitest suite | `npx vitest run` | 591 passed, 55 todo, 0 failures (69 test files, 5 skipped) | PASS |
| TypeScript check | `npx tsc --noEmit` | No output (exit 0) | PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes found. N/A.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| REL-1 | 33-00 / 33-01 | Exponential backoff + persisted `ai_attempts`, cap 5 → failed; retry storm eliminated | SATISFIED | `backoff.ts`, `offlineQueue.ts` — `isInBackoff` gate, attempt increment, cap branch; MAX_RETRIES absent |
| REL-2 | 33-00 / 33-02 | DB-atomic claim (`.select("id")`), no BroadcastChannel; stale-reclaim safe from live worker (CR-01 fix) | SATISFIED | `offlineQueue.ts` — conditional update + heartbeat; STALE_MS=600000; no BroadcastChannel import |
| REL-3 | 33-00 / 33-03 | `classifyAiError`; permanent drops + continues; transient halts + self-reschedules; blocked-count Badge tone="err" refreshes on drain | SATISFIED | `useWriteAheadQueue.ts` + `BlockedQueueBadge.tsx` + `drainSignalStore.ts` + `AppLayout.tsx` |
| REL-4 | 33-04 | `stopRecording()` always settles; 3-attempt retry; blob stashed; D-12 re-save UI deferred | SATISFIED (hang fix + stash) | `useAudioRecorder.ts:199-254`; `recordingStore.ts`; 33-04-SUMMARY deferred note; ROADMAP REL-4 criterion does not require re-save UI |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `recordingStore.ts` — `retryBuffer` / `recorderError` | — | Fields written but no UI consumer reads them | Info | Known deferred (D-12 manual re-save UI). ROADMAP REL-4 criterion ("keep the recorded blob for retry") is met by the stash; re-save UI is below the ROADMAP contract. Not a blocker. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-33 modified files. All debt markers in the codebase carry formal WHY-comments citing the decision they track (WR-01 through WR-06, IN-01 through IN-04 — each with a fix note or accepted-state rationale).

---

### Human Verification Required

#### 1. Real 4-tab concurrent drain — zero duplicate Gemini calls

**Test:** Open the cataloged app in 4 browser tabs. Queue one item offline (record audio, disconnect network). Reconnect network in all 4 tabs simultaneously.
**Expected:** Gemini is called exactly once for the item (network tab or proxy logs show a single `processAudioWithAi` call); item reaches `ai_status='done'`; no duplicate billing.
**Why human:** Unit tests in `offline-queue.test.ts` assert the DB-atomic claim returns data for exactly one concurrent caller (all others get `claimed.length === 0`). A real multi-tab test against live Supabase is the only way to confirm the RLS + PostgREST conditional-update guarantees hold under actual network conditions.

#### 2. Blocked badge visual co-location with OfflineIndicator

**Test:** Force a permanent AI failure (e.g. no audio for an item, or mock a 4xx response). Observe the AppLayout header.
**Expected:** A red `tone="err"` Badge with the count renders in the header adjacent to the OfflineIndicator. Clicking it opens the detail list of blocked item IDs. Badge updates without a reload when a drain runs while already online.
**Why human:** `BlockedQueueBadge` is mounted correctly at `AppLayout.tsx:85`. The component contract is covered by `blocked-badge.test.tsx`. Visual pixel placement and the "next to OfflineIndicator" requirement need a live browser render.

#### 3. Recorder always-settle under real IndexedDB pressure (belt-and-suspenders)

**Test:** Record audio in the app while simulating storage quota exhaustion (DevTools → Application → Storage → simulate custom quota near limit). Stop recording.
**Expected:** `stopRecording()` resolves (no hang); a `recorderError` state is set in `recordingStore` (readable via Redux/Zustand DevTools); `retryBuffer` holds a non-null blob. Note: no UI surface for the error or retry yet (D-12 deferred).
**Why human:** The 3-attempt always-settle path is fully covered by `audio-recorder.test.ts` (mock db). Real IndexedDB quota behavior on the target browser/platform validates the path more concretely but is not a requirement to unblock the phase.

---

### Gaps Summary

No gaps blocking goal achievement. All four ROADMAP success criteria are satisfied by the implementation:

- REL-1: backoff + attempt persistence replace the MAX_RETRIES loop end-to-end.
- REL-2: DB-atomic claim with `.select("id")` + CR-01 heartbeat (STALE_MS=600000) make cross-tab duplicate spend structurally impossible without any BroadcastChannel.
- REL-3: classify-driven drain with self-reschedule on transient failure; badge wired to drain-completion signal.
- REL-4: always-settle path tested (15 tests); blob stash write-side complete; re-save UI is deferred and not within ROADMAP REL-4 scope.

The three human verification items are standard operational/visual checks, not evidence of missing implementation.

---

_Verified: 2026-06-01T12:35:00Z_
_Verifier: Claude (gsd-verifier)_
