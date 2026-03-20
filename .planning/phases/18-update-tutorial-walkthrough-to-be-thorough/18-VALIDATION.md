---
phase: 18
slug: update-tutorial-walkthrough-to-be-thorough
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | Migration | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | Hook | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | Walkthrough UI | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | Role steps | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | Integration | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for walkthrough hook and component
- [ ] Supabase client mock utilities (if not already present)

*Existing infrastructure covers most phase requirements — vitest is already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual walkthrough flow | UI polish | Visual appearance cannot be automated | Step through walkthrough in browser, verify illustrations render, transitions work |
| Role-specific steps display | Role awareness | Requires Supabase auth context | Log in as admin — verify admin steps appear; log in as specialist — verify specialist steps appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
