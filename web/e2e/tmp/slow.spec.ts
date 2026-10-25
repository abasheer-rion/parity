import { test, open, settled, axe } from "../fixtures";
for (const p of ["/app/#/learn", "/research/#/refs"]) test(`slow ${p}`, async ({ page }) => {
  test.setTimeout(180000);
  let t = Date.now(); await open(page, p); console.log(p, "open", Date.now() - t);
  t = Date.now(); await settled(page); console.log(p, "settled", Date.now() - t);
  console.log(p, "nodes", await page.evaluate(() => document.querySelectorAll("*").length));
  t = Date.now(); const a = await axe(page); console.log(p, "axe", Date.now() - t, a);
});
