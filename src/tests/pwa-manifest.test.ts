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

  it('has theme_color set to "#2563eb"', () => {
    expect(viteConfig).toContain('theme_color: "#2563eb"');
  });
});
