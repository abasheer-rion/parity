// Soak test for the desktop app (REF-0025). Four parts:
//   start    launches the app 50 times in a row with one profile (like a person opening it
//            every day), waits for the window to finish loading, records the time and memory,
//            quits it the normal way and checks nothing crashed and no process was left behind.
//   windows  keeps one app open and opens and closes a second window 50 times.
//   reload   keeps one app open and reloads the page 50 times.
//   idle     keeps one app open on a page with live prices for 30 minutes, memory every 30 s.
// Each looks for memory that keeps growing. The app talks only to a local copy of the site
// (build/web), served here, and to a stand-in for the live price feed served here too (the
// copy must be built with VITE_LIVE_ORIGIN=ws://127.0.0.1:<port>, see soak.yml). Anything
// that tries to leave this machine is cancelled inside the app (electron/soak.js).
//
// The app runs hidden (PARITY_HIDDEN=1): no window shows or takes focus, no Dock icon, its own
// profile folder. Even so a Mac can flash a Dock icon for a moment as Electron starts, so this
// refuses to run outside CI unless PARITY_SOAK_LOCAL=1. It runs on a Mac runner in
// .github/workflows/soak.yml.
//
// Run: npm run soak   (in CI)
//   options: --runs=50 --cycles=50 --reloads=50 --idle=1800 --only=start,windows,reload,idle
//            --fresh (a new profile every launch)   SOAK_PORT=4317 (the local site's port)
// It exits 1 on a crash, a hang, a process left behind, or startup time or memory that grows.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { performance } from "node:perf_hooks";

// --only=serve starts the local site and the live stand-in and nothing else (no app), for
// trying the stand-in by hand.
if (!process.env.CI && process.env.PARITY_SOAK_LOCAL !== "1" && !process.argv.includes("--only=serve")) {
  console.error("The soak test runs in CI only (.github/workflows/soak.yml), so nothing can appear on this screen. PARITY_SOAK_LOCAL=1 runs it here anyway.");
  process.exit(2);
}
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
const CYCLES = Number(arg("cycles", 50));
const IDLE_S = Number(arg("idle", 1800));
const ONLY = arg("only", null);
const PARTS = new Set(ONLY ? String(ONLY).split(",") : ["start", "windows", "reload", "idle"]);
const PORT = Number(process.env.SOAK_PORT || 4317);
const FRESH = !!arg("fresh", false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ the local site

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let served = 0;
const SYMS = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK", "LTC", "BCH", "ATOM", "NEAR", "UNI", "XLM", "ETC", "FIL", "APT", "ARB", "OP"].map((s) => `${s}-USD`);
const live = { opened: 0, open: 0, sent: 0, pings: 0 };
const UNIVERSE = { at: Date.now(), stocks: [], live: { coingecko: SYMS } };

function serve() {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      served++;
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.startsWith("/__sb/")) { supabaseStandIn(req, res, p.slice(5)); return; }
      if (p === "/live/universe") { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(UNIVERSE)); return; }
      if (p === "/live/me") { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ team: false, until: null, sources: [] })); return; }
      if (p.startsWith("/live/")) { res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not in the soak test" })); return; }
      let file = normalize(join(web, p));
      if (!file.startsWith(web)) { res.writeHead(403).end(); return; }
      try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* 404 below */ }
      if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(req.method === "HEAD" ? undefined : readFileSync(file));
    });
    server.on("upgrade", liveSocket);
    server.on("error", (e) => { console.error(`The local site could not listen on 127.0.0.1:${PORT}: ${e.message}`); process.exit(1); });
    server.listen(PORT, "127.0.0.1", () => ok(server));
  });
}

// ------------------------------------------------------------------ the Supabase stand-in

/** Just enough of Supabase for a signed-in app to open: the user, empty tables, quiet writes. */
const sbCalls = {};
function supabaseStandIn(req, res, p) {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin || "*", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "content-range" };
  const key = `${req.method} ${p.split("/").slice(0, 4).join("/")}`;
  sbCalls[key] = (sbCalls[key] || 0) + 1;
  const json = (status, body, extra = {}) => res.writeHead(status, { "Content-Type": "application/json", ...cors, ...extra }).end(body === undefined ? "" : JSON.stringify(body));
  if (req.method === "OPTIONS") { res.writeHead(204, cors).end(); return; }
  if (p === "/auth/v1/user") return json(200, { id: "00000000-0000-4000-8000-00000000500a", aud: "authenticated", role: "authenticated", email: "soak@example.com", app_metadata: { provider: "email" }, user_metadata: {}, factors: [], created_at: "2026-01-01T00:00:00Z" });
  if (p.startsWith("/auth/v1/")) return json(200, {});
  if (p.startsWith("/rest/v1/rpc/")) return json(200, null);
  if (p.startsWith("/rest/v1/")) {
    if (req.method === "GET" || req.method === "HEAD") return (req.headers.accept || "").includes("vnd.pgrst.object") ? json(406, { code: "PGRST116", message: "no rows" }) : json(200, [], { "content-range": "*/0" });
    return json(req.method === "POST" ? 201 : 204, req.method === "POST" ? [] : undefined);
  }
  return json(404, { message: "not in the soak stand-in" });
}

// ------------------------------------------------------------------ the live feed stand-in

/**
 * A stand-in for /live/ws (the parity-live fan-out), speaking the same messages
 * (web/src/lib/live/protocol.ts): hello and state on opening, the full market overview on
 * subscribing to "*", then every second an overview update and a price update for each
 * subscribed symbol, and a pong for each ping. Made-up prices; nothing leaves this machine.
 */
function liveSocket(req, socket) {
  const url = new URL(req.url, "http://x");
  const key = req.headers["sec-websocket-key"];
  if (url.pathname !== "/live/ws" || !key) { socket.destroy(); return; }
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  const offered = String(req.headers["sec-websocket-protocol"] || "").split(",").map((x) => x.trim());
  socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, ...(offered.includes("parity-live") ? ["Sec-WebSocket-Protocol: parity-live"] : []), "", ""].join("\r\n"));
  live.opened++; live.open++;
  const src = url.searchParams.get("src") || "coingecko";
  const subs = new Set();
  const seq = new Map();
  const price = new Map(SYMS.map((s, i) => [s, 100 * (i + 1)]));
  let closed = false;
  const send = (m) => {
    if (closed) return;
    const body = Buffer.from(JSON.stringify(m));
    const n = body.length;
    const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
    socket.write(Buffer.concat([head, body]));
    live.sent++;
  };
  const rows = (now) => SYMS.map((s) => [s, price.get(s), 1.5, 1e6, now]);
  const now0 = Date.now();
  send({ op: "hello", src, feed: "delayed", delay: 1, ts: now0, max: 200 });
  send({ op: "state", up: "up", ts: now0 });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const s of SYMS) price.set(s, Math.max(1, price.get(s) * (1 + (Math.random() - 0.5) / 500)));
    if (subs.has("*")) send({ op: "r", d: rows(now), ts: now });
    const d = [...subs].filter((k) => SYMS.includes(k)).map((s) => {
      const p = price.get(s); const q = (seq.get(s) || 0) + 1; seq.set(s, q);
      return { s, o: p, p, h: p, l: p, v: 1, n: 1, te: now - 50, tr: now - 20, ts: now, q };
    });
    if (d.length) send({ op: "t", d });
  }, 1000);
  const end = () => { if (closed) return; closed = true; live.open--; clearInterval(timer); socket.destroy(); };
  let buf = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 15;
      let len = buf[1] & 127, at = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); at = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); at = 10; }
      const masked = (buf[1] & 128) !== 0;
      if (buf.length < at + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(at, at + 4) : null;
      at += masked ? 4 : 0;
      const data = Buffer.from(buf.subarray(at, at + len));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(at + len);
      if (op === 8) { end(); return; }
      if (op === 9) { socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op !== 1) continue;
      let m; try { m = JSON.parse(data.toString("utf8")); } catch { continue; }
      if (m.op === "ping") { live.pings++; send({ op: "pong", c: m.c, ts: Date.now() }); }
      else if (m.op === "sub" && Array.isArray(m.s)) {
        for (const k of m.s) subs.add(String(k));
        const now = Date.now();
        if (m.s.includes("*")) send({ op: "r", full: 1, d: rows(now), ts: now });
      } else if (m.op === "unsub" && Array.isArray(m.s)) for (const k of m.s) subs.delete(String(k));
    }
  });
  socket.on("close", end);
  socket.on("error", end);
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
    const r = { readyMs: null, appReadyMs: null, metrics: null, reloads: [], cycles: [], idle: [], crashes: [], blocked: {}, fails: [], code: null, signal: null, hung: false, tail: "" };
    let buf = "";
    const line = (l) => {
      let m;
      if ((m = /^READY (\d+)/.exec(l))) { r.readyMs = Math.round(performance.now() - t0); r.appReadyMs = Number(m[1]); }
      else if ((m = /^METRICS (.*)$/.exec(l))) r.metrics = JSON.parse(m[1]);
      else if ((m = /^RELOAD (\d+) (\d+) (.*)$/.exec(l))) { r.reloads.push({ i: Number(m[1]), ms: Number(m[2]), ...JSON.parse(m[3]) }); if (Number(m[1]) % 10 === 0) console.log(`  reload ${m[1]}`); }
      else if ((m = /^CYCLE (\d+) (\d+) (.*)$/.exec(l))) { r.cycles.push({ i: Number(m[1]), ms: Number(m[2]), ...JSON.parse(m[3]) }); if (Number(m[1]) % 10 === 0) console.log(`  cycle ${m[1]}`); }
      else if ((m = /^IDLE (\d+) (.*)$/.exec(l))) { r.idle.push({ s: Number(m[1]), ...JSON.parse(m[2]) }); if (Number(m[1]) % 300 < 30) console.log(`  idle ${m[1]} s`); }
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
const env = { PARITY_DEV_URL: url, PARITY_LIVE_ORIGIN: url, PARITY_AUTH_BYPASS: "1", PARITY_HIDDEN: "1" };
if (PARTS.has("serve")) { console.log(`serving ${url} and the live stand-in at ${url.replace("http", "ws")}/live/ws (Ctrl+C stops)`); await new Promise(() => {}); }
const problems = [];
const report = { when: new Date().toISOString(), runs: RUNS, cycles: CYCLES, reloads: RELOADS, idleSeconds: IDLE_S, fresh: FRESH, url };

if (PARTS.has("start")) {
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

if (PARTS.has("reload")) {
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

/** One app kept open for a part that reports lines of memory (windows, idle). */
async function longRun(part, scenario, extraEnv, timeoutMs, tag) {
  const profile = mkdtempSync(join(tmpdir(), `parity-soak-${part}-`));
  const r = await launch(scenario, profile, { ...env, ...extraEnv }, timeoutMs);
  const left = await leftovers(r.metrics?.pids || [], profile);
  for (const pid of left) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
  const bad = [];
  if (r.hung) bad.push("hung");
  if (r.code !== 0 || r.signal) bad.push(`exit ${r.code}${r.signal ? ` ${r.signal}` : ""}`);
  if (r.crashes.length) bad.push(`crash ${JSON.stringify(r.crashes)}`);
  if (r.fails.length) bad.push(r.fails.join("; "));
  if (left.length) bad.push(`${left.length} process(es) left`);
  if (bad.length) console.log(r.tail.slice(-1500));
  return { r, bad, rows: r[tag] };
}

if (PARTS.has("windows")) {
  console.log(`\nwindows: one app, a second window opened and closed ${CYCLES} times`);
  const { r, bad, rows } = await longRun("windows", "soak-windows", { PARITY_SOAK_CYCLES: String(CYCLES) }, 60000 + CYCLES * 40000, "cycles");
  if (rows.length < CYCLES) bad.push(`only ${rows.length} of ${CYCLES} cycles finished`);
  if (bad.length) problems.push(`windows: ${bad.join(" | ")}`);
  const t = [
    trend("open, draw, close", rows.map((x) => x.ms), "ms"),
    trend("main memory", rows.map((x) => x.main), "MB", MB),
    trend("main JS heap", rows.map((x) => x.mainHeap), "MB", MB),
    trend("all renderers", rows.map((x) => x.renderers), "MB", MB),
    trend("all processes", rows.map((x) => x.total), "MB", MB),
    trend("page processes", rows.map((x) => x.rendererCount), "count"),
  ];
  console.log(`windows: ${rows.length} cycles, ${bad.length ? bad.join(" | ") : "no crash, nothing left behind"}; pages held at the end ${rows.at(-1)?.contents ?? "-"}`);
  for (const x of t) console.log(`  ${show(x)}`);
  if (rows.length >= 10) {
    if (grows(t[0], 300)) problems.push(`window open time grows: ${f1(t[0].first5)} -> ${f1(t[0].last5)} ms`);
    for (const x of t.slice(1, 5)) if (grows(x, 15)) problems.push(`${x.label} grows over window cycles: ${f1(x.first5)} -> ${f1(x.last5)} MB`);
    if (t[5].last5 - t[5].first5 >= 1) problems.push(`page processes pile up: ${f1(t[5].first5)} -> ${f1(t[5].last5)}`);
  }
  report.windows = { trends: t, cycles: rows, bad, blocked: r.blocked };
}

if (PARTS.has("idle")) {
  const every = Number(process.env.PARITY_SOAK_IDLE_EVERY_S || 30);
  console.log(`\nidle: one app on a live page for ${IDLE_S} s, memory every ${every} s`);
  const before = { ...live };
  const { r, bad, rows } = await longRun("idle", "soak-idle", { PARITY_SOAK_IDLE_S: String(IDLE_S), PARITY_SOAK_IDLE_EVERY_S: String(every) }, 120000 + IDLE_S * 1000 * 1.2, "idle");
  const feed = { sockets: live.opened - before.opened, messages: live.sent - before.sent, pings: live.pings - before.pings };
  const want = Math.floor(IDLE_S / every);
  if (rows.length < want) bad.push(`only ${rows.length} of ${want} samples`);
  // The page should hold one socket and keep pinging: a page that stopped listening, or
  // reconnects over and over, is a problem even if memory looks fine. The window is hidden,
  // so like a minimised one Chromium runs its timers about once a minute: a ping every 15 s
  // arrives about once a minute here.
  if (feed.messages < IDLE_S * 0.5) bad.push(`the page got only ${feed.messages} live messages`);
  if (feed.pings < IDLE_S / 90) bad.push(`the page pinged only ${feed.pings} times (it stopped listening?)`);
  if (feed.sockets > 3) bad.push(`the page opened ${feed.sockets} sockets (reconnecting)`);
  if (bad.length) problems.push(`idle: ${bad.join(" | ")}`);
  // The first few minutes are the page settling in (caches, the chart history); judge the rest.
  const steady = rows.filter((x) => x.s >= 300);
  const t = [
    trend("page renderer", steady.map((x) => x.page), "MB", MB),
    trend("page JS heap", steady.map((x) => x.pageHeap), "MB", MB),
    trend("main memory", steady.map((x) => x.main), "MB", MB),
    trend("all processes", steady.map((x) => x.total), "MB", MB),
  ];
  console.log(`idle: ${rows.length} samples, live feed ${JSON.stringify(feed)}, ${bad.length ? bad.join(" | ") : "no crash, nothing left behind"}`);
  for (const x of t) console.log(`  ${show(x)}`);
  if (steady.length >= 10) for (const x of t) if (grows(x, 20)) problems.push(`${x.label} grows while idle: ${f1(x.first5)} -> ${f1(x.last5)} MB`);
  report.idle = { trends: t, feed, samples: rows, bad, blocked: r.blocked };
}

server.close();
report.served = served;
report.supabaseStandIn = sbCalls;
report.problems = problems;
const outDir = join(here, "build", "soak");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `soak-${report.when.replace(/[:.]/g, "-")}.json`);
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\nlocal site answered ${served} requests. Full numbers: ${outFile}`);
if (problems.length) { console.log(`\nFAIL soak:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log("PASS soak: no crash, nothing left behind, no growth");
