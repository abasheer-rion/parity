// US stocks and ETFs for the team (DEC-0056), off until the owner sets the keys:
//   Alpaca Market Data: ALPACA_KEY_ID and ALPACA_SECRET_KEY. The free plan streams IEX trades
//     for up to 30 symbols at once; ALPACA_FEED=sip (Algo Trader Plus) streams every exchange.
//     History from its bars endpoint; the overview polls snapshots for the largest names.
//   Finnhub: FINNHUB_TOKEN. Trades over its WebSocket, 50 symbols on the free plan. Finnhub's
//     terms make the free plan personal use only, so the owner needs a business plan or
//     written approval before setting it (docs/guides, data keys).
// Symbols are plain tickers ("AAPL", "BRK.B"); the browser subscribes only to the charts on
// screen, so the plan's symbol limit is the number of stock charts open across the team.
import { allowed, chunks, getJson, keyed, num, TF_MS, type AdapterDef, type AdapterEnv, type BoardPatch, type Parsed, type Trade } from "../base";

export const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;

/** The overview's stock list: the largest US companies and the most traded funds. */
export const TOP_STOCKS = ("SPY QQQ IWM DIA VTI VOO TLT GLD SLV USO HYG LQD EEM EFA XLF XLK XLE XLV XLI XLY XLP XLU XLB XLRE XLC SMH ARKK " +
  "AAPL MSFT NVDA AMZN GOOGL GOOG META AVGO TSLA BRK.B LLY JPM V UNH XOM MA JNJ PG COST HD ORCL ABBV MRK WMT BAC CVX KO NFLX CRM AMD PEP " +
  "TMO ADBE LIN MCD CSCO ACN ABT WFC DHR TXN DIS PM INTU QCOM VZ CAT IBM AMGN NOW GE ISRG UBER PFE SPGI GS CMCSA RTX T NEE AXP HON LOW " +
  "UNP BKNG MS PGR ETN BLK SYK ELV TJX C VRTX SCHW PLTR COIN MSTR HOOD").split(" ");

const alpacaHeaders = (env: AdapterEnv) => ({ "APCA-API-KEY-ID": env.ALPACA_KEY_ID ?? "", "APCA-API-SECRET-KEY": env.ALPACA_SECRET_KEY ?? "" });
const feedOf = (env: AdapterEnv) => (env.ALPACA_FEED === "sip" ? "sip" : "iex");
const DATA = "https://data.alpaca.markets/v2";

/** RFC 3339 with nanoseconds to ms (Date.parse is only sure of three digits). */
const ms = (t: string) => Date.parse(t.replace(/(\.\d{3})\d+/, "$1"));

const ALPACA_TF: Record<string, [string, number]> = { "1m": ["1Min", 5], "5m": ["5Min", 20], "15m": ["15Min", 60], "1h": ["1Hour", 200], "4h": ["4Hour", 700], "1d": ["1Day", 2000] };

export const alpaca: AdapterDef = {
  id: "alpaca",
  enabled: (env) => allowed("alpaca", env),
  make: (env) => {
    const sub = (action: string, ss: string[]) => (ss.length ? [JSON.stringify({ action, trades: ss })] : []);
    return {
      id: "alpaca", feed: "rt", internal: true, url: `wss://stream.data.alpaca.markets/v2/${feedOf(env)}`,
      maxUpstream: feedOf(env) === "sip" ? 200 : 30, stallMs: 600_000, needsReady: true,
      hello: () => [JSON.stringify({ action: "auth", key: env.ALPACA_KEY_ID, secret: env.ALPACA_SECRET_KEY })],
      allows: (s) => TICKER.test(s),
      subscribe: (ss) => sub("subscribe", ss),
      unsubscribe: (ss) => sub("unsubscribe", ss),
      board: {
        poll: {
          every: 10_000,
          async run() {
            const out: BoardPatch[] = [];
            for (const c of chunks(TOP_STOCKS, 100)) {
              const d = await getJson<Record<string, { latestTrade?: { p: number; t: string }; dailyBar?: { c: number; v: number; vw?: number }; prevDailyBar?: { c: number } }>>(
                `${DATA}/stocks/snapshots?symbols=${encodeURIComponent(c.join(","))}&feed=${feedOf(env)}`, { headers: alpacaHeaders(env) });
              for (const [s, x] of Object.entries(d)) {
                const p = x.latestTrade?.p ?? x.dailyBar?.c;
                if (p == null) continue;
                out.push({ s, p, o: x.prevDailyBar?.c, v: x.dailyBar ? x.dailyBar.v * (x.dailyBar.vw ?? x.dailyBar.c) : undefined, te: x.latestTrade ? ms(x.latestTrade.t) : Date.now() });
              }
            }
            return out;
          },
        },
      },
      parse(data): Parsed {
        let m: { T?: string; S?: string; p?: number; s?: number; t?: string; msg?: string; code?: number }[];
        try { m = JSON.parse(data); } catch { return {}; }
        if (!Array.isArray(m)) return {};
        const t: Trade[] = [];
        let ready = false, fail: string | undefined;
        for (const x of m) {
          if (x.T === "t" && x.S && x.t) t.push({ s: x.S, p: num(x.p), v: num(x.s), te: ms(x.t) });
          else if (x.T === "success" && x.msg === "authenticated") ready = true;
          else if (x.T === "error") fail = `Alpaca ${x.code ?? ""} ${x.msg ?? ""}`.trim();
        }
        return { t, ...(ready ? { ready } : {}), ...(fail ? { fail } : {}) };
      },
    };
  },
  async history(symbol, tf, env) {
    const spec = ALPACA_TF[tf];
    if (!spec || !TICKER.test(symbol)) return null;
    const start = new Date(Date.now() - spec[1] * 86_400_000).toISOString();
    const d = await getJson<{ bars?: { t: string; o: number; h: number; l: number; c: number; v: number }[] }>(
      `${DATA}/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${spec[0]}&start=${start}&limit=1000&sort=desc&adjustment=split&feed=${feedOf(env)}`, { headers: alpacaHeaders(env) });
    return keyed((d.bars ?? []).map((b) => ({ t: ms(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })), tf);
  },
};

export const finnhub: AdapterDef = {
  id: "finnhub",
  enabled: (env) => allowed("finnhub", env),
  make: (env) => ({
    id: "finnhub", feed: "rt", internal: true, url: `wss://ws.finnhub.io?token=${encodeURIComponent(env.FINNHUB_TOKEN ?? "")}`, maxUpstream: 50, stallMs: 600_000,
    allows: (s) => TICKER.test(s),
    subscribe: (ss) => ss.map((symbol) => JSON.stringify({ type: "subscribe", symbol })),
    unsubscribe: (ss) => ss.map((symbol) => JSON.stringify({ type: "unsubscribe", symbol })),
    parse(data): Parsed {
      let m: { type?: string; data?: { s: string; p: number; t: number; v: number }[]; msg?: string };
      try { m = JSON.parse(data); } catch { return {}; }
      if (m.type === "trade" && Array.isArray(m.data)) return { t: m.data.map((x) => ({ s: x.s, p: num(x.p), v: num(x.v), te: num(x.t) })) };
      if (m.type === "error") return { fail: `Finnhub: ${m.msg ?? "error"}` };
      return {};
    },
  }),
  // Finnhub's candles are not on the free plan: a chart starts empty and fills from trades.
  history: async (_s, tf) => (TF_MS[tf] ? [] : null),
};
