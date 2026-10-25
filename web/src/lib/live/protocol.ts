// The live data wire format (DEC-0049), shared by the fan-out worker (web/live/) and the
// browser. One small JSON shape for every source, so neither side sees a venue's format.
//
// Times are milliseconds since 1970 (UTC):
//   te  the exchange's own time for the last trade in the update
//   tr  when our edge (the Durable Object) received that trade
//   ts  when our edge sent the update
// The browser adds its own receive and paint times, corrected by the clock offset it
// measures with ping/pong, so every hop can be shown and logged.

/** How fresh a feed is by licence and design. */
export type FeedType = "rt" | "d15" | "eod";

export const FEED_LABEL: Record<FeedType, string> = { rt: "Real-time", d15: "Delayed 15 min", eod: "End of day" };

/** One conflated trade update for one symbol: everything that traded in the window. */
export interface Tick {
  /** Symbol in our own form, e.g. "BTC-USD". */
  s: string;
  /** First and last trade price in the window. */
  o: number;
  p: number;
  /** Highest and lowest trade price in the window. */
  h: number;
  l: number;
  /** Volume traded in the window (base units), 0 when the source has none. */
  v: number;
  /** Trades folded into this update. */
  n: number;
  te: number;
  tr: number;
  ts: number;
  /** Per-symbol sequence from our edge; a jump means updates were lost. */
  q: number;
}

/** Messages from the browser to the edge. */
export type ClientMsg =
  | { op: "sub"; s: string[] }
  | { op: "unsub"; s: string[] }
  /** Clock check: the edge answers with its own time. */
  | { op: "ping"; c: number };

/** Messages from the edge to the browser. */
export type ServerMsg =
  | { op: "hello"; src: string; feed: FeedType; ts: number; max: number }
  | { op: "t"; d: Tick[] }
  | { op: "pong"; c: number; ts: number }
  /** Upstream state for this source: up, connecting, down (with a reason). */
  | { op: "state"; up: "up" | "connecting" | "down"; why?: string; ts: number }
  | { op: "err"; why: string };

/** Symbols a client may hold at once on one connection. */
export const MAX_SUBS = 24;
/** At most this many updates a second per symbol reach a screen (OANDA sends 4, REF-0019). */
export const MAX_PER_SECOND = 4;
export const WINDOW_MS = 1000 / MAX_PER_SECOND;

const SYMBOL = /^[A-Z0-9][A-Z0-9._:-]{0,23}$/;
export const validSymbol = (s: unknown): s is string => typeof s === "string" && SYMBOL.test(s);

/** A client message, checked, or null. Anything unexpected is dropped. */
export function parseClient(text: string): ClientMsg | null {
  if (typeof text !== "string" || text.length > 2000) return null;
  let m: unknown;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== "object") return null;
  const { op, s, c } = m as { op?: unknown; s?: unknown; c?: unknown };
  if (op === "ping") return typeof c === "number" && Number.isFinite(c) ? { op, c } : null;
  if ((op === "sub" || op === "unsub") && Array.isArray(s)) {
    const list = [...new Set(s.filter(validSymbol))].slice(0, MAX_SUBS);
    return list.length ? { op, s: list } : null;
  }
  return null;
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** A server message, checked, or null. */
export function parseServer(text: string): ServerMsg | null {
  let m: unknown;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  switch (o.op) {
    case "t":
      if (!Array.isArray(o.d)) return null;
      return { op: "t", d: (o.d as Tick[]).filter((t) => t && validSymbol(t.s) && num(t.p) && num(t.o) && num(t.h) && num(t.l) && num(t.te) && num(t.tr) && num(t.ts) && num(t.q)) };
    case "pong": return num(o.c) && num(o.ts) ? { op: "pong", c: o.c, ts: o.ts } : null;
    case "hello": return typeof o.src === "string" && (o.feed === "rt" || o.feed === "d15" || o.feed === "eod") && num(o.ts) ? { op: "hello", src: o.src, feed: o.feed, ts: o.ts, max: num(o.max) ? o.max : MAX_SUBS } : null;
    case "state": return o.up === "up" || o.up === "connecting" || o.up === "down" ? { op: "state", up: o.up, why: typeof o.why === "string" ? o.why : undefined, ts: num(o.ts) ? o.ts : 0 } : null;
    case "err": return { op: "err", why: String(o.why ?? "") };
    default: return null;
  }
}
