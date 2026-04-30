# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Accounts & Deploy** -- Phases 11-21 (shipped 2026-03-31) -- See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- [ ] v1.2 UI Overhaul -- Phases 22-30 (in flight, started 2026-04-28)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-9 + 5.1) -- SHIPPED 2026-03-17</summary>

- [x] Phase 1: Foundation (2/2 plans) -- completed 2026-03-06
- [x] Phase 2: Audio Capture (2/2 plans) -- completed 2026-03-06
- [x] Phase 3: Session Management (3/3 plans) -- completed 2026-03-06
- [x] Phase 4: Cataloging Modes (2/2 plans) -- completed 2026-03-06
- [x] Phase 5: AI Pipeline (5/5 plans) -- completed 2026-03-16
- [x] Phase 5.1: Measurements Field (2/2 plans) -- completed 2026-03-16 *(inserted)*
- [x] Phase 6: Review, Edit, Export (3/3 plans) -- completed 2026-03-16
- [x] Phase 7: Extension Batch Import (3/3 plans) -- completed 2026-03-09
- [x] Phase 8: Offline Queue (2/2 plans) -- completed 2026-03-16
- [x] Phase 9: Deferred Items (3/3 plans) -- completed 2026-03-17

</details>

<details>
<summary>v1.1 Accounts & Deploy (Phases 11-21) -- SHIPPED 2026-03-31</summary>

- [x] Phase 11: Supabase Foundation (2/2 plans) -- completed 2026-03-18
- [x] Phase 12: Authentication (3/3 plans) -- completed 2026-03-18
- [x] Phase 13: Account Management (2/2 plans) -- completed 2026-03-18
- [x] Phase 14: Data Migration (5/5 plans) -- completed 2026-03-20
- [x] Phase 15: Session Assignment (3/3 plans) -- completed 2026-03-20
- [x] Phase 16: Session Lifecycle (4/4 plans) -- completed 2026-03-20
- [x] Phase 17: Deployment & CI (4/4 plans) -- completed 2026-03-30
- [x] Phase 18: Walkthrough (3/3 plans) -- completed 2026-03-20
- [x] Phase 19: Photo Upload (5/5 plans) -- completed 2026-03-22
- [x] Phase 20: House Session Import Fix (2/2 plans) -- completed 2026-03-28
- [x] Phase 21: AI Granularity (3/3 plans) -- completed 2026-03-31

</details>

<details>
<summary>v1.2 UI Overhaul (Phases 22-30) -- IN FLIGHT</summary>

- [ ] Phase 22: Foundation Tokens (0/4 plans) -- 4 plans
- [ ] Phase 23: Typography Pipeline (0/2 plans) -- target ~2 plans
- [ ] Phase 24: Component Library (0/4 plans) -- target ~4 plans
- [ ] Phase 25: Theme Toggle & Settings (0/2 plans) -- target ~2 plans
- [ ] Phase 26: Mockup-Faithful Screens (0/4 plans) -- target ~4 plans
- [ ] Phase 27: Motion & Live Feedback (0/3 plans) -- target ~3 plans
- [ ] Phase 28: Specialist Screen Restyle (0/3 plans) -- target ~3 plans
- [ ] Phase 29: Admin Screen Restyle (0/3 plans) -- target ~3 plans
- [ ] Phase 30: A11Y Verification (0/2 plans) -- target ~2 plans

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-9 + 5.1 | v1.0 | 27/27 | Complete | 2026-03-17 |
| 11-21 | v1.1 | 36/36 | Complete | 2026-03-31 |
| 22-30 | v1.2 | 0/27 | In flight | -- |

## v1.2 Phase Detail

### Phase 22: Foundation Tokens
**Goal**: Replace Tailwind 4 `@theme` color/font/radius variables with the unified TPC token set so every styling decision flows from one source.
**Depends on**: None
**Requirements**: TOKENS-01, TOKENS-02, TOKENS-04
**Success Criteria** (what must be TRUE):
  1. `src/index.css` (or equivalent) exposes the full unified token set from `tpc-unified-tokens.css`; no hardcoded oklch / hex / font-family literals remain in `src/` outside `src/ui/tokens/`.
  2. Wrapping the app shell in `tpc tpc-dark` (or matching the OS `prefers-color-scheme: dark`) flips every surface and ink value without any extra component-level work.
  3. CI fails the build when a TS/TSX/CSS file outside `docs/design-handoff/` introduces a hex code, `oklch(...)` literal, or named font-family string.
  4. The existing screens still render (visually unrefined is acceptable -- correctness gate is "no broken styling"), proving the token swap is non-destructive.
**Plans**:

**Wave 1** *(token files installed; precondition for everything else)*
- [ ] 22-01-token-scaffold-PLAN.md -- Install canonical token CSS/TS at src/ui/tokens/ + clear pwa-manifest hex literal

**Wave 2** *(blocked on Wave 1 completion; Plans 02 and 03 run in parallel — disjoint files)*
- [ ] 22-02-bridge-dark-variant-PLAN.md -- Wire token imports + @custom-variant dark + @theme inline bridge in src/index.css; .tpc class + pre-paint script + paired theme-color in index.html
- [ ] 22-03-init-theme-runtime-PLAN.md -- src/ui/tokens/initTheme.ts runtime listener + main.tsx wiring + jsdom unit test

**Wave 3** *(blocked on Waves 1 + 2 — guard runs only after pre-existing #2563eb literal cleared and legacy @theme block removed)*
- [ ] 22-04-tokens-04-guard-PLAN.md -- TOKENS-04 Vitest filesystem regex sweep with three patterns + narrow allowlist

**Cross-cutting constraints** *(must_haves shared across 2+ plans):*
- `.tpc-dark` class on `<html>` is the single dark-mode signal — pre-paint inline script (Plan 02) and runtime `initTheme` (Plan 03) both manipulate it idempotently
- Phase 22 stays system-pref-only — no localStorage, no Supabase, no toggle UI (Plans 02, 03)
- `@theme inline` (NOT `@theme`) for the bridge so `.tpc-dark`-scoped overrides reach utilities (Plan 02; honored by Plan 04's allowlist for `src/ui/tokens/**`)

**Estimated plan count**: 4
**UI hint**: yes

### Phase 23: Typography Pipeline
**Goal**: Self-host EB Garamond / Inter / IBM Plex Mono via `@fontsource` and expose them as the display, UI, and metadata stacks.
**Depends on**: Phase 22
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04
**Success Criteria** (what must be TRUE):
  1. Production network panel shows zero requests to `fonts.googleapis.com` or `fonts.gstatic.com`; all font files are served from the app origin.
  2. EB Garamond 400 / 400 italic / 500 italic, Inter 400 / 500 / 600, and IBM Plex Mono 400 / 500 are all observable on screens that consume them (visible italic display title, mono receipt numbers, etc.).
  3. A `tnum` utility class enables tabular-numeric figures wherever the mockups call for monospaced numbers (timers, counts, item numbers).
  4. Bundle size delta is documented in the phase transition notes (font subset / preload strategy chosen).
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

### Phase 24: Component Library
**Goal**: Ship reusable design-system primitives in `src/ui/` and migrate all screens off ad-hoc inline styles for these element types.
**Depends on**: Phase 22, Phase 23
**Requirements**: LIB-01, LIB-02, LIB-03, LIB-04, LIB-05, LIB-06, LIB-07
**Success Criteria** (what must be TRUE):
  1. `src/ui/` exports `Button`, `Badge`, `Input`, `Card`, `Eyebrow`, `Bar`, and `Placeholder` primitives that match the rules in `tpc-unified-base.css`.
  2. `Button` exposes primary / secondary / ghost / danger variants and sm / md sizes; `Badge` exposes default / ok / warn / err / info tones with optional dot indicator; `Bar` exposes accent / warn / ok / err semantic slots at the 4 px height.
  3. A repo-wide grep finds zero remaining inline `<button>`, `<input>`, hand-rolled badge `<span>`, or hatched-placeholder ad-hoc styles in app screens -- only LIB primitives remain.
  4. Storybook (or an equivalent visual playground page mounted at `/dev/ui`) renders every variant for review.
**Plans**: TBD
**Estimated plan count**: 4
**UI hint**: yes

### Phase 25: Theme Toggle & Settings
**Goal**: Let users explicitly choose Light / Dark / System theme from Settings, persist the choice per-user, and surface the option in the walkthrough.
**Depends on**: Phase 22, Phase 24
**Requirements**: TOKENS-03, A11Y-03
**Success Criteria** (what must be TRUE):
  1. Settings screen shows a Light / Dark / System segmented control built from LIB primitives; selecting a value flips the app shell instantly.
  2. The chosen theme persists across browser reload for signed-in users (Supabase user record) and pre-auth users (`localStorage` fallback).
  3. The role-aware walkthrough includes a step pointing out the new theme toggle, and that step's seen-state persists per-user using the same model as existing walkthrough steps.
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

### Phase 26: Mockup-Faithful Screens
**Goal**: Restyle the three mocked screens (Sessions, Recording, Review) and the bottom-tab chrome to match `tpc-voice.jsx` exactly, using only LIB primitives.
**Depends on**: Phase 24
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-10
**Success Criteria** (what must be TRUE):
  1. Sessions list renders date-grouped sections with paired Sale (S) / House (H) tiles in `accent-wash` / `sand-wash`, mono session IDs, status badges, active-recording dot, and search-with-filter chip indistinguishable from the mockup at the same viewport.
  2. Recording screen renders eyebrow + italic display title, current-item card with live transcript caret, full-width waveform area (waveform behavior arrives in Phase 27), tnum elapsed timer, and the hero red stop button with accent-halo shadow flanked by side controls.
  3. Review screen renders sticky header with sync action, three-stat progress strip with mini bars, and an item list with status dots (`ok` / `warn` / `err`), mono item numbers, two-line excerpt clamp, tnum durations, status pills, and ghost play button.
  4. Bottom-tab navigation renders with the new icon set, accent active-state color, and density -- tab structure and routes unchanged.
**Plans**: TBD
**Estimated plan count**: 4
**UI hint**: yes

### Phase 27: Motion & Live Feedback
**Goal**: Add live recording motion (pulse + real audio waveform) and consistent route transitions, all gated by `prefers-reduced-motion`.
**Depends on**: Phase 26
**Requirements**: MOTION-01, MOTION-02, MOTION-03, MOTION-04
**Success Criteria** (what must be TRUE):
  1. While a session is recording, the recording badge visibly pulses with an accent-halo expansion at a steady cadence.
  2. The Recording screen waveform reflects real microphone amplitude via Web Audio API -- recent bars in accent, older bars decay to ink-4 -- and updates in real time.
  3. Top-level route transitions complete in under 250 ms with a consistent cross-fade or slide.
  4. With `prefers-reduced-motion: reduce` set, the pulse stops, the waveform falls back to a static recording-active glyph, and route transitions become instant -- verified by an end-to-end test or manual checklist captured in the phase transition.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

### Phase 28: Specialist Screen Restyle
**Goal**: Extrapolate the design system onto the unmocked specialist-facing surfaces (item detail/edit, login, walkthrough overlay) with a discuss-step approval before implementation.
**Depends on**: Phase 24
**Requirements**: SCREEN-04, SCREEN-08, SCREEN-09
**Success Criteria** (what must be TRUE):
  1. Item detail / edit view renders transcript, editable structured fields (title, description, condition, estimate, category, measurements), photo grid (house mode), and re-record action -- all from LIB primitives with the new typographic hierarchy and no ad-hoc styling.
  2. Login screen uses the new tokens and italic display headline; routing, copy, and form behavior unchanged.
  3. Role-aware walkthrough overlay matches the new visual language (cards, eyebrows, accent buttons) while preserving step copy and step structure from v1.1.
  4. Each screen's proposed treatment is reviewed in a discuss step (recorded in the plan) before implementation begins.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

### Phase 29: Admin Screen Restyle
**Goal**: Extrapolate the design system onto the admin-facing surfaces (accounts, assignments, review queue) with discuss-step approval before implementation.
**Depends on**: Phase 24
**Requirements**: SCREEN-05, SCREEN-06, SCREEN-07
**Success Criteria** (what must be TRUE):
  1. Admin accounts screen renders the specialist list, create/deactivate actions, and role tags using LIB primitives -- no inline styles for these element types remain.
  2. Admin assignments view renders the receipt-list import flow, session creation, and specialist assignment using the new visual language.
  3. Admin review queue renders submitted sessions with edit / return-with-notes / export actions and status tracking, consuming the new badge tones for status.
  4. Each screen's proposed treatment is reviewed in a discuss step before implementation begins.
**Plans**: TBD
**Estimated plan count**: 3
**UI hint**: yes

### Phase 30: A11Y Verification
**Goal**: Verify WCAG AA contrast across both token sets and ensure every interactive primitive shows a visible focus ring.
**Depends on**: Phase 22, Phase 24, Phase 26, Phase 27, Phase 28, Phase 29
**Requirements**: A11Y-01, A11Y-02
**Success Criteria** (what must be TRUE):
  1. `src/ui/__tests__/contrast.test.ts` enumerates every ink-on-bg combination in the light and dark token sets and asserts WCAG AA thresholds (4.5:1 body, 3:1 large text); CI fails on regressions.
  2. Every interactive primitive (Button, Input, Badge-as-button, Card-as-link) renders the accent border + accent-wash glow focus ring on `:focus-visible` -- verified by a focus-ring smoke test or manual checklist captured in the phase transition.
  3. No screen ships with a contrast or focus-ring failure outstanding; any waiver is documented in the milestone close-out.
**Plans**: TBD
**Estimated plan count**: 2
**UI hint**: yes

## Backlog

### Phase 999.1: Stream photos from Supabase Storage during extension import (BACKLOG)

**Goal:** Replace base64-embedded photos in export JSON with Supabase Storage URLs fetched on demand during extension import. Current approach embeds all photos as base64, which balloons to 200-450MB for typical house visits (100-300 items x multiple photos). With Storage URLs, export JSON drops to ~500KB and photos stream one at a time during import. Requires: export emits storage paths/signed URLs instead of base64 blobs, importController fetches URL->blob->File before injection. Supabase Storage infra already exists from Phase 19.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
