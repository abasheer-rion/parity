// The page side of the desktop app (DEC-0041). Gives the website's pages a small, fixed
// set of calls as window.parityDesktop (web/src/desktop/bridge.ts). No Node, no file
// access, nothing else from Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("parityDesktop", {
  platform: process.platform,
  version: (process.argv.find((a) => a.startsWith("--parity-version=")) || "").split("=")[1] || "",
  setToken: (token) => ipcRenderer.send("parity:token", typeof token === "string" ? token : null),
  notify: (title, body, href) => ipcRenderer.send("parity:notify", { title: String(title), body: String(body), href: typeof href === "string" ? href : undefined }),
  openExternal: (url) => ipcRenderer.send("parity:open", String(url)),
});
