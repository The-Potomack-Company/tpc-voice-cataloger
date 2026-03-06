---
phase: 3
slug: session-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

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
| 03-01-01 | 01 | 0 | SESS-01 | unit | `npx vitest run src/tests/sessions.test.ts -t "persist" -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | SESS-02 | unit + component | `npx vitest run src/tests/sessions.test.ts -t "list" -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | SESS-03 | unit | `npx vitest run src/tests/sessions.test.ts -t "resume" -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | SESS-04 | unit | `npx vitest run src/tests/sessions.test.ts -t "auto-save" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/sessions.test.ts` — stubs for SESS-01 through SESS-04 plus CRUD, migration, soft-delete
- [ ] Schema migration test: create v1 DB, upgrade to v2, verify existing records get default `status: "active"` and `notes: ""`

*Existing infrastructure (Vitest) covers framework needs — no new install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swipe-to-delete gesture on mobile | SESS-02 | Touch interaction cannot be unit tested | Open on mobile device, swipe left on a session, confirm delete dialog appears |
| Browser close/reopen persistence | SESS-01 | Requires actual browser lifecycle | Create session, close browser tab, reopen app, verify session appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
