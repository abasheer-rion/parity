// The app's own settings (DEC-0049), kept in settings.json in the app's data folder and
// changed on the Settings page (Cmd or Ctrl plus comma). Plain functions, no Electron, so
// `npm test` can run them. Anything missing or of the wrong type falls back to the default.
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = Object.freeze({
  /** A Parity item in the Mac menu bar or the Windows tray, with quick actions. */
  tray: true,
  /** The active watchlist's prices scroll in the menu bar item (Mac) or its tooltip (Windows). */
  ticker: true,
  /** Closing the last window keeps Parity running in the menu bar, so Trade alerts still arrive. */
  keepRunning: false,
  /** A key anywhere on the computer that shows or hides Parity, such as Alt+Shift+P. Empty is off. */
  globalShortcut: "",
  /** Sections stay loaded in the background after you leave them, so going back is instant. */
  instantSections: true,
  /** Reopen every window, with its page, size and place, at launch. */
  restoreWindows: true,
  /** Check for a new version at launch and every 6 hours. */
  autoUpdate: true,
  /** Two-finger swipe left or right on a Mac trackpad goes back or forward. */
  swipe: true,
  /** Trade alerts show as system notifications. */
  notifications: true,
});

const MODIFIERS = new Set(["CommandOrControl", "CmdOrCtrl", "Command", "Cmd", "Control", "Ctrl", "Alt", "Option", "AltGr", "Shift", "Super", "Meta"]);

/** True for an Electron accelerator with one to three modifiers and one key, such as Alt+Shift+P or CmdOrCtrl+F9. */
function validAccelerator(value) {
  if (typeof value !== "string" || value.length > 60) return false;
  const parts = value.split("+");
  if (parts.length < 2 || parts.length > 4) return false;
  const key = parts.pop();
  if (!parts.every((m) => MODIFIERS.has(m)) || new Set(parts).size !== parts.length) return false;
  return /^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown)$/.test(key);
}

/** Settings from anything (a parsed file, a form), keeping only known keys of the right type. */
function clean(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return out;
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const v = raw[key];
    if (typeof def === "boolean" && typeof v === "boolean") out[key] = v;
  }
  if (raw.globalShortcut === "" || validAccelerator(raw.globalShortcut)) out.globalShortcut = raw.globalShortcut;
  return out;
}

function load(dir) {
  try { return clean(JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"))); } catch { return clean(null); }
}

function save(dir, settings) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(clean(settings), null, 2));
  } catch { /* the next launch uses the defaults */ }
}

module.exports = { DEFAULTS, clean, load, save, validAccelerator };
