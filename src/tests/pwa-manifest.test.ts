import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("PWA manifest config", () => {
  const viteConfig = readFileSync(
    resolve(__dirname, "../../vite.config.ts"),
    "utf-8",
  );

  it('has name set to "TPC Catalog"', () => {
    expect(viteConfig).toContain('name: "TPC Catalog"');
  });

  it('has display set to "standalone"', () => {
    expect(viteConfig).toContain('display: "standalone"');
  });

  it("has at least 2 icon entries", () => {
    const iconMatches = viteConfig.match(/src:\s*"icons\//g);
    expect(iconMatches).not.toBeNull();
    expect(iconMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("has a hex theme_color set", () => {
    // Phase 22 (TOKENS-04 precondition): assertion shifted from a literal
    // hex match to a regex so this fixture file contains no design literals.
    // The PWA manifest theme_color is decoupled from src/ tokens — it lives
    // in vite.config.ts and may be updated independently in a later phase
    // alongside the paired <meta name="theme-color"> in index.html.
    expect(viteConfig).toMatch(/theme_color:\s*"#[0-9a-fA-F]{3,8}"/);
  });
});
