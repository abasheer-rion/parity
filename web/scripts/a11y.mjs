// Accessibility audit with axe-core (WCAG 2.2 A and AA rules) on the public pages, the
// sign-in pages and the app homes, at desktop and phone width. Also checks that nothing
// scrolls sideways at 390 pixels.
//
//   VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   A11Y_BASE=http://127.0.0.1:5199 npm run a11y
//
// Prints a table of violations by impact and exits 1 if any serious or critical remain.
// A11Y_JSON=path writes the full results. A11Y_PAGES="/,/login/" limits the pages.
// A11Y_TAGS=best-practice runs axe's other checks (landmarks, headings) instead.
// The sign-in pages talk to the hosted Supabase only to read the (empty) session.
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.A11Y_BASE ?? "http://127.0.0.1:5199";
const PAGES = (process.env.A11Y_PAGES ?? [
  "/", "/login/", "/signup/", "/reset/", "/verify/?type=email&token_hash=example",
  "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/", "/legal/regulatory/",
  "/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/",
].join(",")).split(",").map((p) => p.trim()).filter(Boolean);
const SIZES = [
  { name: "desktop", width: 1280, height: 860 },
  { name: "phone", width: 390, height: 844 },
];
const TAGS = (process.env.A11Y_TAGS ?? "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa").split(",");
const IMPACTS = ["critical", "serious", "moderate", "minor"];

const browser = await chromium.launch();
const results = [];
for (const size of SIZES) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce" });
  for (const path of PAGES) {
    const page = await context.newPage();
    const url = new URL(path, BASE).toString();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(() => {});
    }
    await page.waitForTimeout(1200);
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const counts = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
    for (const v of axe.violations) counts[v.impact ?? "minor"] += v.nodes.length;
    results.push({
      size: size.name, path, counts, overflow,
      violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 8), count: v.nodes.length })),
    });
    await page.close();
  }
  await context.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("size", 8) + pad("page", 44) + IMPACTS.map((i) => pad(i, 10)).join("") + "sideways");
const total = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
for (const r of results) {
  IMPACTS.forEach((i) => { total[i] += r.counts[i]; });
  console.log(pad(r.size, 8) + pad(r.path, 44) + IMPACTS.map((i) => pad(r.counts[i], 10)).join("") + (r.size === "phone" && r.overflow > 0 ? `${r.overflow}px` : "-"));
}
console.log(pad("", 8) + pad("TOTAL (affected elements)", 44) + IMPACTS.map((i) => pad(total[i], 10)).join(""));
for (const r of results) {
  for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
    console.log(`  [${r.size} ${r.path}] ${v.impact} ${v.id} x${v.count}: ${v.help}\n      ${v.nodes.join("\n      ")}`);
  }
}
if (process.env.A11Y_JSON) writeFileSync(process.env.A11Y_JSON, JSON.stringify(results, null, 2));
const sideways = results.filter((r) => r.size === "phone" && r.overflow > 0);
process.exit(total.critical + total.serious > 0 || sideways.length ? 1 : 0);
