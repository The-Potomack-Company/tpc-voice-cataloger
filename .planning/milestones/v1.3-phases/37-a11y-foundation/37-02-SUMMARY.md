---
phase: 37
plan: 02
subsystem: accessibility
tags: [a11y, focus-trap, modal, jest-axe, nested-trap, reduced-motion, tdd]
requires:
  - useFocusTrap hook (src/hooks/useFocusTrap.ts) — Plan 01
  - Modal primitive (src/ui/Modal.tsx) — Plan 01
  - jest-axe toHaveNoViolations matcher (src/tests/setup.ts) — Plan 01
provides:
  - All 5 modal sites are accessible dialogs (role=dialog + aria-modal + Escape + trap)
  - ConfirmDialog migrated — 8 downstream render sites inherit the trap unchanged
  - ItemPeekModal gains role/aria-modal/Escape (its prior total gap is closed)
  - PhotoLightbox nested-trap behavior (inner confirm owns focus; Escape returns to lightbox)
  - MigrationSplash reduced-motion-gated fade + real focus trap
  - src/tests/a11y/modals.test.tsx — jest-axe scan + nested-trap + reduced-motion suite
affects:
  - src/ui/Modal.tsx (additive overlayClassName/panelClassName/bareOverlay props)
tech-stack:
  added: []
  patterns:
    - non-centered modals route through <Modal> via override props (bareOverlay)
    - blocking splash folds useFocusTrap in directly (no-op onClose swallows Escape)
    - nested portal modals self-scope keydown — inner panel owns Escape (no manual stack)
key-files:
  created:
    - src/tests/a11y/modals.test.tsx
  modified:
    - src/components/ConfirmDialog.tsx
    - src/components/ReturnDialog.tsx
    - src/components/ItemPeekModal.tsx
    - src/components/PhotoLightbox.tsx
    - src/components/MigrationSplash.tsx
    - src/ui/Modal.tsx
decisions:
  - "Extended <Modal> with additive overlayClassName/panelClassName/bareOverlay props (defaults preserve the centered-card look) so the bottom-sheet ItemPeekModal and full-screen PhotoLightbox can inherit trap+ARIA+portal without swapping their layout — satisfies the plan's ItemPeekModal→Modal / PhotoLightbox→Modal key-links without forking the primitive."
  - "MigrationSplash folds useFocusTrap in directly (keeps its own opaque portal) rather than routing through <Modal>'s scrim — it is a splash, not a centered dialog (per Plan 01 SUMMARY guidance). Escape is a no-op: a blocking migration splash has no user-driven close."
  - "Nested-trap needs no explicit stack: both lightbox and confirm portal to document.body as siblings, and each useFocusTrap keydown listener is bound to its own panel. Escape inside the inner confirm fires only the inner listener (its panel contains activeElement), so it closes just the confirm and restores focus to the lightbox — verified by explicit test (T-37-03)."
metrics:
  duration: ~10 min
  tasks: 3
  files: 7
  completed: 2026-06-02
---

# Phase 37 Plan 02: Modal Migrations Summary

Migrated all five real modal components onto the Plan 01 `<Modal>` primitive — closing the role/aria-modal/Escape/focus-trap gaps across the app — and proved each with a jest-axe scan plus an explicit nested-trap test. Migrating `ConfirmDialog` alone fixed 8 downstream render sites.

## What Was Built

**Task 1 — ConfirmDialog / ReturnDialog / ItemPeekModal** (RED `ee395d8` → GREEN `1440163`)
- **ConfirmDialog**: panel body wrapped in `<Modal>`, dropped its own `fixed inset-0` scrim; `ariaLabelledBy` → its `<h3>`; Escape === cancel (non-destructive); destructive red-button branch kept; **prop surface unchanged** so all 8 callers (AccountManagement, ItemCard, ItemList, NewSession, Settings, Sessions, PhotoLightbox-nested, SessionDetail×4) are untouched.
- **ReturnDialog**: wrapped in `<Modal>`; `<textarea>` is the `initialFocusRef`; Escape === cancel.
- **ItemPeekModal**: gains `role=dialog` + `aria-modal` + Escape (**all previously absent — its biggest single gap**); `aria-labelledby` → its existing `<h2>`; close button grown from `padding:6` (~28px) to `min-h-11 min-w-11` (44px) without ballooning the glyph (D-06). Kept its bottom-sheet `max-w-lg` / sticky-header layout via Modal's override props.

**Task 2 — PhotoLightbox / MigrationSplash** (RED `2a8ade8` → GREEN `43a95ed`)
- **PhotoLightbox**: wrapped in `<Modal>` (`bareOverlay`, keeps the black full-screen look), gains role/aria-modal/trap/Escape; touch swipe nav (`onTouchStart/End`) preserved on an inner wrapper; close/trash labels intact. Its nested `ConfirmDialog` (now also a `<Modal>`) owns focus while open; **Escape on the inner confirm returns focus to the lightbox, not all the way out** (T-37-03 mitigation).
- **MigrationSplash**: folds `useFocusTrap` in directly (keeps its opaque full-screen splash + own portal); opacity fade gated behind `prefers-reduced-motion` (MOTION-04 — instant when reduce is set); conditional error-state buttons reachable via the per-keydown focusable recompute; resolves the pre-existing `TS6133` unused `skipped` binding noted in 37-01-SUMMARY.

**Task 3 — jest-axe scan suite** (test artifact, authored RED-first across Tasks 1-2)
- `src/tests/a11y/modals.test.tsx` (22 tests): for each of the 5 modals — render open, assert `role=dialog` + `aria-modal=true`, assert Escape calls the close/cancel handler, and `axe(document.body, { rules: { 'color-contrast': { enabled: false } } })` → `toHaveNoViolations`. Plus the nested-trap test (focus moves into the inner confirm; Escape returns to the lightbox) and the MigrationSplash reduced-motion test (override `window.matchMedia` to `matches:true`, assert the fade transition is suppressed).

## Modal API note (for Plan 03)

`<Modal>` gained three additive, backward-compatible props:
```tsx
<Modal
  ...
  overlayClassName?={string}   // override the scrim wrapper (default: centered flex)
  panelClassName?={string}     // override the panel (default: max-w-sm rounded card)
  bareOverlay?={boolean}       // true → Modal paints no scrim bg; caller's overlay owns it
/>
```
Defaults reproduce the original centered-card behavior exactly, so Plan 01's existing
`modal.test.tsx` is unaffected. Use these for any non-centered surface (bottom-sheet, splash, full-screen).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `<Modal>` had no way to host non-centered modals**
- **Found during:** Task 1 (ItemPeekModal) — Modal's fixed `max-w-sm p-6` centered card would have destroyed ItemPeekModal's `max-w-lg` bottom-sheet + sticky-header layout, and later PhotoLightbox's full-screen black look.
- **Fix:** Added additive `overlayClassName` / `panelClassName` / `bareOverlay` props to `Modal` (defaults preserve the original look). This let ItemPeekModal and PhotoLightbox route through `<Modal>` (honoring the plan's key-links) while keeping their own layout, instead of forking the primitive or hand-rolling a second trap.
- **Files modified:** src/ui/Modal.tsx
- **Commit:** 1440163

**2. [Plan-resolved] MigrationSplash routes the trap in directly, not through `<Modal>`'s scrim**
- The plan's Task 2 action said "route through `<Modal>` but override the scrim/panel to retain the opaque splash." Modal's scrim is a centered flex container; a splash is full-screen with no scrim. Per Plan 01 SUMMARY's explicit guidance ("MigrationSplash keeps its opaque splash look — fold the trap in rather than swapping to the centered scrim"), MigrationSplash folds `useFocusTrap` in directly while keeping its own `createPortal`. Net behavior is identical to the plan's intent (real trap + reduced-motion gate); only the wiring mechanism differs. No deviation in outcome.

### Note on TDD commit cadence
The Task 3 deliverable (`modals.test.tsx`) is a single test file built incrementally: its
RED slices landed as the `test(37-02)` commits for Tasks 1 (`ee395d8`) and 2 (`2a8ade8`),
each preceding its `feat` GREEN, satisfying the RED→GREEN gate. Task 3 added no production
code (test-only), so it has no separate `feat` commit — the file was already complete and
green after Task 2's GREEN.

## Threat Model Compliance

- **T-37-03 (DoS — nested trap)**: mitigated. Explicit test asserts opening the inner photo-delete confirm moves focus into it and Escape returns to the lightbox (lightbox stays open, outer `onClose` not called) — user is never stranded between two traps.
- **T-37-04 (Repudiation — ConfirmDialog migration)**: accepted as planned. Confirm semantics unchanged; the same `onConfirm` fires; no new destructive path introduced by wrapping in `<Modal>`.

## Verification

- `npm test -- src/tests/a11y/modals.test.tsx` → **22 tests green** (5 modals × role/aria-modal/Escape/axe + nested-trap + reduced-motion).
- `npm test` full suite → **84 files passed, 4 skipped, 671 passed, 0 failures** (up from 649 in Plan 01; the 8 ConfirmDialog callers and existing dialog tests did not regress).
- `npx tsc --noEmit -p tsconfig.app.json` → **0 errors** (the pre-existing MigrationSplash `TS6133` is now resolved).

## TDD Gate Compliance

Both behavior-adding tasks followed RED → GREEN:
- Task 1: `test(37-02)` `ee395d8` (RED) → `feat(37-02)` `1440163` (GREEN).
- Task 2: `test(37-02)` `2a8ade8` (RED) → `feat(37-02)` `43a95ed` (GREEN).

No REFACTOR commits — implementations were clean on first GREEN.

## Known Stubs

None.

## Self-Check: PASSED

All modified files exist; `src/tests/a11y/modals.test.tsx` created; all 4 task commits (ee395d8, 1440163, 2a8ade8, 43a95ed) present in git log; full suite + tsc green.
