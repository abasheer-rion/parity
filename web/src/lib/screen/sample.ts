// The SYNTHETIC sample batch, screened (DEC-0087): what the sample report and the business
// pages print. headline() runs the same screen as the page on simulate()'s accounts and
// keeps the numbers the pages quote, so a page cannot quote a number the code does not give.
import { backtest } from "./backtest";
import { DEFAULT_OPTIONS, screenSync, summarise, type AccountInput, type ScreenOptions } from "./score";
import { SIM_RULES, type SimAccount, type Style } from "./simulate";

export const SAMPLE_PATH = "/business/prop-firms/sample/";
export const SAMPLE_FILES = { trades: `${SAMPLE_PATH}trades.csv`, details: `${SAMPLE_PATH}details.csv` };

export function toInputs(accounts: readonly SimAccount[]): AccountInput[] {
  return accounts.map((a) => ({
    id: a.id, balance: a.balance, tries: a.attempts, passed: a.passed, outcome: a.outcome,
    trades: a.trades.map((t) => ({ openTime: t.openTime, closeTime: t.closeTime, symbol: t.symbol, side: t.side, size: t.size, fees: 0, pnl: t.pnl })),
  }));
}

const r3 = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000);

export interface Headline {
  synthetic: true;
  accounts: number;
  passers: number;
  /** Passers judged (holds up or likely luck) and how many look like luck. */
  judgedPassers: number;
  luckyPassers: number;
  luckyPasserShare: number | null;
  /** Likely-luck passers that the consistency, minimum days and size rules would all have let through. */
  onlyLuckCheck: number;
  notEnoughPassers: number;
  /** The back-test on the simulated outcomes. */
  backtest: {
    n: number; hitRate: number | null; hitLo: number | null; hitHi: number | null;
    falseAlarms: number | null; falseLo: number | null; falseHi: number | null;
    caught: number | null; caughtLo: number | null; caughtHi: number | null;
    luckyBlowup: number | null; holdsBlowup: number | null; holdsLo: number | null; holdsHi: number | null;
  } | null;
  /** The answer key: how the screen judged each made-up style's passers. */
  byStyle: Record<Style, { accounts: number; passed: number; holds: number; lucky: number; thin: number }>;
  /** A trader with no edge who keeps trading until the target or the loss limit, ignoring time: limit / (target + limit). */
  noEdgePassChance: number;
  rules: { target: number; maxLoss: number; dailyLoss: number; days: number };
}

export function headline(accounts: readonly SimAccount[], opts: ScreenOptions = DEFAULT_OPTIONS): Headline {
  const results = screenSync(toInputs(accounts), opts);
  const s = summarise(results, opts);
  const bt = backtest(results);
  const byStyle = {} as Headline["byStyle"];
  for (const style of ["skilled", "no_edge", "gambling"] as Style[]) {
    const idx = accounts.map((a, i) => (a.style === style ? i : -1)).filter((i) => i >= 0);
    const passed = idx.filter((i) => accounts[i].passed);
    byStyle[style] = {
      accounts: idx.length, passed: passed.length,
      holds: passed.filter((i) => results[i].verdict === "holds_up").length,
      lucky: passed.filter((i) => results[i].verdict === "likely_luck").length,
      thin: passed.filter((i) => results[i].verdict === "not_enough").length,
    };
  }
  const judged = s.passersByVerdict.holds_up + s.passersByVerdict.likely_luck;
  return {
    synthetic: true,
    accounts: s.accounts, passers: s.passers, judgedPassers: judged,
    luckyPassers: s.passersByVerdict.likely_luck, luckyPasserShare: r3(s.luckyPasserShare),
    onlyLuckCheck: s.onlyLuckCheck, notEnoughPassers: s.passersByVerdict.not_enough,
    backtest: bt && {
      n: bt.n,
      hitRate: r3(bt.hitRate.p), hitLo: r3(bt.hitRate.lo), hitHi: r3(bt.hitRate.hi),
      falseAlarms: r3(bt.falseAlarms.p), falseLo: r3(bt.falseAlarms.lo), falseHi: r3(bt.falseAlarms.hi),
      caught: r3(bt.caught.p), caughtLo: r3(bt.caught.lo), caughtHi: r3(bt.caught.hi),
      luckyBlowup: r3(bt.hitRate.p), holdsBlowup: r3(bt.holdsBlowup.p), holdsLo: r3(bt.holdsBlowup.lo), holdsHi: r3(bt.holdsBlowup.hi),
    },
    byStyle,
    noEdgePassChance: r3(SIM_RULES.maxLoss / (SIM_RULES.target + SIM_RULES.maxLoss))!,
    rules: { target: SIM_RULES.target, maxLoss: SIM_RULES.maxLoss, dailyLoss: SIM_RULES.dailyLoss, days: SIM_RULES.days },
  };
}
