// Card 4's rows from the fill price check (DEC-0092), in plain words. They say what our data
// source shows, never that anyone faked anything: "N fills fall outside the traded range on
// our data source". The bars' prices are never quoted, only the person's own fills.
import type { CheckRow } from "../checks/lookahead";
import type { Trade } from "../types";
import type { RangeOutcome } from "./client";
import { sourceWords } from "./info";
import { marketOfSent } from "./market";
import type { NoneWhy } from "./types";

const NA = "Cannot be checked from this input";
export const RANGE_LABEL = "Fill prices against the traded range";
export const SESSION_LABEL = "Fills while the market was closed";
const TIMING_LABEL = "Perfect timing";

/** Fails when more than this share of the checked fills, and at least MIN_COUNT, are outside or closed. */
export const FAIL_SHARE = 0.02;
export const FAIL_MIN = 2;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const list = (s: string[]) => (s.length <= 3 ? s.join(s.length === 2 ? " and " : ", ") : `${s.slice(0, 3).join(", ")} and ${s.length - 3} more`);
const when = (t: string) => (t.length > 10 ? `${t.slice(0, 10)} ${t.slice(11, 16)}` : t);
const zone = (o: number) => `UTC${o >= 0 ? "+" : "-"}${Math.floor(Math.abs(o) / 60)}${Math.abs(o) % 60 ? `:${String(Math.abs(o) % 60).padStart(2, "0")}` : ""}`;

const WHY: Record<NoneWhy, string> = {
  sym: "no data source we may use covers",
  data: "our data source had no trading near the time of",
  late: "our data source does not yet cover the last few minutes for",
  busy: "our data source did not answer in time for",
  more: "the check ran out of time for",
  time: "our on-chain source needs an exact time of day in a known time zone, which the file does not give, for",
  old: "our on-chain source keeps only about the last eight weeks of swaps, which does not reach back to",
};

/** Why the check did not run, as a card 4 row and the closed-market row. */
export function notRunRows(o: Extract<RangeOutcome, { ran: false }> | null): CheckRow[] {
  const why = !o ? `${NA}: the fill price check was not run for this record.`
    : o.why === "opted_out" ? "Not run: you chose to keep every part of the file in this browser. Leave \"Check fill prices against market data\" on to run it."
    : o.why === "signed_out" ? "Not checked while signed out: the fill price check runs on our server for signed-in accounts. Sign in and run the check again."
    : o.why === "off" ? "Not run: the fill price check is switched off on this server."
    : o.why === "nothing" ? `${NA}: the file has no fills with a symbol, a time and a price.`
    : `Not run: ${o.message ?? "the fill price check could not be reached. Try again in a minute."}`;
  return [
    { id: "range", label: RANGE_LABEL, status: "na", detail: why },
    { id: "session", label: SESSION_LABEL, status: "na", detail: why },
  ];
}

/**
 * The rows from a finished check: fill prices against the traded range, fills while the
 * market was closed, and (when enough entries have a known day's range) perfect timing.
 */
export function rangeRows(o: Extract<RangeOutcome, { ran: true }>, trades: readonly Trade[]): { range: CheckRow; session: CheckRow; timing: CheckRow | null } {
  const fileSym = (i: number) => trades[o.points[i].legs[0].trade]?.symbol ?? o.points[i].s;
  const idx = o.answers.map((_, i) => i);
  const isIn = idx.filter((i) => o.answers[i].r === "in");
  const out = idx.filter((i) => o.answers[i].r === "out");
  const closed = idx.filter((i) => o.answers[i].r === "closed");
  const none = idx.filter((i) => o.answers[i].r === "none");
  const checked = isIn.length + out.length;
  const atEdge = isIn.filter((i) => o.answers[i].e === "h" || o.answers[i].e === "l").length;
  const dayOnly = [...isIn, ...out].filter((i) => o.answers[i].b === "d").length;

  // Which sources answered, and how each judges, in words.
  const used = [...new Set([...isIn, ...out, ...closed].map((i) => o.answers[i].src).filter((s): s is string => !!s))];
  const sources = used.map((id) => sourceWords(id)).filter((w) => !!w).map((w) => w!.what);
  const credits = used.map((id) => sourceWords(id)?.credit).filter((c): c is string => !!c);
  const sourceText = sources.length ? ` Compared with ${sources.join("; and ")}.${credits.length ? ` ${credits.join(" ")}` : ""}` : "";
  const offsetText = o.clock === "unknown" && o.offset != null
    ? ` The file does not say which time zone its times are in; ${zone(o.offset)} fits the most fills, so they were read in it (an hour either way for summer time).`
    : o.clock === "unknown" ? " The file does not say which time zone its times are in, so every time zone was tried and a fill counts as inside when it is inside at any of them." : "";

  // What was not checked, grouped by why.
  const byWhy = new Map<NoneWhy, Set<string>>();
  for (const i of none) {
    const n = o.answers[i].n ?? "data";
    if (!byWhy.has(n)) byWhy.set(n, new Set());
    byWhy.get(n)!.add(fileSym(i));
  }
  const unc = Object.keys(o.uncovered ?? {});
  const uncN = Object.values(o.uncovered ?? {}).reduce((t, k) => t + k, 0);
  if (unc.length) {
    const have = byWhy.get("sym") ?? new Set<string>();
    for (const x of unc) have.add(x);
    byWhy.set("sym", have);
  }
  const reasons = [...byWhy].map(([n, syms]) => `${WHY[n]} ${list([...syms])}`);
  if (o.skipped) reasons.push(`${plural(o.skipped, "fill has", "fills have")} no time or a symbol we cannot read, such as a future or an option`);
  const notText = reasons.length ? ` ${plural(none.length + o.skipped + uncN, "fill was", "fills were")} not checked: ${reasons.join("; ")}.` : "";

  let range: CheckRow;
  if (!checked) {
    range = { id: "range", label: RANGE_LABEL, status: "na", detail: `${NA}: ${reasons.length ? reasons.join("; ") : "no fill matched our data sources"}.` };
  } else {
    const ex = out[0] != null ? `${fileSym(out[0])} at ${o.points[out[0]].p} on ${when(o.points[out[0]].t)}` : "";
    const fails = out.length >= FAIL_MIN && out.length / checked > FAIL_SHARE;
    const edgeText = atEdge ? ` ${plural(atEdge, "fill sits", "fills sit")} at the day's exact high or low.` : "";
    const dayText = dayOnly ? ` ${plural(dayOnly, "fill was", "fills were")} compared with the day's low and high, because nothing traded on our source in the minutes around ${dayOnly === 1 ? "it" : "them"}.` : "";
    const detail = !out.length
      ? `All ${plural(checked, "fill")} we could check sit inside the range traded at that time on our data source.`
      : fails
        ? `${out.length.toLocaleString("en-US")} of ${plural(checked, "fill")} fall outside the traded range on our data source, for example ${ex}.`
        : `${out.length.toLocaleString("en-US")} of ${plural(checked, "fill")} ${out.length === 1 ? "falls" : "fall"} outside the traded range on our data source (${ex}). One or two can come from fills at an average price, late reports or a different venue, so this alone does not fail the check.`;
    range = { id: "range", label: RANGE_LABEL, status: fails ? "fail" : "pass", detail: `${detail}${edgeText}${dayText}${sourceText}${offsetText}${notText}` };
  }

  // Closed market: US stocks and currencies only; crypto trades every day.
  const timed = [...isIn, ...out, ...closed].filter((i) => marketOfSent(o.points[i].s) !== "crypto");
  let session: CheckRow;
  if (!timed.length) {
    const crypto = [...isIn, ...out].some((i) => marketOfSent(o.points[i].s) === "crypto");
    session = { id: "session", label: SESSION_LABEL, status: "na", detail: crypto ? `${NA}: crypto trades every day, so there is no closed time to check.` : `${NA}: no fill matched our data sources.` };
  } else {
    const c = closed.length;
    const ex = c ? `${fileSym(closed[0])} on ${new Date(`${o.points[closed[0]].t.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })} ${when(o.points[closed[0]].t)}` : "";
    const fails = c >= FAIL_MIN && c / timed.length > FAIL_SHARE;
    session = {
      id: "session", label: SESSION_LABEL, status: fails ? "fail" : "pass",
      detail: !c ? `None of ${plural(timed.length, "fill")} is timed on a weekend or a market holiday.`
        : fails ? `${c.toLocaleString("en-US")} of ${plural(timed.length, "fill")} are timed when the market was closed on our data source (a weekend or a market holiday, New York time), for example ${ex}.`
        : `${c.toLocaleString("en-US")} of ${plural(timed.length, "fill")} ${c === 1 ? "is" : "are"} timed when the market was closed on our data source (${ex}). A wrong date on a row or two can do this, so it alone does not fail the check.`,
    };
  }

  // Perfect timing: entries at the day's best price (the low for a buy, the high for a sell).
  let entries = 0, best = 0;
  o.points.forEach((pt, i) => {
    const a = o.answers[i];
    if (a.r !== "in" || !a.e) return;
    for (const l of pt.legs) {
      const t = trades[l.trade];
      if (l.leg !== "entry" || !t?.side) continue;
      entries++;
      if ((t.side === "buy" && a.e === "l") || (t.side === "sell" && a.e === "h")) best++;
    }
  });
  let timing: CheckRow | null = null;
  if (entries >= 10) {
    const share = best / entries;
    timing = share > 0.3
      ? { id: "timing", label: TIMING_LABEL, status: "fail", detail: `${pct(share)} of ${plural(entries, "entry", "entries")} are at the day's best price on our data source (the low for buys, the high for sells). Real traders rarely do this. A backtest that trades at the same price it used as its signal often does.` }
      : { id: "timing", label: TIMING_LABEL, status: "pass", detail: `${pct(share)} of ${plural(entries, "entry", "entries")} are at the day's best price on our data source, at or under the 30% line.` };
  }
  return { range, session, timing };
}
