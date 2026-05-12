/// <reference types="node" />
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

// Narrow per-file allowlist (D-16 escape hatch). The guard test file itself
// must contain the three regex source patterns it scans for — `oklch(`,
// `#abc`, and `font-family:` — inside its regex definitions and comments.
// This is the canonical "the file IS the fixture" exception D-16 anticipates.
// Scope is single-file: only this exact path is excluded, not all of __tests__.
const ALLOW_FILES: readonly string[] = [
  ["ui", "__tests__", "no-hardcoded-literals.test.ts"].join(sep),
  // The Phase 30 contrast test parses tokens.css and comments reference
  // `oklch(...)` literals inline. Same "the file IS the fixture" escape
  // hatch as the guard test itself (D-16). Single-file scope.
  ["ui", "__tests__", "contrast.test.ts"].join(sep),
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
  if (ALLOW_FILES.includes(rel)) return true;
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
