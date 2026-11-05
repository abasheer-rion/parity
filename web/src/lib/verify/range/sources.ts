// Where the fill price check gets its bars (DEC-0092). Every source here was read for its
// terms; the decision record says what each permits. The bars are used on our server for this
// computation only: never shown, never sent to the page, never passed on. Each source answers
// two questions: the bars of one UTC day, and the day's low and high over a span of dates.
import { nyClock, utcDate } from "./clock";
import type { Bar, SourceInfo } from "./engine";
import { SOURCE_INFO } from "./info";
import { USD_LIKE } from "./market";

export interface RangeEnv {
  ALPACA_KEY_ID?: string;
  ALPACA_SECRET_KEY?: string;
  /** "on" once the owner has given Alpaca the notice its terms ask for (DEC-0092). */
  FILL_CHECK_STOCKS?: string;
  /** A Base node with full history (it carries a key, so it is a secret). Without it, the free node's last eight weeks or so. */
  BASE_RPC_URL?: string;
}

/** A source refused, limited or failed. The fills it would have checked say "not checked". */
export class SourceBusy extends Error {}
/** This request's budget of calls or time ran out. The page sends what is left again. */
export class OutOfBudget extends Error {}

export interface Ctx {
  env: RangeEnv;
  /** Fetch a JSON document, counted against the request's budget and paced for the source. */
  get(src: SourceDef, url: string, init?: { headers?: Record<string, string>; body?: string }): Promise<unknown>;
  now: number;
}

interface SourceBase extends SourceInfo {
  /** Where its terms are, for the record. */
  terms: string;
  /** Data is only allowed or complete this long after the fact, ms. */
  lag: number;
  /** Shortest gap between two calls from one server instance, ms. */
  gap: number;
  enabled(env: RangeEnv): boolean;
  /** The venue's name for a sent symbol, or null when the venue does not list it. */
  venueSymbol(sym: string, ctx: Ctx): Promise<string | null>;
  /** The day's [low, high] by date, for every trading day from `from` to `to`; absent for a source without days. */
  daily?(vsym: string, from: string, to: string, ctx: Ctx): Promise<Map<string, [number, number]>>;
}

/** A source read a whole UTC day at a time (minute bars). */
export interface DaySource extends SourceBase {
  /** Bars of one UTC day ("YYYY-MM-DD"), sorted by time. */
  dayBars(vsym: string, date: string, ctx: Ctx): Promise<Bar[]>;
}

/** A source read for a stretch of time around the fills (swaps in a pool). */
export interface SpanSource extends SourceBase {
  exactTime: true;
  /** Longest stretch one call reads, ms. */
  maxSpan: number;
  /** Bars in [from, to), sorted by time. */
  spanBars(vsym: string, from: number, to: number, ctx: Ctx): Promise<Bar[]>;
}

export type SourceDef = DaySource | SpanSource;
export const isSpan = (s: SourceDef): s is SpanSource => "spanBars" in s;

const MIN = 60_000;
const nextDay = (d: string) => utcDate(Date.parse(`${d}T00:00:00Z`) + 86_400_000);

// ------------------------------------------------------------------ Alpaca, US stocks and funds

// IEX's own trades only (feed=iex): IEX lets its historical data be used and passed on with a
// credit line, and does not charge for use that shows no prices. The consolidated feed carries
// every exchange's licence, so it is never asked for. Alpaca's terms ask for 30 days' written
// notice before its data serves other people, so this source is off until the owner has given
// that notice and sets FILL_CHECK_STOCKS=on (DEC-0092).
const ALPACA = "https://data.alpaca.markets/v2/stocks";
const alpacaHeaders = (env: RangeEnv) => ({ "APCA-API-KEY-ID": env.ALPACA_KEY_ID ?? "", "APCA-API-SECRET-KEY": env.ALPACA_SECRET_KEY ?? "" });
/** RFC 3339 with nanoseconds to ms (Date.parse is only sure of three digits). */
const ms = (t: string) => Date.parse(t.replace(/(\.\d{3})\d+/, "$1"));

interface AlpacaBars { bars?: { t: string; l: number; h: number }[] | null; next_page_token?: string | null }

export const ALPACA_IEX: DaySource = {
  // IEX is one exchange with a few percent of US volume, so a fill made elsewhere can sit a
  // little outside IEX's own range for that minute: five minutes either side, and 0.5%.
  ...SOURCE_INFO["alpaca-iex"],
  terms: "https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf",
  lag: MIN,
  gap: 350,
  enabled: (env) => env.FILL_CHECK_STOCKS === "on" && !!(env.ALPACA_KEY_ID && env.ALPACA_SECRET_KEY),
  venueSymbol: async (sym) => (/^[A-Z]{1,5}(\.[A-Z])?$/.test(sym) ? sym : null),
  async dayBars(vsym, date, ctx) {
    const out: Bar[] = [];
    let token: string | null | undefined = null;
    const end = Math.min(Date.parse(`${nextDay(date)}T00:00:00Z`), ctx.now - MIN);
    if (end <= Date.parse(`${date}T00:00:00Z`)) return out;
    do {
      const q = new URLSearchParams({ timeframe: "1Min", start: `${date}T00:00:00Z`, end: new Date(end).toISOString(), limit: "10000", adjustment: "raw", feed: "iex", sort: "asc" });
      if (token) q.set("page_token", token);
      const d = (await ctx.get(ALPACA_IEX, `${ALPACA}/${encodeURIComponent(vsym)}/bars?${q}`, { headers: alpacaHeaders(ctx.env) })) as AlpacaBars;
      for (const b of d.bars ?? []) if (b.l > 0 && b.h >= b.l) out.push([ms(b.t), b.l, b.h]);
      token = d.next_page_token;
    } while (token);
    return out;
  },
  async daily(vsym, from, to, ctx) {
    const out = new Map<string, [number, number]>();
    let token: string | null | undefined = null;
    do {
      const q = new URLSearchParams({ timeframe: "1Day", start: from, end: to, limit: "10000", adjustment: "raw", feed: "iex", sort: "asc" });
      if (token) q.set("page_token", token);
      const d = (await ctx.get(ALPACA_IEX, `${ALPACA}/${encodeURIComponent(vsym)}/bars?${q}`, { headers: alpacaHeaders(ctx.env) })) as AlpacaBars;
      // A day bar's time is midnight in New York: file it under that trading date. Its low and
      // high are the regular session's (9:30 a.m. to 4 p.m.).
      for (const b of d.bars ?? []) if (b.l > 0 && b.h >= b.l) out.set(nyClock(ms(b.t) + 6 * 3_600_000).date, [b.l, b.h]);
      token = d.next_page_token;
    } while (token);
    return out;
  },
};

// ------------------------------------------------------------------ crypto venues

/** Splits a sent crypto symbol ("BTC-USDT"). */
export const pairOf = (s: string) => { const [base, quote] = s.split("-"); return { base, quote }; };

/** Quotes to try on a venue for a sent quote: the same one first, then other dollar ones. */
export function quotesFor(quote: string, venueQuotes: string[]): string[] {
  const out = [quote];
  if (USD_LIKE.has(quote)) for (const q of venueQuotes) if (USD_LIKE.has(q) && !out.includes(q)) out.push(q);
  return out;
}
