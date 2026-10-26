// The bridge for the app's own pages (DEC-0049): the title bar, the menu and palette layer and
// the Settings page, all served from app://parity/__desktop/. Website pages never get it; the
// main process also checks that each message comes from one of these views.
const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = new Set(["shell:state", "shell:flash", "shell:overlay", "shell:settings"]);

if (window.location.protocol === "app:" && window.location.host === "parity" && window.location.pathname.startsWith("/__desktop/")) {
  contextBridge.exposeInMainWorld("parityShell", {
    platform: process.platform,
    /** One of a fixed list of actions (main.js, SHELL_ACTIONS). */
    send: (action, arg) => ipcRenderer.send("shell:do", String(action), arg === undefined ? null : arg),
    /** The same, waiting for an answer. */
    ask: (action, arg) => ipcRenderer.invoke("shell:ask", String(action), arg === undefined ? null : arg),
    on: (channel, fn) => { if (CHANNELS.has(channel)) ipcRenderer.on(channel, (_e, data) => fn(data)); },
  });
}
