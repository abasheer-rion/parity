import AxeBuilder from "@axe-core/playwright";
import { test, open, settled } from "../fixtures";
for (const p of ["/research/#/algo/fx-carry-g10", "/sim/#/overview", "/lab/#/live", "/research/#/competitors", "/app/#/markets/practice"]) test(`ts ${p}`, async ({ page }) => {
  await open(page, p); await settled(page);
  const r = await new AxeBuilder({ page }).withRules(["target-size", "link-in-text-block"]).analyze();
  for (const v of r.violations) for (const n of v.nodes.slice(0, 4)) {
    const box = await page.locator(n.target.join(" ")).first().boundingBox().catch(() => null);
    const css = await page.locator(n.target.join(" ")).first().evaluate((e) => { const s = getComputedStyle(e); return `${s.width}x${s.height} pad=${s.padding} fs=${s.fontSize} color=${s.color} td=${s.textDecorationLine}`; }).catch(() => "");
    console.log(p, v.id, n.target.join(" "), JSON.stringify(box), css, "|", n.failureSummary?.replace(/\n/g, " ").slice(0, 200));
  }
});
