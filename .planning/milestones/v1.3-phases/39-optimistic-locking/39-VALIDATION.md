---
phase: 39
slug: optimistic-locking
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. HIGH-RISK phase (concurrency + DB trigger + reconciliation) — a careless partial implementation silently drops writes, so coverage of the conflict/reconcile paths is mandatory, not advisory.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test block) + `src/tests/setup.ts` |
| **Quick run command** | `npx vitest --run src/tests/<file>.test.ts` |
| **Full suite command** | `npm test` (`vitest --run`) |
| **Estimated runtime** | ~30–60 seconds (full suite) |

---

## Plan → Wave Map

| Plan | Wave | Scope | Type |
|------|------|-------|------|
| 39-01 | 0 | migration + backfill + trigger + type regen + schema docs + Wave-0 RED test scaffolds | execute (Claude-owned, D-046) |
| 39-02 | 1 | `preconditionUpdate` helper (TDD) + `updateItemField` wiring + offline enqueue snapshot | tdd |
| 39-03 | 2 | AI-merge D-06 compare-and-skip (TDD, HEADLINE) + offline flush precondition + legacy fallback | tdd |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest --run src/tests/optimistic-update.test.ts` + the specific test file touched
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite green **AND** manual migration-on-branch verification (trigger bumps `updated_at` on UPDATE)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Behavior | Plan | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|------|------------|-----------------|-----------|-------------------|-------------|--------|
| Migration adds `items.updated_at` + BEFORE UPDATE trigger (reuse `set_updated_at()`) + backfill `coalesce(created_at, now())` | 39-01 | 0 | T-39-00 | RLS on `items` undisturbed | manual/DB | apply migration to branch DB; assert `updated_at` bumps on UPDATE | ❌ Wave 0 (Claude-owned, D-046) | ⬜ pending |
| Types regenerated include `items.Row.updated_at: string` | 39-01 | 0 | — | N/A | unit | extend `src/tests/supabase-types.test.ts` | ⚠️ extend existing | ⬜ pending |
| Wave-0 RED specs exist and fail (no impl yet) | 39-01 | 0 | — | test-first | unit | `npx vitest --run src/tests/optimistic-update.test.ts` (expected RED) | ❌ Wave 0 | ⬜ pending |
| 0-row precondition miss detected (`data:[]`, not error) | 39-02 | 1 | T-39-01 | conflict ≠ thrown error; RLS-deny disambiguated by re-read | unit | `npx vitest --run src/tests/optimistic-update.test.ts` | ❌ Wave 0 | ⬜ pending |
| `preconditionUpdate` re-reads + re-applies user field, ≤3 attempts, refreshes prev token each attempt | 39-02 | 1 | T-39-02 | bounded loop — no livelock | unit | same | ❌ Wave 0 | ⬜ pending |
| Exhaustion (3×) surfaces `notifyError` w/ Retry callback | 39-02 | 1 | T-39-02 | failure visible, not silent | unit | same (mock `notificationStore`) | ❌ Wave 0 | ⬜ pending |
| `updateItemField` routes through helper; offline enqueue carries `updated_at` snapshot | 39-02 | 1 | T-39-01 | user intent preserved; offline edit snapshotted | unit | `npx vitest --run src/tests/update-item-field-notify.test.ts` | ✅ exists (no-regress) | ⬜ pending |
| **AI continuous-merge skips user-changed field (D-06) — HEADLINE RACE** | 39-03 | 2 | T-39-03 | AI yields to user; user edit survives | unit | `npx vitest --run src/tests/continuous-merge-no-clobber.test.ts` (drive `mergeFieldsIntoItem` directly — continuous UI dormant, `CONTINUOUS_MODE_ENABLED=false`) | ❌ Wave 0 | ⬜ pending |
| Offline flush 0-row routes through reconcile; queued edit survives, unrelated fields untouched | 39-03 | 2 | T-39-04 | offline edit not lost on reconnect | unit | `npx vitest --run src/tests/write-ahead-queue.test.ts` | ⚠️ extend existing | ⬜ pending |
| Legacy queue entry (no `updated_at` snapshot) handled (fallback, not crash) | 39-03 | 2 | T-39-05 | backward-compat, no clobber | unit | same | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/optimistic-update.test.ts` — shared `preconditionUpdate` helper: 0-row detect, re-read, re-apply, 3-attempt cap, exhaustion → `notifyError`
- [ ] `src/tests/continuous-merge-no-clobber.test.ts` — D-06 per-field compare-and-skip; HEADLINE race driving `mergeFieldsIntoItem` directly (NOT via the dormant continuous UI)
- [ ] Extend `src/tests/write-ahead-queue.test.ts` — snapshot capture at enqueue + precondition on flush + legacy-entry fallback
- [ ] Extend `src/tests/supabase-types.test.ts` — assert `items.Row.updated_at: string`
- [ ] Reuse mock idioms: `vi.hoisted` mockFrom (`update-item-field-notify.test.ts`), `createMockFrom` (`gemini-no-clobber.test.ts`) — chain now needs a second `.eq("updated_at", …)` + `.select()` returning `{data, error}`. **Precedent: `src/services/offlineQueue.ts:123-132` already uses this exact `.update().eq().select()` + `length===0` idiom (Phase 33) — mirror its test approach.**

*All Wave 0 test files are created in Plan 39-01 (Task 3) so Plans 02–03 turn them GREEN (TDD-first).*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Migration applies cleanly: column added, trigger attached, existing rows backfilled | Claude-owned schema change (D-046); requires live/branch Supabase | Apply migration to a Supabase branch; `UPDATE items SET title='x' WHERE id=…`; assert `updated_at` advanced past prior value and past `created_at` for backfilled rows |
| Cross-app schema docs updated | Doc consistency, not code-testable | `../_workspace/Schema/schema.md` shows `items.updated_at`; `../_workspace/Schema/migrations.md` logs the new migration |

---

## Validation Sign-Off

- [x] All conflict/reconcile tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references above
- [x] No watch-mode flags (all `--run`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (set by planner once tasks map to these tests)

**Approval:** planned (Wave-0 tests created in 39-01; impl GREEN in 39-02/03)
