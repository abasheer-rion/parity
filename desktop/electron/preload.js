// The page side of the desktop app (DEC-0041, DEC-0049). Gives the website's pages a small,
// fixed set of calls as window.parityDesktop (web/src/desktop/bridge.ts). No Node, no file
// access, nothing else from Electron.
//
// Pages load live from the website (DEC-0048), so the bridge is only given to the
// addresses the main process trusts: the bundled copy (app://parity) and the website's own
// addresses. Any other page gets nothing. The main process checks the sender again.
//
// The window has no title bar (window.js): a page marks its header row with
// data-desktop-header, and this file tells it how much room the window's controls need
// (CSS variables --desktop-chrome-left, --desktop-chrome-right and --desktop-chrome-h on
// <html data-desktop-chrome>), makes the row's empty parts drag the window, and tells the
// main process whether such a row is showing at the top. A page without one still runs to
// the top edge: its top row (the height of the controls) becomes an invisible drag region,
// with every link, button and field in it left clickable.
//
// It also turns the mouse's back and forward buttons, and a two-finger swipe sideways on a
// Mac trackpad that nothing on the page uses, into Back and Forward.
const { contextBridge, ipcRenderer } = require("electron");

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3);
const trusted = arg("parity-origins").split(",").filter(Boolean);
const here = `${window.location.protocol}//${window.location.host}`;

if (trusted.includes(here)) {
  contextBridge.exposeInMainWorld("parityDesktop", {
    platform: process.platform,
    version: arg("parity-version"),
    setToken: (token) => ipcRenderer.send("parity:token", typeof token === "string" ? token : null),
    notify: (title, body, href) => ipcRenderer.send("parity:notify", { title: String(title), body: String(body), href: typeof href === "string" ? href : undefined }),
    openExternal: (url) => ipcRenderer.send("parity:open", String(url)),
    setTicker: (items) => {
      if (!Array.isArray(items)) return;
      const clean = items.slice(0, 12).map((i) => ({
        symbol: String(i?.symbol ?? "").slice(0, 16),
        last: String(i?.last ?? "").slice(0, 16),
        change: String(i?.change ?? "").slice(0, 12),
        up: i?.up === true ? true : i?.up === false ? false : null,
      }));
      ipcRenderer.send("parity:ticker", clean);
    },
  });

  if (arg("parity-chrome") === "inset") chrome();

  // Mouse buttons 4 and 5 (back and forward on most mice).
  window.addEventListener("mouseup", (e) => {
    if (e.button === 3) ipcRenderer.send("parity:nav", "back", "mouse");
    else if (e.button === 4) ipcRenderer.send("parity:nav", "forward", "mouse");
  }, true);

  // Two-finger swipe on a Mac trackpad: a mostly sideways scroll that no part of the page
  // can scroll and no chart uses. Each swipe counts once, until the fingers rest.
  if (process.platform === "darwin") {
    let sum = 0, last = 0, done = false;
    const usesSideways = (target, dx) => {
      for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
        if (el.tagName === "CANVAS" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
        if (el.scrollWidth > el.clientWidth + 1) {
          const ox = getComputedStyle(el).overflowX;
          if (ox === "auto" || ox === "scroll") {
            if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1) return true;
          }
        }
      }
      const root = document.scrollingElement;
      return !!root && (dx < 0 ? root.scrollLeft > 0 : root.scrollLeft + root.clientWidth < root.scrollWidth - 1);
    };
    window.addEventListener("wheel", (e) => {
      if (e.timeStamp - last > 350) { sum = 0; done = false; }
      last = e.timeStamp;
      if (done || e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 2 || usesSideways(e.target, e.deltaX)) { sum = 0; return; }
      sum += e.deltaX;
      if (Math.abs(sum) > 180) {
        done = true;
        ipcRenderer.send("parity:nav", sum < 0 ? "back" : "forward", "swipe");
      }
    }, { passive: true });
  }
}

/** The header row hand-off described at the top of this file. */
function chrome() {
  const root = document.documentElement;
  const mac = process.platform === "darwin";
  let insets = { left: mac ? 246 : 174, right: process.platform === "win32" ? 144 : 0, h: 44 };
  const apply = () => {
    root.setAttribute("data-desktop-chrome", process.platform);
    root.style.setProperty("--desktop-chrome-left", `${insets.left}px`);
    root.style.setProperty("--desktop-chrome-right", `${insets.right}px`);
    root.style.setProperty("--desktop-chrome-h", `${insets.h}px`);
  };
  apply();
  ipcRenderer.on("parity:insets", (_e, i) => {
    const ok = (v) => Number.isFinite(v) && v >= 0 && v <= 800;
    if (!i || !ok(i.left) || !ok(i.right) || !ok(i.h)) return;
    insets = { left: i.left, right: i.right, h: i.h };
    apply();
    schedule();
  });

  // Controls inside the row keep their clicks; everything else in it moves the window.
  // Only things that take a click: a page-wide wrapper with a role or tabindex="-1" (a dialog,
  // a focusable main) must not turn the whole top row into a control.
  const CONTROLS = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [role="slider"], [contenteditable="true"], [contenteditable=""], [tabindex]:not([tabindex="-1"]), canvas, iframe, video';
  const style = document.createElement("style");
  style.textContent = `html[data-desktop-chrome] [data-desktop-header] { -webkit-app-region: drag; app-region: drag; }
html[data-desktop-chrome] .parity-desktop-drag { position: fixed; z-index: -1; left: 0; top: 0; right: 0; height: var(--desktop-chrome-h); -webkit-app-region: drag; app-region: drag; }
html[data-desktop-chrome][data-desktop-header-shown] .parity-desktop-drag { display: none; }
html[data-desktop-chrome] :is(${CONTROLS}) { -webkit-app-region: no-drag; app-region: no-drag; }`;
  // The invisible drag region along the top of a page with no header row of its own.
  const band = document.createElement("div");
  band.className = "parity-desktop-drag";
  band.setAttribute("aria-hidden", "true");
  const addStyle = () => {
    if (!style.isConnected) (document.head || root).appendChild(style);
    if (document.body && !band.isConnected) document.body.prepend(band);
  };

  /** The marked row at the window's top left, wide enough for the controls, or null. */
  const header = () => {
    for (const el of document.querySelectorAll("[data-desktop-header]")) {
      const r = el.getBoundingClientRect();
      if (r.top <= 1 && r.left >= -1 && r.left <= 1 && r.bottom >= 28 && r.width >= insets.left && getComputedStyle(el).visibility !== "hidden") return el;
    }
    return null;
  };
  let told = null;
  let timer = null;
  const check = () => {
    timer = null;
    addStyle();
    const has = !!header();
    root.toggleAttribute("data-desktop-header-shown", has);
    if (has !== told) { told = has; ipcRenderer.send("parity:chrome", { header: has }); }
  };
  function schedule() { if (!timer) timer = setTimeout(check, 120); }

  const start = () => {
    addStyle();
    check();
    new MutationObserver(schedule).observe(document.body || root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style", "data-desktop-header"] });
    window.addEventListener("resize", schedule);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("load", schedule);

  // A press on the row's empty part: the system moves the window from the drag region on
  // Windows (the page never sees the press). A Mac view inside the window does not always get
  // the region, so the press arrives here and the window follows the pointer instead.
  const emptyRow = (target, y) => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    const row = el.closest("[data-desktop-header]");
    const hit = el.closest(CONTROLS);
    // A page with no header row: anything in its top row that is not a control.
    if (!row) return !told && y < insets.h && !hit;
    return !hit || hit === row || !row.contains(hit);
  };
  window.addEventListener("dblclick", (e) => { if (emptyRow(e.target, e.clientY)) ipcRenderer.send("parity:drag", "dblclick"); });
  if (!mac) return;
  let drag = null;
  let queued = null;
  window.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.detail > 1 || !emptyRow(e.target, e.clientY)) return;
    drag = e.pointerId;
    ipcRenderer.send("parity:drag", "start", { x: e.screenX, y: e.screenY });
  }, true);
  window.addEventListener("pointermove", (e) => {
    if (drag === null || e.pointerId !== drag) return;
    const first = queued === null;
    queued = { x: e.screenX, y: e.screenY };
    if (first) requestAnimationFrame(() => { if (queued) ipcRenderer.send("parity:drag", "move", queued); queued = null; });
  }, true);
  const stop = (e) => {
    if (drag === null || e.pointerId !== drag) return;
    if (queued) ipcRenderer.send("parity:drag", "move", queued);
    queued = null;
    drag = null;
    ipcRenderer.send("parity:drag", "end");
  };
  window.addEventListener("pointerup", stop, true);
  window.addEventListener("pointercancel", stop, true);
}
