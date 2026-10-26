// Parity's own product analytics (DEC-0053): the one call pages use.
//
//   import { track } from "../lib/analytics";
//   track("verify_run", { rows: 120, source: "csv" });
//
// It does nothing unless the person switched analytics on in the cookie preferences (and
// the browser does not send Do Not Track or Global Privacy Control). Page views, time on
// page, clicks, scroll depth, rage clicks and errors are recorded by themselves on every
// page (boot.ts, added to every HTML file by plugins/analytics.ts); call track() only for
// named actions. Names are lowercase with underscores; properties are at most 8 short
// strings, numbers or true/false, never anything that identifies a person.
import type { PropValue } from "./schema";

export interface AnalyticsGlobal {
  /** boot.ts ran on this page (the smoke test checks this on every route). */
  booted: boolean;
  /** Analytics is switched on and the tracker is loading or running. */
  on: boolean;
  app: string | null;
  /** Calls made while the tracker was still loading. */
  q: [string, Record<string, PropValue> | undefined][];
  track?: (name: string, props?: Record<string, PropValue>) => void;
}

declare global {
  interface Window { __parityAnalytics?: AnalyticsGlobal }
}

/** Records a named action, if analytics is on. Never throws. */
export function track(name: string, props?: Record<string, PropValue>): void {
  try {
    const g = typeof window !== "undefined" ? window.__parityAnalytics : undefined;
    if (!g?.on) return;
    if (g.track) g.track(name, props);
    else if (g.q.length < 50) g.q.push([name, props]);
  } catch { /* measuring must never break the page */ }
}

export type { PropValue } from "./schema";
