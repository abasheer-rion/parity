// Calls to a venue, with the same rules for every connector (DEC-0091): a time limit per call
// and for the whole read, a cap on the number of calls, waiting when the venue says "slow
// down" (429, 418 or Retry-After) only while there is time left, and errors in plain words.
// An error never carries the address (it can hold a signature or a token) or the venue's raw
// reply (it can echo a key back).
import { ConnectError, MAX_REQUESTS, type VenueCtx } from "./types";

export interface CallOptions {
  /** The venue's name, for messages. */
  venue: string;
  /** How many times to wait and try again after a "slow down" answer. */
  retries?: number;
  /** Per-call limit in milliseconds. */
  timeoutMs?: number;
}

const PER_CALL_MS = 15_000;

/** One call. Returns the response for any status the connector must read itself (2xx and 4xx). */
export async function call(ctx: VenueCtx, url: string, init: RequestInit, opt: CallOptions): Promise<Response> {
  const retries = opt.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    if (ctx.requests.n >= MAX_REQUESTS) {
      throw new ConnectError(413, `This read needs more than ${MAX_REQUESTS} requests to ${opt.venue}. Pick a shorter date range.`, "too_big");
    }
    const left = ctx.deadline - ctx.now();
    if (left <= 500) throw new ConnectError(504, `${opt.venue} took too long to send the trades. Pick a shorter date range and try again.`, "too_big");
    ctx.requests.n++;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(opt.timeoutMs ?? PER_CALL_MS, left));
    let res: Response;
    try {
      res = await ctx.fetch(url, { ...init, signal: ctl.signal, redirect: "manual" });
    } catch {
      throw new ConnectError(502, `We could not reach ${opt.venue}. Try again in a few minutes.`, "venue_down");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429 || res.status === 418 || res.status === 503) {
      const wait = retryAfterMs(res.headers.get("Retry-After"), 2_000 * (attempt + 1));
      if (attempt < retries && ctx.now() + wait < ctx.deadline - 2_000) { await ctx.sleep(wait); continue; }
      throw new ConnectError(429, `${opt.venue} is limiting how often it can be asked. Try again in a few minutes.`, "venue_limit");
    }
    if (res.status >= 500) throw new ConnectError(502, `${opt.venue} had a problem answering (error ${res.status}). Try again in a few minutes.`, "venue_down");
    if (res.status >= 300 && res.status < 400) throw new ConnectError(502, `${opt.venue} sent us somewhere else instead of answering. Try again later.`, "venue_down");
    return res;
  }
}

export function retryAfterMs(h: string | null, fallback: number): number {
  if (!h) return fallback;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : fallback;
}

/** The body as JSON, or a plain error naming the venue. */
export async function jsonOf<T>(res: Response, venue: string): Promise<T> {
  const t = await res.text();
  try { return JSON.parse(t) as T; } catch { throw new ConnectError(502, `${venue} sent an answer we could not read. Try again later.`, "venue_down"); }
}

/** Stops with a plain message when a read would go past the fill ceiling. */
export function guardSize(n: number, venue: string, max: number) {
  if (n > max) throw new ConnectError(413, `${venue} has more than ${max.toLocaleString("en-US")} fills in this range. Pick a shorter date range.`, "too_big");
}
