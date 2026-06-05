---
phase: 37
slug: a11y-foundation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 37-RESEARCH.md "Validation Architecture". Planner fills the Per-Task map from PLAN.md tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ jest-axe per-component a11y) + Playwright (@axe-core/playwright keyboard e2e) |
| **Config file** | vitest config + src/tests/setup.ts; playwright config (existing) |
| **Quick run command** | `npx vitest run <changed-test-file>` |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~30–90 seconds (vitest); e2e separate |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-test-file>` (incl. jest-axe scan for the touched component)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full vitest suite green; Playwright keyboard e2e green (or gated as human/CI item if auth fixture deferred)
- **Max feedback latency:** 90 seconds (vitest)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | D-05 / SC4 | T-37-SC | dev-deps test-only, no shipped runtime dep | setup | `npx vitest run` (matcher loads) | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | D-01 / SC1 | T-37-01 | focus trap escapable only via Escape/close | unit (tdd) | `npx vitest run src/tests/a11y/use-focus-trap.test.tsx` | ❌ W0 | ⬜ pending |
| 37-01-03 | 01 | 1 | D-02 / SC1 | T-37-01 | Modal sets role=dialog + aria-modal, restores focus | unit (tdd) | `npx vitest run src/tests/a11y/modal.test.tsx` | ❌ W0 | ⬜ pending |
| 37-02-01 | 02 | 2 | D-02 / SC1 | — | ConfirmDialog/ReturnDialog/ItemPeekModal trap + label | unit + axe | `npx vitest run src/tests/a11y/modal-migration.test.tsx` | ❌ W0 | ⬜ pending |
| 37-02-02 | 02 | 2 | D-02 / SC1 | — | PhotoLightbox nested-trap; MigrationSplash reduced-motion | unit + axe | `npx vitest run src/tests/a11y/nested-trap.test.tsx` | ❌ W0 | ⬜ pending |
| 37-02-03 | 02 | 2 | SC4 | — | all 5 modals pass jest-axe toHaveNoViolations | axe | `npx vitest run src/tests/a11y/modal-axe.test.tsx` | ❌ W0 | ⬜ pending |
| 37-03-01 | 03 | 2 | D-03/D-06/D-07 / SC2,SC3 | — | ⋯ trigger 44px + aria-label; menu keyboard-navigable | unit + axe | `npx vitest run src/tests/a11y/overflow-menu.test.tsx src/tests/a11y/touch-targets.test.tsx` | ❌ W0 | ⬜ pending |
| 37-03-02 | 03 | 2 | D-03/D-04 / SC3 | — | ⋯ delete routes to existing ConfirmDialog, no new destructive path | unit | `npx vitest run src/tests/a11y/row-overflow-delete.test.tsx` | ❌ W0 | ⬜ pending |
| 37-03-03 | 03 | 2 | SC4 | — | keyboard-only flow + axe clean (authed leg → HUMAN-UAT if no fixture) | e2e (playwright + axe) | `npx playwright test tests/e2e/a11y-keyboard.spec.ts` | ❌ W0 | ⬜ pending |

*Sampling continuity: every task has an automated command; no 3-consecutive-task gap. `touch-targets.test.tsx` is authored RED-first inside Plan 03 Task 1 alongside OverflowMenu (not a separate Wave-0 stub).*

---

## Wave 0 Requirements

- [ ] Add `jest-axe@10` (bundles axe-core + own types — do NOT add stale `@types/jest-axe`) and `@axe-core/playwright@4.11` as dev-deps (D-05).
- [ ] Wire jest-axe matcher into src/tests/setup.ts.
- [ ] useFocusTrap + <Modal> test scaffolds (Tab/Shift-Tab wrap, Escape, focus-restore, nested-trap for PhotoLightbox→ConfirmDialog).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Keyboard-only record→edit→save completes | SC4 | Needs authed Playwright storage-state fixture; may defer to CI/human | With keyboard only (Tab/Enter/Esc), record a session, edit an item, save — no mouse, focus always visible |
| Screen-reader announces modal role/label | SC1 | Assistive tech requires human/AT | Open each migrated modal with a screen reader; confirm dialog role + label announced, focus trapped |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (dev-deps + jest-axe matcher + test scaffolds in Plan 01 Task 1)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-02
