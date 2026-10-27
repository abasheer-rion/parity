// One Parity window (DEC-0049): the page fills the window to its top edge, the app's own
// controls sit in the page's header row, and a see-through layer over the page holds the
// menu and the command palette.
//
//   Header row   44 px. There is no separate title bar and no title text. The Mac traffic
//                lights sit over the page, centred on the row; on Windows the system draws
//                minimise, maximise and close over its right end (titleBarOverlay, in the
//                page's colour). Right of the traffic lights (at the left on Windows) a small
//                see-through view (ui-titlebar.html) holds the menu button, Back, Forward,
//                search (Cmd K) and, in Trade, Keep on top. A page marks its header row with
//                data-desktop-header (web: Trade, Terminal, Lab, Academy, the app's sidebar);
//                preload.js tells it how much room to leave on each side and makes its empty
//                parts drag the window. Double-click them to zoom (Mac) or maximise (Windows).
//                A page without one (the site, sign-in) sits under a plain 44 px strip in the
//                page colour that holds the same controls, with no title.
//   Pages        one per section, kept loaded after you leave it (Settings can turn that off),
//                so switching back is instant and keeps the page as you left it (page.js).
//   Layer        ui-overlay.html, shown only while the menu, the command palette or Open link
//                is open. Escape, a click outside it or a choice closes it.
//   Log-in wall  signed out, the window shows only the sign-in page: no menu button, no
//                search, no sections. Signing in opens the last page used.
//   Focus mode   full screen with the title bar hidden.
const { BaseWindow, WebContentsView, clipboard, shell } = require("electron");
const path = require("node:path");
const routes = require("./routes");
const { Page } = require("./page");
const TOKENS = require("./tokens");

const CHROME_H = 44;
/** Where the controls start on a Mac, right of the traffic lights (which end near 66 px). */
const LEAD_X_MAC = 72;
/** Room the Windows minimise, maximise and close buttons take at the right. */
const WIN_CONTROLS_W = 144;
/** A view's contents, or null once they are closed (they read undefined then, see page.js). */
const live = (v) => { const wc = v?.webContents; return wc && !wc.isDestroyed() ? wc : null; };
const OFFLINE_H = 28;
let seq = 0;

/** Pages that may show while signed out: the sign-in pages and the legal pages they link to. */
const openSignedOut = (p) => routes.isAuthPath(p) || /^\/legal\//.test(p || "");

class ParityWindow {
  constructor(ctx, saved, { show = true } = {}) {
    this.ctx = ctx;
    this.id = ++seq;
    this.pages = new Map();
    this.active = null;
    this.trail = [];
    this.overlayMode = null;
    this.focusMode = false;
    this.focusMadeFull = false;
    this.wallTarget = null;
    this.lastGoodPath = saved.path && !openSignedOut(saved.path) ? saved.path : null;
    this.closing = false;

    const mac = ctx.platform === "darwin";
    this.win = new BaseWindow({
      title: "Parity",
      x: saved.x, y: saved.y, width: saved.width, height: saved.height,
      minWidth: 720, minHeight: 480,
      backgroundColor: TOKENS["color-canvas"],
      show: false,
      ...(mac
        ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: Math.round(CHROME_H / 2 - 7) } }
        : { titleBarStyle: "hidden", titleBarOverlay: { color: TOKENS["color-canvas"], symbolColor: TOKENS["color-text-body"], height: CHROME_H }, icon: path.join(__dirname, "..", "assets", "icon.png") }),
    });

    // The controls' own width, measured by ui-titlebar.js: `base` without a passing message,
    // `full` with it. The page leaves `base` free; a message may briefly overlap the header.
    this.lead = { base: 168, full: 168 };
    this.sentInsets = new Map();
    this.titlebar = this.shellView("ui-titlebar.html");
    this.titlebar.setBackgroundColor("#00000000"); // tokens-ignore: fully transparent, not a colour
    this.bar = new WebContentsView({ webPreferences: { ...ctx.basePrefs } });
    this.bar.setBackgroundColor(TOKENS["color-bar"]);
    this.bar.webContents.loadURL(ctx.shellUrl("offline.html"));
    this.overlay = this.shellView("ui-overlay.html");
    this.overlay.setBackgroundColor("#00000000"); // tokens-ignore: fully transparent, not a colour
    this.overlay.setVisible(false);
    for (const v of [this.titlebar, this.bar, this.overlay]) this.win.contentView.addChildView(v);
    for (const v of [this.bar]) {
      v.webContents.on("will-navigate", (e) => e.preventDefault());
      v.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    }

    const w = this.win;
    w.on("resize", () => this.layout());
    w.on("enter-full-screen", () => { this.layout(); this.push(); });
    w.on("leave-full-screen", () => {
      if (this.focusMode) { this.focusMode = false; this.focusMadeFull = false; }
      this.layout(); this.push();
    });
    w.on("always-on-top-changed", () => this.push());
    w.on("focus", () => { ctx.focused = this; this.focusContent(); });
    w.on("swipe", (_e, dir) => { if (dir === "right") this.back(); else if (dir === "left") this.forward(); });
    w.on("app-command", (_e, cmd) => { if (cmd === "browser-backward") this.back(); else if (cmd === "browser-forward") this.forward(); });
    w.on("close", (e) => ctx.windowClosing(this, e));
    w.on("closed", () => this.destroyed());
    w.on("moved", () => ctx.saveSoon());
    w.on("resized", () => ctx.saveSoon());

    if (saved.onTop) w.setAlwaysOnTop(true, "floating");
    this.layout();
    if (saved.maximized && !ctx.hidden) w.maximize();
    if (saved.fullscreen && !ctx.hidden) w.setFullScreen(true);
    // Shown once its page has drawn something (the loading screen comes with the first
    // bytes), so it never opens as an empty dark frame; at most 1.5 s later either way.
    this.wantShow = show;
    this.revealed = false;
    this.focusOnReveal = false;
    this.revealTimer = show ? setTimeout(() => this.reveal(), 1500) : null;
    w.on("show", () => { this.revealed = true; this.checkSoon("shown"); });
    w.on("restore", () => this.checkSoon("restored"));
    w.on("focus", () => this.checkSoon("focused"));
    ctx.focused = this;
  }

  /** Shows the window the first time (window.js constructor). */
  reveal() {
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
    if (!this.alive || this.revealed || !this.wantShow) return;
    this.revealed = true;
    if (!this.ctx.hidden) {
      this.win.show();
      if (this.focusOnReveal) this.win.focus();
    }
    setTimeout(() => this.warmSections(), 6000);
  }

  /** A page drew its first content (page.js). */
  pagePainted(page) {
    if (page === this.active) this.reveal();
  }

  /** Makes every view draw again: the cure for a page that stopped drawing (main.js). */
  repaint(why = "") {
    if (!this.alive) return;
    if (this.active && !this.active.alive) { this.revive(); return; }
    for (const v of [this.titlebar, this.overlay]) live(v)?.invalidate();
    if (this.active) this.active.repaint(why);
  }

  /** Checks the page in front still shows something, a moment after the window comes back. */
  checkSoon(why) {
    clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => {
      if (!this.alive || !this.active) return;
      if (!this.active.alive) this.revive();
      else this.active.checkPainted(why);
    }, 400);
  }

  /**
   * Opens the sections used most recently in the background, so going to them later is
   * instant (only with "Keep sections loaded" on, and never more than the window keeps).
   */
  warmSections() {
    if (!this.alive || this.wall || this.maxPages < 2 || !this.ctx.state.online) return;
    const want = [];
    for (const p of this.ctx.recentPaths()) {
      const key = this.sectionOf(p);
      if (key && key !== "account" && !this.pages.has(key) && !want.some((w) => w.key === key)) want.push({ key, p });
      if (want.length >= 2) break;
    }
    for (const { key, p } of want) {
      if (this.pages.size >= this.maxPages) break;
      this.ctx.log(`warming ${key}`);
      const page = this.pageFor(key);
      if (page !== this.active) page.load(p);
    }
  }

  /** A view for one of the app's own pages (title bar, layer), with the shell bridge. */
  shellView(file) {
    const v = new WebContentsView({ webPreferences: { ...this.ctx.basePrefs, preload: path.join(__dirname, "shell-preload.js") } });
    v.setBackgroundColor(TOKENS["color-canvas"]);
    const wc = v.webContents;
    wc.on("will-navigate", (e) => e.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("will-attach-webview", (e) => e.preventDefault());
    wc.on("before-input-event", (e, input) => this.keys(e, input));
    wc.on("did-finish-load", () => { this.push(); if (file === "ui-overlay.html" && this.overlayMode) this.sendOverlay(); });
    wc.loadURL(`${this.ctx.shellUrl(file)}?w=${this.id}`);
    return v;
  }

  get alive() { return !this.win.isDestroyed(); }
  get wall() { return !this.ctx.state.signedIn || !!(this.active?.path && routes.isAuthPath(this.active.path)); }
  get maxPages() { return this.ctx.settings.instantSections ? 4 : 1; }
  owns(wc) { return !!wc && [this.titlebar, this.overlay].some((v) => v.webContents === wc); }
  ownsPage(wc) { return !!wc && [...this.pages.values()].some((p) => p.wc === wc); }

  /** Where the controls view starts: right of the Mac traffic lights, or at the left edge. */
  get leadX() { return this.ctx.platform === "darwin" && !this.win.isFullScreen() ? LEAD_X_MAC : 0; }

  /** True when the page in front has no header row of its own, so it sits under a plain strip. */
  get strip() { return !this.focusMode && !this.active?.header; }

  layout() {
    if (!this.alive) return;
    const { width, height } = this.win.getContentBounds();
    const chrome = !this.focusMode;
    const strip = this.strip;
    const top = strip ? CHROME_H : 0;
    const offline = !!this.active?.saved;
    const offH = offline ? OFFLINE_H : 0;
    const x = this.leadX;
    if (strip) this.titlebar.setBounds({ x: 0, y: 0, width, height: CHROME_H });
    else this.titlebar.setBounds({ x, y: 0, width: Math.max(0, Math.min(width - x, Math.ceil(this.lead.full))), height: chrome ? CHROME_H : 0 });
    this.titlebar.setVisible(chrome);
    // The offline line sits along the bottom, so the page's header row stays at the top.
    this.bar.setBounds({ x: 0, y: height - offH, width, height: offH });
    this.bar.setVisible(offline);
    for (const p of this.pages.values()) p.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top - offH) });
    const layerTop = chrome ? CHROME_H : 0;
    this.overlay.setBounds({ x: 0, y: layerTop, width, height: Math.max(0, height - layerTop) });
    this.sendInsets();
  }

  /** How much of the header row a page leaves free for the controls (preload.js reads it). */
  insets() {
    return { left: Math.ceil(this.leadX + this.lead.base + 6), right: this.ctx.platform === "win32" ? WIN_CONTROLS_W : 0, h: CHROME_H };
  }

  /** Tells each page the room to leave, when it changed (or to one page that asked). */
  sendInsets(onlyTo = null) {
    const i = this.insets();
    const key = JSON.stringify(i);
    for (const p of this.pages.values()) {
      if (!p.alive || (onlyTo && p.wc !== onlyTo)) continue;
      if (!onlyTo && this.sentInsets.get(p.wc.id) === key) continue;
      this.sentInsets.set(p.wc.id, key);
      p.wc.send("parity:insets", i);
    }
  }

  /** The controls view measured itself (ui-titlebar.js). */
  setLead(size) {
    const n = (v) => (Number.isFinite(v) ? Math.max(40, Math.min(640, v)) : null);
    const base = n(size?.base), full = n(size?.full);
    if (base === null || full === null) return;
    if (base === this.lead.base && full === this.lead.full) return;
    this.lead = { base, full: Math.max(base, full) };
    this.layout();
  }

  /** A page said whether it shows a header row the controls can sit in (preload.js). */
  setHeader(wc, header) {
    const page = [...this.pages.values()].find((p) => p.wc === wc);
    if (!page) return;
    this.sendInsets(wc);
    if (page.header === !!header) return;
    page.header = !!header;
    if (page === this.active) { this.layout(); this.push(); }
  }

  // ------------------------------------------------------------ pages

  sectionOf(p) {
    if (openSignedOut(p) && !/^\/legal\//.test(p)) return this.active?.key || "home";
    return routes.activeSection(`${routes.APP_ORIGIN}${p}`, this.ctx.sections) || this.active?.key || "home";
  }

  pageFor(key) {
    const have = this.pages.get(key);
    if (have) return have;
    if (this.maxPages === 1 && this.active) { // one page only: it takes the new section
      this.pages.delete(this.active.key);
      this.active.key = key;
      this.pages.set(key, this.active);
      return this.active;
    }
    while (this.pages.size >= this.maxPages) {
      const old = [...this.pages.values()].filter((p) => p !== this.active).sort((a, b) => a.usedAt - b.usedAt)[0];
      if (!old) break;
      this.dropPage(old);
    }
    const page = new Page(this.ctx, this, key);
    page.view.setVisible(false);
    this.pages.set(key, page);
    this.win.contentView.addChildView(page.view);
    this.win.contentView.addChildView(this.titlebar); // the controls stay over the page
    this.win.contentView.addChildView(this.overlay); // keep the layer on top
    this.layout();
    return page;
  }

  dropPage(page) {
    this.pages.delete(page.key);
    this.trail = this.trail.filter((k) => k !== page.key);
    try { this.win.contentView.removeChildView(page.view); } catch { /* already gone */ }
    page.destroy();
  }

  show(page) {
    if (this.active && this.active !== page) {
      this.trail.push(this.active.key);
      if (this.trail.length > 30) this.trail.shift();
    }
    this.active = page;
    page.usedAt = Date.now();
    for (const p of this.pages.values()) p.view.setVisible(p === page);
    this.layout();
    this.pageChanged(page);
    this.focusContent();
  }

  /**
   * Opens an in-app path in this window. `section: true` (the menu, Cmd plus a number) shows
   * that section as it was left when it is already loaded.
   */
  go(p, { section = false } = {}) {
    if (!this.alive) return;
    if (!this.ctx.state.signedIn && !openSignedOut(p)) {
      this.wallTarget = p;
      p = "/login/";
    }
    const page = this.pageFor(this.sectionOf(p));
    const keep = section && page !== this.active && page.path && !openSignedOut(page.path);
    this.show(page);
    if (!keep) page.load(p);
  }

  openSection(id) {
    const s = this.ctx.sections.find((x) => x.id === id);
    if (!s || this.wall) return;
    this.go(s.path, { section: true });
  }

  back() {
    if (!this.active) return;
    if (this.active.back()) return;
    while (this.trail.length) {
      const page = this.pages.get(this.trail.pop());
      if (page) { this.active = null; this.show(page); return; }
    }
  }

  forward() { this.active?.forward(); }

  reload(hard = false) {
    if (!this.active) return;
    if (!this.active.alive) { this.revive(); return; }
    if (hard) { this.active.wc.reloadIgnoringCache(); return; }
    this.ctx.state.online = null; // checks the website again, so it can leave the saved copy
    this.active.load(this.active.path || this.lastGoodPath || "/");
  }

  /** An address a page tried to open: ours opens here, anything else in the browser. */
  route(url) {
    const p = routes.toAppPath(url, this.ctx.ORIGIN);
    if (p) this.go(p);
    else if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  }

  /** A sign-in page tried to leave: allowed once signed in, to the last page used. */
  async leaveWall(page, to) {
    const signedIn = await this.ctx.refreshSignedIn();
    if (!this.alive) return;
    if (!signedIn) {
      if (!page.path || !openSignedOut(page.path)) page.load("/login/");
      return;
    }
    const last = this.wallTarget || this.lastGoodPath;
    this.wallTarget = null;
    const inAccount = last && routes.activeSection(`${routes.APP_ORIGIN}${last}`, this.ctx.sections) === "account";
    const target = last && !inAccount ? last : to && !/^\/app\/?$/.test(to) ? to : "/";
    this.ctx.signedInFrom(this);
    page.load(target);
  }

  /** A page loaded, moved or changed its title. */
  pageChanged(page, navigated = false) {
    if (!this.alive || !page.path) { this.push(); return; }
    if (navigated) {
      const key = this.sectionOf(page.path);
      if (key !== page.key && !openSignedOut(page.path)) {
        const other = this.pages.get(key);
        if (!other || other !== this.active) {
          if (other) this.dropPage(other);
          this.pages.delete(page.key);
          page.key = key;
          this.pages.set(key, page);
        }
      }
    }
    if (!openSignedOut(page.path) && this.ctx.state.signedIn) {
      if (page === this.active) this.lastGoodPath = page.path;
      this.ctx.addRecent(page.path, page.title);
    }
    if (page === this.active) {
      this.win.setTitle(this.wall ? "Parity" : page.title || "Parity");
      this.layout();
      this.push();
    }
    this.ctx.saveSoon();
  }

  focusContent() {
    if (!this.alive || !this.win.isFocused()) return;
    if (this.overlayMode) live(this.overlay)?.focus();
    else if (this.active?.alive) this.active.wc.focus();
  }

  /**
   * The page in front lost its contents (closed under it): a fresh page takes its place at
   * the same address, instead of a black view that throws on every key (DEC-0059).
   */
  revive() {
    const dead = this.active;
    if (!this.alive || !dead || dead.alive) return;
    this.ctx.log(`page in front was gone, opening ${dead.path || dead.wantPath || "/"} again`);
    const p = dead.path || dead.wantPath || this.lastGoodPath || "/";
    this.pages.delete(dead.key);
    try { this.win.contentView.removeChildView(dead.view); } catch { /* already gone */ }
    this.active = null;
    const page = this.pageFor(dead.key);
    this.show(page);
    page.load(p);
  }

  /**
   * A page closed itself (page.js): it leaves the window, and if it was in front the window
   * goes back to the section before it, or Home. Never a black view (DEC-0059).
   */
  pageClosed(page) {
    if (!this.alive || this.pages.get(page.key) !== page) return;
    this.pages.delete(page.key);
    this.trail = this.trail.filter((k) => k !== page.key);
    try { this.win.contentView.removeChildView(page.view); } catch { /* already gone */ }
    if (this.active !== page) return;
    this.active = null;
    while (this.trail.length) {
      const prev = this.pages.get(this.trail.pop());
      if (prev?.alive) { this.show(prev); return; }
    }
    this.go("/");
  }

  // ------------------------------------------------------------ title bar and layer

  state() {
    const h = this.active?.history() || { back: false, forward: false };
    return {
      id: this.id,
      platform: this.ctx.platform,
      wall: this.wall,
      focus: this.focusMode,
      fullscreen: this.win.isFullScreen(),
      strip: this.strip,
      back: h.back || (!this.wall && this.trail.some((k) => this.pages.has(k))),
      forward: h.forward,
      section: this.active?.key || null,
      onTop: this.win.isAlwaysOnTop(),
      overlay: this.overlayMode,
      offline: !!this.active?.saved,
    };
  }

  push() {
    if (!this.alive) return;
    const wc = live(this.titlebar);
    if (wc && !wc.isLoading()) wc.send("shell:state", this.state());
    this.ctx.menuChanged();
  }

  flash(text) {
    live(this.titlebar)?.send("shell:flash", String(text));
  }

  openOverlay(mode) {
    if (!this.alive || this.wall) return;
    if (this.focusMode && mode === "menu") mode = "palette";
    this.overlayMode = mode;
    this.overlay.setVisible(true);
    this.win.contentView.addChildView(this.overlay);
    this.sendOverlay();
    live(this.overlay)?.focus();
    this.push();
  }

  toggleOverlay(mode) {
    if (this.overlayMode === mode) this.closeOverlay();
    else this.openOverlay(mode);
  }

  sendOverlay() {
    const wc = live(this.overlay);
    if (!wc || wc.isLoading()) return;
    wc.send("shell:overlay", { mode: this.overlayMode, ...this.ctx.overlayData(this) });
  }

  closeOverlay() {
    if (!this.overlayMode) return;
    this.overlayMode = null;
    this.overlay.setVisible(false);
    this.push();
    this.focusContent();
  }

  // ------------------------------------------------------------ window actions

  keys(e, input) {
    if (this.passKeys > 0 && input.type !== "char") { this.passKeys--; return; } // a key the app sent to the page itself
    const action = this.ctx.actionFor(input);
    if (!action) return;
    e.preventDefault();
    this.ctx.run(action, this);
  }

  copyLink() {
    const p = this.active?.path;
    if (!p || this.wall) return;
    clipboard.writeText(routes.shareUrl(p, this.ctx.ORIGIN));
    this.flash("Link copied");
  }

  toggleOnTop() {
    const on = !this.win.isAlwaysOnTop();
    this.win.setAlwaysOnTop(on, "floating");
    this.flash(on ? "Kept on top of other windows" : "No longer kept on top");
    this.ctx.saveSoon();
  }

  toggleFocus() {
    this.focusMode = !this.focusMode;
    if (this.focusMode) {
      this.closeOverlay();
      if (!this.win.isFullScreen()) { this.focusMadeFull = true; this.win.setFullScreen(true); }
    } else if (this.focusMadeFull) {
      this.focusMadeFull = false;
      this.win.setFullScreen(false);
    }
    this.layout();
    this.push();
  }

  zoom(step) {
    const wc = this.active?.alive ? this.active.wc : null;
    if (!wc) return;
    wc.setZoomLevel(step === 0 ? 0 : wc.getZoomLevel() + step);
  }

  /** Double-click on the title bar: what the Mac's "double-click a window's title bar" setting says, or maximise on Windows. */
  titleDoubleClick(macAction) {
    if (this.ctx.platform === "darwin" && macAction === "Minimize") { this.win.minimize(); return; }
    if (this.ctx.platform === "darwin" && macAction === "None") return;
    if (this.win.isMaximized()) this.win.unmaximize();
    else this.win.maximize();
  }

  /** Moves the window by the pointer's travel since the press on the title bar. */
  dragStart(x, y) {
    if (!this.alive || this.win.isFullScreen() || !Number.isFinite(x) || !Number.isFinite(y)) { this.dragFrom = null; return; }
    if (this.win.isMaximized() && this.ctx.platform !== "darwin") {
      // A maximised Windows window comes out at its normal size, under the pointer.
      const b = this.win.getNormalBounds();
      this.win.unmaximize();
      this.win.setBounds({ ...b, x: Math.round(x - b.width / 2), y: Math.round(y - 12) });
    }
    const [wx, wy] = this.win.getPosition();
    this.dragFrom = { x, y, wx, wy };
  }

  dragMove(x, y) {
    const d = this.dragFrom;
    if (!d || !this.alive || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.win.setPosition(Math.round(d.wx + x - d.x), Math.round(d.wy + y - d.y));
  }

  dragEnd() {
    if (!this.dragFrom) return;
    this.dragFrom = null;
    this.ctx.saveSoon();
  }

  serialize() {
    const b = this.win.getNormalBounds();
    return { ...b, maximized: this.win.isMaximized(), fullscreen: this.win.isFullScreen() && !this.focusMode, onTop: this.win.isAlwaysOnTop(), path: this.lastGoodPath || "/" };
  }

  focus() {
    if (!this.alive || this.ctx.hidden) return;
    if (!this.revealed && this.wantShow) { this.focusOnReveal = true; return; }
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  destroyed() {
    clearTimeout(this.revealTimer);
    clearTimeout(this.checkTimer);
    for (const p of this.pages.values()) p.destroy();
    this.pages.clear();
    for (const v of [this.titlebar, this.bar, this.overlay]) live(v)?.close();
    this.ctx.windowClosed(this);
  }
}

module.exports = { ParityWindow, CHROME_H };
