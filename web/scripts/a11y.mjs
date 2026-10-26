// Accessibility check for WCAG 2.2 AA, run in CI (.github/workflows/ci.yml, DEC-0061).
//
//   1. axe-core's WCAG 2.2 A and AA rules on every route of every app (the same list as the
//      smoke test, scripts/lib/routes.mjs) at desktop and phone width: contrast, names,
//      roles and states, 24px targets, links told apart by more than colour, tables that
//      scroll by keyboard. Also fails if a page scrolls sideways at 390 pixels.
//   2. A keyboard walk through the UI library page (#/ui), where every component is live:
//      Tab must reach each control and each one must show a focus ring at least 2px wide.
//   3. Reduced motion: with the system setting on, no animation may keep running on the
//      app homes and the UI library page.
//
//   npm run a11y                                    starts its own server
//   A11Y_BASE=http://127.0.0.1:5199 npm run a11y    uses a running one
//
// Prints a table of violations by impact and exits 1 if any serious or critical remain,
// or the keyboard or motion checks fail. A11Y_JSON=path writes the full results.
// A11Y_PAGES="/,/login/" limits the pages. A11Y_TAGS=best-practice runs axe's other
// checks (landmarks, headings) instead.
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { routes } from "./lib/routes.mjs";

const here = (p) => resolve(import.meta.dirname, "..", p);
const PAGES = (process.env.A11Y_PAGES ? process.env.A11Y_PAGES.split(",") : [...routes(), "/verify/?type=email&token_hash=example", "/no-such-page-xyz/"])
  .map((p) => p.trim()).filter(Boolean);
const SIZES = [
  { name: "desktop", width: 1280, height: 860 },
  { name: "phone", width: 390, height: 844 },
];
const TAGS = (process.env.A11Y_TAGS ?? "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa").split(",");
const IMPACTS = ["critical", "serious", "moderate", "minor"];
const UI_PAGE = "/research/#/ui";
const CONSENT = () => {
  try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
  // Tours would cover the page being checked; they have their own test (npm run onboarding).
  try { localStorage.setItem("parity.onboarding.v1", JSON.stringify({ tours_off: true })); } catch { /* private mode */ }
};

// ---------------------------------------------------------------- the server

let server = null;
let BASE = process.env.A11Y_BASE?.replace(/\/$/, "");
if (!BASE) {
  process.env.VITE_AUTH_BYPASS = "1";
  process.env.PARITY_OUTPUT_DIR ??= here("tests/fixtures/smoke");
  const { createServer } = await import("vite");
  server = await createServer({ root: here("."), configFile: here("vite.config.ts"), logLevel: "error", server: { port: 5399, strictPort: false, host: "127.0.0.1" } });
  await server.listen();
  BASE = server.resolvedUrls.local[0].replace(/\/$/, "");
}

async function open(page, path) {
  try {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  } catch { /* checked below as a blank page */ }
  await page.waitForFunction(() => (document.body?.innerText ?? "").trim().length >= 40, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
}

const browser = await chromium.launch();
const results = [];
const failures = [];

// ---------------------------------------------------------------- 1. axe on every route

for (const size of SIZES) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce" });
  await context.addInitScript(CONSENT);
  const queue = [...PAGES];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (queue.length) {
      const path = queue.shift();
      const page = await context.newPage();
      await open(page, path);
      try {
        const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const counts = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
        for (const v of axe.violations) counts[v.impact ?? "minor"] += v.nodes.length;
        results.push({
          size: size.name, path, counts, overflow,
          violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 8), count: v.nodes.length })),
        });
      } catch (e) {
        failures.push(`${size.name} ${path}: axe did not run (${e.message.split("\n")[0]})`);
      }
      await page.close();
    }
  }));
  await context.close();
}

// ---------------------------------------------------------------- 2. keyboard walk on the UI library

if (!process.env.A11Y_PAGES || process.env.A11Y_PAGES.includes("#/ui")) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(CONSENT);
  const page = await context.newPage();
  await open(page, UI_PAGE);
  const seen = new Set();
  let stops = 0;
  for (let i = 0; i < 600; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // A library checkbox or radio hides its input and rings the box drawn next to it.
      const shown = el.matches("input[type=checkbox], input[type=radio]") && getComputedStyle(el).opacity === "0" ? el.nextElementSibling ?? el : el;
      const s = getComputedStyle(shown);
      const ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
      const shadow = s.boxShadow !== "none" && /\b[2-9]px\b/.test(s.boxShadow);
      const r = shown.getBoundingClientRect();
      const path = [];
      for (let e = el; e && e !== document.body && path.length < 3; e = e.parentElement) path.unshift(e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/)[0] : ""));
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().slice(0, 40);
      return { key: path.join(">") + "|" + name + "|" + Math.round(r.top + window.scrollY), where: path.join(" > "), name, ring: ring || shadow, onScreen: r.bottom > 0 && r.top < window.innerHeight && r.width > 0 };
    });
    if (!f) continue;
    if (seen.has(f.key)) break;
    seen.add(f.key);
    stops++;
    if (!f.ring) failures.push(`keyboard: no visible focus ring on "${f.name}" at ${f.where}`);
    if (!f.onScreen) failures.push(`keyboard: focused "${f.name}" is off screen at ${f.where}`);
  }
  if (stops < 40) failures.push(`keyboard: Tab reached only ${stops} controls on ${UI_PAGE}`);
  console.log(`keyboard: ${stops} controls reached by Tab on ${UI_PAGE}`);
  await context.close();
}

// ---------------------------------------------------------------- 3. reduced motion holds still

if (!process.env.A11Y_PAGES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(CONSENT);
  for (const path of ["/", "/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/", UI_PAGE]) {
    const page = await context.newPage();
    // Every animation runs 20 times slower, so one that starts as the page opens is still
    // playing when it is checked, however fast this machine is.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.05 });
    await open(page, path);
    await page.waitForTimeout(500);
    // Reduced motion means less, not none (REF-0023): the motion system's own fades,
    // crossfades and lines drawing in keep playing, with every distance and scale at zero.
    // So an animation fails only if it never ends, or if something travels or changes size:
    // the element's transform, position or size now differs from where the animation ends.
    const moving = await page.evaluate(() => {
      const PROPS = ["transform", "translate", "scale", "rotate", "left", "top", "width", "height"];
      // A zero move computes as an identity matrix, and no transform as "none": the same place.
      const still = (v) => (/^matrix\(1, 0, 0, 1, 0, 0\)$|^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$|^0px 0px( 0px)?$|^0px$/.test(v) ? "none" : v);
      const snap = (el) => { const cs = getComputedStyle(el); return PROPS.map((p) => still(cs[p])).join("|"); };
      const name = (a) => { const el = a.effect?.target; return `${a.animationName ?? a.constructor.name} on ${el?.tagName?.toLowerCase() ?? "?"}.${typeof el?.className === "string" ? el.className.split(" ")[0] : (el?.className?.baseVal ?? "")}`; };
      const live = document.getAnimations()
        .filter((a) => a.playState === "running")
        .filter((a) => { const t = a.effect?.getComputedTiming?.(); return t && (t.iterations === Infinity || (typeof t.duration === "number" && t.duration > 10)); });
      const out = [];
      for (const a of live) {
        const el = a.effect?.target;
        if (a.effect.getComputedTiming().iterations === Infinity || !(el instanceof Element)) { out.push(name(a)); continue; }
        const before = snap(el);
        try { a.finish(); } catch { out.push(name(a)); continue; }
        if (snap(el) !== before) out.push(name(a));
      }
      return out;
    });
    for (const m of [...new Set(moving)].slice(0, 5)) failures.push(`reduced motion: ${path} still animates ${m}`);
    await page.close();
  }
  await context.close();
  console.log("reduced motion: checked 8 pages");
}

await browser.close();
await server?.close();

// ---------------------------------------------------------------- report

results.sort((a, b) => a.size.localeCompare(b.size) || a.path.localeCompare(b.path));
const pad = (s, n) => String(s).padEnd(n);
const total = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
const noisy = results.filter((r) => IMPACTS.some((i) => r.counts[i]) || (r.size === "phone" && r.overflow > 0));
console.log(`axe: ${PAGES.length} pages at ${SIZES.length} sizes, ${noisy.length} with findings`);
if (noisy.length) console.log(pad("size", 8) + pad("page", 44) + IMPACTS.map((i) => pad(i, 10)).join("") + "sideways");
for (const r of results) {
  IMPACTS.forEach((i) => { total[i] += r.counts[i]; });
  if (noisy.includes(r)) console.log(pad(r.size, 8) + pad(r.path, 44) + IMPACTS.map((i) => pad(r.counts[i], 10)).join("") + (r.size === "phone" && r.overflow > 0 ? `${r.overflow}px` : "-"));
}
console.log(pad("", 8) + pad("TOTAL (affected elements)", 44) + IMPACTS.map((i) => pad(total[i], 10)).join(""));
for (const r of results) {
  for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
    console.log(`  [${r.size} ${r.path}] ${v.impact} ${v.id} x${v.count}: ${v.help}\n      ${v.nodes.join("\n      ")}`);
  }
}
for (const f of failures) console.log(`  FAIL ${f}`);
if (process.env.A11Y_JSON) writeFileSync(process.env.A11Y_JSON, JSON.stringify({ results, failures }, null, 2));
const sideways = results.filter((r) => r.size === "phone" && r.overflow > 0);
const bad = total.critical + total.serious > 0 || sideways.length > 0 || failures.length > 0;
console.log(bad ? "a11y: failed" : "a11y: no problems");
process.exit(bad ? 1 : 0);
