---
phase: 9
slug: deffered-items
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 9 — Validation Strategy

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
| 09-01-01 | 01 | 1 | MIGRATE-01 | unit | `npx vitest run src/tests/db.test.ts -t "v4"` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | AI-06b,c | unit | `npx vitest run src/tests/estimate-format.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | IMPORT-01 | unit | `npx vitest run src/tests/import-receipts.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | IMPORT-02 | unit | `npx vitest run src/tests/import-receipts.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-03 | 02 | 1 | IMPORT-03 | unit | `npx vitest run src/tests/import-receipts.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-04 | 02 | 1 | IMPORT-04 | unit | `npx vitest run src/tests/import-receipts.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 1 | AI-06a | unit | `npx vitest run src/tests/gemini-schema.test.ts -t "estimate"` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 1 | AI-06d | unit | `npx vitest run src/tests/estimate-format.test.ts` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | DATA-01a | unit | `npx vitest run src/tests/export-history.test.ts` | ❌ W0 | ⬜ pending |
| 09-04-02 | 04 | 2 | DATA-01b | unit | `npx vitest run src/tests/export-history.test.ts` | ❌ W0 | ⬜ pending |
| 09-04-03 | 04 | 2 | DATA-01c | unit | `npx vitest run src/tests/sessions.test.ts -t "archive"` | ❌ W0 | ⬜ pending |
| 09-04-04 | 04 | 2 | DATA-01d | unit | `npx vitest run src/tests/sessions.test.ts -t "archive"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/estimate-format.test.ts` — stubs for AI-06b, AI-06c, AI-06d (formatEstimate, parseEstimate)
- [ ] `src/tests/export-history.test.ts` — stubs for DATA-01a, DATA-01b (export history CRUD)
- [ ] `src/tests/import-receipts.test.ts` — stubs for IMPORT-01 through IMPORT-04 (spreadsheet parsing + validation)
- [ ] Update `src/tests/gemini-schema.test.ts` — stubs for AI-06a (structured estimate in schema)
- [ ] Update `src/tests/sessions.test.ts` — stubs for DATA-01c, DATA-01d (archive/un-archive)
- [ ] Update `src/tests/db.test.ts` — stubs for MIGRATE-01 (v4 migration)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File picker opens on iOS Safari | IMPORT-01 | Device-specific browser behavior | Open app on iOS Safari, tap Import, verify file picker appears |
| Archive section collapses/expands smoothly | DATA-01c | Visual/animation behavior | Archive a session, verify collapsible section appears and animates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
