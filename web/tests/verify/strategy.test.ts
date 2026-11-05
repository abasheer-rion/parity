// Verify a strategy from its code (DEC-0083): Pine Script and Python are read into Parity's
// rule format, anything that cannot run is named with its line, the rules run on daily closes
// with costs, nearby settings are run too, and the record goes through the five cards. The
// prices in tests/fixtures/verify/strategy/prices.json are made up (make-prices.mjs).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBacktest } from "../../src/lib/verify/checks";
import { priceBook } from "../../src/lib/verify/prices";
import { finishRead, liftLengths, readPlainReply, readStrategy, runRules, runStrategy, sweepGrid, validateRules, RulesError, ScriptError, type Prices, type Rules } from "../../src/lib/verify/strategy";
import * as ta from "../../src/lib/verify/strategy/series";

const dir = join(import.meta.dirname, "../fixtures/verify/strategy");
const code = (f: string) => readFileSync(join(dir, "code", f), "utf8");
const book = priceBook(JSON.parse(readFileSync(join(dir, "prices.json"), "utf8")));
const s = (xs: number[]) => Float64Array.from(xs);
const r2 = (v: number) => Math.round(v * 100) / 100;

describe("indicators give the same numbers as Pine Script", () => {
  // Wilder's 14-day RSI on the closes of StockCharts' worked example. The first value by hand:
  // average gain 3.34 / 14, average loss 1.40 / 14, so RSI = 100 - 100 / (1 + 2.3857) = 70.46.
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  it("RSI is Wilder's, worked out by hand for the first value", () => {
    const r = ta.rsi(s(closes), 14);
    expect(Number.isNaN(r[13])).toBe(true);
    expect([r[14], r[15], r[16], r[17], r[18], r[19]].map(r2)).toEqual([70.46, 66.25, 66.48, 69.35, 66.29, 57.92]);
  });
  it("SMA and EMA: missing until enough days, then the average; EMA starts from the SMA", () => {
    const x = s([1, 2, 3, 4, 5, 6]);
    expect([...ta.sma(x, 3)].map((v) => (Number.isNaN(v) ? null : v))).toEqual([null, null, 2, 3, 4, 5]);
    const e = ta.ema(x, 3);
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(0.5 * 4 + 0.5 * 2, 12);
    expect(ta.rma(x, 3)[3]).toBeCloseTo(4 / 3 + (2 / 3) * 2, 12);
  });
  it("standard deviation is the population one, as Pine's default", () => {
    expect(ta.stdev(s([2, 4, 4, 4, 5, 5, 7, 9]), 8)[7]).toBeCloseTo(2, 12);
  });
  it("MACD and Bollinger bands", () => {
    const x = s(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1));
    const m = ta.macd(x, 12, 26), sig = ta.macdSignal(x, 12, 26, 9), h = ta.macdHist(x, 12, 26, 9);
    expect(h[50]).toBeCloseTo(m[50] - sig[50], 12);
    const up = ta.bb(x, 20, 2, true), mid = ta.sma(x, 20), sd = ta.stdev(x, 20);
    expect(up[40]).toBeCloseTo(mid[40] + 2 * sd[40], 12);
  });
});

describe("Pine Script is read into rules", () => {
  it("a moving-average cross: inputs, values, entry and exit, the script's settings", () => {
    const r = readStrategy({ code: code("sma-cross.pine"), market: "BTCUSD" });
    expect(r.language).toBe("pine");
    expect(r.name).toBe("SMA cross");
    expect(r.capital).toBe(10000);
    expect(r.blocking).toEqual([]);
    expect(r.rules).toMatchObject({
      market: "BTCUSD", inputs: { fastLength: 10, slowLength: 30 }, cost: 0.001,
      let: { fastMA: ["sma", "close", "fastLength"], slowMA: ["sma", "close", "slowLength"], longCondition: ["crossover", "fastMA", "slowMA"], shortCondition: ["crossunder", "fastMA", "slowMA"] },
      long: { entry: "longCondition", exit: "shortCondition" },
    });
    expect(r.rules!.short).toBeUndefined();
    expect(r.ignored.map((x) => [x.what, x.line])).toEqual([["plot", 18]]);
  });

  it("stops and targets set with the entry are fixed at the entry price", () => {
    const r = readStrategy({ code: code("rsi-stops.pine"), market: "BTCUSD" });
    expect(r.blocking).toEqual([]);
    expect(r.rules!.long).toEqual({
      entry: ["and", ["crossover", "r", "oversold"], "trend"],
      exit: ["crossunder", "r", "overbought"],
      stop: ["*", "entry_price", ["-", 1, "stopPct"]],
      limit: ["*", "entry_price", ["+", 1, "targetPct"]],
    });
    // The 200 written into ta.ema is a setting too.
    expect(r.rules!.inputs).toEqual({ len: 14, oversold: 30, stop: 5, target: 10, overbought: 70, ema_length: 200 });
    expect(r.rules!.size).toBe(0.5);
  });

  it("tuples from ta.macd and ta.bb, shorts, and exits inside position checks", () => {
    const r = readStrategy({ code: code("macd-long-short.pine"), market: "EURUSD" });
    expect(r.blocking).toEqual([]);
    expect(r.rules!.let.signalLine).toEqual(["macd_signal", "close", "macd_fast", "macd_slow", "macd_signal"]);
    expect(r.rules!.short).toEqual({ entry: ["and", ["crossunder", "macdLine", "signalLine"], ["<", "close", "basis"]], stop: ["*", "entry_price", 1.07] });
    // The bands are never used by an order, so they are dropped and not swept.
    expect(r.rules!.let.upper).toBeUndefined();
  });

  it("names every part it cannot run, with its line, and runs nothing", () => {
    const r = readStrategy({ code: code("unsupported.pine"), market: "BTCUSD" });
    expect(r.rules).toBeNull();
    expect(r.blocking.map((b) => [b.what, b.line])).toEqual([["request.security", 5], ["high", 8], ["strategy.exit(trail_points=)", 11], ["strategy.exit(trail_offset=)", 11]]);
    expect(r.blocking[1].why).toContain("one closing price a day");
    // Values no order uses are listed as left out, also by line.
    expect(r.ignored.map((x) => x.what)).toEqual(expect.arrayContaining(["ta.atr", "trail :="]));
  });

  it("an indicator is not a strategy", () => {
    const r = readStrategy({ code: '//@version=5\nindicator("My RSI")\nplot(ta.rsi(close, 14))', market: "BTCUSD" });
    expect(r.rules).toBeNull();
    expect(r.blocking[0].why).toContain("this is an indicator, not a strategy");
  });

  it("v4 names, when=, close_all, ticks, the remainder sign and := are handled or named", () => {
    const v4 = readStrategy({ code: `//@version=4
strategy("v4", overlay=true)
len = input(20)
m = sma(close, len)
strategy.entry("L", strategy.long, when=crossover(close, m))
strategy.close_all(when=crossunder(close, m))
strategy.exit("x", "L", loss=500, profit=1000)`, market: "EURUSD" });
    expect(v4.blocking).toEqual([]);
    expect(v4.rules!.long).toEqual({
      entry: ["crossover", "close", "m"], exit: ["crossunder", "close", "m"],
      stop: ["-", "entry_price", ["*", 1, ["*", 500, 0.00001]]], limit: ["+", "entry_price", ["*", 1, ["*", 1000, 0.00001]]],
    });
    const bad = readStrategy({ code: `//@version=5
strategy("x")
var float n = 0
n := n + 1
if n % 2 == 0
    strategy.entry("L", strategy.long)`, market: "EURUSD" });
    expect(bad.blocking.map((b) => b.what)).toEqual(["n :=", "%"]);
  });

  it("a syntax mistake says the line", () => {
    expect(() => readStrategy({ code: '//@version=5\nstrategy("x")\nfast = ta.sma(close, 10\nslow = 2', market: "BTCUSD" })).toThrow(ScriptError);
    try { readStrategy({ code: 'strategy("x")\nx = "open', market: "BTCUSD" }); } catch (e) { expect((e as Error).message).toMatch(/^Line 2: /); }
  });
});

describe("Python is read into rules", () => {
  it("pandas columns: the signal column, its one-day shift and the lines that only load or print", () => {
    const r = readStrategy({ code: code("sma-cross-pandas.py"), market: "BTCUSD" });
    expect(r.language).toBe("python");
    expect(r.blocking).toEqual([]);
    expect(r.rules).toMatchObject({
      inputs: { FAST: 20, SLOW: 50 },
      let: { fast: ["sma", "close", "FAST"], slow: ["sma", "close", "SLOW"], signal: ["if", [">", "fast", "slow"], 1, 0] },
      long: { entry: [">", "signal", 0], exit: ["<=", "signal", 0] },
    });
    expect(r.rules!.short).toBeUndefined();
    expect(r.notes.join(" ")).toContain("moved one day later");
    expect(r.ignored.map((x) => [x.what, x.line])).toEqual([["yf.download()", 8], ["print", 15]]);
  });

  it("backtesting.py: settings, indicators from init(), orders and a stop from next()", () => {
    const r = readStrategy({ code: code("sma-cross-backtesting.py"), market: "BTCUSD" });
    expect(r.blocking).toEqual([]);
    expect(r.name).toBe("TwoAverages");
    expect(r.capital).toBe(25000);
    expect(r.rules).toMatchObject({
      inputs: { fast: 15, slow: 40, stop: 0.08 }, cost: 0.001,
      let: { fast_ma: ["sma", "close", "fast"], slow_ma: ["sma", "close", "slow"] },
      long: { entry: ["crossover", "fast_ma", "slow_ma"], stop: ["*", "entry_price", ["-", 1, "stop"]] },
      short: { entry: ["and", ["not", ["crossover", "fast_ma", "slow_ma"]], ["crossover", "slow_ma", "fast_ma"]] },
    });
  });

  it("reading tomorrow's price is refused as peeking", () => {
    const r = readStrategy({ code: code("peeking.py"), market: "SPX" });
    expect(r.rules).toBeNull();
    expect(r.blocking).toEqual([{ what: "shift(-1)", line: 3, why: expect.stringContaining("reads prices from the future") }]);
  });

  it("a loop that builds the signal, and the high column, are named", () => {
    const r = readStrategy({ code: `import pandas as pd
df = pd.read_csv("x.csv")
df["signal"] = 0
for i in range(1, len(df)):
    if df["close"][i] > df["close"][i - 1]:
        df.loc[i, "signal"] = 1
df["range"] = df["high"] - df["low"]`, market: "SPX" });
    expect(r.rules).toBeNull();
    expect(r.blocking[0]).toMatchObject({ what: "for", line: 4 });
    expect(r.ignored.some((x) => x.what === "'high'" && x.line === 7)).toBe(true);
  });

  it("vectorbt entries and exits with a stop", () => {
    const r = readStrategy({ code: `import vectorbt as vbt
fast = close.rolling(10).mean()
slow = close.ewm(span=30, adjust=False).mean()
entries = fast.vbt.crossed_above(slow)
exits = (fast < slow)
pf = vbt.Portfolio.from_signals(close, entries, exits, sl_stop=0.05, fees=0.001)`, market: "ETHUSD" });
    expect(r.blocking).toEqual([]);
    expect(r.rules!.long!.stop_loss).toBe(0.05);
    expect(r.rules!.cost).toBe(0.001);
    expect(r.rules!.let.slow).toEqual(["ema", "close", "ema_length"]);
    expect(r.rules!.long!.entry).toBe("entries");
    expect(r.rules!.let.entries).toEqual(["crossover", "fast", "slow"]);
  });
});

describe("the rule format", () => {
  it("names every problem", () => {
    try {
      validateRules({ market: "DOGE", inputs: { n: "x" }, let: { a: ["atr", 14], b: ["sma", "open", 10] }, long: { entry: ["frobnicate", 1] } });
      throw new Error("no error");
    } catch (e) {
      expect(e).toBeInstanceOf(RulesError);
      const p = (e as RulesError).problems.join(" | ");
      expect(p).toContain('"market" must be one of');
      expect(p).toContain('The input "n" must be a number');
      expect(p).toContain('"atr" needs the day\'s high and low');
      expect(p).toContain('"open" needs the day\'s opening price');
      expect(p).toContain('"frobnicate" is not a function we can run');
    }
  });

  it("numbers written into indicators become settings, shared when they repeat", () => {
    const r = liftLengths({ format: "parity-rules-1", market: "SPX", inputs: {}, let: { a: ["sma", "close", 20], b: ["sma", "close", 20], c: ["prev", "close", 5] }, long: { entry: [">", "a", "b"] } });
    expect(r.inputs).toEqual({ sma_length: 20 });
    expect(r.let.c).toEqual(["prev", "close", 5]);
  });

  it("the nearby settings: half to one and a half times each, lengths stay whole", () => {
    expect(sweepGrid({ n: 10 }, new Set(["n"]))).toEqual([{ n: 5 }, { n: 8 }, { n: 10 }, { n: 13 }, { n: 15 }]);
    expect(sweepGrid({ a: 10, b: 20 }).length).toBe(25);
    expect(sweepGrid({ a: 1, b: 2, c: 3, d: 4 }).length).toBeLessThanOrEqual(81);
    expect(sweepGrid({ a: 10, b: 20, c: 30, d: 40, e: 50 }).length).toBe(1 + 5 * 4);
    expect(sweepGrid({})).toEqual([]);
  });

  it("a model's reply is checked like any rules, and what it could not express is listed", () => {
    const ok = finishRead(readPlainReply('Here: {"rules": {"inputs": {"n": 20}, "let": {"m": ["sma", "close", "n"]}, "long": {"entry": [">", "close", "m"], "exit": ["<", "close", "m"]}}, "assumed": ["a 20-day average"], "unsupported": []}', "SPX"), "SPX");
    expect(ok.blocking).toEqual([]);
    expect(ok.rules!.market).toBe("SPX");
    expect(ok.notes.join(" ")).toContain("Your model assumed: a 20-day average");
    const no = readPlainReply('{"unsupported": ["the day\'s high"]}', "SPX");
    expect(no.rules).toBeNull();
    expect(no.blocking[0].what).toBe("the day's high");
    expect(readPlainReply("I cannot help", "SPX").blocking[0].why).toContain("did not answer with rules");
  });
});

describe("the backtest", () => {
  // Ten days of prices: up, then down.
  const p: Prices = { dates: Array.from({ length: 10 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`), close: s([100, 101, 102, 104, 103, 101, 99, 98, 100, 103]), source: "test" };
  const rules = (long: Rules["long"], extra: Partial<Rules> = {}): Rules => ({ format: "parity-rules-1", market: "SPX", inputs: {}, let: {}, long, ...extra });

  it("fills at the signal day's close and pays the market's cost on each side", () => {
    // Up two days in a row: buy; down a day: sell.
    const run = runRules(rules({ entry: ["and", [">", "close", ["prev", "close", 1]], [">", ["prev", "close", 1], ["prev", "close", 2]]], exit: ["<", "close", ["prev", "close", 1]] }), p, {}, { capital: 10000 });
    expect(run.cost).toBe(0.0002);
    expect(run.trades).toHaveLength(2);
    const [t] = run.trades;
    expect(t).toMatchObject({ openTime: "2024-01-03T00:00:00", closeTime: "2024-01-05T00:00:00", side: "buy", entry: 102, exit: 103 });
    const units = 10000 / 102;
    const fees = units * 102 * 0.0002 + units * 103 * 0.0002;
    expect(t.fees).toBeCloseTo(fees, 6);
    expect(t.pnl).toBeCloseTo(units * 1 - fees, 6);
    // The second trade is still open at the end and is closed at the last price.
    expect(run.endedOpen).toBe(true);
    expect(run.notes[0]).toContain("still open");
  });

  it("a stop set at entry is checked from the next day on, at the close", () => {
    const run = runRules(rules({ entry: ["==", "position", 0], stop_loss: 0.02 }), p, {}, { capital: 1000 });
    // Bought at 100 on day 1; first close at or under 98 is day 8.
    expect(run.trades[0]).toMatchObject({ entry: 100, exit: 98, closeTime: "2024-01-08T00:00:00" });
  });

  it("a short turns around on the opposite entry, and a day's delay moves every fill", () => {
    const r = rules({ entry: [">", "close", ["prev", "close", 1]] }, { short: { entry: ["<", "close", ["prev", "close", 1]] } });
    const now = runRules(r, p, {}, { capital: 1000 }), late = runRules(r, p, {}, { capital: 1000, lagDays: 1 });
    expect(now.trades.map((t) => t.side)).toEqual(["buy", "sell", "buy"]);
    expect(now.trades[0].entry).toBe(101);
    expect(late.trades[0].entry).toBe(102);
  });

  it("the same rules give the same answer every time", () => {
    const read = readStrategy({ code: code("sma-cross.pine"), market: "BTCUSD" });
    const a = runStrategy(read as never, book), b = runStrategy(read as never, book);
    expect(a.stats).toEqual(b.stats);
    expect(a.sweep).toEqual(b.sweep);
    expect(a.sweep.runs).toBe(25);
  });
});

describe("a strategy from code goes through the five cards", () => {
  it("counts the stated tries plus the nearby settings and checks timing and neighbours", () => {
    const read = readStrategy({ code: code("sma-cross-pandas.py"), market: "BTCUSD" });
    const r = checkBacktest(runStrategy(read as never, book), 3);
    expect(r.source).toBe("code");
    expect(r.kind).toBe("backtest");
    expect(r.tries).toBe(3 + 24);
    expect(r.code!.triesSweep).toBe(24);
    expect(r.card3!.tries).toBe(27);
    expect(r.card4.map((c) => c.id)).toEqual(["fills", "range", "session", "timing", "smooth", "edited", "label", "cut"]);
    expect(r.card4.find((c) => c.id === "cut")!.status).toBe("pass");
    expect(r.card5.map((c) => c.id)).toEqual(["short", "fade", "conc", "settings", "sweep"]);
    expect(r.card5.find((c) => c.id === "settings")!.status).not.toBe("na");
    expect(r.verdict.sentence.length).toBeGreaterThan(20);
    expect(r.notes.join(" ")).toContain("Buying and holding over the same days returned");
    expect(r.what).toBe("Python strategy on BTCUSD");
  });

  it("an always-in record on a rising market with few settings can hold up; the same with a fragile timing fails timing", () => {
    // Long whenever the close is above its 5-day average: on prices that only rise, it wins.
    const days = Array.from({ length: 900 }, (_, i) => new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));
    let v = 100;
    const rising = { generated_at: "", symbols: { SPX: { kind: "price" as const, source: "test", rows: days.map((d, i) => [d, (v *= 1 + 0.002 + 0.004 * Math.sin(i))]) } } };
    const read = finishRead({ language: "rules", rules: validateRules({ format: "parity-rules-1", market: "SPX", inputs: { n: 5 }, let: { m: ["sma", "close", "n"] }, long: { entry: [">", "close", "m"], exit: ["<", "close", "m"] } }), name: null, blocking: [], ignored: [], notes: [], capital: null }, "SPX");
    const r = checkBacktest(runStrategy(read as never, priceBook(rising)), 1);
    expect(r.card1!.expectancy).toBeGreaterThan(0);
    expect(r.card5.find((c) => c.id === "sweep")!.status).toBe("pass");
  });
});
