import { defineConfig, devices } from "@playwright/test";

/**
 * v1.2 UI Overhaul — minimal smoke harness.
 *
 * The dev server already exposes the full app at https://localhost:5173 via
 * Vite's basic-ssl plugin. The smoke spec navigates each top-level route
 * and asserts the page renders without console errors + that the theme
 * toggle flips `<html>.tpc-dark`.
 *
 * Auth is required for protected routes — the spec gates protected-route
 * navigation behind a SUPABASE_URL env presence check so CI can run the
 * /login + theme-toggle assertions without credentials.
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "https://localhost:5173",
    trace: "off",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "https://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    ignoreHTTPSErrors: true,
  },
});
