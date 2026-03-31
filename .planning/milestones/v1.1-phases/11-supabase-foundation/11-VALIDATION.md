---
phase: 11
slug: supabase-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section at line 55-59) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | INFRA-01 | unit | `npx vitest run src/tests/supabase-client.test.ts -t "client"` | No -- Wave 0 | ⬜ pending |
| 11-01-02 | 01 | 1 | INFRA-01 | unit | `npx vitest run src/tests/supabase-types.test.ts -t "types"` | No -- Wave 0 | ⬜ pending |
| 11-01-03 | 01 | 1 | INFRA-01 | manual-only | `npx supabase db push --dry-run` | N/A | ⬜ pending |
| 11-01-04 | 01 | 1 | INFRA-02 | manual-only | Verify via SQL query on `pg_policies` | N/A | ⬜ pending |
| 11-01-05 | 01 | 1 | INFRA-02 | manual-only | Verify via SQL query on `pg_proc` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/supabase-client.test.ts` — stubs for INFRA-01 (client initialization, env var validation)
- [ ] `src/tests/supabase-types.test.ts` — stubs for INFRA-01 (generated types have expected table names)
- [ ] No new framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration SQL files are syntactically valid | INFRA-01 | Server-side SQL execution | Apply via `npx supabase db push --dry-run` and verify no errors |
| RLS policies exist on all tables | INFRA-02 | Requires live Supabase instance | Query `pg_policies` in Supabase SQL editor to verify all expected policies exist |
| Helper functions (is_admin, is_active_user) exist | INFRA-02 | Requires live Supabase instance | Query `pg_proc` in Supabase SQL editor to verify functions exist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
