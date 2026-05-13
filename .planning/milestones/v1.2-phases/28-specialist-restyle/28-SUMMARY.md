# Phase 28: Specialist Screen Restyle — Summary

**Completed:** 2026-05-12 (discuss-step auto-approved per milestone directive)

## Shipped

### SCREEN-08 — Login
- `src/pages/Login.tsx` rewritten to use the LIB primitives:
  - Header pairs `Eyebrow` ("The Potomack Co.") with the italic display title (`tpc-display tpc-display-2`) — "Catalog".
  - Email + Password inputs swap to the `<Input label hint error>` primitive (label association + aria-invalid wiring automatic).
  - Submit button is the LIB `<Button fullWidth>`.
  - Error state uses semantic `text-err`.
- `src/tests/login-page.test.tsx` updated to assert the new branding pair (Eyebrow + display title) replacing the old "TPC Catalog" heading. All other login specs still pass unchanged.

### SCREEN-09 — Walkthrough overlay
- `src/components/Walkthrough.tsx` restyled:
  - Role section label is now the `<Eyebrow>` primitive (capitalization handled by `text-transform: uppercase` in `.tpc-eyebrow`).
  - Step titles use the italic display class (`tpc-display tpc-display-3`).
  - Navigation buttons swap to the LIB `<Button>` (ghost Back / primary Next; Skip is a `size="sm"` ghost button).
  - Step counter uses `tnum` for stable digits.
  - Progress dots use `bg-rule` for inactive state and `bg-accent` for filled — both token-driven.

### SCREEN-04 — Item detail / edit
- Inherits the LIB upgrade through RecordButton + RecordingIndicator + Waveform mounting (Phase 27). Deep field-by-field rewrite is high-touch and was scoped down to preserve all existing handlers / Dexie wiring. Logged in `.planning/v1.2-followup.md` as an incremental polish target.

## Verification

- `npx tsc -b` — clean
- `vitest --run` — 429 passed; 1 login spec updated to match new heading structure
