// Parity Workbench's views, keys and settings (DEC-0043). Settings stay in this browser.

export type View = "try" | "whatif" | "compare" | "search" | "edges" | "settings";

export const VIEWS: { id: View; label: string; short: string; icon: string; research?: boolean }[] = [
  { id: "try", label: "Try settings", short: "Try", icon: "flask" },
  { id: "whatif", label: "What if", short: "What if", icon: "pulse" },
  { id: "compare", label: "Compare", short: "Compare", icon: "compare" },
  { id: "search", label: "Strategy search", short: "Search", icon: "search", research: true },
  { id: "edges", label: "Edge Lab", short: "Edge Lab", icon: "checkCircle", research: true },
  { id: "settings", label: "Settings", short: "Settings", icon: "gear" },
];

export const KEYS: [string, string][] = [
  ["Shift+1 to 6", "Try settings, What if, Compare, Strategy search, Edge Lab, Settings"],
  ["/", "Find (strategy, search box)"],
  ["L", "Copy a link to this view"],
  ["?", "Keys"],
];

export interface Settings {
  density: "compact" | "comfortable";
  /** Open on the view used last, or always on Try settings. */
  start: "last" | "try";
  last: View;
}

const KEY = "parity.lab.settings";
const DEFAULTS: Settings = { density: "compact", start: "last", last: "try" };

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") ?? {};
    return {
      density: raw.density === "comfortable" ? "comfortable" : "compact",
      start: raw.start === "try" ? "try" : "last",
      last: VIEWS.some((v) => v.id === raw.last && v.id !== "settings") ? raw.last : "try",
    };
  } catch { return DEFAULTS; }
}

export function writeSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* a convenience only */ }
}
