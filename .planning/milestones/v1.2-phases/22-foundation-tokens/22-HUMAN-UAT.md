---
status: partial
phase: 22-foundation-tokens
source: [22-VERIFICATION.md]
started: 2026-04-30T11:55:00Z
updated: 2026-04-30T11:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Walk all 5 routes in light mode AND dark mode
expected: No broken styling: no white-on-white, no black-on-black, no Times-New-Roman fallback fonts, no missing borders. All 282 existing dark: utilities render correctly off the new .tpc-dark class. Routes: Sessions / Recording / Review / Settings / AccountManagement.
result: [pending]

### 2. Cold-load FOUC check with system in dark mode
expected: `npm run build && npm run preview`; on a system in dark mode, hard reload. No light flash before first paint.
result: [pending]

### 3. Live OS theme flip during open session
expected: Open `npm run dev`. Toggle OS dark mode while the page is open; `<html>` class flips between `tpc` and `tpc tpc-dark` within one frame and all surfaces re-theme without a reload.
result: [pending]

### 4. Bridge utility computed styles resolve from .tpc cascade
expected: DevTools inspect on any element using `bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `rounded-md`, `font-display` — computed style resolves to `oklch(...)` value from the active `.tpc` / `.tpc-dark` cascade.
result: [pending]

### 5. Paired `<meta name="theme-color">` renders in browser chrome
expected: Browser chrome on iOS Safari / Chrome Android shows `#0089b4` in light mode and `#22b5e1` in dark mode.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
