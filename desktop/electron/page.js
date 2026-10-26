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
const TOKENS = require("./tokens");

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
        // Draws while the window is still hidden, so it can be shown already drawn.
        paintWhenInitiallyHidden: true,
        // The hidden Trade page (main.js) keeps its timers running for alerts.
        backgroundThrottling: !background,
        preload: path.join(__dirname, "preload.js"),
        additionalArguments: [`--parity-version=${ctx.version}`, `--parity-origins=${ctx.TRUSTED.join(",")}`],
      },
    });
    this.view.setBackgroundColor(TOKENS["color-canvas"]);
    this.wire();
  }

  get wc() { return this.view.webContents; }
  // Once its contents close, Electron leaves the view with no contents at all (webContents
  // reads undefined, not a closed object). 0.2.0 read it anyway and threw: a page that called
  // window.close() turned black, and closing its window raised "A JavaScript error occurred".
  get alive() { const wc = this.view.webContents; return !!wc && !wc.isDestroyed(); }

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
    // The page closed itself (window.close() in its code, as Academy's Back to Parity does in
    // a browser tab). The window takes it away and goes back, never a black view (DEC-0059).
    wc.once("destroyed", () => {
      if (this.closing) return;
      this.closing = true;
      this.stopWatchdog();
      clearTimeout(this.blankTimer);
      ctx.log(`page closed itself: ${this.path}`);
      setImmediate(() => this.owner.pageClosed?.(this));
    });
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
    // The page's process died: load it again, up to three times a minute, then say so with
    // Retry rather than loop or leave a dead, black view.
    wc.on("render-process-gone", (_e, d) => {
      ctx.log(`page process gone (${d.reason}) on ${this.path}`);
      if (d.reason === "clean-exit" || !this.path) return;
      const now = Date.now();
      this.crashes = (this.crashes || []).filter((t) => now - t < 60_000).concat(now);
      if (this.crashes.length > 3) { setTimeout(() => this.showError(this.path || "/", "the page kept stopping"), 300); return; }
      setTimeout(() => this.load(this.path), 500);
    });
    wc.on("did-first-visually-non-empty-paint", () => this.owner.pagePainted?.(this));
    wc.on("did-finish-load", () => { this.owner.pagePainted?.(this); clearTimeout(this.blankTimer); this.blankTimer = setTimeout(() => this.checkPainted("loaded"), 5000); });
    wc.on("unresponsive", () => ctx.log(`page not responding: ${this.path}`));
    wc.on("responsive", () => ctx.log(`page responding again: ${this.path}`));
    // Errors a page prints go to the app's log (logfile.js), for tracing a problem later.
    wc.on("console-message", (e, level, message) => {
      const lv = typeof e?.level === "string" ? e.level : level === 3 ? "error" : "";
      if (lv === "error") ctx.log(`page error on ${this.path}: ${String(e?.message ?? message).slice(0, 300)}`);
    });
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

  /** Draws the page again: a fresh frame and a one-pixel nudge of its size (DEC-0059). */
  repaint(why = "") {
    if (!this.alive) return;
    this.wc.invalidate();
    const b = this.view.getBounds();
    if (b.width > 0 && b.height > 1) {
      this.view.setBounds({ ...b, height: b.height - 1 });
      setTimeout(() => { if (this.alive) this.view.setBounds(b); }, 16);
    }
    if (why) this.ctx.log(`repainted ${this.path} (${why})`);
  }

  /**
   * Never a black page (DEC-0059). An empty page (the site drew nothing) reloads once, then
   * shows Could not open with Retry. A page whose content is there but did not reach the
   * screen is drawn again.
   */
  async checkPainted(why = "") {
    if (!this.alive || this.wc.isLoading() || !this.path || !this.ctx.isTrusted(this.wc.getURL())) return;
    let dom;
    try {
      dom = await this.wc.executeJavaScript("({ t: (document.body && document.body.innerText.trim().length) || 0, r: !!(document.getElementById('root') && document.getElementById('root').firstElementChild), b: !!document.getElementById('pboot') })", true);
    } catch { return; }
    if (!this.alive) return;
    if (!dom.t && !dom.r && !dom.b) {
      if (!this.blankRetried) {
        this.blankRetried = true;
        this.ctx.log(`blank page ${this.path} (${why}), reloading`);
        this.load(this.path);
      } else {
        this.showError(this.path, "the page stayed empty");
      }
      return;
    }
    this.blankRetried = false;
    if (Date.now() - (this.repaintedAt || 0) < 10_000) return;
    const win = this.owner.win;
    if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized() || (this.view.getVisible && !this.view.getVisible())) return;
    try {
      const img = (await this.wc.capturePage()).resize({ width: 320 });
      const px = img.toBitmap();
      let lit = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 3) { n++; if (px[i] + px[i + 1] + px[i + 2] > 90) lit++; }
      if (n && lit / n < 0.002) { this.repaintedAt = Date.now(); this.repaint(`nothing on screen, ${why}`); }
    } catch { /* the view is hidden or closing */ }
  }

  history() {
    const h = this.alive ? this.wc.navigationHistory : null;
    return { back: !!h?.canGoBack(), forward: !!h?.canGoForward() };
  }

  back() { if (!this.alive) return false; const h = this.wc.navigationHistory; if (h.canGoBack()) { h.goBack(); return true; } return false; }
  forward() { if (!this.alive) return false; const h = this.wc.navigationHistory; if (h.canGoForward()) { h.goForward(); return true; } return false; }

  destroy() {
    this.closing = true;
    this.stopWatchdog();
    clearTimeout(this.blankTimer);
    if (this.alive) this.wc.close();
  }
}

module.exports = { Page };
