// Source adapters (DEC-0052): each turns one public feed into our trade shape and knows
// how to fetch that source's own candle history. Only sources whose terms allow showing
// their data on our site are enabled (src/lib/live/sources.ts holds the terms per source;
// `parity data sources` lists them). A licensed vendor plugs in the same way: set VENDOR
// and VENDOR_KEY in the Pages and worker settings and its adapter turns on, with no code
// change in the browser.
import type { Bar } from "../../src/lib/indicators";
import type { Trade } from "../../src/lib/live/conflate";
import type { FeedType } from "../../src/lib/live/protocol";
import { sourceById } from "../../src/lib/live/sources";

export interface AdapterEnv {
  VENDOR?: string;
  VENDOR_KEY?: string;
  PARITY_CONTACT?: string;
  /** Sources whose terms are unclear ("ask"), switched on by the owner: comma separated ids. */
  LIVE_ALLOW?: string;
}

export interface Adapter {
  id: string;
  feed: FeedType;
  delayMin?: number;
  /** WebSocket address of the public feed (empty for a polled source). */
  url: string;
  /** A polled source: fetch every `every` ms while anyone watches, one request for all symbols. */
  poll?: { every: number; run(symbols: string[]): Promise<Trade[]> };
  allows(symbol: string): boolean;
  subscribe(symbols: string[]): string[];
  unsubscribe(symbols: string[]): string[];
  /** Trades in one upstream message (none for heartbeats, acks and books). */
  parse(data: string): Trade[];
  ping?(): string | null;
  pingEvery?: number;
}

export interface AdapterDef {
  id: string;
  enabled(env: AdapterEnv): boolean;
  make(env: AdapterEnv): Adapter;
  history?(symbol: string, tf: string, env: AdapterEnv): Promise<Bar[] | null>;
}

const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" ? Number(x) : Number.NaN);
/** On when its terms allow display, or when its terms are unclear and the owner allowed it. */
function allowed(id: string, env: AdapterEnv): boolean {
  const lic = sourceById(id)?.licence;
  return lic === "display" || (lic === "ask" && (env.LIVE_ALLOW ?? "").split(",").map((x) => x.trim()).includes(id));
}

/** Candles as our charts key them (ISO time intraday, date for daily), oldest first. */
function keyed(rows: { t: number; o: number; h: number; l: number; c: number; v: number | null }[], tf: string): Bar[] {
  return rows
    .filter((r) => [r.o, r.h, r.l, r.c].every(Number.isFinite))
    .sort((a, b) => a.t - b.t)
    .map((r) => {
      const iso = new Date(r.t).toISOString();
      return { time: tf === "1d" ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v };
    });
}

const TF_MS: Record<string, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };
const BARS = 1000;

// ------------------------------------------------------------------ Hyperliquid

/** Hyperliquid perps: symbols are the coin with "-PERP", e.g. BTC-PERP. */
const HL_COIN = /^([A-Z0-9]{1,12})-PERP$/;
const coinOf = (s: string) => s.match(HL_COIN)?.[1] ?? null;

const hyperliquid: AdapterDef = {
  id: "hyperliquid",
  enabled: (env) => allowed("hyperliquid", env),
  make: () => ({
    id: "hyperliquid", feed: "rt", url: "wss://api.hyperliquid.xyz/ws",
    allows: (s) => HL_COIN.test(s),
    subscribe: (ss) => ss.map((s) => JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: coinOf(s) } })),
    unsubscribe: (ss) => ss.map((s) => JSON.stringify({ method: "unsubscribe", subscription: { type: "trades", coin: coinOf(s) } })),
    parse(data) {
      let m: { channel?: string; data?: { coin: string; px: string; sz: string; time: number }[] };
      try { m = JSON.parse(data); } catch { return []; }
      if (m.channel !== "trades" || !Array.isArray(m.data)) return [];
      return m.data.map((t) => ({ s: `${t.coin}-PERP`, p: num(t.px), v: num(t.sz), te: num(t.time) }));
    },
    ping: () => JSON.stringify({ method: "ping" }),
    pingEvery: 30_000,
  }),
  async history(symbol, tf) {
    const coin = coinOf(symbol);
    if (!coin || !TF_MS[tf]) return null;
    const now = Date.now();
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "candleSnapshot", req: { coin, interval: tf, startTime: now - TF_MS[tf] * BARS, endTime: now } }),
    });
    if (!res.ok) throw new Error(`hyperliquid ${res.status}`);
    const rows = (await res.json()) as { t: number; o: string; h: string; l: string; c: string; v: string }[];
    return keyed(rows.map((r) => ({ t: r.t, o: num(r.o), h: num(r.h), l: num(r.l), c: num(r.c), v: num(r.v) })), tf);
  },
};

const PAIR = /^[A-Z0-9]{2,10}-[A-Z]{3,4}$/;

// ------------------------------------------------------------------ Kraken (WebSocket v2)

const kraken: AdapterDef = {
  id: "kraken",
  enabled: (env) => allowed("kraken", env),
  make: () => ({
    id: "kraken", feed: "rt", url: "wss://ws.kraken.com/v2",
    allows: (s) => PAIR.test(s),
    subscribe: (ss) => [JSON.stringify({ method: "subscribe", params: { channel: "trade", symbol: ss.map((s) => s.replace("-", "/")) } })],
    unsubscribe: (ss) => [JSON.stringify({ method: "unsubscribe", params: { channel: "trade", symbol: ss.map((s) => s.replace("-", "/")) } })],
    parse(data) {
      let m: { channel?: string; data?: { symbol: string; price: number; qty: number; timestamp: string }[] };
      try { m = JSON.parse(data); } catch { return []; }
      if (m.channel !== "trade" || !Array.isArray(m.data)) return [];
      return m.data.map((t) => ({ s: t.symbol.replace("/", "-"), p: num(t.price), v: num(t.qty), te: Date.parse(t.timestamp) }));
    },
    ping: () => JSON.stringify({ method: "ping" }),
  }),
};

// ------------------------------------------------------------------ CoinGecko (polled)

/** CoinGecko's 100 largest coins, about a minute behind (its free API refreshes about once a
 *  minute). One request a minute serves every viewer of every coin. Display is allowed with
 *  "Data provided by CoinGecko" linked next to the data (REF-0014). */
const CG = "https://api.coingecko.com/api/v3";
const CG_SYM = /^([A-Z0-9]{1,12})-USD$/;
/** Symbols offered when CoinGecko's list cannot be read (its free API limits by address). */
const CG_FALLBACK = ["BTC", "ETH", "USDT", "XRP", "BNB", "SOL", "USDC", "DOGE", "TRX", "ADA", "LINK", "AVAX", "XLM", "SUI", "BCH", "HBAR", "LTC", "DOT", "TON", "SHIB"].map((s) => `${s}-USD`);
interface CgRow { id: string; symbol: string; current_price: number | null; last_updated: string | null; market_cap_rank: number | null }

let cgTop: { at: number; rows: CgRow[] } | null = null;
async function cgMarkets(maxAgeMs: number): Promise<CgRow[]> {
  if (cgTop && Date.now() - cgTop.at < maxAgeMs) return cgTop.rows;
  // Cached at the edge for 20 s, so every worker and object shares one answer.
  const res = await fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`, { headers: { Accept: "application/json", "User-Agent": "parity-live" }, cf: { cacheTtl: 20, cacheEverything: true } } as RequestInit);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const rows = (await res.json()) as CgRow[];
  cgTop = { at: Date.now(), rows };
  return rows;
}
/** Our symbol for a CoinGecko row; the larger coin keeps a ticker two coins share. */
function cgSymbols(rows: CgRow[]): Map<string, CgRow> {
  const out = new Map<string, CgRow>();
  for (const r of rows) {
    const s = `${r.symbol.toUpperCase()}-USD`;
    if (CG_SYM.test(s) && !out.has(s)) out.set(s, r);
  }
  return out;
}
const coingecko: AdapterDef = {
  id: "coingecko",
  enabled: (env) => allowed("coingecko", env),
  make: () => ({
    id: "coingecko", feed: "delayed", delayMin: 1, url: "",
    allows: (s) => CG_SYM.test(s),
    subscribe: () => [], unsubscribe: () => [], parse: () => [],
    poll: {
      every: 30_000,
      async run(symbols) {
        const bySym = cgSymbols(await cgMarkets(30_000));
        const out: Trade[] = [];
        for (const s of symbols) {
          const r = bySym.get(s);
          const te = r?.last_updated ? Date.parse(r.last_updated) : Number.NaN;
          if (!r || r.current_price == null || !Number.isFinite(te)) continue;
          out.push({ s, p: r.current_price, v: 0, te });
        }
        return out;
      },
    },
  }),
  async history(symbol, tf) {
    const days: Record<string, number> = { "5m": 1, "1h": 30, "1d": 365 };
    if (!CG_SYM.test(symbol) || !days[tf]) return null;
    const row = cgSymbols(await cgMarkets(3_600_000)).get(symbol);
    if (!row) return null;
    const res = await fetch(`${CG}/coins/${encodeURIComponent(row.id)}/market_chart?vs_currency=usd&days=${days[tf]}${tf === "1d" ? "&interval=daily" : ""}`, { headers: { Accept: "application/json", "User-Agent": "parity-live" } });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const doc = (await res.json()) as { prices: [number, number][] };
    return fromPrices(doc.prices ?? [], tf);
  },
};

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

// ------------------------------------------------------------------ licensed vendor

/**
 * A licensed vendor (Massive, formerly Polygon, style WebSocket) for US stocks. Off until
 * the owner signs a display licence and sets VENDOR=massive and VENDOR_KEY. The key is read
 * from the environment only and never reaches a browser.
 */
const vendor: AdapterDef = {
  id: "vendor",
  enabled: (env) => env.VENDOR === "massive" && !!env.VENDOR_KEY,
  make: (env) => ({
    id: "vendor", feed: "rt", url: "wss://socket.massive.com/stocks",
    allows: (s) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(s),
    subscribe: (ss) => [JSON.stringify({ action: "auth", params: env.VENDOR_KEY }), JSON.stringify({ action: "subscribe", params: ss.map((s) => `T.${s}`).join(",") })],
    unsubscribe: (ss) => [JSON.stringify({ action: "unsubscribe", params: ss.map((s) => `T.${s}`).join(",") })],
    parse(data) {
      let m: { ev?: string; sym?: string; p?: number; s?: number; t?: number }[];
      try { m = JSON.parse(data); } catch { return []; }
      return Array.isArray(m) ? m.filter((x) => x.ev === "T" && x.sym).map((x) => ({ s: x.sym!, p: num(x.p), v: num(x.s), te: num(x.t) })) : [];
    },
  }),
};

export const ADAPTERS: AdapterDef[] = [coingecko, hyperliquid, kraken, vendor];

export function adapterFor(id: string, env: AdapterEnv): Adapter | null {
  const def = ADAPTERS.find((a) => a.id === id);
  return def && def.enabled(env) ? def.make(env) : null;
}

export async function historyFor(id: string, symbol: string, tf: string, env: AdapterEnv): Promise<Bar[] | null> {
  const def = ADAPTERS.find((a) => a.id === id);
  if (!def || !def.enabled(env) || !def.history) return null;
  return def.history(symbol, tf, env);
}

// ------------------------------------------------------------------ the symbol universe

export interface UniverseDoc {
  at: number;
  /** [symbol, name, exchange] for every US-listed company and fund the SEC lists. */
  stocks: [string, string, string][];
  /** Live symbols per source. */
  live: Record<string, string[]>;
}

/** Every US-listed symbol from the SEC's public company list, plus the live symbols. */
export async function universe(env: AdapterEnv): Promise<UniverseDoc> {
  const contact = env.PARITY_CONTACT || "contact@paritytrading.ai";
  const res = await fetch("https://www.sec.gov/files/company_tickers_exchange.json", { headers: { "User-Agent": `Parity research ${contact}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`sec ${res.status}`);
  const doc = (await res.json()) as { fields: string[]; data: (string | number | null)[][] };
  const iT = doc.fields.indexOf("ticker"), iN = doc.fields.indexOf("name"), iE = doc.fields.indexOf("exchange");
  const seen = new Set<string>();
  const stocks: [string, string, string][] = [];
  for (const r of doc.data) {
    const t = String(r[iT] ?? "").toUpperCase(), ex = r[iE] == null ? "" : String(r[iE]);
    if (!t || seen.has(t) || !ex) continue;
    seen.add(t);
    stocks.push([t, String(r[iN] ?? ""), ex]);
  }
  const live: Record<string, string[]> = {};
  if (hyperliquid.enabled(env)) {
    try {
      const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "meta" }) });
      const m = (await r.json()) as { universe: { name: string; isDelisted?: boolean }[] };
      live.hyperliquid = m.universe.filter((u) => !u.isDelisted && /^[A-Z0-9]{1,12}$/.test(u.name)).map((u) => `${u.name}-PERP`);
    } catch { live.hyperliquid = []; }
  }
  if (coingecko.enabled(env)) {
    try { live.coingecko = [...cgSymbols(await cgMarkets(600_000)).keys()]; } catch { live.coingecko = CG_FALLBACK; }
  }
  if (kraken.enabled(env)) live.kraken = sourceById("kraken")?.symbols ?? [];
  return { at: Date.now(), stocks, live };
}
