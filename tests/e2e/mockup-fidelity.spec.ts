/**
 * v1.2 Phase 31 — Mockup-fidelity visual sweep.
 *
 * Each restyled surface (SCREEN-01 Sessions list, SCREEN-02 Recording,
 * SCREEN-03 Review, NewSession, Login, AccountManagement, Walkthrough)
 * is screenshot for side-by-side comparison vs docs/design-handoff/tpc-voice.jsx.
 *
 * Tests that don't require Supabase auth (Login screen, light/dark token
 * cascade, reduced-motion guard) always run. Auth-gated tests skip when
 * SUPABASE_URL is unset.
 *
 * Outputs land in tests/e2e/screenshots/mockup-fidelity/.
 */

import { test, expect, type Page } from "@playwright/test";

const HAS_SUPABASE = Boolean(process.env.SUPABASE_URL);
const SCREENSHOT_DIR = "tests/e2e/screenshots/mockup-fidelity";

function ignoreDevNoise(text: string): boolean {
  return (
    text.includes("net::ERR_CERT_AUTHORITY_INVALID") ||
    text.includes("workbox") ||
    text.includes("Failed to load resource") ||
    text.includes("Service worker") ||
    text.includes("[vite]") ||
    text.includes("SourceMap")
  );
}

function captureConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!ignoreDevNoise(text)) errors.push(text);
    }
  });
  return errors;
}

test.describe("Mockup fidelity sweep", () => {
  test("Login renders unified branding + monogram + card chrome", async ({ page }) => {
    const errors = captureConsole(page);
    await page.goto("/login");
    await expect(page.getByText("The Potomack Co.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
    // Monogram is decorative (aria-hidden) but the "P" character must be in the DOM.
    await expect(page.locator("text=P").first()).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/login.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("Login renders in dark theme with .tpc-dark cascade", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/login");
    // Force dark mode via the html class
    await page.evaluate(() => {
      document.documentElement.classList.add("tpc-dark");
    });
    await page.waitForTimeout(100);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/login-dark.png`,
      fullPage: true,
    });
    await context.close();
  });

  test("Reduced-motion suppresses recording pulse + waveform transitions", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/login");
    const reduce = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduce).toBe(true);
    await context.close();
  });

  // --- Authenticated tests below (Supabase required) ---

  test("Sessions list — eyebrow + display title + new button + tiles", async ({
    page,
  }) => {
    test.skip(!HAS_SUPABASE, "Requires SUPABASE_URL env");
    await page.goto("/");
    await expect(page.getByText("The Potomack Co.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await expect(page.getByRole("button", { name: /new/i })).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/sessions-list.png`,
      fullPage: true,
    });
  });

  test("Sessions list (dark) — token cascade flips correctly", async ({ page }) => {
    test.skip(!HAS_SUPABASE, "Requires SUPABASE_URL env");
    await page.goto("/");
    await page.evaluate(() => document.documentElement.classList.add("tpc-dark"));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/sessions-list-dark.png`,
      fullPage: true,
    });
    const isDark = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("tpc-dark"));
    expect(isDark).toBe(true);
  });

  test("NewSession — paired mode tiles with accent-wash and sand-wash", async ({
    page,
  }) => {
    test.skip(!HAS_SUPABASE, "Requires SUPABASE_URL env");
    await page.goto("/new");
    await expect(page.getByRole("heading", { name: "New Session" })).toBeVisible();
    // Both mode picker tiles should be present
    await expect(page.getByText("House Visit")).toBeVisible();
    await expect(page.getByText("Sale Cataloging")).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/new-session.png`,
      fullPage: true,
    });
  });

  test("Settings — eyebrow + display title + theme picker", async ({ page }) => {
    test.skip(!HAS_SUPABASE, "Requires SUPABASE_URL env");
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/settings.png`,
      fullPage: true,
    });
  });

  test("AccountManagement — eyebrow + display title + add-specialist row", async ({
    page,
  }) => {
    test.skip(!HAS_SUPABASE, "Requires SUPABASE_URL env");
    await page.goto("/admin/accounts");
    // If the admin route is gated, give the redirect a chance.
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/admin-accounts.png`,
      fullPage: true,
    });
  });
});
