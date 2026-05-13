---
phase: 22-foundation-tokens
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/index.css
  - index.html
autonomous: true
requirements: [TOKENS-01, TOKENS-02]
tags: [tokens, tailwind-v4, dark-mode, fouc]

must_haves:
  truths:
    - "src/index.css imports the new tokens.css and base.css from src/ui/tokens/ (Plan 01 outputs)"
    - "src/index.css declares @custom-variant dark (&:where(.tpc-dark, .tpc-dark *)) so existing dark: utilities key off .tpc-dark class (D-09)"
    - "src/index.css contains @theme inline { ... } bridging all 21 color vars + 3 radii + 3 fonts as Tailwind utilities (D-12)"
    - "@theme inline (NOT @theme) is used so .tpc-dark-scoped overrides reach utilities (RESEARCH Pattern 1, Pitfall: bridge resolves at use site, not definition site)"
    - "The @theme block lives in src/index.css (the entry file), NOT inside imported tokens.css (RESEARCH Pitfall 3 — @theme is silently ignored in imports)"
    - "Existing @keyframes slideUp animation is preserved verbatim"
    - "<html> tag carries class=\"tpc\" literally (D-04, RESEARCH Pitfall 4 — required to avoid pre-React-mount FOUC)"
    - "<head> contains a synchronous inline <script> ≤5 lines that adds .tpc-dark when matchMedia('(prefers-color-scheme: dark)').matches, runs before first paint (D-05, D-07)"
    - "<meta name=\"theme-color\"> is paired: light (#0089b4) default + dark (#22b5e1) with media=(prefers-color-scheme: dark) (D-14)"
    - "Phase 25's ThemeProvider can later supersede this without touching index.html — the inline script is system-pref-only and idempotent (D-08)"
  artifacts:
    - path: "src/index.css"
      provides: "Tailwind entry CSS with token imports, @custom-variant dark, full @theme inline bridge, preserved slideUp keyframes"
      contains: "@theme inline {"
    - path: "index.html"
      provides: "HTML shell with .tpc on <html>, pre-paint dark-mode bootstrap script, paired theme-color meta"
      contains: 'class="tpc"'
  key_links:
    - from: "src/index.css"
      to: "src/ui/tokens/tokens.css"
      via: "@import"
      pattern: "@import [\"']\\./ui/tokens/tokens\\.css[\"']"
    - from: "src/index.css"
      to: "src/ui/tokens/base.css"
      via: "@import"
      pattern: "@import [\"']\\./ui/tokens/base\\.css[\"']"
    - from: "src/index.css"
      to: ".tpc / .tpc-dark CSS vars"
      via: "@theme inline { --color-bg: var(--bg); ... }"
      pattern: "--color-bg:\\s*var\\(--bg\\)"
    - from: "index.html <html>"
      to: ".tpc styling cascade"
      via: 'class="tpc" attribute on <html> element'
      pattern: 'class=\"tpc\"'
    - from: "index.html <script>"
      to: "html.tpc-dark"
      via: "matchMedia → classList.add('tpc-dark')"
      pattern: "prefers-color-scheme: dark"
---

<objective>
Wire the canonical token files (Plan 01 outputs) into the live build graph and rewire dark mode to be class-based instead of media-query-based. After this plan lands:
- All 282 existing `dark:` Tailwind utilities key off `.tpc-dark` class on `<html>`, with **zero edits to component files**.
- New bridge utilities (`bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `text-accent`, `rounded-md`, `font-display`, etc.) become available for Phase 24+ consumers.
- Dark-mode users hitting cold load see no FOUC (the inline pre-paint script applies `.tpc-dark` synchronously before first paint).
- Browser chrome theme color matches the page accent in both light and dark modes.

This plan is the "swap" plan — the moment styling actually changes. Plan 03 (parallel) handles the runtime live-update listener.

Purpose: Make the token system live in the build pipeline. Without this plan, Plan 01's files are inert.

Output: 2 modified files (`src/index.css`, `index.html`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/22-foundation-tokens/22-CONTEXT.md
@.planning/phases/22-foundation-tokens/22-RESEARCH.md
@.planning/phases/22-foundation-tokens/22-01-SUMMARY.md

@src/index.css
@index.html

<interfaces>
<!-- Tokens this plan bridges. Names mapped 1:1 from the .tpc / .tpc-dark CSS-var declarations
     installed by Plan 01 in src/ui/tokens/tokens.css. -->

CSS variables declared on .tpc (Plan 01 / docs/design-handoff/tpc-unified-tokens.css):
  Surfaces:  --bg, --bg-2, --bg-3
  Rules:     --rule, --rule-2
  Ink:       --ink, --ink-2, --ink-3, --ink-4
  Accent:    --accent, --accent-hover, --accent-wash, --accent-ink
  Sand:      --sand, --sand-wash
  Semantic:  --ok, --ok-wash, --warn, --warn-wash, --err, --err-wash
  Type:      --font-display, --font-ui, --font-mono
  Radii:     --radius-sm, --radius, --radius-lg

Tailwind utility namespacing (the bridge maps token vars into these):
  --color-* → bg-*, text-*, border-*, etc.
  --radius-* → rounded-*  (sm, md=default, lg)
  --font-*  → font-*      (display, ui, mono)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Replace src/index.css with token imports + @custom-variant + @theme inline bridge</name>
  <files>src/index.css</files>
  <read_first>
    - src/index.css (current file — 17 lines; the existing @theme block on lines 3–6 and @keyframes slideUp on lines 8–17)
    - src/ui/tokens/tokens.css (created by Plan 01 — sanity-check the var names exist)
    - src/ui/tokens/base.css (created by Plan 01 — sanity-check it loads cleanly)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-09, D-10, D-11, D-12, D-13 + Claude's Discretion §1 govern this task)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pattern 1 for `@theme inline`, Pattern 2 for `@custom-variant`, Pitfall 3 for "@theme in imports is ignored")
  </read_first>
  <action>
Per D-09 (custom-variant), D-12 (full bridge with all 21 color vars + 3 radii + 3 fonts), Claude's Discretion §1 (import order), and RESEARCH Pattern 1 (use `@theme inline`):

REPLACE the entire contents of `src/index.css` with this exact text:

```css
@import "tailwindcss";
@import "./ui/tokens/tokens.css";
@import "./ui/tokens/base.css";

/* Class-based dark mode. Drives the existing dark: Tailwind utilities off
   the .tpc-dark class instead of the prefers-color-scheme media query.
   :where() keeps specificity at 0,0,0 so component-level overrides still
   work. The descendant clause (.tpc-dark *) is required so children of
   <html class="tpc tpc-dark"> match the variant. */
@custom-variant dark (&:where(.tpc-dark, .tpc-dark *));

/* Token bridge. Maps the .tpc / .tpc-dark CSS variables into Tailwind v4's
   theme namespace so utilities like bg-bg-2, text-ink-3, bg-warn-wash,
   rounded-md, font-display resolve to the active token at the *use site*.
   The `inline` modifier is REQUIRED — without it, Tailwind would emit
   `background-color: var(--color-bg)` and the .tpc-dark override on --bg
   would never reach the utility. With `inline`, Tailwind emits
   `background-color: var(--bg)` directly, so the cascade resolves correctly.
   `@theme` MUST live in this entry file — Tailwind v4 silently ignores
   @theme inside @import-ed CSS files. */
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

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
```

Critical specifics:
- Import order is **strict**: `tailwindcss` → `./ui/tokens/tokens.css` → `./ui/tokens/base.css` → `@custom-variant dark (...)` → `@theme inline {}` → `@keyframes`. The custom-variant must come before any utility selector emission; the `@theme inline` block must be in this entry file (per Pitfall 3); the keyframes are preserved verbatim from the previous file.
- `@theme inline` is the literal directive; do not use `@theme` without `inline` (per RESEARCH Pattern 1 and Anti-Patterns §1).
- The `@custom-variant dark (...)` line uses `&:where(.tpc-dark, .tpc-dark *)` — note the colon-where with two arguments separated by comma inside one set of parentheses (per RESEARCH Pattern 2 and Anti-Patterns §6: forgetting `:where()` raises specificity and breaks overrides).
- Comments above each block explain the rationale so future maintainers don't accidentally regress these decisions.
- Old `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` block is **deleted** — those values now flow from `--accent` / `--accent-hover` declared in `tokens.css`.
- This file's content does NOT match the TOKENS-04 hex regex (no `#XXXXXX` strings — Plan 04's regex is `/#[0-9a-fA-F]{3,8}\b/` and finds no matches here). It does match the TOKENS-04 font-family regex on the `--font-display: var(--font-display)` line? **NO** — the regex is `/font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i`; the value `var(--font-display)` starts with `v` from `var`, NOT a quoted family or letter from a family name like `"Inter"`. Verify with `grep -nE "font[-_]?family" src/index.css | grep -E "[\"']?[A-Za-z]"` — should match nothing (the string `font-family` itself doesn't appear in this file).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('src/index.css','utf8');const need=['@import \"tailwindcss\"','@import \"./ui/tokens/tokens.css\"','@import \"./ui/tokens/base.css\"','@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))','@theme inline {','--color-bg:','--color-bg-2:','--color-bg-3:','--color-rule:','--color-rule-2:','--color-ink:','--color-ink-2:','--color-ink-3:','--color-ink-4:','--color-accent:','--color-accent-hover:','--color-accent-wash:','--color-accent-ink:','--color-sand:','--color-sand-wash:','--color-ok:','--color-ok-wash:','--color-warn:','--color-warn-wash:','--color-err:','--color-err-wash:','--radius-sm:','--radius:','--radius-lg:','--font-display:','--font-ui:','--font-mono:','@keyframes slideUp'];for(const s of need){if(!c.includes(s)){console.error('MISSING: '+s);process.exit(1)}}if(c.includes('#2563eb')||c.includes('#1d4ed8')){console.error('LEGACY HEX STILL PRESENT');process.exit(2)}console.log('ok')"</automated>
    <automated>npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `src/index.css` contains the literal substring `@import "tailwindcss"`.
    - `src/index.css` contains the literal substring `@import "./ui/tokens/tokens.css"`.
    - `src/index.css` contains the literal substring `@import "./ui/tokens/base.css"`.
    - `src/index.css` contains the literal substring `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))`.
    - `src/index.css` contains the literal substring `@theme inline {` (with `inline` — not bare `@theme {`).
    - `src/index.css` contains all 21 color bridges: `--color-bg`, `--color-bg-2`, `--color-bg-3`, `--color-rule`, `--color-rule-2`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-ink-4`, `--color-accent`, `--color-accent-hover`, `--color-accent-wash`, `--color-accent-ink`, `--color-sand`, `--color-sand-wash`, `--color-ok`, `--color-ok-wash`, `--color-warn`, `--color-warn-wash`, `--color-err`, `--color-err-wash`.
    - `src/index.css` contains all 3 radii bridges: `--radius-sm`, `--radius:`, `--radius-lg`.
    - `src/index.css` contains all 3 font bridges: `--font-display`, `--font-ui`, `--font-mono`.
    - `src/index.css` contains `@keyframes slideUp` (preserved verbatim).
    - `src/index.css` does NOT contain `#2563eb` or `#1d4ed8` (legacy hex deleted).
    - `npm run build` exits 0 (Vite + Tailwind v4 resolve the bridge cleanly with no warnings about missing tokens).
  </acceptance_criteria>
  <done>Token bridge live; existing 282 dark: utilities now key off .tpc-dark; new bridge utilities (bg-bg-2, text-ink-3, font-display, etc.) generated and ready for Phase 24+ consumption.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Update index.html with .tpc class, pre-paint script, paired theme-color meta</name>
  <files>index.html</files>
  <read_first>
    - index.html (current file — 17 lines; line 2 has `<html lang="en">` without class, line 6 has the single hex theme-color meta)
    - src/ui/tokens/tokens.css (Plan 01 — confirms the .tpc rule is what applies background/color/font)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-04, D-05, D-07, D-08, D-14 + Claude's Discretion §2 + §5 govern this task)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pattern 3 for the script, Pattern 5 for the meta pair, Pitfall 4 for why class="tpc" must be a literal HTML attribute)
  </read_first>
  <action>
Per D-04 (literal class on html), D-05 (≤5 line inline pre-paint script), D-08 (system-pref-only — no localStorage), D-14 (paired theme-color), and RESEARCH Patterns 3 + 5 (script + meta derivation):

REPLACE the entire contents of `index.html` with this exact text:

```html
<!DOCTYPE html>
<html lang="en" class="tpc">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <!-- Pre-paint dark-mode bootstrap. ≤5 lines, synchronous and blocking
       so it cannot introduce FOUC. Phase 22 is system-pref-only; Phase 25
       will extend this to read a user preference. Allowlisted for
       TOKENS-04 because index.html is outside src/ and is not scanned. -->
  <script>
    try { if (matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.add('tpc-dark'); } catch (_) {}
  </script>
  <!-- Paired <meta name="theme-color">. Modern browsers select the matching
       one; legacy browsers fall back to the default (light). The hex values
       are sRGB conversions of the --accent OKLCH tokens:
         light --accent  oklch(0.58 0.13 225) -> #0089b4
         dark  --accent  oklch(0.72 0.13 225) -> #22b5e1
       Update both alongside any change to --accent in tokens.css. These
       two static hex values are the only design literals in index.html
       and are not scanned by TOKENS-04 (file is outside src/). -->
  <meta name="theme-color" content="#0089b4" />
  <meta name="theme-color" content="#22b5e1" media="(prefers-color-scheme: dark)" />
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

Critical specifics:
- `<html lang="en" class="tpc">` — the class is a literal HTML attribute, not added by JS. Per RESEARCH Pitfall 4, adding it via JS would FOUC the initial paint into Times-New-Roman.
- The inline `<script>` is a **classical** script tag (no `defer`, no `async`, no `type="module"`). Per RESEARCH Anti-Pattern §3, those modes run after first paint and would FOUC the dark mode flash. The classical inline tag is the only correct form.
- The script is exactly 3 lines of code wrapped in a try/catch (5 lines total counting the `<script>` and `</script>` tags), well within the ≤5-line constraint of D-05.
- The script uses `classList.add('tpc-dark')` — NOT `className = 'tpc-dark'` (which would clobber `tpc`).
- The script does NOT read localStorage, does NOT touch Supabase, does NOT ship a settings UI. Per D-08, those are explicitly Phase 25's deliverables.
- Two `<meta name="theme-color">` tags: light (default, no `media` attribute) goes FIRST; dark (with `media="(prefers-color-scheme: dark)"`) goes SECOND. The order matters for legacy-browser fallback (per RESEARCH Pattern 5).
- The hex values `#0089b4` and `#22b5e1` are the closest sRGB representations of the light and dark `--accent` OKLCH tokens — derivation is documented in the comment so future readers can re-compute when tokens evolve. Per Claude's Discretion §2.
- The old single `<meta name="theme-color" content="#2563eb" />` line is REPLACED, not augmented — there is exactly one default + one dark meta after this change.
- Per Claude's Discretion §5 + RESEARCH Open Question 3: no allowlist mechanism is needed for the inline script — `index.html` is outside `src/` and not scanned by TOKENS-04 (the test root is `src/`). Documented in the comment.

Do NOT touch `vite.config.ts`'s `manifest.theme_color` — that is the PWA manifest color (separate concern, applies to the installed-PWA chrome) and is intentionally out of Phase 22 scope per RESEARCH Pattern 5 §"PWA manifest interaction".
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const need=['<html lang=\"en\" class=\"tpc\">','prefers-color-scheme: dark','classList.add(\\'tpc-dark\\')','<meta name=\"theme-color\" content=\"#0089b4\"','<meta name=\"theme-color\" content=\"#22b5e1\" media=\"(prefers-color-scheme: dark)\"','<title>TPC Catalog</title>','<script type=\"module\" src=\"/src/main.tsx\">'];for(const s of need){if(!h.includes(s)){console.error('MISSING: '+s);process.exit(1)}}if(h.includes('content=\"#2563eb\"')){console.error('LEGACY THEME-COLOR STILL PRESENT');process.exit(2)}if(h.match(/<meta name=\"theme-color\"/g).length!==2){console.error('EXPECTED EXACTLY 2 theme-color meta tags');process.exit(3)}console.log('ok')"</automated>
    <automated>npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `index.html` line 2 contains the literal substring `<html lang="en" class="tpc">`.
    - `index.html` contains an inline `<script>` block that calls `matchMedia('(prefers-color-scheme: dark)').matches` and `document.documentElement.classList.add('tpc-dark')`.
    - The inline script is wrapped in `try { ... } catch (_) {}`.
    - The inline script does NOT use `defer`, `async`, or `type="module"`.
    - `index.html` contains exactly TWO `<meta name="theme-color">` tags.
    - First `<meta name="theme-color">` has `content="#0089b4"` and NO `media` attribute (default light).
    - Second `<meta name="theme-color">` has `content="#22b5e1"` and `media="(prefers-color-scheme: dark)"`.
    - `index.html` does NOT contain `content="#2563eb"` (legacy theme-color removed).
    - `index.html` still contains `<title>TPC Catalog</title>`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`, the apple-mobile-web-app-* metas, and `<script type="module" src="/src/main.tsx">`.
    - `npm run build` exits 0 (Vite parses the HTML successfully, no plugin errors).
  </acceptance_criteria>
  <done>HTML shell carries .tpc unconditionally; pre-paint script runs synchronously before first paint; browser chrome theme color matches the page accent in both modes. FOUC is impossible on cold load with system dark mode.</done>
</task>

</tasks>

<verification>
After both tasks complete, run from the project root:

```bash
# Build is clean
npm run build

# Lint is clean (eslint doesn't lint CSS or HTML, but ensure no JS regression)
npm run lint

# Existing tests still pass — critically, pwa-manifest.test.ts (modified in Plan 01) still green
npm test -- --run

# Manual smoke (the only correctness signal for the bridge — TOKENS-01b in VALIDATION.md):
# 1. `npm run dev`
# 2. Open http://localhost:5173 in browser
# 3. DevTools > Elements > select <html>; confirm class="tpc"
# 4. DevTools > Console: `getComputedStyle(document.body).backgroundColor`
#    → should resolve to the oklch (or rgb) value of --bg from tokens.css
# 5. DevTools > Sources: confirm src/index.css → tokens.css → base.css are all loaded
# 6. Toggle OS dark mode; observe <html> gains/loses .tpc-dark class
#    (note: live flip on dev mode requires Plan 03's listener — without it, only reload triggers the change here)
```
</verification>

<success_criteria>
- `src/index.css` contains the full bridge per the action spec; the legacy 6-line `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` block is gone.
- `index.html` carries `class="tpc"` on `<html>`, has the pre-paint script in `<head>`, and ships the paired theme-color meta.
- `npm run build` succeeds (Vite + Tailwind v4 plugin resolve the bridge with no warnings).
- `npm test --run` continues to pass — no regression in the existing test suite.
- Manual smoke (per VALIDATION.md, the only reliable signal for `@theme inline` + `@custom-variant`): walking 5 routes (Sessions / Recording / Review / Settings / AccountManagement) in both light and dark mode shows no broken styling — every existing `dark:` Tailwind utility still renders correctly because they now key off `.tpc-dark`.
- New bridge utilities (e.g., `<div className="bg-bg-2 text-ink-3">`) work in DevTools manual probe — computed styles resolve to oklch values from `.tpc` / `.tpc-dark` cascade.
</success_criteria>

<output>
After completion, create `.planning/phases/22-foundation-tokens/22-02-SUMMARY.md`.
</output>
