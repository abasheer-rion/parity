// Source adapters (DEC-0052, DEC-0056): each turns one feed into our shapes (base.ts) and
// knows how to fetch that source's own candle history. Sources whose terms allow display
// stream to everyone; sources whose terms allow internal use only stream to team members
// (the site checks the person's sign-in and the team list before it connects them, see
// functions/live/). src/lib/live/sources.ts holds the terms per source; `parity data
// sources` lists them. A licensed vendor plugs in the same way: set VENDOR and VENDOR_KEY.
import type { Bar } from "../../src/lib/indicators";
import { sourceById } from "../../src/lib/live/sources";
import { allowed, fromPrices, getJson, num, type Adapter, type AdapterDef, type AdapterEnv, type BoardPatch, type Trade } from "./base";
import { binanceus } from "./venues/binanceus";
import { coinbase } from "./venues/coinbase";
import { gemini } from "./venues/gemini";
import { hyperliquid } from "./venues/hyperliquid";
import { kraken } from "./venues/kraken";
import { onchain } from "./venues/onchain";
import { alpaca, finnhub } from "./venues/stocks";

export type { Adapter, AdapterDef, AdapterEnv };
export { fromPrices };

// ------------------------------------------------------------------ CoinGecko (polled)

/** CoinGecko's 100 largest coins, about a minute behind (its free API refreshes about once a
 *  minute). One request a minute serves every viewer of every coin. Display is allowed with
 *  "Data provided by CoinGecko" linked next to the data (REF-0014). */
const CG = "https://api.coingecko.com/api/v3";
const CG_SYM = /^([A-Z0-9]{1,12})-USD$/;
/** Symbols offered when CoinGecko's list cannot be read (its free API limits by address). */
const CG_FALLBACK = ["BTC", "ETH", "USDT", "XRP", "BNB", "SOL", "USDC", "DOGE", "TRX", "ADA", "LINK", "AVAX", "XLM", "SUI", "BCH", "HBAR", "LTC", "DOT", "TON", "SHIB"].map((s) => `${s}-USD`);
interface CgRow { id: string; symbol: string; current_price: number | null; last_updated: string | null; market_cap_rank: number | null; price_change_percentage_24h?: number | null; total_volume?: number | null; sparkline_in_7d?: { price?: number[] } }

/** CoinGecko's address and headers: with COINGECKO_API_KEY set (a secret, never sent to a
 *  browser) requests carry the key, so Cloudflare's shared addresses stop hitting the free
 *  limit. COINGECKO_PRO=1 means a paid key (pro-api address); otherwise a free demo key. */
function cg(env: AdapterEnv): { base: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "parity-live" };
  if (!env.COINGECKO_API_KEY) return { base: CG, headers };
  if (env.COINGECKO_PRO === "1") return { base: "https://pro-api.coingecko.com/api/v3", headers: { ...headers, "x-cg-pro-api-key": env.COINGECKO_API_KEY } };
  return { base: CG, headers: { ...headers, "x-cg-demo-api-key": env.COINGECKO_API_KEY } };
}

let cgTop: { at: number; rows: CgRow[] } | null = null;
async function cgMarkets(maxAgeMs: number, env: AdapterEnv): Promise<CgRow[]> {
  if (cgTop && Date.now() - cgTop.at < maxAgeMs) return cgTop.rows;
  const { base, headers } = cg(env);
  // Cached at the edge for 20 s, so every worker and object shares one answer.
  const res = await fetch(`${base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true`, { headers, cf: { cacheTtlByStatus: { "200-299": 20, "300-599": 0 }, cacheEverything: true } } as RequestInit);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const rows = (await res.json()) as CgRow[];
  // A refusal can come back as an object instead of a list; never cache that.
  if (!Array.isArray(rows) || !rows.length) throw new Error("coingecko 429");
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
  make: (env) => ({
    id: "coingecko", feed: "delayed", delayMin: 1, url: "", internal: false, maxUpstream: 100,
    allows: (s) => CG_SYM.test(s),
    subscribe: () => [], unsubscribe: () => [], parse: () => ({}),
    board: {
      poll: {
        every: 30_000,
        async run() {
          const out: BoardPatch[] = [];
          for (const [s, r] of cgSymbols(await cgMarkets(30_000, env))) {
            const te = r.last_updated ? Date.parse(r.last_updated) : Number.NaN;
            if (r.current_price == null || !Number.isFinite(te)) continue;
            // CoinGecko's own 7-day line, about one point an hour; the last 24 points are the last day.
            const spark = r.sparkline_in_7d?.price?.slice(-24);
            out.push({ s, p: r.current_price, c: r.price_change_percentage_24h ?? undefined, v: r.total_volume ?? undefined, te, ...(spark?.length ? { spark } : {}) });
          }
          return out;
        },
      },
    },
    poll: {
      every: 30_000,
      async run(symbols) {
        const bySym = cgSymbols(await cgMarkets(30_000, env));
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
  async history(symbol, tf, env) {
    const days: Record<string, number> = { "5m": 1, "1h": 30, "1d": 365 };
    if (!CG_SYM.test(symbol) || !days[tf]) return null;
    const row = cgSymbols(await cgMarkets(3_600_000, env)).get(symbol);
    if (!row) return null;
    const { base, headers } = cg(env);
    const res = await fetch(`${base}/coins/${encodeURIComponent(row.id)}/market_chart?vs_currency=usd&days=${days[tf]}${tf === "1d" ? "&interval=daily" : ""}`, { headers });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const doc = (await res.json()) as { prices: [number, number][] };
    return fromPrices(doc.prices ?? [], tf);
  },
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
    id: "vendor", feed: "rt", url: "wss://socket.massive.com/stocks", internal: false, maxUpstream: 60,
    allows: (s) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(s),
    subscribe: (ss) => [JSON.stringify({ action: "auth", params: env.VENDOR_KEY }), JSON.stringify({ action: "subscribe", params: ss.map((s) => `T.${s}`).join(",") })],
    unsubscribe: (ss) => [JSON.stringify({ action: "unsubscribe", params: ss.map((s) => `T.${s}`).join(",") })],
    parse(data) {
      let m: { ev?: string; sym?: string; p?: number; s?: number; t?: number }[];
      try { m = JSON.parse(data); } catch { return {}; }
      return { t: Array.isArray(m) ? m.filter((x) => x.ev === "T" && x.sym).map((x) => ({ s: x.sym!, p: num(x.p), v: num(x.s), te: num(x.t) })) : [] };
    },
  }),
};

export const ADAPTERS: AdapterDef[] = [onchain, coingecko, hyperliquid, kraken, coinbase, gemini, binanceus, alpaca, finnhub, vendor];

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
  /** A source that streams any listed stock (team only, once keyed), or absent. */
  liveStocks?: string;
}

const secList = async (env: AdapterEnv): Promise<[string, string, string][]> => {
  const contact = env.PARITY_CONTACT || "contact@paritytrading.app";
  const doc = await getJson<{ fields: string[]; data: (string | number | null)[][] }>("https://www.sec.gov/files/company_tickers_exchange.json", { headers: { "User-Agent": `Parity research ${contact}` } });
  const iT = doc.fields.indexOf("ticker"), iN = doc.fields.indexOf("name"), iE = doc.fields.indexOf("exchange");
  const seen = new Set<string>();
  const stocks: [string, string, string][] = [];
  for (const r of doc.data) {
    const t = String(r[iT] ?? "").toUpperCase(), ex = r[iE] == null ? "" : String(r[iE]);
    if (!t || seen.has(t) || !ex) continue;
    seen.add(t);
    stocks.push([t, String(r[iN] ?? ""), ex]);
  }
  return stocks;
};

/**
 * Every US-listed symbol from the SEC's public company list, plus the live symbols. The
 * public list holds only sources that may be shown to anyone; `team` adds every team-only
 * venue's full pair list and, when a stock feed is keyed, says which source streams stocks.
 */
export async function universe(env: AdapterEnv, team = false): Promise<UniverseDoc> {
  const stocks = await secList(env);
  const live: Record<string, string[]> = {};
  if (coingecko.enabled(env)) {
    try { live.coingecko = [...cgSymbols(await cgMarkets(600_000, env)).keys()]; } catch { live.coingecko = CG_FALLBACK; }
    if (!live.coingecko.length) live.coingecko = CG_FALLBACK;
  }
  // Our own feeds and other sources anyone may see, each with its fixed list.
  if (onchain.enabled(env)) live.onchain = await onchain.symbols!(env);
  let liveStocks: string | undefined;
  if (team) {
    await Promise.all(ADAPTERS.filter((a) => a.symbols && a.enabled(env) && sourceById(a.id)?.licence === "internal").map(async (a) => {
      try { live[a.id] = await a.symbols!(env); } catch (e) { console.error("universe", a.id, String(e)); live[a.id] = []; }
    }));
    liveStocks = [alpaca, finnhub].find((a) => a.enabled(env))?.id;
  }
  return { at: Date.now(), stocks, live, ...(liveStocks ? { liveStocks } : {}) };
}

export type { Trade };
