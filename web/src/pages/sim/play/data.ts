// Windows of time, past crises and series lined up on the weekly dates, shared by the
// replay tabs (DEC-0020). Everything here reads the world file; nothing is invented.
import type { WorldData } from "../../../lib/world";
import { indexAtOrBefore } from "../../../lib/world";
import type { Band } from "./Stage";

export interface Crisis {
  id: string; label: string; short: string;
  /** The stress itself, drawn as a band. */
  start: string; end: string;
  /** The window replayed: a little before and after. */
  from: string; to: string;
  note: string;
}

export const CRISES: Crisis[] = [
  { id: "dotcom", label: "Dot-com crash", short: "Dot-com", start: "2000-03-24", end: "2002-10-09", from: "2000-01-07", to: "2003-03-28",
    note: "US tech shares collapsed after the late 1990s boom; the S&P 500 fell by about half over two and a half years." },
  { id: "gfc", label: "Global financial crisis", short: "2008", start: "2007-10-09", end: "2009-03-09", from: "2007-07-06", to: "2009-09-25",
    note: "US housing losses spread through banks worldwide; Lehman Brothers failed in September 2008." },
  { id: "euro", label: "Euro debt crisis", short: "Euro crisis", start: "2011-04-29", end: "2011-10-03", from: "2011-03-04", to: "2012-08-31",
    note: "Fear that Greece, Italy and Spain could not pay their debts, until the ECB promised in July 2012 to do whatever it takes." },
  { id: "taper", label: "Taper tantrum", short: "Taper", start: "2013-05-22", end: "2013-09-05", from: "2013-04-05", to: "2013-12-27",
    note: "The Fed hinted it would slow its bond buying; US yields jumped and money left emerging markets." },
  { id: "oil", label: "Oil crash 2014 to 2016", short: "Oil crash", start: "2014-06-20", end: "2016-02-11", from: "2014-05-02", to: "2016-06-24",
    note: "US shale and OPEC's refusal to cut sent oil from over $100 to under $30 a barrel." },
  { id: "covid", label: "Covid crash", short: "Covid", start: "2020-02-19", end: "2020-03-23", from: "2020-01-03", to: "2020-08-28",
    note: "The fastest fall in US shares on record as the pandemic spread, then a fast rebound on rescue money." },
  { id: "inflation", label: "2022 inflation", short: "2022", start: "2022-01-03", end: "2022-10-12", from: "2021-11-05", to: "2023-03-31",
    note: "Inflation at 40-year highs and the fastest rate rises in decades hit shares and bonds at the same time." },
];

export interface Win { id: string; label: string }

export const WINDOWS: Win[] = [
  { id: "1y", label: "Last year" }, { id: "5y", label: "Last 5 years" }, { id: "10y", label: "Last 10 years" },
  { id: "2000", label: "2000 on" }, { id: "all", label: "Since 1986" },
  ...CRISES.map((c) => ({ id: c.id, label: c.label })),
];

const isoMinus = (iso: string, days: number) => new Date(Date.parse(iso) - days * 86_400_000).toISOString().slice(0, 10);

/** First and last frame of a window on a list of dates. */
export function windowRange(dates: string[], win: string, last = dates.length - 1): [number, number] {
  const crisis = CRISES.find((c) => c.id === win);
  const endDate = dates[last] ?? "";
  const from = crisis ? crisis.from : win === "1y" ? isoMinus(endDate, 365) : win === "5y" ? isoMinus(endDate, 5 * 365.25)
    : win === "10y" ? isoMinus(endDate, 10 * 365.25) : win === "2000" ? "2000-01-01" : "0000";
  const to = crisis ? crisis.to : endDate;
  const a = Math.max(0, indexAtOrBefore(dates, from) + (dates[Math.max(0, indexAtOrBefore(dates, from))] < from ? 1 : 0));
  const b = Math.min(last, Math.max(a, indexAtOrBefore(dates, to)));
  return [a, b];
}

/** Crisis bands inside a run of dates, in frame numbers from 0. */
export function crisisBands(dates: string[]): Band[] {
  if (!dates.length) return [];
  const first = dates[0], last = dates[dates.length - 1];
  return CRISES.filter((c) => c.end >= first && c.start <= last).map((c) => {
    const a = Math.max(0, indexAtOrBefore(dates, c.start));
    const b = Math.max(a, indexAtOrBefore(dates, c.end));
    return { label: c.short, a, b, title: c.label };
  });
}

/** Last weekly point of each date in `dates` that is at least `days` older: for 1-year changes. */
export function agoIndex(dates: string[], k: number, days = 365): number {
  return indexAtOrBefore(dates, isoMinus(dates[k], days));
}

/** Year labels for an x axis of `dates`, thinned to fit `width`. */
export function yearTicks(dates: string[], width: number): { k: number; label: string }[] {
  if (!dates.length) return [];
  const years = Number(dates[dates.length - 1].slice(0, 4)) - Number(dates[0].slice(0, 4));
  if (years < 2) {
    // Short windows: month labels.
    const out: { k: number; label: string }[] = [];
    const every = years < 1 && dates.length < 40 ? 1 : 3;
    let last = "";
    dates.forEach((d, k) => {
      const m = d.slice(0, 7);
      if (m !== last && Number(d.slice(5, 7)) % every === 0 && Number(d.slice(8, 10)) <= 7) out.push({ k, label: new Date(Date.parse(d)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) });
      last = m;
    });
    return out.filter((_, i) => i % Math.max(1, Math.ceil(out.length / Math.max(2, Math.floor(width / 70)))) === 0);
  }
  const every = [1, 2, 5, 10].find((e) => years / e <= Math.max(2, Math.floor(width / 60))) ?? 10;
  const out: { k: number; label: string }[] = [];
  let last = "";
  dates.forEach((d, k) => { const yr = d.slice(0, 4); if (yr !== last && Number(yr) % every === 0 && k > 0) out.push({ k, label: yr }); last = yr; });
  return out;
}

/** A monthly series laid on the weekly dates: the last value on or before each date. */
export function ffillOnto(points: [string, number][] | undefined, dates: string[]): (number | null)[] {
  if (!points?.length) return dates.map(() => null);
  const out: (number | null)[] = [];
  let j = 0, last: number | null = null;
  for (const d of dates) {
    while (j < points.length && points[j][0] <= d) { last = points[j][1]; j++; }
    out.push(last);
  }
  return out;
}

/** Any series on the weekly dates: weekly ones as they are, copper and rates carried forward. */
export function weekly(data: WorldData, key: string): (number | null)[] {
  if (data.weekly.series[key]) return data.weekly.series[key];
  if (data.monthly[key]) return ffillOnto(data.monthly[key], data.weekly.dates);
  if (key.startsWith("rate:")) return ffillOnto(data.rates[key.slice(5)], data.weekly.dates);
  return data.weekly.dates.map(() => null);
}

/** Values over frames a..b, each divided by its first value in the window, times 100. */
export function rebase(values: (number | null)[], a: number, b: number): (number | null)[] {
  let base: number | null = null;
  const out: (number | null)[] = [];
  for (let k = a; k <= b; k++) {
    const v = values[k];
    if (base == null && v != null && v > 0) base = v;
    out.push(v == null || base == null ? null : (v / base) * 100);
  }
  return out;
}

/** The last non-null value on or before frame k (a holiday week keeps last week's close). */
export function at(values: (number | null)[], k: number, back = 6): number | null {
  for (let j = k; j >= 0 && j > k - back; j--) if (values[j] != null) return values[j];
  return null;
}

export const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];

export const pct = (v: number | null | undefined, digits = 1): string => {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const d = Math.abs(v) >= 100 ? 0 : digits;
  const abs = Math.abs(v).toFixed(d);
  return `${Number(abs) === 0 ? "" : v > 0 ? "+" : "−"}${Number(abs).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
};

export const tone = (v: number | null | undefined) => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");

export const monthYear = (iso: string) => (iso ? new Date(Date.parse(iso)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "");
export const dayMonthYear = (iso: string) => (iso ? new Date(Date.parse(iso)).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
