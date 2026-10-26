// Startup soak test for the desktop app. Two parts:
//   start   launches the app 50 times in a row with one profile (like a person opening it
//           every day), waits for the window to finish loading, records the time and memory,
//           quits it the normal way and checks nothing crashed and no process was left behind.
//   reload  keeps one app open and reloads the page 50 times, looking for memory that grows.
// The app talks only to a local copy of the site (build/web, from `npm run web`), served here.
// Anything that tries to leave this machine is cancelled inside the app (electron/soak.js).
//
// Run: npm run soak
//   options: --runs=50 --reloads=50 --only=start|reload --fresh (a new profile every launch)
// It exits 1 on a crash, a hang, a process left behind, or startup time or memory that grows.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const here = resolve(import.meta.dirname, "..");
const electron = createRequire(import.meta.url)("electron");
const web = join(here, "build", "web");
if (!existsSync(join(web, "index.html"))) {
  console.error("build/web is missing. Run `npm run web` (or node scripts/prepare-web.mjs) first.");
  process.exit(1);
}

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return dflt;
  return a.includes("=") ? a.split("=")[1] : true;
};
const RUNS = Number(arg("runs", 50));
const RELOADS = Number(arg("reloads", 50));
const ONLY = arg("only", null);
const FRESH = !!arg("fresh", false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ the local site

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let served = 0;
function serve() {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      served++;
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = normalize(join(web, p));
      if (!file.startsWith(web)) { res.writeHead(403).end(); return; }
      try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* 404 below */ }
      if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(req.method === "HEAD" ? undefined : readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => ok(server));
  });
}

// ------------------------------------------------------------------ processes

/** Every process whose command line names this profile folder (the app and its helpers). */
function processesFor(profile) {
  const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8", maxBuffer: 16 << 20 });
  if (ps.status !== 0) return [];
  return ps.stdout.split("\n").filter((l) => l.includes(profile)).map((l) => Number(l.trim().split(/\s+/)[0])).filter((pid) => pid && pid !== process.pid);
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** Waits up to `ms` for the pids and the profile's processes to go; returns what is left. */
async function leftovers(pids, profile, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    const left = [...new Set([...pids.filter(alive), ...processesFor(profile)])];
    if (!left.length || Date.now() > end) return left;
    await wait(200);
  }
}

function launch(scenario, profile, env, timeoutMs) {
  return new Promise((ok) => {
    const t0 = performance.now();
    const child = spawn(electron, [".", `--user-data-dir=${profile}`], { cwd: here, env: { ...process.env, PARITY_SELFTEST: scenario, ...env } });
    const r = { readyMs: null, appReadyMs: null, metrics: null, reloads: [], crashes: [], blocked: {}, fails: [], code: null, signal: null, hung: false, tail: "" };
    let buf = "";
    const line = (l) => {
      let m;
      if ((m = /^READY (\d+)/.exec(l))) { r.readyMs = Math.round(performance.now() - t0); r.appReadyMs = Number(m[1]); }
      else if ((m = /^METRICS (.*)$/.exec(l))) r.metrics = JSON.parse(m[1]);
      else if ((m = /^RELOAD (\d+) (\d+) (.*)$/.exec(l))) { r.reloads.push({ i: Number(m[1]), ms: Number(m[2]), ...JSON.parse(m[3]) }); if (Number(m[1]) % 10 === 0) console.log(`  reload ${m[1]}`); }
      else if ((m = /^CRASH (.*)$/.exec(l))) r.crashes.push(JSON.parse(m[1]));
      else if ((m = /^BLOCKED (.*)$/.exec(l))) r.blocked = JSON.parse(m[1]);
      else if ((m = /^PAGES (.*)$/.exec(l))) r.pages = JSON.parse(m[1]);
      else if (/^FAIL/.test(l)) r.fails.push(l);
    };
    const take = (d) => {
      r.tail = (r.tail + d).slice(-4000);
      buf += d;
      const parts = buf.split("\n");
      buf = parts.pop();
      for (const l of parts) line(l.trim());
    };
    child.stdout.on("data", take);
    child.stderr.on("data", (d) => { r.tail = (r.tail + d).slice(-4000); });
    const timer = setTimeout(() => { r.hung = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("exit", (code, signal) => { clearTimeout(timer); if (buf) line(buf.trim()); r.code = code; r.signal = signal; r.pid = child.pid; ok(r); });
  });
}

// ------------------------------------------------------------------ numbers

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]; };
/** Least-squares slope of y against its index: change per run. */
const slope = (y) => {
  const n = y.length; if (n < 2) return 0;
  const mx = (n - 1) / 2, my = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (y[i] - my); den += (i - mx) ** 2; }
  return num / den;
};
const MB = (kb) => kb / 1024;
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "n/a");
function trend(label, values, unit, toUnit = (x) => x) {
  const v = values.map(toUnit);
  const first = mean(v.slice(0, 5)), last = mean(v.slice(-5));
  const late = v.slice(Math.floor(v.length / 2));
  return { label, unit, first5: first, last5: last, p50: pct(v, 50), p95: pct(v, 95), slope: slope(v), lateSlope: slope(late), n: v.length };
}
const show = (t) => `${t.label.padEnd(18)} first5 ${f1(t.first5).padStart(7)}  last5 ${f1(t.last5).padStart(7)}  p50 ${f1(t.p50).padStart(7)}  p95 ${f1(t.p95).padStart(7)}  per run ${t.slope >= 0 ? "+" : ""}${t.slope.toFixed(2)} ${t.unit} (second half ${t.lateSlope >= 0 ? "+" : ""}${t.lateSlope.toFixed(2)})`;

/**
 * Grows when the last five are clearly above the first five and it is still climbing in the
 * second half. Memory that rises for a while and then levels off (caches filling, the
 * garbage collector catching up) is not a leak; a leak keeps going. The floor keeps ordinary
 * noise (a few ms, a few MB) from failing the run.
 */
const grows = (t, floor) => t.last5 - t.first5 > Math.max(floor, 0.15 * t.first5) && t.lateSlope * (t.n / 2) > floor;

// ------------------------------------------------------------------ main

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}`;
// The app's live address and its dev address both point at the local copy, so the online
// check, the pages and anything the app fetches on the site's behalf all stay here.
const env = { PARITY_DEV_URL: url, PARITY_LIVE_ORIGIN: url, PARITY_AUTH_BYPASS: "1" };
const problems = [];
const report = { when: new Date().toISOString(), runs: RUNS, reloads: RELOADS, fresh: FRESH, url };

if (ONLY !== "reload") {
  const shared = mkdtempSync(join(tmpdir(), "parity-soak-"));
  const runs = [];
  console.log(`start: ${RUNS} launches, ${FRESH ? "a new profile each time" : `one profile (${shared})`}`);
  for (let i = 1; i <= RUNS; i++) {
    const profile = FRESH ? mkdtempSync(join(tmpdir(), "parity-soak-")) : shared;
    const r = await launch("soak", profile, env, 90000);
    const left = await leftovers(r.metrics?.pids || [], profile);
    for (const pid of left) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
    r.left = left;
    const bad = [];
    if (r.hung) bad.push("hung (killed after 90 s)");
    if (r.code !== 0 || r.signal) bad.push(`exit ${r.code}${r.signal ? ` ${r.signal}` : ""}`);
    if (r.crashes.length) bad.push(`crash ${JSON.stringify(r.crashes)}`);
    if (r.readyMs === null) bad.push("never ready");
    if (r.fails.length) bad.push(r.fails.join("; "));
    if (left.length) bad.push(`${left.length} process(es) left: ${left.join(",")}`);
    r.bad = bad;
    runs.push(r);
    const m = r.metrics;
    console.log(`  run ${String(i).padStart(2)}: ready ${r.readyMs ?? "-"} ms, main ${m ? f1(MB(m.main)) : "-"} MB, renderers ${m ? f1(MB(m.renderers)) : "-"} MB (${m?.rendererCount ?? "-"}), page ${m ? f1(MB(m.page)) : "-"} MB, total ${m ? f1(MB(m.total)) : "-"} MB${bad.length ? `  PROBLEM: ${bad.join(" | ")}` : ""}`);
    if (bad.length) { problems.push(`run ${i}: ${bad.join(" | ")}`); if (r.readyMs === null) console.log(r.tail.slice(-1500)); }
  }
  const good = runs.filter((r) => r.readyMs !== null && r.metrics);
  const t = [
    trend("startup to ready", good.map((r) => r.readyMs), "ms"),
    trend("main memory", good.map((r) => r.metrics.main), "MB", MB),
    trend("main JS heap", good.map((r) => r.metrics.mainHeap), "MB", MB),
    trend("all renderers", good.map((r) => r.metrics.renderers), "MB", MB),
    trend("page renderer", good.map((r) => r.metrics.page), "MB", MB),
    trend("all processes", good.map((r) => r.metrics.total), "MB", MB),
  ];
  console.log(`\nstart: ${runs.length} launches, ${runs.filter((r) => r.crashes.length || r.code !== 0 || r.signal || r.hung).length} crashed or failed, ${runs.filter((r) => r.left.length).length} left processes behind`);
  for (const x of t) console.log(`  ${show(x)}`);
  const blocked = {};
  for (const r of runs) for (const [h, n] of Object.entries(r.blocked)) blocked[h] = (blocked[h] || 0) + n;
  console.log(`  requests kept off the network: ${JSON.stringify(blocked)}`);
  if (good.length >= 10) {
    if (grows(t[0], 150)) problems.push(`startup time grows: ${f1(t[0].first5)} -> ${f1(t[0].last5)} ms`);
    for (const x of t.slice(1)) if (grows(x, 15)) problems.push(`${x.label} grows: ${f1(x.first5)} -> ${f1(x.last5)} MB`);
  }
  report.start = { trends: t, blocked, runs: runs.map(({ tail, ...r }) => r) };
}

if (ONLY !== "start") {
  const profile = mkdtempSync(join(tmpdir(), "parity-soak-reload-"));
  console.log(`\nreload: one app, ${RELOADS} reloads`);
  const r = await launch("soak-reload", profile, { ...env, PARITY_SOAK_RELOADS: String(RELOADS) }, 60000 + RELOADS * 30000);
  const left = await leftovers(r.metrics?.pids || [], profile);
  for (const pid of left) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
  const bad = [];
  if (r.hung) bad.push("hung");
  if (r.code !== 0 || r.signal) bad.push(`exit ${r.code}${r.signal ? ` ${r.signal}` : ""}`);
  if (r.crashes.length) bad.push(`crash ${JSON.stringify(r.crashes)}`);
  if (r.fails.length) bad.push(r.fails.join("; "));
  if (r.reloads.length < RELOADS) bad.push(`only ${r.reloads.length} of ${RELOADS} reloads finished`);
  if (left.length) bad.push(`${left.length} process(es) left`);
  if (bad.length) { problems.push(`reload: ${bad.join(" | ")}`); console.log(r.tail.slice(-1500)); }
  // The app may open another page process partway (a section it loads ahead, say). That is
  // one step up, not growth, so the totals are judged from the last time the count changed.
  const all = r.reloads;
  let from = all.length;
  while (from > 0 && all[from - 1].rendererCount === all.at(-1)?.rendererCount) from--;
  const steady = all.slice(from);
  const t = [
    trend("reload time", all.map((x) => x.ms), "ms"),
    trend("page renderer", all.map((x) => x.page), "MB", MB),
    trend("page JS heap", all.map((x) => x.pageHeap), "MB", MB),
    trend("main memory", all.map((x) => x.main), "MB", MB),
    trend("all renderers", steady.map((x) => x.renderers), "MB", MB),
    trend("all processes", steady.map((x) => x.total), "MB", MB),
  ];
  console.log(`reload: ${all.length} reloads, ${bad.length ? bad.join(" | ") : "no crash, nothing left behind"}`);
  if (from > 0) {
    const pagePids = new Set(all.map((x) => x.pagePid));
    const extra = (r.pages || []).filter((p) => !pagePids.has(p.pid) && !/__desktop\//.test(p.url)).map((p) => p.url);
    console.log(`  a new page process started at reload ${from + 1} (${all[from - 1].rendererCount} -> ${all[from].rendererCount}, +${f1(MB(all[from].renderers - all[from - 1].renderers))} MB${extra.length ? `, showing ${extra.join(", ")}` : ""}); the totals below start there`);
  }
  for (const x of t) console.log(`  ${show(x)}`);
  if (all.length >= 10) {
    if (grows(t[0], 150)) problems.push(`reload time grows: ${f1(t[0].first5)} -> ${f1(t[0].last5)} ms`);
    for (const x of t.slice(1)) if (x.n >= 10 && grows(x, 15)) problems.push(`${x.label} grows over reloads: ${f1(x.first5)} -> ${f1(x.last5)} MB`);
  }
  report.reload = { trends: t, steadyFrom: from + 1, pages: r.pages, blocked: r.blocked, reloads: all, left, bad };
}

server.close();
report.served = served;
report.problems = problems;
const outDir = join(here, "build", "soak");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `soak-${report.when.replace(/[:.]/g, "-")}.json`);
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\nlocal site answered ${served} requests. Full numbers: ${outFile}`);
if (problems.length) { console.log(`\nFAIL soak:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log("PASS soak: no crash, nothing left behind, no growth");
