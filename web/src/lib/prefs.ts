// Per-viewer conveniences (theme, bookmarks, reading options). Kept in this browser
// only; nothing here is research data. Every read and write tolerates storage being
// unavailable (private windows, blocked site data).
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light" | "system";
export type Range = "1M" | "3M" | "YTD" | "1Y" | "5Y" | "10Y" | "ALL";

export interface Prefs {
  theme: Theme;
  previewDelay: number;
  findOnSelect: boolean;
  startingAmount: number;
  defaultRange: Range;
  bookmarks: { href: string; label: string }[];
}

const KEY = "parity.prefs.v1";
const DEFAULTS: Prefs = {
  theme: "dark",
  previewDelay: 180,
  findOnSelect: true,
  startingAmount: 10_000,
  defaultRange: "ALL",
  bookmarks: [
    { href: "#/doc/RES-0007", label: "Comparing every algorithm" },
    { href: "#/doc/REF-0006", label: "The gauntlet" },
  ],
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable: keep in memory */ }
  applyTheme();
  listeners.forEach((l) => l());
}

export function getPrefs(): Prefs {
  return current;
}

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

export function applyTheme() {
  const t = current.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : current.theme;
  document.documentElement.dataset.theme = t;
}

export function toggleBookmark(href: string, label: string) {
  const has = current.bookmarks.some((b) => b.href === href);
  setPrefs({ bookmarks: has ? current.bookmarks.filter((b) => b.href !== href) : [...current.bookmarks, { href, label }] });
}
