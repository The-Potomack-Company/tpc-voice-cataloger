---
phase: 38
slug: migration-retryability
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 38-RESEARCH.md "Validation Architecture" (vitest + fake-indexeddb; idempotency/retry-after-partial).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ fake-indexeddb for Dexie) |
| **Config file** | vitest config + src/tests/setup.ts (existing) |
| **Quick run command** | `npx vitest run src/tests/data-migration.test.ts` |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed-test-file>`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** Full suite green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-* | 01 | 1 | SC1/SC2 | — | needsMigration true on partial; migrate idempotent (no dup session/item) | unit (tdd, fake-indexeddb) | `npx vitest run src/tests/data-migration.test.ts` | ✅ (exists, flips) | ⬜ pending |
| 38-02-* | 02 | 2 | SC3/SC4 | — | partial banner shows N + Retry sync re-runs only remaining rows | unit + component | `npx vitest run src/tests/migration-retry-banner.test.tsx` | ❌ W0 | ⬜ pending |

*Planner refines rows from final PLAN.md tasks. Sampling continuity: each task has an automated command.*

---

## Wave 0 Requirements

- [ ] Update existing `data-migration.test.ts:120-129` ("returns false when idMapping has entries") to assert `true` under D-01 — the SC1 TDD anchor (RED first).
- [ ] Un-mock `addIdMapping` in the DAT-1 preserve test (`:451-559`) for a real retry-after-partial idempotency assertion.
- [ ] Dexie v12 store-block scaffold ([oldId+type] compound index on idMapping).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live retry-after-partial against real Supabase | SC2/SC4 | Needs a real partial-migration state + Supabase project | Force a partial migration, tap "Retry sync", confirm only remaining rows sync and no duplicate Supabase sessions/items appear |
| Persistent banner shows correct N + dismiss persists | SC3 | Visual/persistence across reload | Trigger partial; confirm banner "N items not yet synced — Retry sync", dismiss persists across reload, retry clears it when complete |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-02
