// The page side of the desktop app (DEC-0041, DEC-0049). Gives the website's pages a small,
// fixed set of calls as window.parityDesktop (web/src/desktop/bridge.ts). No Node, no file
// access, nothing else from Electron.
//
// Pages load live from the website (DEC-0048), so the bridge is only given to the
// addresses the main process trusts: the bundled copy (app://parity) and the website's own
// addresses. Any other page gets nothing. The main process checks the sender again.
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
    // Staying signed in (electron/session.js, DEC-0072): the app asks the page to check its
    // session after sleep, unlock, a connection coming back and every 30 minutes.
    onSessionCheck: (cb) => { if (typeof cb === "function") ipcRenderer.on("parity:session-check", () => { try { cb(); } catch { /* the next check tries again */ } }); },
    // Who is signed in, for the bundled copy when the app starts offline. Id and email only.
    savedUser: () => ipcRenderer.invoke("parity:saved-user"),
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
