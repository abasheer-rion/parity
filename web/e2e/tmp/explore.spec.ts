import { writeFileSync } from "node:fs";
import { test, open, settled } from "../fixtures";
test.use({ signedIn: !process.env.OUT });
const P = (process.env.EXP ?? "").split(",");
for (const p of P) test(`exp ${p}`, async ({ page }) => {
  await open(page, p); await settled(page); await page.waitForTimeout(800);
  const snap = await page.locator("body").ariaSnapshot();
  writeFileSync(`/private/tmp/claude-501/-Users-ayanbasheer/448170d8-2b6b-47e9-b8cd-7019436a4b4b/scratchpad/snap-${p.replace(/[^a-z0-9]+/gi, "_")}.yml`, snap);
});
