---
phase: 22-foundation-tokens
plan: 04
type: execute
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - src/ui/__tests__/no-hardcoded-literals.test.ts
autonomous: true
requirements: [TOKENS-04]
tags: [tokens, vitest, ci-guard, regex-sweep]

must_haves:
  truths:
    - "Vitest test at src/ui/__tests__/no-hardcoded-literals.test.ts walks all .ts/.tsx/.css files under src/ recursively (D-15)"
    - "Test asserts no matches against three regexes: hex /#[0-9a-fA-F]{3,8}\\b/, OKLCH /\\boklch\\s*\\(/, font-family /font[-_]?family\\s*[:=]\\s*[\"']?[A-Za-z]/i (D-15)"
    - "Allowlist is narrow: only src/ui/tokens/** is excluded — tests in src/**/*.test.{ts,tsx} are NOT allowlisted (D-16)"
    - "Failure UX: aggregated structured list { file, line, snippet, pattern } printed via console.error before expect(violations).toEqual([]) hard-fails (D-17, D-18)"
    - "Test runs in CI under existing npm test step — hard-fail, no soft-warn snapshot (D-18)"
    - "Tailwind utility classes like text-blue-700 are NOT flagged (D-19) — they don't match any of the three regexes by design"
    - "On a clean tree (after Plans 01, 02, 03), the test passes — exits 0 with empty violations array"
  artifacts:
    - path: "src/ui/__tests__/no-hardcoded-literals.test.ts"
      provides: "TOKENS-04 build-time guard via Vitest filesystem regex sweep"
      contains: "describe('TOKENS-04"
      min_lines: 50
  key_links:
    - from: "no-hardcoded-literals.test.ts"
      to: "src/ filesystem walk"
      via: "fs.readdirSync(ROOT, { recursive: true, withFileTypes: true })"
      pattern: "readdirSync.*recursive"
    - from: "Three regex patterns"
      to: "Each line of every scanned file"
      via: "iteration: lines.forEach((text, i) => { for (const { name, re } of PATTERNS) ... })"
      pattern: "PATTERNS"
    - from: "Allowlist"
      to: "src/ui/tokens/**"
      via: "ALLOW_PREFIXES startsWith check on relative path"
      pattern: "ui.*tokens"
---

<objective>
Ship the TOKENS-04 build-time guard: a Vitest test that fails the CI build whenever any new TS/TSX/CSS file under `src/` introduces a hardcoded color hex, `oklch(...)` call, or font-family literal — with a narrow allowlist for `src/ui/tokens/**` (the canonical token files).

This plan runs LAST (Wave 3) because the test must NOT fail when it first runs. It depends on:
- Plan 01: removed the `#2563eb` literal in `src/tests/pwa-manifest.test.ts` (precondition).
- Plan 02: deleted the legacy `@theme { --color-accent: #2563eb }` block from `src/index.css`.
- Plan 03: introduced new files (`initTheme.ts`, `init-theme.test.ts`) — must be clean (no design literals).

After this plan lands, every future commit that introduces a hardcoded design literal anywhere in `src/` (outside `src/ui/tokens/**`) fails the existing `npm test` CI step.

Purpose: Lock the "single source of truth" property structurally so it cannot regress. Phase 26+ per-screen restyles will lean on this test to guarantee they don't accidentally re-introduce hex literals.

Output: 1 new file (`src/ui/__tests__/no-hardcoded-literals.test.ts`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/22-foundation-tokens/22-CONTEXT.md
@.planning/phases/22-foundation-tokens/22-RESEARCH.md
@.planning/phases/22-foundation-tokens/22-01-SUMMARY.md
@.planning/phases/22-foundation-tokens/22-02-SUMMARY.md
@.planning/phases/22-foundation-tokens/22-03-SUMMARY.md

@src/tests/pwa-manifest.test.ts
@src/tests/setup.ts

<interfaces>
<!-- The Vitest config (vite.config.ts) is already configured for jsdom env with src/tests/setup.ts as the setup file.
     The new test at src/ui/__tests__/no-hardcoded-literals.test.ts is picked up by Vitest's default discovery
     glob (`**/*.{test,spec}.{ts,tsx,js,jsx}`). No vite.config.ts changes needed.

     Node/Vitest globals available:
       - __dirname (Vitest compat layer; verified working in src/tests/pwa-manifest.test.ts)
       - fs.readdirSync with { recursive: true, withFileTypes: true } (Node 20+; project on 25.8.1)
       - Each Dirent has .parentPath in Node 20.18+ / .path in older 20.x; cast both for safety
-->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create the TOKENS-04 hardcoded-literals guard test</name>
  <files>src/ui/__tests__/no-hardcoded-literals.test.ts</files>
  <read_first>
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-15, D-16, D-17, D-18, D-19 govern every detail of this test)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pattern 6 contains a full reference implementation; Pitfall 1 documents the pwa-manifest test fix; Pitfall 5 covers verbatimModuleSyntax)
    - .planning/phases/22-foundation-tokens/22-VALIDATION.md (Wave 0 §no-hardcoded-literals.test.ts)
    - src/tests/pwa-manifest.test.ts (existing Vitest test using `__dirname` + readFileSync — confirms those APIs work in this Vitest env)
    - src/tests/setup.ts (the global setup file — does not need modification, but confirms fake-indexeddb / matchMedia mocks won't interfere with this filesystem-walking test)
    - tsconfig.app.json (verbatimModuleSyntax: true — type imports must use the `type` modifier; this test uses only runtime imports so no issue)
  </read_first>
  <action>
Per D-15 (three regex patterns + filesystem walk under src/), D-16 (narrow allowlist: src/ui/tokens/**), D-17 (aggregated structured failure output), D-18 (hard-fail, no snapshot), D-19 (Tailwind utility classes are not literals — handled implicitly by the regex specificity), and RESEARCH Pattern 6 (the reference implementation):

Create `src/ui/__tests__/no-hardcoded-literals.test.ts` with this exact content:

```typescript
/**
 * TOKENS-04: build-time guard against hardcoded design literals.
 *
 * Walks every .ts / .tsx / .css file under `src/` and asserts that none
 * contain a hex color, oklch(...) function call, or font-family literal
 * outside the canonical token files at `src/ui/tokens/**`.
 *
 * On failure: prints an aggregated structured list of every offender so
 * a developer touching multiple files sees all violations in one CI run.
 *
 * Locked decisions (Phase 22 CONTEXT.md):
 *   D-15: three regex patterns enumerated below.
 *   D-16: narrow allowlist — only src/ui/tokens/** is excluded. Tests in
 *         src/**\/*.test.{ts,tsx} are NOT allowlisted.
 *   D-17: aggregated { file, line, snippet, pattern } failure output.
 *   D-18: hard-fail in CI; no soft-warn snapshot.
 *   D-19: Tailwind utility classes like `text-blue-700` are NOT literals
 *         — they don't match any of these regexes by design.
 *
 * Performance: ~150 files, ~33k LOC. Sub-200ms on developer hardware.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep, relative } from "node:path";

const ROOT = join(__dirname, "..", ".."); // resolves to repo/src
const SCAN_EXT = /\.(ts|tsx|css)$/;

// Allowlist (D-16): canonical token files (verbatim handoff copies).
// Tests in src/**\/*.test.{ts,tsx} are NOT allowlisted by default per D-16;
// pwa-manifest.test.ts had its hex literal removed in Phase 22 Plan 01.
const ALLOW_PREFIXES: readonly string[] = [
  ["ui", "tokens"].join(sep), // src/ui/tokens/**
];

// D-15 patterns. Three regexes.
const PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  // Hex color: #abc, #abcd, #abcdef, #abcdef00 (3-8 hex digits with word boundary).
  { name: "hex", re: /#[0-9a-fA-F]{3,8}\b/ },
  // OKLCH function call: oklch( with optional whitespace.
  { name: "oklch", re: /\boklch\s*\(/ },
  // Font-family literal: covers CSS `font-family: Inter` and JSX/TS
  // object-form `fontFamily: "Inter"` / `fontFamily: 'Inter'`. The
  // [A-Za-z] anchor ensures we match a real family name token, not
  // `font-family: var(--font-ui)` (starts with `v` from `var`, but the
  // regex requires `["']?[A-Za-z]` — `var` starts with `v`, which IS
  // [A-Za-z], so it WOULD match). Mitigation: the canonical bridge file
  // (src/index.css) does NOT contain the literal substring `font-family`
  // anywhere; the @theme inline block uses `--font-display: var(--font-display)`
  // which has no `font-family` token to match. Verified manually.
  { name: "fontFamily", re: /font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i },
];

interface Dirent20Plus {
  isFile(): boolean;
  name: string;
  // Node 20.18+ uses `parentPath`; older Node 20 used `path`. Cast both.
  parentPath?: string;
  path?: string;
}

interface Violation {
  file: string;
  line: number;
  snippet: string;
  pattern: string;
}

function isAllowed(rel: string): boolean {
  return ALLOW_PREFIXES.some((p) => rel.startsWith(p));
}

describe("TOKENS-04: no hardcoded design literals", () => {
  it("all .ts/.tsx/.css files under src/ are clean", () => {
    const entries = readdirSync(ROOT, {
      recursive: true,
      withFileTypes: true,
    }) as unknown as Dirent20Plus[];

    const violations: Violation[] = [];

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!SCAN_EXT.test(ent.name)) continue;

      const dir = ent.parentPath ?? ent.path ?? "";
      const abs = join(dir, ent.name);
      const rel = relative(ROOT, abs);
      if (isAllowed(rel)) continue;

      const lines = readFileSync(abs, "utf8").split(/\r?\n/);
      lines.forEach((text, i) => {
        for (const { name, re } of PATTERNS) {
          if (re.test(text)) {
            violations.push({
              file: rel,
              line: i + 1,
              snippet: text.trim().slice(0, 120),
              pattern: name,
            });
          }
        }
      });
    }

    // D-17: print structured list on failure for scannable CI logs.
    if (violations.length) {
      // eslint-disable-next-line no-console
      console.error(
        "TOKENS-04 violations:\n" +
          violations
            .map((v) => `  ${v.file}:${v.line} [${v.pattern}] ${v.snippet}`)
            .join("\n"),
      );
    }

    // D-18: hard-fail. No soft-warn snapshot.
    expect(violations).toEqual([]);
  });
});
```

Critical specifics — read carefully:

1. **Path resolution.** `ROOT = join(__dirname, "..", "..")` — `__dirname` resolves to `<repo>/src/ui/__tests__`, two levels up is `<repo>/src`. Vitest's compat layer provides `__dirname` automatically (verified by `src/tests/pwa-manifest.test.ts` line 7 which already uses `__dirname` successfully).

2. **The `Dirent20Plus` cast.** Node 20.18+ exposes `Dirent.parentPath`; older Node 20 patches used `Dirent.path`. The cast `as unknown as Dirent20Plus[]` (with both fields optional) handles both. The runtime fallback `ent.parentPath ?? ent.path ?? ""` makes it robust without locking to a specific Node minor.

3. **Allowlist construction.** `["ui", "tokens"].join(sep)` produces `"ui\\tokens"` on Windows and `"ui/tokens"` on Unix. `relative(ROOT, abs)` returns paths in OS-native separators, so `startsWith` works on both platforms without normalization. **Do not** hardcode `"ui/tokens"` with a forward slash — that breaks on Windows CI.

4. **The fontFamily regex caveat.** RESEARCH Pattern 6 documents this. The regex `font[-_]?family\s*[:=]\s*["']?[A-Za-z]` matches:
   - CSS: `font-family: Inter` ✓
   - CSS: `font-family: "Inter"` ✓
   - TS object: `fontFamily: 'Inter'` ✓
   - TS object: `fontFamily: "Inter"` ✓
   It does NOT match `font-family: var(--font-ui)` because `var(...)` does start with `v` which IS `[A-Za-z]` — meaning the regex WOULD match `font-family: var(--font-ui)`. **Mitigation:** verified the post-Plan-02 `src/index.css` does NOT contain the literal `font-family` token anywhere (the `@theme inline` block uses `--font-display: var(--font-display)`, which has no `font-family` substring). If a future file uses `font-family: var(--...)` in CSS or `fontFamily: "var(--...)"` in TS, an exception will be needed — but the codebase is currently clean.

5. **Tailwind utility classes.** Per D-19, classes like `text-blue-700` are NOT literals. Verify by inspection: the hex regex requires a `#` prefix (utility classes have no `#`); the oklch regex requires `oklch(` (utility classes don't); the fontFamily regex requires `font-family` or `fontFamily` (utility classes use `font-` short prefix only — `font-display`, `font-mono` — and the regex `font[-_]?family` requires the full word `family`, which never appears). All three patterns by construction skip Tailwind utilities.

6. **No `import type` needed.** Per RESEARCH Pitfall 5 + tsconfig.app.json `verbatimModuleSyntax: true`: this file uses only runtime imports (`describe`, `it`, `expect`, `readdirSync`, `readFileSync`, `join`, `sep`, `relative`). The `Dirent20Plus` interface is declared inline (not imported), so no `import type` issue. The `Violation` interface is declared inline as well.

7. **No new dependencies.** Per RESEARCH §"Don't Hand-Roll": uses only Node stdlib + Vitest globals + Node fs. No `fast-glob`, no `picomatch`, no `culori`. The total LOC is ~95 including comments — fits in one focused file.

8. **The test uses `it()` (singular).** A single test calling `expect(violations).toEqual([])` per D-17 — not multiple tests one per pattern. The aggregated failure list is the entire UX.

9. **Runtime cost.** ~150 files × ~250 lines avg × 3 regexes = ~110k regex evaluations. RESEARCH Pattern 6 §Performance benchmarks this at sub-200ms on developer hardware.
  </action>
  <verify>
    <automated>npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run</automated>
    <automated>npx tsc -p tsconfig.app.json --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `src/ui/__tests__/no-hardcoded-literals.test.ts` exists.
    - File contains the literal substring `describe("TOKENS-04: no hardcoded design literals"`.
    - File contains the three regex literals (verifiable via grep): `/#[0-9a-fA-F]{3,8}\b/`, `/\boklch\s*\(/`, `/font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i`.
    - File contains `readdirSync(ROOT, {` with `recursive: true` and `withFileTypes: true`.
    - File contains the allowlist construction `["ui", "tokens"].join(sep)`.
    - File contains the structured failure output: `console.error("TOKENS-04 violations:\n"` and `expect(violations).toEqual([])`.
    - File contains the Dirent compatibility shim referencing both `parentPath` and `path`.
    - `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run` exits 0 (the test PASSES on the clean tree — zero violations).
    - `npx tsc -p tsconfig.app.json --noEmit` exits 0 (file type-checks under verbatimModuleSyntax).
    - Manual verification: temporarily insert a literal `#abcdef` into a non-allowlisted file (e.g., add `// test #abcdef` as a comment to `src/main.tsx`), re-run `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run`, confirm the test fails with a structured violation report listing the file/line/snippet/pattern. **Then revert the temporary change.** This proves the test actually catches violations and isn't passing trivially.
  </acceptance_criteria>
  <done>The TOKENS-04 hard-fail guard is live in CI. Future commits introducing a hex / oklch / font-family literal anywhere outside `src/ui/tokens/**` fail the build at `npm test`. Phase 22 success criterion #3 ("CI fails on a hex / oklch / font-family literal in src/") is structurally enforced.</done>
</task>

</tasks>

<verification>
After the task completes:

```bash
# The TOKENS-04 test passes on a clean tree
npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run

# Full test suite passes (Plans 01 + 02 + 03 + 04 all green)
npm test -- --run

# Type-check passes
npx tsc -p tsconfig.app.json --noEmit

# Production build succeeds
npm run build

# Lint passes
npm run lint
```

All five must exit 0.

**Manual sanity check (one-time, then revert):**

1. Add `// fake hex #abcdef for test` as a comment to `src/main.tsx` line 1.
2. Run `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run`.
3. Confirm: test fails, `console.error` reports `main.tsx:1 [hex] // fake hex #abcdef for test`.
4. Revert the temporary edit in `src/main.tsx`.
5. Re-run; test passes.

This confirms the regex actually fires and the failure UX renders correctly.
</verification>

<success_criteria>
- `src/ui/__tests__/no-hardcoded-literals.test.ts` exists with the spec'd content.
- `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts --run` exits 0 on the clean tree (zero violations).
- Manual sanity check: inserting a single literal anywhere outside `src/ui/tokens/**` causes the test to fail with structured output.
- The full Phase 22 test suite (`npm test -- --run`), build (`npm run build`), type-check (`npx tsc -p tsconfig.app.json --noEmit`), and lint (`npm run lint`) all exit 0.
- The CI's existing `npm test` step now enforces TOKENS-04 — Phase 22 success criterion #3 is structurally guaranteed for all future commits.
</success_criteria>

<output>
After completion, create `.planning/phases/22-foundation-tokens/22-04-SUMMARY.md`.
</output>
