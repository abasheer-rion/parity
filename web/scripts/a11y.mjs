// Accessibility audit with axe-core (WCAG 2.0, 2.1 and 2.2, levels A and AA) on every
// page of every Parity app, run in CI (.github/workflows/ci.yml). It covers:
//   - every route in scripts/lib/routes.mjs, plus the verify, connect, OAuth, badge and 404
//     pages and each app's not-found view (scripts/lib/a11y-env.mjs)
//   - one page of each kind among the static public pages: Learn, Ideas, Notes, Blog, News
//   - each page at desktop (1280x860) and phone (390x844) size
//   - each page signed out (a first visit, cookie notice showing) and with sign-in skipped
//   - the desktop app's own pages (title bar, menu, palette, Settings, error and offline
//     pages), opened as plain files with a stand-in bridge; Electron is never started
// It also fails on sideways scroll at phone size, and (DEC-0061) if anything travels or
// changes size, or never stops, under reduced motion on the app homes and the UI library.
//
//   npm run a11y                    starts its own servers (about 4 minutes)
//   A11Y_ONLY=/legal/ npm run a11y  only paths that contain the text
//   A11Y_MODES=bypass npm run a11y  one mode only (bypass, signed-out, desktop)
//   A11Y_JSON=out.json npm run a11y writes every violation found
//
// Prints a summary by impact (affected elements and distinct rules) and exits 1 if any
// serious or critical violation is left. Requests leave 127.0.0.1 never: the signed-out
// server points Supabase at a dead local address and every other host is blocked.
import AxeBuilder from "@axe-core/playwright";
import { rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { allPages, buildPublic, localContext, openPage, pool, startServer } from "./lib/a11y-env.mjs";
import { DESKTOP_PAGES, shellStub } from "./lib/desktop-shell.mjs";

const TAGS = (process.env.A11Y_TAGS ?? "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22a,wcag22aa").split(",");
const IMPACTS = ["critical", "serious", "moderate", "minor"];
const SIZES = [{ name: "desktop", width: 1280, height: 860 }, { name: "phone", width: 390, height: 844 }];
const MODES = (process.env.A11Y_MODES ?? "bypass,signed-out,desktop").split(",");
const ONLY = process.env.A11Y_ONLY;

const publicDir = buildPublic();
const pages = allPages(publicDir).filter((p) => !ONLY || p.includes(ONLY));
const results = [];
const failures = [];
const browser = await chromium.launch();

async function audit(page, where) {
  const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  results.push({
    ...where, overflow,
    violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact ?? "minor", help: v.help, count: v.nodes.length, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary ?? "").split("\n").slice(1, 3).join(" ").trim() })) })),
  });
}

for (const mode of MODES.filter((m) => m !== "desktop")) {
  const server = await startServer(mode, publicDir);
  for (const size of SIZES) {
    // Signed out, the cookie notice shows, as on a first visit; with sign-in skipped it is decided.
    const ctx = await localContext(browser, server.base, { viewport: { width: size.width, height: size.height } }, { consent: mode === "bypass" });
    await pool(pages, 4, async (path) => {
      const page = await ctx.newPage();
      page.on("popup", (p) => p.close().catch(() => {}));
      try {
        await openPage(page, server.base + path);
        await audit(page, { mode, size: size.name, path });
      } catch (e) {
        results.push({ mode, size: size.name, path, overflow: 0, error: e.message.split("\n")[0], violations: [] });
      }
      await page.close().catch(() => {});
    });
    await ctx.close();
  }
  // Reduced motion holds still (DEC-0061, REF-0023), on the app homes and the UI library.
  if (mode === "bypass" && !ONLY) {
    const context = await localContext(browser, server.base, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }, { tours: false });
  for (const path of ["/", "/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/", "/research/#/ui"]) {
    const page = await context.newPage();
    // Every animation runs 20 times slower, so one that starts as the page opens is still
    // playing when it is checked, however fast this machine is.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.05 });
    await openPage(page, server.base + path);
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
  await server.close();
}

if (MODES.includes("desktop")) {
  for (const d of DESKTOP_PAGES.filter((p) => !ONLY || p.name.includes(ONLY))) {
    const ctx = await browser.newContext({ viewport: d.viewport, reducedMotion: "reduce", bypassCSP: true });
    await ctx.addInitScript(shellStub);
    const page = await ctx.newPage();
    await page.goto(d.url, { waitUntil: "load" });
    await page.waitForTimeout(300);
    await audit(page, { mode: "desktop", size: `${d.viewport.width}x${d.viewport.height}`, path: d.name });
    await ctx.close();
  }
}
await browser.close();
rmSync(publicDir, { recursive: true, force: true });

// ---------------------------------------------------------------- the report

const order = (r) => `${MODES.indexOf(r.mode)} ${r.size} ${r.path}`;
results.sort((a, b) => order(a).localeCompare(order(b)));
const total = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
const rules = Object.fromEntries(IMPACTS.map((i) => [i, new Set()]));
const byRule = new Map();
for (const r of results) {
  for (const v of r.violations) {
    total[v.impact] += v.count;
    rules[v.impact].add(v.id);
    const k = `${v.impact} ${v.id}`;
    const row = byRule.get(k) ?? { impact: v.impact, id: v.id, help: v.help, count: 0, pages: 0, example: null };
    row.count += v.count;
    row.pages += 1;
    row.example ??= `${r.mode} ${r.size} ${r.path}: ${v.nodes[0]?.target ?? ""} ${v.nodes[0]?.summary ?? ""}`;
    byRule.set(k, row);
  }
}
const sideways = results.filter((r) => r.size === "phone" && r.overflow > 1);
const errors = results.filter((r) => r.error);

console.log(`a11y: ${results.length} page views (${pages.length} pages x ${SIZES.length} sizes x ${MODES.filter((m) => m !== "desktop").length} modes, plus ${results.filter((r) => r.mode === "desktop").length} desktop app pages)`);
console.log("impact     elements  rules");
for (const i of IMPACTS) console.log(`${i.padEnd(11)}${String(total[i]).padEnd(10)}${rules[i].size}`);
const allRules = new Set(IMPACTS.flatMap((i) => [...rules[i]]));
console.log(`${"total".padEnd(11)}${String(IMPACTS.reduce((s, i) => s + total[i], 0)).padEnd(10)}${allRules.size}`);
for (const row of [...byRule.values()].sort((a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) || b.count - a.count)) {
  console.log(`  ${row.impact.padEnd(9)} ${row.id} x${row.count} on ${row.pages} page views: ${row.help}\n      e.g. ${row.example.slice(0, 260)}`);
}
for (const r of sideways) console.log(`  sideways scroll ${r.overflow}px: ${r.mode} ${r.path}`);
for (const r of errors) console.log(`  could not audit ${r.mode} ${r.size} ${r.path}: ${r.error}`);
for (const f of failures) console.log(`  FAIL ${f}`);
if (process.env.A11Y_JSON) writeFileSync(process.env.A11Y_JSON, JSON.stringify({ total, rules: Object.fromEntries(IMPACTS.map((i) => [i, [...rules[i]]])), results }, null, 1));
const bad = total.critical + total.serious + sideways.length + errors.length + failures.length;
console.log(bad ? "FAIL: serious or critical violations, sideways scroll, motion under reduced motion, or pages that could not be audited" : "no serious or critical violations");
process.exit(bad ? 1 : 0);
