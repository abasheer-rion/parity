// The tracker (DEC-0053). Loaded by boot.ts only after the person switched analytics on.
//
// What it records, per page of every app:
//   pageview  when a page opens, including hash route changes inside an app
//   leave     when the page is left or the tab hidden: visible time (only while the tab is
//             in front, from the Page Visibility API) and the deepest scroll in %
//   click     clicks on links, buttons, tabs, switches and other controls: the control's
//             role and short label (data-track, aria-label or its text). Never what was
//             typed into a field.
//   rage      three or more quick clicks on the same spot
//   error     uncaught errors, the message only, with addresses and numbers masked
//   custom    named actions from track()
// With: a random visitor id and session id kept in this browser (removed when analytics is
// switched off), the app, a coarse screen class, and on a visit's first page the referring
// site's host name. No cookies, no fingerprinting, no third parties. Events are sent in
// small batches to /e with sendBeacon.
import site from "../site.json";
import type { AnalyticsGlobal } from "./index";
import { deviceOf, referrerHost, routeOf } from "./route";
import { cleanEvent, scrub, type App, type Batch, type Ev, type Kind, type PropValue } from "./schema";

const SESSION_GAP = 30 * 60_000;
// At most one batch every 30 s while someone is active (REF-0025): each batch is one function
// call and one database call, and both have limits. Leaving or hiding the page still sends
// at once, and 20 events send early, so nothing is held back that would be lost.
export const FLUSH_EVERY = 30_000;
const FLUSH_AT = 20;
const MAX_ERRORS = 5;
const RAGE_CLICKS = 3;
const RAGE_MS = 800;
const RAGE_PX = 24;
const SITE_DOMAIN = new URL(site.origin).hostname.split(".").slice(-2).join(".");

const CONTROL = [
  "a[href]", "button", "summary", "select", "label", "[data-track]",
  "input[type=checkbox]", "input[type=radio]", "input[type=submit]", "input[type=button]", "input[type=range]",
  "[role=button]", "[role=link]", "[role=tab]", "[role=menuitem]", "[role=menuitemcheckbox]", "[role=menuitemradio]",
  "[role=switch]", "[role=checkbox]", "[role=radio]", "[role=option]", "[role=treeitem]",
].join(",");

function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

let memoryIds: { vid: string; sid: string; t: number } | null = null;

/** The visitor id (kept until analytics is switched off) and the session id (new after 30 idle minutes). */
export function ids(now: number = Date.now()): { vid: string; sid: string; fresh: boolean } {
  const s = store();
  let vid: string | null = null;
  let sess: { id: string; t: number } | null = null;
  try {
    vid = s?.getItem("parity.a.vid") ?? null;
    const raw = s?.getItem("parity.a.sid");
    sess = raw ? (JSON.parse(raw) as { id: string; t: number }) : null;
  } catch { /* damaged or blocked */ }
  if (!s && memoryIds) { vid = memoryIds.vid; sess = { id: memoryIds.sid, t: memoryIds.t }; }
  if (!vid || !/^[0-9a-f-]{36}$/.test(vid)) vid = uuid();
  const fresh = !sess || typeof sess.id !== "string" || !/^[0-9a-f-]{36}$/.test(sess.id) || now - sess.t > SESSION_GAP;
  const sid = fresh ? uuid() : sess!.id;
  try {
    s?.setItem("parity.a.vid", vid);
    s?.setItem("parity.a.sid", JSON.stringify({ id: sid, t: now }));
  } catch { /* storage full or blocked: ids last for this page */ }
  memoryIds = { vid, sid, t: now };
  return { vid, sid, fresh };
}

/** The role and short label of a clicked control, as "button:Save". Never a field's value. */
export function labelOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role") || (tag === "a" ? "link" : tag === "input" ? (el as HTMLInputElement).type : tag);
  const explicit = el.getAttribute("data-track") || el.getAttribute("aria-label") || el.getAttribute("title");
  let text = explicit ?? "";
  if (!text && tag === "input") text = (el as HTMLInputElement).labels?.[0]?.textContent ?? "";
  if (!text && tag === "select") text = (el as HTMLSelectElement).labels?.[0]?.textContent ?? (el.getAttribute("name") ?? "");
  if (!text && tag !== "input" && tag !== "select") text = (el as HTMLElement).innerText ?? el.textContent ?? "";
  if (!text) {
    const img = el.querySelector("img[alt], svg[aria-label]");
    text = img?.getAttribute("alt") ?? img?.getAttribute("aria-label") ?? "";
  }
  const label = scrub(text, 40);
  return scrub(`${role}:${label || "(unlabelled)"}`);
}

interface Options { desktop?: boolean; send?: (url: string, body: string) => void; now?: () => number }

/** Starts recording for one app. Returns a function that stops it and drops anything unsent. */
export function startTracker(app: App, opts: Options = {}): () => void {
  const g = window.__parityAnalytics as AnalyticsGlobal | undefined;
  const now = opts.now ?? (() => Date.now());
  const dev = Boolean(import.meta.env?.DEV) && !/[?&]analytics=1/.test(window.location.search);
  const send = opts.send ?? ((url: string, body: string) => {
    if (dev) { console.debug("[analytics]", JSON.parse(body)); return; }
    try {
      if (!navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) {
        void fetch(url, { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => {});
      }
    } catch { /* measuring must never break the page */ }
  });
  const http = window.location.protocol === "http:" || window.location.protocol === "https:";
  const url = http ? "/e" : `${site.origin}/e`; // the desktop app's offline copy is app://

  let queue: (Ev & { at: number })[] = [];
  let route = routeOf(app, window.location.pathname, window.location.hash);
  let visibleSince: number | null = document.visibilityState === "visible" ? now() : null;
  let visibleMs = 0;
  let scrollMax = 0;
  let errors = 0;
  const seenErrors = new Set<string>();
  let clicks: { t: number; x: number; y: number }[] = [];
  let raged = 0;
  let ref = referrerHost(document.referrer, SITE_DOMAIN);
  let stopped = false;

  const push = (k: Kind, extra: Partial<Ev> = {}) => {
    if (stopped) return;
    const e = cleanEvent({ k, r: route, ...extra });
    if (!e) return;
    queue.push({ ...e, at: now() });
    if (queue.length >= FLUSH_AT) flush();
  };

  const flush = () => {
    if (!queue.length) return;
    const t = now();
    const { vid, sid } = ids(t);
    const batch: Batch = {
      app: opts.desktop ? "desktop" : app,
      ...(opts.desktop ? { surface: app } : {}),
      sid, vid,
      device: deviceOf(window.innerWidth),
      ...(ref ? { ref } : {}),
      ev: queue.slice(0, 50).map(({ at, ...e }) => ({ ...e, o: Math.max(0, t - at) })),
    };
    queue = queue.slice(50);
    ref = ""; // only the visit's first batch says where it came from
    send(url, JSON.stringify(batch));
  };

  const visible = () => visibleMs + (visibleSince != null ? now() - visibleSince : 0);

  /** Ends the current page: its visible time and deepest scroll, then resets both. */
  const leave = () => {
    const ms = visible();
    if (ms > 0 || scrollMax > 0) push("leave", { ms, v: Math.round(scrollMax) });
    visibleMs = 0;
    visibleSince = document.visibilityState === "visible" ? now() : null;
    scrollMax = 0;
  };

  const onRoute = () => {
    const next = routeOf(app, window.location.pathname, window.location.hash);
    if (next === route) return;
    leave();
    route = next;
    errors = 0;
    seenErrors.clear();
    push("pageview");
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      leave();
      visibleSince = null;
      flush();
    } else if (visibleSince == null) {
      visibleSince = now();
    }
  };

  const onPageHide = () => { leave(); flush(); };

  const onClick = (ev: MouseEvent) => {
    const target = ev.target as Element | null;
    const el = target?.closest?.(CONTROL);
    if (!el || el.closest("[data-track-ignore]")) return;
    if (el.matches("input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=range]), textarea, [contenteditable]")) return;
    const name = labelOf(el);
    push("click", { n: name });
    const t = now();
    clicks = clicks.filter((c) => t - c.t < RAGE_MS && Math.hypot(c.x - ev.clientX, c.y - ev.clientY) < RAGE_PX);
    clicks.push({ t, x: ev.clientX, y: ev.clientY });
    if (clicks.length >= RAGE_CLICKS && t - raged > RAGE_MS) {
      raged = t;
      push("rage", { n: name });
    }
  };

  let scrollFrame = 0;
  const onScroll = (ev: Event) => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const t = ev.target;
      const el = t instanceof Element ? t : document.scrollingElement ?? document.documentElement;
      // The page itself, or an app's main scrolling panel (at least half the window high).
      if (el !== document.scrollingElement && el.clientHeight < window.innerHeight / 2) return;
      if (el.scrollHeight <= el.clientHeight + 4) return;
      const depth = ((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100;
      scrollMax = Math.max(scrollMax, Math.min(100, depth));
    });
  };

  const onError = (message: string) => {
    if (errors >= MAX_ERRORS) return;
    const m = scrub(message || "Error");
    if (seenErrors.has(m)) return;
    seenErrors.add(m);
    errors += 1;
    push("error", { n: m });
  };
  const onWindowError = (e: ErrorEvent) => onError(e.message || (e.error instanceof Error ? e.error.message : ""));
  const onRejection = (e: PromiseRejectionEvent) => onError(e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : typeof e.reason === "string" ? e.reason : "Unhandled rejection");

  // Hash routes fire hashchange; apps that use history.pushState are caught too.
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<History["pushState"]>) { origPush.apply(this, args); queueMicrotask(onRoute); };
  history.replaceState = function (...args: Parameters<History["replaceState"]>) { origReplace.apply(this, args); queueMicrotask(onRoute); };

  addEventListener("hashchange", onRoute);
  addEventListener("popstate", onRoute);
  document.addEventListener("visibilitychange", onVisibility);
  addEventListener("pagehide", onPageHide);
  document.addEventListener("click", onClick, { capture: true, passive: true });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  addEventListener("error", onWindowError);
  addEventListener("unhandledrejection", onRejection);
  const timer = window.setInterval(flush, FLUSH_EVERY);

  push("pageview");
  if (g) {
    g.track = (name: string, props?: Record<string, PropValue>) => push("custom", { n: name, p: props });
    for (const [name, props] of g.q.splice(0)) g.track(name, props);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    queue = [];
    window.clearInterval(timer);
    removeEventListener("hashchange", onRoute);
    removeEventListener("popstate", onRoute);
    document.removeEventListener("visibilitychange", onVisibility);
    removeEventListener("pagehide", onPageHide);
    document.removeEventListener("click", onClick, { capture: true });
    document.removeEventListener("scroll", onScroll, { capture: true });
    removeEventListener("error", onWindowError);
    removeEventListener("unhandledrejection", onRejection);
    if (history.pushState !== origPush) history.pushState = origPush;
    if (history.replaceState !== origReplace) history.replaceState = origReplace;
    if (g) delete g.track;
    memoryIds = null;
  };
}
