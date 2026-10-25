// One page view inside a window (DEC-0048, DEC-0049): a WebContentsView that shows the live
// site, or the copy bundled in the app when offline. A window keeps a few of these, one per
// section, so going back to a section is instant (window.js).
//
//   Live first   each path opens on its live address. A page that fails to load, or has not
//                started arriving after 1.5 s and fails a second short check, opens from the
//                saved copy instead (app://parity).
//   Links        the website's addresses stay in the app, every other address opens in the
//                browser. A link that opens a new window opens in this window instead.
//   Sign-in      while signed out, only the sign-in pages load (the log-in wall). Leaving a
//                sign-in page is allowed once the session cookie exists.
const { WebContentsView } = require("electron");
const path = require("node:path");
const routes = require("./routes");

// The website's cookie notice: the app stores only what it needs to work, as the cookie
// policy's desktop section says, so the notice never shows (DEC-0049). The site also skips it
// in the app; this covers pages built before that change and the saved copy.
const ERROR_URL = `${routes.APP_ORIGIN}/__desktop/ui-error.html`;
const APP_CSS = ".cn,[data-cookie-prefs]{display:none!important}";

class Page {
  constructor(ctx, owner, key, { background = false } = {}) {
    this.ctx = ctx;
    this.owner = owner;
    this.key = key; // the section this page belongs to
    this.path = null; // the in-app path showing, once something loaded
    this.saved = false; // showing the saved copy
    this.title = "Parity";
    this.usedAt = Date.now();
    this.watchdog = null;
    this.view = new WebContentsView({
      webPreferences: {
        contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true,
        partition: ctx.PARTITION,
        // The hidden Trade page (main.js) keeps its timers running for alerts.
        backgroundThrottling: !background,
        preload: path.join(__dirname, "preload.js"),
        additionalArguments: [`--parity-version=${ctx.version}`, `--parity-origins=${ctx.TRUSTED.join(",")}`],
      },
    });
    this.view.setBackgroundColor("#050608");
    this.wire();
  }

  get wc() { return this.view.webContents; }
  get alive() { return !this.wc.isDestroyed(); }

  wire() {
    const { ctx } = this;
    const wc = this.wc;
    const leaving = (e, url) => {
      if (!ctx.isTrusted(url)) { e.preventDefault(); this.owner.route(url); return; }
      const to = ctx.appPathOf(url);
      if (!to || routes.isAuthPath(to)) return;
      // The log-in wall: a sign-in page may only leave once the session cookie exists. The
      // app then opens the last section used instead of the page the form picked.
      if (!ctx.state.signedIn || (this.path && routes.isAuthPath(this.path))) {
        e.preventDefault();
        this.owner.leaveWall(this, to);
      }
    };
    wc.on("will-navigate", leaving);
    wc.on("will-redirect", (e, url) => { if (!ctx.isTrusted(url)) { e.preventDefault(); this.owner.route(url); } });
    wc.setWindowOpenHandler(({ url }) => { this.owner.route(url); return { action: "deny" }; });
    wc.on("will-attach-webview", (e) => e.preventDefault());
    wc.on("did-navigate", (_e, url) => { this.stopWatchdog(); ctx.log(`loaded ${url}`); this.navigated(url); });
    wc.on("did-navigate-in-page", (_e, url, isMainFrame) => { if (isMainFrame) this.navigated(url); });
    wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 || url.startsWith(ERROR_URL)) return; // -3: replaced by another load
      // The saved copy failed too: a page that says so, with Retry, never an empty window.
      if (ctx.isSaved(url)) { this.showError(this.wantPath || "/", desc || String(code)); return; }
      const p = ctx.appPathOf(url);
      if (p) this.fallBack(p, desc || String(code));
    });
    wc.on("dom-ready", () => { if (ctx.isTrusted(wc.getURL())) wc.insertCSS(APP_CSS).catch(() => {}); });
    wc.on("page-title-updated", (_e, title) => { this.title = title || "Parity"; this.owner.pageChanged(this); });
    wc.on("before-input-event", (e, input) => this.owner.keys(e, input));
    wc.on("render-process-gone", (_e, d) => { ctx.log(`page process gone (${d.reason})`); if (d.reason !== "clean-exit" && this.path) setTimeout(() => this.load(this.path), 500); });
  }

  navigated(url) {
    if (url.startsWith(ERROR_URL)) {
      if (url.endsWith("#retry")) { this.ctx.state.online = null; this.load(this.wantPath || "/"); }
      return;
    }
    const p = this.ctx.appPathOf(url);
    if (!p) return;
    this.path = p;
    this.saved = this.ctx.isSaved(url);
    this.owner.pageChanged(this, true);
  }

  /** Opens an in-app path: live when online, else the saved copy. */
  async load(p) {
    const { ctx } = this;
    this.wantPath = p;
    this.usedAt = Date.now();
    if (ctx.state.online === null) ctx.setOnline(await ctx.check(2000));
    if (!this.alive) return;
    if (ctx.state.online) this.loadLive(p);
    else this.loadSaved(p);
  }

  loadLive(p) {
    const url = this.ctx.liveUrl(p);
    this.ctx.log(`loading ${url}`);
    this.stopWatchdog();
    this.watchdog = setTimeout(async () => {
      this.watchdog = null;
      if (!(await this.ctx.check(1200))) this.fallBack(p, "no answer");
    }, 1500);
    this.wc.loadURL(url).catch(() => {});
  }

  loadSaved(p) {
    const url = `${routes.APP_ORIGIN}${p}`;
    this.ctx.log(`loading saved copy ${url}`);
    this.wc.loadURL(url).catch(() => {});
  }

  fallBack(p, why) {
    if (!this.alive) return;
    this.ctx.log(`offline (${why}), showing the saved copy`);
    this.stopWatchdog();
    this.ctx.setOnline(false);
    this.loadSaved(p);
  }

  /** The page that says this path could not open, with a Retry button (ui-error.html). */
  showError(p, why) {
    if (!this.alive) return;
    this.ctx.log(`could not open ${p} (${why})`);
    this.stopWatchdog();
    this.wantPath = p;
    this.title = "Could not open this page";
    this.wc.loadURL(ERROR_URL).catch(() => {});
    this.owner.pageChanged(this);
  }

  stopWatchdog() { clearTimeout(this.watchdog); this.watchdog = null; }

  history() {
    const h = this.alive ? this.wc.navigationHistory : null;
    return { back: !!h?.canGoBack(), forward: !!h?.canGoForward() };
  }

  back() { const h = this.wc.navigationHistory; if (h.canGoBack()) { h.goBack(); return true; } return false; }
  forward() { const h = this.wc.navigationHistory; if (h.canGoForward()) { h.goForward(); return true; } return false; }

  destroy() {
    this.stopWatchdog();
    if (this.alive) this.wc.close();
  }
}

module.exports = { Page };
