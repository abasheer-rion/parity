// What every source adapter shares (DEC-0052, DEC-0056): the shapes an adapter hands the
// fan-out (trades, book changes, overview rows), the adapter contract and a few helpers for
// candle history. Venue code lives in venues/; the registry is adapters.ts.
import type { Bar } from "../../src/lib/indicators";
import type { Trade } from "../../src/lib/live/conflate";
import type { FeedType, Level } from "../../src/lib/live/protocol";
import { sourceById } from "../../src/lib/live/sources";

export type { Trade };

export interface AdapterEnv {
  VENDOR?: string;
  VENDOR_KEY?: string;
  PARITY_CONTACT?: string;
  /** Sources whose terms are unclear ("ask"), switched on by the owner: comma separated ids. */
  LIVE_ALLOW?: string;
  /** Sources the owner switched off for now, comma separated ids (an emergency off switch). */
  LIVE_DENY?: string;
  /** US stock feeds (DEC-0056), off until set. Never sent to a browser. */
  ALPACA_KEY_ID?: string;
  ALPACA_SECRET_KEY?: string;
  /** "iex" (free plan, the default) or "sip" (Algo Trader Plus, every exchange). */
  ALPACA_FEED?: string;
  FINNHUB_TOKEN?: string;
  /** CoinGecko key (DEC-0063), optional: a free demo key, or a paid one with COINGECKO_PRO=1. */
  COINGECKO_API_KEY?: string;
  COINGECKO_PRO?: string;
}

/** A change to one symbol's order book. snap: replace the whole book; otherwise a size of 0
 *  removes the level and any other size sets it. */
export interface BookUpdate { s: string; snap: boolean; bids: Level[]; asks: Level[]; te: number }

/** A change to one overview row: last price, 24 h open (or change in % when the source
 *  gives that instead), 24 h volume in the quote currency. Missing fields keep their value. */
export interface BoardPatch { s: string; p?: number; o?: number; c?: number; v?: number; te: number; spark?: number[] }

/** What one upstream message held. ready: the source accepted our sign-in. drop: the line is
 *  no use (a refused subscription); close it and reconnect. */
export interface Parsed { t?: Trade[]; b?: BookUpdate[]; r?: BoardPatch[]; ready?: boolean; fail?: string; drop?: boolean }

export interface Adapter {
  id: string;
  feed: FeedType;
  delayMin?: number;
  /** Team only (terms allow internal use only): the fan-out refuses viewers the site did not vouch for. */
  internal: boolean;
  /** WebSocket address of the feed (empty for a polled source). */
  url: string;
  /** Upstream symbols at once (trades and books counted apart). */
  maxUpstream: number;
  /** Levels kept per side; deeper levels are cut after every change. */
  bookDepth?: number;
  /** Silence after which the line counts as dead (sources without heartbeats on quiet pairs). */
  stallMs?: number;
  /** Load what the adapter needs before the line opens (symbol maps). Called again on reconnect. */
  prepare?(): Promise<void>;
  /** Messages sent as soon as the line opens (sign-in). With needsReady, subscriptions wait for parse() to say ready. */
  hello?(): string[];
  needsReady?: boolean;
  /** A polled source: fetch every `every` ms while anyone watches, one request for all symbols. */
  poll?: { every: number; run(symbols: string[]): Promise<Trade[]> };
  allows(symbol: string): boolean;
  subscribe(symbols: string[]): string[];
  unsubscribe(symbols: string[]): string[];
  book?: { subscribe(symbols: string[]): string[]; unsubscribe(symbols: string[]): string[] };
  /** The market overview: upstream messages for every symbol, and/or a poll. */
  board?: { subscribe?(): string[]; unsubscribe?(): string[]; poll?: { every: number; run(): Promise<BoardPatch[]> } };
  parse(data: string): Parsed;
  ping?(): string | null;
  pingEvery?: number;
}

export interface AdapterDef {
  id: string;
  enabled(env: AdapterEnv): boolean;
  make(env: AdapterEnv): Adapter;
  history?(symbol: string, tf: string, env: AdapterEnv): Promise<Bar[] | null>;
  /** Every symbol the source lists, in our form (for search). */
  symbols?(env: AdapterEnv): Promise<string[]>;
}

export const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : Number.NaN);
const list = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/**
 * On when its terms allow display or internal use (internal ones are still team only), or
 * when its terms are unclear and the owner allowed it. A source that needs keys stays off
 * until every key is set. LIVE_DENY switches any source off.
 */
export function allowed(id: string, env: AdapterEnv): boolean {
  const meta = sourceById(id);
  if (!meta || list(env.LIVE_DENY).includes(id)) return false;
  if (meta.keys?.some((k) => !(env as Record<string, string | undefined>)[k])) return false;
  return meta.licence === "display" || meta.licence === "internal" || (meta.licence === "ask" && list(env.LIVE_ALLOW).includes(id));
}

export const TF_MS: Record<string, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };
export const BARS = 1000;

/** Candles as our charts key them (ISO time intraday, date for daily), oldest first. */
export function keyed(rows: { t: number; o: number; h: number; l: number; c: number; v: number | null }[], tf: string): Bar[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => [r.o, r.h, r.l, r.c].every(Number.isFinite) && Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t)
    .flatMap((r) => {
      const iso = new Date(r.t).toISOString();
      const time = tf === "1d" ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`;
      if (seen.has(time)) return [];
      seen.add(time);
      return [{ time, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v != null && Number.isFinite(r.v) ? r.v : null }];
    });
}

/** Bars from price points: each bar holds the points in its period and opens at the previous
 *  close, the same rule as the daily charts (DEC-0031). */
export function fromPrices(points: [number, number][], tf: string): Bar[] {
  const ms = TF_MS[tf];
  const out: Bar[] = [];
  for (const [t, p] of points) {
    if (!Number.isFinite(t) || !Number.isFinite(p)) continue;
    const start = Math.floor(t / ms) * ms;
    const iso = new Date(start).toISOString();
    const key = tf === "1d" ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`;
    const last = out[out.length - 1];
    if (last && last.time === key) { last.close = p; last.high = Math.max(last.high, p); last.low = Math.min(last.low, p); continue; }
    if (last && key < last.time) continue;
    const open = last ? last.close : p;
    out.push({ time: key, open, high: Math.max(open, p), low: Math.min(open, p), close: p, volume: null });
  }
  return out;
}

/** Our symbol form for a pair: BASE-QUOTE, upper case. */
export const PAIR = /^[A-Z0-9]{1,15}-[A-Z0-9]{2,8}$/;
export const pairOf = (base: string, quote: string) => `${base}-${quote}`.toUpperCase();

/** JSON from a public endpoint, or an error that names the status (the fan-out backs off on 429). */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", "User-Agent": "parity-live (contact@paritytrading.ai)", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
  return (await res.json()) as T;
}

/** A value kept for `ms` and shared by every caller in this isolate. */
export function memo<T>(ms: number, make: () => Promise<T>): () => Promise<T> {
  let at = 0;
  let val: Promise<T> | null = null;
  return () => {
    if (val && Date.now() - at < ms) return val;
    at = Date.now();
    val = make().catch((e) => { val = null; throw e; });
    return val;
  };
}

/** Chunks of n, for sources that take a limited number of symbols per message. */
export const chunks = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
