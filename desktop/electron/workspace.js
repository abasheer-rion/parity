// What the app remembers between launches (DEC-0049), in state.json in the app's data folder:
//
//   windows      every open window: its size and place, maximised or full screen, kept on
//                top or not, and its page. Launch reopens them all.
//   lastPath     the page of the last window closed, so a launch with no saved windows opens it.
//   recent       the last pages opened, newest first, for the Go menu and the command palette.
//   workspaces   named sets of windows saved with "Save windows as workspace". Opening one
//                replaces the open windows with it.
//
// Plain functions, no Electron, so `npm test` can run them. Version 0.1.x kept one window in
// window-state.json; that file is read once if state.json does not exist yet.
const fs = require("node:fs");
const path = require("node:path");

const WINDOW = Object.freeze({ width: 1440, height: 900, maximized: false, fullscreen: false, onTop: false, path: "/" });
const MAX_WINDOWS = 12;
const MAX_RECENT = 12;
const MAX_WORKSPACES = 20;

const safePath = (p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && p.length < 2048;
const num = (v) => (Number.isFinite(v) ? Math.round(v) : undefined);

/**
 * One window's saved state, made safe: sizes within limits, a page that is an in-app path,
 * and no position when that place is not on any connected screen (it then opens centred).
 */
function cleanWindow(raw, displays = []) {
  const w = { ...WINDOW };
  if (!raw || typeof raw !== "object") return w;
  w.width = Math.max(480, Math.min(num(raw.width) ?? WINDOW.width, 6000));
  w.height = Math.max(360, Math.min(num(raw.height) ?? WINDOW.height, 4000));
  for (const k of ["maximized", "fullscreen", "onTop"]) w[k] = raw[k] === true;
  w.path = safePath(raw.path) ? raw.path : "/";
  const x = num(raw.x), y = num(raw.y);
  const onScreen = x !== undefined && y !== undefined && displays.some((d) => {
    const b = d.workArea || d.bounds;
    return b && x < b.x + b.width - 80 && x + w.width > b.x + 80 && y >= b.y - 10 && y < b.y + b.height - 80;
  });
  if (onScreen) { w.x = x; w.y = y; }
  return w;
}

function cleanRecent(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r || !safePath(r.path) || seen.has(r.path)) continue;
    seen.add(r.path);
    out.push({ path: r.path, title: typeof r.title === "string" ? r.title.slice(0, 120) : r.path });
    if (out.length >= MAX_RECENT) break;
  }
  return out;
}

/** Adds a page to the front of the recent list, once, keeping the newest MAX_RECENT. */
function pushRecent(list, entry) {
  if (!entry || !safePath(entry.path)) return cleanRecent(list);
  return cleanRecent([{ path: entry.path, title: entry.title || entry.path }, ...(list || []).filter((r) => r && r.path !== entry.path)]);
}

const cleanName = (name) => (typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "");

function cleanState(raw, displays = []) {
  const s = raw && typeof raw === "object" ? raw : {};
  const windows = Array.isArray(s.windows) ? s.windows.slice(0, MAX_WINDOWS).map((w) => cleanWindow(w, displays)) : [];
  const workspaces = {};
  if (s.workspaces && typeof s.workspaces === "object") {
    for (const [name, list] of Object.entries(s.workspaces).slice(0, MAX_WORKSPACES)) {
      const n = cleanName(name);
      if (n && Array.isArray(list) && list.length) workspaces[n] = list.slice(0, MAX_WINDOWS).map((w) => cleanWindow(w, displays));
    }
  }
  return { windows, recent: cleanRecent(s.recent), workspaces, lastPath: safePath(s.lastPath) ? s.lastPath : windows[0]?.path || "/" };
}

function load(dir, displays = []) {
  const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")); } catch { return null; } };
  const saved = read("state.json");
  if (saved) return cleanState(saved, displays);
  const old = read("window-state.json"); // version 0.1.x
  return cleanState(old ? { windows: [{ ...old, path: old.lastPath }] } : null, displays);
}

function save(dir, state) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(cleanState(state, [{ workArea: { x: -1e6, y: -1e6, width: 2e6, height: 2e6 } }])));
  } catch { /* a convenience only */ }
}

module.exports = { WINDOW, MAX_RECENT, cleanWindow, cleanRecent, pushRecent, cleanName, cleanState, load, save };
