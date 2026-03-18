---
phase: 16
slug: session-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run src/tests/session-lifecycle.test.tsx -x` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/session-lifecycle.test.tsx -x`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | LIFE-01 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "submit" -x` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | LIFE-02 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "read-only" -x` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | LIFE-03 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "admin edit" -x` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | LIFE-04 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "return" -x` | ❌ W0 | ⬜ pending |
| 16-01-05 | 01 | 1 | LIFE-05 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "review notes" -x` | ❌ W0 | ⬜ pending |
| 16-01-06 | 01 | 1 | LIFE-06 | unit | `npx vitest run src/tests/session-lifecycle.test.tsx -t "export" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/session-lifecycle.test.tsx` — stubs for LIFE-01 through LIFE-06 (submit, lock, admin edit, return, notes, export gating)
- [ ] `src/tests/return-dialog.test.tsx` — covers ReturnDialog component (textarea, confirm, cancel)
- [ ] `src/tests/use-user-role.test.ts` — covers useUserRole hook (admin detection, specialist detection, loading state)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky submit bar visual placement | LIFE-01 | CSS sticky positioning varies by scroll context | Scroll session items list, verify bar stays visible at bottom |
| Status badge color accuracy | LIFE-01, LIFE-04 | Visual color rendering | Inspect badge colors match design (submitted=blue, returned=amber) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
