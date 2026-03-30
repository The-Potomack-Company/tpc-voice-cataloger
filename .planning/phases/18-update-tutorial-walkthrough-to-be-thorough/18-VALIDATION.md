---
phase: 18
slug: update-tutorial-walkthrough-to-be-thorough
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 18 -- Validation Strategy

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
| 18-00-01 | 00 | 0 | WT-01..WT-08 stubs | scaffold | `npx vitest run src/tests/walkthrough.test.tsx src/tests/walkthrough-status.test.ts` | Created in W0 | ✅ green |
| 18-01-01 | 01 | 1 | WT-04, WT-05 | unit | `npx vitest run src/tests/walkthrough-status.test.ts` | ✅ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | WT-01..WT-03 | unit | `npx vitest run src/tests/walkthrough.test.tsx` | ✅ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | WT-06..WT-08 | unit | `npx vitest run src/tests/walkthrough.test.tsx` | ✅ W0 | ⬜ pending |
| 18-02-02 | 02 | 2 | WT-06 | unit | `npx vitest run src/tests/walkthrough-status.test.ts src/tests/persist-scoping.test.ts` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/tests/walkthrough.test.tsx` -- covers WT-01, WT-02, WT-03, WT-06, WT-07, WT-08
- [x] `src/tests/walkthrough-status.test.ts` -- covers WT-04, WT-05
- [ ] Existing `src/tests/persist-scoping.test.ts` may need updates if `hasCompletedWalkthrough` is removed from uiStore

*Wave 0 plan (18-00-PLAN.md) creates both test stub files with it.todo() markers.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual walkthrough flow | UI polish | Visual appearance cannot be automated | Step through walkthrough in browser, verify illustrations render, transitions work |
| Role-specific steps display | Role awareness | Requires Supabase auth context | Log in as admin -- verify admin steps appear; log in as specialist -- verify specialist steps appear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
