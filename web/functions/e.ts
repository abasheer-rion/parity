// POST /e: product analytics batches from browsers that switched analytics on (DEC-0053,
// src/lib/analytics/). Public, no sign-in needed. It:
//   - drops the batch when the browser sends Do Not Track or Global Privacy Control, or looks
//     like a crawler, a link preview or a headless browser
//   - limits each network to a few batches a minute, keyed by the address cut short (the
//     first three parts of an IPv4 address, the first three groups of IPv6), held in this
//     worker's memory for a minute and never stored or sent on
//   - checks the batch against the shared rules (src/lib/analytics/schema.ts)
//   - adds the country Cloudflare reports, then hands it to the database function
//     analytics_ingest(). When the person is signed in, their own sign-in token goes with it,
//     so the database can make the keyed hash of their user id itself; the id never travels
//     in the batch and nobody can write as someone else.
// It never stores the address, the user agent or cookies. Always answers 204.
import { BOT_UA, cleanBatch, MAX_BODY } from "../src/lib/analytics/schema";
import { accessToken, bearerToken } from "./_middleware";

const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_12CQmnbBgVYpkflKhwHD-A_2Xby8b-x";
export const PER_MINUTE = 30;

type CfRequest = Request & { cf?: { country?: string; verifiedBotCategory?: string } };

interface Context {
  request: CfRequest;
  waitUntil: (p: Promise<unknown>) => void;
}

/** The address cut short, so the limit is per network and no full address is ever kept. */
export function truncateIp(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

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

/** True when the request should not be counted: a privacy signal, a bot, or not a browser. */
export function ignore(request: CfRequest): boolean {
  const h = request.headers;
  if (h.get("Sec-GPC") === "1" || h.get("DNT") === "1") return true;
  const ua = h.get("User-Agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return true;
  if (request.cf?.verifiedBotCategory) return true;
  return false;
}

/** The signed-in person's token when it has not expired, else null. The database checks the signature. */
export function liveToken(request: Request, now: number = Date.now()): string | null {
  const token = bearerToken(request.headers.get("Authorization")) ?? accessToken(request.headers.get("Cookie") ?? "");
  if (!token) return null;
  try {
    const part = token.split(".")[1] ?? "";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const claims = JSON.parse(json) as { exp?: number; role?: string };
    return claims.role === "authenticated" && typeof claims.exp === "number" && claims.exp * 1000 > now + 5_000 ? token : null;
  } catch {
    return null;
  }
}

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
  if (Number(request.headers.get("Content-Length") ?? "0") > MAX_BODY) return done();
  if (ignore(request)) return done();
  if (!allow(truncateIp(request.headers.get("CF-Connecting-IP") ?? ""))) return done();
  let raw: unknown;
  try { raw = JSON.parse(await readCapped(request)); } catch { return done(); }
  const batch = cleanBatch(raw);
  if (!batch) return done();
  const country = typeof request.cf?.country === "string" && /^[A-Z]{2}$/.test(request.cf.country) ? request.cf.country : "XX";
  const token = liveToken(request);
  const call = (bearer: string | null) => fetcher(`${SUPABASE_URL}/rest/v1/rpc/analytics_ingest`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ p_batch: batch, p_country: country }),
  });
  waitUntil((async () => {
    try {
      let r = await call(token);
      // A token the database refuses (signed out elsewhere, revoked): keep the events, without the hash.
      if (r.status === 401 && token) r = await call(null);
      if (!r.ok) console.error("analytics ingest", r.status);
    } catch (e) {
      console.error("analytics ingest", String(e));
    }
  })());
  return done();
};
