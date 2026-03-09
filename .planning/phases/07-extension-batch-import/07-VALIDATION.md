---
phase: 7
slug: extension-batch-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 + jsdom |
| **Config file** | `jest.config.js` (in TPC_AI_Cataloger root) |
| **Quick run command** | `npx jest --testPathPattern=importController --no-coverage` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=importController --no-coverage`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | EXT-01 | unit | `npx jest tests/unit/content/importController.test.js -x` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | EXT-02 | unit | `npx jest tests/unit/content/importController.test.js -x` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | EXT-03 | unit | `npx jest tests/unit/content/importController.test.js -x` | ❌ W0 | ⬜ pending |
| 7-01-04 | 01 | 1 | EXT-04 | unit | `npx jest tests/unit/content/importController.test.js -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/content/importController.test.js` — stubs for EXT-01 through EXT-04
- [ ] Mock setup for chrome.storage.local, chrome.runtime.sendMessage, DOM elements (`#fld1`, `#fld2`, receipt input)
- [ ] Jest test infrastructure already exists — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Receipt input box discovery | EXT-02 | Requires live RFC Invaluable site | Inspect RFC edit form, find receipt input selector, add to constants |
| Full page reload state recovery | EXT-04 | jsdom doesn't simulate page reloads | Import 2+ items on live RFC, verify auto-resume after each Save |
| End-to-end batch import on RFC | EXT-04 | Requires live RFC Invaluable session | Export JSON from PWA, import via extension, verify all fields filled correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
