// Every route of every app, at desktop and phone size (one test per route per project):
// it loads, shows real text, has no NaN or undefined on screen, no console error or
// exception (the fixture), no serious or critical accessibility problem (axe, WCAG 2.2 AA),
// and nothing scrolls sideways on the phone.
import { ALL } from "./routes";
import { axe, badValues, expect, open, settled, sideways, test } from "./fixtures";

for (const path of ALL) {
  test(`route ${path}`, async ({ page }, info) => {
    const res = await open(page, path);
    expect(res?.status(), "status").toBe(path.startsWith("/no-such-page") ? 404 : 200);
    await settled(page);
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, "page has text").toBeGreaterThanOrEqual(40);
    expect(await badValues(page), "no NaN or undefined on screen").toEqual([]);
    expect(await axe(page), "no serious or critical accessibility problems").toEqual([]);
    if (info.project.name === "phone") expect(await sideways(page), "no sideways scroll").toBeLessThanOrEqual(1);
  });
}
