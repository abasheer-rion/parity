// The scenario simulator's data and maths. The engine (`parity scenario export`)
// writes a static file of past events and what markets did after each; this file
// loads it, finds the past events that look like a made-up scenario, and summarises
// what happened next. It looks backwards only: nothing here predicts anything.
// The matcher mirrors the Python one exactly, so the page and the engine agree.
import { isMissing, source } from "./data";

export type HorizonKey = "1d" | "1w" | "1m" | "3m";
export type Measure = "pct" | "points" | "bp";

export interface ScenarioAsset {
  key: string; label: string; series: string; measure: Measure;
  group: "commodities" | "currencies" | "stocks" | "risk" | "rates"; note: string; first: string | null;
}

export interface ScenarioEvent {
  id: string; name: string; date: string; type: string; regions: string[]; actors: string[]; severity: number;
  commodities: string[]; description: string;
  sources: { title: string; publisher: string; url: string }[];
  reactions: Record<string, Partial<Record<HorizonKey, { change: number; z: number | null }>>>;
  paths: Record<string, number[]>;
}

export interface ScenarioData {
  generated_at: string; data_through: string | null;
  horizons: { key: HorizonKey; days: number; label: string }[];
  assets: ScenarioAsset[];
  vocab: { types: string[]; regions: string[]; commodities: string[]; actors: string[] };
  matcher: {
    weights: { type: number; family: number; region: number; global_region: number; actors_each: number; actors_cap: number; severity: number; commodity: number };
    families: Record<string, string>;
    require_family: boolean; min_score: number; max_analogues: number;
  };
  events: ScenarioEvent[];
  /** What markets did after every kind of event (DEC-0066). Older files leave it out. */
  library?: Library;
  /** Recent days whose moves looked like the first day after a past event (DEC-0066). */
  echoes?: Echoes;
}

export interface DayMove { close: number; change: number; vol: number; z: number }
export interface EchoDay { date: string; moves: Record<string, DayMove>; size: number; matches: { id: string; sim: number; shared: number }[] }
export interface Echoes { min_sim: number; min_assets: number; alert: { min_size: number; min_sim: number }; days: EchoDay[] }

/** Cosine similarity of two sets of z-moves over the markets both have (engine: scenarios.resemblance). */
export function resemblance(a: Record<string, number>, b: Record<string, number | null | undefined>, minAssets: number): { sim: number; shared: number } | null {
  const keys = Object.keys(a).filter((k) => b[k] != null && Number.isFinite(b[k] as number));
  if (keys.length < minAssets) return null;
  let ab = 0, aa = 0, bb = 0;
  for (const k of keys) { const x = a[k], y = b[k] as number; ab += x * y; aa += x * x; bb += y * y; }
  return aa && bb ? { sim: ab / Math.sqrt(aa * bb), shared: keys.length } : null;
}

/** One market at one horizon across every past event of a kind. */
export interface LibraryCell {
  n: number; median: number; q25: number; q75: number;
  /** Share of events after which it was higher. */
  up: number;
  /** A 90% distribution-free interval for the median; null below 5 events. */
  ci: [number, number] | null;
  /** up or down: the whole interval is on one side of zero; mixed: it is not. */
  held: "up" | "down" | "mixed" | null;
  confidence: "solid" | "fair" | "thin" | "too few";
}

export interface LibraryEntry {
  count: number; first: string | null; last: string | null;
  regions: Record<string, number>;
  events: string[];
  assets: Record<string, Partial<Record<HorizonKey, LibraryCell>>>;
}

export interface Library {
  level: number;
  confidence: { min: number; word: string }[];
  types: Record<string, LibraryEntry>;
  families: Record<string, LibraryEntry>;
}

/** What the person typed: the scenario and how many matches to keep. */
export interface Spec {
  title: string;
  type: string;            // "" = any type
  regions: string[];
  actors: string[];
  severity: number;        // 0 = any severity
  commodities: string[];
  assets: string[];
  minScore: number | null; // null = the engine's default
  maxCount: number | null;
}

export type Loaded = { status: "ok"; data: ScenarioData } | { status: "missing"; message: string } | { status: "error"; message: string };

export async function loadScenarios(): Promise<Loaded> {
  const url = source === "local" ? "/local/scenarios.json" : "/data/scenarios.json";
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (isMissing(res)) {
      return { status: "missing", message: source === "local" ? "Run `parity scenario export` first." : "The scenario file has not been published yet." };
    }
    if (!res.ok) return { status: "error", message: `Could not load ${url} (${res.status}).` };
    return { status: "ok", data: (await res.json()) as ScenarioData };
  } catch (e) {
    return { status: "error", message: `Could not load ${url}: ${(e as Error).message}` };
  }
}

// --- Matching -----------------------------------------------------------------

const overlap = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** How much a past event looks like the scenario, from 0 to 1. Null means excluded (a different kind of event). */
export function score(ev: ScenarioEvent, spec: Spec, m: ScenarioData["matcher"]): number | null {
  const w = m.weights;
  const fam = m.families;
  let pts = 0;
  let max = 0;
  if (spec.type) {
    if (m.require_family && fam[ev.type] !== fam[spec.type]) return null;
    max += w.type;
    pts += ev.type === spec.type ? w.type : fam[ev.type] === fam[spec.type] ? w.family : 0;
  }
  if (spec.regions.length) {
    max += w.region;
    pts += overlap(ev.regions, spec.regions) ? w.region : ev.regions.includes("global") || spec.regions.includes("global") ? w.global_region : 0;
  }
  if (spec.actors.length) {
    const want = new Set(spec.actors.map((a) => a.toLowerCase()));
    const shared = new Set(ev.actors.map((a) => a.toLowerCase()).filter((a) => want.has(a)));
    max += Math.min(w.actors_cap, w.actors_each * want.size);
    pts += Math.min(w.actors_cap, w.actors_each * shared.size);
  }
  if (spec.severity) {
    max += w.severity;
    pts += w.severity * Math.max(0, 1 - Math.abs(ev.severity - spec.severity) / 4);
  }
  if (spec.commodities.length) {
    max += w.commodity;
    pts += overlap(ev.commodities, spec.commodities) ? w.commodity : 0;
  }
  return max > 0 ? pts / max : 0;
}

export interface Match { event: ScenarioEvent; score: number }

export function selectAnalogues(data: ScenarioData, spec: Spec): Match[] {
  const min = spec.minScore ?? data.matcher.min_score;
  const take = spec.maxCount ?? data.matcher.max_analogues;
  const out: Match[] = [];
  for (const ev of data.events) {
    const s = score(ev, spec, data.matcher);
    if (s != null && s >= min) out.push({ event: ev, score: s });
  }
  out.sort((a, b) => b.score - a.score || b.event.date.localeCompare(a.event.date));
  return out.slice(0, take);
}

// --- Summaries ----------------------------------------------------------------

/** Quantile with linear interpolation between neighbours (numpy's default). */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Agg { n: number; median: number; q25: number; q75: number; min: number; max: number; up: number; medianZ: number | null }

function summarise(values: number[], zs: number[]): Agg | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const z = [...zs].sort((a, b) => a - b);
  return {
    n: s.length, median: quantile(s, 0.5), q25: quantile(s, 0.25), q75: quantile(s, 0.75), min: s[0], max: s[s.length - 1],
    up: values.filter((v) => v > 0).length, medianZ: z.length ? quantile(z, 0.5) : null,
  };
}

export function aggregate(matches: Match[], asset: string, horizon: HorizonKey): Agg | null {
  const values: number[] = [];
  const zs: number[] = [];
  for (const { event } of matches) {
    const r = event.reactions[asset]?.[horizon];
    if (!r || r.change == null || Number.isNaN(r.change)) continue;
    values.push(r.change);
    if (r.z != null && !Number.isNaN(r.z)) zs.push(r.z);
  }
  return summarise(values, zs);
}

export interface Band { day: number; median: number; q25: number; q75: number; min: number; max: number; count: number }

export function pathBands(matches: Match[], asset: string): Band[] {
  const paths = matches.map((m) => m.event.paths[asset]).filter((p): p is number[] => !!p && p.length > 0);
  const len = Math.max(0, ...paths.map((p) => p.length));
  const out: Band[] = [];
  for (let d = 0; d < len; d++) {
    const vals = paths.map((p) => p[d]).filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    if (!vals.length) continue;
    out.push({ day: d, median: quantile(vals, 0.5), q25: quantile(vals, 0.25), q75: quantile(vals, 0.75), min: vals[0], max: vals[vals.length - 1], count: vals.length });
  }
  return out;
}

// --- Words and numbers ---------------------------------------------------------

const MINUS = "−";

/** A change in the asset's own units, always signed: +4.1%, −0.8 pts, +12 bp. */
export function fmtChange(v: number | null | undefined, measure: Measure, digits?: number): string {
  if (v == null || Number.isNaN(v)) return "n/a";
  const d = digits ?? (measure === "bp" ? 0 : 1);
  const abs = Math.abs(v).toFixed(d);
  const sign = Number(abs) === 0 ? "" : v > 0 ? "+" : MINUS;
  return measure === "pct" ? `${sign}${abs}%` : measure === "bp" ? `${sign}${abs} bp` : `${sign}${abs} pts`;
}

export const unitWord = (m: Measure) => (m === "pct" ? "percent" : m === "bp" ? "basis points" : "points");

const ACRONYMS = new Set(["usa", "us", "uk", "eu", "uae", "un", "nato", "opec", "ussr", "imf"]);

/** "military_strike" to "Military strike"; "middle_east" to "Middle East". */
const NAMES: Record<string, string> = {
  middle_east: "Middle East", russia_cis: "Russia and neighbours", east_asia: "East Asia",
  south_asia: "South Asia", north_america: "North America", latin_america: "Latin America",
  saudi_arabia: "Saudi Arabia", north_korea: "North Korea", south_korea: "South Korea",
  fed: "Fed", ecb: "ECB", boj: "Bank of Japan", snb: "Swiss National Bank", boe: "Bank of England",
};

export function humanize(s: string): string {
  if (NAMES[s]) return NAMES[s];
  const t = s.replace(/[_-]+/g, " ").trim();
  if (ACRONYMS.has(t)) return t.toUpperCase();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Same asset, same colour, everywhere on the page. Slots go to the shown markets in the
 * file's order, so up to eight shown markets never share a colour.
 */
export function assetColors(data: ScenarioData, shown: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  data.assets.filter((a) => shown.includes(a.key)).forEach((a, i) => (out[a.key] = `var(--series-${(i % 8) + 1})`));
  return out;
}

// --- Saving and sharing ----------------------------------------------------------

export const DEFAULT_ASSETS = ["oil", "usd", "jpy", "chf", "sp500", "vix", "ust10y"];

export const EMPTY_SPEC: Spec = { title: "", type: "", regions: [], actors: [], severity: 0, commodities: [], assets: DEFAULT_ASSETS, minScore: null, maxCount: null };

export const PRESETS: { label: string; spec: Partial<Spec> }[] = [
  { label: "Strike on Iran", spec: { title: "Strike on Iran", type: "military_strike", regions: ["middle_east"], actors: ["iran", "usa", "israel"], severity: 4, commodities: ["oil"] } },
  { label: "Gulf oil supply shock", spec: { title: "Gulf oil supply shock", type: "oil_supply_shock", regions: ["middle_east"], actors: ["saudi_arabia"], severity: 4, commodities: ["oil"] } },
  { label: "War in Europe", spec: { title: "War in Europe", type: "war", regions: ["europe"], actors: ["russia"], severity: 5, commodities: ["gas", "oil"] } },
  { label: "Terror attack in the US", spec: { title: "Terror attack in the US", type: "terrorist_attack", regions: ["north_america"], actors: ["usa"], severity: 4, commodities: [] } },
  { label: "Taiwan crisis", spec: { title: "Taiwan crisis", type: "military_strike", regions: ["east_asia"], actors: ["china", "taiwan", "usa"], severity: 5, commodities: [] } },
  { label: "Euro country default", spec: { title: "A euro area country cannot pay its debts", type: "sovereign_default", regions: ["europe"], actors: ["italy", "eu"], severity: 4, commodities: [] } },
  { label: "Emerging market currency crash", spec: { title: "An emerging market currency crashes", type: "currency_crisis", regions: ["latin_america"], actors: [], severity: 3, commodities: [] } },
  { label: "US bank run", spec: { title: "Run on a large US bank", type: "bank_run", regions: ["north_america"], actors: ["usa", "fed"], severity: 3, commodities: [] } },
  { label: "Bond yields spike", spec: { title: "US bond yields spike on inflation", type: "rate_shock", regions: ["north_america"], actors: ["usa", "fed"], severity: 3, commodities: [] } },
  { label: "Crypto exchange collapse", spec: { title: "A big crypto exchange collapses", type: "crypto_crash", regions: ["global"], actors: [], severity: 3, commodities: [] } },
  { label: "Shipping route blocked", spec: { title: "A major shipping route is blocked", type: "supply_chain_shock", regions: ["middle_east"], actors: [], severity: 2, commodities: ["oil"] } },
];

const SAVED_KEY = "parity.scenarios.v1";

export interface Saved { id: string; savedAt: string; spec: Spec }

export function readSaved(): Saved[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as Saved[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeSaved(list: Saved[]): boolean {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/** The scenario as a readable query string, so a link reopens it. */
export function specToQuery(s: Spec): string {
  const p = new URLSearchParams();
  if (s.title) p.set("t", s.title);
  if (s.type) p.set("type", s.type);
  if (s.regions.length) p.set("r", s.regions.join(","));
  if (s.actors.length) p.set("a", s.actors.join(","));
  if (s.severity) p.set("sev", String(s.severity));
  if (s.commodities.length) p.set("c", s.commodities.join(","));
  if (s.assets.join(",") !== DEFAULT_ASSETS.join(",")) p.set("show", s.assets.join(","));
  if (s.minScore != null) p.set("min", String(s.minScore));
  if (s.maxCount != null) p.set("max", String(s.maxCount));
  return p.toString();
}

export function specFromQuery(q: string): Spec | null {
  const p = new URLSearchParams(q);
  if (![...p.keys()].length) return null;
  const num = (k: string) => (p.get(k) != null && !Number.isNaN(Number(p.get(k))) ? Number(p.get(k)) : null);
  return {
    title: p.get("t") ?? "",
    type: p.get("type") ?? "",
    regions: list(p.get("r")),
    actors: list(p.get("a")),
    severity: Math.max(0, Math.min(5, num("sev") ?? 0)),
    commodities: list(p.get("c")),
    assets: p.get("show") ? list(p.get("show")) : DEFAULT_ASSETS,
    minScore: num("min"),
    maxCount: num("max"),
  };
}
