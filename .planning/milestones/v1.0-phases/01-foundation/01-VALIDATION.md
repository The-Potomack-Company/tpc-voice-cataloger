---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, aligned with Vite 7) |
| **Config file** | vitest config embedded in vite.config.ts (test property) — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | UX-01 | unit | `npx vitest run src/tests/pwa-manifest.test.ts -t "manifest"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | UX-03 | unit | `npx vitest run src/tests/layout.test.ts -t "orientation"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | UX-04 | unit | `npx vitest run src/tests/layout.test.ts -t "tab-bar"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 0 | UX-01 | unit | `npx vitest run src/tests/db.test.ts -t "schema"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vite.config.ts` — add `test` config block with jsdom environment, globals, setupFiles
- [ ] `src/tests/setup.ts` — import @testing-library/jest-dom matchers
- [ ] `src/tests/pwa-manifest.test.ts` — validates manifest fields for UX-01
- [ ] `src/tests/layout.test.ts` — validates tab bar rendering for UX-03, UX-04
- [ ] `src/tests/db.test.ts` — validates Dexie schema creation and basic CRUD
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All interactive elements have min 48px tap targets | UX-02 | CSS-level sizing, not unit-testable | Inspect all buttons/links on mobile device; verify computed min-height/min-width >= 48px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
