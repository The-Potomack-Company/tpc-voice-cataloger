---
phase: 33-offline-reliability
reviewed: 2026-06-01T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/services/offlineQueue.ts
  - src/hooks/useWriteAheadQueue.ts
  - src/components/BlockedQueueBadge.tsx
  - src/layouts/AppLayout.tsx
  - src/hooks/useAudioRecorder.ts
  - src/stores/recordingStore.ts
  - src/utils/backoff.ts
  - src/utils/aiErrorClass.ts
  - supabase/migrations/20260601000100_add_items_claim_columns.sql
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: resolved
resolution: All Critical + 6 Warnings fixed atomically (commits e3e8e3e, 8d56022, e83fc2f, 45f2189, 8023b05, 307d548); IN-01/IN-03 fixed (ebc7525, c9d7487); WR-02 deferred to follow-up (recorded in 33-04-SUMMARY, bb13cc9); IN-02/IN-04 no action. Gate green after fixes (tsc 0, eslint 0, vitest 591 passed).
---

# Phase 33: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** deep (cross-file: import graph + call-chain trace across 5 parallel/sequential plans)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The core REL-1..REL-4 mechanics are largely implemented per the locked decisions: the DB-atomic claim uses `.select("id")` correctly (Pitfall 1 avoided), the attempt cap is off-by-one-correct (5 Gemini calls), the recorder always-settle no longer hangs, FIFO is preserved on transient halt, and the migration is additive/idempotent/grant-free.

However, deep tracing across plan boundaries surfaces one **critical denial-of-wallet hole** (stale-reclaim can fire under a still-live processing tab and trigger duplicate Gemini spend — the exact failure REL-2 was built to prevent), a cross-file null-handling bug between `audioRecordsForItem` and `findAudioForItem` that can pass a bogus audio id into Gemini, and a dead REL-4 recovery path (the stashed retry blob and recorder error are written but no UI ever reads them, so D-12's "manual re-save" promise is unfulfilled). Several backoff-window and reclaim interactions are correct but rest on a justification comment that is factually wrong and will mislead future tuning.

## Critical Issues

### CR-01: Stale-reclaim races a still-live processing tab → duplicate Gemini spend

**File:** `src/services/offlineQueue.ts:150-155` (with `STALE_MS` at `:13`)
**Issue:** The stale-reclaim bulk update resets any `ai_status='processing'` row with `claimed_at < now-STALE_MS` back to `queued`, unconditionally. `STALE_MS` is 300_000 (5 min). The in-code justification (`:9-13`) claims this is "~2× the 5min backoff cap" — that is wrong twice over: (a) 5 min is 1× the 5-min cap, not 2×; (b) the backoff *cap* is irrelevant to stale detection — what matters is the max wall-clock duration of a single `processAudioWithAi` call. If one Gemini proxy call legitimately runs past 5 min (large audio, proxy/model latency, slow network), the live tab is still `await`-ing at `:106` while the reclaim flips the row to `queued`. A second tab (or the next drain in the same tab) then re-reads it via `getQueuedItems`, wins a fresh claim, and fires a **second** `processAudioWithAi` for the same item — duplicate Gemini billing and a potential lost/overwritten update. This is precisely the denial-of-wallet threat (T-33-02 / RESEARCH §Security) that the DB-atomic claim was supposed to make "structurally impossible."
**Fix:** Set `STALE_MS` to a true ~2× of the *observed max processing time* (measure it; if a call can take up to ~3 min, use `STALE_MS = 600_000` and document that basis), and correct the comment so future tuning isn't anchored to the backoff cap. Stronger: make reclaim conditional on attempt state or add a heartbeat (re-stamp `claimed_at` periodically while a long call is in flight) so a live worker is never reclaimed. At minimum, the threshold must be derived from processing latency, not from `BACKOFF_CAP_MS`.

## Warnings

### WR-01: `findAudioForItem` returns `undefined` (not `null`) for cross-device rows, defeating the no-audio guard

**File:** `src/services/offlineQueue.ts:55-60` (consumes `src/db/audioLookup.ts:56-63`)
**Issue:** `audioRecordsForItem` can return rows whose `id` is intentionally `undefined` (the cross-device Supabase-union branch, `audioLookup.ts:56` leaves `id` unset). `findAudioForItem` does `audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)`. If the seed `audios[0].id` is `undefined`, the accumulator starts `undefined`; every `a.id! > undefined` comparison is `NaN`-false, so the function returns `undefined` typed as `number`. Then the caller's guard `if (audioId === null)` (`:81`) is **false** (it is `undefined`, not `null`), so the drain proceeds to claim the item and calls `processAudioWithAi(undefined, item.id, ...)` with a bogus audio id — a guaranteed failure that then burns an attempt, and on a 4xx-style classify could even mark a perfectly recoverable item `failed`.
**Fix:** Filter undefined ids before the reduce and normalize the empty case: `const ids = audios.map(a => a.id).filter((x): x is number => typeof x === "number"); if (ids.length === 0) return null; return Math.max(...ids);`. Separately, change the caller guard to `if (audioId == null)` so both `null` and `undefined` short-circuit.

### WR-02: REL-4 retry blob + recorder error are written but never read — D-12 "manual re-save" is dead

**File:** `src/hooks/useAudioRecorder.ts:240-249`, `src/stores/recordingStore.ts:28-31`
**Issue:** On final `db.audio.add` failure the code sets `recorderError` and calls `stashForRetry({ blob, ... })`. Grepping all consumers of `recordingStore`, **nothing reads `recorderError` or `retryBuffer`** anywhere in the app (consumers only read `isRecording`, `currentDurationMs`, `lastSaved*`, `levels`). D-12 explicitly promises "set recorder error state, and stash the blob in `recordingStore` **for manual re-save**." The hang is fixed (good), but the recovery surface does not exist: the user gets no error toast and has no way to re-save the stashed blob, which lives only in memory and is silently discarded on `reset()` or reload. The recording is still effectively lost — just slower than the original bug.
**Fix:** Either (a) add the missing UI — surface `recorderError` (e.g. via `ErrorToast`/a banner) and a button that re-runs `db.audio.add` from `retryBuffer` then clears it; or (b) if the UI is out of scope for this phase, mark D-12's re-save sub-requirement as deferred in the SUMMARY and downgrade the user-facing claim, because shipping write-only state misrepresents the fix.

### WR-03: Re-queued transient failures keep a stale `claimed_at`, so the backoff window can be effectively bypassed

**File:** `src/services/offlineQueue.ts:129-133`
**Issue:** On transient failure below the cap, the code writes `{ ai_status: "queued", ai_attempts: next }` but does **not** update `claimed_at`. The backoff window (`backoff.ts:21`) is anchored on `claimed_at`, which was stamped at claim time (`:99`) — i.e. *before* the `processAudioWithAi` call ran. For a long-running failure, the window is measured from before the work started, so by the time the call rejects, a chunk of the intended backoff has already elapsed against wall-clock. With attempt 1 the window is only `[0,10s)`; a slow failing call easily consumes that, so the item is immediately eligible again on the next drain — the retry-storm mitigation is weaker than D-06 intends. Functionally the cap still bounds it, but the "spread retries / don't stampede" goal is partially undermined.
**Fix:** Re-stamp the backoff anchor at the moment of failure: `update({ ai_status: "queued", ai_attempts: next, claimed_at: new Date().toISOString() })`. The window then measures from the failure time, matching D-06's intent. (Confirm the reclaim cutoff still behaves — a `queued` row is never reclaimed regardless of `claimed_at`.)

### WR-04: `BlockedQueueBadge` only refreshes on `online`, so it goes stale within a session

**File:** `src/components/BlockedQueueBadge.tsx:42-48`
**Issue:** The badge fetches `ai_status='failed'` items on mount and on the `window 'online'` event only. But items transition to `failed` during a normal drain while *already online* (attempt-cap exceeded at `offlineQueue.ts:124`, permanent classify at `:115`, no-audio at `:85`, and permanent write-ahead drops). None of those fire an `online` event, so a user who is continuously online will never see the badge update until a reconnect or full reload — defeating "blocked work no longer strands silently" (the badge's stated purpose, `:6-9`). The detail panel is likewise frozen.
**Fix:** Add a refresh trigger tied to drain completion — e.g. a lightweight event/Zustand flag set when `drainQueue`/`processWriteAheadQueue` finishes, or poll on an interval, or subscribe to a Supabase realtime change on `items.ai_status`. At minimum re-`refresh()` after each `handleReconnect` drain cycle, not just on the `online` DOM event.

### WR-05: `enqueueWrite`'s fire-and-forget drain can race the FIFO `processing` mutex and reorder under failure

**File:** `src/hooks/useWriteAheadQueue.ts:42-44`
**Issue:** `enqueueWrite` triggers `processWriteAheadQueue()` whenever online. The `processing` boolean dedupes concurrent drains, but consider: a transient failure in an in-flight drain hits `break` (`:111`) and returns, clearing `processing`. If `enqueueWrite` was called during that drain (mutex caused it to no-op), the just-enqueued entry is now only drained on the *next* trigger. More importantly, because the drain reads `entries` once at the top (`:52`) and the mutex blocks re-entry, an entry enqueued mid-drain is invisible to the current pass — acceptable for FIFO, but the transient-`break` then leaves the queue un-retried until the next `online`/mount/enqueue, with no backoff timer of its own (unlike the offline queue). A burst of failing writes therefore relies entirely on external re-triggers; there is no self-scheduled retry.
**Fix:** After a transient `break`, schedule a delayed re-drain (mirror the photo-queue `setTimeout(drain, backoff)` reference pattern cited in RESEARCH) so a transient write-ahead failure recovers without waiting for an unrelated `online`/`enqueue` event. Document that write-ahead has no persisted attempt counter (intentional) but does self-reschedule.

### WR-06: `toError` status regex misclassifies any message containing a 3-digit run as an HTTP error

**File:** `src/hooks/useWriteAheadQueue.ts:21-27` feeding `src/utils/aiErrorClass.ts:20`
**Issue:** `toError` formats `"<base> (HTTP <status>)"` only when it extracts a numeric `status`/`code`. But `classifyAiError` then runs `msg.match(/HTTP (\d{3})/)` against the *whole* normalized message. A Supabase `PostgrestError.message` that naturally contains a substring like `HTTP 200` or any `HTTP \d{3}` token (or a base message that happens to embed three digits after "HTTP") would be parsed as a status and routed by the 4xx/5xx branch — e.g. a benign message mentioning `HTTP 100` falls through to neither branch (status<400) and defaults transient, but a message embedding `HTTP 404` text in its *body* (not the real status) would be classified permanent and silently dropped along with same-item dependents. The Postgrest `code` field is also typically a SQLSTATE like `23505`, not a 3-digit HTTP code, so the `/^\d{3}$/.test(r.code)` branch can match SQLSTATEs like `404`/`500`-shaped codes and fabricate an HTTP status.
**Fix:** Thread a real numeric status as a typed field rather than embedding it in free text, and have `classifyAiError` read that field first. If keeping the regex, anchor it to the controlled suffix `toError` produces (e.g. match `\(HTTP (\d{3})\)$`) so arbitrary message bodies and SQLSTATE codes can't masquerade as HTTP statuses. Do not treat `PostgrestError.code` (SQLSTATE) as an HTTP status.

## Info

### IN-01: `getQueuedItems` swallows query errors as an empty queue

**File:** `src/services/offlineQueue.ts:37`
**Issue:** `if (error || !data) return []` treats a transient Supabase read failure identically to "queue is empty," so the drain silently does nothing and logs nothing. Not a correctness bug (next drain retries) but it erases an observability signal for a persistent read failure.
**Fix:** `console.warn` the error before returning `[]`, or surface it so a stuck queue is diagnosable.

### IN-02: Write-ahead permanent-drop depends on insert payload carrying `id`

**File:** `src/hooks/useWriteAheadQueue.ts:96-106`
**Issue:** Dependent-dropping matches `p.id === itemId` where `itemId = (entry.payload).id`. For an `insert` whose primary key is DB-generated (no `id` in payload), `itemId` is `undefined` and the `id`-match branch is skipped; only the `tempId` branch can catch dependents, and only if every dependent shares the same `tempId`. If any dependent update/delete references the real id (not `tempId`), it would be orphaned (the Pitfall 5 scenario). Likely fine given current write patterns (inserts appear to carry client-generated UUIDs), but it is an unguarded assumption.
**Fix:** Confirm all `items`/`sessions` inserts carry a client-generated `id`, or assert/log when a permanent-failing insert has neither `payload.id` nor `tempId` so silent orphaning is detectable.

### IN-03: `nextEligibleAt` re-rolls jitter on every call, so the eligibility instant is non-deterministic per drain

**File:** `src/utils/backoff.ts:20-26`
**Issue:** `isInBackoff` calls `nextEligibleAt`, which calls `Math.random()` each invocation. Two drains milliseconds apart compute different windows for the same row; an item can flip eligible/not-eligible between checks purely from RNG. This is acceptable for full-jitter spreading and the attempt cap bounds total calls, but it means the window is not a stable property of the row — worth a WHY note so a future reader doesn't treat `nextEligibleAt` as deterministic.
**Fix:** Add a one-line comment that jitter is intentionally re-rolled per check (probabilistic admission), or persist a computed `next_eligible_at` if deterministic scheduling is later desired.

### IN-04: `cleanupStream` on unmount can fire a second `onstop` settle path

**File:** `src/hooks/useAudioRecorder.ts:67-73, 344-349`
**Issue:** If the component unmounts mid-recording, `cleanupStream` calls `mediaRecorderRef.current.stop()`, which triggers the `onstop` handler → `db.audio.add` → `stopResolveRef.current?.(...)`. Since `stopResolveRef` is null unless `stopRecording()` set it, the `?.` guard prevents a double-settle (good), and the add still persists the blob. No leak or hang. Noted only because the unmount path performs an async IndexedDB write against refs (`itemIdRef`, etc.) that are still valid at unmount — benign today but fragile if refs are ever cleared in cleanup.
**Fix:** None required; optionally guard the `onstop` add against unmount if the recorder is ever changed to clear `itemIdRef`/`chunksRef` during cleanup.

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
