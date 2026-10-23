// Private markets (DEC-0029): the plain-words content, the shape of markets/private.json,
// and the fund-measure calculator on the product page.
//
// The words live in docs/_system/private-markets.json, which the public page
// /learn/private-markets/ also reads, so the pages never disagree. The data file is written
// by `parity markets export` (engine/src/parity/markets/private_export.py).
import content from "../../../docs/_system/private-markets.json";
import type { MarketSource } from "./markets";

// ------------------------------------------------------------------ content

export interface AssetClass { id: string; name: string; simple: string; returns: string; liquidity: string; fees: string; risks: string[]; check: string[]; terms: string[] }
export interface Measure { id: string; name: string; simple: string; pitfall: string; term: string }
export interface Route { id: string; name: string; what: string; liquidity: string; minimum: string; risks: string[]; check: string[]; term: string }
export interface Provider { name: string; what: string; free: "yes" | "partly" | "no"; note: string }

export const intro: string = content.intro;
export const classes = content.classes as AssetClass[];
export const measures = content.measures as Measure[];
export const smoothing = content.smoothing as { title: string; text: string; points: string[] };
export const routes = content.routes as Route[];
export const checklist = content.checklist as string[];
export const providers = content.providers as Provider[];
export const reading = content.reading as { doc: string; label: string }[];

// ------------------------------------------------------------------ data file

export interface FormdQuarter {
  quarter: string; filings: number; amount_sold_usd: number | null; nonaccredited: number; indefinite: number;
  by_kind: Record<string, number>; amount_by_kind: Record<string, number | null>;
  by_size: Record<string, number>; by_exemption: Record<string, number>;
}
export interface FormdGroup { kind: string; group: string; filings: number; amount_sold_usd: number | null; by_size: Record<string, number> }
export interface FormdDoc {
  quarters: string[]; kinds: string[]; sizes: { id: string; label: string }[]; exemptions: { id: string; label: string }[];
  by_quarter: FormdQuarter[]; latest: { quarter: string; groups: FormdGroup[] };
}
export interface BdcFund {
  cik: string; name: string; ticker: string | null; listed: boolean; points: [string, number][];
  last: number | null; last_date: string; first_date: string; point_count: number; quarterly_changes: number;
  change_1y_pct: number | null; worst_quarter_pct: number | null; worst_quarter_date: string | null;
  max_drawdown_pct: number | null; quarter_vol_pct: number | null; ac1: number | null; split_like_jumps: string[];
}
export interface PmSeries { key: string; label: string; short: string; unit: string; freq: string; description: string; source: string; licence: string; points: [string, number][] }
export interface UnsmoothStats { vol: number; ac1: number; max_drawdown: number; worst_quarter: number; worst_quarter_date: string | null; growth: number }
export interface Study {
  id: string; label: string; key: string; note: string; site: boolean; start: string; end: string; quarters: number;
  raw: UnsmoothStats; geltner: UnsmoothStats & { phi: number };
  glm: Partial<UnsmoothStats> & { theta: number[]; smoothing_index: number; fit_error: number; vol_implied: number | null; invertible: boolean };
  autocorrelation: { lag1: number; lag2: number };
  stocks?: UnsmoothStats;
  beta_raw?: { same_quarter: number | null; summed: number | null; by_lag?: number[]; quarters: number };
  beta_geltner?: { same_quarter: number | null; summed: number | null; by_lag?: number[]; quarters: number };
  corr_with_stocks?: { raw: number | null; geltner: number | null };
  chart?: [string, number, number][];
}
export interface PrivateDoc {
  generated_at: string; sources: MarketSource[]; formd: FormdDoc | null; bdc: { funds: BdcFund[]; fetched_at: string } | null;
  series: PmSeries[]; unsmoothing: Study[];
}

/** How many times calmer the reported series looks than its unsmoothed version. */
export function calmFactor(s: Study): number | null {
  return s.raw.vol > 0 ? s.geltner.vol / s.raw.vol : null;
}

// ------------------------------------------------------------------ calculator

/** One year of a fund's life: money paid in (called) and money paid out (distributed). */
export interface Flow { year: number; paidIn: number; paidOut: number }

/** Net cash to the investor each year: paid out minus paid in, with the value still held
 *  (NAV) counted as if paid out in the last year. */
export function netFlows(flows: Flow[], nav: number): number[] {
  return flows.map((f, i) => f.paidOut - f.paidIn + (i === flows.length - 1 ? nav : 0));
}

/** Internal rate of return of yearly cash flows, by bisection. Null when there is no sign
 *  change (no answer) or the answer lies outside -99% to +1000% a year. */
export function irr(cash: number[]): number | null {
  const npv = (r: number) => cash.reduce((s, c, t) => s + c / (1 + r) ** t, 0);
  if (!cash.some((c) => c < 0) || !cash.some((c) => c > 0)) return null;
  let lo = -0.99;
  let hi = 10;
  let flo = npv(lo);
  if (flo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-10) return mid;
    if (flo * fm < 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export interface Multiples { paidIn: number; paidOut: number; dpi: number | null; rvpi: number | null; tvpi: number | null }

export function multiples(flows: Flow[], nav: number): Multiples {
  const paidIn = flows.reduce((s, f) => s + f.paidIn, 0);
  const paidOut = flows.reduce((s, f) => s + f.paidOut, 0);
  if (paidIn <= 0) return { paidIn, paidOut, dpi: null, rvpi: null, tvpi: null };
  return { paidIn, paidOut, dpi: paidOut / paidIn, rvpi: nav / paidIn, tvpi: (paidOut + nav) / paidIn };
}

/** Kaplan-Schoar PME: each cash flow grown by the index to the end, distributions plus NAV
 *  over contributions. `indexReturn` is the index's yearly return, one per year (the last
 *  is unused), or a single number for every year. Above 1 means the fund beat the index. */
export function ksPme(flows: Flow[], nav: number, indexReturn: number | number[]): number | null {
  const n = flows.length;
  const ret = (t: number) => (Array.isArray(indexReturn) ? indexReturn[t] ?? 0 : indexReturn);
  // Growth factor from the end of year t to the end of the last year.
  const growth = (t: number) => { let g = 1; for (let k = t + 1; k < n; k++) g *= 1 + ret(k); return g; };
  let into = 0;
  let out = nav;
  flows.forEach((f, t) => { into += f.paidIn * growth(t); out += f.paidOut * growth(t); });
  return into > 0 ? out / into : null;
}

/** Direct alpha (Gredil, Griffiths and Stucke): the IRR of cash flows first compounded to the
 *  end at the index return. Roughly the fund's yearly return above the index. */
export function directAlpha(flows: Flow[], nav: number, indexReturn: number): number | null {
  const n = flows.length;
  const cash = flows.map((f, t) => (f.paidOut - f.paidIn) * (1 + indexReturn) ** (n - 1 - t));
  cash[n - 1] += nav;
  const r = irr(cash);
  return r == null ? null : Math.log(1 + r);
}

export interface Example { id: string; label: string; what: string; flows: Flow[]; nav: number }

const years = (paidIn: number[], paidOut: number[]): Flow[] => paidIn.map((p, i) => ({ year: i, paidIn: p, paidOut: paidOut[i] ?? 0 }));

/** Three funds with the same money multiple, to show why one number is not enough. */
export const EXAMPLES: Example[] = [
  { id: "steady", label: "Steady fund", what: "Calls money over four years and pays it back over the next six.",
    flows: years([25, 25, 25, 25, 0, 0, 0, 0, 0, 0], [0, 0, 5, 10, 20, 25, 30, 30, 20, 10]), nav: 0 },
  { id: "early-win", label: "Early quick win", what: "Same total cash back, but one early sale returns a lot in year 2. The IRR jumps; the multiple does not move.",
    flows: years([25, 25, 25, 25, 0, 0, 0, 0, 0, 0], [0, 0, 60, 10, 10, 10, 20, 20, 15, 5]), nav: 0 },
  { id: "credit-line", label: "Borrowed to call late", what: "The steady fund, but it borrows for a year before calling investors' money. Investors get the same cash, so the multiple is the same; the IRR rises because their money is out for less time. The loan's interest, left out here, would lower the payout a little.",
    flows: years([0, 25, 25, 25, 25, 0, 0, 0, 0, 0], [0, 0, 5, 10, 20, 25, 30, 30, 20, 10]), nav: 0 },
  { id: "young", label: "Young fund, mostly estimates", what: "Five years in, little cash back. Most of the multiple is the manager's estimate of what is left.",
    flows: years([30, 30, 20, 10, 0], [0, 0, 5, 10, 15]), nav: 110 },
];
