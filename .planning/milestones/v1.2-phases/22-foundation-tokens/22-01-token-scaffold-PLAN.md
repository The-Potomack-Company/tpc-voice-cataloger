---
phase: 22-foundation-tokens
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/tokens/tokens.css
  - src/ui/tokens/base.css
  - src/ui/tokens/tokens.ts
  - src/ui/tokens/index.ts
  - src/tests/pwa-manifest.test.ts
autonomous: true
requirements: [TOKENS-01, TOKENS-04]
tags: [tokens, design-system, tailwind-v4]

must_haves:
  truths:
    - "Canonical token CSS exists at src/ui/tokens/tokens.css verbatim from docs/design-handoff/tpc-unified-tokens.css (D-01)"
    - "Canonical base CSS exists at src/ui/tokens/base.css verbatim from docs/design-handoff/tpc-unified-base.css (D-02)"
    - "Canonical token TS exists at src/ui/tokens/tokens.ts verbatim from docs/design-handoff/tpc-unified-tokens.ts (D-03)"
    - "Barrel src/ui/tokens/index.ts re-exports tpcUnifiedLight, tpcUnifiedDark, fonts, radii, fontSizes, space, paletteFor, TpcUnifiedPalette (D-03)"
    - "tokens.css and tokens.ts each carry a header comment marking them as manual-mirror twins and documenting the saturated-tone divergence (D-03, RESEARCH Pitfall 2)"
    - "src/tests/pwa-manifest.test.ts no longer contains literal '#2563eb' strings; assertion is regex-based so TOKENS-04 will not flag it (RESEARCH Pitfall 1)"
  artifacts:
    - path: "src/ui/tokens/tokens.css"
      provides: ".tpc and .tpc.tpc-dark CSS-var declarations (surfaces, rules, ink, accent, sand, semantic, type, radii)"
      contains: ".tpc {"
    - path: "src/ui/tokens/base.css"
      provides: ".tpc-btn / .tpc-badge / .tpc-input / .tpc-card / .tpc-eyebrow / .tpc-display / .tnum / .bar-track / .bar-fill helper classes"
      contains: ".tpc .tpc-btn"
    - path: "src/ui/tokens/tokens.ts"
      provides: "JS-side palette mirror: tpcUnifiedLight, tpcUnifiedDark, fonts, radii, fontSizes, space, paletteFor, TpcUnifiedPalette"
      exports: ["tpcUnifiedLight", "tpcUnifiedDark", "fonts", "radii", "fontSizes", "space", "paletteFor", "TpcUnifiedPalette"]
    - path: "src/ui/tokens/index.ts"
      provides: "Stable public API barrel for src/ui consumers and the future dashboard repo"
      exports: ["tpcUnifiedLight", "tpcUnifiedDark", "fonts", "radii", "fontSizes", "space", "paletteFor", "TpcUnifiedPalette"]
    - path: "src/tests/pwa-manifest.test.ts"
      provides: "PWA manifest test with regex-based theme_color assertion (no hex literal)"
      contains: "toMatch(/theme_color"
  key_links:
    - from: "src/ui/tokens/index.ts"
      to: "src/ui/tokens/tokens.ts"
      via: "named re-export"
      pattern: "from ['\"]\\./tokens['\"]"
    - from: "src/tests/pwa-manifest.test.ts"
      to: "vite.config.ts"
      via: "regex assertion that ANY hex theme_color is set"
      pattern: "toMatch.*theme_color"
---

<objective>
Install the canonical TPC token files at `src/ui/tokens/` (CSS + base + TS + barrel) and clear the one pre-existing TOKENS-04 violation in `src/tests/pwa-manifest.test.ts`. After this plan lands, the source-of-truth files are in place and the codebase contains zero hex/oklch/font-family literals outside `src/ui/tokens/**` — but the bridge wiring (Plan 02) and the runtime listener (Plan 03) have not yet been hooked up.

Purpose: Establish a stable, deterministic foundation that subsequent plans depend on. Plans 02, 03, and 04 all reference the files this plan creates.

Output: 4 new files (`src/ui/tokens/{tokens.css, base.css, tokens.ts, index.ts}`), 1 modified file (`src/tests/pwa-manifest.test.ts`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-foundation-tokens/22-CONTEXT.md
@.planning/phases/22-foundation-tokens/22-RESEARCH.md

@docs/design-handoff/tpc-unified-tokens.css
@docs/design-handoff/tpc-unified-base.css
@docs/design-handoff/tpc-unified-tokens.ts
@src/tests/pwa-manifest.test.ts

<interfaces>
<!-- Public API surface this plan establishes for src/ui/tokens consumers. -->
<!-- Plans 02, 03, 04 import from this barrel. -->

From src/ui/tokens/index.ts (created by this plan):
```typescript
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
// initTheme is added in Plan 03; this plan does NOT export it yet.
```

From docs/design-handoff/tpc-unified-tokens.ts (verbatim copy target):
```typescript
export const tpcUnifiedLight = { bg, bg2, bg3, rule, rule2, ink, ink2, ink3, ink4,
  accent, accentHover, accentWash, accentInk, sand, sandWash,
  ok, okWash, warn, warnWash, err, errWash } as const;
export const tpcUnifiedDark: typeof tpcUnifiedLight = { /* dark values */ };
export const fonts = { display, ui, mono } as const;
export const radii = { sm: 4, md: 6, lg: 10 } as const;
export const fontSizes = { micro, meta, small, body, ui, d1..d6 } as const;
export const space = { '0'..'12' } as const;
export type TpcUnifiedPalette = typeof tpcUnifiedLight;
export const paletteFor = (mode: 'light' | 'dark'): TpcUnifiedPalette => ...;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Copy token CSS files verbatim with mirror-status header</name>
  <files>src/ui/tokens/tokens.css, src/ui/tokens/base.css</files>
  <read_first>
    - docs/design-handoff/tpc-unified-tokens.css (the verbatim copy source for tokens.css — read every line)
    - docs/design-handoff/tpc-unified-base.css (the verbatim copy source for base.css — read every line)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-01, D-02, D-03 govern this task)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pitfall 2 documents the saturated-tone divergence the header must call out)
  </read_first>
  <action>
Per D-01, D-02, D-03:

1. Create `src/ui/tokens/` directory.

2. Create `src/ui/tokens/tokens.css` as a **verbatim copy** of `docs/design-handoff/tpc-unified-tokens.css`. Do not change a single rule, value, or comment in the body. PREPEND this exact header comment block to the very top of the file (before the existing `/* ============================================================` block in the source):

```css
/* src/ui/tokens/tokens.css
 * MIRROR of docs/design-handoff/tpc-unified-tokens.css.
 * Keep in sync with src/ui/tokens/tokens.ts manually.
 * Source of design record: docs/design-handoff/. This file is the
 * runtime source of truth for the app build graph.
 *
 * KNOWN DIVERGENCE (intentional, per Phase 22 RESEARCH.md Pitfall 2):
 * The dark block does NOT redeclare --sand / --ok / --warn / --err;
 * those four cascade-inherit from the light .tpc block in dark mode.
 * The TS mirror redeclares all four. This is documented behavior.
 */
```

The rest of the file is identical to the handoff source: `.tpc { ... }` (light, with `background`, `color`, `font-family`, `-webkit-font-smoothing`, `font-size: 13px` apply rules at the bottom) and `.tpc.tpc-dark { ... }` (dark redeclarations of bg/rule/ink/accent + the four `*-wash` siblings).

3. Create `src/ui/tokens/base.css` as a **verbatim copy** of `docs/design-handoff/tpc-unified-base.css`. PREPEND this header:

```css
/* src/ui/tokens/base.css
 * MIRROR of docs/design-handoff/tpc-unified-base.css.
 * Companion to tokens.css. Reads CSS variables — never hard-codes color.
 * Loaded AFTER tokens.css.
 */
```

The rest is identical: `.tpc .tpc-eyebrow`, `.tpc .tpc-display`, `.tpc .tnum`, all `.tpc .tpc-btn-*` variants, `.tpc .tpc-badge*`, `.tpc .tpc-dot`, `.tpc .tpc-input` + `:focus`, `.tpc .tpc-card`, `.tpc .hide-scroll`, `.tpc .tpc-kbd`, `.tpc .tpc-placeholder`, `.tpc .bar-track`, `.tpc .bar-fill`.

4. Do **not** add `@theme` directives to these files — Plan 02 puts the bridge in `src/index.css` (per RESEARCH Pitfall 3, `@theme` in imported files is silently ignored).

5. Do **not** import these files from anywhere yet — Plan 02 wires the imports in `src/index.css`.

Both files contain `oklch(...)` and hex-style and font-family literals — they are TOKENS-04 allowlisted because `src/ui/tokens/**` is in the canonical allowlist (Plan 04 establishes this allowlist).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const t=fs.readFileSync('src/ui/tokens/tokens.css','utf8');const b=fs.readFileSync('src/ui/tokens/base.css','utf8');if(!t.includes('.tpc {')||!t.includes('.tpc.tpc-dark {')||!t.includes('MIRROR of docs/design-handoff')||!t.includes('KNOWN DIVERGENCE'))process.exit(1);if(!b.includes('.tpc .tpc-btn')||!b.includes('.tpc .tpc-input')||!b.includes('.tpc .bar-fill')||!b.includes('MIRROR of docs/design-handoff'))process.exit(1);console.log('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/ui/tokens/tokens.css` exists.
    - `src/ui/tokens/tokens.css` contains the literal string `.tpc {` (light block).
    - `src/ui/tokens/tokens.css` contains the literal string `.tpc.tpc-dark {` (dark block).
    - `src/ui/tokens/tokens.css` contains the header substring `MIRROR of docs/design-handoff/tpc-unified-tokens.css`.
    - `src/ui/tokens/tokens.css` contains the substring `KNOWN DIVERGENCE` (saturated-tone documentation).
    - `src/ui/tokens/tokens.css` contains all 21 token names: `--bg`, `--bg-2`, `--bg-3`, `--rule`, `--rule-2`, `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--accent`, `--accent-hover`, `--accent-wash`, `--accent-ink`, `--sand`, `--sand-wash`, `--ok`, `--ok-wash`, `--warn`, `--warn-wash`, `--err`, `--err-wash` (verifiable via `grep -c "\-\-bg" src/ui/tokens/tokens.css` returning ≥3).
    - `src/ui/tokens/tokens.css` contains `--font-display`, `--font-ui`, `--font-mono`, `--radius-sm`, `--radius:`, `--radius-lg`.
    - File `src/ui/tokens/base.css` exists.
    - `src/ui/tokens/base.css` contains `.tpc .tpc-btn`, `.tpc .tpc-input`, `.tpc .bar-fill`.
    - `src/ui/tokens/base.css` contains the header substring `MIRROR of docs/design-handoff/tpc-unified-base.css`.
    - `src/ui/tokens/base.css` does NOT contain `@theme` (those go in src/index.css per Pitfall 3).
  </acceptance_criteria>
  <done>Both CSS files copied verbatim with header comments; ready for Plan 02 to import them from `src/index.css`.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Copy token TS verbatim and create barrel index</name>
  <files>src/ui/tokens/tokens.ts, src/ui/tokens/index.ts</files>
  <read_first>
    - docs/design-handoff/tpc-unified-tokens.ts (verbatim copy source — read every line including the header comment)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-03 governs the barrel + header comment requirement)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Example B and Example C show the barrel and header shapes)
  </read_first>
  <action>
Per D-03:

1. Create `src/ui/tokens/tokens.ts` as a **verbatim copy** of `docs/design-handoff/tpc-unified-tokens.ts`. The handoff file already starts with a JSDoc-style mirror-status comment — REPLACE that comment with the following expanded header that adds the divergence note:

```typescript
/**
 * src/ui/tokens/tokens.ts
 *
 * MIRROR of docs/design-handoff/tpc-unified-tokens.ts.
 * Keep in sync with src/ui/tokens/tokens.css manually.
 * Source of design record: docs/design-handoff/. This file is the
 * runtime source of truth for JS consumers (the future dashboard repo
 * imports from here via src/ui/tokens/index.ts).
 *
 * KNOWN DIVERGENCE (intentional, per Phase 22 RESEARCH.md Pitfall 2):
 * The CSS mirror's dark block omits --sand / --ok / --warn / --err
 * (they cascade-inherit from light values). This TS mirror redeclares
 * all four with brighter dark values. Both behaviors are deliberate.
 */
```

The rest of the file body is identical to the handoff source: `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor`, `TpcUnifiedPalette` — including the `as const` assertions and the `: typeof tpcUnifiedLight` type annotation on `tpcUnifiedDark`.

2. Create `src/ui/tokens/index.ts` exactly as follows:

```typescript
// src/ui/tokens/index.ts — Phase 22 barrel re-export.
//
// This is the stable public API for src/ui consumers, including the
// future dashboard repo per Phase 22 CONTEXT spec (specifics §"future
// dashboard repo will consume src/ui/ primitives").
//
// initTheme is added by Plan 03 in this same phase; the import line is
// commented out here and uncommented when initTheme.ts lands.

export {
  tpcUnifiedLight,
  tpcUnifiedDark,
  fonts,
  radii,
  fontSizes,
  space,
  paletteFor,
} from "./tokens";
export type { TpcUnifiedPalette } from "./tokens";

// export { initTheme } from "./initTheme"; // Added by Plan 03.
```

Note: tsconfig.app.json has `verbatimModuleSyntax: true` (per RESEARCH Pitfall 5) so the `export type { TpcUnifiedPalette }` form is mandatory — do not collapse it into the runtime export block.

3. The path alias `@/ui/tokens` referenced in CONTEXT D-03 is aspirational; until any path alias is configured in `tsconfig.app.json` and `vite.config.ts`, consumers use the relative form `import ... from "./ui/tokens"`. Do NOT add a path alias in this phase — keep the change set minimal.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const t=fs.readFileSync('src/ui/tokens/tokens.ts','utf8');const i=fs.readFileSync('src/ui/tokens/index.ts','utf8');if(!t.includes('export const tpcUnifiedLight')||!t.includes('export const tpcUnifiedDark')||!t.includes('export const paletteFor')||!t.includes('export type TpcUnifiedPalette')||!t.includes('MIRROR of docs/design-handoff'))process.exit(1);if(!i.includes('tpcUnifiedLight')||!i.includes('paletteFor')||!i.includes('export type { TpcUnifiedPalette }')||!i.includes('from \"./tokens\"'))process.exit(2);console.log('ok')"</automated>
    <automated>npx tsc -p tsconfig.app.json --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `src/ui/tokens/tokens.ts` exists.
    - `src/ui/tokens/tokens.ts` contains: `export const tpcUnifiedLight`, `export const tpcUnifiedDark`, `export const fonts`, `export const radii`, `export const fontSizes`, `export const space`, `export const paletteFor`, `export type TpcUnifiedPalette`.
    - `src/ui/tokens/tokens.ts` header contains substring `MIRROR of docs/design-handoff/tpc-unified-tokens.ts`.
    - `src/ui/tokens/tokens.ts` header contains substring `KNOWN DIVERGENCE`.
    - File `src/ui/tokens/index.ts` exists.
    - `src/ui/tokens/index.ts` contains: `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor`, `export type { TpcUnifiedPalette }`, and the literal `from "./tokens"`.
    - `src/ui/tokens/index.ts` does NOT export `initTheme` yet (added by Plan 03 — comment placeholder is OK).
    - `npx tsc -p tsconfig.app.json --noEmit` exits 0.
  </acceptance_criteria>
  <done>TS mirror and barrel committed; type-check passes under verbatimModuleSyntax. Plan 03 will add `initTheme.ts` next to `tokens.ts` and uncomment the barrel line.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Modify pwa-manifest.test.ts to remove hex literals (TOKENS-04 precondition)</name>
  <files>src/tests/pwa-manifest.test.ts</files>
  <read_first>
    - src/tests/pwa-manifest.test.ts (current 28-line test — read every line; lines 25-26 contain the hex literal that fails TOKENS-04)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pitfall 1 + Open Question 1 — the chosen remedy is Option A)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-15, D-16 — narrow allowlist policy)
    - vite.config.ts (sanity-check that `theme_color: "#XXXXXX"` is the actual format Vite emits — confirms the regex matches)
  </read_first>
  <action>
Per RESEARCH Pitfall 1 (Option A, the recommended remedy that keeps the TOKENS-04 allowlist narrow):

The current test at `src/tests/pwa-manifest.test.ts` line 25-26 reads:

```typescript
  it('has theme_color set to "#2563eb"', () => {
    expect(viteConfig).toContain('theme_color: "#2563eb"');
  });
```

The literal `#2563eb` here is a TEST FIXTURE asserting the contents of `vite.config.ts`, NOT a design literal. But the TOKENS-04 regex (Plan 04) cannot tell the difference and would flag both occurrences (the descriptive name string and the assertion string).

REPLACE that single `it(...)` block with this exact replacement:

```typescript
  it("has a hex theme_color set", () => {
    // Phase 22 (TOKENS-04 precondition): assertion shifted from a literal
    // hex match to a regex so this fixture file contains no design literals.
    // The PWA manifest theme_color is decoupled from src/ tokens — it lives
    // in vite.config.ts and may be updated independently in a later phase
    // alongside the paired <meta name="theme-color"> in index.html.
    expect(viteConfig).toMatch(/theme_color:\s*"#[0-9a-fA-F]{3,8}"/);
  });
```

Do NOT touch the other three tests in this file (`name`, `display`, icon entries). Do NOT add any other changes.

The test still proves "a hex theme_color is set" — strictly weaker than the previous assertion ("the hex is exactly #2563eb"), but the design intent of the test is "the manifest declares a theme color," and the exact hex is going to evolve. The semantic loss is acceptable per RESEARCH Open Question 1 recommendation.

After this change, `grep -nE "#[0-9a-fA-F]{3,8}\b" src/tests/pwa-manifest.test.ts` returns zero matches outside comments — and even the regex character class `[0-9a-fA-F]{3,8}` does NOT match the TOKENS-04 hex regex (`/#[0-9a-fA-F]{3,8}\b/`) because it has no leading `#` literal in the source — Vitest reads the regex as a JavaScript regex literal, not as a hex string.
  </action>
  <verify>
    <automated>npm test -- src/tests/pwa-manifest.test.ts --run</automated>
    <automated>node -e "const fs=require('fs');const t=fs.readFileSync('src/tests/pwa-manifest.test.ts','utf8');if(t.includes('#2563eb'))process.exit(1);if(!t.includes('toMatch(/theme_color'))process.exit(2);if(!t.includes('hex theme_color'))process.exit(3);console.log('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `src/tests/pwa-manifest.test.ts` contains the substring `toMatch(/theme_color`.
    - `src/tests/pwa-manifest.test.ts` does NOT contain the substring `#2563eb` anywhere (case-sensitive).
    - `src/tests/pwa-manifest.test.ts` does NOT contain the substring `#1d4ed8` anywhere.
    - The other three tests (`'has name set to "TPC Catalog"'`, `'has display set to "standalone"'`, `'has at least 2 icon entries'`) are untouched and still present.
    - `npm test -- src/tests/pwa-manifest.test.ts --run` exits 0 with all 4 tests passing.
    - `grep -E "#[0-9a-fA-F]{3,8}\b" src/tests/pwa-manifest.test.ts` returns no matches (this proves Plan 04's TOKENS-04 regex will not flag this file).
  </acceptance_criteria>
  <done>The pre-existing TOKENS-04 violation in the manifest test is cleared. Plan 04 can now run its filesystem regex sweep without false positives from this file.</done>
</task>

</tasks>

<verification>
After all three tasks complete:

```bash
# Files exist
ls src/ui/tokens/tokens.css src/ui/tokens/base.css src/ui/tokens/tokens.ts src/ui/tokens/index.ts

# Type-check passes
npx tsc -p tsconfig.app.json --noEmit

# Existing test suite still passes (no regressions)
npm test -- --run

# Build still succeeds (token files don't yet affect the build graph)
npm run build

# Lint still passes
npm run lint
```

All four checks must exit 0.
</verification>

<success_criteria>
- `src/ui/tokens/tokens.css`, `src/ui/tokens/base.css`, `src/ui/tokens/tokens.ts`, `src/ui/tokens/index.ts` exist and contain the prescribed content.
- Both CSS files are byte-equivalent to the handoff sources except for the prepended header comments.
- `tokens.ts` is byte-equivalent to the handoff source except for the rewritten header comment.
- `index.ts` exports the documented public API surface (does NOT yet export `initTheme` — Plan 03 adds it).
- `src/tests/pwa-manifest.test.ts` no longer contains literal `#2563eb`; the new regex assertion passes.
- `npm test --run`, `npm run build`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit` all exit 0.
- `grep -RnE "#[0-9a-fA-F]{3,8}\b" src/ | grep -v "src/ui/tokens/" | grep -v "_test_"` shows no NEW violations (the codebase had no other literals before this plan; this proves we didn't add any).
</success_criteria>

<output>
After completion, create `.planning/phases/22-foundation-tokens/22-01-SUMMARY.md`.
</output>
