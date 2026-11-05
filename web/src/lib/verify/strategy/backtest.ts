// Runs a rule set (rules.ts) on our daily closing prices, with honest costs, and returns the
// trades and the account value each day. Pure functions; the same code runs in the browser,
// on the API and in the MCP tools, so every way in gives the same answer.
//
// How a day is handled, in order:
//   1. the indicators are worked out from this day's close and the days before it, never later;
//   2. an open position is closed if its stop or target is reached at this close, or its exit
//      rule is true;
//   3. an entry rule that is true opens a position at this close (turning an opposite one
//      around). Orders fill at the close of the day the signal appears. Pine fills at the next
//      day's open, which for currencies and crypto, traded round the clock, is the same price.
//      The "one day later" run fills every order a day late instead, to show how much the
//      result leans on that.
// Each fill pays the market's cost (MARKETS) or the strategy's own, whichever is larger.
import type { PriceBook } from "../prices";
import type { Trade } from "../types";
import { BUILTINS, MARKETS, RulesError, type Expr, type Market, type Rules, type SideRules } from "./rules";
import * as ta from "./series";
import type { Series } from "./series";

export interface Prices { dates: string[]; close: Series; source: string }

/** One market's closes from the price file, oldest first. */
export function pricesFor(book: PriceBook, market: string): Prices | null {
  const s = book[market];
  if (!s) return null;
  const dates = [...s.days.keys()].sort();
  const close = new Float64Array(dates.length);
  dates.forEach((d, i) => { const [lo, hi] = s.days.get(d)!; close[i] = (lo + hi) / 2; });
  return { dates, close, source: s.source };
}

export interface RunOptions {
  /** Starting balance. */
  capital?: number;
  /** Fill every order this many days after its signal (0: at the signal day's close). */
  lagDays?: number;
  /** Shared between runs of the same market and dates, so a sweep works each indicator out once. */
  cache?: Map<string, Series>;
}

export interface RunResult {
  market: Market;
  trades: Trade[];
  dates: string[];
  equity: number[];
  capital: number;
  /** One-way cost used, as a share of the amount traded. */
  cost: number;
  costFromScript: boolean;
  /** Index of the first day every rule could be worked out. */
  start: number;
  notes: string[];
  endedOpen: boolean;
}

interface State { pos: number; entryPrice: number }
type Dyn = (i: number, st: State) => number;
type Val = { s: Series; warm: number } | { f: Dyn };

const isSeries = (v: Val): v is { s: Series; warm: number } => "s" in v;

function firstValid(s: Series): number {
  for (let i = 0; i < s.length; i++) if (!Number.isNaN(s[i])) return i;
  return s.length;
}

class Compiler {
  private named = new Map<string, Val>();
  constructor(private p: Prices, private rules: Rules, private inputs: Record<string, number>, private cache: Map<string, Series>) {
    for (const [k, e] of Object.entries(rules.let)) this.named.set(k, this.val(e));
  }

  private stat(key: string, make: () => Series): Val {
    let s = this.cache.get(key);
    if (!s) { s = make(); this.cache.set(key, s); }
    return { s, warm: firstValid(s) };
  }

  private builtin(name: string): Val | null {
    const p = this.p;
    switch (name) {
      case "close": return { s: p.close, warm: 0 };
      case "entry_price": return { f: (_i, st) => (st.pos ? st.entryPrice : NaN) };
      case "position": return { f: (_i, st) => st.pos };
      case "year": return this.stat("@year", () => Float64Array.from(p.dates, (d) => +d.slice(0, 4)));
      case "month": return this.stat("@month", () => Float64Array.from(p.dates, (d) => +d.slice(5, 7)));
      case "dayofmonth": return this.stat("@dom", () => Float64Array.from(p.dates, (d) => +d.slice(8, 10)));
      case "dayofweek": return this.stat("@dow", () => Float64Array.from(p.dates, (d) => new Date(`${d}T00:00:00Z`).getUTCDay() + 1));
      case "time": return this.stat("@time", () => Float64Array.from(p.dates, (d) => Date.parse(`${d}T00:00:00Z`)));
      case "nan": return this.stat("@nan", () => new Float64Array(p.dates.length).fill(NaN));
      default: return null;
    }
  }

  private len(e: Expr): number {
    const v = typeof e === "number" ? e : typeof e === "string" ? this.inputs[e] : NaN;
    return Math.max(1, Math.round(v));
  }

  /** A key that names the expression with the inputs filled in, for the shared cache. */
  private key(e: Expr): string {
    if (typeof e === "string") return this.inputs[e] != null ? String(this.inputs[e]) : this.named.has(e) ? `<${e}:${this.keyOfNamed(e)}>` : e;
    if (Array.isArray(e)) return `[${e.map((x) => this.key(x)).join(",")}]`;
    return String(e);
  }
  private keyOfNamed(name: string): string { return this.key(this.rules.let[name]); }

  val(e: Expr): Val {
    const n = this.p.close.length;
    if (typeof e === "number") return this.stat(`#${e}`, () => new Float64Array(n).fill(e));
    if (typeof e === "boolean") return this.stat(`#${e}`, () => new Float64Array(n).fill(e ? 1 : 0));
    if (typeof e === "string") {
      if (this.inputs[e] != null) return this.val(this.inputs[e]);
      const v = this.named.get(e) ?? this.builtin(e);
      if (!v) throw new Error(`Unknown name ${e}`);
      return v;
    }
    const [fn, ...a] = e as [string, ...Expr[]];
    const key = this.key(e);
    const one = (k: number) => this.val(a[k]);
    // Indicators need a whole series: a value that depends on the open position cannot feed one.
    const src = (k: number): Series => {
      const v = one(k);
      if (!isSeries(v)) throw new RulesError(`"${fn}" cannot be worked out from a value that depends on the open position.`);
      return v.s;
    };
    switch (fn) {
      case "sma": case "ema": case "rma": case "wma": case "rsi": case "roc": case "change": case "stdev": case "highest": case "lowest": case "cci": case "prev": {
        const s = src(0), L = this.len(a[1]);
        const f = { sma: ta.sma, ema: ta.ema, rma: ta.rma, wma: ta.wma, rsi: ta.rsi, roc: ta.roc, change: ta.change, stdev: ta.stdev, highest: ta.highest, lowest: ta.lowest, cci: ta.cci, prev: ta.prev }[fn];
        return this.stat(key, () => f(s, L));
      }
      case "macd": { const s = src(0); return this.stat(key, () => ta.macd(s, this.len(a[1]), this.len(a[2]))); }
      case "macd_signal": { const s = src(0); return this.stat(key, () => ta.macdSignal(s, this.len(a[1]), this.len(a[2]), this.len(a[3]))); }
      case "macd_hist": { const s = src(0); return this.stat(key, () => ta.macdHist(s, this.len(a[1]), this.len(a[2]), this.len(a[3]))); }
      case "bb_upper": case "bb_lower": {
        const s = src(0), L = this.len(a[1]), m = one(2);
        if (!isSeries(m)) throw new RulesError("The Bollinger width cannot depend on the open position.");
        return this.stat(key, () => ta.bb(s, L, m.s[m.s.length - 1], fn === "bb_upper"));
      }
      case "crossover": case "crossunder": case "cross": {
        const x = src(0), y = src(1);
        return this.stat(key, () => {
          const out = new Float64Array(n).fill(NaN);
          for (let i = 1; i < n; i++) {
            if ([x[i], y[i], x[i - 1], y[i - 1]].some(Number.isNaN)) continue;
            const up = x[i] > y[i] && x[i - 1] <= y[i - 1], down = x[i] < y[i] && x[i - 1] >= y[i - 1];
            out[i] = (fn === "crossover" ? up : fn === "crossunder" ? down : up || down) ? 1 : 0;
          }
          return out;
        });
      }
      default: return this.pointwise(fn, a.map((x) => this.val(x)), key);
    }
  }

  private pointwise(fn: string, args: Val[], key: string): Val {
    const op = OPS[fn];
    if (!op) throw new Error(`Unknown function ${fn}`);
    if (args.every(isSeries)) {
      const ss = args.map((v) => (v as { s: Series }).s);
      return this.stat(key, () => {
        const n = this.p.close.length;
        const out = new Float64Array(n);
        const xs = new Array<number>(ss.length);
        for (let i = 0; i < n; i++) { for (let k = 0; k < ss.length; k++) xs[k] = ss[k][i]; out[i] = op(xs); }
        return out;
      });
    }
    const fs: Dyn[] = args.map((v) => (isSeries(v) ? (i: number) => v.s[i] : v.f));
    return { f: (i, st) => op(fs.map((g) => g(i, st))) };
  }

  /** A function of the day and the open position, for the rules that use either. */
  fn(e: Expr | undefined): Dyn | null {
    if (e == null) return null;
    const v = this.val(e);
    return isSeries(v) ? (i) => v.s[i] : v.f;
  }

  /** The first day every static value the rules use is known. */
  warm(es: (Expr | undefined)[]): number {
    let w = 0;
    for (const e of es) {
      if (e == null) continue;
      const v = this.val(e);
      if (isSeries(v)) w = Math.max(w, v.warm >= this.p.close.length ? 0 : v.warm);
    }
    return w;
  }
}

const truthy = (v: number) => !Number.isNaN(v) && v !== 0;
const b = (v: boolean) => (v ? 1 : 0);
const OPS: Record<string, (x: number[]) => number> = {
  "+": ([x, y]) => x + y, "-": ([x, y]) => x - y, "*": ([x, y]) => x * y, "/": ([x, y]) => (y === 0 ? NaN : x / y),
  neg: ([x]) => -x, pow: ([x, y]) => x ** y, abs: ([x]) => Math.abs(x), max: ([x, y]) => Math.max(x, y), min: ([x, y]) => Math.min(x, y),
  log: ([x]) => Math.log(x), sqrt: ([x]) => Math.sqrt(x),
  nz: ([x, y]) => (Number.isNaN(x) ? (y ?? 0) : x), na: ([x]) => b(Number.isNaN(x)),
  // Pine's comparisons with a missing value are false.
  ">": ([x, y]) => b(x > y), "<": ([x, y]) => b(x < y), ">=": ([x, y]) => b(x >= y), "<=": ([x, y]) => b(x <= y),
  "==": ([x, y]) => b(x === y), "!=": ([x, y]) => (Number.isNaN(x) || Number.isNaN(y) ? 0 : b(x !== y)),
  and: ([x, y]) => b(truthy(x) && truthy(y)), or: ([x, y]) => b(truthy(x) || truthy(y)), not: ([x]) => b(!truthy(x)),
  if: ([c, x, y]) => (truthy(c) ? x : y),
};

interface SideFns { entry: Dyn | null; exit: Dyn | null; stop: Dyn | null; limit: Dyn | null; stopLoss?: number; takeProfit?: number }

function sideFns(c: Compiler, s: SideRules | undefined): SideFns {
  return { entry: c.fn(s?.entry), exit: c.fn(s?.exit), stop: c.fn(s?.stop), limit: c.fn(s?.limit), stopLoss: s?.stop_loss, takeProfit: s?.take_profit };
}

export const DEFAULT_CAPITAL = 10_000;

/** Runs the rules once. `inputs` replaces the rule set's own inputs (the sweep uses this). */
export function runRules(rules: Rules, prices: Prices, inputs: Record<string, number> = rules.inputs, opt: RunOptions = {}): RunResult {
  const market = MARKETS.find((m) => m.id === rules.market)!;
  const capital = opt.capital ?? DEFAULT_CAPITAL;
  const lag = opt.lagDays ?? 0;
  const notes: string[] = [];
  // Dates outside from/to are cut before anything is worked out, so indicators start fresh.
  let lo = 0, hi = prices.dates.length;
  if (rules.from) lo = Math.max(0, prices.dates.findIndex((d) => d >= rules.from!));
  if (rules.to) { const k = prices.dates.findIndex((d) => d > rules.to!); if (k >= 0) hi = k; }
  const p: Prices = lo === 0 && hi === prices.dates.length ? prices : { dates: prices.dates.slice(lo, hi), close: prices.close.slice(lo, hi), source: prices.source };
  const cache = lo === 0 && hi === prices.dates.length ? opt.cache ?? new Map() : new Map<string, Series>();
  const c = new Compiler(p, rules, inputs, cache);
  const L = sideFns(c, rules.long), S = sideFns(c, rules.short);
  const cost = Math.max(market.cost, rules.cost ?? 0);
  const size = rules.size ?? 1;
  const start = c.warm([rules.long?.entry, rules.long?.exit, rules.short?.entry, rules.short?.exit]);

  const n = p.dates.length;
  const st: State = { pos: 0, entryPrice: NaN };
  let cash = capital, units = 0, entryTime = "", entryFee = 0, entryIdx = -1, wiped = false;
  const trades: Trade[] = [];
  const dates: string[] = [], equity: number[] = [];
  const at = (f: Dyn | null, i: number) => (f && i >= 0 ? f(i, st) : NaN);

  const close = (i: number, price: number) => {
    const fee = Math.abs(units * price) * cost;
    cash += units * price - fee;
    const fees = entryFee + fee;
    trades.push({
      openTime: entryTime, closeTime: `${p.dates[i]}T00:00:00`, symbol: market.id, side: units > 0 ? "buy" : "sell",
      size: round(Math.abs(units)), entry: st.entryPrice, exit: price, fees: round(fees), pnl: round(units * (price - st.entryPrice) - fees),
    });
    units = 0; st.pos = 0; st.entryPrice = NaN; entryFee = 0;
  };
  const open = (i: number, price: number, dir: 1 | -1) => {
    const value = cash + units * price;
    if (!(value > 0)) return;
    units = (dir * size * value) / price;
    const fee = Math.abs(units * price) * cost;
    cash -= units * price + fee;
    st.pos = dir; st.entryPrice = price; entryTime = `${p.dates[i]}T00:00:00`; entryFee = fee; entryIdx = i;
  };

  for (let i = 0; i < n; i++) {
    const price = p.close[i];
    if (!(price > 0)) continue;
    const sig = i - lag; // the day whose rules decide what fills today
    if (i >= start && !wiped) {
      let closedNow = false;
      if (st.pos !== 0 && i > entryIdx) {
        const s = st.pos > 0 ? L : S, dir = st.pos;
        // A stop or target level is set at one close and checked at the next, as a resting order is.
        const stops = [at(s.stop, i - 1), s.stopLoss ? st.entryPrice * (1 - dir * s.stopLoss) : NaN].filter((v) => !Number.isNaN(v));
        const limits = [at(s.limit, i - 1), s.takeProfit ? st.entryPrice * (1 + dir * s.takeProfit) : NaN].filter((v) => !Number.isNaN(v));
        const hitStop = stops.some((lv) => (dir > 0 ? price <= lv : price >= lv));
        const hitLimit = limits.some((lv) => (dir > 0 ? price >= lv : price <= lv));
        if (hitStop || hitLimit || truthy(at(s.exit, sig))) { close(i, price); closedNow = true; }
      }
      const le = truthy(at(L.entry, sig)), se = truthy(at(S.entry, sig));
      if (le && !se && st.pos <= 0 && !(closedNow && trades[trades.length - 1]?.side === "buy")) { if (st.pos < 0) close(i, price); open(i, price, 1); }
      else if (se && !le && st.pos >= 0 && !(closedNow && trades[trades.length - 1]?.side === "sell")) { if (st.pos > 0) close(i, price); open(i, price, -1); }
    }
    const value = cash + units * price;
    if (i >= start) { dates.push(p.dates[i]); equity.push(value); }
    if (value <= 0 && !wiped) { wiped = true; if (units) close(i, price); notes.push(`The account was wiped out on ${p.dates[i]}; nothing after that is traded.`); }
  }
  const endedOpen = st.pos !== 0;
  if (endedOpen) {
    let k = n - 1; while (k > 0 && !(p.close[k] > 0)) k--;
    close(k, p.close[k]);
    notes.push(`A position was still open on ${p.dates[k]}, the last day we hold. It is counted as closed at that day's price.`);
  }
  return { market, trades, dates, equity, capital, cost, costFromScript: (rules.cost ?? 0) > market.cost, start, notes, endedOpen };
}

const round = (v: number) => Math.round(v * 1e8) / 1e8;

export { BUILTINS };
