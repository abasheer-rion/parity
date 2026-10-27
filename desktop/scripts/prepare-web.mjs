// Copies the built website (web/dist) into build/web for the desktop app (DEC-0041).
// Run `npm run web` (it builds the site first). It refuses to ship anything that is not
// public: research data (data/), dev files (local/), source maps and env files stay out,
// and the copy is checked again afterwards.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

const here = resolve(import.meta.dirname, "..");
const src = resolve(here, "../web/dist");
const out = resolve(here, "build/web");

// Server-only files: the Pages config, search engine files and the IndexNow key.
const SKIP_TOP = new Set(["data", "local", "_headers", "_routes.json", "robots.txt", "sitemap.xml", "sitemaps", "seo-manifest.json"]);
const banned = (rel) => {
  const top = rel.split(sep)[0];
  return SKIP_TOP.has(top) || /\.map$/.test(rel) || /(^|[\\/])\.env/.test(rel) || /^[0-9a-f]{32}\.txt$/.test(rel);
};

if (!existsSync(join(src, "index.html"))) {
  console.error("web/dist has no index.html. Run `npm --prefix ../web run build` first.");
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (from) => from === src || !banned(relative(src, from)) });

let files = 0, bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(out, full);
    if (banned(rel)) { console.error(`refusing to ship ${rel}`); process.exit(1); }
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else { files++; bytes += st.size; }
  }
};
walk(out);

const site = JSON.parse(readFileSync(resolve(here, "../web/src/lib/site.json"), "utf8"));
let commit = null;
try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: here }).toString().trim(); } catch { /* not a checkout */ }
writeFileSync(join(out, "desktop.json"), JSON.stringify({ origin: site.origin, built_at: new Date().toISOString(), commit }, null, 2));
console.log(`build/web: ${files} files, ${(bytes / 1e6).toFixed(1)} MB, origin ${site.origin}`);
