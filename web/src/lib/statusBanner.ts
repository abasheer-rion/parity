// The site-wide warnings banner's rules (DEC-0073): which warnings from /status.json show,
// and which ones this browser has closed. The status page is built by scripts/updates/build.py
// and the warnings come from scripts/updates/status.py.
//
// web/public/status-banner.js does the same for the plain HTML pages without a build step;
// tests/statusBanner.test.ts keeps the two in step (same storage key, same colours).
// No imports and no browser globals at import time.

export type Level = "info" | "warning" | "outage";
export interface StatusWarning { id: string; level: Level; title: string; detail: string; link: string; start: string }

export const STATUS_URL = "/status.json";
export const DISMISS_KEY = "parity.status.dismissed";
const MAX_REMEMBERED = 50;

/** The words before each warning and its colours: text on its own background, at least 4.5:1 (WCAG 2.2 AA). */
export const LEVELS: Record<Level, { word: string; bg: string; fg: string; edge: string }> = {
  info: { word: "Notice", bg: "#0e1a36", fg: "#eef2ff", edge: "#85a8ff" }, // tokens-ignore: shared with public/status-banner.js, which has no build step to read tokens
  warning: { word: "Warning", bg: "#2b2208", fg: "#fbf0d0", edge: "#e8c06a" }, // tokens-ignore: shared with public/status-banner.js, which has no build step to read tokens
  outage: { word: "Outage", bg: "#3b1013", fg: "#ffe6e6", edge: "#f07a7a" }, // tokens-ignore: shared with public/status-banner.js, which has no build step to read tokens
};

/** Only links inside the site or to an https address are shown. */
export function safeLink(href: unknown): string {
  return typeof href === "string" && (/^\/(?!\/)/.test(href) || /^https:\/\//.test(href)) ? href : "";
}

/** The warnings in a /status.json document, checked field by field. Anything malformed is dropped. */
export function parseStatus(doc: unknown): StatusWarning[] {
  const list = (doc as { warnings?: unknown })?.warnings;
  if (!Array.isArray(list)) return [];
  return list.flatMap((w) => {
    const x = w as Record<string, unknown>;
    if (!x || typeof x.id !== "string" || !x.id || typeof x.title !== "string" || !x.title) return [];
    if (x.level !== "info" && x.level !== "warning" && x.level !== "outage") return [];
    return [{ id: x.id, level: x.level, title: x.title, detail: typeof x.detail === "string" ? x.detail : "",
      link: safeLink(x.link), start: typeof x.start === "string" ? x.start : "" }];
  });
}

/** The ids this browser has closed. Empty when storage is blocked or holds something else. */
export function readDismissed(storage: Pick<Storage, "getItem"> | null | undefined): string[] {
  try {
    const v = JSON.parse(storage?.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers that `id` was closed. Returns the new list; a blocked storage only loses the memory. */
export function dismiss(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined, id: string): string[] {
  const next = [...readDismissed(storage).filter((x) => x !== id), id].slice(-MAX_REMEMBERED);
  try {
    storage?.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {
    // private windows and blocked storage: the banner closes for this page view only
  }
  return next;
}

/** The warnings to show: every one not closed here. */
export function visibleWarnings(warnings: StatusWarning[], dismissed: string[]): StatusWarning[] {
  const closed = new Set(dismissed);
  return warnings.filter((w) => !closed.has(w.id));
}

/** Reads /status.json. An empty list on any failure: the banner never shows an error. */
export async function loadStatus(fetcher: typeof fetch = fetch): Promise<StatusWarning[]> {
  try {
    const r = await fetcher(STATUS_URL, { cache: "no-cache", credentials: "omit" });
    return r.ok ? parseStatus(await r.json()) : [];
  } catch {
    return [];
  }
}
