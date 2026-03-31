---
phase: 20
slug: fix-house-session-json-import-on-rfc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing + Chrome extension DevTools |
| **Config file** | none — Chrome extension, no test framework |
| **Quick run command** | `Load extension in Chrome, import a house session JSON` |
| **Full suite command** | `End-to-end: export from TPC_App → import via extension on RFC` |
| **Estimated runtime** | ~60 seconds per item |

---

## Sampling Rate

- **After every task commit:** Verify changed file loads without errors in Chrome DevTools console
- **After every plan wave:** Full import of a test house session JSON
- **Before `/gsd:verify-work`:** Full end-to-end export→import cycle
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | D-01 thru D-07 | manual | Browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — Chrome extension loaded via developer mode.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Photos upload to RFC | D-01 | DOM automation on live RFC page | Export house session from TPC_App, import via extension, verify photos appear on RFC item page |
| Style dropdown set to General | D-06 | Page reload side-effect | Import item where style is not General, verify it switches to General and fields populate after reload |
| Next/Add navigation | D-03 | Multi-page navigation on live site | Import 3+ items, verify extension walks through each sequentially |
| Field completeness | D-07 | Visual verification on RFC | Check all text fields filled: title, description, condition, estimate, measurements, department |
| Export data correctness | D-05 | Cross-repo verification | Export from TPC_App, inspect JSON for base64 photos and all fields |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: every wave verified with browser test
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
