// Daily prices for card 4's fill checks. The deploy writes /data/verify/prices.json from
// the series Parity Terminal already shows (scripts/export_verify_prices.py): major
// currencies, Bitcoin, Ether and the S&P 500. Our free sources give one price a day, not
// the day's high and low, so those symbols get the "far from the day's price" check and
// the high and low checks say they cannot be checked. A symbol with real highs and lows
// ("hl") gets the full checks. Only this public price file is fetched: the person's file
// never leaves the browser.
import { source } from "../data";

export interface PriceSeries {
  /** "hl": the day's low and high. "price": one price a day, inside that day's range. */
  kind: "hl" | "price";
  /** date -> [low, high] for "hl", or [price, price] for "price". */
  days: Map<string, [number, number]>;
  /** Where the prices come from, in words. */
  source: string;
  /** For "price": how far a fill may sit from the day's price before it is flagged (a fraction). */
  bound?: number;
}

export type PriceBook = Record<string, PriceSeries>;

interface PriceFile {
  generated_at: string;
  symbols: Record<string, { kind: "hl" | "price"; source: string; rows: (number | string)[][] }>;
}

/** EUR/USD, EURUSD.a, EURUSDm, XBTUSD, BTCUSDT, US500.cash and the like, to the names in the price file. */
export function normaliseSymbol(s: string): string {
  let v = s.toUpperCase().replace(/[\s/_-]/g, "").replace(/\.(A|B|C|M|PRO|ECN|RAW|STD|CASH|I|R|X)$/, "");
  const alias: Record<string, string> = {
    XBTUSD: "BTCUSD", BTCUSDT: "BTCUSD", BTCUSDC: "BTCUSD", BTC: "BTCUSD", BITCOIN: "BTCUSD",
    ETHUSDT: "ETHUSD", ETHUSDC: "ETHUSD", ETH: "ETHUSD", ETHER: "ETHUSD",
    US500: "SPX", SPX500: "SPX", SP500: "SPX", USA500: "SPX", SPX: "SPX", "S&P500": "SPX", ES: "SPX",
  };
  if (alias[v]) return alias[v];
  // Broker suffixes on currency pairs: EURUSDm, EURUSD.raw, EURUSDpro.
  const fx = v.match(/^([A-Z]{6})[A-Z.]{0,4}$/);
  if (fx && /^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY|NOK|SEK)(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY|NOK|SEK)$/.test(fx[1])) v = fx[1];
  return alias[v] ?? v;
}

/** Builds a price book from the file's JSON. Rows are [date, low, high] or [date, price]. */
export function priceBook(doc: PriceFile): PriceBook {
  const out: PriceBook = {};
  for (const [sym, s] of Object.entries(doc.symbols ?? {})) {
    const days = new Map<string, [number, number]>();
    const moves: number[] = [];
    let prev: number | null = null;
    for (const row of s.rows) {
      const d = String(row[0]);
      const lo = Number(row[1]), hi = Number(row[s.kind === "hl" ? 2 : 1]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0) continue;
      days.set(d, [lo, hi]);
      if (s.kind === "price") { if (prev) moves.push(Math.abs(lo / prev - 1)); prev = lo; }
    }
    let bound: number | undefined;
    if (s.kind === "price" && moves.length > 20) {
      // Three times a 1-in-100 daily move, and never under 1%: a fill this far from the
      // day's price is outside any range that day would plausibly have had.
      const q99 = [...moves].sort((a, b) => a - b)[Math.floor(moves.length * 0.99)];
      bound = Math.max(0.01, 3 * q99);
    }
    out[sym] = { kind: s.kind, days, source: s.source, bound };
  }
  return out;
}

let cached: Promise<PriceBook | null> | null = null;

/** The price file, once per visit. Null when it is missing (local development, or not built yet). */
export function loadPrices(): Promise<PriceBook | null> {
  cached ??= fetch(source === "local" ? "/local/verify/prices.json" : "/data/verify/prices.json", { cache: "no-cache" })
    .then(async (res) => {
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
      return priceBook((await res.json()) as PriceFile);
    })
    .catch(() => null);
  return cached;
}
