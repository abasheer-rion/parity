// After `npm run build`: every built page loads the analytics boot script (DEC-0053), so a
// new page, app or generated public page cannot ship without it. Run in CI after the build:
//   node scripts/analytics-check.mjs
// It fails on any HTML file in dist/ without the <!--parity-analytics--> marker that
// plugins/analytics.ts (Vite pages) and scripts/seo/build_public.py (static public pages)
// add, and when the fixed-name boot file the static pages load is missing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "../dist");
// Not pages people visit: the brand sheet is a file in public/, and offline.html is what the
// installed app shows with no connection (nothing could be sent anyway).
const EXEMPT = [/^brand\//, /^offline\.html$/];
const MARKER = "<!--parity-analytics-->";

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith(".html") ? [p] : [];
  });
}

if (!existsSync(DIST)) { console.error("dist/ is missing: run npm run build first."); process.exit(1); }
const missing = [];
let checked = 0;
for (const file of walk(DIST)) {
  const rel = relative(DIST, file);
  if (EXEMPT.some((re) => re.test(rel))) continue;
  checked += 1;
  if (!readFileSync(file, "utf8").includes(MARKER)) missing.push(rel);
}
if (!existsSync(join(DIST, "a/boot.js"))) missing.push("a/boot.js (the boot file the static pages load)");
if (missing.length) {
  console.error(`Analytics is not wired on ${missing.length} built file(s):\n  ${missing.slice(0, 30).join("\n  ")}`);
  console.error("Vite pages get it from plugins/analytics.ts; generated pages from scripts/seo/build_public.py.");
  process.exit(1);
}
console.log(`analytics: ${checked} built pages load the boot script`);
