// SYNTHETIC challenge accounts for the sample report (DEC-0087). Every account here is made
// up by a seeded random number generator: none is a real trader. Three styles trade a prop
// challenge (8% target, 10% loss limit, 5% daily loss limit, at most 30 trading days):
//   skilled   a small real edge per trade and small positions
//   no edge   no edge (or a slightly negative one after costs), some with a high win rate
//   gambling  large positions, no edge, many of them doubling the size after a loss
// Accounts that pass then trade a funded account the same way until they either make 6%
// (a payout) or fall 6% from their high (a blow-up). That later outcome is simulated from the
// same style with fresh random draws; the screen never sees it. About one funded trader in
// eight changes after passing (bigger positions and a worse edge), as real ones sometimes do.
// Pure and deterministic, so the sample files and the numbers printed on the business pages
// are the same on every run.
import type { Outcome } from "./score";

export type Style = "skilled" | "no_edge" | "gambling";

export interface SimTrade { openTime: string; closeTime: string; symbol: string; side: "buy" | "sell"; size: number; pnl: number }

export interface SimAccount {
  id: string;
  style: Style;
  balance: number;
  attempts: number;
  passed: boolean;
  outcome: Outcome | null;
  trades: SimTrade[];
}

export const SIM_RULES = { target: 0.08, maxLoss: 0.1, dailyLoss: 0.05, days: 30, payout: 0.06, trailing: 0.06, fundedDays: 250, tilt: 0.12 };

/** mulberry32: a small, fast, seeded generator. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30", "GER40", "AUDUSD"];

interface Params {
  /** Position risk as a share of the balance, and the mean result per trade in units of that risk. */
  risk: number;
  edge: number;
  /** Trades per trading day, on average. */
  perDay: number;
  /** "binary": a fixed win or loss (high win rate styles); "normal": a spread of results. */
  shape: "binary" | "normal";
  winProb: number;
  winSize: number;
  martingale: boolean;
  symbols: string[];
}

function params(style: Style, r: () => number): Params {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const symbols = [pick(SYMBOLS), pick(SYMBOLS)];
  const u = (a: number, b: number) => a + (b - a) * r();
  if (style === "skilled") {
    return { risk: u(0.0025, 0.006), edge: u(0.18, 0.4), perDay: u(2, 5), shape: "normal", winProb: 0, winSize: 0, martingale: false, symbols };
  }
  if (style === "no_edge") {
    // Half trade a high win rate with small wins and larger losses, half a plain spread.
    const binary = r() < 0.5;
    const winProb = u(0.6, 0.8);
    return {
      risk: u(0.004, 0.012), edge: u(-0.08, 0.03), perDay: u(1.5, 6), shape: binary ? "binary" : "normal",
      winProb, winSize: (1 - winProb) / winProb, martingale: false, symbols,
    };
  }
  return { risk: u(0.015, 0.04), edge: u(-0.15, 0.03), perDay: u(0.6, 2.5), shape: "binary", winProb: 0.5, winSize: 1, martingale: r() < 0.55, symbols };
}

/** A standard normal draw (Box-Muller). */
function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The next weekday after a date. */
function nextWeekday(d: Date): Date {
  const n = new Date(d.getTime() + 86_400_000);
  while (n.getUTCDay() === 0 || n.getUTCDay() === 6) n.setTime(n.getTime() + 86_400_000);
  return n;
}

const iso = (d: Date, minutes: number) => {
  const t = new Date(d.getTime() + minutes * 60_000);
  return t.toISOString().slice(0, 19);
};

interface Phase { trades: SimTrade[]; end: "target" | "breach" | "time"; endDate: Date }

/**
 * One phase of trading. Challenge: stop at the target, the loss limit, a daily loss over the
 * limit, or the day limit. Funded: stop at the payout level or a fall of `trailing` from the high.
 */
function trade(p: Params, r: () => number, balance: number, start: Date, mode: "challenge" | "funded"): Phase {
  const trades: SimTrade[] = [];
  let e = balance, high = balance, d = start, streak = 0;
  const maxDays = mode === "challenge" ? SIM_RULES.days : SIM_RULES.fundedDays;
  for (let dayN = 0; dayN < maxDays; dayN++) {
    d = nextWeekday(d);
    const dayStart = e;
    // Trades today: Poisson-like around perDay.
    let k = 0;
    for (let lim = Math.exp(-p.perDay), prod = r(); prod > lim; prod *= r()) k++;
    let minute = 8 * 60 + Math.floor(r() * 90);
    for (let j = 0; j < k; j++) {
      const mult = p.martingale ? 2 ** Math.min(streak, 4) : 1;
      const riskMoney = balance * p.risk * mult;
      let unit: number;
      if (p.shape === "binary") unit = r() < p.winProb ? p.winSize : -1;
      else unit = normal(r);
      // The edge shifts the result; costs are part of it already.
      const pnl = Math.round((unit + p.edge) * riskMoney * 100) / 100;
      const hold = 5 + Math.floor(r() * 120);
      const symbol = p.symbols[Math.floor(r() * p.symbols.length)];
      const baseSize = Math.round(p.risk * balance / 500) / 100 || 0.01;
      trades.push({ openTime: iso(d, minute), closeTime: iso(d, minute + hold), symbol, side: r() < 0.5 ? "buy" : "sell", size: Math.round(baseSize * mult * 100) / 100, pnl });
      minute += hold + 1 + Math.floor(r() * 40);
      e += pnl;
      high = Math.max(high, e);
      streak = pnl < 0 ? streak + 1 : 0;
      if (mode === "challenge") {
        if (e <= balance * (1 - SIM_RULES.maxLoss) || dayStart - e >= balance * SIM_RULES.dailyLoss) return { trades, end: "breach", endDate: d };
        if (e >= balance * (1 + SIM_RULES.target)) return { trades, end: "target", endDate: d };
      } else {
        if (e <= high - balance * SIM_RULES.trailing) return { trades, end: "breach", endDate: d };
        if (e >= balance * (1 + SIM_RULES.payout)) return { trades, end: "target", endDate: d };
      }
    }
  }
  return { trades, end: "time", endDate: d };
}

export interface SimOptions { seed: number; accounts: number; mix: Record<Style, number> }

export const SAMPLE_OPTIONS: SimOptions = { seed: 20261103, accounts: 500, mix: { skilled: 0.14, no_edge: 0.52, gambling: 0.34 } };

export function simulate(o: SimOptions = SAMPLE_OPTIONS): SimAccount[] {
  const r = rng(o.seed);
  const sizes = [25_000, 50_000, 100_000, 100_000, 200_000];
  const out: SimAccount[] = [];
  for (let i = 0; i < o.accounts; i++) {
    const x = r();
    const style: Style = x < o.mix.skilled ? "skilled" : x < o.mix.skilled + o.mix.no_edge ? "no_edge" : "gambling";
    const p = params(style, r);
    const balance = sizes[Math.floor(r() * sizes.length)];
    const attempts = style === "skilled" ? 1 + Math.floor(r() * 2) : style === "no_edge" ? 1 + Math.floor(r() * 4) : 1 + Math.floor(r() * 8);
    const start = new Date(Date.UTC(2026, 6, 1) + Math.floor(r() * 60) * 86_400_000);
    const ch = trade(p, r, balance, start, "challenge");
    const passed = ch.end === "target";
    let outcome: Outcome | null = null;
    if (passed) {
      const tilted = r() < SIM_RULES.tilt;
      const f = trade(tilted ? { ...p, risk: p.risk * 2.5, edge: p.edge - 0.15 } : p, r, balance, ch.endDate, "funded");
      // Still trading after the funded window: whichever side of the start it ended on.
      outcome = f.end === "target" ? "payout" : f.end === "breach" ? "blowup" : f.trades.reduce((s, t) => s + t.pnl, 0) > 0 ? "payout" : "blowup";
    }
    out.push({ id: `SYN-${String(i + 1).padStart(4, "0")}`, style, balance, attempts, passed, outcome, trades: ch.trades });
  }
  return out;
}

/** The long trade file: one row per trade, with the account it belongs to. */
export function tradesCsv(accounts: readonly SimAccount[]): string {
  const lines = ["account,open_time,close_time,symbol,side,size,pnl"];
  for (const a of accounts) for (const t of a.trades) lines.push([a.id, t.openTime.replace("T", " "), t.closeTime.replace("T", " "), t.symbol, t.side, t.size, t.pnl.toFixed(2)].join(","));
  return `${lines.join("\n")}\n`;
}

/** The details file: one row per account. The style column is the answer key, kept for checking the sample. */
export function detailsCsv(accounts: readonly SimAccount[]): string {
  const lines = ["account,starting_balance,attempts,passed,outcome,synthetic_style"];
  for (const a of accounts) lines.push([a.id, a.balance, a.attempts, a.passed ? "yes" : "no", a.outcome ?? "", a.style].join(","));
  return `${lines.join("\n")}\n`;
}
