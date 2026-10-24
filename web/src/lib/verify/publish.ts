// What leaves the browser when, and only when, the person asks (REF-0016, data handling 4
// and 5): a badge row with summary numbers and a file hash, and an opt-in dataset row with
// no user id and dates rounded to the month. Never the file, never a trade, never a
// personal column (those were dropped on parse). Acceptance test 6 checks both rows.
import type { Result } from "./checks";

/** The part of a result a badge keeps: the verdict and the five cards, no balance. */
export type PublicCards = Omit<Result, "balance" | "triesDefaulted" | "description" | "gauntlet">;

export function publicCards(r: Result): PublicCards {
  const { balance: _b, triesDefaulted: _t, description: _d, gauntlet: _g, ...rest } = r;
  // JSON has no Infinity: "never passes" is stored as -1.
  const card3 = rest.card3 && rest.card3.monthsMore === Infinity ? { ...rest.card3, monthsMore: -1 } : rest.card3;
  return { ...rest, card3 };
}

export interface BadgeInsert {
  id: string; name: string; input_kind: Result["kind"]; stated_tries: number; date_from: string | null; date_to: string | null;
  trade_count: number | null; verdict: Result["verdict"]["id"]; survives_tries: number | null; cards: PublicCards;
  method_version: string; file_sha256: string;
}

export function badgeRecord(r: Result, meta: { id: string; name: string; sha256: string }): BadgeInsert {
  return {
    id: meta.id, name: meta.name.trim().slice(0, 80), input_kind: r.kind, stated_tries: r.tries,
    date_from: r.dateFrom, date_to: r.dateTo, trade_count: r.trades, verdict: r.verdict.id,
    survives_tries: r.card3?.survives ?? null, cards: publicCards(r), method_version: r.methodVersion, file_sha256: meta.sha256,
  };
}

const month = (d: string | null) => (d ? `${d.slice(0, 7)}-01` : null);
const round = (v: number | null | undefined, d = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

export interface DatasetInsert {
  input_kind: Result["kind"]; asset_classes: string[]; stated_tries: number; month_from: string | null; month_to: string | null;
  trade_count: number | null; verdict: Result["verdict"]["id"]; summary: Record<string, unknown>; method_version: string;
}

/** The opt-in research row: numbers only, no words from the file, no exact dates, no money amounts. */
export function datasetRow(r: Result): DatasetInsert {
  const c1 = r.card1, c2 = r.card2, c3 = r.card3;
  return {
    input_kind: r.kind, asset_classes: r.assets, stated_tries: r.tries, month_from: month(r.dateFrom), month_to: month(r.dateTo),
    trade_count: r.trades, verdict: r.verdict.id, method_version: r.methodVersion,
    summary: {
      format: r.what, basis: c1?.basis ?? null, results: c1?.n ?? null,
      win_rate: round(c1?.winRate), payoff: round(c1?.payoff), break_even: round(c1?.breakEven),
      profit_factor: round(c1?.profitFactor), expectancy_of_balance: round(c1?.expectancyPct, 6),
      wins_wiped_out: round(c2?.winsWipedOut, 2), max_drawdown: round(c2?.maxDrawdown), es5: round(c2?.es5, 5), skew: round(c2?.skew, 3),
      martingale: c2?.martingale.checkable ? c2.martingale.found : null, tail_red_flag: c2?.red ?? null,
      luck_basis: c3?.basis ?? null, observations: c3?.observations ?? null, sharpe_annual: round(c3?.sharpeAnnual, 3),
      deflated_sharpe: round(c3?.dsr), survives_tries: c3?.survives ?? null,
      checks: Object.fromEntries([...r.card4, ...r.card5].map((c) => [c.id, c.status])),
    },
  };
}
