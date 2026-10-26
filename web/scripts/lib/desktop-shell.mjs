// The desktop app's own pages (desktop/electron/*.html: title bar, menu and palette,
// Settings, the error and offline pages) opened as plain files in headless Chromium, with a
// stand-in for the bridge the app's preload script gives them. Electron is never started.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const shell = (p) => pathToFileURL(resolve(import.meta.dirname, "../../../desktop/electron", p)).href;

export const DESKTOP_PAGES = [
  { name: "title bar", url: shell("ui-titlebar.html"), viewport: { width: 1200, height: 38 } },
  { name: "sections menu", url: `${shell("ui-overlay.html")}?mode=menu`, viewport: { width: 1200, height: 800 } },
  { name: "command palette", url: `${shell("ui-overlay.html")}?mode=palette`, viewport: { width: 1200, height: 800 } },
  { name: "open link", url: `${shell("ui-overlay.html")}?mode=link`, viewport: { width: 1200, height: 800 } },
  { name: "settings", url: shell("ui-settings.html"), viewport: { width: 640, height: 800 } },
  { name: "error page", url: shell("ui-error.html"), viewport: { width: 1200, height: 800 } },
  { name: "offline strip", url: shell("offline.html"), viewport: { width: 1200, height: 30 } },
  { name: "site offline page", url: pathToFileURL(resolve(import.meta.dirname, "../../public/offline.html")).href, viewport: { width: 1200, height: 800 } },
];

/** Runs in the page before its scripts: the window.parityShell bridge with sample answers. */
export function shellStub() {
  const mode = new URLSearchParams(location.search).get("mode") || "palette";
  const sections = [
    { id: "site", label: "Home", icon: "home", key: "Cmd 1" },
    { id: "app", label: "Product", icon: "grid", key: "Cmd 2" },
    { id: "trade", label: "Trade", icon: "chart", key: "Cmd 3" },
    { id: "settings-section", label: "Account", icon: "gear", bottom: true },
  ];
  const answers = {
    state: { title: "Strategies", back: true, forward: false, wall: false, overlay: null, section: "trade", onTop: false, offline: false, fullscreen: false },
    "settings:get": { settings: { restoreWindows: true, instantSections: false, swipe: true, tray: true, ticker: false, keepRunning: false, notifications: true, autoUpdate: true, globalShortcut: "" }, version: "0.2.1", update: "Up to date", canInstall: true, workspaces: ["Morning trading"] },
    "settings:set": {},
    overlay: { mode, sections, active: "app", recent: [{ title: "Strategies", path: "/app/#/strategies" }], workspaces: ["Morning trading"], commands: [{ id: "settings", label: "Settings", key: "Cmd ," }, { id: "new-window", label: "New window", key: "Cmd N" }], onTop: false },
  };
  window.__shellSent = [];
  window.parityShell = {
    platform: "darwin",
    send: (action, arg) => { window.__shellSent.push([action, arg ?? null]); },
    ask: async (action) => answers[action] ?? { ok: false },
    on: () => {},
  };
}
