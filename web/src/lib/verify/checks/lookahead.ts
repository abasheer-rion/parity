// Card 4: look-ahead and data flags (REF-0016). Every check is listed, and each is
// passed, failed, or "cannot be checked from this input". The last group is never hidden.
import { day } from "../csv";
import { normaliseSymbol, type PriceBook } from "../prices";
import { daysBetween, monthlyReturns } from "../returns";
import { autocorr } from "../stats";
import type { InputKind, Source, Trade } from "../types";

export type Status = "pass" | "fail" | "na";
export interface CheckRow { id: string; label: string; status: Status; detail: string }

export const NA = "Cannot be checked from this input";

const pctText = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export interface FillsResult { fills: CheckRow; timing: CheckRow }

/** Fills outside the day's range, and perfect timing, against the daily prices we hold. */
export function fillChecks(trades: readonly Trade[], prices: PriceBook | null): FillsResult {
  const fillsLabel = "Fills outside the day's range";
  const timingLabel = "Perfect timing";
  const priced = trades.filter((t) => t.symbol && (t.entry != null || t.exit != null));
  if (!priced.length) {
    const why = `${NA}: the file has no symbols with entry or exit prices.`;
    return { fills: { id: "fills", label: fillsLabel, status: "na", detail: why }, timing: { id: "timing", label: timingLabel, status: "na", detail: why } };
  }
  const syms = [...new Set(priced.map((t) => t.symbol!))];
  const covered = prices ? syms.filter((s) => prices[normaliseSymbol(s)]) : [];
  if (!prices || !covered.length) {
    const why = `${NA}: we hold no daily prices for ${listSyms(syms)}.`;
    return { fills: { id: "fills", label: fillsLabel, status: "na", detail: why }, timing: { id: "timing", label: timingLabel, status: "na", detail: why } };
  }
  const missingSyms = syms.filter((s) => !covered.includes(s));
  const note = missingSyms.length ? ` ${listSyms(missingSyms)} could not be checked: we hold no daily prices for ${missingSyms.length === 1 ? "it" : "them"}.` : "";

  let checked = 0, outside = 0, farChecked = 0, far = 0;
  let entries = 0, perfect = 0;
  const hlSyms = new Set<string>(), priceSyms = new Set<string>();
  const example: string[] = [];
  for (const t of priced) {
    const ps = prices[normaliseSymbol(t.symbol!)];
    if (!ps) continue;
    const legs: [number | undefined, string | undefined, boolean][] = [[t.entry, t.openTime, true], [t.exit, t.closeTime, false]];
    for (const [price, when, isEntry] of legs) {
      if (price == null || !when) continue;
      const range = ps.days.get(day(when));
      if (!range) continue;
      const [lo, hi] = range;
      if (ps.kind === "hl") {
        hlSyms.add(t.symbol!);
        checked++;
        if (price < lo * (1 - 0.001) || price > hi * (1 + 0.001)) {
          outside++;
          if (example.length < 1) example.push(`${t.symbol} at ${price} on ${day(when)}, when that day traded from ${lo} to ${hi}`);
        }
        if (isEntry && t.side) {
          entries++;
          if (t.side === "buy" ? price <= lo * 1.0005 : price >= hi * 0.9995) perfect++;
        }
      } else if (ps.bound) {
        priceSyms.add(t.symbol!);
        farChecked++;
        if (Math.abs(price / lo - 1) > ps.bound) {
          far++;
          if (example.length < 1) example.push(`${t.symbol} at ${price} on ${day(when)}, when our price that day was ${lo}`);
        }
      }
    }
  }

  let fills: CheckRow;
  if (checked) {
    fills = outside
      ? { id: "fills", label: fillsLabel, status: "fail", detail: `${outside} of ${checked} fills are more than 0.1% outside that day's high and low, for example ${example[0]}.${note}` }
      : { id: "fills", label: fillsLabel, status: "pass", detail: `All ${checked} fills we could match sit inside that day's high and low (0.1% allowed).${note}` };
  } else if (farChecked) {
    fills = far
      ? { id: "fills", label: "Fills far from the day's price", status: "fail", detail: `${far} of ${farChecked} fills are further from that day's price than the day's range could plausibly reach, for example ${example[0]}. We hold one price a day for ${listSyms([...priceSyms])}, not its high and low.${note}` }
      : { id: "fills", label: "Fills far from the day's price", status: "pass", detail: `All ${farChecked} fills sit within a plausible day's range of that day's price. We hold one price a day for ${listSyms([...priceSyms])}, not its high and low, so only fills far outside the range would show.${note}` };
  } else {
    fills = { id: "fills", label: fillsLabel, status: "na", detail: `${NA}: no fill date matched a day we hold prices for.${note}` };
  }

  let timing: CheckRow;
  if (entries >= 10) {
    const share = perfect / entries;
    timing = share > 0.3
      ? { id: "timing", label: timingLabel, status: "fail", detail: `${pctText(share)} of ${entries} entries are within 0.05% of the day's best price (the low for buys, the high for sells). Real traders rarely do this. A backtest that trades at the same price it used as its signal often does.` }
      : { id: "timing", label: timingLabel, status: "pass", detail: `${pctText(share)} of ${entries} entries are within 0.05% of the day's best price, at or under the 30% line.` };
  } else if (hlSyms.size) {
    timing = { id: "timing", label: timingLabel, status: "na", detail: `${NA}: fewer than 10 dated entries with a buy or sell side matched our daily highs and lows.` };
  } else {
    timing = { id: "timing", label: timingLabel, status: "na", detail: `${NA}: we hold one price a day for ${listSyms([...(priceSyms.size ? priceSyms : new Set(covered))])}, not the day's high and low.` };
  }
  return { fills, timing };
}

function listSyms(s: string[]): string {
  if (s.length <= 3) return s.join(s.length === 2 ? " and " : ", ");
  return `${s.slice(0, 3).join(", ")} and ${s.length - 3} more`;
}

/** Too smooth: lag-one autocorrelation above 0.3, or no losing month in over 24 months with under 3% losing days. */
export function smoothCheck(dates: readonly string[], returns: readonly number[], basisDaily: boolean): CheckRow {
  const label = "Too smooth";
  if (returns.length < 30) return { id: "smooth", label, status: "na", detail: `${NA}: it needs at least 30 dated returns.` };
  const ac = autocorr(returns);
  const months = monthlyReturns([...dates], [...returns]);
  const losingMonths = months.filter((m) => m.ret < 0).length;
  const losingDays = returns.filter((r) => r < 0).length / returns.length;
  if (ac > 0.3) return { id: "smooth", label, status: "fail", detail: `Each return looks too much like the one before (autocorrelation ${ac.toFixed(2)}, above 0.3). Smoothed or stale prices do this.` };
  if (basisDaily && months.length > 24 && losingMonths === 0 && losingDays < 0.03) {
    return { id: "smooth", label, status: "fail", detail: `No losing month in ${months.length} months, and only ${pctText(losingDays, 1)} of days lost. Real records are rarely this smooth.` };
  }
  return { id: "smooth", label, status: "pass", detail: `Autocorrelation ${ac.toFixed(2)} (0.3 is the line), ${losingMonths} losing month${losingMonths === 1 ? "" : "s"} of ${months.length}.` };
}

/** Edited history: long silent gaps in a record that otherwise trades most days, or trade numbers that skip. */
export function editedCheck(trades: readonly Trade[], sequentialIds: boolean): CheckRow {
  const label = "Edited history";
  if (trades.length < 10) return { id: "edited", label, status: "na", detail: `${NA}: it needs at least 10 trades.` };
  const days = [...new Set(trades.map((t) => day(t.closeTime)))].sort();
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const longGaps = gaps.map((g, i) => [g, i] as const).filter(([g]) => g > 30);
  if (median <= 3 && longGaps.length) {
    const [g, i] = longGaps.sort((a, b) => b[0] - a[0])[0];
    return { id: "edited", label, status: "fail", detail: `The record trades most days, but has ${longGaps.length} gap${longGaps.length === 1 ? "" : "s"} of more than 30 days with no trades (the longest is ${g} days, after ${days[i]}). Deleted trades can leave gaps like this.` };
  }
  if (sequentialIds) {
    const ids = trades.map((t) => Number(t.id)).filter((v) => Number.isInteger(v)).sort((a, b) => a - b);
    if (ids.length >= trades.length * 0.9) {
      const steps = ids.slice(1).map((v, i) => v - ids[i]);
      const ones = steps.filter((s) => s === 1).length;
      const skips = steps.map((s, i) => [s, i] as const).filter(([s]) => s > 1);
      if (steps.length && ones >= steps.length * 0.9 && skips.length) {
        const [, i] = skips[0];
        const missing = skips.reduce((n, [s]) => n + s - 1, 0);
        return { id: "edited", label, status: "fail", detail: `Trade numbers run in order but skip ${missing} number${missing === 1 ? "" : "s"} (the first jump is from ${ids[i]} to ${ids[i + 1]}). Deleted trades leave holes like this.` };
      }
    }
    return { id: "edited", label, status: "pass", detail: "No long silent gaps, and trade numbers do not skip." };
  }
  return { id: "edited", label, status: "pass", detail: "No long silent gaps. Ticket numbers are shared across a broker's whole server, so their skips say nothing and are not checked." };
}

/** Backtest labelled as real: the person said real money, but the file is a TradingView strategy export. */
export function labelCheck(kind: InputKind, backtestExport: boolean): CheckRow {
  const label = "Backtest labelled as real";
  if (kind === "real" && backtestExport) return { id: "label", label, status: "fail", detail: "You said this is real money, but the file is a TradingView Strategy Tester export, which is always a backtest." };
  return { id: "label", label, status: "pass", detail: backtestExport ? "The file is a TradingView backtest, and it is labelled as one." : "Nothing in the file contradicts how it is labelled." };
}

/** Our cut-the-data test (DEC-0014): input C only. */
export function strategyLookAheadCheck(source: Source): CheckRow {
  const label = "Strategy look-ahead test";
  if (source !== "strategy") return { id: "cut", label, status: "na", detail: `${NA}: it needs the strategy's code, so it runs only for strategies we tested ourselves.` };
  return { id: "cut", label, status: "pass", detail: "Our test suite cuts the data at several dates and checks that no earlier position changes. Every strategy in our list passes it." };
}
