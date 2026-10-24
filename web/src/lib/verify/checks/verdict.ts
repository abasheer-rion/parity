// The verdict (REF-0016): one of five, and one sentence written from the numbers that
// decided it. Order of precedence: not enough data, does not hold up, fragile, could be
// luck, holds up.
import type { ExpectancyCard } from "./expectancy";
import type { CheckRow } from "./lookahead";
import type { LuckCard } from "./luck";
import type { TailCard } from "./tail";

export type VerdictId = "holds_up" | "could_be_luck" | "fragile" | "does_not_hold_up" | "not_enough_data";

export const VERDICT_LABEL: Record<VerdictId, string> = {
  holds_up: "Holds up",
  could_be_luck: "Could be luck",
  fragile: "Fragile",
  does_not_hold_up: "Does not hold up",
  not_enough_data: "Not enough data",
};

export const VERDICT_TONE: Record<VerdictId, "positive" | "caution" | "negative" | "neutral"> = {
  holds_up: "positive", could_be_luck: "caution", fragile: "caution", does_not_hold_up: "negative", not_enough_data: "neutral",
};

export interface Verdict { id: VerdictId; label: string; sentence: string }

export const MIN_TRADES = 30;
export const MIN_RETURNS = 60;

export interface VerdictInput {
  trades: number | null;
  dailyReturns: number;
  card1: ExpectancyCard | null;
  card2: TailCard | null;
  card3: LuckCard | null;
  card4: CheckRow[];
  card5: CheckRow[];
  /** Claims the file contradicts, in words. */
  contradicted: string[];
  /** Money text for one result (a trade's profit, or a period's return). */
  money: (v: number) => string;
  pct: (v: number, d?: number) => string;
}

const big = (v: number) => (v >= 10 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1));
const triesText = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "try" : "tries"}`;

export function survivesText(n: number | null): string {
  if (n == null) return "Cannot be measured";
  if (n === 0) return "Survives no tries";
  if (n >= 1_000_000_000) return "Survives more than 1 billion tries";
  return `Survives up to ${n.toLocaleString("en-US")} ${n === 1 ? "try" : "tries"}`;
}

export function verdict(x: VerdictInput): Verdict {
  const v = (id: VerdictId, sentence: string): Verdict => ({ id, label: VERDICT_LABEL[id], sentence });
  const c1 = x.card1, c3 = x.card3;
  const perTrade = c1?.basis === "trade";
  const unit = perTrade ? "trade" : "period";

  if ((x.trades == null || x.trades < MIN_TRADES) && x.dailyReturns < MIN_RETURNS) {
    return v("not_enough_data", `Only ${x.trades ?? 0} trades and ${x.dailyReturns} daily returns. Verify needs at least ${MIN_TRADES} trades or ${MIN_RETURNS} daily returns before it can say anything.`);
  }
  if (x.contradicted.length) {
    return v("does_not_hold_up", `The file does not back the claim: ${x.contradicted.join("; ")}.`);
  }
  if (c1 && c1.expectancy <= 0) {
    if (c1.avgWin && c1.avgLoss && c1.breakEven != null && c1.winRate >= 0.5) {
      const k = c1.avgLoss / c1.avgWin;
      return v("does_not_hold_up", `Wins ${x.pct(c1.winRate)} of ${unit}s, but the ${x.pct(c1.lossRate)} of losses are ${big(k)} times larger than the average win, so on average each ${unit} loses ${x.money(-c1.expectancy)}, about ${Math.round((-c1.expectancy / c1.avgWin) * 100)}% of a typical win. It would need to win ${x.pct(c1.breakEven!)} to break even.`);
    }
    return v("does_not_hold_up", `On average each ${unit} loses ${x.money(-c1.expectancy)} after fees, with ${x.pct(c1.winRate)} winners. A record that loses on average does not hold up, whatever else it shows.`);
  }
  const gain = c1 ? `Makes ${x.money(c1.expectancy)} a ${unit} on average${perTrade ? ` over ${c1.n.toLocaleString("en-US")} trades` : ""}` : "Makes money on average";
  if (x.card2?.red) return v("fragile", `${gain}, but ${x.card2.reasons.join(", and ")}. One bad stretch could undo it.`);

  const failed = [...x.card4, ...x.card5].filter((r) => r.status === "fail" && r.id !== "claim");
  const luckFails = !c3 || c3.dsr == null || c3.dsr < 0.95;
  if (luckFails || failed.length) {
    const parts: string[] = [];
    if (c3?.dsr != null && c3.dsr < 0.95) parts.push(`after ${triesText(c3.tries)} the luck check is ${c3.dsr.toFixed(3)}, below the 0.95 line (${survivesText(c3.survives).toLowerCase()})`);
    else if (c3?.dsr == null) parts.push("the luck check cannot be measured from this record");
    for (const f of failed) parts.push(`the "${f.label.toLowerCase()}" check failed`);
    return v("could_be_luck", `${gain}, but ${parts.join(", and ")}.`);
  }
  return v("holds_up", `${gain}, and after ${triesText(c3!.tries)} the luck check is ${c3!.dsr!.toFixed(3)}, above the 0.95 line. ${survivesText(c3!.survives)}.`);
}
