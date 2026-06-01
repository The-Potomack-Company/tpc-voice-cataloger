---
phase: 33
slug: offline-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (jsdom) + Testing Library |
| **Config file** | `vitest.config.ts` (existing; `src/tests/setup.ts` global setup) |
| **Quick run command** | `npx vitest run src/tests/offline-queue.test.ts src/tests/write-ahead-queue.test.ts src/tests/audio-recorder.test.ts` |
| **Full suite command** | `npm test` (`vitest --run`) |
| **Estimated runtime** | ~15 seconds (quick trio); full suite ~60s |

---

## Sampling Rate

- **After every task commit:** Run the single touched test file (e.g. `npx vitest run src/tests/offline-queue.test.ts`)
- **After every plan wave:** Run the quick-run trio + any new Wave-0 files
- **Before `/gsd:verify-work`:** Full `npm test` green + migration applied to prod + `npm run db:types` zero-unexpected-diff
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-00-* | 00 | 0 | Migration | T-33-01 | New columns inherit items RLS; NO broad GRANT regression (Phase-31 rule) | unit | `npx vitest run src/tests/supabase-types.test.ts` | ✅ extend | ⬜ pending |
| 33-01-* | 01 | 1 | REL-1 | — | N/A | unit | `npx vitest run src/tests/backoff.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-* | 01 | 1 | REL-1 | — | N/A | unit | `npx vitest run src/tests/offline-queue.test.ts` | ✅ extend | ⬜ pending |
| 33-02-* | 02 | 1 | REL-2 | T-33-02 | DB-atomic claim makes duplicate Gemini spend structurally impossible | unit | `npx vitest run src/tests/offline-queue.test.ts` | ✅ extend | ⬜ pending |
| 33-03-* | 03 | 2 | REL-3 | — | N/A | unit | `npx vitest run src/tests/error-classify.test.ts` | ❌ W0 | ⬜ pending |
| 33-03-* | 03 | 2 | REL-3 | — | N/A | unit + component | `npx vitest run src/tests/write-ahead-queue.test.ts` | ✅ extend | ⬜ pending |
| 33-04-* | 04 | 3 | REL-4 | — | N/A | unit (renderHook) | `npx vitest run src/tests/audio-recorder.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan/wave IDs above mirror the researcher's recommended wave split (W0 migration · W1 REL-1+REL-2 · W2 REL-3 · W3 REL-4); the planner is authoritative if it re-numbers.*

---

## Wave 0 Requirements

- [ ] `src/tests/backoff.test.ts` — REL-1 backoff math (pure `nextEligibleAt`/`isInBackoff`: base 5s, cap 5min, full-jitter bounds)
- [ ] `src/tests/error-classify.test.ts` — REL-3/REL-1 D-08 taxonomy (offline, AbortError, 4xx, 5xx, 429, Zod → permanent/transient)
- [ ] Blocked-badge component test — REL-3 D-10 (extend `src/tests/layout.test.tsx` or new `src/tests/blocked-badge.test.tsx`)
- [ ] Extend existing: `offline-queue.test.ts`, `write-ahead-queue.test.ts`, `audio-recorder.test.ts`, `supabase-types.test.ts` — new cases, no framework install
- [ ] Framework install: **none** — Vitest + Testing Library already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real 4-tab cross-tab concurrent drain produces zero duplicate Gemini calls in prod | REL-2 | Unit asserts the claim returns rows for one caller only; true multi-tab BroadcastChannel-free behavior needs real browser tabs against prod | Open the app in 4 tabs, queue one item offline, go online; confirm Gemini billed once (network tab / proxy logs) |
| Migration applies cleanly to prod with sibling isolation | Migration | Prod push is user-only (CLI auth); cannot be unit-tested | `node_modules/.bin/supabase db push --dry-run` shows ONLY the Phase-33 migration pending → `--yes` apply → `npm run db:types` zero-diff |
| Blocked badge visually anchors next to OfflineIndicator in header | REL-3 | Pixel placement/visual is manual | Force a permanent failure; confirm `tone="err"` badge with count renders next to OfflineIndicator; click → detail list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (backoff.test.ts, error-classify.test.ts, blocked-badge test)
- [ ] No watch-mode flags (all commands use `vitest run` / `--run`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
