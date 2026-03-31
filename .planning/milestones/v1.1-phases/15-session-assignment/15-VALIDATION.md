---
phase: 15
slug: session-assignment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | ASGN-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | ASGN-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | ASGN-03 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | ASGN-04 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for ASGN-01 through ASGN-04
- [ ] Shared fixtures for Supabase mocking

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Specialist sees only assigned sessions | ASGN-02 | RLS policy verification requires real Supabase auth | Log in as specialist, verify session list shows only assigned/created sessions |
| Admin sees all sessions with assignee | ASGN-04 | Visual verification of assignee display | Log in as admin, verify all sessions visible with assignee names |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
