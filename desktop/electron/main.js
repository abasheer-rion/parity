// Parity for Mac and Windows (DEC-0041, DEC-0048). One window: a slim sidebar on the left
// and the website's pages on the right.
//
//   Pages       online, the live site (parity.endyland.com and the sim., trade., academy. and
//               lab. addresses), so the app always matches the website with no reinstall.
//               Offline, the copy of the site bundled in the app at app://parity/, with a
//               thin "Offline, showing saved copy" line above it.
//   Offline     a quick check of the website before the first page (2.5 s at most), a failed
//               page load, or a page that has not started arriving after 1.5 s and a second
//               check that fails. While offline the app checks every 15 s and goes back to
//               the live page when the website answers.
//   Data        live pages fetch their own data. The bundled copy fetches /data/ and the rest
//               from the website, with the access token as a bearer header.
//   Links       parity:// and the website's addresses open inside the app; every other
//               address opens in the browser.
//   Sign-in     live pages keep the session in the website's cookie on .endyland.com, stored
//               in the app's own partition (persist:parity), so it survives restarts.
//   Trust       only the bundled copy and the website's addresses may load in the page view,
//               get the page bridge, ask for permissions or send messages to this process.
//
// For testing: PARITY_LIVE_ORIGIN points the app at another address (an unreachable one
// shows the offline copy), and PARITY_LOG=1 prints each page the app loads.
const { app, BaseWindow, WebContentsView, Menu, Notification, ipcMain, nativeImage, nativeTheme, net, protocol, screen, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const routes = require("./routes");
const SECTIONS = require("./sections");
const windowState = require("./window-state");
const updater = require("./updater");

const SCHEME = "parity";
const PARTITION = "persist:parity";
const SIDEBAR_W = 76;
const OFFLINE_BAR_H = 28;
const SHELL_FILES = new Set(["sidebar.html", "sidebar.js", "offline.html"]);

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..", "build", "web");
const DEV_URL = (process.env.PARITY_DEV_URL || "").replace(/\/$/, "") || null;
const ORIGIN = (process.env.PARITY_LIVE_ORIGIN || readJson(path.join(WEB_ROOT, "desktop.json"))?.origin || "https://parity.endyland.com").replace(/\/$/, "");
const TRUSTED = routes.trustedOrigins(ORIGIN).concat(DEV_URL ? [new URL(DEV_URL).origin] : []);
const sections = routes.visibleSections(SECTIONS, WEB_ROOT);

let win = null, sidebar = null, view = null, bar = null;
let online = null; // null until the first check
let offlineShown = false;
let retry = null;
let watchdog = null;
let token = null;
let pending = null;
let active = "home";
let currentPath = "/";
const shown = new Set();

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
const log = (msg) => { if (!app.isPackaged || process.env.PARITY_LOG) console.log(`[parity] ${process.uptime().toFixed(1)}s ${msg}`); };

// ---------------------------------------------------------------- one copy, parity:// links

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${SCHEME}://`));
    if (link) openLink(link);
    else focus();
  });
}
app.on("open-url", (e, url) => { e.preventDefault(); openLink(url); });
if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
else if (process.platform === "win32") app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1] || ".")]);

function openLink(link) {
  const p = routes.toAppPath(link, ORIGIN);
  if (!p) return;
  if (!view) { pending = p; return; }
  go(p);
  focus();
}

function focus() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------------------------------------------------------------- app://parity

const notFound = () => new Response(
  `<!doctype html><meta charset="utf-8"><title>Not found · Parity</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#050608;color:#a4a8b6;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><p>This page is not in the app. <a style="color:#5cc2f5" href="/">Go to the front page</a></p>`,
  { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

async function proxy(req, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Not allowed", { status: 405 });
  const headers = { Accept: req.headers.get("accept") || "*/*" };
  if (url.pathname.startsWith("/data/") && token) headers.Authorization = `Bearer ${token}`;
  try {
    return await net.fetch(`${ORIGIN}${url.pathname}${url.search}`, { method: req.method, headers, bypassCustomProtocolHandlers: true });
  } catch {
    return new Response("Could not reach Parity. Check the connection.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function handle(req) {
  const url = new URL(req.url);
  if (url.host !== "parity") return notFound();
  if (url.pathname.startsWith("/__desktop/")) {
    const name = url.pathname.slice("/__desktop/".length);
    return SHELL_FILES.has(name) ? net.fetch(pathToFileURL(path.join(__dirname, name)).toString()) : notFound();
  }
  const r = routes.resolveRequest(WEB_ROOT, url.pathname);
  if (r.file) return net.fetch(pathToFileURL(r.file).toString());
  if (r.redirect) {
    const keep = r.redirect.includes("#") || r.redirect.includes("?") ? "" : url.search;
    return new Response(null, { status: 302, headers: { Location: `${r.redirect}${keep}` } });
  }
  if (r.proxy) return proxy(req, url);
  return notFound();
}

// ---------------------------------------------------------------- the window

const isDev = (url) => !!DEV_URL && (url === DEV_URL || url.startsWith(`${DEV_URL}/`));
const isTrusted = (url) => isDev(url) || routes.isTrusted(url, ORIGIN);
const isSaved = (url) => url.startsWith(`${routes.APP_ORIGIN}/`);
/** The in-app path of an address loaded in the page view, or null. */
const appPathOf = (url) => (isDev(url) ? url.slice(DEV_URL.length) || "/" : isTrusted(url) ? routes.toAppPath(url, ORIGIN) : null);
const liveUrl = (p) => (DEV_URL ? `${DEV_URL}${p}` : routes.liveUrl(p, ORIGIN));
// URL.origin is "null" for app://, so the origin is built by hand.
const trustedUrl = (u) => {
  try { const x = new URL(u || ""); return TRUSTED.includes(`${x.protocol}//${x.host}`); } catch { return false; }
};
const trustedSender = (e) => trustedUrl(e.senderFrame?.url);

/** Does the website answer? A small public file, given `ms` to arrive. */
async function check(ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await session.fromPartition(PARTITION).fetch(`${DEV_URL || ORIGIN}/favicon.svg`, { method: "HEAD", cache: "no-store", signal: ctl.signal, bypassCustomProtocolHandlers: true });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function setOnline(value) {
  online = value;
  if (value) { clearInterval(retry); retry = null; return; }
  if (retry) return;
  retry = setInterval(async () => {
    if (!(await check(2500))) return;
    log("the website answers again, going back to the live page");
    setOnline(true);
    if (offlineShown) go(currentPath);
  }, 15000);
}

/** Opens an in-app path: live when online, else the saved copy. */
async function go(p) {
  if (!view) return;
  if (online === null) setOnline(await check(2000));
  if (!view) return;
  if (online) loadLive(p);
  else loadSaved(p);
}

function loadLive(p) {
  const url = liveUrl(p);
  log(`loading ${url}`);
  clearTimeout(watchdog);
  // A page that has not started arriving after 1.5 s gets a second, short check.
  watchdog = setTimeout(async () => {
    watchdog = null;
    if (!(await check(1200))) fallBack(p, "no answer");
  }, 1500);
  view.webContents.loadURL(url).catch(() => {});
}

function loadSaved(p) {
  const url = `${routes.APP_ORIGIN}${p}`;
  log(`loading saved copy ${url}`);
  view.webContents.loadURL(url).catch(() => {});
}

function fallBack(p, why) {
  if (!view) return;
  log(`offline (${why}), showing the saved copy`);
  clearTimeout(watchdog);
  watchdog = null;
  setOnline(false);
  loadSaved(p);
}

function showOffline(on) {
  if (on === offlineShown) return;
  offlineShown = on;
  layout();
}

/** An address a page tried to open: keep it in the app if it is ours, else the browser. */
function route(url) {
  const p = routes.toAppPath(url, ORIGIN);
  if (p) go(p);
  else if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
}

function onNavigated(url) {
  const p = appPathOf(url);
  if (!p) return;
  currentPath = p;
  showOffline(isSaved(url));
  const id = routes.activeSection(`${routes.APP_ORIGIN}${p}`, sections);
  if (id && id !== active) {
    active = id;
    sidebar?.webContents.send("sidebar:active", id);
  }
}

function layout() {
  if (!win || win.isDestroyed()) return;
  const { width, height } = win.getContentBounds();
  const w = Math.max(0, width - SIDEBAR_W);
  const top = offlineShown ? OFFLINE_BAR_H : 0;
  sidebar.setBounds({ x: 0, y: 0, width: SIDEBAR_W, height });
  bar.setBounds({ x: SIDEBAR_W, y: 0, width: w, height: top });
  bar.setVisible(offlineShown);
  view.setBounds({ x: SIDEBAR_W, y: top, width: w, height: Math.max(0, height - top) });
}

function createWindow() {
  const state = windowState.load(app.getPath("userData"), screen.getAllDisplays());
  const mac = process.platform === "darwin";
  win = new BaseWindow({
    title: "Parity",
    x: state.x, y: state.y, width: state.width, height: state.height,
    minWidth: 960, minHeight: 600,
    backgroundColor: "#050608",
    ...(mac ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 18 } } : { icon: path.join(__dirname, "..", "assets", "icon.png") }),
  });

  const prefs = { contextIsolation: true, sandbox: true, nodeIntegration: false, partition: PARTITION, spellcheck: true };
  sidebar = new WebContentsView({ webPreferences: { ...prefs, preload: path.join(__dirname, "sidebar-preload.js") } });
  view = new WebContentsView({ webPreferences: { ...prefs, preload: path.join(__dirname, "preload.js"), additionalArguments: [`--parity-version=${app.getVersion()}`, `--parity-origins=${TRUSTED.join(",")}`] } });
  bar = new WebContentsView({ webPreferences: { ...prefs } });
  for (const v of [sidebar, view, bar]) v.setBackgroundColor("#050608");
  win.contentView.addChildView(sidebar);
  win.contentView.addChildView(bar);
  win.contentView.addChildView(view);
  layout();
  win.on("resize", layout);
  if (state.maximized) win.maximize();
  if (state.fullscreen) win.setFullScreen(true);

  const wc = view.webContents;
  wc.on("will-navigate", (e, url) => { if (!isTrusted(url)) { e.preventDefault(); route(url); } });
  wc.on("will-redirect", (e, url) => { if (!isTrusted(url)) { e.preventDefault(); route(url); } });
  wc.setWindowOpenHandler(({ url }) => { route(url); return { action: "deny" }; });
  wc.on("did-navigate", (_e, url) => { clearTimeout(watchdog); watchdog = null; log(`loaded ${url}`); onNavigated(url); });
  wc.on("did-navigate-in-page", (_e, url) => onNavigated(url));
  // A live page that cannot load (no connection, no answer) opens from the saved copy.
  wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || isSaved(url)) return; // -3: replaced by another load
    const p = appPathOf(url);
    if (p) fallBack(p, desc || String(code));
  });
  wc.on("page-title-updated", (_e, title) => win?.setTitle(title || "Parity"));
  for (const c of [wc, sidebar.webContents, bar.webContents]) {
    c.on("will-attach-webview", (e) => e.preventDefault());
  }
  for (const c of [sidebar.webContents, bar.webContents]) {
    c.on("will-navigate", (e) => e.preventDefault());
    c.setWindowOpenHandler(() => ({ action: "deny" }));
  }

  sidebar.webContents.loadURL(`${routes.APP_ORIGIN}/__desktop/sidebar.html`);
  bar.webContents.loadURL(`${routes.APP_ORIGIN}/__desktop/offline.html`);
  const start = pending || state.lastPath || "/";
  pending = null;
  go(start);

  win.on("close", () => windowState.save(app.getPath("userData"), win, currentPath));
  win.on("closed", () => { win = null; view = null; sidebar = null; bar = null; });
}

// ---------------------------------------------------------------- messages from the pages

// Only the page view's top frame, showing a trusted address, may send these.
const fromView = (e) => !!view && e.sender === view.webContents && e.senderFrame === view.webContents.mainFrame && trustedSender(e);

ipcMain.on("parity:token", (e, t) => {
  if (!fromView(e)) return;
  token = typeof t === "string" && t.length > 0 && t.length < 8192 ? t : null;
});

ipcMain.on("parity:notify", (e, msg) => {
  if (!fromView(e) || !Notification.isSupported() || !msg) return;
  const n = new Notification({ title: String(msg.title).slice(0, 120), body: String(msg.body).slice(0, 240) });
  const href = typeof msg.href === "string" && msg.href.startsWith("/") && !msg.href.startsWith("//") ? msg.href : null;
  n.on("click", () => { focus(); if (href) go(href); shown.delete(n); });
  n.on("close", () => shown.delete(n));
  shown.add(n); // keep a reference until it is dismissed, or the click is lost
  n.show();
});

ipcMain.on("parity:open", (e, url) => {
  if (fromView(e) && typeof url === "string" && /^https:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle("sidebar:sections", (e) => {
  if (!sidebar || e.sender !== sidebar.webContents) return { sections: [], platform: process.platform, active };
  return { sections: sections.map(({ id, label, icon, bottom, key }) => ({ id, label, icon, bottom: !!bottom, key })), platform: process.platform, active };
});

ipcMain.on("sidebar:go", (e, id) => {
  if (!sidebar || e.sender !== sidebar.webContents) return;
  const s = sections.find((x) => x.id === id);
  if (s) go(s.path);
});

// ---------------------------------------------------------------- the menu

function buildMenu() {
  const mac = process.platform === "darwin";
  const wc = () => view?.webContents;
  const zoom = (d) => { const c = wc(); if (c) c.setZoomLevel(d === 0 ? 0 : c.getZoomLevel() + d); };
  const goItems = sections.filter((s) => s.key).map((s) => ({
    label: s.label,
    accelerator: `CmdOrCtrl+${s.key}`,
    click: () => go(s.path),
  }));
  const template = [
    ...(mac ? [{
      label: "Parity",
      submenu: [
        { role: "about" },
        { label: "Pages load live from parity.endyland.com", enabled: false },
        { type: "separator" },
        { label: "Account settings", accelerator: "Cmd+,", click: () => go("/app/#/settings/account") },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : [{ label: "File", submenu: [{ role: "quit", label: "Exit" }] }]),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        // Reload checks the website again, so it can leave the saved copy.
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => { online = null; go(currentPath); } },
        { label: "Reload without cache", accelerator: "Shift+CmdOrCtrl+R", click: () => wc()?.reloadIgnoringCache() },
        { label: "Developer tools", accelerator: mac ? "Alt+Cmd+I" : "Ctrl+Shift+I", click: () => wc()?.toggleDevTools() },
        { type: "separator" },
        { label: "Actual size", accelerator: "CmdOrCtrl+0", click: () => zoom(0) },
        { label: "Zoom in", accelerator: "CmdOrCtrl+=", click: () => zoom(0.5) },
        { label: "Zoom out", accelerator: "CmdOrCtrl+-", click: () => zoom(-0.5) },
        { type: "separator" },
        { label: "Full screen", accelerator: mac ? "Ctrl+Cmd+F" : "F11", click: () => win?.setFullScreen(!win.isFullScreen()) },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Back", accelerator: mac ? "Cmd+[" : "Alt+Left", click: () => { const h = wc()?.navigationHistory; if (h?.canGoBack()) h.goBack(); } },
        { label: "Forward", accelerator: mac ? "Cmd+]" : "Alt+Right", click: () => { const h = wc()?.navigationHistory; if (h?.canGoForward()) h.goForward(); } },
        { type: "separator" },
        ...goItems,
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Risk notice", click: () => go("/legal/risk/") },
        { label: "Privacy policy", click: () => go("/legal/privacy/") },
        { label: "Terms of service", click: () => go("/legal/terms/") },
        { type: "separator" },
        { label: "Open parity.endyland.com in the browser", click: () => shell.openExternal(ORIGIN) },
        { label: "Email Parity", click: () => shell.openExternal("mailto:contact@paritytrading.ai") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- screenshots (PARITY_SHOTS=1)

async function capture() {
  const sf = screen.getPrimaryDisplay().scaleFactor || 1;
  const [a, b, c] = await Promise.all([sidebar.webContents.capturePage(), view.webContents.capturePage(), offlineShown ? bar.webContents.capturePage() : null]);
  const bits = (img) => {
    const { width, height } = img.getSize(sf);
    const buf = img.toBitmap({ scaleFactor: sf });
    const w = buf.length === width * height * 4 ? width : img.getSize().width;
    const h = buf.length / (w * 4);
    return { buf, w, h };
  };
  const A = bits(a);
  let B = bits(b);
  if (c) { // the offline line sits above the page
    const C = bits(c);
    const buf = Buffer.alloc(B.w * (C.h + B.h) * 4);
    for (let y = 0; y < C.h; y++) C.buf.copy(buf, y * B.w * 4, y * C.w * 4, y * C.w * 4 + Math.min(C.w, B.w) * 4);
    B.buf.copy(buf, C.h * B.w * 4);
    B = { buf, w: B.w, h: C.h + B.h };
  }
  const w = A.w + B.w, h = Math.max(A.h, B.h);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (y < A.h) A.buf.copy(out, y * w * 4, y * A.w * 4, (y + 1) * A.w * 4);
    if (y < B.h) B.buf.copy(out, (y * w + A.w) * 4, y * B.w * 4, (y + 1) * B.w * 4);
  }
  return nativeImage.createFromBitmap(out, { width: w, height: h, scaleFactor: sf }).toPNG();
}

async function shots() {
  const dir = process.env.PARITY_SHOTS_DIR || path.join(app.getPath("desktop"), "parity-app");
  const prefix = process.env.PARITY_SHOTS_PREFIX || "";
  fs.mkdirSync(dir, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const list = (process.env.PARITY_SHOTS_PATHS || "").split(",").filter(Boolean);
  const targets = list.length ? list.map((p, i) => ({ id: `page${i + 1}`, path: p })) : sections;
  let n = 0;
  for (const s of targets) {
    go(s.path);
    await wait(Number(process.env.PARITY_SHOTS_WAIT || 5000));
    const file = path.join(dir, `${prefix}${String(++n).padStart(2, "0")}-${s.id}.png`);
    let png = null;
    for (let tries = 0; !png && tries < 5; tries++) {
      try { png = await capture(); } catch (e) { console.log(`capture failed (${e.message}), retrying`); focus(); await wait(1500); }
    }
    if (png) { fs.writeFileSync(file, png); console.log(`wrote ${file}`); }
  }
  app.quit();
}

// ---------------------------------------------------------------- start

app.whenReady().then(() => {
  nativeTheme.themeSource = "dark";
  if (process.platform === "win32") app.setAppUserModelId("ai.paritytrading.desktop");
  const ses = session.fromPartition(PARTITION);
  ses.protocol.handle("app", handle);
  const allowed = new Set(["notifications", "clipboard-sanitized-write", "fullscreen"]);
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed.has(permission) && trustedUrl(details?.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && trustedUrl(origin));
  // The website's service workers keep their own offline copies. In the app the bundled copy
  // does that job, and a worker answering for a dead connection would hide it, so they are
  // not installed here.
  ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
  ses.webRequest.onBeforeRequest({ urls: ["https://*/sw.js", "https://*/sim/sw.js"] }, (d, cb) => cb({ cancel: trustedUrl(d.url) }));
  const link = process.argv.find((a) => a.startsWith(`${SCHEME}://`));
  if (link) pending = routes.toAppPath(link, ORIGIN);
  if (process.env.PARITY_SHOTS) pending = "/";
  buildMenu();
  createWindow();
  updater.start(app, log);
  if (process.env.PARITY_SHOTS) setTimeout(() => { shots().catch((e) => { console.error(e); app.quit(); }); }, 3000);
});

app.on("activate", () => { if (!win) createWindow(); });
// Write the sign-in cookies to disk before quitting, so the next launch is still signed in.
app.on("before-quit", () => { session.fromPartition(PARTITION).cookies.flushStore().catch(() => {}); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
