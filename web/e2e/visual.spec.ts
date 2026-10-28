// Screenshots of the key screens of every app at both sizes, compared with the baselines in
// e2e/__screenshots__/visual.spec.ts/. The clock is fixed, motion is off, the front page's
// moving background is masked, and the fonts are the real ones (served from e2e/fonts), so
// the same build gives the same pixels on the same machine.
//
// Baselines are made on Linux by CI (.github/workflows/e2e-baselines.yml), because text is
// smoothed differently on a Mac. So these tests:
//   - run only on Linux, unless E2E_VISUAL=1 is set
//   - skip, with a message, when a baseline is missing, unless the run was asked to write
//     them (--update-snapshots=missing, changed or all)
// See e2e/README.md for how to make or refresh the baselines.
import { existsSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

const NOW = new Date("2026-10-25T12:00:00Z");

interface Screen {
  name: string;
  path: string;
  signedIn?: boolean;
  /** Parts that move or depend on the machine, painted over in the screenshot. */
  mask?: string[];
}

const SCREENS: Screen[] = [
  { name: "site-home", path: "/", signedIn: false, mask: ["canvas"] },
  { name: "site-login", path: "/login/", signedIn: false },
  { name: "site-signup", path: "/signup/", signedIn: false },
  { name: "site-legal-privacy", path: "/legal/privacy/", signedIn: false },
  { name: "site-blog", path: "/blog/", signedIn: false },
  { name: "site-learn", path: "/learn/", signedIn: false },
  { name: "site-404", path: "/no-such-page-xyz/", signedIn: false },
  { name: "site-verify", path: "/verify/", signedIn: false },
  { name: "site-methodology", path: "/methodology/", signedIn: false },
  { name: "app-home", path: "/app/#/" },
  { name: "app-strategies", path: "/app/#/strategies" },
  { name: "app-strategy", path: "/app/#/strategy/fx_carry" },
  { name: "app-verify", path: "/app/#/verify" },
  // The first-run intro's first screen (DEC-0077), opened the way a new account sees it.
  { name: "app-intro", path: "/app/#/?intro=1" },
  { name: "app-settings", path: "/app/#/settings/account" },
  { name: "app-trade-profile", path: "/app/#/settings/trade-profile" },
  { name: "research-home", path: "/research/#/" },
  { name: "research-catalog", path: "/research/#/catalog" },
  { name: "sim-overview", path: "/sim/#/overview" },
  { name: "trade-chart", path: "/trade/#/chart" },
  { name: "trade-portfolio", path: "/trade/#/portfolio" },
  { name: "academy-home", path: "/academy/#/" },
  { name: "academy-lesson", path: "/academy/#/reading-a-backtest/return" },
  { name: "lab-try", path: "/lab/#/try" },
  { name: "lab-compare", path: "/lab/#/compare" },
];

/** Skips the test unless its baseline exists or this run was asked to write baselines. */
function needsBaseline(info: TestInfo, file: string) {
  test.skip(process.platform !== "linux" && !process.env.E2E_VISUAL, "visual baselines are made on Linux; set E2E_VISUAL=1 to run them here");
  const writing = ["missing", "changed", "all"].includes(info.config.updateSnapshots);
  test.skip(!writing && !existsSync(info.snapshotPath(file)), `no baseline yet for ${file}: make them with the "E2E baselines" workflow (e2e/README.md)`);
}

async function still(page: Page) {
  await settled(page);
  await page.evaluate(() => document.fonts?.ready);
  // Let charts that size themselves to their box finish drawing.
  await page.waitForTimeout(500);
}

for (const s of SCREENS) {
  test.describe(s.name, () => {
    test.use({ signedIn: s.signedIn ?? true });
    // The 404 page answers 404 on purpose.
    if (s.path.startsWith("/no-such-page")) test.use({ expectConsole: [/status of 404/], allowHttp: [/^404 .*\/no-such-page-xyz\/$/] });

    test(`looks the same: ${s.name}`, async ({ page }, info) => {
      const file = `${s.name}.png`;
      needsBaseline(info, file);
      await page.clock.setFixedTime(NOW);
      await open(page, s.path);
      await still(page);
      await expect(page).toHaveScreenshot(file, {
        mask: (s.mask ?? []).map((m) => page.locator(m)),
        fullPage: false,
      });
    });
  });
}
