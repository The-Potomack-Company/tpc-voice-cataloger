---
phase: 9
slug: deffered-items
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-16
updated: 2026-03-17
---

# Phase 9 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | MIGRATE-01 | unit | `npx vitest run src/tests/db.test.ts -t "v6"` | Plan 01 Task 1 creates | pending |
| 09-01-02 | 01 | 1 | AI-06 | unit | N/A (no-op, already satisfied) | N/A | pending |
| 09-01-03 | 01 | 1 | MIGRATE-01 | unit | `npx vitest run src/tests/sessions.test.ts -t "archive"` | Plan 01 Task 2 creates | pending |
| 09-02-01 | 02 | 1 | IMPORT-01 | unit | `npx vitest run src/tests/importReceipts.test.ts` | Plan 02 Task 1 creates (TDD) | pending |
| 09-02-02 | 02 | 1 | IMPORT-02 | unit | `npx vitest run src/tests/importReceipts.test.ts` | Plan 02 Task 1 creates (TDD) | pending |
| 09-02-03 | 02 | 1 | IMPORT-03 | unit | `npx vitest run src/tests/importReceipts.test.ts` | Plan 02 Task 1 creates (TDD) | pending |
| 09-02-04 | 02 | 1 | IMPORT-04 | unit | `npx vitest run src/tests/importReceipts.test.ts` | Plan 02 Task 1 creates (TDD) | pending |
| 09-03-01 | 03 | 2 | DATA-01a | unit | `npx vitest run src/tests/export-history.test.ts` | Plan 03 Task 1 creates | pending |
| 09-03-02 | 03 | 2 | DATA-01b | unit | `npx vitest run src/tests/export-history.test.ts` | Plan 03 Task 1 creates | pending |
| 09-03-03 | 03 | 2 | DATA-01c | type | `npx tsc --noEmit` | N/A (UI wiring) | pending |
| 09-03-04 | 03 | 2 | DATA-01d | type | `npx tsc --noEmit` | N/A (UI wiring) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All Wave 0 test files are created by their respective plan tasks (not orphaned):

- [x] `src/tests/db.test.ts` -- Plan 01 Task 1 adds v6 migration tests (MIGRATE-01)
- [x] `src/tests/sessions.test.ts` -- Plan 01 Task 2 adds archive/unarchive tests (MIGRATE-01 archive support)
- [x] `src/tests/importReceipts.test.ts` -- Plan 02 Task 1 creates via TDD (IMPORT-01 through IMPORT-04)
- [x] `src/tests/export-history.test.ts` -- Plan 03 Task 1 creates (DATA-01a, DATA-01b)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File picker opens on iOS Safari | IMPORT-01 | Device-specific browser behavior | Open app on iOS Safari, tap Import, verify file picker appears |
| Archive section collapses/expands smoothly | DATA-01c | Visual/animation behavior | Archive a session, verify collapsible section appears and animates |
| Archived sessions are read-only | DATA-01c | Visual UI enforcement | Archive a session, open it, verify edit controls are disabled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
