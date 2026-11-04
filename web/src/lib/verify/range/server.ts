// POST /api/verify/fills (DEC-0092): the fill price check, server side. The page sends the
// symbol, time and price of each fill, and nothing else. We load the bars for those times
// (load.ts), compare (engine.ts) and answer one status per fill. The bars stay here.
//
// Only Parity's own pages may call it, signed in, never with a connected AI app's token. Each
// person may check 50,000 fills and make 400 requests a day (the database counts, see
// supabase/migrations/20261118000000_fill_checks.sql), each address 30 requests a minute.
// That keeps the answers from being used to rebuild the bars one guess at a time.
import { sameSite, burst } from "../../connect/server";
import { classify } from "./engine";
import { load, type RangeCache } from "./load";
import { marketOfSent } from "./market";
import type { RangeEnv, SourceDef } from "./sources";
import { LIMITS, type Clock, type FillAnswer, type FillPoint, type RangeAnswer } from "./types";
import type { Planned, RangeOutcome } from "./client";

export interface FillsEnv extends RangeEnv {
  /** "off" switches the check off here; the page then says it was not run. */
  FILL_CHECK?: string;
}

export interface Caller { userId: string; clientId: string | null }

export interface FillQuota {
  /** Counts this request's fills against the person's day. Throws QuotaError with the database's words. */
  take(token: string, fills: number): Promise<void>;
}

export class QuotaError extends Error {
  constructor(message: string, public status = 429) { super(message); }
}

export interface FillsDeps {
  env: FillsEnv;
  verify(token: string): Promise<Caller | null>;
  quota: FillQuota;
  sources: SourceDef[];
  cache: RangeCache;
  fetch: typeof fetch;
  siteDomain: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** One JSON line per request: counts only, never a symbol, a time or a price. */
  log?: (line: Record<string, unknown>) => void;
}

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const MAX_BODY = 120_000;
const TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
const CLOCKS: Clock[] = ["utc", "new_york", "unknown"];

export class BadRequest extends Error {}

/** Which markets the enabled sources cover, and for crypto which coins (as "BTC"). */
export interface Coverage { markets: string[]; coins: string[] | null }

export function coverage(on: SourceDef[]): Coverage {
  const coins = on.flatMap((x) => ("coins" in x && Array.isArray((x as { coins?: unknown }).coins) ? (x as unknown as { coins: string[] }).coins : []));
  return { markets: [...new Set(on.map((x) => x.market))], coins: on.some((x) => x.market === "crypto") ? [...new Set(coins)].sort() : null };
}

/** Reads and checks the body: a clock and up to 1,000 fills of symbol, time and price. */
export function readBody(text: string): { clock: Clock; fills: FillPoint[] } {
  if (text.length > MAX_BODY) throw new BadRequest(`Send at most ${LIMITS.fills.toLocaleString("en-US")} fills at a time.`);
  let b: unknown;
  try { b = JSON.parse(text); } catch { throw new BadRequest("Send JSON."); }
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new BadRequest("Send JSON.");
  const { clock, fills } = b as { clock?: unknown; fills?: unknown };
  if (!CLOCKS.includes(clock as Clock)) throw new BadRequest("Say which clock the times are in: utc, new_york or unknown.");
  if (!Array.isArray(fills) || !fills.length) throw new BadRequest("Send at least one fill.");
  if (fills.length > LIMITS.fills) throw new BadRequest(`Send at most ${LIMITS.fills.toLocaleString("en-US")} fills at a time.`);
  const out: FillPoint[] = [];
  for (const f of fills) {
    if (!f || typeof f !== "object") throw new BadRequest("Each fill is a symbol, a time and a price.");
    const keys = Object.keys(f);
    // Only these three, so nothing else from a file can ride along.
    if (keys.some((k) => k !== "s" && k !== "t" && k !== "p")) throw new BadRequest("Each fill is a symbol, a time and a price, and nothing else.");
    const { s, t, p } = f as Record<string, unknown>;
    if (typeof s !== "string" || !/^[A-Z0-9./-]{1,20}$/.test(s)) throw new BadRequest("A symbol is 1 to 20 capital letters, digits, dots, dashes or slashes.");
    if (typeof t !== "string" || !TIME.test(t) || Number.isNaN(Date.parse(t.length === 10 ? t : `${t}Z`))) throw new BadRequest("A time is written YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.");
    if (typeof p !== "number" || !Number.isFinite(p) || p <= 0 || p > 1e9) throw new BadRequest("A price is a positive number.");
    out.push({ s, t, p });
  }
  if (new Set(out.map((f) => f.s)).size > LIMITS.symbols) throw new BadRequest(`Send at most ${LIMITS.symbols} different symbols at a time.`);
  return { clock: clock as Clock, fills: out };
}

export async function handleFills(request: Request, deps: FillsDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const line: Record<string, unknown> = { msg: "fills" };
  const done = (res: Response) => { deps.log?.({ ...line, status: res.status, ms: now() - started }); return res; };
  try {
    if (deps.env.FILL_CHECK === "off") return done(reply(404, { error: "The fill price check is switched off.", code: "off" }));
    // What can be checked, so the page sends only fills a source covers. Carries nothing in.
    if (request.method === "GET") {
      const on = deps.sources.filter((x) => x.enabled(deps.env));
      return done(new Response(JSON.stringify(coverage(on)), { headers: { ...HEADERS, "Cache-Control": "public, max-age=300" } }));
    }
    if (request.method !== "POST") return done(new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...HEADERS, Allow: "POST" } }));
    if (!sameSite(request.headers.get("Origin"), deps.siteDomain)) return done(reply(403, { error: "Not allowed from this site." }));
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    if (!burst(`fills:${ip}`, now())) return done(reply(429, { error: "Too many requests. Wait a minute.", code: "rate_limited" }));
    const token = request.headers.get("Authorization")?.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/)?.[1];
    const caller = token ? await deps.verify(token) : null;
    if (!caller || !token) return done(reply(401, { error: "Sign in to check fill prices.", code: "signed_out" }));
    if (caller.clientId) return done(reply(403, { error: "Connected apps cannot run the fill price check.", code: "refused" }));
    const { clock, fills } = readBody(await request.text());
    await deps.quota.take(token, fills.length);
    const answer = await checkFills(clock, fills, deps, now(), line);
    return done(reply(200, answer));
  } catch (e) {
    if (e instanceof BadRequest) return done(reply(400, { error: e.message, code: "bad_input" }));
    if (e instanceof QuotaError) return done(reply(e.status, { error: e.message, code: e.status === 401 ? "signed_out" : "rate_limited" }));
    line.error = e instanceof Error ? e.name : "error";
    return done(reply(503, { error: "The fill price check could not run just now. Try again in a minute.", code: "unavailable" }));
  }
}

/**
 * The check itself, for a request or for trades Parity read from a broker (DEC-0091), where
 * nothing comes from a page at all. `line` collects counts for the log.
 */
export async function checkFills(clock: Clock, fills: FillPoint[], deps: Pick<FillsDeps, "env" | "sources" | "cache" | "fetch" | "sleep">, now: number, line: Record<string, unknown> = {}, maxCalls?: number): Promise<RangeAnswer> {
  const { book, stats } = await load(clock, fills, { env: deps.env, sources: deps.sources, cache: deps.cache, fetch: deps.fetch, now, sleep: deps.sleep, maxCalls });
  const answer = classify(clock, fills, book);
  const count = (r: string) => answer.fills.filter((a) => a.r === r).length;
  Object.assign(line, {
    fills: fills.length, symbols: new Set(fills.map((f) => f.s)).size, markets: [...new Set(fills.map((f) => marketOfSent(f.s) ?? "other"))].join(","),
    clock, calls: stats.calls, cached: stats.cached, busy: stats.busy.join(","),
    in: count("in"), out: count("out"), closed: count("closed"), none: count("none"), more: answer.fills.filter((a) => a.n === "more").length,
  });
  return answer;
}

// ------------------------------------------------------------------- the stores Cloudflare gives us

interface CacheLike { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> }
interface KvLike { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }

/** Cloudflare's cache in the data centre that ran the request. Free, and nothing to set up. */
export function edgeCache(cache: CacheLike): RangeCache {
  const req = (k: string) => new Request(`https://fill-ranges.cache/${encodeURIComponent(k)}`);
  return {
    get: async (k) => { const r = await cache.match(req(k)); return r ? r.text() : null; },
    put: async (k, v, ttl) => { await cache.put(req(k), new Response(v, { headers: { "Cache-Control": `public, max-age=${ttl}`, "Content-Type": "application/json" } })); },
  };
}

/** A KV namespace, shared by every data centre, when the owner binds one as FILL_RANGES. */
export function kvCache(kv: KvLike): RangeCache {
  return {
    get: (k) => kv.get(k),
    put: (k, v, ttl) => kv.put(k, v, { expirationTtl: Math.max(60, ttl) }),
  };
}

/** KV first when bound, then the local cache: a hit in either is a hit. */
export function layered(a: RangeCache, b: RangeCache): RangeCache {
  return {
    get: async (k) => (await a.get(k).catch(() => null)) ?? b.get(k),
    put: async (k, v, ttl) => { await Promise.all([a.put(k, v, ttl).catch(() => undefined), b.put(k, v, ttl)]); },
  };
}

// ------------------------------------------------------------------- run on the server itself

/**
 * The check for trades the server already holds (read from a broker, DEC-0091): the same
 * steps as the page takes, without a request, in at most `rounds` passes of `maxCalls` calls.
 */
export function serverFills(deps: Pick<FillsDeps, "env" | "sources" | "cache" | "fetch" | "sleep">, now: () => number, rounds = 2, maxCalls = 60) {
  return async (plan: Planned): Promise<RangeOutcome> => {
    if (deps.env.FILL_CHECK === "off") return { ran: false, why: "off" };
    const answers: FillAnswer[] = plan.points.map(() => ({ r: "none", n: "more" }));
    const unsupported = new Set<string>();
    let offset: number | null = null;
    let todo = plan.points.map((_, i) => i);
    for (let round = 0; round < rounds && todo.length; round++) {
      const next: number[] = [];
      for (let k = 0; k < todo.length; k += LIMITS.fills) {
        const part = todo.slice(k, k + LIMITS.fills);
        const a = await checkFills(plan.clock, part.map((i) => ({ s: plan.points[i].s, t: plan.points[i].t, p: plan.points[i].p })), deps, now(), {}, maxCalls);
        a.fills.forEach((f, j) => { answers[part[j]] = f; if (f.n === "more") next.push(part[j]); });
        for (const s of a.unsupported) unsupported.add(s);
        if (a.offset != null) offset = a.offset;
      }
      todo = next;
    }
    return { ran: true, clock: plan.clock, offset, points: plan.points, answers, unsupported: [...unsupported], skipped: plan.skipped, uncovered: plan.uncovered };
  };
}
