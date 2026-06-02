---
phase: 37
plan: 01
subsystem: accessibility
tags: [a11y, focus-trap, modal, jest-axe, tdd]
requires: []
provides:
  - useFocusTrap hook (src/hooks/useFocusTrap.ts)
  - Modal primitive (src/ui/Modal.tsx)
  - jest-axe toHaveNoViolations matcher (global, via src/tests/setup.ts)
affects:
  - src/tests/setup.ts
tech-stack:
  added:
    - jest-axe@10 (devDependency, test-only)
    - "@axe-core/playwright@4.11 (devDependency, test-only)"
  patterns:
    - hand-rolled zero-dep focus trap (D-01)
    - shared portal+scrim dialog primitive (D-02)
    - jsdom-safe visibility filter (computed style, not offsetParent)
key-files:
  created:
    - src/hooks/useFocusTrap.ts
    - src/ui/Modal.tsx
    - src/tests/a11y/use-focus-trap.test.tsx
    - src/tests/a11y/modal.test.tsx
  modified:
    - src/tests/setup.ts
    - package.json
    - package-lock.json
decisions:
  - jest-axe + @axe-core/playwright are devDependencies only (D-05); no @types/jest-axe (jest-axe@10 ships its own types, DT stub is stale 3.5.9)
  - useFocusTrap filters focusables via getComputedStyle (display/visibility/hidden/aria-hidden) instead of offsetParent, which is always null under jsdom
  - Modal scrim uses color-mix(in oklch, var(--bg-3) 60%, transparent); scrim-click closes; open transition gated behind prefers-reduced-motion (MOTION-04)
metrics:
  duration: ~9 min
  tasks: 3
  files: 6
  completed: 2026-06-02
---

# Phase 37 Plan 01: a11y-foundation Summary

Hand-rolled `useFocusTrap` (zero-dep) + shared `<Modal>` dialog primitive, wired the jest-axe `toHaveNoViolations` matcher globally — the focus/ARIA foundation that Plans 02 (5 modal migrations) and 03 (overflow menu) wire onto.

## What Was Built

**Task 1 — dev-deps + matcher wiring** (`41453f0`)
- Installed `jest-axe@10` and `@axe-core/playwright@4.11` under `devDependencies` only (test-only, never shipped — D-05). No `@types/jest-axe`.
- `src/tests/setup.ts` now `expect.extend(toHaveNoViolations)`, so every Vitest test has the matcher.

**Task 2 — useFocusTrap** (RED `a291f03` → GREEN `af9c5f1`)
- `src/hooks/useFocusTrap.ts` — APG focusable selector recomputed on each Tab keydown (Pitfall 2), initial focus / Tab+Shift+Tab wrap / Escape-to-close / focus-restore. `isConnected` guard on restore so a deleted trigger never throws (Pitfall 4).

**Task 3 — Modal** (RED `7053df5` → GREEN `ad7ac5d`)
- `src/ui/Modal.tsx` — `createPortal` to `document.body`, `--bg-3` reduced-opacity scrim, `role="dialog"` + `aria-modal="true"` + accessible name, `useFocusTrap` wired, open transition gated on `prefers-reduced-motion`.

## Final API (for Plans 02/03)

```ts
// src/hooks/useFocusTrap.ts
useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  options: { onClose: () => void; initialFocusRef?: RefObject<HTMLElement | null> },
): void
```
- Attach `panelRef` to the panel element. Effect only runs while the panel is mounted (early-returns when `panelRef.current` is null), so calling the hook unconditionally with a closed modal is safe.

```tsx
// src/ui/Modal.tsx
<Modal
  open={boolean}
  onClose={() => void}
  ariaLabelledBy?={string}   // preferred — id of the panel heading
  ariaLabel?={string}        // fallback when no heading exists
  initialFocusRef?={RefObject<HTMLElement | null>}
>
  {children}
</Modal>
```
- Provide exactly one of `ariaLabelledBy` / `ariaLabel`. `ariaLabelledBy` wins if both are passed.
- Renders `null` when `open=false`. Scrim click and Escape both call `onClose`.
- Callers own their buttons; give interactive children `tpc-btn` / `tpc-card-interactive` to inherit the A11Y-02 focus ring (no generic `*:focus-visible` exists).
- Plan 02 migrations: wrap each dialog body in `<Modal>` and drop the hand-rolled outer `fixed inset-0` div (Modal supplies it). MigrationSplash keeps its opaque splash look — fold the trap in rather than swapping to the centered scrim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom-incompatible visibility filter in useFocusTrap**
- **Found during:** Task 2 GREEN (3 tests failed: initial focus + both Tab-wraps)
- **Issue:** Initial draft filtered focusables with `el.offsetParent !== null`. Under jsdom `offsetParent` is always `null` (no layout), so every button was filtered out — `getFocusable` returned empty, breaking initial focus and Tab-wrap.
- **Fix:** Replaced with `isVisible()` using `getComputedStyle` (`display:none`/`visibility:hidden`) + `hidden`/`aria-hidden` checks — correct in both jsdom and real browsers.
- **Files modified:** src/hooks/useFocusTrap.ts
- **Commit:** af9c5f1

**2. [Rule 3 - Blocking] Plan verify commands used `npm test -- --run <path>`**
- **Issue:** The `test` npm script already includes `--run`; passing `--run` again makes Vitest throw "Expected a single value for option --run".
- **Fix:** Ran verifications as `npm test -- <path>` instead. No code impact.

## Deferred Issues (out of scope)

- `src/components/MigrationSplash.tsx:20` — pre-existing `TS6133: 'skipped' is declared but its value is never read` (introduced in phase 36, commit 9842dd1; unrelated to this plan's files). Logged, not fixed — out of scope per executor scope boundary.

## Verification

- `npm test -- src/tests/a11y/` → 12 tests green (7 trap + 5 modal incl. jest-axe scan).
- `npm test` full suite → **83 files passed, 4 skipped, 649 tests passed, 0 failures** (matcher wiring did not regress the existing suite).
- `package.json`: `jest-axe` + `@axe-core/playwright` under `devDependencies` only; no `@types/jest-axe`; no shipped runtime dep added.
- `npx tsc --noEmit -p tsconfig.app.json` → zero errors in new files.

## TDD Gate Compliance

Both behavior-adding tasks followed RED → GREEN:
- useFocusTrap: `test(37-01)` a291f03 (RED) → `feat(37-01)` af9c5f1 (GREEN).
- Modal: `test(37-01)` 7053df5 (RED) → `feat(37-01)` ad7ac5d (GREEN).

No REFACTOR commits — implementations were clean on first GREEN.

## Known Stubs

None.

## Self-Check: PASSED

All 4 created files exist; all 5 commits (41453f0, a291f03, af9c5f1, 7053df5, ad7ac5d) present in git log.
