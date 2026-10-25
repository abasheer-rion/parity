// Gemini (DEC-0056, team only; its market data agreement allows internal use). Every symbol
// over the v2 market data feed. Gemini sends trades and the book on one "l2" subscription,
// so the adapter keeps one subscription per symbol for either. The overview polls its price
// feed every 3 s (price and 24 h change, no volume).
import { allowed, getJson, keyed, memo, num, PAIR, type AdapterDef, type BoardPatch, type BookUpdate, type Parsed, type Trade } from "../base";

const REST = "https://api.gemini.com";
const QUOTES = ["RLUSD", "GUSD", "USDC", "USDT", "USD", "EUR", "GBP", "SGD", "BTC", "ETH", "DAI"];

/** "BTCUSD" to "BTC-USD", by the quote currencies Gemini uses. */
function split(raw: string): string | null {
  const u = raw.toUpperCase();
  for (const q of QUOTES) if (u.endsWith(q) && u.length > q.length) { const s = `${u.slice(0, -q.length)}-${q}`; return PAIR.test(s) ? s : null; }
  return null;
}
const raw = (s: string) => s.replace("-", "");

const symbolsOnce = memo(3_600_000, async () => {
  const d = await getJson<string[]>(`${REST}/v1/symbols`);
  return [...new Set(d.map(split).filter((s): s is string => !!s))];
});

const TF: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1hr", "1d": "1day" };

export const gemini: AdapterDef = {
  id: "gemini",
  enabled: (env) => allowed("gemini", env),
  make: () => {
    let all: string[] = [];
    const trades = new Set<string>(), books = new Set<string>(), fresh = new Set<string>();
    const l2 = (type: string, ss: string[]) => (ss.length ? [JSON.stringify({ type, subscriptions: [{ name: "l2", symbols: ss.map(raw) }] })] : []);
    /** Subscribe a symbol once, whether a chart or a book wants it; drop it when neither does. */
    const add = (set: Set<string>, other: Set<string>, ss: string[]) => { const n = ss.filter((s) => !set.has(s) && !other.has(s)); ss.forEach((s) => set.add(s)); n.forEach((s) => fresh.add(s)); return l2("subscribe", n); };
    const del = (set: Set<string>, other: Set<string>, ss: string[]) => { ss.forEach((s) => set.delete(s)); return l2("unsubscribe", ss.filter((s) => !other.has(s))); };
    return {
      id: "gemini", feed: "rt", internal: true, url: "wss://api.gemini.com/v2/marketdata", maxUpstream: 40, bookDepth: 400, stallMs: 120_000,
      async prepare() { all = await symbolsOnce(); trades.clear(); books.clear(); fresh.clear(); },
      allows: (s) => (all.length ? all.includes(s) : PAIR.test(s)),
      subscribe: (ss) => add(trades, books, ss),
      unsubscribe: (ss) => del(trades, books, ss),
      book: {
        // A symbol already on for its trades is subscribed again, so Gemini sends the whole book first.
        subscribe: (ss) => { const again = ss.filter((s) => trades.has(s) && !books.has(s)); again.forEach((s) => fresh.add(s)); return [...l2("unsubscribe", again), ...l2("subscribe", again), ...add(books, trades, ss)]; },
        unsubscribe: (ss) => del(books, trades, ss),
      },
      board: {
        poll: {
          every: 3_000,
          async run() {
            const d = await getJson<{ pair: string; price: string; percentChange24h: string }[]>(`${REST}/v1/pricefeed`);
            const now = Date.now();
            return d.flatMap((x): BoardPatch[] => { const s = split(x.pair); return s ? [{ s, p: num(x.price), c: num(x.percentChange24h) * 100, te: now }] : []; });
          },
        },
      },
      parse(data): Parsed {
        let m: { type?: string; symbol?: string; changes?: [string, string, string][]; price?: string; quantity?: string; side?: string; timestamp?: number };
        try { m = JSON.parse(data); } catch { return {}; }
        const s = m.symbol ? split(m.symbol) : null;
        if (!s) return {};
        if (m.type === "trade") {
          const t: Trade = { s, p: num(m.price), v: num(m.quantity), te: num(m.timestamp), side: m.side === "buy" ? 1 : m.side === "sell" ? 2 : 0 };
          return trades.has(s) ? { t: [t] } : {};
        }
        if (m.type === "l2_updates" && books.has(s)) {
          const bids: [number, number][] = [], asks: [number, number][] = [];
          for (const [side, p, q] of m.changes ?? []) (side === "buy" ? bids : asks).push([num(p), num(q)]);
          const snap = fresh.delete(s);
          const b: BookUpdate = { s, snap, bids, asks, te: Date.now() };
          return { b: [b] };
        }
        if (m.type === "l2_updates") fresh.delete(s);
        return {};
      },
    };
  },
  async history(symbol, tf) {
    if (!TF[tf] || !PAIR.test(symbol)) return null;
    const rows = await getJson<[number, number, number, number, number, number][]>(`${REST}/v2/candles/${raw(symbol).toLowerCase()}/${TF[tf]}`);
    return keyed(rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] })), tf);
  },
  symbols: () => symbolsOnce(),
};
