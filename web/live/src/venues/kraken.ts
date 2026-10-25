// Kraken (DEC-0053, team only): every online spot pair over WebSocket v2, including its fiat
// pairs (EUR/USD, GBP/USD, USD/JPY...), which the overview labels as FX from a crypto venue.
// Trades, the 25-level book (snapshot then changes, cut to 25 levels as Kraken asks) and the
// overview from the ticker channel. Kraken's REST list still says XBT and XDG; v2 says BTC
// and DOGE, so the names are mapped once.
import { allowed, chunks, getJson, keyed, memo, num, PAIR, type AdapterDef, type BoardPatch, type BookUpdate, type Parsed } from "../base";

const v2 = (x: string) => (x === "XBT" ? "BTC" : x === "XDG" ? "DOGE" : x);
const toWs = (s: string) => s.replace("-", "/");
const toSym = (w: string) => w.replace("/", "-");

/** Every online pair in our form ("BTC-USD"), from Kraken's pair list, for an hour. */
const pairs = memo(3_600_000, async () => {
  const d = await getJson<{ result: Record<string, { wsname?: string; status?: string }> }>("https://api.kraken.com/0/public/AssetPairs");
  const out: string[] = [];
  for (const p of Object.values(d.result ?? {})) {
    if (p.status !== "online" || !p.wsname) continue;
    const [b, q] = p.wsname.split("/");
    const s = `${v2(b)}-${v2(q)}`;
    if (PAIR.test(s)) out.push(s);
  }
  return [...new Set(out)];
});

const MIN: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "1d": 1440 };

export const kraken: AdapterDef = {
  id: "kraken",
  enabled: (env) => allowed("kraken", env),
  make: () => {
    let all: string[] = [];
    const msg = (method: string, channel: string, ss: string[], extra: Record<string, unknown> = {}) =>
      chunks(ss.map(toWs), 100).map((c) => JSON.stringify({ method, params: { channel, symbol: c, ...extra } }));
    return {
      id: "kraken", feed: "rt", internal: true, url: "wss://ws.kraken.com/v2", maxUpstream: 60, bookDepth: 25,
      async prepare() { all = await pairs(); },
      allows: (s) => (all.length ? all.includes(s) : PAIR.test(s)),
      subscribe: (ss) => msg("subscribe", "trade", ss),
      unsubscribe: (ss) => msg("unsubscribe", "trade", ss),
      book: { subscribe: (ss) => msg("subscribe", "book", ss, { depth: 25 }), unsubscribe: (ss) => msg("unsubscribe", "book", ss, { depth: 25 }) },
      board: { subscribe: () => msg("subscribe", "ticker", all), unsubscribe: () => msg("unsubscribe", "ticker", all) },
      parse(data): Parsed {
        let m: { channel?: string; type?: string; data?: unknown[] };
        try { m = JSON.parse(data); } catch { return {}; }
        if (!Array.isArray(m.data)) return {};
        if (m.channel === "trade") {
          return { t: (m.data as { symbol: string; price: number; qty: number; timestamp: string; side: string }[]).map((t) => ({ s: toSym(t.symbol), p: num(t.price), v: num(t.qty), te: Date.parse(t.timestamp), side: t.side === "buy" ? 1 : t.side === "sell" ? 2 : 0 })) };
        }
        if (m.channel === "book") {
          const snap = m.type === "snapshot";
          return { b: (m.data as { symbol: string; bids?: { price: number; qty: number }[]; asks?: { price: number; qty: number }[]; timestamp?: string }[]).map((x): BookUpdate => ({
            s: toSym(x.symbol), snap,
            bids: (x.bids ?? []).map((l) => [num(l.price), num(l.qty)]), asks: (x.asks ?? []).map((l) => [num(l.price), num(l.qty)]),
            te: x.timestamp ? Date.parse(x.timestamp) : Date.now(),
          })) };
        }
        if (m.channel === "ticker") {
          const now = Date.now();
          return { r: (m.data as { symbol: string; last: number; change_pct: number; volume: number; vwap: number }[]).map((x): BoardPatch => ({ s: toSym(x.symbol), p: num(x.last), c: num(x.change_pct), v: num(x.volume) * num(x.vwap), te: now })) };
        }
        return {};
      },
      ping: () => JSON.stringify({ method: "ping" }),
    };
  },
  async history(symbol, tf) {
    if (!MIN[tf] || !PAIR.test(symbol)) return null;
    const d = await getJson<{ error: string[]; result: Record<string, unknown> }>(`https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(toWs(symbol))}&interval=${MIN[tf]}`);
    const rows = Object.entries(d.result ?? {}).find(([k]) => k !== "last")?.[1] as [number, string, string, string, string, string, string, number][] | undefined;
    if (!rows) return null;
    return keyed(rows.map((r) => ({ t: r[0] * 1000, o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[6]) })), tf);
  },
  symbols: () => pairs(),
};
