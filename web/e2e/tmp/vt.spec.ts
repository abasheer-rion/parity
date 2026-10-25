import { test, open } from "../fixtures";
test("vt skip on swap", async ({ page }) => {
  await page.addInitScript(() => {
    addEventListener("pageswap", (e: any) => { const vt = e.viewTransition; if (!vt) return; vt.ready.catch(() => {}); vt.skipTransition(); });
  });
  page.on("response", (r) => { if (r.status() >= 400) console.log("R:", r.status(), r.url()); });
  await open(page, "/login/"); await page.waitForURL(/\/app\//); await page.waitForTimeout(1500);
});
test("home 404", async ({ page }) => {
  page.on("response", (r) => { if (r.status() >= 400) console.log("R:", r.status(), r.url()); });
  await open(page, "/"); await page.waitForTimeout(2500);
});
