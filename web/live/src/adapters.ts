// Source adapters (DEC-0049): each turns one public feed into our trade shape and knows
// how to fetch that source's own candle history. Only sources whose terms allow showing
// their data on our site are enabled (src/lib/live/sources.ts holds the terms per source;
// `parity data sources` lists them). A licensed vendor plugs in the same way: set VENDOR
// and VENDOR_KEY in the Pages and worker settings and its adapter turns on, with no code
// change in the browser.
import type { Bar } from "../../src/lib/indicators";
import type { Trade } from "../../src/lib/live/conflate";
import type { FeedType } from "../../src/lib/live/protocol";
import { sourceById } from "../../src/lib/live/sources";

export interface AdapterEnv { VENDOR?: string; VENDOR_KEY?: string; PARITY_CONTACT?: string }

export interface Adapter {
  id: string;
  feed: FeedType;
  /** WebSocket address of the public feed. */
  url: string;
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
const allowedByTerms = (id: string) => sourceById(id)?.licence === "display";

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
  enabled: () => allowedByTerms("hyperliquid"),
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

// ------------------------------------------------------------------ Coinbase Exchange

const PAIR = /^[A-Z0-9]{2,10}-[A-Z]{3,4}$/;

const coinbase: AdapterDef = {
  id: "coinbase",
  enabled: () => allowedByTerms("coinbase"),
  make: () => ({
    id: "coinbase", feed: "rt", url: "wss://ws-feed.exchange.coinbase.com",
    allows: (s) => PAIR.test(s),
    subscribe: (ss) => [JSON.stringify({ type: "subscribe", product_ids: ss, channels: ["matches", "heartbeat"] })],
    unsubscribe: (ss) => [JSON.stringify({ type: "unsubscribe", product_ids: ss, channels: ["matches", "heartbeat"] })],
    parse(data) {
      let m: { type?: string; product_id?: string; price?: string; size?: string; time?: string };
      try { m = JSON.parse(data); } catch { return []; }
      if (m.type !== "match" || !m.product_id) return [];
      return [{ s: m.product_id, p: num(m.price), v: num(m.size), te: Date.parse(m.time ?? "") }];
    },
  }),
  async history(symbol, tf) {
    const g: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 };
    if (!PAIR.test(symbol) || !g[tf]) return null;
    const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=${g[tf]}`, { headers: { "User-Agent": "parity-live" } });
    if (!res.ok) throw new Error(`coinbase ${res.status}`);
    const rows = (await res.json()) as number[][]; // [time s, low, high, open, close, volume]
    return keyed(rows.map((r) => ({ t: r[0] * 1000, l: r[1], h: r[2], o: r[3], c: r[4], v: r[5] })), tf);
  },
};

// ------------------------------------------------------------------ Kraken (WebSocket v2)

const kraken: AdapterDef = {
  id: "kraken",
  enabled: () => allowedByTerms("kraken"),
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

// ------------------------------------------------------------------ Bitstamp

const bitstamp: AdapterDef = {
  id: "bitstamp",
  enabled: () => allowedByTerms("bitstamp"),
  make: () => ({
    id: "bitstamp", feed: "rt", url: "wss://ws.bitstamp.net",
    allows: (s) => PAIR.test(s),
    subscribe: (ss) => ss.map((s) => JSON.stringify({ event: "bts:subscribe", data: { channel: `live_trades_${s.replace("-", "").toLowerCase()}` } })),
    unsubscribe: (ss) => ss.map((s) => JSON.stringify({ event: "bts:unsubscribe", data: { channel: `live_trades_${s.replace("-", "").toLowerCase()}` } })),
    parse(data) {
      let m: { event?: string; channel?: string; data?: { price: number; amount: number; microtimestamp: string } };
      try { m = JSON.parse(data); } catch { return []; }
      if (m.event !== "trade" || !m.channel || !m.data) return [];
      const pair = m.channel.replace("live_trades_", "").toUpperCase();
      const s = `${pair.slice(0, -3)}-${pair.slice(-3)}`;
      return [{ s, p: num(m.data.price), v: num(m.data.amount), te: Math.floor(num(m.data.microtimestamp) / 1000) }];
    },
    ping: () => JSON.stringify({ event: "bts:heartbeat" }),
  }),
};

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

export const ADAPTERS: AdapterDef[] = [hyperliquid, coinbase, kraken, bitstamp, vendor];

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
  for (const a of [coinbase, kraken, bitstamp]) if (a.enabled(env)) live[a.id] = sourceById(a.id)?.symbols ?? [];
  return { at: Date.now(), stocks, live };
}
