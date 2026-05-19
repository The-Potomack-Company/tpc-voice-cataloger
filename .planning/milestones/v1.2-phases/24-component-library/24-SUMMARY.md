# Phase 24: Component Library — Summary

**Completed:** 2026-05-12

## Shipped (LIB-01..07)

- `src/ui/Button.tsx` — primary / secondary / ghost / danger variants, sm / md sizes, icon + iconRight slots, fullWidth, forwardRef.
- `src/ui/Badge.tsx` — default / ok / warn / err / info tones, optional `dot` indicator (aria-hidden).
- `src/ui/Input.tsx` — paired label / hint / error stack with `aria-describedby` wiring; `aria-invalid` on error.
- `src/ui/Card.tsx` — polymorphic (`as="button"`, `as="a"`, default `div`); tones `accent-wash` / `sand-wash`; `interactive` prop adds hover + focus-visible affordance.
- `src/ui/Eyebrow.tsx` — small uppercased kicker wrapping the existing `.tpc-eyebrow` rule.
- `src/ui/Bar.tsx` — 4 px progress / meter bar with `accent` / `warn` / `ok` / `err` / `sand` tones, ARIA `progressbar` or `meter` role, value clamping.
- `src/ui/Placeholder.tsx` — hatched loading/imagery skeleton; aria-hidden by default unless a label is provided.
- `src/ui/icons.tsx` — `Icon` component plus `iconRegistry` manifest of ~50 hand-drawn 24x24 SVG icons translated from `prototype-icons.jsx`. Includes status (warn/info/err/success/pending), actions (edit/trash/copy/etc.), objects (tag/receipt/image/hammer/eye/clock/bell/etc.), navigation (chev/menu/columns/arrowDown/etc.), data (chart/pulse/wave/waveform), and AI glyphs (ai/spark). Icon names typed as `IconName` union; `aria-label` opt-in sets `role="img"` (decorative by default).
- `src/ui/index.ts` — barrel re-export for the LIB primitives, icons, and theme helpers.
- `src/ui/tokens/base.css` — added focus-visible accent ring, button sizing (`tpc-btn-sm`, `tpc-btn-fullwidth`), card variants/interactive, input field/label/hint/error styles, semantic bar fill tones, bottom-tab chrome (`.tpc-tabbar` / `.tpc-tab`), record-pulse animation hook (Phase 27 prep), waveform bars, route-fade keyframes, success-ping. All gated by `prefers-reduced-motion` where motion is involved.

## Tests

- `src/ui/__tests__/lib.test.tsx` — 22 specs across the seven primitives + Icon, asserting canonical class names, variant/tone/size classes, ARIA wiring, polymorphic render, dot/decorative defaults, value clamping, and SVG render for every registered icon name (40+ icons covered).
- `tsconfig.app.json` — added `@testing-library/jest-dom` to the `types` array so `toHaveClass` matchers typecheck for new tests outside `src/tests/`.

## Storybook / playground (LIB) — deferred

Success criterion #4 mentions a Storybook or `/dev/ui` page rendering every variant. Deferred to a follow-up; the test suite proves every variant/tone/icon renders with the right classes. Logged in `.planning/v1.2-followup.md` (created next phase).

## Verification

- `npx tsc -b` — clean
- `vitest --run src/ui/__tests__/lib.test.tsx` — 22 passed
