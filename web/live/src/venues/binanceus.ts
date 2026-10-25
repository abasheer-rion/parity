// Binance.US (DEC-0053, team only): every trading pair over its combined stream on port 443.
// Trades ("@trade"; m=true means the buyer was the maker, so the taker sold), the top 20
// levels ten times a second ("@depth20@100ms", full snapshots) and the overview from the
// all-market mini ticker, one message a second for every pair that changed.
import { allowed, BARS, getJson, keyed, memo, num, pairOf, PAIR, type AdapterDef, type BoardPatch, type Parsed } from "../base";

const REST = "https://api.binance.us";

/** Venue name to our symbol and back ("BTCUSDT" and "BTC-USDT"), for an hour. */
const info = memo(3_600_000, async () => {
  const d = await getJson<{ symbols: { symbol: string; status: string; baseAsset: string; quoteAsset: string }[] }>(`${REST}/api/v3/exchangeInfo`);
  const toSym = new Map<string, string>(), toRaw = new Map<string, string>();
  for (const x of d.symbols) {
    if (x.status !== "TRADING") continue;
    const s = pairOf(x.baseAsset, x.quoteAsset);
    if (!PAIR.test(s)) continue;
    toSym.set(x.symbol, s); toRaw.set(s, x.symbol);
  }
  return { toSym, toRaw };
});

export const binanceus: AdapterDef = {
  id: "binanceus",
  enabled: (env) => allowed("binanceus", env),
  make: () => {
    let maps = { toSym: new Map<string, string>(), toRaw: new Map<string, string>() };
    let id = 0;
    const streams = (ss: string[], suffix: string) => ss.flatMap((s) => { const r = maps.toRaw.get(s); return r ? [`${r.toLowerCase()}${suffix}`] : []; });
    const msg = (method: string, params: string[]) => (params.length ? [JSON.stringify({ method, params, id: ++id })] : []);
    return {
      id: "binanceus", feed: "rt", internal: true, url: "wss://stream.binance.us:443/stream", maxUpstream: 60, bookDepth: 20, stallMs: 300_000,
      async prepare() { maps = await info(); },
      allows: (s) => (maps.toRaw.size ? maps.toRaw.has(s) : PAIR.test(s)),
      subscribe: (ss) => msg("SUBSCRIBE", streams(ss, "@trade")),
      unsubscribe: (ss) => msg("UNSUBSCRIBE", streams(ss, "@trade")),
      book: { subscribe: (ss) => msg("SUBSCRIBE", streams(ss, "@depth20@100ms")), unsubscribe: (ss) => msg("UNSUBSCRIBE", streams(ss, "@depth20@100ms")) },
      board: { subscribe: () => msg("SUBSCRIBE", ["!miniTicker@arr"]), unsubscribe: () => msg("UNSUBSCRIBE", ["!miniTicker@arr"]) },
      parse(data): Parsed {
        let m: { stream?: string; data?: unknown };
        try { m = JSON.parse(data); } catch { return {}; }
        if (!m.stream || !m.data) return {};
        if (m.stream === "!miniTicker@arr" && Array.isArray(m.data)) {
          return { r: (m.data as { s: string; c: string; o: string; q: string; E: number }[]).flatMap((x): BoardPatch[] => { const s = maps.toSym.get(x.s); return s ? [{ s, p: num(x.c), o: num(x.o), v: num(x.q), te: num(x.E) }] : []; }) };
        }
        const raw = m.stream.split("@")[0].toUpperCase();
        const s = maps.toSym.get(raw);
        if (!s) return {};
        if (m.stream.endsWith("@trade")) {
          const t = m.data as { p: string; q: string; T: number; m: boolean };
          return { t: [{ s, p: num(t.p), v: num(t.q), te: num(t.T), side: t.m ? 2 : 1 }] };
        }
        if (m.stream.includes("@depth")) {
          const d = m.data as { bids: [string, string][]; asks: [string, string][] };
          const lv = (x: [string, string][]) => (x ?? []).map((l) => [num(l[0]), num(l[1])] as [number, number]);
          return { b: [{ s, snap: true, bids: lv(d.bids), asks: lv(d.asks), te: Date.now() }] };
        }
        return {};
      },
    };
  },
  async history(symbol, tf) {
    const raw = (await info()).toRaw.get(symbol);
    if (!raw || !["1m", "5m", "15m", "1h", "4h", "1d"].includes(tf)) return null;
    const rows = await getJson<[number, string, string, string, string, string][]>(`${REST}/api/v3/klines?symbol=${raw}&interval=${tf}&limit=${BARS}`);
    return keyed(rows.map((r) => ({ t: r[0], o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) })), tf);
  },
  symbols: async () => [...(await info()).toRaw.keys()],
};
