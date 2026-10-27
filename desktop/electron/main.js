// Parity for Mac and Windows (DEC-0041, DEC-0048, DEC-0049).
//
//   Windows     each window has a slim title bar you can drag, a menu button that opens the
//               sections, and the page under it edge to edge (window.js). Any section or page
//               can open in its own window; every window, with its page, size and place, opens
//               again at launch, and named workspaces restore a whole set.
//   Log-in wall signed out, a window shows only the sign-in page. Signing in opens the last
//               page used (Home the first time) and the rest of the saved windows.
//   Pages       online, the live site; offline, the copy bundled in the app (page.js).
//   Control     shortcuts (shortcuts.js), a command palette, Open link, a menu bar item with
//               the watchlist's prices (tray.js), a key that shows or hides Parity from
//               anywhere, Trade alerts as notifications even with every window closed, keep a
//               window on top, focus mode, and the Settings page (settings.js).
//   Updates     a public feed of published releases (updater.js).
//   Trust       only the bundled copy and the website's addresses load in page views and get
//               the page bridge; only the app's own pages get the shell bridge. Every message
//               is checked against the view that sent it.
//
// For testing: PARITY_LIVE_ORIGIN points the app at another address (an unreachable one shows
// the offline copy), PARITY_DEV_URL at a local dev server, and PARITY_LOG=1 prints each page
// the app loads. PARITY_AUTH_BYPASS=1 treats the app as signed in, only with a loopback
// PARITY_DEV_URL (for screenshots against `VITE_AUTH_BYPASS=1 npm run dev`).
// PARITY_HIDDEN=1 (on by default under PARITY_SELFTEST) keeps every window off the screen:
// no window is shown or focused, no Dock icon, no menu bar item, no notification, no message.
const { app, BrowserWindow, Menu, Notification, dialog, globalShortcut, ipcMain, nativeTheme, net, powerMonitor, protocol, screen, session, shell, systemPreferences } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const routes = require("./routes");
const TOKENS = require("./tokens");
const SECTIONS = require("./sections");
const settingsStore = require("./settings");
const workspace = require("./workspace");
const shortcuts = require("./shortcuts");
const updater = require("./updater");
const { ParityWindow } = require("./window");
const { Page } = require("./page");
const { ParityTray } = require("./tray");
const logfile = require("./logfile");
const guard = require("./guard");

// Errors nobody caught: logged, and one plain message instead of Electron's raw box and a
// quit (guard.js). Installed first, so it covers everything below.
guard.install({
  log: (m) => log(m),
  ask: (opts) => {
    if (HIDDEN) return Promise.resolve({ response: 1 });
    const parent = [...windows].find((w) => w.alive && w.win.isVisible())?.win;
    return parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts);
  },
  reload: () => { for (const w of windows) { try { w.reload(false); } catch (e) { log(`reload failed: ${e.message}`); } } },
});

const SCHEME = "parity";
const PARTITION = "persist:parity";
const AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/;
const SHELL_FILES = new Set(["offline.html", "ui.css", "icons.js", "ui-titlebar.html", "ui-titlebar.js", "ui-overlay.html", "ui-overlay.js", "ui-settings.html", "ui-settings.js", "ui-error.html"]);

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..", "build", "web");
const DEV_URL = (process.env.PARITY_DEV_URL || "").replace(/\/$/, "") || null;
const ORIGIN = (process.env.PARITY_LIVE_ORIGIN || readJson(path.join(WEB_ROOT, "desktop.json"))?.origin || "https://paritytrading.app").replace(/\/$/, "");
const TRUSTED = routes.trustedOrigins(ORIGIN).concat(DEV_URL ? [new URL(DEV_URL).origin] : []);
const HIDDEN = process.env.PARITY_HIDDEN === "1" || (!!process.env.PARITY_SELFTEST && process.env.PARITY_VISIBLE !== "1");
if (HIDDEN && process.platform === "darwin") { try { app.setActivationPolicy("prohibited"); } catch { /* older macOS */ } }
const AUTH_BYPASS = process.env.PARITY_AUTH_BYPASS === "1" && !!DEV_URL && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(DEV_URL);
const sections = routes.visibleSections(SECTIONS, WEB_ROOT);
const numbered = sections.filter((s) => !s.bottom);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
// Printed when running from source (or with PARITY_LOG), and always kept in the log file
// once the app is ready (logfile.js).
let logOut = null;
const early = [];
const log = (msg) => {
  if (!app.isPackaged || process.env.PARITY_LOG) console.log(`[parity] ${process.uptime().toFixed(1)}s ${msg}`);
  if (logOut) logOut.write(msg);
  else if (early.length < 200) early.push(msg);
};

const isDev = (url) => !!DEV_URL && (url === DEV_URL || url.startsWith(`${DEV_URL}/`));
const isTrusted = (url) => isDev(url) || routes.isTrusted(url, ORIGIN);
const isSaved = (url) => url.startsWith(`${routes.APP_ORIGIN}/`) && !url.startsWith(`${routes.APP_ORIGIN}/__desktop/`);
const appPathOf = (url) => (isDev(url) ? url.slice(DEV_URL.length) || "/" : isTrusted(url) ? routes.toAppPath(url, ORIGIN) : null);
const liveUrl = (p) => (DEV_URL ? `${DEV_URL}${p}` : routes.liveUrl(p, ORIGIN));
// URL.origin is "null" for app://, so the origin is built by hand.
const trustedUrl = (u) => {
  try { const x = new URL(u || ""); return TRUSTED.includes(`${x.protocol}//${x.host}`); } catch { return false; }
};

const windows = new Set();
let state = { windows: [], recent: [], workspaces: {}, lastPath: "/" };
let ready = false;
let quitting = false;
let pending = null;
let restoreAfterSignIn = null; // saved windows waiting for the log-in wall
let tray = null;
let background = null; // a hidden Trade page for the ticker and alerts
let backgroundTimer = null;
let settingsWin = null;
let saveTimer = null;
let menuTimer = null;
let retry = null;
const shown = new Set();
const notified = new Map();

const ctx = {
  platform: process.platform,
  version: app.getVersion(),
  hidden: HIDDEN,
  ORIGIN, DEV_URL, TRUSTED, PARTITION, sections,
  basePrefs: { contextIsolation: true, sandbox: true, nodeIntegration: false, partition: PARTITION, spellcheck: false },
  state: { online: null, signedIn: false, token: null },
  settings: settingsStore.clean(null),
  focused: null,
  isTrusted, isSaved, appPathOf, liveUrl, log,
  shellUrl: (file) => `${routes.APP_ORIGIN}/__desktop/${file}`,
  actionFor: (input) => shortcuts.actionFor(input, process.platform),
  recentPaths: () => state.recent.map((r) => r.path),
  check, setOnline, run, addRecent, saveSoon, refreshSignedIn, signedInFrom, windowClosing, windowClosed, menuChanged, overlayData,
  openPath, newWindow, showAll, openSettings, quit: () => app.quit(),
  updates: null,
};

// ---------------------------------------------------------------- one copy, parity:// links

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${SCHEME}://`));
    if (link) openLink(link);
    else showAll();
  });
}
app.on("open-url", (e, url) => { e.preventDefault(); openLink(url); });
if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
else if (process.platform === "win32") app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1] || ".")]);

function openLink(link) {
  const p = routes.toAppPath(link, ORIGIN);
  if (!p) return;
  if (!ready) { pending = p; return; }
  openPath(p);
}

// ---------------------------------------------------------------- app://parity

const notFound = () => new Response(
  `<!doctype html><meta charset="utf-8"><title>Not found · Parity</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:${TOKENS["color-canvas"]};color:${TOKENS["color-text-muted"]};font:${TOKENS["type-lg"]}/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><p>This page is not in the app. <a style="color:${TOKENS["color-text"]}" href="/">Go to the front page</a></p>`,
  { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

async function proxy(req, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Not allowed", { status: 405 });
  const headers = { Accept: req.headers.get("accept") || "*/*" };
  if (url.pathname.startsWith("/data/") && ctx.state.token) headers.Authorization = `Bearer ${ctx.state.token}`;
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

// ---------------------------------------------------------------- online, signed in

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
  ctx.state.online = value;
  if (value) { clearInterval(retry); retry = null; return; }
  if (retry) return;
  retry = setInterval(async () => {
    if (!(await check(2500))) return;
    log("the website answers again, going back to the live page");
    setOnline(true);
    for (const w of windows) if (w.active?.saved && w.active.path) w.active.load(w.active.path);
  }, 15000);
}

/** Reads the session cookie (src/auth/client.ts on the website) and updates every window. */
async function refreshSignedIn() {
  let signedIn = AUTH_BYPASS;
  if (!signedIn) {
    try {
      const now = Date.now() / 1000;
      const cookies = await session.fromPartition(PARTITION).cookies.get({});
      signedIn = cookies.some((c) => AUTH_COOKIE.test(c.name) && (!c.expirationDate || c.expirationDate > now));
    } catch { signedIn = false; }
  }
  const was = ctx.state.signedIn;
  ctx.state.signedIn = signedIn;
  if (was !== signedIn) {
    log(signedIn ? "signed in" : "signed out");
    for (const w of windows) w.push();
    if (was && !signedIn) signedOut();
    syncBackground();
  }
  return signedIn;
}

/** The log-in wall let a window through: reopen the rest of the saved windows. */
function signedInFrom(w) {
  ctx.state.signedIn = true;
  const rest = restoreAfterSignIn;
  restoreAfterSignIn = null;
  if (rest) for (const saved of rest) createWindow(saved);
  w.push();
  syncBackground();
  saveSoon();
}

/** Signed out (here or in another window): one window stays, on the log-in wall. */
function signedOut() {
  saveNow(true);
  const keep = ctx.focused?.alive ? ctx.focused : [...windows].find((w) => w.alive);
  for (const w of [...windows]) if (w !== keep) { w.closing = true; w.win.close(); }
  if (keep && !(keep.active?.path && routes.isAuthPath(keep.active.path))) keep.go("/login/");
  tray?.setTicker([]);
}

// ---------------------------------------------------------------- windows

function createWindow(saved, opts) {
  const w = new ParityWindow(ctx, workspace.cleanWindow(saved, screen.getAllDisplays()), opts);
  windows.add(w);
  w.go(saved.path || "/");
  return w;
}

function focusedWindow() {
  const f = ctx.focused;
  if (f?.alive && f.win.isVisible()) return f;
  return [...windows].find((w) => w.alive && w.win.isVisible()) || [...windows].find((w) => w.alive) || null;
}

/** Opens an in-app path in the focused window, or a new one. */
function openPath(p, opts = {}) {
  let w = focusedWindow();
  if (!w) { w = createWindow({ ...(state.windows[0] || {}), path: p }); w.focus(); return; }
  w.go(p, opts);
  w.focus();
}

/** A new window, a little below and right of the focused one, at `p` (Home by default). */
function newWindow(p) {
  const from = focusedWindow();
  if (from && from.wall) { from.focus(); return null; }
  const b = from?.win.getNormalBounds();
  const saved = b ? { x: b.x + 28, y: b.y + 28, width: b.width, height: b.height } : {};
  const w = createWindow({ ...saved, path: p || "/" });
  w.focus();
  return w;
}

function showAll() {
  if (process.platform === "darwin" && !HIDDEN) app.show();
  const list = [...windows].filter((w) => w.alive);
  if (!list.length) { createWindow({ ...(state.windows[0] || {}), path: state.lastPath || "/" }).focus(); return; }
  if (!HIDDEN) for (const w of list) if (!w.win.isVisible()) w.win.show();
  (focusedWindow() || list[0]).focus();
}

function toggleAll() {
  const visible = [...windows].filter((w) => w.alive && w.win.isVisible() && !w.win.isMinimized());
  if (visible.some((w) => w.win.isFocused())) {
    if (process.platform === "darwin") app.hide();
    else for (const w of visible) w.win.minimize();
  } else showAll();
}

function windowClosing(w, e) {
  if (quitting || w.closing) return;
  const others = [...windows].filter((x) => x !== w && x.alive && x.win.isVisible());
  if (ctx.settings.keepRunning && others.length === 0 && ctx.state.signedIn) {
    // Keep running in the menu bar: the window hides, its pages keep running, alerts still arrive.
    e.preventDefault();
    w.closeOverlay();
    w.win.hide();
    saveNow();
    return;
  }
  w.closing = true;
  if (others.length === 0) state.lastPath = w.lastGoodPath || state.lastPath || "/";
}

function windowClosed(w) {
  windows.delete(w);
  if (ctx.focused === w) ctx.focused = null;
  if (!quitting) saveSoon();
  menuChanged();
  if (!windows.size && !settingsWin && process.platform !== "darwin" && !ctx.settings.keepRunning) app.quit();
}

// ---------------------------------------------------------------- saved state

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(), 800);
}

function saveNow(force = false) {
  clearTimeout(saveTimer);
  // While signed out a window only shows the wall, so the saved windows stay as they were.
  if (ctx.state.signedIn || force) {
    const open = [...windows].filter((w) => w.alive && !w.closing);
    if (open.length || quitting) state.windows = open.map((w) => w.serialize());
    if (open.length) state.lastPath = (ctx.focused?.alive ? ctx.focused : open[0]).lastGoodPath || state.lastPath;
  }
  workspace.save(app.getPath("userData"), state);
}

function addRecent(p, title) {
  const before = state.recent[0];
  state.recent = workspace.pushRecent(state.recent, { path: p, title });
  if (!before || before.path !== p || before.title !== title) menuChanged();
}

function saveWorkspace(name) {
  const n = workspace.cleanName(name);
  if (!n) return false;
  state.workspaces = { ...state.workspaces, [n]: [...windows].filter((w) => w.alive).map((w) => w.serialize()) };
  saveNow();
  menuChanged();
  return true;
}

function openWorkspace(name) {
  const list = state.workspaces[name];
  if (!list?.length) return;
  for (const w of [...windows]) { w.closing = true; w.win.close(); }
  for (const saved of list) createWindow(saved);
  saveSoon();
}

function deleteWorkspace(name) {
  const next = { ...state.workspaces };
  delete next[name];
  state.workspaces = next;
  saveNow();
  menuChanged();
}

// ---------------------------------------------------------------- the hidden Trade page

const backgroundOwner = {
  route() {}, leaveWall() {}, pageChanged() {}, keys() {},
  // The hidden Trade page closed itself (page.js): a fresh one takes its place.
  pageClosed(p) {
    if (background !== p) return;
    clearInterval(backgroundTimer);
    background = null;
    setTimeout(syncBackground, 1000);
  },
};

/** Keeps a hidden Trade page while the ticker or "keep running" needs one and the person is signed in. */
function syncBackground() {
  const want = ctx.state.signedIn && ((ctx.settings.tray && ctx.settings.ticker) || ctx.settings.keepRunning);
  if (want && !background) {
    background = new Page(ctx, backgroundOwner, "trade", { background: true });
    background.view.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
    const load = () => background?.load("/trade/#/watchlists");
    setTimeout(load, 8000); // after the first window has the network to itself
    backgroundTimer = setInterval(load, 3 * 60 * 60 * 1000);
  } else if (!want && background) {
    clearInterval(backgroundTimer);
    background.destroy();
    background = null;
  }
}

// ---------------------------------------------------------------- settings

function applySettings(patch) {
  const before = ctx.settings;
  let next = settingsStore.clean({ ...before, ...patch });
  let error = null;
  if (next.globalShortcut !== before.globalShortcut) {
    if (before.globalShortcut) globalShortcut.unregister(before.globalShortcut);
    if (next.globalShortcut && !registerShortcut(next.globalShortcut)) {
      error = "That key is already used by another app or by the system. Try another.";
      next = { ...next, globalShortcut: "" };
    }
  }
  ctx.settings = next;
  settingsStore.save(app.getPath("userData"), next);
  if (before.instantSections && !next.instantSections) {
    for (const w of windows) for (const p of [...w.pages.values()]) if (p !== w.active) w.dropPage(p);
  }
  tray?.sync();
  syncBackground();
  ctx.updates?.sync();
  return { settings: next, error };
}

function registerShortcut(acc) {
  try { return globalShortcut.register(acc, toggleAll); } catch { return false; }
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { if (!HIDDEN) { settingsWin.show(); settingsWin.focus(); } return; }
  settingsWin = new BrowserWindow({
    title: "Parity settings",
    width: 600, height: 720, minWidth: 480, minHeight: 480,
    backgroundColor: TOKENS["color-canvas"],
    show: false,
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 12 } } : { autoHideMenuBar: true, icon: path.join(__dirname, "..", "assets", "icon.png") }),
    webPreferences: { ...ctx.basePrefs, preload: path.join(__dirname, "shell-preload.js") },
  });
  const wc = settingsWin.webContents;
  wc.on("will-navigate", (e) => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
  wc.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && (input.key === "Escape" || ((input.meta || input.control) && input.code === "KeyW"))) { e.preventDefault(); settingsWin?.close(); }
  });
  settingsWin.once("ready-to-show", () => { if (!HIDDEN) settingsWin?.show(); });
  settingsWin.on("closed", () => { settingsWin = null; if (!windows.size && process.platform !== "darwin" && !ctx.settings.keepRunning) app.quit(); });
  settingsWin.loadURL(ctx.shellUrl("ui-settings.html"));
}

// ---------------------------------------------------------------- actions

const COMMANDS = [
  { id: "new-window", label: "New window", key: "N" },
  { id: "new-window-here", label: "Open this page in a new window", key: "Shift N" },
  { id: "link", label: "Open link", key: "L" },
  { id: "copy-link", label: "Copy link to this page", key: "Shift C" },
  { id: "on-top", label: "Keep this window on top", key: "Alt T" },
  { id: "focus", label: "Focus mode", key: "Shift F" },
  { id: "save-workspace", label: "Save windows as workspace" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings", key: "," },
  { id: "reload", label: "Reload this page", key: "R" },
  { id: "check-updates", label: "Check for updates" },
  { id: "quit", label: "Quit Parity", key: "Q" },
];
const COMMAND_IDS = new Set(COMMANDS.map((c) => c.id).concat(["page-search", "menu", "palette", "back", "forward", "close-overlay", "dblclick", "minimize", "close-window", "fullscreen", "reload-hard", "zoom-in", "zoom-out", "zoom-reset", "devtools", "focus-exit"]));
const KEEP_OVERLAY = new Set(["menu", "palette", "back", "forward", "dblclick", "close-overlay", "focus-exit"]);

function run(action, w) {
  w = w?.alive ? w : focusedWindow();
  const m = String(action).match(/^section:([1-9])$/);
  if (m) {
    const s = numbered[Number(m[1]) - 1];
    if (!s) return;
    if (!w) { createWindow({ path: s.path }); return; }
    w.closeOverlay();
    w.openSection(s.id);
    return;
  }
  switch (action) {
    case "new-window": newWindow(); return;
    case "new-window-here": newWindow(w?.active?.path); return;
    case "settings": openSettings(); return;
    case "check-updates": ctx.updates.check(true); return;
    case "quit": app.quit(); return;
    default: break;
  }
  if (!w) return;
  switch (action) {
    case "menu": w.toggleOverlay("menu"); break;
    case "palette": w.toggleOverlay("palette"); break;
    case "link": w.openOverlay("link"); break;
    case "save-workspace": w.openOverlay("name"); break;
    case "close-overlay": w.closeOverlay(); break;
    case "back": w.back(); break;
    case "forward": w.forward(); break;
    case "copy-link": w.copyLink(); break;
    case "on-top": w.toggleOnTop(); break;
    case "focus": w.toggleFocus(); break;
    case "focus-exit": if (w.focusMode) w.toggleFocus(); break;
    case "fullscreen": w.win.setFullScreen(!w.win.isFullScreen()); break;
    case "minimize": w.win.minimize(); break;
    case "close-window": w.win.close(); break;
    case "reload": w.reload(false); break;
    case "reload-hard": w.reload(true); break;
    case "zoom-in": w.zoom(0.5); break;
    case "zoom-out": w.zoom(-0.5); break;
    case "zoom-reset": w.zoom(0); break;
    case "devtools": if (w.active?.alive) w.active.wc.toggleDevTools(); break;
    case "account": if (!w.wall) w.go("/app/#/settings/account"); break;
    case "dblclick": w.titleDoubleClick(process.platform === "darwin" ? systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string") : null); break;
    case "page-search": {
      // The section's own search (Trade's command palette), which Cmd K now opens for the app.
      const wc = w.active?.alive ? w.active.wc : null;
      if (!wc) break;
      w.closeOverlay();
      w.passKeys = 2;
      const modifiers = [process.platform === "darwin" ? "meta" : "control"];
      wc.focus();
      wc.sendInputEvent({ type: "keyDown", keyCode: "K", modifiers });
      wc.sendInputEvent({ type: "keyUp", keyCode: "K", modifiers });
      break;
    }
    default: break;
  }
}

/** What the menu and palette layer shows for a window. */
function overlayData(w) {
  const mod = process.platform === "darwin" ? "Cmd" : "Ctrl";
  const commands = COMMANDS.filter((c) => c.id !== "quit" || process.platform !== "darwin").map((c) => ({ ...c, key: c.key ? `${mod} ${c.key}` : "" }));
  if (w.active?.key === "trade") commands.unshift({ id: "page-search", label: "Search in Trade (symbols and Trade commands)", key: "" });
  return {
    platform: process.platform,
    sections: sections.map(({ id, label, icon, bottom, key }) => ({ id, label, icon, bottom: !!bottom, key: key && key !== "," ? `${mod} ${key}` : "" })),
    active: w.active?.key || null,
    recent: state.recent.slice(0, 8),
    workspaces: Object.keys(state.workspaces),
    commands,
    onTop: w.win.isAlwaysOnTop(),
  };
}

// ---------------------------------------------------------------- messages

const windowOf = (wc) => [...windows].find((w) => w.owns(wc));
const pageWindowOf = (wc) => [...windows].find((w) => w.ownsPage(wc));
const isPageView = (wc) => !!pageWindowOf(wc) || (!!background && background.wc === wc);
// Only a page view's top frame, showing a trusted address, may send these.
const fromPage = (e) => isPageView(e.sender) && e.senderFrame === e.sender.mainFrame && trustedUrl(e.senderFrame?.url);
const isShellSender = (e) => trustedUrl(e.senderFrame?.url) && e.senderFrame.url.startsWith(`${routes.APP_ORIGIN}/__desktop/`);

ipcMain.on("parity:token", (e, t) => {
  if (!fromPage(e)) return;
  ctx.state.token = typeof t === "string" && t.length > 0 && t.length < 8192 ? t : null;
});

ipcMain.on("parity:notify", (e, msg) => {
  if (HIDDEN || !fromPage(e) || !ctx.settings.notifications || !Notification.isSupported() || !msg) return;
  const title = String(msg.title).slice(0, 120), body = String(msg.body).slice(0, 240);
  // The same alert from two Trade pages (a window and the hidden one) shows once.
  const key = `${title}\n${body}`;
  const now = Date.now();
  for (const [k, t] of notified) if (now - t > 10 * 60 * 1000) notified.delete(k);
  if (notified.has(key)) return;
  notified.set(key, now);
  const n = new Notification({ title, body });
  const href = typeof msg.href === "string" && msg.href.startsWith("/") && !msg.href.startsWith("//") ? msg.href : null;
  n.on("click", () => { showAll(); if (href) openPath(href); shown.delete(n); });
  n.on("close", () => shown.delete(n));
  shown.add(n); // keep a reference until it is dismissed, or the click is lost
  n.show();
});

ipcMain.on("parity:open", (e, url) => {
  if (fromPage(e) && typeof url === "string" && /^https:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.on("parity:ticker", (e, items) => {
  if (!fromPage(e) || !Array.isArray(items)) return;
  tray?.setTicker(items.slice(0, 12).map((i) => ({ symbol: String(i?.symbol ?? "").slice(0, 16), last: String(i?.last ?? "").slice(0, 16), change: String(i?.change ?? "").slice(0, 12), up: i?.up === true ? true : i?.up === false ? false : null })));
});

ipcMain.on("parity:nav", (e, dir, source) => {
  if (!fromPage(e) || (source === "swipe" && !ctx.settings.swipe)) return;
  const w = pageWindowOf(e.sender);
  if (!w || w.active?.wc !== e.sender) return;
  if (dir === "back") w.back();
  else if (dir === "forward") w.forward();
});

ipcMain.on("shell:do", (e, action, arg) => {
  if (!isShellSender(e)) return;
  const w = windowOf(e.sender);
  if (!w) return;
  if (action === "open-section" && arg && typeof arg.id === "string") {
    w.closeOverlay();
    const s = sections.find((x) => x.id === arg.id);
    if (!s) return;
    if (arg.newWindow) newWindow(s.path);
    else w.openSection(s.id);
  } else if (action === "open-path" && arg && typeof arg.path === "string" && arg.path.startsWith("/") && !arg.path.startsWith("//")) {
    w.closeOverlay();
    if (arg.newWindow) newWindow(arg.path);
    else w.go(arg.path);
  } else if (action === "drag-start" && arg) {
    w.dragStart(Number(arg.x), Number(arg.y));
  } else if (action === "drag-move" && arg) {
    w.dragMove(Number(arg.x), Number(arg.y));
  } else if (action === "drag-end") {
    w.dragEnd();
  } else if (action === "open-workspace" && typeof arg === "string") {
    w.closeOverlay();
    openWorkspace(arg);
  } else if (typeof action === "string" && COMMAND_IDS.has(action)) {
    if (!KEEP_OVERLAY.has(action) && !["link", "save-workspace"].includes(action)) w.closeOverlay();
    run(action, w);
  }
});

ipcMain.handle("shell:ask", (e, action, arg) => {
  if (!isShellSender(e)) return null;
  const fromSettings = settingsWin && !settingsWin.isDestroyed() && e.sender === settingsWin.webContents;
  if (fromSettings) {
    switch (action) {
      case "settings:get": return settingsInfo();
      case "settings:set": return { ...applySettings(arg && typeof arg === "object" ? arg : {}), ...settingsInfo(true) };
      case "workspace:delete": if (typeof arg === "string") deleteWorkspace(arg); return settingsInfo();
      case "updates:check": ctx.updates.check(true); return settingsInfo();
      case "open-cookies": openPath("/legal/cookies/#desktop"); return null;
      default: return null;
    }
  }
  const w = windowOf(e.sender);
  if (!w) return null;
  switch (action) {
    case "state": return w.state();
    case "overlay": return w.overlayMode ? { mode: w.overlayMode, ...overlayData(w) } : null;
    case "open-link": {
      const p = routes.parseOpenInput(arg, ORIGIN);
      if (!p) return { ok: false };
      w.closeOverlay();
      w.go(p);
      return { ok: true };
    }
    case "save-workspace": {
      const ok = saveWorkspace(arg);
      if (ok) { w.closeOverlay(); w.flash(`Saved workspace "${workspace.cleanName(arg)}"`); }
      return { ok };
    }
    default: return null;
  }
});

function settingsInfo(partial = false) {
  const info = { workspaces: Object.keys(state.workspaces), update: ctx.updates?.status() || "", canInstall: !!ctx.updates?.canInstall };
  if (partial) return info;
  return { ...info, settings: ctx.settings, platform: process.platform, version: app.getVersion() };
}

// ---------------------------------------------------------------- the menu

function menuChanged() {
  clearTimeout(menuTimer);
  menuTimer = setTimeout(buildMenu, 250);
}

function buildMenu() {
  const mac = process.platform === "darwin";
  const act = (action) => () => run(action, focusedWindow());
  const sectionItems = numbered.map((s, i) => ({ label: s.label, accelerator: i < 9 ? `CmdOrCtrl+${i + 1}` : undefined, click: act(`section:${i + 1}`) }));
  const recent = state.recent.slice(0, 10).map((r) => ({ label: r.title.length > 60 ? `${r.title.slice(0, 59)}...` : r.title, click: () => openPath(r.path) }));
  const spaces = Object.keys(state.workspaces);
  const fw = focusedWindow();
  const template = [
    ...(mac ? [{
      label: "Parity",
      submenu: [
        { role: "about" },
        { label: "Check for updates", click: () => ctx.updates.check(true) },
        { type: "separator" },
        { label: "Settings", accelerator: "Cmd+,", click: openSettings },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        { label: "New window", accelerator: "CmdOrCtrl+N", click: act("new-window") },
        { label: "Open this page in a new window", accelerator: "CmdOrCtrl+Shift+N", click: act("new-window-here") },
        { label: "Open link", accelerator: "CmdOrCtrl+L", click: act("link") },
        { type: "separator" },
        { label: "Close window", accelerator: "CmdOrCtrl+W", click: act("close-window") },
        ...(mac ? [] : [{ type: "separator" }, { label: "Settings", accelerator: "Ctrl+,", click: openSettings }, { label: "Check for updates", click: () => ctx.updates.check(true) }, { role: "quit", label: "Exit" }]),
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Command palette", accelerator: "CmdOrCtrl+K", click: act("palette") },
        { label: "Sections", click: act("menu") },
        { type: "separator" },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: act("reload") },
        { label: "Reload without cache", accelerator: "Shift+CmdOrCtrl+R", click: act("reload-hard") },
        { label: "Developer tools", accelerator: mac ? "Alt+Cmd+I" : "Ctrl+Shift+I", click: act("devtools") },
        { type: "separator" },
        { label: "Actual size", accelerator: "CmdOrCtrl+0", click: act("zoom-reset") },
        { label: "Zoom in", accelerator: "CmdOrCtrl+=", click: act("zoom-in") },
        { label: "Zoom out", accelerator: "CmdOrCtrl+-", click: act("zoom-out") },
        { type: "separator" },
        { label: "Focus mode", accelerator: "CmdOrCtrl+Shift+F", click: act("focus") },
        { label: "Full screen", accelerator: mac ? "Ctrl+Cmd+F" : "F11", click: act("fullscreen") },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Back", accelerator: mac ? "Cmd+[" : "Alt+Left", click: act("back") },
        { label: "Forward", accelerator: mac ? "Cmd+]" : "Alt+Right", click: act("forward") },
        { type: "separator" },
        ...sectionItems,
        { label: "Account", click: act("account") },
        { type: "separator" },
        { label: "Copy link to this page", accelerator: "CmdOrCtrl+Shift+C", click: act("copy-link") },
        ...(recent.length ? [{ type: "separator" }, { label: "Recent pages", enabled: false }, ...recent] : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimise", accelerator: "CmdOrCtrl+M", click: act("minimize") },
        { label: "Keep on top", type: "checkbox", checked: !!fw?.win.isAlwaysOnTop(), accelerator: "CmdOrCtrl+Alt+T", click: act("on-top") },
        { type: "separator" },
        { label: "Save windows as workspace", click: act("save-workspace") },
        { label: "Open workspace", enabled: spaces.length > 0, submenu: spaces.length ? spaces.map((n) => ({ label: n, click: () => openWorkspace(n) })) : [{ label: "None saved", enabled: false }] },
        { type: "separator" },
        ...[...windows].filter((x) => x.alive).map((x) => ({ label: x.win.getTitle() || "Parity", type: "checkbox", checked: x === fw, click: () => x.focus() })),
        ...(mac ? [{ type: "separator" }, { role: "front" }] : []),
      ],
    },
    {
      role: "help",
      submenu: [
        { label: "Risk notice", click: () => openPath("/legal/risk/") },
        { label: "Privacy policy", click: () => openPath("/legal/privacy/") },
        { label: "Terms of service", click: () => openPath("/legal/terms/") },
        { label: "Regulatory status", click: () => openPath("/legal/regulatory/") },
        { type: "separator" },
        { label: `Open ${new URL(ORIGIN).host} in the browser`, click: () => shell.openExternal(ORIGIN) },
        { label: "Email Parity", click: () => shell.openExternal("mailto:contact@paritytrading.ai") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- never a black window

/**
 * A page can stop drawing while its content is fine: after the Mac sleeps, a screen is
 * plugged in or out, the graphics process restarts, or the window comes back from Stage
 * Manager or the Dock. Each of those makes every window draw its pages again (DEC-0059).
 */
function watchForBlankViews() {
  const all = (why) => { log(`repaint (${why})`); for (const w of windows) w.repaint(why); };
  powerMonitor.on("resume", () => all("woke from sleep"));
  powerMonitor.on("unlock-screen", () => all("screen unlocked"));
  screen.on("display-added", () => all("screen added"));
  screen.on("display-removed", () => all("screen removed"));
  screen.on("display-metrics-changed", () => all("screen changed"));
  app.on("child-process-gone", (_e, d) => {
    log(`${d.type} process gone (${d.reason}${d.exitCode ? `, ${d.exitCode}` : ""})`);
    if (d.type === "GPU") setTimeout(() => all("graphics restarted"), 600);
  });
}

// ---------------------------------------------------------------- start

app.whenReady().then(async () => {
  logOut = logfile.create(app.getPath("logs"));
  logOut.write(`Parity ${app.getVersion()} started (${process.platform} ${process.arch}, Electron ${process.versions.electron})`);
  for (const m of early.splice(0)) logOut.write(m);
  nativeTheme.themeSource = "dark";
  watchForBlankViews();
  if (process.platform === "win32") app.setAppUserModelId("ai.paritytrading.desktop");
  const userData = app.getPath("userData");
  ctx.settings = settingsStore.load(userData);
  state = workspace.load(userData, screen.getAllDisplays());

  const ses = session.fromPartition(PARTITION);
  ses.protocol.handle("app", handle);
  const allowed = new Set(["notifications", "clipboard-sanitized-write", "fullscreen"]);
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed.has(permission) && trustedUrl(details?.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && trustedUrl(origin));
  // The website's service workers keep their own offline copies. In the app the bundled copy
  // does that job, and a worker answering for a dead connection would hide it.
  ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
  ses.webRequest.onBeforeRequest({ urls: ["https://*/sw.js", "https://*/sim/sw.js"] }, (d, cb) => cb({ cancel: trustedUrl(d.url) }));
  // Signing out anywhere (or the session expiring) puts the windows back on the log-in wall.
  let cookieTimer = null;
  ses.cookies.on("changed", (_e, cookie, cause, removed) => {
    if (!AUTH_COOKIE.test(cookie.name) || (removed && cause === "overwrite")) return;
    clearTimeout(cookieTimer);
    cookieTimer = setTimeout(() => { refreshSignedIn(); }, 800);
  });

  const link = process.argv.find((a) => a.startsWith(`${SCHEME}://`));
  if (link) pending = routes.toAppPath(link, ORIGIN);

  ctx.updates = updater.create({ log, enabled: () => !HIDDEN && ctx.settings.autoUpdate, parentWindow: () => focusedWindow()?.win || null });
  tray = new ParityTray(ctx);
  buildMenu();

  await refreshSignedIn();
  const saved = ctx.settings.restoreWindows && state.windows.length ? state.windows : [{ ...(state.windows[0] || {}), path: state.lastPath || "/" }];
  if (pending) saved[0] = { ...saved[0], path: pending };
  pending = null;
  if (ctx.state.signedIn) {
    for (const s of saved) createWindow(s);
  } else {
    createWindow(saved[0]); // the log-in wall; the rest open after signing in
    restoreAfterSignIn = saved.slice(1);
  }
  ready = true;

  if (HIDDEN) app.dock?.hide();
  if (!HIDDEN && ctx.settings.globalShortcut && !registerShortcut(ctx.settings.globalShortcut)) log(`could not register ${ctx.settings.globalShortcut}`);
  tray.sync();
  syncBackground();
  ctx.updates.sync();
  if (process.env.PARITY_SELFTEST) require("./selftest").run({ windows: () => [...windows].filter((w) => w.alive), openLink, newWindow }).catch((e) => { console.error(e); app.exit(1); });
  if (process.env.PARITY_SHOTS) require("./shots").run({ focused: focusedWindow, newWindow }).catch((e) => { console.error(e); app.quit(); });
});

app.on("activate", () => { if (ready) showAll(); });
app.on("before-quit", () => {
  quitting = true;
  saveNow();
  // Write the sign-in cookies to disk before quitting, so the next launch is still signed in.
  session.fromPartition(PARTITION).cookies.flushStore().catch(() => {});
});
app.on("will-quit", () => globalShortcut.unregisterAll());
// Windows quit with their last window unless "keep running" is on (windowClosed); a Mac app stays in the Dock.
app.on("window-all-closed", () => {});
