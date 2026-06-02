---
phase: 39-optimistic-locking
plan: 02
subsystem: data-layer / optimistic-concurrency
wave: 1
status: complete
tasks_completed: 2
tasks_total: 2
requirements: [DAT-3]
tags: [optimistic-locking, supabase, reconcile, write-ahead-queue]
requires:
  - "39-01: items.updated_at column + trigger (applied to prod); database.types.ts; RED specs"
provides:
  - "src/db/optimisticUpdate.ts:preconditionUpdate — shared 0-row-conflict + bounded 3x reconcile helper"
  - "sessionStore.updateItemField routed through preconditionUpdate (no last-writer-wins)"
  - "offline enqueue payload carries updated_at snapshot (D-04) for Plan 03's flush"
affects:
  - "src/services/geminiContinuous.ts (Plan 03 — AI merge reconcile reuses this helper)"
  - "src/hooks/useWriteAheadQueue.ts (Plan 03 — flush applies the snapshot precondition)"
tech-stack:
  added: []
  patterns:
    - "PostgREST .update().eq().eq().select() + data.length===0 conflict detection (mirrors offlineQueue CAS)"
    - "bounded read-modify-reapply reconcile loop with token refresh between attempts"
key-files:
  created:
    - src/db/optimisticUpdate.ts
  modified:
    - src/stores/sessionStore.ts
    - src/tests/update-item-field-notify.test.ts
    - src/tests/session-store.test.ts
decisions:
  - "D-07: reconcile loop bounded to 3 attempts; refreshes prev token from the re-read row each attempt"
  - "D-08: default reconcile re-applies the user's patch verbatim (last human intent wins)"
  - "D-04: updated_at snapshot captured at enqueue time into the write-ahead payload"
commits:
  - 42c5bdc
  - f8cf20c
metrics:
  duration_min: 8
  completed: "2026-06-02"
---

# Phase 39 Plan 02: preconditionUpdate helper + user-edit wiring Summary

Built the optimistic-concurrency spine — a shared `preconditionUpdate` helper that turns `items` writes from last-writer-wins into a `.eq("updated_at", prev)` precondition with bounded 3× reconcile — and routed the user single-field edit path through it, snapshotting `updated_at` into the offline queue payload for Plan 03's flush.

## What was built

### Task 1 — `src/db/optimisticUpdate.ts` (commit 42c5bdc)
`preconditionUpdate({ table, id, prevUpdatedAt, patch, reconcile?, maxAttempts? })` → `{ status: "applied", row } | { status: "noop" } | { status: "exhausted" }`.

- **Precondition write:** `supabase.from(table).update(patch).eq("id", id).eq("updated_at", prev).select()`. `data.length === 0` with `error: null` IS the conflict (Pitfall 1 — never thrown). Carries the WHY-comment about `.select()` from the proven Phase-33 CAS idiom (`offlineQueue.ts:119-132`) rather than forking a divergent implementation (O-1 cross-phase flag).
- **Conflict → re-read → reconcile:** on 0-row, re-read `select("*").eq("id", id).maybeSingle()`. Row back → refresh `prev = fresh.updated_at` (Pitfall 4), rebuild via `reconcile(fresh, patch)` (default = re-apply verbatim, D-08), retry. Re-read returns nothing → `{ status: "noop" }`, stops the loop (deleted / RLS-deny disambiguation — highest-value threat T-39-02).
- **Bound:** `maxAttempts` default 3 (D-07). Empty reconciled patch → `noop` (D-06 all-fields-skipped). Genuine `error != null` → throw (caller keeps existing network/permanent handling).
- **Exhaustion:** `useNotificationStore.getState().notifyError(message, retry)` then `{ status: "exhausted" }`. The trigger owns the `updated_at` bump — the patch never contains `updated_at` (Pitfall 2).

### Task 2 — `updateItemField` rewiring + offline snapshot (commit f8cf20c)
- Replaced the bare `.update({ [field]: value }).eq("id", itemId)` last-writer-wins write at `sessionStore.ts` with a `preconditionUpdate` call, `prevUpdatedAt = originalItem.updated_at`, `patch = { [field]: value }`.
- Offline branch (`isNetworkError`): `enqueueWrite` payload now carries `updated_at: originalItem.updated_at` (D-04) for Plan 03's flush precondition.
- Preserved intact: optimistic local `set()`, `scheduleFieldEditEvent`, the revert + `notifyError("Couldn't save …. Tap Retry to try again.", retry)` catch path, the receipt-dup special case, and the Retry guard that re-checks the field before retrying.

## Verification

| Test | Before | After |
|------|--------|-------|
| `optimistic-update.test.ts` (Plan 02 target) | 4 RED | **4 GREEN** |
| `update-item-field-notify.test.ts` (no-regression) | 5 green | **5 green** |
| `session-store.test.ts` (no-regression) | 17 green | **17 green** |
| Full suite (`npm test`) | — | **704 pass, 4 fail (expected Plan-03 RED), 49 todo, 4 skipped** |
| `npm run build` (tsc + vite) | — | **clean** |

The 4 remaining failures are the Plan-03 targets, intentionally still RED:
- `continuous-merge-no-clobber.test.ts` (1) — D-06 AI-merge compare-and-skip
- `write-ahead-queue.test.ts` Phase-39 block (3) — flush precondition / Pitfall 5 retain / Pitfall 6 legacy fallback

No previously-green test regressed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Update mock chains in two existing tests to the new write idiom**
- **Found during:** Task 2 — full-suite run after rewiring.
- **Issue:** `update-item-field-notify.test.ts` and `session-store.test.ts` mocked the supabase write as `.update().eq()` (single `.eq()`, no `.select()`). The new precondition path calls `.update().eq("id").eq("updated_at").select()`, so the old mocks broke (`.eq` on a resolved promise) — 3 `session-store` tests went red transiently.
- **Fix:** Updated both `setupUpdateChain` helpers to the `.eq().eq().select() → { data, error }` shape. In `session-store.test.ts` the helper is shared with `updateSession` (still `.update().eq()`), so the chain was made thenable (resolves to the same `{ data, error }`) to support both write shapes off one mock. All behavioral assertions (revert+notify, retry re-invoke, stale-drop+dismiss, ai_status skip, network enqueue, optimistic-set) are unchanged.
- **Files modified:** `src/tests/update-item-field-notify.test.ts`, `src/tests/session-store.test.ts`
- **Commit:** f8cf20c
- These are mock-plumbing updates to match the new write idiom — no test behavior was weakened.

**2. [Rule 3 - Blocking] Cast at the strongly-typed supabase boundary**
- **Found during:** Task 2 — `npm run build`.
- **Issue:** `preconditionUpdate` is table-generic (`table: string`), but the supabase client is strongly typed per table; `tsc` rejected `from(table)`, `update(patch)`, and `.eq("updated_at", prev as string|null|undefined)`.
- **Fix:** Cast at the call boundary (`from(table as never)`, `update(nextPatch as never)`, `.eq("updated_at", prev as never)`) — the same idiom `useWriteAheadQueue.ts` uses (`payload as never`) for a table-generic write.
- **Files modified:** `src/db/optimisticUpdate.ts`
- **Commit:** f8cf20c

No authentication gates occurred.

## Threat Model Compliance

- **T-39-01 (lost-update tampering):** mitigated — `.eq("updated_at", prev).select()` + `data.length === 0` conflict detection; `optimistic-update.test.ts` proves 0-row ≠ success.
- **T-39-02 (RLS-deny → infinite loop, DoS — highest value):** mitigated — 3-attempt cap + re-read-returns-nothing ends the loop with `noop` (does not retry). Covered by the re-read-empty test case.
- **T-39-SC (package install):** no packages added; no install task.

## Known Stubs

None. The offline `updated_at` snapshot is a real key consumed by Plan 03's flush (the flush consumer is the next plan's work, not a stub here).

## Self-Check: PASSED

- `src/db/optimisticUpdate.ts` — FOUND
- `src/stores/sessionStore.ts` — FOUND (imports + calls `preconditionUpdate`)
- Commit 42c5bdc — FOUND
- Commit f8cf20c — FOUND

## Handoff to Plan 03

- Compose `preconditionUpdate` (do NOT fork) for: (a) the AI-merge per-field compare-and-skip reconcile (pass a custom `reconcile` implementing D-06), and (b) the write-ahead flush in `useWriteAheadQueue.ts` (read `payload.updated_at` as the snapshot; Pitfall 6 — fall back to re-read-then-precondition when a legacy entry has no snapshot).
- The offline payload already carries `updated_at` at enqueue time (D-04).
