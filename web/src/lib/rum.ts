// Page timing from real browsers (DEC-0045). On one page load in ten it notes how long the
// page took to get its first data, how long each data request took and how big it was,
// whether it came from the browser's cache, how old the data shown is, how late timed
// refreshes run, and the browser's own paint and layout measures (LCP, INP, CLS). When the
// tab is hidden or closed it sends one small beacon to /rum, which adds the numbers to
// hourly totals.
//
// Privacy: no cookies, no storage, no ids, no page addresses beyond the data file's path
// pattern, no user agent. Do Not Track and Global Privacy Control turn it off. It needs no
// consent because it stores nothing in the browser and identifies no one; the privacy and
// cookie pages say so. No browser globals at import time.
import site from "./site.json";

export type RumApp = "site" | "product" | "research" | "sim" | "trade" | "academy" | "lab" | "auth" | "verify";
type Metric = "ttd" | "ttfb" | "fetch" | "bytes" | "age" | "lag" | "gap" | "lcp" | "inp" | "cls";
export interface RumEvent { m: Metric; e?: string; v: number; h?: 1 }

export const SAMPLE = 0.1;
const MAX_EVENTS = 40;
const PER_ENDPOINT = 3; // fetch events kept per endpoint per beacon

let app: string | null = null;
let queue: RumEvent[] = [];
let firstData = false;
let lcp = 0;
let inp = 0;
let cls = 0;
let clsWindow = 0;
let clsFirst = 0;
let clsLast = 0;
const perEndpoint = new Map<string, number>();

/** Whether this browser asked not to be measured. */
export function optedOut(nav: Partial<Navigator> & { globalPrivacyControl?: boolean } = navigator, win: { doNotTrack?: string } = window as never): boolean {
  return nav.doNotTrack === "1" || win.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

const DB_PATH = /^\/rest\/v1\/(rpc\/)?([a-z0-9_]{1,60})/;

/**
 * A data request's path pattern, or null for anything that is not data. Ids and dates
 * become ":id", so the totals group by kind of file and no address is kept.
 */
export function endpointOf(url: string, here: string = typeof location !== "undefined" ? location.href : "https://x/"): string | null {
  let u: URL;
  try { u = new URL(url, here); } catch { return null; }
  if (u.hostname.endsWith(".supabase.co")) {
    const m = u.pathname.match(DB_PATH);
    if (m) return `db:${m[1] ? "rpc/" : ""}${m[2]}`;
    return u.pathname.startsWith("/auth/") ? "db:auth" : null;
  }
  if (u.origin !== new URL(here).origin) return null;
  const p = u.pathname.replace(/^\/local\//, "/data/");
  if (!p.startsWith("/data/") && p !== "/stats.json") return null;
  const parts = p.split("/");
  const out = parts.map((seg, i) => {
    if (i === 0 || seg === "index.json") return seg;
    const ext = seg.endsWith(".json") ? ".json" : "";
    const stem = ext ? seg.slice(0, -5) : seg;
    const isFile = i === parts.length - 1;
    const isId = /\d/.test(stem) || stem.length > 24 || (isFile && parts[i - 1] === "terminal");
    return isId ? `:id${ext}` : stem.toLowerCase() + ext;
  });
  return out.join("/").replace(/[^a-z0-9:/._-]/g, "").slice(0, 80);
}

function push(ev: RumEvent) {
  if (!app || !Number.isFinite(ev.v) || ev.v < 0) return;
  if (ev.m === "fetch") {
    const k = ev.e ?? "";
    const n = perEndpoint.get(k) ?? 0;
    if (n >= PER_ENDPOINT) return;
    perEndpoint.set(k, n + 1);
  }
  if (queue.length < MAX_EVENTS * 2) queue.push({ ...ev, v: Math.round(ev.v * 10) / 10 });
}

/** The payload for one beacon: the most useful events first, at most MAX_EVENTS. */
export function payload(name: string, events: RumEvent[]): string {
  const order: Metric[] = ["ttd", "lcp", "inp", "cls", "ttfb", "age", "lag", "gap", "fetch", "bytes"];
  const sorted = [...events].sort((a, b) => order.indexOf(a.m) - order.indexOf(b.m)).slice(0, MAX_EVENTS);
  return JSON.stringify({ a: name, ev: sorted });
}

export function endpointUrl(): string {
  const http = location.protocol === "http:" || location.protocol === "https:";
  return http ? "/rum" : `${site.origin.replace(/\/$/, "")}/rum`; // the desktop app's pages are app://
}

function flush(final: boolean) {
  if (!app) return;
  if (final) {
    if (lcp > 0) push({ m: "lcp", v: lcp });
    if (inp > 0) push({ m: "inp", v: inp });
    push({ m: "cls", v: Math.max(cls, clsWindow) * 1000 }); // thousandths, so it bins
    lcp = inp = 0;
  }
  if (!queue.length) return;
  const body = payload(app, queue);
  queue = [];
  perEndpoint.clear();
  try {
    navigator.sendBeacon?.(endpointUrl(), new Blob([body], { type: "text/plain" }));
  } catch { /* measuring must never break the page */ }
}

function observe(type: string, fn: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) {
  try {
    new PerformanceObserver((list) => list.getEntries().forEach(fn))
      .observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch { /* this browser does not have that entry type */ }
}

/** Notes one finished request, if it fetched data. Exported for tests. */
export function onResource(e: Pick<PerformanceResourceTiming, "name" | "responseEnd" | "duration" | "encodedBodySize" | "transferSize">) {
  const ep = endpointOf(e.name);
  if (!ep || ep === "db:auth") return;
  if (!firstData && e.responseEnd > 0) {
    firstData = true;
    push({ m: "ttd", v: e.responseEnd });
  }
  const size = e.encodedBodySize || e.transferSize;
  const hit = e.encodedBodySize > 0 && e.transferSize < e.encodedBodySize;
  push({ m: "fetch", e: ep, v: e.duration, ...(hit ? { h: 1 as const } : {}) });
  if (size > 0) push({ m: "bytes", e: ep, v: size });
}

/**
 * Starts measuring for one app, on about one page load in ten. Call once from the app's
 * entry. Everything runs from browser callbacks, after the page has painted.
 */
export function startRum(name: RumApp, opts: { sample?: number; desktop?: boolean } = {}) {
  if (app || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  if (import.meta.env?.DEV && !/[?&]rum=1/.test(location.search)) return;
  if (optedOut()) return;
  if (Math.random() >= (opts.sample ?? SAMPLE)) return;
  app = opts.desktop ? "desktop" : name;
  const idle = (window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200))) as (f: () => void) => void;
  idle(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0) push({ m: "ttfb", v: nav.responseStart });
    observe("resource", (e) => onResource(e as PerformanceResourceTiming));
    observe("largest-contentful-paint", (e) => { lcp = e.startTime; });
    observe("event", (e) => {
      if ((e as PerformanceEntry & { interactionId?: number }).interactionId) inp = Math.max(inp, e.duration);
    }, { durationThreshold: 40 });
    observe("layout-shift", (e) => {
      const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (s.hadRecentInput) return;
      // Session windows: shifts less than 1 s apart, within 5 s, add up; the worst counts.
      if (clsWindow && (s.startTime - clsLast > 1000 || s.startTime - clsFirst > 5000)) {
        cls = Math.max(cls, clsWindow);
        clsWindow = 0;
      }
      if (!clsWindow) clsFirst = s.startTime;
      clsWindow += s.value;
      clsLast = s.startTime;
    });
    // A first beacon once the page has settled, then one each time the tab is hidden.
    window.setTimeout(() => idle(() => flush(false)), 15_000);
  });
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
  addEventListener("pagehide", () => flush(true));
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9:/._-]/g, "").slice(0, 80);

/** How old the data on screen is: `asOf` is the data's own time (a date or ISO time). */
export function rumAge(dataset: string, asOf: string | number | null | undefined, now: number = Date.now()) {
  if (!app || asOf == null) return;
  const t = typeof asOf === "number" ? asOf : Date.parse(asOf);
  if (Number.isFinite(t)) push({ m: "age", e: clean(dataset), v: Math.max(0, (now - t) / 1000) });
}

/**
 * A timer that refreshes data every `everyMs`. Call the returned function at each run: it
 * records how late the run was ("lag") and, with `gaps`, the full time since the last run
 * ("gap"), which is how Trade's polling is watched.
 */
export function rumRefresh(name: string, everyMs: number, gaps = false): () => void {
  let last: number | null = null;
  const e = clean(name);
  return () => {
    const t = performance.now();
    if (last != null) {
      const gap = t - last;
      push({ m: "lag", e, v: Math.max(0, gap - everyMs) });
      if (gaps) push({ m: "gap", e, v: gap });
    }
    last = t;
  };
}

/** For tests: forget everything and, with a name, act as if sampled in. */
export function _reset(name: string | null = null) {
  app = name;
  queue = [];
  firstData = false;
  perEndpoint.clear();
  lcp = inp = cls = clsWindow = clsFirst = clsLast = 0;
}

/** For tests: what would be sent now. */
export function _queued(): RumEvent[] {
  return queue;
}
