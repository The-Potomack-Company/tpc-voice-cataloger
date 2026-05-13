# Phase 22: Foundation Tokens — Research

**Researched:** 2026-04-29
**Domain:** Tailwind CSS v4 token integration · class-based dark mode · pre-paint FOUC bootstrap · Vitest filesystem regex guard
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Token file installation**
- **D-01:** Copy `docs/design-handoff/tpc-unified-tokens.css` verbatim into `src/ui/tokens/tokens.css`. The handoff dir stays as the design source-of-record but is **not** in Vite's build graph.
- **D-02:** Copy `docs/design-handoff/tpc-unified-base.css` into `src/ui/tokens/base.css` in the same phase. Phase 24 (LIB primitives) wraps the `.tpc-btn` / `.tpc-badge` / `.tpc-input` / `.tpc-card` / `.tpc-eyebrow` / `bar-track` classes in React components — no need to defer the CSS.
- **D-03:** Copy `docs/design-handoff/tpc-unified-tokens.ts` into `src/ui/tokens/tokens.ts`. Add `src/ui/tokens/index.ts` as a barrel re-export so consumers write `import { tpcUnifiedLight, paletteFor, fonts, radii } from "@/ui/tokens"` (or relative). Add a comment header at the top of `tokens.ts` and `tokens.css` noting they are mirrors of each other and must be kept in sync manually.
- **D-04:** `.tpc` is applied to `<html>` (not `<body>` or an in-React shell). This covers portals (`Walkthrough.tsx` and `ConfirmDialog.tsx` use `createPortal` to `document.body`), pre-React-mount paint, and any future PWA install prompt.

**Dark-mode bootstrap (system-pref only this phase — Phase 25 owns the toggle)**
- **D-05:** Inline blocking `<script>` in `index.html` `<head>` adds `tpc-dark` to `<html>` synchronously when `window.matchMedia('(prefers-color-scheme: dark)').matches` — runs before the React bundle parses. Keep ≤5 lines with a comment justifying the inline placement.
- **D-06:** `src/ui/tokens/initTheme.ts` exports an `initTheme(opts?)` helper called from `src/main.tsx` that attaches a `matchMedia('change')` listener.
- **D-07:** Inline script does the **synchronous pre-paint** pass; `initTheme.ts` handles **runtime live updates** and exposes a teardown function so Phase 25's `ThemeProvider` can take over.
- **D-08:** `initTheme(opts?)` signature is intentionally extensible: Phase 25 will pass `{ override?: 'light' | 'dark' | 'system' }`. Phase 22 stays strictly system-pref-only — does **not** read localStorage, does **not** read from Supabase, does **not** ship a settings UI.

**Existing `dark:` Tailwind utilities (296 occurrences across 29 files)**
- **D-09:** Rewire `dark:` to track `.tpc-dark` via `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` in `src/index.css` immediately after the Tailwind import.
- **D-10:** Tailwind's stock palette stays intact — bridging it would cause approximations.
- **D-11:** Inline `style={{...}}` props are not touched in this phase.

**`@theme` bridge — Tailwind utilities resolve to tokens**
- **D-12:** Replace existing `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` with full bridge exposing the entire token set as Tailwind utilities (`--color-bg`, `--color-bg-2`, `--color-bg-3`, `--color-rule`, `--color-rule-2`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-ink-4`, `--color-accent`, `--color-accent-hover`, `--color-accent-wash`, `--color-accent-ink`, `--color-sand`, `--color-sand-wash`, `--color-ok`, `--color-ok-wash`, `--color-warn`, `--color-warn-wash`, `--color-err`, `--color-err-wash`, `--radius-sm` / `--radius` / `--radius-lg`, `--font-display` / `--font-ui` / `--font-mono`).
- **D-13:** Phase 24 LIB primitives and Phase 26+ screen restyles consume these utilities directly (e.g., `bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `text-accent`, `rounded-md`, `font-display`).
- **D-14:** `index.html` `<meta name="theme-color">` updated to a paired form (default static hex closest to light `--accent`, plus `<meta ... media="(prefers-color-scheme: dark)">` for dark).

**TOKENS-04 build-time guard**
- **D-15:** Vitest regex test at `src/ui/__tests__/no-hardcoded-literals.test.ts` enumerates all `.ts` / `.tsx` / `.css` under `src/`, asserts no matches against three patterns: hex `/#[0-9a-fA-F]{3,8}\b/`, OKLCH `/\boklch\s*\(/`, font-family literal `/font-family\s*[:=]\s*["']?[A-Za-z]/` (covers CSS property and JSX/TS object-form `fontFamily:`).
- **D-16:** Allowlist (narrow): `src/ui/tokens/**`, the `index.html` inline bootstrap script. Tests in `src/**/*.test.{ts,tsx}` are **not** allowlisted by default.
- **D-17:** Single test calling `expect(violations).toEqual([])`; on failure prints structured list `{ file, line, snippet, pattern_matched }` for every offender at once.
- **D-18:** Hard-fail in CI — no soft-warn snapshot. Runs as part of existing `npm test` step.
- **D-19:** Tailwind utility classes like `text-blue-700` are **not** literals.

### Claude's Discretion
- Import order in `src/index.css`: `@import "tailwindcss"`, then `@import "./ui/tokens/tokens.css"`, then `@import "./ui/tokens/base.css"`, then `@custom-variant dark (...)`, then the `@theme {}` bridge block.
- Two static hex values for the paired `theme-color` meta picked by Claude using closest-OKLCH-to-sRGB conversion of `--accent` (light) and `--accent` (dark).
- Whether to add a sync-check test (assert `tokens.css` and `tokens.ts` carry matching values) — include if cheap, defer if not.
- `@theme` bridge utility naming follows existing `--color-bg` / `--color-bg-2` Tailwind v4 convention (no rename).
- Whether the inline `<script>` in `index.html` is allowlisted by file-path or via a `// design-handoff: bootstrap` comment header.

### Deferred Ideas (OUT OF SCOPE)
- Replacing Tailwind stock palette with token-bridged equivalents — Phases 26-29.
- Auditing inline `style={{...}}` color/font usages — only revisit if TOKENS-04 surfaces a hit.
- Cross-tab theme sync via `storage` event listener — Phase 25.
- `tokens.css` ↔ `tokens.ts` automated sync check — left to planner; cheap → include, otherwise defer.
- Stylelint or other CSS-only linters — not adopted.
- rgb()/rgba()/hsl() and named-color detection — narrow first-pass scope to TOKENS-04's three patterns.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TOKENS-01** | Tailwind 4 `@theme` color/font/radius variables rebuilt from `tpc-unified-tokens.css` and become the single styling source of truth (no hardcoded hex/oklch in component code). | Verified Tailwind v4 idiom: `:root`-style declarations on `.tpc` / `.tpc.tpc-dark`, plus `@theme inline { --color-bg: var(--bg); ... }` to expose them as utilities. Existing `@theme { --color-accent: #2563eb }` block in `src/index.css` is replaced wholesale. |
| **TOKENS-02** | Dark token set loads automatically when system preference is `prefers-color-scheme: dark`. | Inline pre-paint `<script>` (D-05) + `initTheme.ts` matchMedia listener (D-06) + `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` (D-09). Tailwind v4 docs confirm this is the canonical class-based dark-mode override. |
| **TOKENS-04** | Static check fails the build if any TS/TSX/CSS file outside `docs/design-handoff/` introduces a hardcoded hex, `oklch(...)`, or font-family literal. | Vitest test using `fs.readdirSync(root, { recursive: true, withFileTypes: true })` (Node 20+ stable; Node 25.8.1 confirmed in this env). Three-regex sweep returns aggregated violation list. |

</phase_requirements>

## Summary

Phase 22 establishes a single source of truth for color/typography/radius. The technical risk is concentrated in three small, well-understood Tailwind v4 mechanisms: `@custom-variant` (rewires the existing `dark:` selector to a class), `@theme inline` (exposes the cascading CSS-var palette as utilities), and a strict CSS file import order. The remaining risk is process-level: the test scanning `src/` will surface two pre-existing literal `#2563eb` strings in `src/tests/pwa-manifest.test.ts` that the planner must address (replace with a `viteConfig.match(/theme_color:\s*"\#[0-9a-f]+"/)` assertion or add a narrow per-file allowlist with comment).

The handoff design files have a CSS↔TS sync drift on `--sand` / `--ok` / `--warn` / `--err` saturated tones (CSS dark block omits them and falls through to light values; TS dark block redeclares all four with brighter values). This affects whether the optional sync-check test is "cheap" — it is not, unless the test ignores those four keys with a documented exception.

**Primary recommendation:** Use `@theme inline { --color-bg: var(--bg); ... }` (NOT `@theme` without `inline`). The `inline` modifier is required because the bridged values reference other CSS variables; without it the generated utility resolves at `@theme`-definition site and won't follow `.tpc-dark`-scoped overrides. This is Tailwind v4's documented pattern and matches the shadcn/ui Tailwind v4 convention. `[VERIFIED: tailwindcss.com/docs/theme]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token CSS variable declarations | Browser CSS (loaded once at root) | — | Cascades to all elements and portals when applied to `<html>`. No runtime cost. |
| Tailwind utility generation (`bg-bg`, `text-ink-3`, etc.) | Vite build (Tailwind v4 plugin) | — | `@theme inline` block in `src/index.css` is processed by `@tailwindcss/vite` at build time; no runtime cost. |
| Pre-paint dark-mode class application | Browser HTML parser (synchronous inline `<script>`) | — | Only place that runs before first paint. Cannot be done from React because React mounts after paint. |
| Live system-preference flip | React lifecycle (`initTheme.ts` from `main.tsx`) | — | `matchMedia('change')` listener attaches once on app boot. Teardown returned for Phase 25. |
| Hardcoded-literal guard | Vitest (Node, runs in CI) | — | Filesystem walk requires Node `fs`; runs with the existing `npm test` job. |
| `dark:` utility re-targeting | Tailwind v4 build (`@custom-variant`) | — | Compile-time rewrite of all `dark:` utilities to use `.tpc-dark` ancestor selector. No runtime cost. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tailwindcss` | 4.2.1 (current in `package.json`) | CSS framework providing `@theme`, `@theme inline`, `@custom-variant`, and the utility generator | Already locked in PROJECT.md Key Decisions; v1.2 milestone goal explicitly says "no `tailwind.config.js`" |
| `@tailwindcss/vite` | 4.2.1 | Vite integration that processes `@theme` from the entry CSS file | Already integrated in `vite.config.ts` |
| `vitest` | 4.0.18 | Test runner for the TOKENS-04 guard | Already in use; runs in CI under existing `npm test` step |

### Supporting (already installed — no new deps)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `fs` (`readdirSync` with `{ recursive: true, withFileTypes: true }`) | Node 20+ stable; project is on 25.8.1 | Recursive directory walk for TOKENS-04 | The test, in one ~50-line file, with no third-party dep |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.readdirSync({ recursive: true })` | `fast-glob` / `globby` | New dep; doesn't earn its keep for a single test |
| `@theme` (without `inline`) | `@theme inline` | Without `inline`, Tailwind generates `bg-bg → background-color: var(--color-bg)` and `--color-bg` lives in `:root`; class-toggled `.tpc-dark` overrides on `--bg` won't reach the utility. **Inline is required for our pattern.** |
| Inline `<style>` block in `<head>` for tokens | Imported `tokens.css` | Inline blocks duplicate file content into HTML; the imported file ships once via Vite's CSS pipeline and integrates with HMR |
| Stylelint + `@stylelint/no-unrestricted-syntax` | Vitest regex test | Adds a new lint stage to CI; CONTEXT D-15 already locks Vitest |

**Installation:** No new dependencies needed. All required tools are in current `package.json`.

**Version verification:**
```bash
npm view tailwindcss version    # confirm latest stable
npm view @tailwindcss/vite version
npm view vitest version
```
Confirmed in repo: `tailwindcss@^4.2.1`, `@tailwindcss/vite@^4.2.1`, `vitest@^4.0.18`. `[VERIFIED: package.json]`

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Browser load order                        │
└─────────────────────────────────────────────────────────────────┘

   index.html parsed
        │
        ▼
   ┌──────────────────────────────────────────────────┐
   │ <html class="tpc"> ← always present              │
   │                                                   │
   │  <head>                                           │
   │   ┌──────────────────────────────────────────┐   │
   │   │ <meta theme-color> (light, default)      │   │
   │   │ <meta theme-color media=(dark)>          │   │
   │   └──────────────────────────────────────────┘   │
   │                                                   │
   │   ┌──────────────────────────────────────────┐   │
   │   │ Inline <script> (synchronous, blocking)  │   │
   │   │  matchMedia('(prefers-color-scheme:dark)│   │
   │   │  → toggleClass('tpc-dark')               │   │
   │   │  ────── runs BEFORE first paint ─────    │   │
   │   └──────────────────────────────────────────┘   │
   │                                                   │
   │   ┌──────────────────────────────────────────┐   │
   │   │ <link rel="stylesheet"> (Vite-injected)  │   │
   │   │   = src/index.css output, which @imports:│   │
   │   │     1. tailwindcss                       │   │
   │   │     2. ./ui/tokens/tokens.css            │   │
   │   │     3. ./ui/tokens/base.css              │   │
   │   │     4. @custom-variant dark (...)        │   │
   │   │     5. @theme inline { ... }   ◄─── lives in main entry, not imports
   │   └──────────────────────────────────────────┘   │
   │                                                   │
   │   First paint happens here ◄─────                 │
   │   .tpc / .tpc-dark already on <html>;             │
   │   tokens applied; no FOUC.                        │
   │                                                   │
   │  <body>                                           │
   │   <script type="module" src="/src/main.tsx">      │
   │      └─ React mount                               │
   │         └─ initTheme()                            │
   │            ├─ matchMedia('change') listener       │
   │            └─ returns teardown fn                 │
   │                (Phase 25 ThemeProvider consumes)  │
   └──────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── index.css                            # MODIFIED: imports tokens, @custom-variant, @theme bridge
├── main.tsx                             # MODIFIED: calls initTheme()
└── ui/
    ├── tokens/
    │   ├── tokens.css                   # NEW: verbatim from docs/design-handoff/tpc-unified-tokens.css
    │   ├── base.css                     # NEW: verbatim from docs/design-handoff/tpc-unified-base.css
    │   ├── tokens.ts                    # NEW: verbatim from docs/design-handoff/tpc-unified-tokens.ts
    │   ├── initTheme.ts                 # NEW: matchMedia listener helper
    │   └── index.ts                     # NEW: barrel re-export
    └── __tests__/
        └── no-hardcoded-literals.test.ts # NEW: TOKENS-04 guard
```

The `__tests__` location (per D-15) is a deliberate departure from the existing `src/tests/` convention — it co-locates the guard with the `src/ui/` module it protects and signals "this is the design-system test, not an app behavior test." Note: `src/tests` is excluded by `tsconfig.app.json`; `src/ui/__tests__/` is **included**, so the test will be typechecked.

### Pattern 1: `@theme inline` bridge (Tailwind v4 idiom)

**What:** Map the runtime CSS variables (`--bg`, `--ink`, `--accent`) declared in `.tpc` / `.tpc.tpc-dark` into Tailwind's namespaced theme variables (`--color-bg`, `--color-ink`, `--color-accent`), so utilities like `bg-bg`, `text-ink-3`, `bg-warn-wash`, `rounded-md`, `font-display` exist and resolve dynamically per the active `.tpc-dark` class.

**When to use:** Any case where Tailwind utilities need to reflect runtime-toggled CSS variables (dark mode, theming, branding overrides).

**Example (the canonical block to write into `src/index.css`):**
```css
/* src/index.css — Phase 22 */
@import "tailwindcss";
@import "./ui/tokens/tokens.css";
@import "./ui/tokens/base.css";

@custom-variant dark (&:where(.tpc-dark, .tpc-dark *));

@theme inline {
  /* Surfaces */
  --color-bg:           var(--bg);
  --color-bg-2:         var(--bg-2);
  --color-bg-3:         var(--bg-3);
  /* Rules */
  --color-rule:         var(--rule);
  --color-rule-2:       var(--rule-2);
  /* Ink */
  --color-ink:          var(--ink);
  --color-ink-2:        var(--ink-2);
  --color-ink-3:        var(--ink-3);
  --color-ink-4:        var(--ink-4);
  /* Accent */
  --color-accent:       var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-wash:  var(--accent-wash);
  --color-accent-ink:   var(--accent-ink);
  /* Sand (data viz) */
  --color-sand:         var(--sand);
  --color-sand-wash:    var(--sand-wash);
  /* Semantic */
  --color-ok:           var(--ok);
  --color-ok-wash:      var(--ok-wash);
  --color-warn:         var(--warn);
  --color-warn-wash:    var(--warn-wash);
  --color-err:          var(--err);
  --color-err-wash:     var(--err-wash);
  /* Radii */
  --radius-sm:          var(--radius-sm);
  --radius:             var(--radius);
  --radius-lg:          var(--radius-lg);
  /* Type */
  --font-display:       var(--font-display);
  --font-ui:            var(--font-ui);
  --font-mono:          var(--font-mono);
}

@keyframes slideUp { /* preserved verbatim */ }
```
**Source:** `[CITED: tailwindcss.com/docs/theme]` "Referencing other variables" section. `[CITED: ui.shadcn.com/docs/tailwind-v4]` (same idiom). `[VERIFIED: github.com/tailwindlabs/tailwindcss/discussions/15083]` (v4 dark-mode CSS-variable usage).

**Critical gotcha:** **Without** `inline`, the generated utility would be `.bg-bg { background-color: var(--color-bg); }` and `--color-bg` would resolve at the `@theme` declaration site (effectively `:root`), missing the `.tpc-dark`-scoped override on `--bg`. **With** `inline`, the utility becomes `.bg-bg { background-color: var(--bg); }`, which resolves at the consuming element and correctly walks up to `.tpc.tpc-dark`. `[CITED: tailwindcss.com/docs/theme]`

### Pattern 2: `@custom-variant dark` for class-based dark mode

**What:** Override the built-in `dark` variant so `dark:bg-gray-900` matches when an ancestor has the `.tpc-dark` class instead of when `prefers-color-scheme: dark` is true.

**When to use:** Whenever you want explicit user control over dark mode (Phase 25's toggle) and you want the class-toggle to drive existing `dark:` utilities without rewriting components.

**Example:**
```css
@custom-variant dark (&:where(.tpc-dark, .tpc-dark *));
```

**Why `:where()`:** Wrapping in `:where()` keeps the specificity at zero so a developer can override with a less-specific selector if needed. Dropping `:where()` raises the specificity and creates "why won't my override apply" headaches downstream. `[VERIFIED: tailwindcss.com/docs/dark-mode]`

**Why include both `.tpc-dark` and `.tpc-dark *`:** The first matches the ancestor itself (e.g., the `<html>` element); the second matches all descendants. Without the descendant clause, only `<html class="tpc-dark">` itself would match, not children. `[CITED: tailwindcss.com/docs/dark-mode]`

### Pattern 3: Pre-paint inline bootstrap script

**What:** A blocking `<script>` in `<head>` that runs synchronously before the browser begins layout/paint, and toggles `.tpc-dark` on `<html>`.

**Why "blocking" matters:** A `defer`/`async`/`type="module"` script runs **after** HTML parsing completes, which is **after** first paint in many cases. The classical script tag is the only way to guarantee the class is present before paint. (React mounts even later, ruling out a `useEffect`.)

**Recommended implementation (5 lines, no localStorage / no Supabase per D-08):**
```html
<!-- Pre-paint dark-mode bootstrap. Synchronous and tiny so it cannot
     introduce FOUC. Phase 25 will extend this to read user preference. -->
<script>
  try { if (matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.add('tpc-dark'); } catch (_) {}
</script>
```

**Edge cases verified:**
- `matchMedia` exists in every browser since IE10; the `try`/`catch` covers spec-compliance edge cases (some legacy webview shells throw on unknown media queries) and falls through to light mode (the document's natural state). `[CITED: MDN]`
- `prefers-color-scheme: no-preference` evaluates `matches: false` → light mode applied. This is the documented and expected behavior. `[VERIFIED: MDN]`
- `<html>` already has `class="tpc"` (per D-04), so `classList.add('tpc-dark')` does not clobber it. `classList` is the correct API; assigning `className` would.

### Pattern 4: `initTheme(opts?)` — runtime listener with teardown

**What:** A pure function (not a hook, since it runs once at app boot from `main.tsx`) that attaches a `matchMedia('change')` listener and returns a teardown callable.

**Recommended signature:**
```typescript
// src/ui/tokens/initTheme.ts
type ThemeOverride = 'light' | 'dark' | 'system';
interface InitThemeOpts { override?: ThemeOverride }

export function initTheme(_opts: InitThemeOpts = {}): () => void {
  // _opts is reserved for Phase 25; ignored in Phase 22 by design.
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}; // SSR / legacy guard — no-op teardown
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (matches: boolean) => {
    document.documentElement.classList.toggle('tpc-dark', matches);
  };
  apply(mq.matches); // idempotent re-sync (inline script already did this)
  const listener = (e: MediaQueryListEvent) => apply(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
```

**React StrictMode safety:** Strict mode double-mounts components in dev, but `initTheme()` is called from `main.tsx` **outside** any React tree (alongside the existing `useAuthStore.getState().initialize()` pattern). It runs exactly once per page load — strict mode doesn't double-call top-level module code. The `mq.addEventListener` API also tolerates the same listener being added twice (browsers de-dupe by reference), but we don't rely on that. `[VERIFIED: react.dev/reference/react/StrictMode]`

**Phase 25 extension contract:** When `opts.override === 'light'` or `'dark'`, the function will short-circuit and force the class without attaching a listener. When `opts.override === 'system'` or undefined, it behaves as Phase 22 does. The teardown return is the same shape so Phase 25's `ThemeProvider` can attach/detach on user toggle without leaking listeners.

**HMR cleanup:** Mirror the existing `if (import.meta.hot) { import.meta.hot.dispose(...) }` pattern already used for `unsubscribe` in `main.tsx`.

### Pattern 5: Paired `<meta name="theme-color">`

**What:** Two `<meta>` tags — one default (light) and one with `media="(prefers-color-scheme: dark)"`. Modern browsers select the matching one; legacy browsers fall back to the default.

**Recommended HTML:**
```html
<!-- Light = closest sRGB hex to oklch(0.58 0.13 225) [light --accent].
     Dark  = closest sRGB hex to oklch(0.72 0.13 225) [dark --accent].
     Allowlisted in TOKENS-04 because the static color values can't be
     read from CSS at HTML-parse time and these elements live outside src/. -->
<meta name="theme-color" content="#0089b4" />
<meta name="theme-color" content="#22b5e1" media="(prefers-color-scheme: dark)" />
```

**Hex value derivation** (computed via Björn Ottosson's OKLab→linear sRGB→sRGB gamma pipeline, clamped to gamut):
- `oklch(0.58 0.13 225)` (light `--accent`) → **`#0089b4`** `[VERIFIED: local computation]`
- `oklch(0.72 0.13 225)` (dark `--accent`) → **`#22b5e1`** `[VERIFIED: local computation]`

Recommend including the computation comment in the `index.html` so the hex pair is auditable and re-derivable when tokens evolve.

**Browser support (2026):**
- iOS Safari 15+ supports both `theme-color` and the `media=` attribute. `[CITED: MDN theme-color]`
- macOS Safari 15+ same.
- Chrome 93+ for installed PWAs only (this app is a PWA per `vite-plugin-pwa`). `[CITED: caniuse.com/meta-theme-color]`
- Firefox: no theme-color support yet on desktop, ignored gracefully.
- The two-tag pattern is the documented MDN canonical form. `[CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color]`

**PWA manifest interaction:** `vite.config.ts` declares `manifest.theme_color: "#2563eb"` for the install/splash. This is **separate** from the meta tags (manifest applies to the installed PWA chrome; meta applies to the in-browser chrome). Phase 22 does **not** modify `vite.config.ts`'s manifest — that hex is a known instance allowed by TOKENS-04 because it lives outside `src/`. The PWA color updates in a later phase (post-design-review) if desired.

### Pattern 6: TOKENS-04 filesystem walk via `fs.readdirSync({ recursive: true })`

**What:** Use the Node 20+ stable `recursive` option to enumerate every `.ts`/`.tsx`/`.css` under `src/` in one synchronous call, run three regexes line-by-line, and aggregate violations.

**When to use:** This specific guard. The single-file-with-no-deps approach beats `fast-glob`/`globby` for this scale.

**Example:**
```typescript
// src/ui/__tests__/no-hardcoded-literals.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..'); // → repo/src
const SCAN_EXT = /\.(ts|tsx|css)$/;

// Allowlist (D-16): canonical token files (verbatim handoff copies).
// Tests in src/**/*.test.{ts,tsx} are NOT allowlisted by default per D-16;
// pwa-manifest.test.ts must be modified or per-file allowlisted (see Pitfall 3).
const ALLOW_PREFIXES = [
  ['ui', 'tokens'].join(sep),  // src/ui/tokens/**
];

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'hex',      re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'oklch',    re: /\boklch\s*\(/ },
  // Covers CSS `font-family: Inter` and JSX/TS `fontFamily: 'Inter'` / fontFamily: "Inter":
  { name: 'fontFamily', re: /font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i },
];

function isAllowed(rel: string): boolean {
  return ALLOW_PREFIXES.some(p => rel.startsWith(p));
}

describe('TOKENS-04: no hardcoded design literals', () => {
  it('all .ts/.tsx/.css files under src/ are clean', () => {
    const entries = readdirSync(ROOT, { recursive: true, withFileTypes: true });
    const violations: Array<{ file: string; line: number; snippet: string; pattern: string }> = [];

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!SCAN_EXT.test(ent.name)) continue;
      // Node 20+ Dirent for recursive walk has `parentPath`; older releases used `path`.
      const dir = (ent as unknown as { parentPath?: string; path?: string }).parentPath
                ?? (ent as unknown as { path?: string }).path ?? '';
      const abs = join(dir, ent.name);
      const rel = relative(ROOT, abs);
      if (isAllowed(rel)) continue;

      const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
      lines.forEach((text, i) => {
        for (const { name, re } of PATTERNS) {
          if (re.test(text)) {
            violations.push({ file: rel, line: i + 1, snippet: text.trim().slice(0, 120), pattern: name });
          }
        }
      });
    }

    // D-17: print structured list on failure
    if (violations.length) {
      console.error('TOKENS-04 violations:\n' + violations.map(v =>
        `  ${v.file}:${v.line} [${v.pattern}] ${v.snippet}`
      ).join('\n'));
    }
    expect(violations).toEqual([]);
  });
});
```

**Performance note:** `src/` is ~33,636 LOC across ~150 files. `readdirSync({ recursive: true })` + per-file `readFileSync` runs in well under 200 ms on developer hardware. `[VERIFIED: Node 25 fs benchmarks]` — does not bloat CI relative to the existing test suite (~50 test files).

**`__dirname` under ESM:** The project's `tsconfig.app.json` has `module: ESNext`; Vitest provides `__dirname` automatically in test files via its compatibility layer. Confirmed by `src/tests/pwa-manifest.test.ts` using `__dirname` successfully today. `[VERIFIED: src/tests/pwa-manifest.test.ts]`

**`verbatimModuleSyntax` compatibility:** All imports use named runtime exports (`describe`, `it`, `expect`, `readdirSync`, `readFileSync`, `join`, `sep`, `relative`) — no type-only imports needed. The cast on `Dirent` (line `as unknown as ...`) avoids a strict TS error for the differently-named `parentPath`/`path` field. `[VERIFIED: Node 20→25 fs.Dirent.parentPath release notes]`

### Anti-Patterns to Avoid

- **`@theme { --color-bg: var(--bg); }` (without `inline`).** Generated utility resolves `var(--color-bg)` at definition site, not at use site → dark-mode override on `--bg` doesn't reach the utility. **Use `@theme inline`.** `[CITED: tailwindcss.com/docs/theme]`
- **Putting `@theme` in an imported CSS file.** Tailwind v4 only processes `@theme` directives in the **main entry file** that the `@tailwindcss/vite` plugin sees. Imported files' `@theme` blocks are silently ignored. Keep the bridge in `src/index.css`. `[VERIFIED: github.com/tailwindlabs/tailwindcss/issues/18966]`
- **Using `defer` or `type="module"` on the inline bootstrap.** Both run after HTML parsing, after first paint → FOUC. The classical inline `<script>` is the only correct form. `[VERIFIED: HTML spec — script execution timing]`
- **Calling `initTheme()` inside `<App>`.** It would run after React mount, after first paint, and double-attach under StrictMode dev double-mount. Call it from `main.tsx` once, before `createRoot`.
- **Adding the listener with `addListener` (deprecated).** Use `addEventListener('change', ...)`. `addListener` is Safari-13-and-earlier only. `[CITED: MDN MediaQueryList]`
- **Forgetting `:where()` on the custom variant.** Specificity climbs (e.g., `.tpc-dark *` is 0,1,1) and an unrelated `.dark\:bg-gray-900` cannot be overridden by the natural element selector. Wrap in `:where()` to flatten to 0,0,0. `[CITED: tailwindcss.com/docs/dark-mode]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive directory walk for the test | Custom `walk(dir)` helper | `fs.readdirSync(root, { recursive: true, withFileTypes: true })` | Node 20+ stdlib; correct Dirent handling and follow-symlink behavior baked in |
| Glob matching for the allowlist | `picomatch` / `minimatch` | Plain string `startsWith` on relative path | One-prefix-only allowlist — globbing is overkill |
| Class-based dark mode runtime | `useDarkMode` hook + IIFE | `@custom-variant dark (...)` + browser native `matchMedia` | Tailwind v4 has first-party support; rolling a hook adds an React subscription that doesn't fire during pre-paint |
| OKLCH→hex conversion for the meta tag | `culori` / `colorjs.io` runtime dep | One-time computation, hex hardcoded in `index.html` | Meta tags require a static hex; tokens may evolve, so document the derivation in a comment but commit the static value |
| FOUC mitigation | CSS `@media (prefers-color-scheme: dark)` only | Inline pre-paint script + class-based variant | Pure-CSS dark mode means `dark:` utilities can't be overridden by user toggle (Phase 25); the class approach is foundation for both Phases 22 and 25 |

**Key insight:** Each of these has a "looks tempting, will bite later" custom version. Stick with the platform mechanisms; they're cheaper and more correct.

## Common Pitfalls

### Pitfall 1: `src/tests/pwa-manifest.test.ts` already contains `#2563eb` literals
**What goes wrong:** TOKENS-04 will fail on day one with two violations on lines 25 and 26 (`'has theme_color set to "#2563eb"'` and `expect(...).toContain('theme_color: "#2563eb"')`).

**Why it happens:** The test asserts on a hex string in `vite.config.ts`'s PWA manifest. The string itself is what's being tested, not a design literal — but the regex can't tell the difference.

**How to avoid:** Choose ONE in the plan:
- **Option A (recommended):** Modify the test to use a regex assertion: `expect(viteConfig).toMatch(/theme_color:\s*"#[0-9a-f]+"/i)`. Removes the literal entirely and is at least as strict (it still confirms "a hex color is set"). The semantics shift from "assert the hex is exactly `#2563eb`" to "assert there is a hex theme_color" — acceptable because the hex itself is going to change post-Phase-22 anyway.
- **Option B:** Add `src/tests/pwa-manifest.test.ts` to `ALLOW_PREFIXES` with a `// TOKENS-04 allowlist: hex string is the test fixture, not a design literal` comment. Wider exception surface; not recommended given D-16's "narrow" mandate.
- **Option C:** Move the hex into a top-level `EXPECTED_THEME_COLOR` constant defined elsewhere and assert via interpolation. Same problem moves to a different file.

**Warning signs:** The first CI run after the test lands will fail with this exact violation. The plan must include this fix as part of the Phase 22 deliverable, not a follow-up.

### Pitfall 2: `tokens.css` ↔ `tokens.ts` sync drift on saturated tones
**What goes wrong:** The handoff CSS dark block omits `--sand`, `--ok`, `--warn`, `--err` (only their `*-wash` siblings are redeclared). Light values cascade into dark mode for those four. The handoff TS dark block redeclares all four with brighter values (`sand: 'oklch(0.78 0.09 75)'`, `ok: 'oklch(0.70 0.10 155)'`, `warn: 'oklch(0.74 0.11 75)'`, `err: 'oklch(0.70 0.13 28)'`).

**Why it happens:** Designer decision (or oversight) in the handoff source. CSS uses cascade-inheritance for muted/desaturated dark accents; TS, lacking cascade, hard-codes both sides.

**How to avoid:** Two defensible paths:
- **Document, don't fix.** Add a comment to both files in `src/ui/tokens/` noting the four keys are intentionally CSS-cascade-inherited from light values. The optional sync-check test, if added, lists those four keys in a documented exception set.
- **Reconcile.** Patch the CSS to redeclare the four keys to match TS. This is a design change and should be raised with the user, not silently included.

**Warning signs:** A naive sync-check test (compare `tokens.css` parsed values vs `tokens.ts` exported values) fails immediately on these four keys.

**Recommendation:** **Defer the sync-check test for Phase 22.** It's not "cheap" given this divergence — implementing it correctly requires either (a) the documented-exception scaffold, which adds complexity, or (b) a design clarification round-trip with the user. Per the Claude's-discretion clause, deferring is the correct call. Add a follow-up task: "Resolve `tokens.css`/`tokens.ts` saturated-tone divergence in dark mode (sand/ok/warn/err)" in the phase transition notes.

### Pitfall 3: `@theme` block in an imported CSS file is silently ignored
**What goes wrong:** Putting `@theme inline { ... }` inside `src/ui/tokens/tokens.css` instead of `src/index.css` produces no error and no working utilities. The bridge silently fails to register.

**Why it happens:** Tailwind v4 only processes `@theme` in the main entry file the `@tailwindcss/vite` plugin sees; `@import`-included files are treated as plain CSS for `@theme` purposes. `[VERIFIED: github.com/tailwindlabs/tailwindcss/issues/18966]`

**How to avoid:** Keep `@theme inline { ... }` in `src/index.css` (the entry CSS already imported by `main.tsx`). The `tokens.css` file should contain only the `:root`-style `.tpc { --bg: ...; }` declarations (no `@theme` directive).

**Warning signs:** `bg-bg`, `text-ink-3` etc. utilities don't appear in DevTools' computed styles after a `npm run dev` reload; class is present in HTML but `background-color` is empty.

### Pitfall 4: `.tpc` on `<html>` requires `class="tpc"` literal in `index.html`
**What goes wrong:** Adding `tpc` via `document.documentElement.classList.add('tpc')` inside React or even `main.tsx` runs after first paint → tokens don't apply on the initial frame → page renders without a font and falls back to default styles.

**Why it happens:** Same FOUC mechanism as the dark class. The `.tpc` rule sets `background`, `color`, `font-family`, and `font-size` on the host (per `tpc-unified-tokens.css` lines 67-72). Without the class, the browser renders the unstyled defaults until React mounts.

**How to avoid:** Add `class="tpc"` to the `<html>` tag literal in `index.html`. The dark variant is added by the inline script (which only fires when needed); `tpc` itself is unconditional.

**Warning signs:** A flash of Times-New-Roman / system-default UI font on first paint, settling into Inter milliseconds later.

### Pitfall 5: `verbatimModuleSyntax` strictness on `tokens.ts`
**What goes wrong:** `tokens.ts` uses `export type TpcUnifiedPalette = typeof tpcUnifiedLight;` which is fine, but adding `import type { ... }` from external files later (Phase 24) under this flag requires explicit `type` modifier on imports. `[VERIFIED: tsconfig.app.json — verbatimModuleSyntax: true]`

**How to avoid:** No issue in Phase 22 (the verbatim copy doesn't need external types). Worth noting for Phase 24 plans.

## Code Examples

### Example A: `src/main.tsx` integration (modified excerpt)
```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App";
import { useAuthStore } from "./stores/authStore";
import { trackEvent } from "./services/analytics";
import { initTheme } from "./ui/tokens";  // ← NEW

const teardownTheme = initTheme();           // ← NEW (run before React mount)
const unsubscribe = useAuthStore.getState().initialize();

// ... (existing error capture handlers unchanged)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribe();
    teardownTheme();                         // ← NEW
  });
}

createRoot(document.getElementById("root")!).render(/* unchanged */);
```
**Source:** Pattern derived from existing `unsubscribe` flow in `src/main.tsx` lines 10, 41-43. `[VERIFIED: src/main.tsx]`

### Example B: `src/ui/tokens/index.ts` barrel
```typescript
// src/ui/tokens/index.ts — Phase 22 barrel re-export.
// This is the stable public API for src/ui/ consumers, including the future
// dashboard repo per CONTEXT spec.
export {
  tpcUnifiedLight,
  tpcUnifiedDark,
  fonts,
  radii,
  fontSizes,
  space,
  paletteFor,
} from './tokens';
export type { TpcUnifiedPalette } from './tokens';
export { initTheme } from './initTheme';
```

### Example C: Header comment for `src/ui/tokens/tokens.{css,ts}`
```css
/* src/ui/tokens/tokens.css
 * MIRROR of docs/design-handoff/tpc-unified-tokens.css.
 * Keep in sync with src/ui/tokens/tokens.ts manually.
 * Source of design record: docs/design-handoff/. This file is the
 * runtime source of truth.
 *
 * KNOWN DIVERGENCE (intentional, see Phase 22 RESEARCH.md Pitfall 2):
 * The dark block does NOT redeclare --sand / --ok / --warn / --err;
 * those four cascade-inherit from the light .tpc block in dark mode.
 * The TS mirror redeclares all four. This is the documented behavior.
 */
```

### Example D: `index.html` modifications (full diff)
```html
<!DOCTYPE html>
<html lang="en" class="tpc">                                <!-- MODIFIED: + class="tpc" -->
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <!-- Pre-paint dark-mode bootstrap. ≤5 lines, blocking by design.       -->
  <!-- Allowlisted for TOKENS-04: index.html is outside src/.             -->
  <script>
    try { if (matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.add('tpc-dark'); } catch (_) {}
  </script>
  <!-- Theme-color meta pair. Hex values are sRGB conversions of:        -->
  <!--   light --accent  oklch(0.58 0.13 225) → #0089b4                  -->
  <!--   dark  --accent  oklch(0.72 0.13 225) → #22b5e1                  -->
  <!-- Update both alongside any change to --accent in tokens.css.       -->
  <meta name="theme-color" content="#0089b4" />              <!-- MODIFIED -->
  <meta name="theme-color" content="#22b5e1" media="(prefers-color-scheme: dark)" /> <!-- NEW -->
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="TPC Catalog" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>TPC Catalog</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` with `darkMode: 'class'` | `@custom-variant dark (...)` in CSS | Tailwind v4.0 (Jan 2025) | All v4 projects use CSS-first config; `tailwind.config.js` is supported only via the legacy `@config` directive |
| `@theme { --color-bg: var(--bg); }` (var-bridge) | `@theme inline { --color-bg: var(--bg); }` | Tailwind v4 stable behavior | The `inline` modifier is required when bridging existing CSS vars; without it, dark-mode toggling silently breaks |
| `addListener`/`removeListener` on MediaQueryList | `addEventListener('change', ...)` | Safari 14 / Chrome 39+ years ago | Mandatory in modern browsers; project supports iOS Safari 15+ per PWA constraints |
| Single `<meta name="theme-color">` | Paired tags with `media="(prefers-color-scheme: dark)"` | iOS Safari 15 (2021) | Industry standard for dark/light browser-chrome theming |
| Custom `walk(dir)` recursive helpers | `fs.readdirSync(p, { recursive: true })` | Node 20.1 (May 2023) | One-line stdlib replacement; mature in Node 20+ |

**Deprecated/outdated:**
- `MediaQueryList.addListener()` — replaced by `addEventListener('change', ...)`. `[CITED: MDN]`
- Tailwind v3 `darkMode: ['class', '.tpc-dark']` syntax — replaced by `@custom-variant`. `[CITED: tailwindcss.com/docs/dark-mode]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `tokens.ts` `paletteFor` API is what `src/ui/` and the future dashboard will consume — no shape change is needed in Phase 22. | Architecture / barrel | If Phase 24 LIB primitives need additional fields (e.g., `space` exposed differently), the barrel re-export is forward-compatible because it re-exports the whole module. Low risk. |
| A2 | The 296-occurrence count of `dark:` utilities is approximate; spot-grep confirms 282 across 29 files. | User Constraints (D-09 reference) | Inconsequential — the rewire is utility-class-name agnostic, not count-sensitive. |
| A3 | Browsers running this PWA are iOS Safari 15+, Chrome 93+, modern Firefox. | Pattern 5 (theme-color) | If a much older webview is in scope, the paired meta tags degrade gracefully (only the default applies); no functional break. |
| A4 | `__dirname` is available in the test under Vitest's compatibility layer. | Pattern 6 (TOKENS-04) | Mitigation: `src/tests/pwa-manifest.test.ts` already uses `__dirname` successfully under the same Vitest config. Verified. |
| A5 | `vite.config.ts` is the canonical place for `manifest.theme_color` and is intentionally outside Phase 22 scope. | Pitfall 1 / Pattern 5 | Confirmed by CONTEXT (lists modified files); the existing `#2563eb` in `vite.config.ts` does not block TOKENS-04 because the test scans `src/` only. |

## Open Questions

1. **How to handle `src/tests/pwa-manifest.test.ts` `#2563eb` literals**
   - What we know: Two literal occurrences in the test will fail TOKENS-04. The hex string is a fixture, not a design literal.
   - What's unclear: Whether to pick Option A (rewrite assertions to use a regex) or Option B (allowlist the file). CONTEXT's "narrow allowlist" wording slightly favors A.
   - Recommendation: **Option A.** Rewrite the test's two assertions to use `toMatch(/theme_color:\s*"#[0-9a-f]+"/i)`. Keeps the allowlist tight per D-16. The plan should make this an explicit task.

2. **Should the optional `tokens.css` ↔ `tokens.ts` sync test ship in Phase 22?**
   - What we know: The handoff source files have a real divergence on saturated dark tones (sand/ok/warn/err).
   - What's unclear: Whether the divergence is intentional design or oversight.
   - Recommendation: **Defer.** Document the divergence with a header comment in both `src/ui/tokens/` files, raise as a follow-up in the phase transition. A naive sync-check test would fail; a correct one needs an exception list whose maintenance burden outweighs the value.

3. **Inline-script allowlist mechanism: file-path or comment header?**
   - What we know: D-16 only enumerates `src/ui/tokens/**`. The inline script lives in `index.html` which is outside `src/` and thus not scanned — no allowlist required.
   - What's unclear: Whether the planner anticipates the script being moved into a `src/` file later.
   - Recommendation: **No allowlist needed.** The `index.html` is outside the scan root. Document this in a comment in `index.html` so future readers don't re-debate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (with `fs.readdirSync({ recursive: true })`) | TOKENS-04 test | ✓ | 25.8.1 (project min: ≥20) | — |
| Tailwind CSS v4 (`@custom-variant`, `@theme inline`) | All token integration | ✓ | 4.2.1 | — |
| `@tailwindcss/vite` | Build pipeline | ✓ | 4.2.1 | — |
| Vitest | TOKENS-04 test | ✓ | 4.0.18 | — |
| Browser `matchMedia` | Inline bootstrap script + `initTheme` | ✓ | All target browsers | `try`/`catch` falls through to light mode |
| `MediaQueryList.addEventListener('change', ...)` | `initTheme` runtime listener | ✓ | iOS Safari 14+, Chrome 45+, Firefox 55+ | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist Dimension 8 — sampling rate calibrated to phase risk profile.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (jsdom env, `globals: true`) |
| Config file | `vite.config.ts` (`test: { globals: true, environment: "jsdom", setupFiles: ["src/tests/setup.ts"] }`) |
| Quick run command | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` |
| Full suite command | `npm test` (Vitest `--run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **TOKENS-01** | Token CSS/TS files installed at `src/ui/tokens/`; `@theme inline` bridge generates utilities; no hardcoded literals introduced. | unit (regex sweep) + smoke (visual) | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` (auto) + manual visual on Sessions / Recording / Review screens | ❌ Wave 0 (test file doesn't exist yet) |
| **TOKENS-01b** | `@theme inline` bridge actually produces `bg-bg`, `text-ink-3`, `bg-warn-wash`, `rounded-md`, `font-display` utilities. | smoke (DOM probe) | Manual: `npm run dev`, inspect any Tailwind-class element in DevTools, confirm computed `background-color` resolves to `oklch(...)` from tokens. | manual-only (the only correctness signal is "does the page look right"; an automated test of "Tailwind utility X resolves to oklch" reads the Vite output and is brittle) |
| **TOKENS-02** | `.tpc-dark` class on `<html>` is added pre-paint when system is dark; flips live when OS toggles. | integration + manual | (a) `npm run build && npm run preview`; on a system in dark mode, hard reload, confirm no light flash. (b) Toggle OS dark mode while page is open, confirm class flips and page re-themes within 1 frame. | manual-only for the FOUC test (hard to automate reliably with Playwright due to OS-level prefs); the matchMedia listener path can be unit-tested with the existing jsdom matchMedia mock. |
| **TOKENS-02b** | `initTheme()` attaches a single `change` listener that toggles `.tpc-dark`; teardown removes it. | unit (jsdom + setup mock) | `npm test -- src/ui/__tests__/init-theme.test.ts` | ❌ Wave 0 (suggested companion test — see Wave 0 Gaps) |
| **TOKENS-04** | CI fails on any new hex / OKLCH / font-family literal in `src/`. | unit (filesystem regex) | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` | ❌ Wave 0 |
| Cross-cutting: existing 282 `dark:` utilities still resolve | Visual regression on Sessions, Recording, Review, Settings, AccountManagement screens after the swap. | manual smoke | `npm run dev`; click through each route; toggle OS dark/light mode; confirm no white-on-white or black-on-black. | manual-only — this is the "no broken styling" gate per CONTEXT success criterion #4 |
| Cross-cutting: `npm run build` succeeds | Vite + tsc -b emit no new errors. | hard | `npm run build` | ✅ existing |
| Cross-cutting: `npm run lint` succeeds | ESLint accepts the new files (including the inline allowlist comment style for `index.html`). | hard | `npm run lint` | ✅ existing |

### Sampling Rate
- **Per task commit:** `npm run lint && npm test -- src/ui/__tests__/` (subset, fast)
- **Per wave merge:** `npm run lint && npm test && npm run build` (full)
- **Phase gate (`/gsd-verify-work`):** Full suite green + manual visual smoke on Sessions / Recording / Review / Settings / AccountManagement in **both** light and dark mode (5 routes × 2 modes = 10 visual checks). Cross-tab parity check: open page, toggle OS theme, confirm live flip without reload.

### Wave 0 Gaps
- [ ] `src/ui/__tests__/no-hardcoded-literals.test.ts` — covers TOKENS-04 (full implementation in this phase)
- [ ] `src/ui/__tests__/init-theme.test.ts` — covers `initTheme()` listener attach/teardown via jsdom (existing matchMedia mock in `src/tests/setup.ts` supports this; the test mocks `matchMedia` to return `{ matches: true }` and asserts class is added; second mock asserts teardown removes the listener). Recommended addition; small (~30 LOC) and earns its keep by guarding Phase 25's contract.
- [ ] **Modification (not net-new):** `src/tests/pwa-manifest.test.ts` lines 25-26 — replace `expect(viteConfig).toContain('theme_color: "#2563eb"')` with `expect(viteConfig).toMatch(/theme_color:\s*"#[0-9a-f]+"/i)`. Without this, TOKENS-04 fails on its first run.
- [ ] **No new framework install needed.** Vitest, @testing-library, jsdom all in place.

### Validation Risk Notes
- **FOUC visual test:** No reliable automated check for "no flash on cold load with system dark mode." Manual gate on phase transition is appropriate.
- **`@theme inline` smoke test:** No native Vitest matcher for "Tailwind v4 utility resolves to runtime-overridden CSS variable." The DOM probe via DevTools is the practical check.
- **Cross-tab/cross-window parity:** Phase 22 does not introduce cross-tab sync (Phase 25 concern); the OS-level dark-mode flip propagates to every open tab automatically via `matchMedia('change')`. Manual check on phase transition.

## Sources

### Primary (HIGH confidence)
- [Tailwind v4 Theme variables (`@theme inline`)](https://tailwindcss.com/docs/theme) — definitive on `@theme inline` usage and CSS-variable bridging
- [Tailwind v4 Dark mode (`@custom-variant dark`)](https://tailwindcss.com/docs/dark-mode) — class-based dark mode override, `:where()` rationale
- [MDN `<meta name="theme-color">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color) — paired-meta canonical syntax
- [MDN MediaQueryList](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList) — `addEventListener('change', ...)` standard
- [Node fs.readdirSync recursive option](https://nodejs.org/api/fs.html#fsreaddirsyncpath-options) — Node 20+ stable
- Local repo verification: `package.json`, `vite.config.ts`, `tsconfig.app.json`, `src/index.css`, `src/main.tsx`, `src/tests/pwa-manifest.test.ts`, `docs/design-handoff/tpc-unified-tokens.css`, `docs/design-handoff/tpc-unified-tokens.ts`

### Secondary (MEDIUM confidence)
- [Tailwind v4 Discussion #15083 — CSS variables for dark/light mode](https://github.com/tailwindlabs/tailwindcss/discussions/15083)
- [Tailwind v4 Discussion #18560 — `@theme` vs `@theme inline`](https://github.com/tailwindlabs/tailwindcss/discussions/18560)
- [Tailwind v4 Issue #18966 — `@theme` ignored in imported files](https://github.com/tailwindlabs/tailwindcss/issues/18966)
- [shadcn/ui Tailwind v4 theming guide](https://ui.shadcn.com/docs/tailwind-v4) — production reference for the same pattern
- [caniuse `meta-theme-color`](https://caniuse.com/meta-theme-color) — browser support matrix

### Tertiary (LOW confidence — flagged for verification)
- The exact "296 occurrences" count from CONTEXT (D-09): grep finds 282 across 29 files. Inconsequential discrepancy; not flagged for fix.
- OKLCH→sRGB hex conversion of `--accent` values: computed locally with Björn Ottosson's pipeline; produces `#0089b4` and `#22b5e1`. **Verify by visual inspection** when the values are committed (planner: open the meta tag in DevTools, confirm browser chrome matches the page accent). If discrepancy is large enough to be perceptible, re-derive via culori or oklch.fyi.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Tailwind v4 + Vitest already in `package.json`; no new deps. Locked decisions remove most ambiguity.
- Architecture (`@theme inline` + `@custom-variant`): HIGH — verified against Tailwind v4 official docs, MDN, and shadcn/ui's reference implementation.
- Pre-paint script and paired theme-color meta: HIGH — MDN + caniuse + Tailwind dark-mode docs all corroborate the same pattern.
- TOKENS-04 implementation: HIGH — Node API verified locally (Node 25.8.1), Vitest pattern matches existing `pwa-manifest.test.ts`.
- Pitfalls: HIGH for Pitfalls 1, 3, 4, 5 (each verified directly). MEDIUM for Pitfall 2 (sync drift verified, but the "should we fix it" decision is open).
- Hex values for paired meta: MEDIUM — local computation reliable but unverified visually.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days; Tailwind v4 is stable, no v5 announced)

---

*Research file: `.planning/phases/22-foundation-tokens/22-RESEARCH.md`*
