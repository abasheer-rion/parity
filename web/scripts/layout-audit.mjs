// Layout audit: opens every route of every app at four window sizes, saves a screenshot
// of each, and lists text that collides, gets cut off, numbers shortened with "...", and
// pages that scroll sideways (scripts/lib/layout-check.mjs). The smoke test runs the same
// check on every route in CI; this script adds the extra sizes and the screenshots so a
// person can look at them too.
//
//   VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   LAYOUT_BASE=http://127.0.0.1:5199 npm run layout
//
// LAYOUT_ONLY=/trade/ limits the routes. LAYOUT_SIZES=1440x900,390x844 picks the sizes.
// LAYOUT_SHOTS=dir is where screenshots go (default layout-shots/, ignored by git).
// LAYOUT_JSON=path writes every finding. Exits 1 if anything is found.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { layoutCheck } from "./lib/layout-check.mjs";
import { routes } from "./lib/routes.mjs";

const BASE = (process.env.LAYOUT_BASE ?? "http://127.0.0.1:5199").replace(/\/$/, "");
const SHOTS = resolve(process.env.LAYOUT_SHOTS ?? resolve(import.meta.dirname, "../layout-shots"));
const SIZES = (process.env.LAYOUT_SIZES ?? "1280x800,1440x900,1920x1080,390x844").split(",").map((s) => {
  const [width, height] = s.split("x").map(Number);
  return { name: s, width, height, phone: width < 600 };
});
const list = routes().filter((p) => !process.env.LAYOUT_ONLY || p.includes(process.env.LAYOUT_ONLY));
const findings = [];
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    reducedMotion: "reduce",
    isMobile: size.phone, hasTouch: size.phone, deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
  });
  const queue = [...list];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (queue.length) {
      const path = queue.shift();
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForFunction(() => (document.body?.innerText ?? "").trim().length >= 40, null, { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(500);
        const found = await page.evaluate(layoutCheck);
        for (const f of found) findings.push({ size: size.name, path, ...f });
        const file = `${size.name}_${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "front"}.png`;
        await page.screenshot({ path: resolve(SHOTS, file), fullPage: false });
      } catch (e) {
        findings.push({ size: size.name, path, kind: "load", text: e.message.split("\n")[0] });
      }
      await page.close().catch(() => {});
    }
  }));
  await ctx.close();
}
await browser.close();

if (process.env.LAYOUT_JSON) writeFileSync(process.env.LAYOUT_JSON, JSON.stringify(findings, null, 2));
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
console.log(`layout: ${list.length} routes at ${SIZES.length} sizes, screenshots in ${SHOTS}`);
for (const f of findings) console.log(`  ${f.kind.padEnd(8)} ${f.size.padEnd(9)} ${f.path}  "${f.text}"${f.other ? ` x "${f.other}"` : ""}  ${f.where ?? ""}`);
console.log(findings.length ? `${findings.length} findings ${JSON.stringify(byKind)}` : "no findings");
process.exit(findings.length ? 1 : 0);
