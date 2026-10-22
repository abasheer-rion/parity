// Sim World's map data (DEC-0016). The engine (`parity world export`) writes a static
// file of currency values in US dollars, interest rates, commodity prices and how each
// currency moved after past events; this file loads it, says which country uses which
// currency, and turns the numbers into what the map shows. It looks backwards only.
import { source } from "./data";

export type Grid = { dates: string[]; series: Record<string, (number | null)[]> };
export type Horizon = "1d" | "1w" | "1m" | "3m";

export interface WorldAsset {
  key: string; label: string; first: string; rate: boolean;
  group: "currencies" | "commodities" | "stocks" | "bonds" | "industries" | "factors" | "yields" | "risk";
  /** price: a change is a return someone could have had; level: a yield or the VIX (DEC-0020). Older files leave it out. */
  kind?: "price" | "level";
}

export interface WorldEvent { id: string; reactions: Record<string, Partial<Record<Horizon, number>>>; paths: Record<string, number[]> }

export interface WorldData {
  generated_at: string;
  data_through: string | null;
  assets: WorldAsset[];
  daily: Grid;
  weekly: Grid;
  monthly: Record<string, [string, number][]>;
  rates: Record<string, [string, number][]>;
  event_path_step: number;
  analogue_weeks: number;
  events: WorldEvent[];
}

export type WorldLoaded = { status: "ok"; data: WorldData } | { status: "missing"; message: string } | { status: "error"; message: string };

let cache: Promise<WorldLoaded> | null = null;

export function loadWorld(): Promise<WorldLoaded> {
  if (cache) return cache;
  const url = source === "local" ? "/local/world.json" : "/data/world.json";
  cache = (async (): Promise<WorldLoaded> => {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (res.status === 404) {
        cache = null;
        return { status: "missing", message: source === "local" ? "Run `parity world export` first." : "The world map file has not been published yet." };
      }
      if (!res.ok) { cache = null; return { status: "error", message: `Could not load ${url} (${res.status}).` }; }
      return { status: "ok", data: (await res.json()) as WorldData };
    } catch (e) {
      cache = null;
      return { status: "error", message: `Could not load ${url}: ${(e as Error).message}` };
    }
  })();
  return cache;
}

// --- Countries ----------------------------------------------------------------------
// Keyed by ISO 3166-1 numeric code, which is the id world-atlas uses. Only currencies
// Parity holds daily prices for get a currency; every other country is drawn grey.

export const EURO_AREA = ["040", "056", "100", "191", "196", "233", "246", "250", "276", "300", "372", "380", "428", "440", "442", "470", "528", "620", "703", "705", "724"];

const CURRENCY_OF: Record<string, string> = {
  ...Object.fromEntries(EURO_AREA.map((id) => [id, "EUR"])),
  "499": "EUR", // Montenegro uses the euro without being a member
  "840": "USD", "218": "USD", "222": "USD", "591": "USD", "630": "USD", "626": "USD",
  "826": "GBP", "392": "JPY", "756": "CHF", "124": "CAD", "036": "AUD", "554": "NZD",
  "578": "NOK", "752": "SEK", "208": "DKK", "304": "DKK", "484": "MXN", "076": "BRL",
  "410": "KRW", "356": "INR", "710": "ZAR", "702": "SGD", "156": "CNY", "344": "HKD",
  "764": "THB", "158": "TWD", "458": "MYR",
};

/** Places too small to draw at this scale but whose currency we hold: a dot instead. */
export const DOTS: { id: string; name: string; lon: number; lat: number }[] = [
  { id: "702", name: "Singapore", lon: 103.82, lat: 1.35 },
  { id: "344", name: "Hong Kong", lon: 114.17, lat: 22.32 },
];

export function currencyOf(id: string | undefined): string | null {
  return id ? CURRENCY_OF[id] ?? null : null;
}

/** Why a country uses a currency it does not issue, when that is the case. */
export function currencyNote(id: string, code: string): string | null {
  if (code === "USD" && id !== "840") return "Uses the US dollar.";
  if (id === "499") return "Uses the euro without being a member of the euro area.";
  if (id === "304") return "Greenland uses the Danish krone.";
  if (id === "100") return "Bulgaria joined the euro on 1 January 2026; earlier history is the euro, not the lev.";
  if (id === "191") return "Croatia joined the euro in 2023; earlier history is the euro, not the kuna.";
  return null;
}

// Scenario regions, in the scenario simulator's vocabulary. The first region is the one a
// click adds; some countries sit in two (Egypt is Middle East and Africa).
const R = (ids: string, ...regions: string[]) => ids.split(" ").map((id) => [id, regions] as const);
const REGION_OF: Record<string, string[]> = Object.fromEntries([
  ...R("124 840 304", "north_america"),
  ...R("484", "latin_america", "north_america"),
  ...R("032 152 332 214 044 238 858 076 068 604 170 591 188 558 340 222 320 084 862 328 740 218 630 388 192 600 780", "latin_america"),
  ...R("578 250 752 616 040 348 642 440 428 233 276 100 300 008 191 756 442 056 528 620 724 372 380 208 826 352 705 246 703 203 196 070 807 688 499", "europe"),
  ...R("792", "europe", "middle_east"),
  ...R("643 398 860 762 417 795 051 031 112", "russia_cis"),
  ...R("804 498 268", "russia_cis", "europe"),
  ...R("376 422 275 400 784 634 414 368 512 364 760 887 682", "middle_east"),
  ...R("818 434", "middle_east", "africa"),
  ...R("834 732 180 706 404 729 148 710 426 716 072 516 686 466 478 204 562 566 120 768 288 384 324 624 430 694 854 140 178 266 226 894 454 508 748 024 108 450 270 788 012 232 504 231 262 800 646 728", "africa"),
  ...R("356 050 064 524 586 004 144", "south_asia"),
  ...R("156 158 408 410 496 392 344 360 626 116 764 418 104 704 608 458 096 702", "east_asia"),
  ...R("242 598 548 540 090 554 036", "oceania"),
]);

export function regionsOf(id: string | undefined): string[] {
  return id ? REGION_OF[id] ?? [] : [];
}

/** The scenario simulator's name for a country, when it is not just the lower-case name. */
const ACTOR_OF: Record<string, string> = {
  "840": "usa", "826": "uk", "682": "saudi_arabia", "410": "south_korea", "408": "north_korea",
  "784": "uae", "344": "hong_kong", "180": "dr_congo", "376": "israel",
};

export function actorOf(id: string, name: string): string {
  return ACTOR_OF[id] ?? name.toLowerCase().replace(/\./g, "").replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
}

// --- Commodity producers ---------------------------------------------------------------
// Big exporters of the commodities in our data, for orientation only. Oil: the largest net
// crude exporters and the US (EIA International Energy Statistics, 2024). Gas: the largest
// LNG and pipeline exporters (IEA Gas Market Report, 2025). Copper: the largest mine
// producers (USGS Mineral Commodity Summaries, 2025).

export type Commodity = "oil" | "gas" | "copper";

export const PRODUCERS: Record<Commodity, string[]> = {
  oil: ["682", "643", "368", "784", "124", "414", "364", "578", "398", "566", "840", "076", "434", "024", "862", "512", "012", "484", "634"],
  gas: ["634", "643", "840", "578", "036", "012", "795", "458"],
  copper: ["152", "604", "180", "156", "840", "036", "360", "894", "484", "643"],
};

export const COMMODITY_LABEL: Record<Commodity, string> = { oil: "Oil", gas: "Gas", copper: "Copper" };

export function producerOf(id: string | undefined): Commodity[] {
  if (!id) return [];
  return (Object.keys(PRODUCERS) as Commodity[]).filter((c) => PRODUCERS[c].includes(id));
}

// --- Numbers ---------------------------------------------------------------------------

/** Position of the last date on or before `d` in a sorted list, or -1. */
export function indexAtOrBefore(dates: string[], d: string): number {
  let lo = 0, hi = dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= d) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** The last value on or before position `i` in a grid series, with the date it is from. */
export function lastAt(grid: Grid, key: string, i: number, maxBack = 10): { v: number; i: number } | null {
  const s = grid.series[key];
  if (!s) return null;
  for (let k = i; k >= 0 && k > i - maxBack; k--) if (s[k] != null) return { v: s[k] as number, i: k };
  return null;
}

/** Last value on or before a date in a list of [date, value] points. */
export function pointAt(points: [string, number][] | undefined, d: string): number | null {
  if (!points?.length) return null;
  let lo = 0, hi = points.length - 1, ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= d) { ans = points[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export type StepSize = "day" | "week" | "month";

/** The dates the time slider steps through, and the grid behind them. */
export function stepsFor(data: WorldData, step: StepSize): { grid: Grid; idx: number[] } {
  const g = step === "day" ? data.daily : data.weekly;
  // Stop at the last point where most currencies have a close: commodity prices often
  // arrive a few days before the Fed's currency release.
  const codes = data.assets.filter((a) => a.group === "currencies").map((a) => a.key).filter((k) => g.series[k]);
  let last = g.dates.length - 1;
  while (last > 0 && codes.filter((k) => g.series[k][last] != null).length < codes.length / 2) last--;
  const all = g.dates.slice(0, last + 1).map((_, i) => i);
  if (step !== "month") return { grid: g, idx: all };
  // Monthly: the last weekly point of each month.
  const idx = all.filter((i) => i === last || g.dates[i + 1].slice(0, 7) !== g.dates[i].slice(0, 7));
  return { grid: g, idx };
}

/** Percent change of a series from one grid position to another, null when either end is missing. */
export function changeBetween(grid: Grid, key: string, from: number, to: number): number | null {
  const a = lastAt(grid, key, from);
  const b = lastAt(grid, key, to);
  if (!a || !b || a.v <= 0) return null;
  if (b.i <= a.i) return null; // no new close since the last step
  return (b.v / a.v - 1) * 100;
}

/** Interest rate gap against the US dollar, in percentage points, on a date. */
export function carryAt(data: WorldData, code: string, date: string): number | null {
  if (code === "USD") return 0;
  const r = pointAt(data.rates[code], date);
  const us = pointAt(data.rates.USD, date);
  return r == null || us == null ? null : r - us;
}

/** Pearson correlation of weekly returns of two weekly series over the last `weeks` weeks to position `end`. */
export function weeklyCorrelation(data: WorldData, a: string, b: string, end: number, weeks = 156): number | null {
  const g = data.weekly;
  const sa = g.series[a], sb = g.series[b];
  if (!sa || !sb) return null;
  const xs: number[] = [], ys: number[] = [];
  for (let i = Math.max(1, end - weeks + 1); i <= end; i++) {
    const a0 = sa[i - 1], a1 = sa[i], b0 = sb[i - 1], b1 = sb[i];
    if (a0 == null || a1 == null || b0 == null || b1 == null || a0 <= 0 || b0 <= 0) continue;
    xs.push(Math.log(a1 / a0)); ys.push(Math.log(b1 / b0));
  }
  const n = xs.length;
  if (n < 26) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

// --- Colour ----------------------------------------------------------------------------

/**
 * A diverging fill from the theme's own colours: stronger towards `--map-up` for positive
 * values and `--map-down` for negative, neutral near zero. `scale` is the value that gets
 * full colour; anything beyond is clipped.
 */
export function divergingFill(v: number | null, scale: number): string {
  if (v == null || !Number.isFinite(v)) return "var(--map-none)";
  const t = Math.max(-1, Math.min(1, v / scale));
  const pct = Math.round(Math.sqrt(Math.abs(t)) * 100); // square root: small moves stay visible
  return `color-mix(in oklab, var(${t >= 0 ? "--map-up" : "--map-down"}) ${pct}%, var(--map-mid))`;
}

export const MINUS = "−";

export function signed(v: number | null | undefined, digits = 1, unit = "%"): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const abs = Math.abs(v).toFixed(digits);
  const sign = Number(abs) === 0 ? "" : v > 0 ? "+" : MINUS;
  return `${sign}${abs}${unit}`;
}
