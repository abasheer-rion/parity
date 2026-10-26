// The Parity item in the Mac menu bar or the Windows tray (DEC-0049).
//
//   Ticker   the active Trade watchlist's last delayed close and day change. On a Mac the item
//            shows one instrument at a time, changing every 4 seconds; on Windows the tooltip
//            lists them. The menu lists them all; clicking one opens the watchlists.
//   Menu     show Parity, a new window, sections, Trade alerts, settings, updates and quit.
//
// The prices come from a Trade page (web/src/trade/DesktopTicker.tsx): any open one, or a
// hidden one the app keeps loaded while the ticker or "keep running" is on (main.js).
const { Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");

const ROTATE_MS = 4000;

class ParityTray {
  constructor(ctx) {
    this.ctx = ctx;
    this.tray = null;
    this.items = [];
    this.index = 0;
    this.timer = null;
  }

  /** Shows or removes the item to match Settings. */
  sync() {
    const want = this.ctx.settings.tray && !this.ctx.hidden;
    if (want && !this.tray) this.create();
    else if (!want && this.tray) this.remove();
    if (this.tray) this.render();
  }

  create() {
    const mac = this.ctx.platform === "darwin";
    const file = mac ? "trayTemplate.png" : "tray.png";
    let icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", file));
    if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "icon.png")).resize({ width: 16, height: 16 });
    if (mac) icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip("Parity");
    if (!mac) this.tray.on("click", () => this.ctx.showAll());
  }

  remove() {
    clearInterval(this.timer);
    this.timer = null;
    this.tray?.destroy();
    this.tray = null;
  }

  setTicker(items) {
    this.items = Array.isArray(items) ? items.filter((i) => i && i.symbol) : [];
    if (this.index >= this.items.length) this.index = 0;
    if (this.tray) this.render();
  }

  line(i) { return `${i.symbol} ${i.last} ${i.change}`.trim(); }

  render() {
    if (!this.tray) return;
    const mac = this.ctx.platform === "darwin";
    const show = this.ctx.settings.ticker && this.items.length > 0;
    clearInterval(this.timer);
    this.timer = null;
    if (mac) {
      const paint = () => {
        if (!this.tray) return;
        const i = this.items[this.index % this.items.length];
        this.tray.setTitle(i ? ` ${this.line(i)}` : "", { fontType: "monospacedDigit" });
        this.index = (this.index + 1) % Math.max(1, this.items.length);
      };
      if (show) { paint(); if (this.items.length > 1) this.timer = setInterval(paint, ROTATE_MS); }
      else this.tray.setTitle("");
    }
    this.tray.setToolTip(show ? `Parity\n${this.items.slice(0, 8).map((i) => this.line(i)).join("\n")}` : "Parity");
    this.tray.setContextMenu(this.menu(show));
  }

  menu(show) {
    const { ctx } = this;
    const sections = ctx.sections.filter((s) => !s.bottom).map((s) => ({ label: s.label, click: () => ctx.openPath(s.path, { section: true }) }));
    const ticker = show
      ? [
        { label: "Watchlist, delayed daily closes", enabled: false },
        ...this.items.slice(0, 12).map((i) => ({ label: `${i.symbol}    ${i.last}    ${i.change}`, click: () => ctx.openPath("/trade/#/watchlists") })),
        { type: "separator" },
      ]
      : [];
    return Menu.buildFromTemplate([
      { label: "Show Parity", click: () => ctx.showAll() },
      { label: "New window", click: () => ctx.newWindow() },
      { type: "separator" },
      ...ticker,
      { label: "Open", submenu: sections },
      { label: "Trade alerts", click: () => ctx.openPath("/trade/#/alerts") },
      { type: "separator" },
      { label: "Settings", click: () => ctx.openSettings() },
      { label: "Check for updates", click: () => ctx.updates.check(true) },
      { type: "separator" },
      { label: "Quit Parity", click: () => ctx.quit() },
    ]);
  }
}

module.exports = { ParityTray };
