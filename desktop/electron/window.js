// One Parity window (DEC-0049): a slim title bar on top, the page under it edge to edge, and
// a see-through layer over the page for the menu and the command palette.
//
//   Title bar    38 px, drawn by the app (ui-titlebar.html). Drag it to move the window and
//                double-click it to zoom (Mac) or maximise (Windows). It holds the menu button
//                (right of the Mac traffic lights, at the left on Windows, where the system
//                draws its own minimise, maximise and close buttons on the right), Back and
//                Forward, the page title, a search button and, in Trade, Keep on top.
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

const TITLE_H = 38;
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
      backgroundColor: "#050608",
      show: false,
      ...(mac
        ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 12 } }
        : { titleBarStyle: "hidden", titleBarOverlay: { color: "#050608", symbolColor: "#c9ccd6", height: TITLE_H }, icon: path.join(__dirname, "..", "assets", "icon.png") }),
    });

    this.titlebar = this.shellView("ui-titlebar.html");
    this.bar = new WebContentsView({ webPreferences: { ...ctx.basePrefs } });
    this.bar.setBackgroundColor("#050608");
    this.bar.webContents.loadURL(ctx.shellUrl("offline.html"));
    this.overlay = this.shellView("ui-overlay.html");
    this.overlay.setBackgroundColor("#00000000");
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
    if (saved.maximized) w.maximize();
    if (saved.fullscreen) w.setFullScreen(true);
    if (show) w.show();
    ctx.focused = this;
  }

  /** A view for one of the app's own pages (title bar, layer), with the shell bridge. */
  shellView(file) {
    const v = new WebContentsView({ webPreferences: { ...this.ctx.basePrefs, preload: path.join(__dirname, "shell-preload.js") } });
    v.setBackgroundColor("#050608");
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
  owns(wc) { return [this.titlebar, this.overlay].some((v) => v.webContents === wc); }
  ownsPage(wc) { return [...this.pages.values()].some((p) => p.wc === wc); }

  layout() {
    if (!this.alive) return;
    const { width, height } = this.win.getContentBounds();
    const top = this.focusMode ? 0 : TITLE_H;
    const offline = !!this.active?.saved;
    this.titlebar.setBounds({ x: 0, y: 0, width, height: top });
    this.titlebar.setVisible(top > 0);
    this.bar.setBounds({ x: 0, y: top, width, height: offline ? OFFLINE_H : 0 });
    this.bar.setVisible(offline);
    const y = top + (offline ? OFFLINE_H : 0);
    for (const p of this.pages.values()) p.view.setBounds({ x: 0, y, width, height: Math.max(0, height - y) });
    this.overlay.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
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
    if (this.overlayMode) this.overlay.webContents.focus();
    else this.active?.wc.focus();
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
      title: this.wall ? "" : this.active?.title || "Parity",
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
    const wc = this.titlebar.webContents;
    if (!wc.isDestroyed() && !wc.isLoading()) wc.send("shell:state", this.state());
    this.ctx.menuChanged();
  }

  flash(text) {
    const wc = this.titlebar.webContents;
    if (!wc.isDestroyed()) wc.send("shell:flash", String(text));
  }

  openOverlay(mode) {
    if (!this.alive || this.wall) return;
    if (this.focusMode && mode === "menu") mode = "palette";
    this.overlayMode = mode;
    this.overlay.setVisible(true);
    this.win.contentView.addChildView(this.overlay);
    this.sendOverlay();
    this.overlay.webContents.focus();
    this.push();
  }

  toggleOverlay(mode) {
    if (this.overlayMode === mode) this.closeOverlay();
    else this.openOverlay(mode);
  }

  sendOverlay() {
    const wc = this.overlay.webContents;
    if (wc.isDestroyed() || wc.isLoading()) return;
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
    const wc = this.active?.wc;
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
    if (!this.alive) return;
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  destroyed() {
    for (const p of this.pages.values()) p.destroy();
    this.pages.clear();
    for (const v of [this.titlebar, this.bar, this.overlay]) if (!v.webContents.isDestroyed()) v.webContents.close();
    this.ctx.windowClosed(this);
  }
}

module.exports = { ParityWindow, TITLE_H };
