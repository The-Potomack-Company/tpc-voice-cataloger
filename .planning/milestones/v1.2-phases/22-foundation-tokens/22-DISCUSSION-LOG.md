# Phase 22: Foundation Tokens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 22-foundation-tokens
**Areas discussed:** Token file installation, Dark-mode bootstrap, Existing dark: classes (296 usages), TOKENS-04 build-time guard form

---

## Token file installation

### Where should the canonical token CSS live in src/?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy into src/ui/tokens/ | Verbatim copy into src/ui/tokens/tokens.css; handoff dir is design source-of-record but not in build graph; matches Success Criterion #1's wording | ✓ |
| Import handoff dir directly | src/index.css does @import "../../docs/design-handoff/tpc-unified-tokens.css"; single source of truth (no copy drift) but Vite resolves outside src/, design-handoff dir joins build graph | |
| Symlink / re-export wrapper | src/ui/tokens/tokens.css contains @import of handoff file; keeps src/ self-contained but symlinks misbehave on Windows HMR | |

**User's choice:** Copy into src/ui/tokens/

### Should tpc-unified-base.css ship in this phase too?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — ship it now | Copy base.css into src/ui/tokens/base.css now; .tpc-btn / .tpc-badge / etc. classes available immediately for Phase 24 to wrap | ✓ |
| Defer to Phase 24 | Only ship tokens this phase; Phase 24 imports base.css when it builds LIB primitives; risks Phase 25 needing styled buttons before LIB exists | |
| Tokens now, base lazy-loaded later | File in tree but not imported until Phase 24 flips the switch; dead file in tree | |

**User's choice:** Yes — ship it now

### How should tpc-unified-tokens.ts (JS-side mirror) be exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy to src/ui/tokens/tokens.ts and re-export from src/ui/tokens/index.ts | Sets up the canonical import path; Phase 27 waveform, Phase 30 contrast tests, future dashboard repo all use `import { tpcUnifiedLight, paletteFor } from '@/ui/tokens'`; manual sync with comment header | ✓ |
| Skip the .ts mirror this phase | Only ship CSS; introduce TS mirror when first JS consumer needs it; risk those phases revisit decision | |
| Generate .ts from .css at build time | Tiny script reads tokens.css, emits tokens.ts — no drift possible but more moving parts; overkill for two rarely-changing files | |

**User's choice:** Copy to src/ui/tokens/tokens.ts and re-export from src/ui/tokens/index.ts

### Where on the DOM should the .tpc class be applied?

| Option | Description | Selected |
|--------|-------------|----------|
| <html> element (root) | Add 'tpc' to <html>; covers portals, react-router shell, PWA install prompt; @custom-variant dark targeting .tpc-dark works cleanly | ✓ |
| <body> element | Add 'tpc' to <body>; almost equivalent; slightly weaker for portals mounted above body | |
| App-shell <div> in src/App.tsx | Wrap React tree in <div className='tpc'>; doesn't cover body bg pre-mount; createPortal'd content (Walkthrough, ConfirmDialog) renders outside .tpc scope | |

**User's choice:** <html> element (root)

**Notes:** Walkthrough.tsx and ConfirmDialog.tsx use createPortal to document.body — confirmed during scout — making the <html> mount point the only correct choice for token cascade coverage.

---

## Dark-mode bootstrap

### How should .tpc-dark be applied at app load (before Phase 25 builds the toggle)?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline blocking <script> in index.html | 5-line script in <head> reads matchMedia and sets class before React parses; zero FOUC; needs lint allowlist; needs early-exit hook for Phase 25 localStorage check | ✓ |
| matchMedia listener in main.tsx (pre-render) | 4 lines at top of main.tsx before createRoot(); pure TS but brief unstyled flash on slow devices | |
| CSS-only @media (prefers-color-scheme: dark) duplication | Duplicate dark vars on .tpc:not(.tpc-dark); zero JS, zero flash but violates single-source-of-truth and complicates Phase 25's manual override | |

**User's choice:** Inline blocking <script> in index.html

### Should the bootstrap script also react to live OS preference changes during a session?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add a matchMedia change listener | OS dark/light flip changes class live without reload; Phase 25 disables listener when user picks a non-System mode | ✓ |
| No — read once at boot | Simpler; subsequent OS changes need refresh; Phase 25 toggle handles runtime switching anyway | |

**User's choice:** Yes — add a matchMedia change listener

### Where should the matchMedia 'change' listener be wired so Phase 25 can cleanly take over?

| Option | Description | Selected |
|--------|-------------|----------|
| src/ui/tokens/initTheme.ts — exported helper, called from main.tsx | Inline script does sync pre-paint; main.tsx imports initTheme() which attaches listener and returns teardown; Phase 25 calls teardown when user picks non-System mode; clean handoff API | ✓ |
| All in the inline <script> | Both initial set AND listener in inline script; one location but harder to remove from React when Phase 25 ships | |
| All in main.tsx after React hydration | Pure TS, no inline script to allowlist but reintroduces FOUC | |

**User's choice:** src/ui/tokens/initTheme.ts — exported helper, called from main.tsx

### What about Phase 25's per-user persistence — leave a hook or stay strictly system-pref-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly system-pref only this phase | Phase 22 reads matchMedia and never touches localStorage or Supabase; Phase 25 wraps initTheme() with override logic; clean phase boundary; initTheme(opts?) signature extensible | ✓ |
| Read localStorage too | initTheme() checks localStorage('tpc.theme') first, falls back to system pref; Phase 25 just writes localStorage; leaks Phase 25 scope into Phase 22 | |
| Read localStorage AND fetch Supabase preference | Full persistence wiring now; out of scope per ROADMAP.md | |

**User's choice:** Strictly system-pref only this phase

---

## Existing dark: classes (296 usages)

### How should the existing 296 `dark:` Tailwind utility usages keep working after the token swap?

| Option | Description | Selected |
|--------|-------------|----------|
| Rewire dark: → .tpc-dark class via @custom-variant | `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` in src/index.css; all 296 utilities key off the class with zero file edits; matches Success Criterion #4 | ✓ |
| Rewire AND start replacing this phase | @custom-variant rewire PLUS bulk-replace stock palette utilities with token utilities across 29 files; balloons phase scope, collides with Phase 26-29 ownership | |
| Drop dark: support, rely solely on .tpc-dark CSS-var cascading | Remove all dark: prefixed utilities; Tailwind stock grays not bridged so dark mode breaks | |

**User's choice:** Rewire dark: → .tpc-dark class via @custom-variant

### How should the gap between token utilities and existing Tailwind stock palette be handled this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave Tailwind stock colors intact, restyle per-screen in 26-29 | bg-gray-900 etc. continue rendering as Tailwind's stock OKLCH values until Phase 26+ migrates each screen; minimal churn this phase; success criterion #4 explicitly accepts "visually unrefined" | ✓ |
| Bridge Tailwind's gray-* / blue-* / amber-* into token vars | Override --color-gray-900 etc. in @theme; immediate visual match but forced approximations cause surprises and Phase 26-29 has to tear bridge out anyway | |
| Ship tokens, leave bridge/replacement entirely for screen phases | No @custom-variant rewire; conflicts with Phase 25's need for .tpc-dark before Phase 26 ships | |

**User's choice:** Leave Tailwind stock colors intact, restyle per-screen in 26-29

### Should the @theme bridge expose the full token set as Tailwind utilities (bg-bg, bg-bg-2, text-ink, text-accent, bg-warn-wash, etc.)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — expose the full token set as Tailwind utilities now | Bridge every token (--color-bg/2/3, --color-ink/2/3/4, --color-accent/-hover/-wash/-ink, --color-sand/-wash, --color-ok/-wash, --color-warn/-wash, --color-err/-wash, --color-rule/2, --radius-sm/md/lg, --font-display/ui/mono); Phase 24 LIB and Phase 26+ screen phases use them directly | ✓ |
| Expose minimal subset now, add more as needed | Just bg-bg, text-ink, bg-accent and the radii/fonts; every screen phase adds another bridge entry; friction without obvious benefit | |
| No — components read CSS vars directly via arbitrary-value utilities | Force `bg-[var(--bg-2)]` syntax; verbose, harder to read, lint allowlist complexity | |

**User's choice:** Yes — expose the full token set as Tailwind utilities now

### Should this phase touch inline `style={{...}}` color/font usages?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them — phase 22 only swaps tokens, not component code | Codebase scout confirmed zero hex/oklch/font-family in inline styles (transforms/opacity/widths only); leave for screen phases unless TOKENS-04 lint catches one | ✓ |
| Audit-and-fix any inline color/font styles found | Grep + replace; front-loads compliance but only useful if violators exist (none found) | |

**User's choice:** Leave them — phase 22 only swaps tokens, not component code

---

## TOKENS-04 build-time guard form

### What form should the TOKENS-04 hardcoded-literal guard take?

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest regex test in src/ui/__tests__/no-hardcoded-literals.test.ts | Test enumerates all .ts/.tsx/.css under src/, asserts no hex/oklch/font-family matches; runs in existing GitHub Actions CI; same pattern as planned src/ui/__tests__/contrast.test.ts (Phase 30) | ✓ |
| ESLint custom rule | Custom rule + overrides; editor squiggles; needs separate stylelint pass for CSS; project doesn't currently use stylelint | |
| Vite plugin (build-only) | Custom plugin throws during vite build; doesn't run in dev or test; violations land late | |
| Both Vitest test AND quick ESLint regex rule | Vitest is source of truth + ESLint provides editor squiggles; two places to update allowlist | |

**User's choice:** Vitest regex test in src/ui/__tests__/no-hardcoded-literals.test.ts

### What goes on the allowlist?

| Option | Description | Selected |
|--------|-------------|----------|
| src/ui/tokens/** and the inline <script> in index.html only | Narrow allowlist: canonical token files plus the dark-mode bootstrap inline script; everything else clean; docs/design-handoff/ outside src/ so not scanned | ✓ |
| Add narrow per-file exceptions when violators surface | Start narrow; add per-file exception with comment-explaining-why if implementation discovers a real-world conflict; pairs with the option above | |
| Allowlist also covers test files (src/**/*.test.{ts,tsx}) | Tests sometimes use literal hex for fixtures; existing tests look fine — likely not needed | |

**User's choice:** src/ui/tokens/** and the inline <script> in index.html only

**Notes:** The "add narrow per-file exceptions when violators surface" option is folded in as the implicit policy for surprises during implementation — narrow exception with comment, not blanket allowlist expansion.

### Should the regex catch other styling literals beyond hex / oklch / font-family?

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly the three the requirement names: hex, oklch(...), font-family literals | Sticks to TOKENS-04 verbatim; minimal false positives; Tailwind utility classes like 'text-blue-700' aren't literals — handled by per-screen restyle in Phase 26+ | ✓ |
| Add rgb()/rgba()/hsl()/hsla() to the pattern set | More thorough but might catch legitimate transparency uses; allowlist becomes a slippery slope | |
| Add named colors too (red, blue, white, etc.) | Hits 'currentColor', 'transparent', 'inherit', SVG fill='currentColor' false positives; needs careful tuning; not worth first-pass complexity | |

**User's choice:** Exactly the three the requirement names: hex, oklch(...), font-family literals

### What's the failure UX — how should the test report violations?

| Option | Description | Selected |
|--------|-------------|----------|
| Single test, one assertion per pattern, list every violator | `expect(violations).toEqual([])` with structured `{ file, line, snippet, pattern_matched }` list on failure; CI logs scannable; one-pass fix | ✓ |
| Per-pattern test cases (it.each) | Three separate it() blocks; clearer report but multiple failed runs to fix one batch | |
| Soft-warn on first run, hard-fail on subsequent runs | Snapshot of "known violations" for gradual cleanup; Phase 22 isn't done if violations exist — incompatible with hard-fail completion gate | |

**User's choice:** Single test, one assertion per pattern, list every violator

---

## Claude's Discretion

The following decisions were explicitly left to the planner / executor:

- **Import order in src/index.css:** `@import "tailwindcss"` → `@import "./ui/tokens/tokens.css"` → `@import "./ui/tokens/base.css"` → `@custom-variant dark (...)` → `@theme {}` bridge block.
- **Replacing the existing `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` block** in src/index.css with the full bridge — direct consequence of D-12, no separate decision needed.
- **The two static hex values for the paired `theme-color` meta** in index.html — Claude picks closest sRGB equivalent of `--accent` (light) and `--accent` (dark); documented in a comment.
- **Whether to add a sync-check test** asserting tokens.css and tokens.ts carry matching values — left to the planner; if cheap, include; otherwise defer with a note.
- **`@theme` bridge utility naming** — follows the existing `--color-bg` / `--color-bg-2` Tailwind v4 convention. No rename to `--color-surface-1` etc. Keep it boring.
- **Whether the inline `<script>` in index.html is allowlisted by file-path or via a sentinel comment header** — left to the planner.
- **The exact regex tuning** for the font-family literal pattern (CSS `font-family:` property + JSX/TS `fontFamily:` object form) — left to the planner.

## Deferred Ideas

- **Replacing Tailwind stock palette with token-bridged equivalents** — explicitly rejected for this phase; Phase 26-29 owns per-screen migration.
- **Auditing inline `style={{...}}` color/font usages** — only revisit if TOKENS-04 surfaces a hit during implementation.
- **Cross-tab theme sync via `storage` event listener** — Phase 25 concern.
- **`tokens.css` ↔ `tokens.ts` automated sync check** — Claude's discretion in the planner; cheap-only.
- **Stylelint or other CSS-only linters** — not adopted; Vitest covers .css.
- **rgb()/rgba()/hsl() and named-color detection** — narrow first pass; revisit only on slippage.
- **Bulk-replacing dark:bg-gray-* → token utilities in components** — not this phase; Phase 26-29 per-screen restyles.
