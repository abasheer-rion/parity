// The live data wire format (DEC-0052), shared by the fan-out worker (web/live/) and the
// browser. One small JSON shape for every source, so neither side sees a venue's format.
//
// Times are milliseconds since 1970 (UTC):
//   te  the exchange's own time for the last trade in the update
//   tr  when our edge (the Durable Object) received that trade
//   ts  when our edge sent the update
// The browser adds its own receive and paint times, corrected by the clock offset it
// measures with ping/pong, so every hop can be shown and logged.

/** How fresh a feed is by licence and design. */
export type FeedType = "rt" | "delayed" | "eod";

/** The feed in words: "Real-time", "Delayed 15 min", "End of day". */
export function feedLabel(feed: FeedType, delayMin?: number): string {
  return feed === "rt" ? "Real-time" : feed === "eod" ? "End of day" : `Delayed ${delayMin ?? 15} min`;
}

/** The feed in two or three letters for the badge: RT, 1m, 15m, EOD. */
export function feedShort(feed: FeedType, delayMin?: number): string {
  return feed === "rt" ? "RT" : feed === "eod" ? "EOD" : `${delayMin ?? 15}m`;
}

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
  /** 1 when replayed to a viewer who just subscribed: drawn, but not timed. */
  r?: 1;
}

/** One price level: [price, size]. */
export type Level = [number, number];
/** One trade in the recent trades panel: [exchange time, price, size, side] (side 1 buy, 2 sell, 0 unknown). */
export type TradeRow = [number, number, number, 0 | 1 | 2];
/** One market overview row: [symbol, last price, change over 24 h in %, 24 h volume in the
 *  quote currency, exchange time]. A null keeps the value the browser already has. */
export type BoardRow = [string, number, number | null, number | null, number];

/**
 * Subscription keys. A bare symbol ("BTC-USD") is the conflated price for charts and quotes;
 * "B:BTC-USD" is the order book (top levels, four times a second at most); "X:BTC-USD" is
 * the recent trades list; "*" is the market overview: every symbol the source lists.
 */
export const bookKey = (s: string) => `B:${s}`;
export const tradesKey = (s: string) => `X:${s}`;
export const BOARD = "*";

/** Messages from the browser to the edge. */
export type ClientMsg =
  | { op: "sub"; s: string[] }
  | { op: "unsub"; s: string[] }
  /** Clock check: the edge answers with its own time. */
  | { op: "ping"; c: number };

/** Messages from the edge to the browser. */
export type ServerMsg =
  /** internal: a team-only feed (internal use, not shown to the public). */
  | { op: "hello"; src: string; feed: FeedType; delay?: number; ts: number; max: number; internal?: boolean }
  | { op: "t"; d: Tick[] }
  | { op: "pong"; c: number; ts: number }
  /** Upstream state for this source: up, connecting, down (with a reason). */
  | { op: "state"; up: "up" | "connecting" | "down"; why?: string; ts: number }
  | { op: "err"; why: string }
  /** Order book: the top levels each side, best first. */
  | { op: "b"; s: string; b: Level[]; a: Level[]; te: number; tr: number; ts: number }
  /** Recent trades since the last message, oldest first. */
  | { op: "x"; s: string; d: TradeRow[]; ts: number }
  /** Market overview rows; full=1 replaces the list, and sp holds each symbol's recent prices. */
  | { op: "r"; d: BoardRow[]; ts: number; full?: 1; sp?: Record<string, number[]>; every?: number };

/** Symbols a client may hold at once on one connection. */
export const MAX_SUBS = 24;
/** At most this many updates a second per symbol reach a screen (OANDA sends 4, REF-0019). */
export const MAX_PER_SECOND = 4;
export const WINDOW_MS = 1000 / MAX_PER_SECOND;

const SYMBOL = /^(?:[BX]:)?[A-Z0-9][A-Z0-9._-]{0,23}$/;
export const validSymbol = (s: unknown): s is string => typeof s === "string" && (s === BOARD || SYMBOL.test(s));
/** The symbol inside a subscription key ("B:BTC-USD" gives "BTC-USD"). */
export const baseOf = (key: string) => (key.length > 2 && key[1] === ":" ? key.slice(2) : key);

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
    case "hello": return typeof o.src === "string" && (o.feed === "rt" || o.feed === "delayed" || o.feed === "eod") && num(o.ts) ? { op: "hello", src: o.src, feed: o.feed, delay: num(o.delay) ? o.delay : undefined, ts: o.ts, max: num(o.max) ? o.max : MAX_SUBS, internal: o.internal === true || undefined } : null;
    case "b": {
      const lv = (x: unknown): Level[] => (Array.isArray(x) ? (x as Level[]).filter((l) => Array.isArray(l) && num(l[0]) && num(l[1])) : []);
      return validSymbol(o.s) && num(o.te) && num(o.ts) ? { op: "b", s: o.s, b: lv(o.b), a: lv(o.a), te: o.te, tr: num(o.tr) ? o.tr : o.ts, ts: o.ts } : null;
    }
    case "x":
      return validSymbol(o.s) && Array.isArray(o.d) && num(o.ts) ? { op: "x", s: o.s, ts: o.ts, d: (o.d as TradeRow[]).filter((r) => Array.isArray(r) && num(r[0]) && num(r[1]) && num(r[2])) } : null;
    case "r": {
      if (!Array.isArray(o.d) || !num(o.ts)) return null;
      const d = (o.d as BoardRow[]).filter((r) => Array.isArray(r) && typeof r[0] === "string" && num(r[1]) && num(r[4]));
      const sp = o.sp && typeof o.sp === "object" ? (o.sp as Record<string, number[]>) : undefined;
      return { op: "r", d, ts: o.ts, ...(o.full === 1 ? { full: 1 as const } : {}), ...(sp ? { sp } : {}), ...(num(o.every) ? { every: o.every } : {}) };
    }
    case "state": return o.up === "up" || o.up === "connecting" || o.up === "down" ? { op: "state", up: o.up, why: typeof o.why === "string" ? o.why : undefined, ts: num(o.ts) ? o.ts : 0 } : null;
    case "err": return { op: "err", why: String(o.why ?? "") };
    default: return null;
  }
}
