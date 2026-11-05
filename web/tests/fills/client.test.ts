// The browser side of the fill price check (DEC-0092): what is sent (symbol, time and price
// only), sending again what the server had no time for, the card 4 rows it gives, and how a
// faked record and a genuine one come out of the whole check.
import { beforeEach, describe, expect, it } from "vitest";
import { planFills, runFills, type RangeOutcome } from "../../src/lib/verify/range/client";
import { notRunRows, rangeRows } from "../../src/lib/verify/range/rows";
import { handleFills } from "../../src/lib/verify/range/server";
import { memoryCache, resetPacing } from "../../src/lib/verify/range/load";
import { memoryFillQuota } from "../../src/lib/verify/range/quota";
import { FILL_SOURCES } from "../../src/lib/verify/range/registry";
import { checkFile } from "../../src/lib/verify/checks";
import type { Parsed, Trade } from "../../src/lib/verify/types";
import { marketFetch, PATH } from "./market";

const NOW = Date.parse("2026-03-20T12:00:00Z");
const at = (iso: string) => Date.parse(`${iso}Z`);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Pages Function in this process: what the page sends goes through the real handler. */
function server(over: { maxCalls?: number } = {}) {
  const sent: string[] = [];
  const m = marketFetch();
  const cache = memoryCache();
  const f = (async (_u: RequestInfo | URL, init?: RequestInit) => {
    sent.push(String(init?.body));
    const req = new Request("https://paritytrading.app/api/verify/fills", { method: "POST", headers: { Origin: "https://paritytrading.app", Authorization: String((init?.headers as Record<string, string>).Authorization), "CF-Connecting-IP": "10.1.1.1" }, body: init?.body as string });
    const deps = { env: { FILL_CHECK_STOCKS: "on", ALPACA_KEY_ID: "k", ALPACA_SECRET_KEY: "s" }, verify: async () => ({ userId: "u", clientId: null }), quota: memoryFillQuota(), sources: FILL_SOURCES, cache, fetch: m.fetch, siteDomain: "paritytrading.app", now: () => NOW, sleep: async () => undefined };
    if (over.maxCalls) {
      const { checkFills, readBody } = await import("../../src/lib/verify/range/server");
      const b = readBody(String(init?.body));
      return new Response(JSON.stringify(await checkFills(b.clock, b.fills, deps, NOW, {}, over.maxCalls)), { status: 200 });
    }
    return handleFills(req, deps);
  }) as typeof fetch;
  return { fetch: f, sent, market: m };
}

/** A day of round trips in AAPL and ETH at the paths' real prices, or with made-up prices. */
function record(fake: boolean): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < 40; i++) {
    // Ten trades a day, half an hour apart, none open at the same time.
    const day = `2026-03-${String(2 + Math.floor(i / 10)).padStart(2, "0")}`;
    const start = at(`${day}T14:40:00`) + (i % 10) * 30 * 60_000;
    const open = new Date(start).toISOString().slice(0, 19), close = new Date(start + 20 * 60_000).toISOString().slice(0, 19);
    const sym = i % 2 ? "AAPL" : "ETHUSDT";
    const path = i % 2 ? PATH.AAPL : PATH["ETH-USD"];
    // A faked file: entries bought well under anything traded that day, exits sold above.
    const entry = r2(path(at(open)) * (fake && i % 3 === 0 ? 0.95 : 1));
    const exit = r2(path(at(close)) * (fake && i % 3 === 0 ? 1.05 : 1));
    out.push({ openTime: open, closeTime: close, symbol: sym, side: "buy", size: 1, entry, exit, fees: 0, pnl: exit - entry });
  }
  return out;
}

const parsedOf = (trades: Trade[]): Parsed => ({ format: "trades", table: { headers: ["close time (UTC)"], rows: [] }, mapping: { closeTime: 0 }, dropped: [], trades, warnings: [], backtestExport: false });

beforeEach(() => resetPacing());

describe("what leaves the browser", () => {
  it("sends one point per fill: symbol, time and price, and leaves out averaged entries", () => {
    const trades: Trade[] = [
      { openTime: "2026-03-03T15:00:00", closeTime: "2026-03-03T16:00:00", symbol: "AAPL", side: "buy", entry: 200, exit: 201, fees: 1, pnl: 0, size: 3, id: "T-1" },
      { openTime: "2026-03-03T15:00:00", closeTime: "2026-03-03T16:30:00", symbol: "AAPL", side: "buy", entry: 200, exit: 202, fees: 1, pnl: 1, size: 3 },
      { openTime: "2026-03-03T15:05:00", closeTime: "2026-03-03T16:30:00", symbol: "BTCUSDT", side: "buy", entry: 80000, exit: 80100, fees: 1, pnl: 1, entryMixed: true },
      { closeTime: "2026-03-03T16:30:00", symbol: "US500", exit: 5000, fees: 0, pnl: 1 },
    ];
    const p = planFills(trades, "trades", "utc");
    expect(p.points.map(({ s, t, p: price }) => `${s} ${t} ${price}`)).toEqual([
      "AAPL 2026-03-03T15:00:00 200", "AAPL 2026-03-03T16:00:00 201", "AAPL 2026-03-03T16:30:00 202", "BTC-USDT 2026-03-03T16:30:00 80100",
    ]);
    expect(p.points[0].legs).toEqual([{ trade: 0, leg: "entry" }, { trade: 1, leg: "entry" }]);
    expect(p.skipped).toBe(1);
    // A file with dates only sends dates only.
    expect(planFills([{ closeTime: "2026-03-03T00:00:00", symbol: "AAPL", exit: 200, fees: 0, pnl: 0 }]).points[0].t).toBe("2026-03-03");
  });

  it("sends only fills a source covers: no currency pairs, no coin without a pool, no stocks while switched off", () => {
    const trades: Trade[] = [
      { closeTime: "2026-03-03T16:00:00", symbol: "EURUSD", exit: 1.08, fees: 0, pnl: 0 },
      { closeTime: "2026-03-03T16:00:00", symbol: "DOGEUSDT", exit: 0.1, fees: 0, pnl: 0 },
      { closeTime: "2026-03-03T16:00:00", symbol: "BTCUSDT", exit: 80000, fees: 0, pnl: 0 },
      { closeTime: "2026-03-03T16:00:00", symbol: "AAPL", exit: 200, fees: 0, pnl: 0 },
    ];
    const p = planFills(trades, "trades", "utc", { markets: ["crypto"], coins: ["BTC", "ETH"] });
    expect(p.points.map((x) => x.s)).toEqual(["BTC-USDT"]);
    expect(p.uncovered).toEqual({ EURUSD: 1, DOGEUSDT: 1, AAPL: 1 });
    const rows = rangeRows({ ran: true, clock: "utc", offset: null, skipped: 0, unsupported: [], uncovered: p.uncovered, points: p.points, answers: [{ r: "in", b: "m", src: "onchain-base" }] }, trades);
    expect(rows.range.detail).toMatch(/3 fills were not checked: no data source we may use covers EURUSD, DOGEUSDT, AAPL\./);
  });

  it("sends nothing but the clock and the three fields per fill", async () => {
    const s = server();
    await runFills(planFills(record(false), "trades", "utc"), { token: "t", fetch: s.fetch });
    for (const body of s.sent) {
      const b = JSON.parse(body) as { clock: string; fills: Record<string, unknown>[] };
      expect(Object.keys(b).sort()).toEqual(["clock", "fills"]);
      for (const f of b.fills) expect(Object.keys(f).sort()).toEqual(["p", "s", "t"]);
      expect(body).not.toMatch(/pnl|fees|size|side|"id"/);
    }
  });

  it("sends again what the server had no time for, until every fill has an answer", async () => {
    const s = server({ maxCalls: 10 });
    const done: number[] = [];
    const o = await runFills(planFills(record(false), "trades", "utc"), { token: "t", fetch: s.fetch, onProgress: (d) => done.push(d) });
    expect(s.sent.length).toBeGreaterThan(1);
    expect(o.ran && o.answers.every((a) => a.n !== "more")).toBe(true);
    expect(done[done.length - 1]).toBe(o.ran ? o.points.length : -1);
  });

  it("gives up plainly when the server cannot be reached", async () => {
    const down = (async () => new Response(JSON.stringify({ error: "The fill price check could not run just now. Try again in a minute.", code: "unavailable" }), { status: 503 })) as typeof fetch;
    await expect(runFills(planFills(record(false), "trades", "utc"), { token: "t", fetch: down })).rejects.toThrow(/Try again/);
  });
});

describe("card 4 and the verdict", () => {
  it("passes a genuine record, every fill inside the traded range", async () => {
    const trades = record(false);
    const o = await runFills(planFills(trades, "trades", "utc"), { token: "t", fetch: server().fetch });
    const rows = rangeRows(o as Extract<RangeOutcome, { ran: true }>, trades);
    expect(rows.range.status).toBe("pass");
    expect(rows.range.detail).toMatch(/^All 80 fills we could check sit inside the range traded at that time on our data source\./);
    expect(rows.session.status).toBe("pass");
  });

  it("fails a faked record, and says so without accusing anyone", async () => {
    const trades = record(true);
    const o = await runFills(planFills(trades, "trades", "utc"), { token: "t", fetch: server().fetch });
    const r = checkFile({ parsed: parsedOf(trades), answers: { kind: "real", balance: 10_000, tries: 1, claim: {} }, prices: null, ranges: o });
    const range = r.card4.find((c) => c.id === "range")!;
    expect(range.status).toBe("fail");
    expect(range.detail).toMatch(/^28 of 80 fills fall outside the traded range on our data source, for example /);
    expect(range.detail).not.toMatch(/fake|fraud|forged|lie/i);
    expect(r.verdict.id).not.toBe("holds_up");
    expect(r.verdict.sentence).toMatch(/fill prices against the traded range/);
  });

  it("does not fail on one stray fill, and names it", () => {
    const trades = record(false).slice(0, 2);
    const o: RangeOutcome = {
      ran: true, clock: "utc", offset: null, skipped: 0, unsupported: [], uncovered: {},
      points: [{ s: "AAPL", t: "2026-03-03T15:00:00", p: 1, legs: [{ trade: 1, leg: "entry" }] }, ...Array.from({ length: 60 }, (_, i) => ({ s: "AAPL", t: `2026-03-03T15:${String(i).padStart(2, "0")}:30`, p: 200, legs: [{ trade: 1, leg: "exit" as const }] }))],
      answers: [{ r: "out", b: "m", src: "alpaca-iex" }, ...Array.from({ length: 60 }, () => ({ r: "in" as const, b: "m" as const, src: "alpaca-iex" }))],
    };
    const rows = rangeRows(o, trades);
    expect(rows.range.status).toBe("pass");
    expect(rows.range.detail).toMatch(/^1 of 61 fills falls outside the traded range on our data source \(AAPL at 1 on 2026-03-03 15:00\)\. One or two can come from/);
    expect(rows.range.detail).toMatch(/Compared with trades on the IEX exchange/);
  });

  it("flags entries at the day's best price as perfect timing", () => {
    const trades: Trade[] = Array.from({ length: 12 }, (_, i) => ({ openTime: `2026-03-03T15:${String(i).padStart(2, "0")}:00`, closeTime: "2026-03-03T19:00:00", symbol: "AAPL", side: "buy" as const, entry: 100 + i, exit: 120, fees: 0, pnl: 1 }));
    const o: RangeOutcome = {
      ran: true, clock: "utc", offset: null, skipped: 0, unsupported: [], uncovered: {},
      points: trades.map((t, i) => ({ s: "AAPL", t: t.openTime!, p: t.entry!, legs: [{ trade: i, leg: "entry" as const }] })),
      answers: trades.map((_, i) => ({ r: "in" as const, b: "m" as const, src: "alpaca-iex", e: i < 6 ? "l" as const : "n" as const })),
    };
    const t = rangeRows(o, trades).timing!;
    expect(t.status).toBe("fail");
    expect(t.detail).toMatch(/^50% of 12 entries are at the day's best price on our data source/);
  });

  it("says plainly when it was not run, and why", () => {
    expect(notRunRows({ ran: false, why: "opted_out" })[0].detail).toMatch(/you chose to keep every part of the file in this browser/);
    expect(notRunRows({ ran: false, why: "signed_out" })[0].detail).toMatch(/^Not checked while signed out/);
    const r = checkFile({ parsed: parsedOf(record(false)), answers: { kind: "real", balance: 10_000, tries: 1, claim: {} }, prices: null, ranges: { ran: false, why: "opted_out" } });
    expect(r.card4.map((c) => c.id)).toEqual(["fills", "range", "session", "timing", "smooth", "edited", "label", "cut"]);
    expect(r.card4.find((c) => c.id === "range")!.status).toBe("na");
  });
});
