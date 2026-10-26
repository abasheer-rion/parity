// POST /rum: page timing beacons from real browsers (DEC-0045, src/lib/rum.ts). Public, no
// sign-in. It checks the body, drops anything unexpected, limits each address to a few
// beacons a minute (held in this worker's memory for a minute, never stored), adds a coarse
// region (Cloudflare's continent code) and hands the events to the database function
// rum_ingest(), which adds them to hourly totals. It never stores the address, cookies,
// user agent or page. Always answers 204, so a beacon can never fail visibly.

const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_12CQmnbBgVYpkflKhwHD-A_2Xby8b-x";

const APPS = new Set(["site", "product", "research", "sim", "trade", "academy", "lab", "desktop", "auth", "verify"]);
const METRICS = new Set(["ttd", "ttfb", "fetch", "bytes", "age", "lag", "gap", "lcp", "inp", "cls"]);
const ENDPOINT = /^[a-z0-9:/._-]{0,80}$/;
const MAX_BODY = 6000;
const MAX_EVENTS = 40;
export const PER_MINUTE = 12;

interface Context {
  request: Request & { cf?: { continent?: string } };
  waitUntil: (p: Promise<unknown>) => void;
}

export interface Clean { app: string; region: string; events: { m: string; e: string; v: number; h?: 1 }[] }

/** The beacon, checked and trimmed, or null when it is not one. */
export function clean(text: string, continent?: string): Clean | null {
  if (!text || text.length > MAX_BODY) return null;
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return null; }
  if (!doc || typeof doc !== "object") return null;
  const { a, ev } = doc as { a?: unknown; ev?: unknown };
  if (typeof a !== "string" || !APPS.has(a) || !Array.isArray(ev)) return null;
  const events: Clean["events"] = [];
  for (const raw of ev.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== "object") continue;
    const { m, e = "", v, h } = raw as { m?: unknown; e?: unknown; v?: unknown; h?: unknown };
    if (typeof m !== "string" || !METRICS.has(m)) continue;
    if (typeof e !== "string" || !ENDPOINT.test(e)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9) continue;
    events.push({ m, e, v, ...(h === 1 ? { h: 1 as const } : {}) });
  }
  if (!events.length) return null;
  const region = typeof continent === "string" && /^(AF|AN|AS|EU|NA|OC|SA)$/.test(continent) ? continent : "XX";
  return { app: a, region, events };
}

// Per address, per minute, in this worker only. Workers are short lived and spread out, so
// this stops a single page or script from flooding, and the database caps the rest.
const seen = new Map<string, { n: number; t: number }>();
export function allow(key: string, now: number = Date.now()): boolean {
  const e = seen.get(key);
  if (!e || now - e.t > 60_000) {
    if (seen.size > 5000) seen.clear();
    seen.set(key, { n: 1, t: now });
    return true;
  }
  e.n += 1;
  return e.n <= PER_MINUTE;
}

/** The body as text, or "" once it passes MAX_BODY bytes, without reading the rest. */
async function readCapped(request: Request): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); return ""; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export const onRequest = async ({ request, waitUntil }: Context, fetcher: typeof fetch = fetch): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response("POST only.", { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
  }
  const len = Number(request.headers.get("Content-Length") ?? "0");
  if (len > MAX_BODY) return done();
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (!allow(ip)) return done();
  const beacon = clean(await readCapped(request), request.cf?.continent);
  if (!beacon) return done();
  waitUntil(fetcher(`${SUPABASE_URL}/rest/v1/rpc/rum_ingest`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_app: beacon.app, p_region: beacon.region, p_events: beacon.events }),
  }).then((r) => { if (!r.ok) console.error("rum ingest", r.status); }).catch((e) => console.error("rum ingest", String(e))));
  return done();
};
