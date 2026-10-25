// The page side of the desktop app (DEC-0041). Gives the website's pages a small, fixed
// set of calls as window.parityDesktop (web/src/desktop/bridge.ts). No Node, no file
// access, nothing else from Electron.
//
// Pages load live from the website (DEC-0048), so the bridge is only given to the
// addresses the main process trusts: the bundled copy (app://parity) and the website's own
// addresses. Any other page gets nothing. The main process checks the sender again.
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
  });
}
