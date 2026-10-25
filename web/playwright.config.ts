// The E2E suite (web/e2e/). It runs against the built site in web/dist, served by
// e2e/server.ts the way Cloudflare Pages and functions/_middleware.ts serve it, with
// Supabase, /data/ and every outside address stubbed in the browser. Two sizes:
// desktop (1440x900) and phone (390x844).
//
//   npm run build && npm run e2e                 everything
//   npm run e2e -- --project=desktop e2e/trade   one size, one file
//   npm run e2e:visual:update                    new screenshot baselines (Linux only, see e2e/README.md)
import { defineConfig, devices } from "@playwright/test";
import { BASE } from "./e2e/config";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 3 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" } },
  reporter: CI ? [["list"], ["github"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  // Baselines are made on Linux (the CI runner's fonts), so the file names leave the platform out.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  use: {
    baseURL: BASE,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    locale: "en-US",
    timezoneId: "UTC",
    trace: CI ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false } },
  ],
});
