---
phase: 36
slug: ux-visibility-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 36-RESEARCH.md "Validation Architecture" section. Planner fills the Per-Task map from PLAN.md tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts / vitest config (existing) |
| **Quick run command** | `npx vitest run <changed-test-file>` |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-test-file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | Track-2 quality | — | notifyError reaches store on failure path | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Planner replaces TBD rows from PLAN.md tasks. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Copy the existing `update-item-field-notify.test.ts` pattern for new error-path tests (per RESEARCH.md Wave-0 note).

*Existing vitest infrastructure covers the framework; new error-path assertions to be added per plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast visually appears bottom-24 + "Try Again" works | Criterion 1/4 | Visual/interaction in real browser | Trigger an export/login failure in preview; confirm ErrorToast renders and retry re-runs op |
| Migration `partial` banner copy | Criterion 3 | Requires a real partial-migration state | Force a partial migration; confirm copy reflects partial, not "success" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
