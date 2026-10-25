// Coinbase Exchange (DEC-0053, team only): every online product over the public feed.
// Trades from "matches" (Coinbase names the maker's side, so the taker's is the other one),
// the book from "level2_batch" (a full snapshot, then changes every 50 ms) and the overview
// from "ticker_batch" (one update per product every 5 s at most, with the 24 h open).
import { allowed, getJson, keyed, memo, num, PAIR, type AdapterDef, type BoardPatch, type Parsed } from "../base";

const REST = "https://api.exchange.coinbase.com";

/** Every product that trades now, for an hour. */
const products = memo(3_600_000, async () => {
  const d = await getJson<{ id: string; status: string; trading_disabled?: boolean }[]>(`${REST}/products`);
  return d.filter((p) => p.status === "online" && !p.trading_disabled && PAIR.test(p.id)).map((p) => p.id);
});

const GRAN: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 };

export const coinbase: AdapterDef = {
  id: "coinbase",
  enabled: (env) => allowed("coinbase", env),
  make: () => {
    let all: string[] = [];
    const msg = (type: string, channel: string, ids: string[]) => (ids.length ? [JSON.stringify({ type, product_ids: ids, channels: [channel] })] : []);
    return {
      id: "coinbase", feed: "rt", internal: true, url: "wss://ws-feed.exchange.coinbase.com", maxUpstream: 60, bookDepth: 400, stallMs: 300_000,
      async prepare() { all = await products(); },
      allows: (s) => (all.length ? all.includes(s) : PAIR.test(s)),
      subscribe: (ss) => msg("subscribe", "matches", ss),
      unsubscribe: (ss) => msg("unsubscribe", "matches", ss),
      book: { subscribe: (ss) => msg("subscribe", "level2_batch", ss), unsubscribe: (ss) => msg("unsubscribe", "level2_batch", ss) },
      board: { subscribe: () => msg("subscribe", "ticker_batch", all), unsubscribe: () => msg("unsubscribe", "ticker_batch", all) },
      parse(data): Parsed {
        let m: Record<string, unknown>;
        try { m = JSON.parse(data); } catch { return {}; }
        const s = typeof m.product_id === "string" ? m.product_id : "";
        switch (m.type) {
          case "match":
            return { t: [{ s, p: num(m.price), v: num(m.size), te: Date.parse(String(m.time)), side: m.side === "sell" ? 1 : m.side === "buy" ? 2 : 0 }] };
          case "snapshot": {
            const lv = (x: unknown) => ((x as [string, string][]) ?? []).slice(0, 400).map((l) => [num(l[0]), num(l[1])] as [number, number]);
            return { b: [{ s, snap: true, bids: lv(m.bids), asks: lv(m.asks), te: Date.now() }] };
          }
          case "l2update": {
            const bids: [number, number][] = [], asks: [number, number][] = [];
            for (const [side, p, q] of (m.changes as [string, string, string][]) ?? []) (side === "buy" ? bids : asks).push([num(p), num(q)]);
            return { b: [{ s, snap: false, bids, asks, te: Date.parse(String(m.time)) }] };
          }
          case "ticker": {
            const p = num(m.price);
            const r: BoardPatch = { s, p, o: num(m.open_24h), v: num(m.volume_24h) * p, te: Date.parse(String(m.time)) || Date.now() };
            return { r: [r] };
          }
          case "error":
            return { fail: String(m.message ?? "error") };
          default:
            return {};
        }
      },
    };
  },
  async history(symbol, tf) {
    if (!GRAN[tf] || !PAIR.test(symbol)) return null;
    const rows = await getJson<[number, number, number, number, number, number][]>(`${REST}/products/${encodeURIComponent(symbol)}/candles?granularity=${GRAN[tf]}`);
    return keyed(rows.map((r) => ({ t: r[0] * 1000, l: r[1], h: r[2], o: r[3], c: r[4], v: r[5] })), tf);
  },
  symbols: () => products(),
};
