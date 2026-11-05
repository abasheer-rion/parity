// A made-up market for the fill price check's tests (DEC-0092). The answers have exactly the
// shape the live sources gave on 4 November 2026 (Alpaca's IEX bars, a Base node's swap logs;
// samples in tests/fixtures/fills), but every price comes from the smooth paths below, never
// from real market data: real bars are used on our server only and are never put in the repo.
// Any time can be asked for, so the server's slicing, caching and budget are all exercised.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { basePools, BASE_GENESIS, type Pool } from "../../src/lib/verify/range/onchain";
import { nyClock } from "../../src/lib/verify/range/clock";

export const fxFile = (name: string) => readFileSync(resolve(import.meta.dirname, "../fixtures/fills", name), "utf8");

const TAU = 2 * Math.PI, H = 3_600_000, MIN = 60_000;
/** Price paths, in dollars, at a moment (ms). */
export const PATH: Record<string, (t: number) => number> = {
  AAPL: (t) => 200 * (1 + 0.01 * Math.sin(TAU * t / (4 * H)) + 0.002 * Math.sin(TAU * t / (6 * MIN))),
  SPY: (t) => 500 * (1 + 0.006 * Math.sin(TAU * t / (5 * H)) + 0.001 * Math.sin(TAU * t / (7 * MIN))),
  "ETH-USD": (t) => 2000 * (1 + 0.02 * Math.sin(TAU * t / (6 * H)) + 0.003 * Math.sin(TAU * t / (7 * MIN))),
  "BTC-USD": (t) => 80000 * (1 + 0.015 * Math.sin(TAU * t / (5 * H) + 1) + 0.002 * Math.sin(TAU * t / (9 * MIN))),
};

/** US market holidays in the test period. */
export const HOLIDAYS = new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"]);
const tradingDay = (d: string) => { const wd = new Date(`${d}T12:00:00Z`).getUTCDay(); return wd !== 0 && wd !== 6 && !HOLIDAYS.has(d); };

const range = (f: (t: number) => number, from: number, to: number, step: number): [number, number] => {
  let lo = Infinity, hi = -Infinity;
  for (let t = from; t <= to; t += step) { const v = f(t); if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
};
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** The day's regular session (9:30 a.m. to 4 p.m. New York) as UTC ms. */
function session(date: string): [number, number] {
  // New York is UTC-5 or UTC-4: find 9:30 by stepping.
  let t = Date.parse(`${date}T12:00:00Z`);
  while (nyClock(t).minute !== 9 * 60 + 30) t += MIN * (nyClock(t).minute < 9 * 60 + 30 ? 1 : -1);
  return [t, t + 390 * MIN];
}

/** Alpaca's /v2/stocks/{symbol}/bars, IEX feed, from the paths. */
export function alpacaBars(url: string): Response {
  const u = new URL(url);
  const sym = decodeURIComponent(u.pathname.split("/")[3]);
  const f = PATH[sym];
  const tf = u.searchParams.get("timeframe");
  if (u.searchParams.get("feed") !== "iex") return new Response(JSON.stringify({ message: "subscription does not permit querying recent SIP data" }), { status: 403 });
  if (!f) return new Response(JSON.stringify({ bars: null, next_page_token: null, symbol: sym }), { headers: { "Content-Type": "application/json" } });
  const bars: Record<string, unknown>[] = [];
  const bar = (t: number, lo: number, hi: number) => ({ c: r4((lo + hi) / 2), h: r4(hi), l: r4(lo), n: 12, o: r4((lo + hi) / 2), t: new Date(t).toISOString().replace(".000Z", "Z"), v: 900, vw: r4((lo + hi) / 2) });
  if (tf === "1Min") {
    const from = Date.parse(u.searchParams.get("start")!), to = Date.parse(u.searchParams.get("end")!);
    for (let t = from; t < to; t += MIN) {
      const c = nyClock(t);
      // IEX trades from 8 a.m. to 4 p.m. New York, and not in every minute.
      if (!tradingDay(c.date) || c.minute < 8 * 60 || c.minute >= 16 * 60 || Math.floor(t / MIN) % 5 === 2) continue;
      const [lo, hi] = range(f, t, t + MIN, 15_000);
      bars.push(bar(t, lo, hi));
    }
  } else if (tf === "1Day") {
    const from = u.searchParams.get("start")!.slice(0, 10), to = u.searchParams.get("end")!.slice(0, 10);
    for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      if (!tradingDay(d)) continue;
      const [a, b] = session(d);
      const [lo, hi] = range(f, a, b, 15_000);
      // Midnight in New York, as Alpaca writes a day bar's time.
      bars.push(bar(a - (9 * 60 + 30) * MIN, lo, hi));
    }
  }
  return new Response(JSON.stringify({ bars, next_page_token: null, symbol: sym }), { headers: { "Content-Type": "application/json" } });
}

const POOLS = new Map<string, { sym: string; pool: Pool }>();
for (const sym of ["ETH-USD", "BTC-USD"]) for (const pool of basePools(sym)) POOLS.set(pool.address, { sym, pool });
const word = (v: bigint) => (v < 0n ? (1n << 256n) + v : v).toString(16).padStart(64, "0");

/** A swap's data field for a pool at a dollar price: amounts, sqrtPriceX96, liquidity, tick. */
export function swapData(pool: Pool, usd: number, ethUsd: number): string {
  const quotePerBase = pool.usd ? usd : usd / ethUsd;
  const v = pool.baseIs0 ? quotePerBase : 1 / quotePerBase;
  const sqrt = BigInt(Math.round(Math.sqrt(v / pool.scale) * 2 ** 96));
  return `0x${word(-1000n)}${word(2000n)}${word(sqrt)}${word(10n ** 18n)}${word(0n)}`;
}

/** A Base node's eth_getLogs: one swap every 12 seconds in each pool asked for. */
export function baseLogs(body: string, opts: { maxBlocks?: number } = {}): Response {
  const req = JSON.parse(body) as { params: { address: string[]; fromBlock: string; toBlock: string }[] };
  const q = req.params[0];
  const from = parseInt(q.fromBlock, 16), to = parseInt(q.toBlock, 16);
  if (opts.maxBlocks && to - from > opts.maxBlocks) return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "invalid params" } }), { headers: { "Content-Type": "application/json" } });
  const result: Record<string, unknown>[] = [];
  for (let b = Math.ceil(from / 6) * 6; b <= to; b += 6) {
    const t = (BASE_GENESIS + b * 2) * 1000;
    for (const a of q.address) {
      const p = POOLS.get(a.toLowerCase());
      if (!p) continue;
      result.push({
        address: a, topics: ["0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"], data: swapData(p.pool, PATH[p.sym](t), PATH["ETH-USD"](t)),
        blockHash: `0x${"ab".repeat(32)}`, blockNumber: `0x${b.toString(16)}`, blockTimestamp: `0x${(t / 1000).toString(16)}`,
        transactionHash: `0x${"cd".repeat(32)}`, transactionIndex: "0x1", logIndex: "0x0", removed: false,
      });
    }
  }
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "Content-Type": "application/json" } });
}

export interface MarketFetch { fetch: typeof fetch; calls: { url: string; body: string }[] }

/** A fetch for the server: Alpaca and Base from the paths; anything else fails the test. */
export function marketFetch(opts: { alpaca?: (url: string) => Response | null; base?: (body: string) => Response | null } = {}): MarketFetch {
  const calls: { url: string; body: string }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, body });
    if (url.startsWith("https://data.alpaca.markets/")) return opts.alpaca?.(url) ?? alpacaBars(url);
    if (/base-rpc\.publicnode\.com/.test(url)) return opts.base?.(body) ?? baseLogs(body);
    return new Response("not in the test market", { status: 599 });
  }) as typeof fetch;
  return { fetch: f, calls };
}

