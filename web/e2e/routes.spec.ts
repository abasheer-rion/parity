// Every route of every app, at desktop and phone size (one test per route per project):
// it loads, shows real text, has no NaN or undefined on screen, no console error or
// exception (the fixture), no serious or critical accessibility problem (axe, WCAG 2.2 AA),
// and nothing scrolls sideways on the phone.
import type { Page, TestInfo } from "@playwright/test";
import { ALL } from "./routes";
// @ts-expect-error a plain .mjs module without types
import { layoutCheck } from "../scripts/lib/layout-check.mjs";
import { axe, badValues, expect, open, settled, sideways, test } from "./fixtures";

// axe takes 15 to 20 seconds on the biggest pages (the references page has about 16,000
// elements), more on a busy runner, so those get three times the time (test.slow below).
test.describe.configure({ timeout: 90_000 });

async function check(page: Page, path: string, info: TestInfo, status = 200) {
  const res = await open(page, path);
  expect(res?.status(), "status").toBe(status);
  await settled(page);
  const text = (await page.locator("body").innerText()).trim();
  expect(text.length, "page has text").toBeGreaterThanOrEqual(40);
  expect(await badValues(page), "no NaN or undefined on screen").toEqual([]);
  if ((await page.evaluate(() => document.getElementsByTagName("*").length)) > 5000) test.slow();
  expect(await axe(page), "no serious or critical accessibility problems").toEqual([]);
  // Text that collides, is cut off, or a number shortened with "..." (scripts/lib/layout-check.mjs).
  const layout = (await page.evaluate(layoutCheck) as { kind: string; text: string; other?: string; where: string }[])
    .map((f) => `${f.kind}: "${f.text}"${f.other ? ` and "${f.other}"` : ""} at ${f.where}`);
  expect(layout, "no text that collides or is cut off").toEqual([]);
  if (info.project.name === "phone") expect(await sideways(page), "no sideways scroll").toBeLessThanOrEqual(1);
}

for (const path of ALL.filter((p) => !p.startsWith("/no-such-page"))) {
  test(`route ${path}`, async ({ page }, info) => { await check(page, path, info); });
}

test.describe("missing page", () => {
  // The page's own address answers 404 on purpose, and Chrome logs that as a failed load.
  test.use({ expectConsole: [/Failed to load resource: the server responded with a status of 404/], allowHttp: [/^404 http:\/\/127\.0\.0\.1:\d+\/no-such-page/] });
  for (const path of ALL.filter((p) => p.startsWith("/no-such-page"))) {
    test(`route ${path}`, async ({ page }, info) => { await check(page, path, info, 404); });
  }
});

// Pages whose main content is a chart: the chart must draw at a real size with real lines,
// not an empty box (a chart that measured its box before layout drew at 0 by 0).
// The terminal shows one panel at a time on a phone (the monitor first), so it is checked
// at desktop size only.
const CHARTS = ["/trade/#/chart", "/app/#/strategy/fx_carry", "/sim/#/overview", "/sim/#/fx", "/lab/#/try"];
test.describe("charts draw", () => {
  for (const path of CHARTS) {
    test(`chart on ${path}`, async ({ page }, info) => {
      test.skip(path.startsWith("/sim/") && info.project.name === "phone", "one panel at a time on a phone");
      await open(page, path);
      await settled(page);
      await expect.poll(() => page.evaluate(() => {
        const canvases = [...document.querySelectorAll("canvas")].filter((c) => c.width > 100 && c.height > 50 && c.getBoundingClientRect().width > 100);
        const svgs = [...document.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 150 && s.getBoundingClientRect().height > 60 && s.querySelector("path[d*='L'], path[d*='C'], polyline[points]"));
        return canvases.length + svgs.length;
      }), { message: "a chart with lines at a real size" }).toBeGreaterThan(0);
    });
  }
});
