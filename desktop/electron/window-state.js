// Remembers the window's size and place, whether it was maximised or full screen, and the
// last page, in a small file in the app's data folder (DEC-0041).
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = { width: 1440, height: 900, maximized: false, fullscreen: false, lastPath: "/" };

function load(dir, displays) {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(path.join(dir, "window-state.json"), "utf8")); } catch { /* first run */ }
  const state = { ...DEFAULTS, ...saved };
  // A window saved on a screen that is no longer plugged in opens centred on the main one.
  const onScreen = Number.isFinite(state.x) && Number.isFinite(state.y) && displays.some((d) => {
    const b = d.workArea;
    return state.x < b.x + b.width - 80 && state.x + state.width > b.x + 80 && state.y >= b.y - 10 && state.y < b.y + b.height - 80;
  });
  if (!onScreen) { delete state.x; delete state.y; }
  state.width = Math.max(960, Math.min(state.width, 4000));
  state.height = Math.max(600, Math.min(state.height, 3000));
  if (typeof state.lastPath !== "string" || !state.lastPath.startsWith("/") || state.lastPath.startsWith("//")) state.lastPath = "/";
  return state;
}

function save(dir, win, lastPath) {
  try {
    const normal = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
    const state = { ...normal, maximized: win.isMaximized(), fullscreen: win.isFullScreen(), lastPath: lastPath || "/" };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "window-state.json"), JSON.stringify(state));
  } catch { /* a convenience only */ }
}

module.exports = { load, save, DEFAULTS };
