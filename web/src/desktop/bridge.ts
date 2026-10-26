// The desktop app's bridge (DEC-0041). desktop/electron/preload.js puts `parityDesktop` on
// window before any page script runs; in a browser it is missing and every helper here
// does nothing. No browser globals at import time beyond a guarded `window` check.

export interface ParityDesktop {
  platform: string;
  version: string;
  /** The current Supabase access token, or null when signed out. Kept in the main process only. */
  setToken: (token: string | null) => void;
  /** A desktop notification; clicking it opens `href` (an in-app path) in the app. */
  notify: (title: string, body: string, href?: string) => void;
  /** Opens an address in the default browser. */
  openExternal: (url: string) => void;
  /**
   * Since app 0.2.0: the active watchlist's prices for the menu bar ticker (DEC-0049).
   * Older apps do not have it, so callers check it exists.
   */
  setTicker?: (items: DesktopTickerItem[]) => void;
}

/** One instrument in the menu bar ticker: the short symbol, the last price and the day's change, as shown in Trade. */
export interface DesktopTickerItem { symbol: string; last: string; change: string; up: boolean | null }

export const desktop: ParityDesktop | null =
  typeof window !== "undefined" ? ((window as unknown as { parityDesktop?: ParityDesktop }).parityDesktop ?? null) : null;

export const isDesktop = (): boolean => desktop !== null;

/** The custom scheme the desktop app answers to: parity://<path>. */
export const DESKTOP_SCHEME = "parity";

/** A desktop notification, when running in the desktop app. */
export function desktopNotify(title: string, body: string, href?: string) {
  try { desktop?.notify(title, body, href); } catch { /* the toast already showed it */ }
}

/** Sends the watchlist prices to the desktop app's menu bar ticker, when the app has one. */
export function desktopTicker(items: DesktopTickerItem[]) {
  try { desktop?.setTicker?.(items.slice(0, 12)); } catch { /* the ticker is a convenience only */ }
}
