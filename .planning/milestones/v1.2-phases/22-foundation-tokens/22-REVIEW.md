---
phase: 22-foundation-tokens
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - index.html
  - src/index.css
  - src/main.tsx
  - src/tests/pwa-manifest.test.ts
  - src/ui/__tests__/init-theme.test.ts
  - src/ui/__tests__/no-hardcoded-literals.test.ts
  - src/ui/tokens/base.css
  - src/ui/tokens/index.ts
  - src/ui/tokens/initTheme.ts
  - src/ui/tokens/tokens.css
  - src/ui/tokens/tokens.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 22 swaps Tailwind v4's default `@theme` for the unified TPC token set. The
implementation cleanly establishes a runtime token cascade (`.tpc` /
`.tpc-dark`), a build-time hardcoded-literal guard (TOKENS-04), and a
system-pref-only theme listener with HMR teardown. Documentation is unusually
strong — the intentional CSS/TS mirror divergence, the `@theme inline`
requirement, and the pre-paint script's tradeoffs are all called out at the
exact files where they could mislead a reader.

No security vulnerabilities. No correctness bugs that affect the Phase 22
contract. The two warnings concern (1) a latent allowlist-prefix bug in the
TOKENS-04 guard that admits future false negatives, and (2) a 3-way
inconsistency between PWA `theme_color` (`#2563eb`) and the new `<meta
name="theme-color">` pair (`#0089b4` / `#22b5e1`). The five info items are
maintenance/robustness suggestions.

---

## Warnings

### WR-01: TOKENS-04 allowlist prefix check is segment-unsafe

**File:** `src/ui/__tests__/no-hardcoded-literals.test.ts:33-44, 79-82`

**Issue:** `isAllowed()` uses `rel.startsWith(p)` where `p` is `"ui" + sep +
"tokens"` with no trailing separator. A future file at `src/ui/tokens-extra/x.ts`,
`src/ui/tokensx.ts`, or `src/ui/tokens.bak.ts` would be silently allowlisted
because each `rel` starts with the literal string `ui<sep>tokens` (or
`ui<sep>tokens` followed by non-separator characters like `-extra`, `x`,
`.bak`). That admits a class of false negatives where a sibling-of-tokens file
with hardcoded design literals slips past the guard.

This is a latent defect, not a current one — no such files exist today — but
TOKENS-04's value depends on its prefix check actually scoping to
`src/ui/tokens/`.

**Fix:** Require the prefix to be a complete path segment.

```ts
const ALLOW_PREFIXES: readonly string[] = [
  ["ui", "tokens", ""].join(sep), // -> "ui/tokens/" or "ui\tokens\"
];

function isAllowed(rel: string): boolean {
  if (ALLOW_FILES.includes(rel)) return true;
  // Match the directory itself (no trailing sep on rel) OR descendants.
  return ALLOW_PREFIXES.some(
    (p) => rel === p.slice(0, -1) || rel.startsWith(p),
  );
}
```

### WR-02: PWA `theme_color` inconsistent with new accent token

**File:** `vite.config.ts:23` (out of scope but referenced from `src/tests/pwa-manifest.test.ts`)

**Issue:** Phase 22 introduces a paired `<meta name="theme-color">` in
`index.html` carrying the new accent values (`#0089b4` light / `#22b5e1` dark,
documented as sRGB conversions of the `--accent` OKLCH tokens). The PWA
manifest's `theme_color` in `vite.config.ts` is still `#2563eb` (Tailwind blue
600 from a prior phase). Once a user installs the PWA, the OS chrome
(taskbar, splash, app switcher) will render `#2563eb` while the in-app meta
pair drives a different chrome color in standalone mode. Phase 22's
DISCUSSION-LOG / phase context acknowledges this is a deferred decision, but
the inconsistency is real and the fixture-test relaxation
(`pwa-manifest.test.ts:31`) means no test will catch it drifting further.

**Fix:** Either update the manifest `theme_color` in `vite.config.ts` to
`#0089b4` (matching the light-mode meta) in this phase, or open an explicit
follow-up ticket and reference it from `pwa-manifest.test.ts:26-30` so the
deferred state is auditable. If kept as-is, add a regression assertion that
the manifest hex matches one of the accent meta hexes:

```ts
it("manifest theme_color matches an index.html <meta name=theme-color>", () => {
  const indexHtml = readFileSync(resolve(__dirname, "../../index.html"), "utf-8");
  const metas = [...indexHtml.matchAll(/theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/g)]
    .map((m) => m[1]);
  const manifest = viteConfig.match(/theme_color:\s*"(#[0-9a-fA-F]{3,8})"/)?.[1];
  expect(metas).toContain(manifest);
});
```

---

## Info

### IN-01: Hex-color regex permits invalid 5- and 7-digit lengths

**File:** `src/ui/__tests__/no-hardcoded-literals.test.ts:49`

**Issue:** `/#[0-9a-fA-F]{3,8}\b/` matches lengths 3-8, but valid CSS hex
colors are only 3, 4, 6, or 8. The current pattern can also match a 4- or
8-character GitHub issue ref (`#1234`, `#12345abc`) inside a JSDoc comment as
if it were a color. False positives in this direction are safe (they just
fail the build pointing at non-issues), but a stricter `{3,4}|{6}|{8}`
alternation more accurately models CSS hex syntax.

**Fix:** `/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/` if you
want exact-CSS-hex matching. Optional — current behavior is correct enough.

### IN-02: `font[-_]?family` regex would match `font-family: var(...)` if not for an external invariant

**File:** `src/ui/__tests__/no-hardcoded-literals.test.ts:52-61`

**Issue:** The regex `/font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i` matches
`font-family: var(--font-ui)` because `["']?` is optional and `[A-Za-z]` is
satisfied by `v` from `var`. The guard's correctness depends on
`src/index.css` (the only non-allowlisted CSS file with `@theme`) not
containing the literal substring `font-family`. This invariant is currently
true and called out in the comment at lines 55-60, but it's enforced by
convention — a future contributor adding `font-family: var(--font-ui)` to
`src/index.css` would trigger a confusing failure ("font-family: var(...)" is
not a hardcoded literal).

**Fix:** Tighten the regex to require an actual non-`var(...)` family token:

```ts
{ name: "fontFamily", re: /font[-_]?family\s*[:=]\s*["'][A-Za-z]/i },
```

This requires a quote, which `var(--x)` lacks. Keeps `fontFamily: "Inter"` /
`font-family: 'Inter'` as violations and lets `font-family: var(--font-ui)`
pass cleanly. Optional refinement; current logic works for current code.

### IN-03: `radii` TS export uses `md` key but CSS uses unsuffixed `--radius`

**File:** `src/ui/tokens/tokens.ts:85-89`, `src/ui/tokens/tokens.css:73-75`

**Issue:** The CSS variable for the medium radius is `--radius` (no suffix),
but the TS export names the same value `radii.md`. A consumer reading both
files (e.g., the future dashboard repo) has to discover this naming offset
from the manual mirror. The `@theme inline` block in `src/index.css` further
confuses things by re-emitting `--radius: var(--radius);`, which is correct
but reads like a typo to a first-time reader.

**Fix:** Consider adding a one-line note in `tokens.ts` above `radii`:

```ts
// `md` here corresponds to CSS `--radius` (the unsuffixed default radius).
// `sm` -> `--radius-sm`, `lg` -> `--radius-lg`.
export const radii = { sm: 4, md: 6, lg: 10 } as const;
```

Optional documentation polish.

### IN-04: `init-theme.test.ts` relies on setup.ts mock surviving `window.matchMedia = undefined`

**File:** `src/ui/__tests__/init-theme.test.ts:103-113, 41-51`

**Issue:** The "no matchMedia available" test sets `window.matchMedia =
undefined`. The afterEach restores from `originalMatchMedia` which was saved
in beforeEach from the `setup.ts` global polyfill — so restoration works
today. But if the test order changes such that this test runs first
(before any other writes), or if a future test forgets to set its own
matchMedia, leaked state could mask a regression. The current
restore-only-if-truthy pattern (`if (originalMatchMedia)`) is fragile.

**Fix:** Restore unconditionally, including when `originalMatchMedia` is
`undefined`, so a true "no matchMedia" environment is faithfully reproduced
in subsequent tests:

```ts
afterEach(() => {
  document.documentElement.classList.remove("tpc-dark");
  // Restore even when undefined — that IS the original state.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});
```

Or simply use `vi.stubGlobal` / `vi.unstubAllGlobals()` for clean per-test
isolation.

### IN-05: Pre-paint inline script lacks `defer` semantics nuance — fine for Phase 22 but flag for Phase 25

**File:** `index.html:10-13`

**Issue:** The synchronous inline script is correct for no-FOUC pre-paint
on cold load. The empty `catch (_) {}` swallows any error from
`matchMedia(...)` invocation in environments where it throws (very old
WebViews). This is intentional and documented at line 6-9. No fix needed for
Phase 22, but Phase 25's ThemeProvider rewrite should preserve the same
guard semantics — silent failure here is the correct behavior because we
must never block first paint, but it makes diagnosing dark-mode bugs in
exotic environments hard. Consider logging via `try { matchMedia(...) }
catch (e) { window.__tpcThemeBootstrapError = e; }` so a downstream tool
can surface it without breaking the pre-paint contract.

**Fix:** Optional. Out of Phase 22 scope; record in Phase 25 planning.

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
