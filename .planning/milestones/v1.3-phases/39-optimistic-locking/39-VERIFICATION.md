---
phase: 39-optimistic-locking
verified: 2026-06-02T14:15:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm items_updated_at trigger bumps updated_at on live UPDATE"
    expected: "An UPDATE on any items row advances updated_at past its prior value; backfilled rows show updated_at >= created_at"
    why_human: "Migration applied via supabase MCP (Claude-owned, D-046, 39-VALIDATION.md Manual-Only). Cannot run a live Supabase UPDATE from the verifier agent. The SUMMARY records it was verified at apply time; a human spot-check on the prod DB closes the loop."
  - test: "On-device race: user edit vs AI merge does not silently lose the user's edit"
    expected: "User types into a field while AI merge fires; user's value wins in the DB; an ErrorToast does NOT appear for the user's edit (it should appear only if the AI path exhausts 3 retries, which requires extreme contention)"
    why_human: "Per project policy, on-device UAT is deferred to v1.3 milestone end. The HEADLINE unit test (continuous-merge-no-clobber.test.ts) proves the contract at the code level, but a live browser race requires manual execution."
---

# Phase 39: optimistic-locking Verification Report

**Phase Goal:** Prevent silent lost writes across concurrent writers (user edit vs AI merge, cross-tab/device) by adding an `items.updated_at` precondition + conflict reconciliation. HIGH RISK: a careless partial implementation can silently drop writes.
**Verified:** 2026-06-02T14:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An `items.updated_at` auto-bump-on-UPDATE Postgres trigger exists via a new migration; `schema.md` updated and `database.types.ts` regenerated with `updated_at: string` | VERIFIED | `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql` exists with `create trigger items_updated_at before update on public.items for each row execute function public.set_updated_at()`. `database.types.ts:363` has `updated_at: string` in `items.Row`. `_workspace/Schema/schema.md:79` documents the column + trigger; `migrations.md:20` logs `20260603000000`. Applied to prod per 39-01 SUMMARY. |
| 2 | `updateItemField` and the AI merge path read `updated_at`, write with a `.eq("updated_at", <prev>)` precondition, and on a 0-row conflict re-read + reconcile (never last-writer-wins) | VERIFIED | `sessionStore.ts:433-440` calls `preconditionUpdate({ prevUpdatedAt: originalItem.updated_at, patch: { [field]: value } })`. `geminiContinuous.ts:297-303` calls `preconditionUpdate` with `prevUpdatedAt: snapshotRow.updated_at`. `optimisticUpdate.ts:70-75` issues `.eq("id", id).eq("updated_at", prev).select()`. Conflict = `data.length === 0` at `:79`; re-read at `:86-91`; token refresh at `:95`. |
| 3 | Per-writer conflict policy holds: user single-field edit re-applies on conflict (intent-preserving); AI merge skips a field the user changed since the merge's read (D-06 compare-and-skip) | VERIFIED | Default reconcile in `optimisticUpdate.ts:34` re-applies the patch verbatim (user intent). AI reconcile in `geminiContinuous.ts:286-295` drops any field where `fresh[field] !== valueAtRead[field]`. HEADLINE test `continuous-merge-no-clobber.test.ts` asserts user-changed field absent from re-applied patch; untouched field present. 1/1 GREEN. |
| 4 | Conflicts surface to the user via `notifyError` (DAT-4 ErrorToast); a test proves a live user edit racing an AI continuous-mode chunk write does not silently lose the user's edit | VERIFIED | Exhaustion path `optimisticUpdate.ts:103-108` calls `useNotificationStore.getState().notifyError(message, retryFn)`. `optimistic-update.test.ts` "surfaces notifyError(message, retry) after 3 failed attempts" — 1/1 GREEN. `continuous-merge-no-clobber.test.ts` proves AI write does not clobber user edit — 1/1 GREEN. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql` | `updated_at` column + backfill + BEFORE UPDATE trigger via `set_updated_at()` | VERIFIED | 13 lines. Contains `add column updated_at timestamptz not null default now()`, `coalesce(created_at, now())` backfill, `create trigger items_updated_at ... execute function public.set_updated_at()`. No `set_updated_at()` redefinition. No RLS statement. |
| `src/db/database.types.ts` | `items.Row.updated_at: string` (regenerated) | VERIFIED | Line 363 `updated_at: string` in `items.Row`. Line 388 `updated_at?: string` in `items.Insert`. Regenerated via `npm run db:types` (SUMMARY: 3-line diff). |
| `src/db/optimisticUpdate.ts` | `preconditionUpdate` helper with 0-row conflict detection + bounded 3x reconcile + exhaustion toast | VERIFIED | 109 lines. Exports `preconditionUpdate`. Contains `.eq("updated_at", prev as never)`, `data.length > 0` success check, conflict re-read loop, `maxAttempts` bound (default 3), CR-01 guard at lines 47-61. |
| `src/stores/sessionStore.ts` | `updateItemField` routes through `preconditionUpdate`; offline enqueue carries `updated_at` snapshot | VERIFIED | Imports `preconditionUpdate` at line 5. Calls it at line 433. Offline enqueue at lines 468-471 carries `updated_at: originalItem.updated_at`. WR-02 fix present: fresh token folded back into local state at lines 447-458. |
| `src/services/geminiContinuous.ts` | `mergeFieldsIntoItem` exported; records value-at-read; per-field compare-and-skip on conflict (D-06) | VERIFIED | `mergeFieldsIntoItem` exported at line 227. Value-at-read snapshot at lines 274-277. D-06 reconcile function at lines 286-295: `fresh[field] !== valueAtRead[field]` → `continue` (skip). Composes `preconditionUpdate` at line 297. |
| `src/hooks/useWriteAheadQueue.ts` | Flush update branch applies `.eq(updated_at)` precondition + reconcile + Pitfall-5 retain + Pitfall-6 legacy fallback | VERIFIED | Lines 96-120. Destructures `updated_at` out of the written patch. Calls `preconditionUpdate` at line 109. `exhausted` result routes to `continue` (Pitfall 5 — entry NOT deleted). Pitfall 6 (missing `updated_at`) handled inside `preconditionUpdate` via CR-01 guard. |
| `src/db/types.ts` | `WriteAheadEntry.payload` comment documenting `updated_at` snapshot convention; no Dexie version bump | VERIFIED | Lines 109-114 contain WHY-comment. No structural change to `WriteAheadEntry`. |
| `src/tests/optimistic-update.test.ts` | `preconditionUpdate` helper spec (6 tests GREEN, includes 2 CR-01 cases) | VERIFIED | 6/6 GREEN. Tests: first-try success, fresh-token on re-apply, re-read-returns-nothing stops loop, CR-01 undefined-token re-reads, CR-01 undefined-token+gone-row is noop, exhaustion toast. |
| `src/tests/continuous-merge-no-clobber.test.ts` | HEADLINE race test GREEN (AI merge does not clobber user edit) | VERIFIED | 1/1 GREEN. Asserts `updatePatches[1]` does not contain user-changed `title`; does contain untouched `description`. |
| `src/tests/write-ahead-queue.test.ts` | Extended: flush precondition + 0-row reconcile + legacy fallback | VERIFIED | 17/17 GREEN (3 Phase-39 cases + 14 pre-existing). |
| `src/tests/supabase-types.test.ts` | Type-level assertion `items.Row.updated_at` is `string` | VERIFIED | 10/10 GREEN. Line 81: "items Row includes updated_at (string) — Phase 39 optimistic-locking version token". |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `optimisticUpdate.ts` | `supabase.from('items').update().eq('id').eq('updated_at').select()` | precondition write | WIRED | Lines 70-75: `.eq("id", id).eq("updated_at", prev as never).select()` |
| `optimisticUpdate.ts` | `notificationStore.notifyError` | exhaustion surface | WIRED | Lines 103-107: `useNotificationStore.getState().notifyError(...)` |
| `sessionStore.ts` | `optimisticUpdate.ts:preconditionUpdate` | import + call | WIRED | Line 5 import, line 433 call |
| `geminiContinuous.ts` | `optimisticUpdate.ts:preconditionUpdate` + `ReconcileFn` | import + compose | WIRED | Line 14 import, line 297 call with custom D-06 reconcile |
| `useWriteAheadQueue.ts` | `optimisticUpdate.ts:preconditionUpdate` | import + flush | WIRED | Line 7 import, line 109 call |
| `migration` | `public.set_updated_at()` | execute function in trigger | WIRED | Line 11-13 of migration: `execute function public.set_updated_at()` |
| `database.types.ts` | `items.Row.updated_at: string` | `npm run db:types` regen | WIRED | Line 363 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `optimisticUpdate.ts` | `prevUpdatedAt` | Caller passes item's `updated_at` from prior DB read | Yes — passed from live `items.Row` fetched by store | FLOWING |
| `sessionStore.ts:updateItemField` | `originalItem.updated_at` | Local store item from `fetchItems` (DB-sourced) | Yes — populated from real Supabase query | FLOWING |
| `geminiContinuous.ts:mergeFieldsIntoItem` | `snapshotRow.updated_at` | `supabase.from("items").select("*").eq("id").maybeSingle()` at line 268 | Yes — live DB read before write | FLOWING |
| `useWriteAheadQueue.ts` flush | `updated_at` (from payload) | `enqueueWrite` payload carrying `originalItem.updated_at` (snapshotted in sessionStore) | Yes — snapshot captured from live store item at enqueue time | FLOWING |

---

### Critical Finding: CR-01 (undefined-token silent clobber)

The 39-REVIEW.md identified CR-01 as a Critical lost-write hole: `prevUpdatedAt === undefined` reaching `.eq("updated_at", undefined)` would cause supabase-js to DROP the filter, producing an unconditional last-writer-wins clobber.

**Status: FIXED**

`optimisticUpdate.ts:47-61` contains the explicit guard:
```
if (prev === undefined || prev === null) {
  // re-read to obtain a real token; if row gone → noop, do not write
}
```

Two dedicated test cases in `optimistic-update.test.ts` ("CR-01: a missing (undefined) token re-reads..." and "CR-01: a missing token whose row is gone...") cover both the successful re-read path and the noop path. Both GREEN.

**Review Warnings (WR-01 through WR-05) disposition:**

- **WR-02 (stale local token after write):** Fixed — `sessionStore.ts:447-458` folds the fresh `updated_at` token returned by `preconditionUpdate` back into local state.
- **WR-01 (noop conflates gone vs skipped):** Accepted design — for this app's call patterns, the distinction is not a live lost-write risk. No change.
- **WR-03 (stale enqueue snapshot):** Low severity once CR-01 and WR-02 are resolved. Not a live lost-write since the queue flush reconciles on 0-row.
- **WR-04 (strict inequality on non-primitives):** Latent; all current `MERGE_FIELDS` are scalar text. Not a live bug.
- **WR-05 (exhaustion retry stacking):** Not a data-loss issue. Acceptable for v1.3.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite: 0 failures | `npm test` | **710 passed, 49 todo, 4 skipped, 0 failed** (96 files) | PASS |
| `optimistic-update.test.ts` (6 tests incl. 2 CR-01) | `npx vitest --run src/tests/optimistic-update.test.ts` | 6/6 GREEN | PASS |
| HEADLINE race test | `npx vitest --run src/tests/continuous-merge-no-clobber.test.ts` | 1/1 GREEN | PASS |
| write-ahead-queue tests (17) | `npx vitest --run src/tests/write-ahead-queue.test.ts` | 17/17 GREEN | PASS |
| supabase-types tests (10) | `npx vitest --run src/tests/supabase-types.test.ts` | 10/10 GREEN | PASS |
| TypeScript + Vite build | `npm run build` | Clean (pre-existing chunk-size advisory only) | PASS |

---

### Probe Execution

No probes declared or conventional probe scripts found for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DAT-3 | 39-01, 39-02, 39-03 | Track-2 quality track — optimistic concurrency on `items` writes. No formal row in REQUIREMENTS.md (ROADMAP notes "none mapped — Track-2 quality track / DAT-3"). | SATISFIED | All four ROADMAP success criteria verified. Migration + types + helper + user-edit + AI-merge + offline-flush paths implemented and test-green. |

Note: DAT-3 has no formal row in `.planning/REQUIREMENTS.md` (the file has no DAT-* entries). This is consistent with the ROADMAP's own note ("Requirements: none mapped — Track-2 quality track / DAT-3"). The SC-level verification above constitutes the coverage check.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No TBD/FIXME/XXX/TODO markers, no stub returns, no orphaned implementations found in phase 39 files |

Scanned: `src/db/optimisticUpdate.ts`, `src/stores/sessionStore.ts` (phase 39 region), `src/services/geminiContinuous.ts`, `src/hooks/useWriteAheadQueue.ts`, `src/db/types.ts`. No blockers.

---

### Human Verification Required

#### 1. Live DB trigger bump

**Test:** Connect to the prod Supabase project, pick any `items` row, run `UPDATE items SET title = 'verify-trigger-' || title WHERE id = '<some-id>' RETURNING id, updated_at`. Re-run the SELECT to confirm `updated_at` advanced past its prior value.
**Expected:** `updated_at` is later than the row's previous value; for backfilled rows `updated_at >= created_at`.
**Why human:** Migration applied via supabase MCP (Claude-owned, D-046). The 39-VALIDATION.md designates this as Manual-Only. The SUMMARY records it was verified at apply time (0 null rows, trigger present in `pg_trigger`), but a live re-check closes the deferred audit loop.

#### 2. On-device race: user edit vs AI continuous-mode chunk

**Test:** Enable `CONTINUOUS_MODE_ENABLED=true` in a dev build, start a cataloging session, dictate an item while simultaneously editing a field in the same item. Observe the DB after the AI merge completes.
**Expected:** The user's typed value persists in the DB; the AI merge preserved any field it was confident about (untouched by user) and yielded on the field the user edited. The user does NOT see an ErrorToast for their own edit (the toast should only appear on exhaustion after 3 AI-merge retries under extreme contention).
**Why human:** Per project policy (memory: v13-push-uat-at-milestone-end), on-device UAT is deferred to v1.3 milestone end. The HEADLINE unit test proves correctness at the mock layer; the on-device race requires a live browser, live Supabase, and live concurrent Gemini writes.

---

### Gaps Summary

No automated gaps. All four ROADMAP Success Criteria are verified in the codebase:

1. SC-1: Migration file exists with correct trigger, types regenerated, cross-app schema docs updated.
2. SC-2: Both `updateItemField` and `mergeFieldsIntoItem` route through `preconditionUpdate` with `.eq("updated_at")` precondition; 0-row = conflict → re-read + reconcile.
3. SC-3: User-edit reconcile is re-apply-verbatim (intent-preserving); AI-merge reconcile implements D-06 compare-and-skip; HEADLINE test proves AI does not clobber user's field.
4. SC-4: Exhaustion surfaces via `notifyError`; HEADLINE test proves user edit survives an AI race.

Critical review finding CR-01 is fixed in code and covered by two dedicated test cases.

The two human verification items are process-required deferred checks (live DB trigger confirmation + on-device race), not code defects. Status is `human_needed` per policy.

---

_Verified: 2026-06-02T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
