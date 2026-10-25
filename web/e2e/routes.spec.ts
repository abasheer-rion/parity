// Every route of every app, at desktop and phone size (one test per route per project):
// it loads, shows real text, has no NaN or undefined on screen, no console error or
// exception (the fixture), no serious or critical accessibility problem (axe, WCAG 2.2 AA),
// and nothing scrolls sideways on the phone.
import type { Page, TestInfo } from "@playwright/test";
import { ALL } from "./routes";
import { axe, badValues, expect, open, settled, sideways, test } from "./fixtures";

// axe takes 15 to 20 seconds on the biggest pages (the glossary has about 16,000 elements).
test.describe.configure({ timeout: 120_000 });

async function check(page: Page, path: string, info: TestInfo, status = 200) {
  const res = await open(page, path);
  expect(res?.status(), "status").toBe(status);
  await settled(page);
  const text = (await page.locator("body").innerText()).trim();
  expect(text.length, "page has text").toBeGreaterThanOrEqual(40);
  expect(await badValues(page), "no NaN or undefined on screen").toEqual([]);
  expect(await axe(page), "no serious or critical accessibility problems").toEqual([]);
  if (info.project.name === "phone") expect(await sideways(page), "no sideways scroll").toBeLessThanOrEqual(1);
}

for (const path of ALL.filter((p) => !p.startsWith("/no-such-page"))) {
  test(`route ${path}`, async ({ page }, info) => { await check(page, path, info); });
}

test.describe("missing page", () => {
  // The page's own address answers 404 on purpose, and Chrome logs that as a failed load.
  test.use({ expectConsole: [/Failed to load resource: the server responded with a status of 404/] });
  for (const path of ALL.filter((p) => p.startsWith("/no-such-page"))) {
    test(`route ${path}`, async ({ page }, info) => { await check(page, path, info, 404); });
  }
});
