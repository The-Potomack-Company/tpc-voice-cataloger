# Phase 22: Foundation Tokens - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Tailwind 4 `@theme` color/font/radius variables with the unified TPC token set so every styling decision flows from one source. Establish the canonical token CSS/TS at `src/ui/tokens/`, wire `.tpc` / `.tpc-dark` onto `<html>`, set up a system-preference dark-mode bootstrap (without the Phase 25 toggle UI), keep the existing 296 `dark:` Tailwind utilities working via a class-based `@custom-variant`, expose the full token set as Tailwind utilities through an `@theme` bridge, and ship a Vitest guard for TOKENS-04. Existing screens must continue rendering — visually unrefined is acceptable, broken styling is not.

Out of this phase: per-screen restyles (Phase 26+), font self-hosting (Phase 23), Theme toggle UI + per-user persistence (Phase 25), LIB primitives that consume `tpc-unified-base.css` (Phase 24).

</domain>

<decisions>
## Implementation Decisions

### Token file installation
- **D-01:** Copy `docs/design-handoff/tpc-unified-tokens.css` verbatim into `src/ui/tokens/tokens.css`. The handoff dir stays as the design source-of-record but is **not** in Vite's build graph.
- **D-02:** Copy `docs/design-handoff/tpc-unified-base.css` into `src/ui/tokens/base.css` in the same phase. Phase 24 (LIB primitives) wraps the `.tpc-btn` / `.tpc-badge` / `.tpc-input` / `.tpc-card` / `.tpc-eyebrow` / `bar-track` classes in React components — no need to defer the CSS.
- **D-03:** Copy `docs/design-handoff/tpc-unified-tokens.ts` into `src/ui/tokens/tokens.ts`. Add `src/ui/tokens/index.ts` as a barrel re-export so consumers write `import { tpcUnifiedLight, paletteFor, fonts, radii } from "@/ui/tokens"` (or relative). Add a comment header at the top of `tokens.ts` and `tokens.css` noting they are mirrors of each other and must be kept in sync manually.
- **D-04:** `.tpc` is applied to `<html>` (not `<body>` or an in-React shell). This covers portals (`Walkthrough.tsx` and `ConfirmDialog.tsx` use `createPortal` to `document.body`), pre-React-mount paint, and any future PWA install prompt. `.tpc` lives on the `<html>` element from the moment the page is parsed.

### Dark-mode bootstrap (system-pref only this phase — Phase 25 owns the toggle)
- **D-05:** Inline blocking `<script>` in `index.html` `<head>` adds `tpc-dark` to `<html>` synchronously when `window.matchMedia('(prefers-color-scheme: dark)').matches` — runs before the React bundle parses, eliminating FOUC. Keep the script ≤5 lines with a comment justifying the inline placement (so the lint allowlist entry has a clear rationale).
- **D-06:** `src/ui/tokens/initTheme.ts` exports an `initTheme(opts?)` helper called from `src/main.tsx` that attaches a `matchMedia('change')` listener — when the OS flips dark/light during a session, the class flips live without reload.
- **D-07:** The split between the two pieces is deliberate: the inline script does the **synchronous pre-paint** pass (mandatory for no-FOUC); `initTheme.ts` handles **runtime live updates** and exposes a teardown function so Phase 25's `ThemeProvider` can take over cleanly when the user picks a non-System mode.
- **D-08:** `initTheme(opts?)` signature is intentionally extensible: Phase 25 will pass `{ override?: 'light' | 'dark' | 'system' }` from a localStorage/Supabase-backed user preference. Phase 22 stays strictly system-pref-only — does **not** read localStorage, does **not** read from Supabase, does **not** ship a settings UI. TOKENS-03 / A11Y-03 are explicitly Phase 25's deliverables.

### Existing `dark:` Tailwind utilities (296 occurrences across 29 files)
- **D-09:** Rewire `dark:` to track `.tpc-dark` via `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` in `src/index.css` immediately after the Tailwind import. All 296 existing `dark:bg-gray-900` / `dark:text-gray-400` / `dark:bg-amber-900/30` etc. utilities continue rendering after the swap with **zero file edits to components or pages**.
- **D-10:** Tailwind's stock palette (`gray-*`, `blue-*`, `amber-*`, `yellow-*`, `green-*`, `orange-*`) stays intact — bridging it into token vars would require approximations (Tailwind has 11 grays, tokens have 4 inks + 4 bgs) that cause visual surprises and would have to be torn out anyway during Phase 26-29 screen restyles. Phase 22 success criterion #4 explicitly accepts "visually unrefined" as long as styling is not broken.
- **D-11:** Inline `style={{...}}` props in components are not touched in this phase. The codebase grep already confirmed zero hex / oklch / font-family literals in `src/`; existing inline styles use `transform`, `opacity`, `width` only. If the TOKENS-04 guard catches a violator anyway, fix that one file — don't open a sweeping audit.

### `@theme` bridge — Tailwind utilities resolve to tokens
- **D-12:** Replace the existing `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` block in `src/index.css` with a full bridge that exposes the entire token set as Tailwind utilities. Names map 1:1 from token vars: `--color-bg`, `--color-bg-2`, `--color-bg-3`, `--color-rule`, `--color-rule-2`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-ink-4`, `--color-accent`, `--color-accent-hover`, `--color-accent-wash`, `--color-accent-ink`, `--color-sand`, `--color-sand-wash`, `--color-ok`, `--color-ok-wash`, `--color-warn`, `--color-warn-wash`, `--color-err`, `--color-err-wash`, plus `--radius-sm` / `--radius` / `--radius-lg` and `--font-display` / `--font-ui` / `--font-mono`. Each is `var(--bg)` etc. so the values are sourced from `.tpc` / `.tpc-dark`.
- **D-13:** Phase 24 LIB primitives and Phase 26+ screen restyles consume these utilities directly: `bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `text-accent`, `rounded-md`, `font-display`, etc. — no need for `bg-[var(--bg-2)]` arbitrary-value syntax.
- **D-14:** `index.html` `<meta name="theme-color">` (currently `#2563eb`) is updated to a paired form: a default static hex closest to the light `--accent` value, plus a `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="...">` for the dark equivalent. The two static hex values are computed once, allowlisted in the lint, and documented in a comment.

### TOKENS-04 build-time guard
- **D-15:** Vitest regex test at `src/ui/__tests__/no-hardcoded-literals.test.ts`. The test enumerates all `.ts` / `.tsx` / `.css` files under `src/`, reads each, and asserts no matches against three patterns:
  - Hex color: `/#[0-9a-fA-F]{3,8}\b/`
  - OKLCH function: `/\boklch\s*\(/`
  - Font-family literal: `/font-family\s*[:=]\s*["']?[A-Za-z]/` (with the matching CSS property and the JSX/TS object-form `fontFamily:` covered)
- **D-16:** Allowlist (narrow): `src/ui/tokens/**` (the canonical token files), the `index.html` inline bootstrap script (which has no design literals anyway). Tests in `src/**/*.test.{ts,tsx}` are **not** allowlisted by default — if a violation surfaces during implementation, add a narrow per-file exception with a comment explaining why. `docs/design-handoff/` lives outside `src/` so isn't scanned.
- **D-17:** Failure UX: a single test that calls `expect(violations).toEqual([])` and on failure prints a structured list `{ file, line, snippet, pattern_matched }` for every offender at once. CI logs are scannable; a developer touching multiple files sees every violation in one run.
- **D-18:** Failure mode is **hard-fail in CI** — no soft-warn / known-violations snapshot. Phase 22 isn't done until the test passes clean. The test runs as part of the existing `npm test` step in GitHub Actions (per PROJECT.md "CI pipeline: lint, typecheck, test, build via GitHub Actions").
- **D-19:** Tailwind utility classes like `text-blue-700` are **not literals** — those resolve via Tailwind's palette and aren't covered by this guard. They're addressed by per-screen restyle in Phase 26-29.

### Claude's Discretion
- Import order in `src/index.css`: `@import "tailwindcss"`, then `@import "./ui/tokens/tokens.css"`, then `@import "./ui/tokens/base.css"`, then `@custom-variant dark (...)`, then the `@theme {}` bridge block. This order ensures Tailwind's utilities can resolve the bridged var names and `@custom-variant` runs before any utility classes use `dark:`.
- The two static hex values for the paired `theme-color` meta are picked by Claude using a closest-OKLCH-to-sRGB conversion of `--accent` (light) and `--accent` (dark). Documented in a comment in `index.html`.
- Whether to add a sync-check test (assert `tokens.css` and `tokens.ts` carry matching values) is left to the planner — if cheap, include it; if not, defer and note as a follow-up.
- `@theme` bridge utility naming follows the existing `--color-bg` / `--color-bg-2` Tailwind v4 convention (no rename to `--color-surface-1` etc.) — keep it boring.
- Whether the inline `<script>` in `index.html` is allowlisted by file-path or via a `// design-handoff: bootstrap` comment header is left to the planner.

</decisions>

<specifics>
## Specific Ideas

- "Single source of truth" — every styling value flows from `src/ui/tokens/` and the design-handoff dir is the design's source-of-record. Components and screens never carry hex / oklch / font-family literals.
- "No FOUC" — dark-mode users never see a light flash on cold load. The inline bootstrap script in `index.html` is the price of that guarantee.
- "Phase 26+ migrates per-screen" — Phase 22 deliberately keeps Tailwind's stock palette working as a transitional baseline. The point is not to ship a finished v1.2 visual language in Phase 22 — it's to make every later phase able to consume tokens cleanly.
- The future dashboard repo will consume `src/ui/` primitives — so `src/ui/tokens/index.ts` (barrel export) is designed as a stable public API now, not a private file.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/REQUIREMENTS.md` §"TOKENS — Design Tokens & Theme" — TOKENS-01, TOKENS-02, TOKENS-04 (the requirements this phase delivers)
- `.planning/ROADMAP.md` §"Phase 22: Foundation Tokens" — phase boundary, success criteria, dependencies (none)
- `.planning/PROJECT.md` §"Current Milestone: v1.2 UI Overhaul" + §"Key Decisions" — milestone constraints, locked decisions on token system, self-hosted fonts, mockup density

### Design source of truth (verbatim copy targets)
- `docs/design-handoff/tpc-unified-tokens.css` — canonical CSS custom properties for `.tpc` (light) and `.tpc.tpc-dark` (dark); thesis comment, surface/rule/ink/accent/sand/semantic palettes, type stacks, radii, base apply rules
- `docs/design-handoff/tpc-unified-tokens.ts` — JS-side mirror exporting `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor(mode)`
- `docs/design-handoff/tpc-unified-base.css` — `.tpc-btn` / `.tpc-btn-{primary,secondary,ghost,danger}`, `.tpc-badge` / `.tpc-badge-{ok,warn,err,info}`, `.tpc-dot`, `.tpc-input`, `.tpc-card`, `.tpc-eyebrow`, `.tpc-display`, `.tnum`, `.tpc-kbd`, `.tpc-placeholder`, `.bar-track` / `.bar-fill`

### Tailwind v4 reference
- Tailwind v4 docs on `@theme` and `@custom-variant` — for the bridge block syntax and for `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))`

### Existing project files this phase modifies (not docs, but mandatory reads for the planner)
- `src/index.css` — current `@theme` block to be replaced
- `src/main.tsx` — entry point; `initTheme()` call lands here
- `index.html` — receives `tpc` class on `<html>`, inline bootstrap script, paired `theme-color` meta

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing `@theme` block in `src/index.css`** (`--color-accent: #2563eb`, `--color-accent-hover: #1d4ed8`) — replaced by the full token bridge. The slideUp `@keyframes` already in this file stays untouched.
- **No `src/ui/` directory yet** — this phase establishes it via `src/ui/tokens/`. Phase 24 will add `src/ui/{Button,Badge,Input,Card,Eyebrow,Bar}.tsx` siblings.
- **No existing dark-mode toggle** — `dark:` prefixed utilities currently key off `prefers-color-scheme` media query; rewiring via `@custom-variant` flips them onto the class without touching components.

### Established Patterns
- **Tailwind 4 + `@theme` directive** (no `tailwind.config.js`) — already locked in PROJECT.md Key Decisions table. The bridge stays inside this pattern.
- **GitHub Actions CI runs `lint, typecheck, test, build`** (per PROJECT.md) — TOKENS-04's Vitest test plugs into the existing test step; no new CI workflow needed.
- **`createPortal` to `document.body`** — used by `Walkthrough.tsx` and `ConfirmDialog.tsx`; `.tpc` on `<html>` (not on a React-shell div) ensures portaled content inherits the token cascade.

### Integration Points
- `src/main.tsx` imports and calls `initTheme()` from `src/ui/tokens` near the top, before `ReactDOM.createRoot()`.
- `src/index.css` imports the new `tokens.css` and `base.css` from `./ui/tokens/`, declares the `@custom-variant dark`, then runs the `@theme` bridge.
- `index.html` gets `<html class="tpc">`, the inline pre-paint `<script>`, and the paired `theme-color` meta entries.
- 29 component/page files using `dark:` Tailwind utilities are **read-only** to this phase — they break only if the rewire is wrong.
- The Vitest test at `src/ui/__tests__/no-hardcoded-literals.test.ts` walks `src/` recursively at test time; CI must run it.

</code_context>

<deferred>
## Deferred Ideas

- **Replacing Tailwind stock palette with token-bridged equivalents** — discussed and explicitly rejected for this phase. Per-screen restyle in Phases 26-29 is where stock `gray-*` / `blue-*` / `amber-*` etc. utilities get swapped for `bg-bg-2` / `text-accent` / `bg-warn-wash` etc.
- **Auditing inline `style={{...}}` color/font usages** — confirmed zero violations in current scout; only revisit if TOKENS-04 surfaces a hit.
- **Cross-tab theme sync via `storage` event listener** — Phase 25 concern.
- **`tokens.css` ↔ `tokens.ts` automated sync check** — left as Claude's discretion in the planner; cheap if Vitest can read both files and compare values, otherwise defer.
- **Stylelint or other CSS-only linters** — not adopted; Vitest regex test covers `.css` files in `src/`.
- **rgb()/rgba()/hsl() and named-color (`white`, `black`) detection** — narrow first-pass scope by sticking to TOKENS-04's three patterns; revisit only if violations slip through.

</deferred>

---

*Phase: 22-foundation-tokens*
*Context gathered: 2026-04-29*
