// Parity Terminal data (DEC-0023). The engine's `parity terminal export` writes a small
// index of every series (last value, changes, z-score, sparkline) plus one file per
// series, loaded only when a chart needs it. Dev reads /local/terminal/, builds read
// /data/terminal/ (behind sign-in, like every other data file).
import { source } from "../lib/data";
import { loadReport } from "../lib/data";
import type { NewsDoc } from "../lib/news";
import { loadScenarios, type Loaded as ScenLoaded } from "../lib/scenarios";
import { loadWorld, type WorldLoaded } from "../lib/world";
import { loadBotsIndex } from "../lib/bots";
import type { BotsIndex } from "../lib/botStats";
import type { Point, Report } from "../lib/types";
import { rumAge } from "../lib/rum";

export type SeriesClass = "fx" | "rates" | "commodities" | "equities" | "crypto" | "positioning" | "macro" | (string & {});
export type Win = "d1" | "w1" | "m1" | "ytd";

export interface TermGroup { id: string; label: string; class: SeriesClass }

export interface TermSeries {
  key: string; label: string; short: string; group: string; class: SeriesClass;
  source: string; licence: string; kind: "price" | "level"; unit: string; freq: "D" | "W" | "M" | "Q" | string;
  first: string; asof: string; last: number | null;
  chg: Partial<Record<Win, number | null>>;
  vol: number | null; z: number | null; pct1y: number | null; spark: (number | null)[];
  file: string;
  attribution?: string; attribution_url?: string;
}

export interface TermIndex { generated_at: string; data_through: string | null; groups: TermGroup[]; series: TermSeries[] }

export type Loadable<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "missing"; message: string } | { status: "error"; message: string };

export const TERM_BASE = source === "local" ? "/local/terminal" : "/data/terminal";

async function getJson<T>(url: string, missing: string): Promise<Loadable<T>> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (res.status === 404) return { status: "missing", message: missing };
    if (!res.ok) return { status: "error", message: `Could not load ${url} (${res.status}).` };
    const type = res.headers.get("content-type") ?? "";
    // A dev server without the terminal route answers with the HTML page instead of a 404.
    if (type.includes("text/html")) return { status: "missing", message: missing };
    return { status: "ok", data: (await res.json()) as T };
  } catch (e) {
    return { status: "error", message: `Could not load ${url}: ${(e as Error).message}` };
  }
}

const MISSING_INDEX = source === "local"
  ? "The terminal export has not been built yet. Run `parity terminal export` in engine/."
  : "The terminal data has not been published yet.";

let indexP: Promise<Loadable<TermIndex>> | null = null;
export function loadIndex(): Promise<Loadable<TermIndex>> {
  if (!indexP) {
    indexP = getJson<TermIndex>(`${TERM_BASE}/index.json`, MISSING_INDEX);
    // How old the newest price on screen is (DEC-0045); Trade and the Terminal share this.
    void indexP.then((r) => { if (r.status === "ok") rumAge("terminal/index", r.data.data_through); });
  }
  return indexP;
}

const seriesP = new Map<string, Promise<Loadable<Point[]>>>();
export function loadSeries(s: TermSeries): Promise<Loadable<Point[]>> {
  let p = seriesP.get(s.key);
  if (!p) {
    p = getJson<{ key: string; points: [string, number | null][] }>(`${TERM_BASE}/${s.file}`, `The file for ${s.short} is missing from the export.`)
      .then((r) => (r.status === "ok" ? { status: "ok" as const, data: r.data.points.filter((x): x is Point => x[1] != null && Number.isFinite(x[1])) } : r));
    seriesP.set(s.key, p);
  }
  return p;
}

// The other data the terminal reuses, each loaded once and shared by every panel.
function once<T>(fn: () => Promise<Loadable<T>>): () => Promise<Loadable<T>> {
  let p: Promise<Loadable<T>> | null = null;
  return () => (p ??= fn());
}

const fromLoaded = <T,>(l: { status: "ok"; data: T } | { status: "missing"; message: string } | { status: "error"; message: string }): Loadable<T> => l;

export const getWorld = once(() => loadWorld().then((w: WorldLoaded) => fromLoaded(w)));
export const getBots = once<BotsIndex>(() => loadBotsIndex().then((b) => fromLoaded(b)));
export const getScen = once(() => loadScenarios().then((s: ScenLoaded) => fromLoaded(s)));
export const getReport = once<Report>(() => loadReport().then((data) => ({ status: "ok" as const, data }), (e: Error) => ({ status: /published/.test(e.message) ? "missing" as const : "error" as const, message: e.message })));
// The same file lib/news.ts loadNews() reads, through getJson so a dev server without the
// news export (which answers with the HTML page) reads as "missing", not as an error.
export const getNews = once<NewsDoc>(() => getJson<NewsDoc>(`${source === "local" ? "/local/news" : "/data/news"}/articles.json`,
  source === "local" ? "No news has been exported yet. Run `parity news fetch` then `parity news export`." : "No news has been published yet."));
