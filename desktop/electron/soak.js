// The in-app half of the startup soak test (scripts/soak.mjs). Started through selftest.js
// with PARITY_SELFTEST=soak or soak-reload. It prints plain lines the script reads:
//
//   READY <ms>        the first window has its page and title bar loaded and the page drew
//   METRICS <json>    memory of every process (app.getAppMetrics), in KB
//   RELOAD <i> <ms> <json>   soak-reload only: one reload of the page and memory after it
//   CYCLE <i> <ms> <json>    soak-windows only: one window opened, drawn and closed, then memory
//   IDLE <s> <json>          soak-idle only: memory every 30 s while a live page sits open
//   CRASH <json>      a helper process or a page died
//   BLOCKED <json>    requests that tried to leave this machine (they are cancelled)
//   PAGES <json>      every page the app holds and its process, just before quitting
//
// soak       waits for the window, measures memory, then quits the normal way (app.quit).
// soak-reload  keeps the app open and reloads the page PARITY_SOAK_RELOADS times (default 50).
// soak-windows opens a second window at PARITY_SOAK_PATH, waits for it to draw and closes it,
//              PARITY_SOAK_CYCLES times (default 50).
// soak-idle    leaves the first window on PARITY_SOAK_PATH (a page with live prices) for
//              PARITY_SOAK_IDLE_S seconds (default 1800) and measures memory every 30 s.
//
// The script always runs the app hidden (PARITY_HIDDEN=1, main.js): no window shows or takes
// focus and there is no Dock icon. It runs in CI on a Mac runner (.github/workflows/soak.yml).
//
// Only loopback addresses are allowed, so the soak never touches the live website. Calls to
// Supabase go to a stand-in on the local site instead (scripts/soak.mjs, /__sb/), with a
// made-up session cookie, so the signed-in apps open without any real account.
const { app, session, webContents } = require("electron");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, ms = 30000, step = 50) {
  const end = Date.now() + ms;
  for (;;) {
    let v = false;
    try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() > end) return false;
    await wait(step);
  }
}

const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/;
const LOCAL_SITE = (process.env.PARITY_DEV_URL || "").replace(/\/$/, "");
const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";

/** A made-up session in the cookie @supabase/ssr reads, never sent anywhere but the stand-in. */
async function signIn(partition) {
  if (!LOCAL_SITE) return;
  const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
  const exp = 4102444800;
  const user = { id: "00000000-0000-4000-8000-00000000500a", aud: "authenticated", role: "authenticated", email: "soak@example.com", app_metadata: { provider: "email" }, user_metadata: {}, factors: [], created_at: "2026-01-01T00:00:00Z" };
  const token = `${b64({ alg: "ES256", typ: "JWT" })}.${b64({ iss: "https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1", sub: user.id, aud: "authenticated", role: "authenticated", exp, iat: 1767225600, aal: "aal1", amr: [{ method: "password", timestamp: 1767225600 }], session_id: "soak" })}.${b64("soak")}`;
  const value = `base64-${b64({ access_token: token, token_type: "bearer", expires_in: exp - 1767225600, expires_at: exp, refresh_token: "soak", user })}`;
  await session.fromPartition(partition).cookies.set({ url: LOCAL_SITE, name: COOKIE, value, path: "/", expirationDate: exp, sameSite: "lax" });
}
const blocked = new Map();

/** Cancels every http(s) request that is not to this machine, and keeps a count by host. */
function stayLocal(partition) {
  const handler = (d, cb) => {
    let host = "";
    try { const u = new URL(d.url); if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ws:" || u.protocol === "wss:") host = u.hostname; } catch { /* not a URL */ }
    // The app itself cancels the website's service worker (main.js); this keeps doing that.
    const sw = /\/(sim\/)?sw\.js$/.test(d.url);
    if (LOCAL_SITE && /\.supabase\.co$/.test(host) && /^https:/.test(d.url)) {
      const u = new URL(d.url);
      cb({ redirectURL: `${LOCAL_SITE}/__sb${u.pathname}${u.search}` });
      return;
    }
    if ((host && !LOCAL.test(host)) || sw) {
      if (host && !LOCAL.test(host)) blocked.set(host, (blocked.get(host) || 0) + 1);
      cb({ cancel: true });
      return;
    }
    cb({});
  };
  session.fromPartition(partition).webRequest.onBeforeRequest(handler);
  session.defaultSession.webRequest.onBeforeRequest(handler);
}

function metrics(w) {
  const all = app.getAppMetrics();
  const kb = (m) => m?.memory?.workingSetSize || 0;
  const pagePid = w?.active?.alive ? w.active.wc.getOSProcessId() : null;
  const renderers = all.filter((m) => m.type === "Tab" || m.type === "Renderer");
  return {
    main: kb(all.find((m) => m.type === "Browser")),
    mainHeap: Math.round(process.memoryUsage().heapUsed / 1024),
    renderers: renderers.reduce((s, m) => s + kb(m), 0),
    rendererCount: renderers.length,
    page: kb(all.find((m) => m.pid === pagePid)),
    pagePid,
    gpu: kb(all.find((m) => m.type === "GPU")),
    total: all.reduce((s, m) => s + kb(m), 0),
    processes: all.length,
    pids: all.map((m) => m.pid),
  };
}

async function run(api) {
  const scenario = process.env.PARITY_SELFTEST;
  // The first window already exists when this runs, before any page has gone to the network.
  const partition = api.windows()[0]?.ctx?.PARTITION || "persist:parity";
  stayLocal(partition);
  await signIn(partition);
  app.on("child-process-gone", (_e, d) => console.log(`CRASH ${JSON.stringify({ kind: "process", type: d.type, reason: d.reason, exitCode: d.exitCode })}`));
  app.on("web-contents-created", (_e, wc) => wc.on("render-process-gone", (_e2, d) => console.log(`CRASH ${JSON.stringify({ kind: "page", url: wc.getURL(), reason: d.reason, exitCode: d.exitCode })}`)));
  for (const wc of webContents.getAllWebContents()) wc.on("render-process-gone", (_e2, d) => console.log(`CRASH ${JSON.stringify({ kind: "page", url: wc.getURL(), reason: d.reason, exitCode: d.exitCode })}`));

  const js = (wc, code) => wc.executeJavaScript(code, true);
  const drawn = (w) => w.active && w.active.alive && w.active.path !== null && !w.active.wc.isLoading() && !w.titlebar.webContents.isLoading();
  const painted = (w) => js(w.active.wc, "document.readyState === 'complete' && !!document.body && document.body.innerText.trim().length > 0");

  const w = await until(() => api.windows()[0], 20000);
  if (!w) { console.log("FAIL soak: no window"); app.exit(1); return; }
  const ok = await until(async () => drawn(w) && (await painted(w)), 30000);
  if (!ok) { console.log(`FAIL soak: the window never finished loading (${w.active?.wc?.getURL?.()})`); app.exit(1); return; }
  console.log(`READY ${Math.round(process.uptime() * 1000)}`);

  // Memory a moment after the page is up, once the first burst of work is over.
  await wait(Number(process.env.PARITY_SOAK_SETTLE_MS || 1500));
  console.log(`METRICS ${JSON.stringify({ ...metrics(w), path: w.active.path })}`);

  const heapOf = (wc) => js(wc, "Math.round((performance.memory?.usedJSHeapSize || 0) / 1024)").catch(() => 0);
  const PATH = process.env.PARITY_SOAK_PATH || "/trade/#/markets";

  if (scenario === "soak-windows") {
    const n = Number(process.env.PARITY_SOAK_CYCLES || 50);
    for (let i = 1; i <= n; i++) {
      const t0 = Date.now();
      const w2 = api.newWindow(PATH);
      if (!w2) { console.log(`FAIL soak-windows: cycle ${i} could not open a window`); break; }
      const up = await until(async () => drawn(w2) && (await painted(w2)), 30000);
      if (!up) { console.log(`FAIL soak-windows: cycle ${i} window never finished loading (${w2.active?.wc?.getURL?.()})`); break; }
      const id = w2.id;
      w2.win.close();
      const gone = await until(() => !api.windows().some((x) => x.id === id), 10000);
      if (!gone) { console.log(`FAIL soak-windows: cycle ${i} window did not close`); break; }
      await wait(Number(process.env.PARITY_SOAK_CYCLE_SETTLE_MS || 500));
      console.log(`CYCLE ${i} ${Date.now() - t0} ${JSON.stringify({ ...metrics(w), windows: api.windows().length, contents: webContents.getAllWebContents().length })}`);
    }
  }

  if (scenario === "soak-idle") {
    const secs = Number(process.env.PARITY_SOAK_IDLE_S || 1800);
    const every = Number(process.env.PARITY_SOAK_IDLE_EVERY_S || 30);
    w.go(PATH);
    const up = await until(async () => drawn(w) && w.active.path !== null && (await painted(w)), 30000);
    if (!up) console.log(`FAIL soak-idle: ${PATH} never finished loading`);
    else {
      const t0 = Date.now();
      while ((Date.now() - t0) / 1000 < secs) {
        await wait(every * 1000);
        if (!w.alive || !w.active?.alive) { console.log("FAIL soak-idle: the window or its page went away"); break; }
        console.log(`IDLE ${Math.round((Date.now() - t0) / 1000)} ${JSON.stringify({ ...metrics(w), pageHeap: await heapOf(w.active.wc), path: w.active.path })}`);
      }
    }
  }

  if (scenario === "soak-reload") {
    const n = Number(process.env.PARITY_SOAK_RELOADS || 50);
    const heap = () => js(w.active.wc, "Math.round((performance.memory?.usedJSHeapSize || 0) / 1024)").catch(() => 0);
    for (let i = 1; i <= n; i++) {
      const before = w.active.wc.getURL();
      const wc = w.active.wc;
      // Waits for this reload's own load to finish, so a page that is still up from before
      // does not count as reloaded.
      const loaded = new Promise((ok) => { wc.once("did-finish-load", () => ok(true)); setTimeout(() => ok(false), 30000); });
      const t0 = Date.now();
      // The app's own Reload (View menu): loads the page's path again.
      w.reload(false);
      const back = (await loaded) && (await until(async () => drawn(w) && (await painted(w)), 30000));
      const ms = Date.now() - t0;
      if (!back) { console.log(`FAIL soak-reload: reload ${i} never finished (${before})`); break; }
      await wait(Number(process.env.PARITY_SOAK_RELOAD_SETTLE_MS || 400));
      console.log(`RELOAD ${i} ${ms} ${JSON.stringify({ ...metrics(w), pageHeap: await heap() })}`);
    }
  }

  console.log(`BLOCKED ${JSON.stringify(Object.fromEntries(blocked))}`);
  // What each page process is showing, to tell a new section page from a leak.
  console.log(`PAGES ${JSON.stringify(webContents.getAllWebContents().map((wc) => ({ pid: wc.getOSProcessId(), url: wc.getURL().replace(/^https?:\/\/127\.0\.0\.1:\d+/, "") })))}`);
  // Quit the way a person does (Cmd+Q): windows close, state is saved, then the app exits.
  app.quit();
}

module.exports = { run };
