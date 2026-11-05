// Each claim read from a seller's page, set against a record (DEC-0088): what the page says,
// what the record shows, and whether they agree. Without a record, each claim says what
// would be needed to check it. The rates that decide the verdict use the same lines as
// "Claim against file" (checks/overfit.ts); the rest are shown and never change the verdict.
import type { Result } from "../checks/index";
import { claimOff, samePeriod } from "../checks/overfit";
import { chosen, COMPARED, FIELD_LABEL, type ClaimField, type FoundClaim } from "./extract";

export type AgainstStatus = "agrees" | "differs" | "cannot" | "needs_record" | "not_compared";

export interface AgainstRow {
  field: ClaimField;
  label: string;
  /** The claim as the page writes it, and the words around it. */
  shown: string;
  quote: string;
  how: FoundClaim["how"];
  rule: string;
  /** The record's value in words, or null. */
  record: string | null;
  status: AgainstStatus;
  /** One sentence: why it agrees, differs or cannot be checked. */
  why: string;
  /** True when a difference here changes the verdict (the rates in "Claim against file"). */
  decides: boolean;
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, "")}%`;
const int = (v: number) => Math.round(v).toLocaleString("en-US");

const NEED: Partial<Record<ClaimField, string>> = {
  totalReturn: "the account's trade history with its starting balance, or its daily balance",
  monthlyReturn: "the account's trade history with its starting balance, or its daily balance",
  yearlyReturn: "the account's trade history with its starting balance, or its daily balance",
  winRate: "the account's trade history",
  maxDrawdown: "the account's daily balance, or its trade history with the starting balance",
  trades: "the account's trade history",
  profitFactor: "the account's trade history",
  startDate: "the account's trade history",
  months: "the account's trade history",
};

const NOT_COMPARED: Partial<Record<ClaimField, string>> = {
  pips: "Pips depend on position size and the market, so they say nothing about return. Not compared.",
  sharpe: "Sites work the Sharpe ratio out in different ways (per trade, per day, with or without cash), so it is not compared. The luck check uses our own.",
  tradesPerMonth: "Shown for the settings check; not compared with the record.",
  leverage: "Leverage is a setting, not a result. Not compared.",
  takeProfit: "Used in the claim arithmetic below.",
  stopLoss: "Used in the claim arithmetic below.",
  noStop: "Used in the claim arithmetic below.",
  maxLoss: "Used in the claim arithmetic below.",
  avgLoss: "Used in the claim arithmetic below.",
  grid: "Used in the claim arithmetic below.",
  martingale: "Used in the claim arithmetic below.",
  maxLossCapped: "Used in the claim arithmetic below.",
};

/** Months between two YYYY-MM-DD dates. */
const monthsBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 / 30.44;

/**
 * One row per claim the checks use (the first label on a statistics page, else the first
 * sentence; the largest of several drawdowns), in page order, set against the record `r`
 * when there is one. The other claims found are listed after, marked as not compared.
 */
export function claimsAgainst(found: readonly FoundClaim[], r: Result | null): AgainstRow[] {
  const pick = chosen(found);
  const claimMonths = pick.get("months")?.value;
  const rows: AgainstRow[] = [];
  const isRecord = !!r && r.source !== "description";
  for (const f of [...pick.values()].sort((a, b) => a.at - b.at)) {
    const base = { field: f.field, label: FIELD_LABEL[f.field], shown: f.shown, quote: f.quote, how: f.how, rule: f.rule };
    if (!COMPARED.includes(f.field)) {
      rows.push({ ...base, record: null, status: "not_compared", why: NOT_COMPARED[f.field] ?? "Not compared.", decides: false });
      continue;
    }
    if (!isRecord) {
      rows.push({ ...base, record: null, status: "needs_record", why: `To check it, upload ${NEED[f.field] ?? "the account's trade history"}.`, decides: false });
      continue;
    }
    rows.push({ ...base, ...compare(f, r!, typeof claimMonths === "number" ? claimMonths : undefined) });
  }
  return rows;
}

function compare(f: FoundClaim, r: Result, claimMonths?: number): Pick<AgainstRow, "record" | "status" | "why" | "decides"> {
  const v = f.value;
  const cannot = (why: string) => ({ record: null, status: "cannot" as const, why, decides: false });
  const rate = (name: "win rate" | "monthly return" | "largest fall from a high" | "total return", file: number | null | undefined, why: string) => {
    if (typeof v !== "number") return cannot("The page's value is not a number.");
    if (file == null) return cannot(why);
    const off = claimOff(name, v, file);
    const line = name === "total return" ? "more than 5 points and more than a tenth apart" : "more than 5 points apart";
    return {
      record: pct(file), status: off ? ("differs" as const) : ("agrees" as const), decides: true,
      why: off ? `The page says ${pct(v)}; the record shows ${pct(file)}: ${line}.` : `The page says ${pct(v)}; the record shows ${pct(file)}: close enough (${name === "total return" ? "within 5 points or a tenth" : "within 5 points"}).`,
    };
  };
  const noBalance = "The record has no starting balance, so its returns are unknown. Enter the balance and check again.";
  switch (f.field) {
    case "totalReturn": {
      const fileMonths = r.dateFrom && r.dateTo ? monthsBetween(r.dateFrom, r.dateTo) : null;
      if (!samePeriod(claimMonths, fileMonths)) return cannot(`The page's return is for ${claimMonths!.toFixed(claimMonths! % 1 ? 1 : 0)} months; the record covers ${fileMonths!.toFixed(1)}. Upload a record of the same period to compare them.`);
      return rate("total return", r.facts?.totalReturn, noBalance);
    }
    case "monthlyReturn": return rate("monthly return", r.facts?.monthlyReturn, r.facts?.totalReturn != null ? "The record is shorter than a month." : noBalance);
    case "maxDrawdown": return rate("largest fall from a high", r.card2?.maxDrawdown, noBalance);
    case "winRate": return rate("win rate", r.card1?.basis === "trade" ? r.card1.winRate : null, "The record has no trade list, so it has no win rate.");
    case "yearlyReturn": {
      const y = r.facts?.yearlyReturn;
      if (typeof v !== "number") return cannot("The page's value is not a number.");
      if (y == null) return cannot(noBalance);
      const off = Math.abs(v - y) > 0.05 && Math.abs(v - y) > 0.1 * Math.max(Math.abs(v), Math.abs(y));
      return { record: pct(y), status: off ? "differs" : "agrees", decides: false, why: `The page says ${pct(v)} a year; the record compounds to ${pct(y)} a year.${off ? " Shown, not used in the verdict: sites work a year's return out in different ways." : ""}` };
    }
    case "trades": {
      if (typeof v !== "number" || r.trades == null) return cannot("The record has no trade list.");
      const n = r.trades;
      const off = n < v * 0.9 || n > v * 1.1;
      return { record: int(n), status: off ? "differs" : "agrees", decides: false, why: off ? `The page says ${int(v)} trades; the record has ${int(n)}. It may cover a different period or account. Shown, not used in the verdict.` : `The page says ${int(v)} trades; the record has ${int(n)}, within a tenth.` };
    }
    case "profitFactor": {
      const pf = r.card1?.basis === "trade" ? r.card1.profitFactor : null;
      if (typeof v !== "number" || pf == null || !Number.isFinite(pf)) return cannot("The record has no trade list with both wins and losses.");
      const off = Math.abs(v - pf) > 0.2 && Math.abs(v - pf) > 0.1 * Math.max(v, pf);
      return { record: pf.toFixed(2), status: off ? "differs" : "agrees", decides: false, why: `The page says ${v.toFixed(2)}; the record's profit factor is ${pf.toFixed(2)}.${off ? " Shown, not used in the verdict." : ""}` };
    }
    case "startDate": {
      if (typeof v !== "string" || !r.dateFrom) return cannot("The record has no dates.");
      const gap = Math.abs(monthsBetween(v, r.dateFrom));
      const off = gap > 1;
      const later = r.dateFrom > v;
      return { record: r.dateFrom, status: off ? "differs" : "agrees", decides: false, why: off ? `The page says it started ${v}; the record starts ${r.dateFrom}. ${later ? "A record that starts later can leave out early losses." : "The record covers time before the page's start, so it may be a different account."} Shown, not used in the verdict.` : `The page says it started ${v}; the record starts ${r.dateFrom}.` };
    }
    case "months": {
      if (typeof v !== "number" || !r.dateFrom || !r.dateTo) return cannot("The record has no dates.");
      const m = monthsBetween(r.dateFrom, r.dateTo);
      const off = m < v * 0.8;
      return { record: `${m.toFixed(1)} months`, status: off ? "differs" : "agrees", decides: false, why: off ? `The page speaks of ${v.toFixed(v % 1 ? 1 : 0)} months; the record covers ${m.toFixed(1)}. Shown, not used in the verdict.` : `The record covers ${m.toFixed(1)} months.` };
    }
    default: return cannot("Not compared.");
  }
}

/** A sentence for the top of the claims section: how many agree, differ or need a record. */
export function againstSummary(rows: readonly AgainstRow[]): string {
  const n = (s: AgainstStatus) => rows.filter((r) => r.status === s).length;
  const compared = rows.filter((r) => r.status !== "not_compared").length;
  if (!rows.length) return "No claims were found in the words.";
  if (n("needs_record") === compared && compared) return `None can be checked without the record behind ${compared === 1 ? "it" : "them"}: upload the account's trade history to check ${compared === 1 ? "it" : "them"}.`;
  const parts = [n("agrees") && `${n("agrees")} agree with the record`, n("differs") && `${n("differs")} differ from it`, n("cannot") && `${n("cannot")} cannot be checked from it`].filter(Boolean);
  return `${compared} claim${compared === 1 ? "" : "s"} compared: ${parts.join(", ")}.`;
}
