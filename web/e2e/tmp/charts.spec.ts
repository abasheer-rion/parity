import { test, open, settled } from "../fixtures";
for (const p of ["/trade/#/chart", "/app/#/strategy/fx_carry", "/app/#/", "/sim/#/overview", "/sim/#/fx", "/lab/#/try", "/app/#/strategies", "/research/#/algo/fx-carry-g10", "/app/#/trade"]) test(`charts ${p}`, async ({ page }) => {
  await open(page, p); await settled(page); await page.waitForTimeout(1000);
  const info = await page.evaluate(() => ({
    canvas: [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}@${c.closest("[class]")?.className.toString().slice(0, 30)}`),
    svg: [...document.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 200).map((s) => `${Math.round(s.getBoundingClientRect().width)}x${Math.round(s.getBoundingClientRect().height)} ${s.getAttribute("class") ?? ""} ${s.getAttribute("role") ?? ""} ${s.getAttribute("aria-label")?.slice(0, 40) ?? ""} paths=${s.querySelectorAll("path,polyline").length}`),
  }));
  console.log(p, JSON.stringify(info));
});
