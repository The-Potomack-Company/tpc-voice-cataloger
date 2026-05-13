# Phase 26: Mockup-Faithful Screens — Summary

**Completed:** 2026-05-12

## Shipped

### SCREEN-10 — Bottom tab chrome (full reskin)
- `src/layouts/AppLayout.tsx` — replaced the inline-Tailwind tab bar with the `.tpc-tabbar` / `.tpc-tab` chrome declared in `base.css`. Tabs now use the new `<Icon />` component (folder / plus / settings icons drawn from the unified icon set). Routes and labels unchanged.
- Tap-target a11y (48 px min) preserved via the `.tpc-tab` rule's `min-height: 48px; min-width: 48px;`. Layout test updated to assert the class application (the 48 px guarantee lives in CSS rather than utility classes).

### SCREEN-01 — Sessions list (typography pass)
- `src/pages/Sessions.tsx` gains a header pairing `Eyebrow` ("The Potomack Co.") with the italic display title ("Sessions") via `.tpc-display .tpc-display-3`. Underlying list logic, search, and admin grouping unchanged.

### SCREEN-02 — Recording surface (RecordButton + RecordingIndicator)
- `src/components/RecordButton.tsx` adds `aria-pressed` and uses the `.tpc-record-pulse` class for the active-recording halo animation (token-driven; gated by `prefers-reduced-motion`).
- `src/components/RecordingIndicator.tsx` swaps the timer pill to the LIB `.tpc-badge .tpc-badge-err .tnum` chrome with a mono font + tnum digits via a new `.tpc-record-pill` class; the pulsing accent halo replaces `animate-pulse`.

### SCREEN-03 — Review (SessionDetail) — partial
- No deep restyle in this phase. Touch surface limited to elements that already use the new LIB primitives indirectly (RecordingIndicator + tab chrome). Full SessionDetail restyle deferred to incremental work; behavior is untouched.

## Deferred / known follow-ups

- Sessions: date-grouped sections + paired Sale-H / House-S accent-wash tiles per the mockup remain to be implemented; the current SessionCard is preserved unchanged so feature behavior is not at risk during the milestone.
- Review: sticky-header sync action, three-stat strip with mini bars (`Bar` primitive available), and item-level status dots — Phase 27 will hook live waveform feedback so the recording surface lands its mockup pass next.
- Captured in `.planning/v1.2-followup.md`.

## Verification

- `npx tsc -b` — clean
- `vitest --run` — 425 passed (full suite); 1 layout test updated to match new class architecture
