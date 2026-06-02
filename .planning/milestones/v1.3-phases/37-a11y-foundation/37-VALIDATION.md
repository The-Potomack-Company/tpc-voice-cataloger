---
phase: 37
slug: a11y-foundation
status: draft
nyquist_compliant: false
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
| TBD | — | — | A11Y / SC1-4 | — | focus-trap can't be escaped except via Escape/close | unit + axe | `npx vitest run` | ❌ W0 | ⬜ pending |

*Planner replaces TBD rows from PLAN.md tasks.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
