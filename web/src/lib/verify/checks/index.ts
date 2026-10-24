// Running every check on a record and putting the result together: the verdict, the five
// cards, the claim arithmetic and what the record was. Pure functions, no React.
import { day } from "../csv";
import { normaliseSymbol, type PriceBook } from "../prices";
import { daysBetween, drawdowns, fromEquity, fromTrades, type ReturnSeries } from "../returns";
import { FORMAT_LABEL, METHOD_VERSION, type Answers, type Claim, type EquityPoint, type InputKind, type Parsed, type Source, type Trade } from "../types";
import { claimRows, type ClaimRow } from "./claims";
import { expectancyCard, type ExpectancyCard } from "./expectancy";
import { editedCheck, fillChecks, labelCheck, NA, smoothCheck, strategyLookAheadCheck, type CheckRow } from "./lookahead";
import { basisFor, luckCard, type LuckCard } from "./luck";
import { claimCheck, concentrationCheck, fadeCheck, settingsCheck, shortSampleCheck } from "./overfit";
import { tailCard, type TailCard } from "./tail";
import { verdict, type Verdict } from "./verdict";

export * from "./claims";
export * from "./expectancy";
export * from "./lookahead";
export * from "./luck";
export * from "./overfit";
export * from "./tail";
export * from "./verdict";

export interface Result {
  source: Source;
  kind: InputKind;
  tries: number;
  /** True when the person left the number of tries at its default of 1. */
  triesDefaulted: boolean;
  methodVersion: string;
  /** What the record was, in words: "MetaTrader 5 history", "Equity curve", a strategy's name. */
  what: string;
  dateFrom: string | null;
  dateTo: string | null;
  trades: number | null;
  dailyReturns: number;
  /** Starting balance used; null when unknown. */
  balance: number | null;
  /** Asset classes, for the opt-in dataset: fx, crypto, stocks, commodities, other. */
  assets: string[];
  card1: ExpectancyCard | null;
  card2: TailCard | null;
  card3: LuckCard | null;
  card4: CheckRow[];
  card5: CheckRow[];
  claims: ClaimRow[];
  verdict: Verdict;
  notes: string[];
  /** Input C: the gauntlet's own verdict for the strategy. */
  gauntlet?: { verdict: string; passed: number; total: number };
  /** Input B: the description, and the closest strategies we have tested. */
  description?: { text: string; claim: Claim; settings: number | null };
}

export const moneyText = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2);
  return `${v < 0 ? "-" : ""}${s}`;
};
export const pctText = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

const ASSET_RULES: [RegExp, string][] = [
  [/^(BTC|ETH|XBT|SOL|XRP|DOGE|ADA|BNB|LTC|DOT|AVAX|LINK|TRX|SUI|HYPE)/, "crypto"],
  [/^(XAU|XAG|GOLD|SILVER|WTI|BRENT|USOIL|UKOIL|XTI|XBR|NGAS|NATGAS|COPPER|CL|GC|SI)/, "commodities"],
  [/^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY|NOK|SEK)(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY|NOK|SEK)$/, "fx"],
  [/^(SPX|US500|US30|NAS100|US100|DJ30|GER40|DE40|UK100|JP225|SPY|QQQ|IWM|DIA)$/, "stocks"],
  [/^[A-Z]{1,5}$/, "stocks"],
];

export function assetClasses(trades: readonly Trade[] | undefined): string[] {
  const out = new Set<string>();
  for (const t of trades ?? []) {
    if (!t.symbol) continue;
    const s = normaliseSymbol(t.symbol);
    out.add(ASSET_RULES.find(([re]) => re.test(s))?.[1] ?? "other");
  }
  return [...out].sort();
}

function months(from: string | null, to: string | null): number {
  return from && to ? Math.max(daysBetween(from, to) / 30.44, 0) : 0;
}

/** Average compounded monthly return over the record, from its equity. */
function monthlyFrom(rs: ReturnSeries | null): number | null {
  if (!rs || !rs.dates.length || !(rs.equity0 > 0)) return null;
  const m = months(rs.dates[0], rs.dates[rs.dates.length - 1]);
  const end = rs.equity[rs.equity.length - 1];
  return m >= 1 && end > 0 ? (end / rs.equity0) ** (1 / m) - 1 : null;
}

export interface FileInput { parsed: Parsed; answers: Answers; prices: PriceBook | null; triesDefaulted?: boolean }

/** Input A: an uploaded trade log or equity curve, checked in the browser. */
export function checkFile({ parsed, answers, prices, triesDefaulted }: FileInput): Result {
  const notes: string[] = [];
  const trades = parsed.trades;
  const balance = answers.balance && answers.balance > 0 ? answers.balance : null;
  let rs: ReturnSeries | null = null;
  if (trades?.length && balance) rs = fromTrades(trades, balance);
  else if (parsed.equity?.length) rs = fromEquity(parsed.equity);
  if (rs) notes.push(...rs.warnings);
  if (trades && !balance) notes.push("No starting balance, so returns are unknown: the luck check uses the profit of each trade, and the largest fall from a high is not measured.");

  const pnls = trades?.map((t) => t.pnl) ?? [];
  const card1 = trades?.length ? expectancyCard(pnls, "trade", balance) : rs?.returns.length ? expectancyCard(rs.returns, "period", null) : null;
  const dd = rs?.equity.length ? drawdowns(rs.equity0, rs.equity, rs.dates) : undefined;
  let equityBeforeTrade: number[] | undefined;
  if (trades && balance) { let e = balance; equityBeforeTrade = trades.map((t) => { const before = e; e += t.pnl; return before; }); }
  const card2 = card1 ? tailCard({
    trades, equityBeforeTrade, avgWin: card1.avgWin, drawdown: dd,
    daily: rs ? { returns: rs.returns, pnl: rs.pnl, basis: rs.periodsPerYear >= 180 ? "daily" : "period" } : undefined,
  }) : null;

  const dateFrom = trades?.length ? day(trades[0].closeTime) : rs?.dates[0] ?? parsed.equity?.[0]?.date ?? null;
  const dateTo = trades?.length ? day(trades[trades.length - 1].closeTime) : rs?.dates[rs.dates.length - 1] ?? null;
  const spanYears = Math.max(months(dateFrom, dateTo) / 12, 1 / 12);
  const card3 = rs && rs.returns.length >= 30
    ? luckCard(rs.returns, basisFor(rs.periodsPerYear), rs.periodsPerYear, answers.tries)
    : trades?.length ? luckCard(pnls, "trade", trades.length / spanYears, answers.tries) : null;

  const fills = trades ? fillChecks(trades, prices) : null;
  const naRow = (id: string, label: string, why: string): CheckRow => ({ id, label, status: "na", detail: `${NA}: ${why}` });
  const card4: CheckRow[] = [
    fills?.fills ?? naRow("fills", "Fills outside the day's range", "an equity curve has no fills."),
    fills?.timing ?? naRow("timing", "Perfect timing", "an equity curve has no entries."),
    rs ? smoothCheck(rs.dates, rs.returns, rs.periodsPerYear >= 180) : naRow("smooth", "Too smooth", "it needs returns, so a starting balance."),
    trades ? editedCheck(trades, parsed.format === "tradingview" || parsed.format === "trades") : naRow("edited", "Edited history", "an equity curve has no trade list."),
    labelCheck(answers.kind, parsed.backtestExport),
    strategyLookAheadCheck("file"),
  ];
  const claim = claimCheck(answers.claim, {
    winRate: trades?.length ? card1?.winRate ?? null : null,
    monthlyReturn: monthlyFrom(rs),
    maxDrawdown: dd?.maxDrawdown ?? null,
  });
  const card5: CheckRow[] = [
    shortSampleCheck(trades ? trades.length : null, dateFrom, dateTo),
    fadeCheck(rs && rs.returns.length >= 30 ? rs.returns : pnls),
    trades ? concentrationCheck(trades) : naRow("conc", "Concentration", "an equity curve has no trade list."),
    settingsCheck(null, null),
    claim,
  ];
  if (parsed.backtestExport) notes.push("This is a TradingView backtest, not real trading. A backtest shows what rules would have done, not what anyone earned.");
  const money = card1?.basis === "trade" ? moneyText : (v: number) => pctText(v, 2);
  const dailyReturns = rs && rs.periodsPerYear >= 180 ? rs.returns.length : 0;
  return {
    source: "file", kind: answers.kind, tries: answers.tries, triesDefaulted: !!triesDefaulted, methodVersion: METHOD_VERSION,
    what: FORMAT_LABEL[parsed.format], dateFrom, dateTo, trades: trades ? trades.length : null, dailyReturns, balance,
    assets: assetClasses(trades), card1, card2, card3, card4, card5, claims: claimRows(answers.claim),
    verdict: verdict({ trades: trades ? trades.length : null, dailyReturns, card1, card2, card3, card4, card5, contradicted: claim.contradicted, money, pct: pctText }),
    notes,
  };
}

export interface StrategyInput {
  name: string;
  equity: [string, number][];
  tries: number;
  gauntlet?: { verdict: string; passed: number; total: number } | null;
  asset?: string;
}

/** Input C: one of our tested strategies, laid out in the same five cards, at our real number of tries. */
export function checkStrategy(x: StrategyInput): Result {
  const points: EquityPoint[] = x.equity.map(([date, v]) => ({ date, equity: v }));
  const rs = fromEquity(points);
  const card1 = rs.returns.length ? expectancyCard(rs.returns, "period", null) : null;
  const dd = drawdowns(rs.equity0, rs.equity, rs.dates);
  const card2 = card1 ? tailCard({ avgWin: card1.avgWin, drawdown: dd, daily: { returns: rs.returns, basis: "period" } }) : null;
  const card3 = luckCard(rs.returns, basisFor(rs.periodsPerYear), rs.periodsPerYear, x.tries);
  const na = (id: string, label: string, why: string): CheckRow => ({ id, label, status: "na", detail: `${NA}: ${why}` });
  const dateFrom = rs.dates[0] ?? null, dateTo = rs.dates[rs.dates.length - 1] ?? null;
  const card4 = [
    na("fills", "Fills outside the day's range", "a strategy's backtest has positions, not fills."),
    na("timing", "Perfect timing", "a strategy's backtest has positions, not fills."),
    smoothCheck(rs.dates, rs.returns, false),
    na("edited", "Edited history", "a strategy's backtest has no trade list. Every run we make is kept."),
    labelCheck("backtest", false),
    strategyLookAheadCheck("strategy"),
  ];
  const card5 = [
    shortSampleCheck(null, dateFrom, dateTo),
    fadeCheck(rs.returns),
    na("conc", "Concentration", "a strategy's backtest has no trade list."),
    settingsCheck(null, null),
    claimCheck({}, { winRate: null, monthlyReturn: null, maxDrawdown: null }),
  ];
  // Weekly or monthly results count toward "enough data" the same way daily ones do.
  const dailyLike = rs.returns.length;
  return {
    source: "strategy", kind: "backtest", tries: x.tries, triesDefaulted: false, methodVersion: METHOD_VERSION, what: x.name,
    dateFrom, dateTo, trades: null, dailyReturns: dailyLike, balance: null, assets: x.asset ? [x.asset] : [],
    card1, card2, card3, card4, card5, claims: [],
    verdict: verdict({ trades: null, dailyReturns: dailyLike, card1, card2, card3, card4, card5, contradicted: [], money: (v) => pctText(v, 2), pct: pctText }),
    notes: [`Built from the strategy's equity curve in our research run (${basisFor(rs.periodsPerYear)} values), with the ${x.tries.toLocaleString("en-US")} tries our research and search have counted.`],
    gauntlet: x.gauntlet ?? undefined,
  };
}

export interface DescriptionInput { text: string; claim: Claim; settings: number | null; trades: number | null }

/** Input B: a bot described in words. This checks the description, not the bot. */
export function checkDescription(x: DescriptionInput): Result {
  const claims = claimRows(x.claim);
  const na = (id: string, label: string): CheckRow => ({ id, label, status: "na", detail: `${NA}: a description has no trades or prices.` });
  const card4 = [na("fills", "Fills outside the day's range"), na("timing", "Perfect timing"), na("smooth", "Too smooth"), na("edited", "Edited history"),
    { id: "label", label: "Backtest labelled as real", status: "na" as const, detail: `${NA}: there is no file.` }, strategyLookAheadCheck("description")];
  const card5 = [
    { id: "short", label: "Short sample", status: "na" as const, detail: `${NA}: a description has no record.` },
    { id: "fade", label: "First part against last part", status: "na" as const, detail: `${NA}: a description has no record.` },
    { id: "conc", label: "Concentration", status: "na" as const, detail: `${NA}: a description has no trades.` },
    settingsCheck(x.settings, x.trades),
    { id: "claim", label: "Claim against file", status: "na" as const, detail: `${NA}: there is no file to compare with.` },
  ];
  const contra = claims.filter((c) => c.status === "fail" && c.id !== "uncapped");
  const uncapped = claims.find((c) => c.id === "uncapped");
  const v: Verdict = contra.length
    ? { id: "does_not_hold_up", label: "Does not hold up", sentence: `${contra[0].text} This checks the description, not the bot.` }
    : uncapped || card5[3].status === "fail"
    ? { id: "fragile", label: "Fragile", sentence: `${(uncapped ?? { text: card5[3].detail }).text} This checks the description, not the bot.` }
    : { id: "not_enough_data", label: "Not enough data", sentence: claims.length
      ? `Nothing in the description fails on arithmetic, but ${claims[0].text.charAt(0).toLowerCase()}${claims[0].text.slice(1)} A description cannot show an edge: upload the bot's trade log to check it.`
      : "Nothing in the description fails on arithmetic, and a description alone cannot show an edge. Upload the bot's trade log to check it." };
  return {
    source: "description", kind: "backtest", tries: 1, triesDefaulted: true, methodVersion: METHOD_VERSION, what: "Bot description",
    dateFrom: null, dateTo: null, trades: x.trades, dailyReturns: 0, balance: null, assets: [],
    card1: null, card2: null, card3: null, card4, card5, claims, verdict: v, notes: ["This is a check of the description, not of the bot. Running a real backtest of any description is planned for later."],
    description: { text: x.text, claim: x.claim, settings: x.settings },
  };
}
