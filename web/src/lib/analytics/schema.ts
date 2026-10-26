// The shape of an analytics batch (DEC-0053), shared by the browser tracker (tracker.ts) and
// the site's /e function (functions/e.ts), so both check the same rules. The database
// function analytics_ingest() checks them a third time. No browser globals.

export const APPS = ["site", "auth", "legal", "connect", "badge", "product", "research", "sim", "trade", "academy", "lab", "desktop"] as const;
export type App = (typeof APPS)[number];
export const KINDS = ["pageview", "leave", "click", "rage", "error", "custom"] as const;
export type Kind = (typeof KINDS)[number];
export type Device = "" | "phone" | "tablet" | "desktop";
export type PropValue = string | number | boolean;

/** One event. Short keys keep beacons small. */
export interface Ev {
  /** kind */
  k: Kind;
  /** route pattern, from routeOf() */
  r: string;
  /** clicked element's label, error message or custom event name */
  n?: string;
  /** how many ms before the send it happened */
  o?: number;
  /** visible ms (on "leave") */
  ms?: number;
  /** a number: scroll depth in % on "leave" */
  v?: number;
  /** a few properties of a custom event */
  p?: Record<string, PropValue>;
}

export interface Batch {
  app: App;
  /** For app "desktop": which app the window shows. */
  surface?: string;
  sid: string;
  vid: string;
  device?: Device;
  /** The referring site's host name, only on a visit's first page. */
  ref?: string;
  ev: Ev[];
}

export const MAX_EVENTS = 50;
export const MAX_BODY = 16_000;
export const MAX_PROPS = 8;
export const NAME_MAX = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ROUTE = /^\/[a-z0-9:/._#-]{0,119}$/;
export const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const PROP_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const HOST = /^[a-z0-9.-]{1,80}$/;

/**
 * A label or message made safe to keep: one line, at most 60 characters, anything shaped
 * like an email address or a web address masked, and runs of four or more digits (card,
 * phone and account numbers, amounts) replaced by "#".
 */
export function scrub(text: string, max = NAME_MAX): string {
  return text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "(url)")
    .replace(/[^\s@]+@[^\s@]+/g, "(email)")
    .replace(/\d{4,}/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanProps(raw: unknown): Record<string, PropValue> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, PropValue> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_PROPS || !PROP_KEY.test(k)) continue;
    if (typeof v === "string") out[k] = scrub(v, 60);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === "boolean") out[k] = v;
    else continue;
    n += 1;
  }
  return n ? out : undefined;
}

const num = (v: unknown, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : undefined;

/** One event, checked and trimmed, or null when it breaks a rule. */
export function cleanEvent(raw: unknown): Ev | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.k !== "string" || !(KINDS as readonly string[]).includes(e.k)) return null;
  if (typeof e.r !== "string" || !ROUTE.test(e.r)) return null;
  const k = e.k as Kind;
  let n = typeof e.n === "string" ? scrub(e.n) : "";
  if (k === "custom" && !EVENT_NAME.test(n)) return null;
  if ((k === "click" || k === "rage") && !n) n = "(unlabelled)";
  const out: Ev = { k, r: e.r };
  if (n) out.n = n;
  const o = num(e.o, 86_400_000);
  if (o !== undefined) out.o = o;
  const ms = num(e.ms, 86_400_000);
  if (ms !== undefined) out.ms = ms;
  const v = num(e.v, 1_000_000_000);
  if (v !== undefined) out.v = v;
  const p = k === "custom" ? cleanProps(e.p) : undefined;
  if (p) out.p = p;
  return out;
}

/** A batch, checked and trimmed, or null when it is not one. Events that break a rule are dropped. */
export function cleanBatch(raw: unknown): Batch | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.app !== "string" || !(APPS as readonly string[]).includes(b.app)) return null;
  if (typeof b.sid !== "string" || !UUID.test(b.sid) || typeof b.vid !== "string" || !UUID.test(b.vid)) return null;
  if (!Array.isArray(b.ev)) return null;
  const ev = b.ev.slice(0, MAX_EVENTS).map(cleanEvent).filter((e): e is Ev => e !== null);
  if (!ev.length) return null;
  const out: Batch = { app: b.app as App, sid: b.sid, vid: b.vid, ev };
  if (typeof b.surface === "string" && /^[a-z]{1,12}$/.test(b.surface)) out.surface = b.surface;
  if (b.device === "phone" || b.device === "tablet" || b.device === "desktop") out.device = b.device;
  if (typeof b.ref === "string" && HOST.test(b.ref.toLowerCase())) out.ref = b.ref.toLowerCase();
  return out;
}

/** Traffic that is not a person: crawlers, link previews, monitors and headless browsers. */
export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|discord|telegram|monitor|uptime|pingdom|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|curl|wget|python-requests|httpclient|go-http|node-fetch|axios/i;
