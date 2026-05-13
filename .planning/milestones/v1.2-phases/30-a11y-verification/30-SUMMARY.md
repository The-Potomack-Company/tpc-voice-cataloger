# Phase 30: A11Y Verification — Summary

**Completed:** 2026-05-12

## Shipped (A11Y-01, A11Y-02)

### A11Y-01 — WCAG AA contrast guard
- `src/ui/__tests__/contrast.test.ts` (3 specs) — parses `src/ui/tokens/tokens.css`, builds the light + dark palettes, computes WCAG 2.1 contrast ratios for every `--ink*` × `--bg*` pair in both themes, and asserts AA thresholds:
  - 4.5:1 for body text (`--ink`, `--ink-2`)
  - 3.0:1 for large text + UI components (`--ink-3`, `--ink-4`)
- Color math pipeline is pure JS: OKLCH → OKLab → linear sRGB → sRGB → WCAG luminance. No jsdom required.
- Findings logged in `.planning/v1.2-known-issues.md`. Body inks (`--ink`, `--ink-2`) clear AA on every surface in both themes. The lightest decorative ink (`--ink-4`, used for rules / placeholder chrome / disabled icons — NOT body text) falls 0.1–0.7 short of the 3.0:1 UI/large threshold against 2–3 surface tokens; tokens are user-locked for v1.2 so this is logged as an iterative follow-up rather than fixed.
- Test posture: warn-and-document for the existing waivers (so the test acts as a regression guard against NEW failures) — any new pair that drops below AA will appear in the test output and the v1.2-known-issues.md docs need updating.

### A11Y-02 — Focus rings
- Universal `:focus-visible` accent ring declared on `.tpc-btn`, `.tpc-card-interactive`, and `.tpc-badge[role="button"]` in `src/ui/tokens/base.css` (Phase 24).
- The `.tpc-input` rule already shipped a `:focus` box-shadow accent-wash glow in Phase 22.
- Tab bar items also get `outline: 2px solid var(--accent)` on `:focus-visible` per the `.tpc-tab` rule.
- All four LIB primitive types covered: Button, Input, Badge-as-button (via `role="button"`), Card-as-link (via `tpc-card-interactive`).

### TOKENS-04 guard housekeeping
- `no-hardcoded-literals.test.ts` ALLOW_FILES grows by one entry: the Phase 30 contrast test parses tokens.css and inevitably references `oklch(...)` in comments + regexes. Same "the file IS the fixture" exception as the guard test itself; single-file scope.

## Verification

- `npx tsc -b` — clean
- `vitest --run` — 432 passed (3 new contrast specs added on top of 429)
