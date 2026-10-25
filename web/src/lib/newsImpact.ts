// The news archive and the news impact engine on the site. The deploy job's
// `parity news export` writes news/archive/*.json and news/impact.json; shapes match
// engine/src/parity/news/export.py (build_archive, build_impact) and study.py.
import { isMissing, source } from "./data";
import type { NewsSource, Unit } from "./news";

const base = source === "local" ? "/local/news" : "/data/news";

async function get<T>(name: string): Promise<T> {
  const res = await fetch(`${base}/${name}`, { cache: "no-cache" });
  if (!res.ok || isMissing(res)) throw new Error(isMissing(res) ? (source === "local" ? "The news archive has not been exported yet. Run `parity news backfill` then `parity news export`." : "The news archive has not been published yet.") : `Could not load ${name} (${res.status}).`);
  return (await res.json()) as T;
}

export interface ArchiveIndex {
  generated_at: string; total: number; fields: string[];
  years: { year: number; count: number }[];
  topics: { id: string; label: string }[]; sources: NewsSource[];
}
export interface ArchiveItem {
  id: string; published_at: string; source: string; publisher: string; title: string; url: string;
  category: string; topics: string[]; assets: string[]; currencies: string[]; commodities: string[]; regions: string[];
}
type Row = [string, string, string, string, string, string, string, string[], string[], string[], string[], string[]];

export const loadArchiveIndex = () => get<ArchiveIndex>("archive/index.json");
const yearCache = new Map<number, Promise<ArchiveItem[]>>();
export function loadArchiveYear(year: number): Promise<ArchiveItem[]> {
  if (!yearCache.has(year)) {
    yearCache.set(year, get<{ rows: Row[] }>(`archive/${year}.json`).then((d) => d.rows.map((r) => ({
      id: r[0], published_at: r[1], source: r[2], publisher: r[3], title: r[4], url: r[5], category: r[6],
      topics: r[7], assets: r[8], currencies: r[9], commodities: r[10], regions: r[11],
    }))));
  }
  return yearCache.get(year)!;
}

export type StudyHorizon = "1d" | "5d" | "20d";
export interface HorizonStats {
  n: number; mean_z: number | null; median_z: number | null; ci_lo: number | null; ci_hi: number | null;
  mean_move: number | null; median_move: number | null; hit_rate: number | null; random_mean_z: number | null;
  random_hit_rate: number | null; p_random: number | null; q: number | null;
  n_non_overlapping: number; mean_z_non_overlapping: number | null;
}
export type Headline = [string, string, string]; // title, url, source
export interface StudyEvent {
  base_date: string; event_date: string | null; overlaps?: boolean; n_headlines: number;
  z_1d: number | null; z_5d: number | null; z_20d: number | null;
  move_1d: number | null; move_5d: number | null; move_20d: number | null;
  share_of_days_as_big?: number | null; items: Headline[];
}
type Num = number | null;
export interface Study {
  n_headlines: number; n_events: number; n_overlapping?: number; n_non_overlapping?: number;
  first?: string; last?: string; warnings: string[];
  horizons?: Record<StudyHorizon, HorizonStats>;
  path?: { k: number[]; mean_z: Num[]; median_z: Num[]; lo_z: Num[]; hi_z: Num[]; mean_move: Num[];
    random_mean_z: Num[]; random_lo_z: Num[]; random_hi_z: Num[]; n: number[] };
  events?: StudyEvent[];
}
export interface RankRow {
  asset?: string; topic?: string; label: string; n_events: number; n_overlapping: number;
  mean_z: Num; median_z: Num; ci_lo: Num; ci_hi: Num; hit_rate: Num; random_hit_rate: Num; mean_move: Num;
  p_random: Num; q: Num; thin: boolean;
}
export interface Ranking { what: string; horizon: StudyHorizon; tried: number; rows: RankRow[]; warnings: string[] }
export interface ImpactDoc {
  generated_at: string; horizons: StudyHorizon[]; pre: number; post: number; min_events: number; n_items: number;
  assets: { key: string; label: string; unit: Unit; first: string; last: string }[];
  topics: { id: string; label: string; n_headlines: number }[];
  studies: Record<string, Record<string, Study>>;
  by_topic: Record<string, Ranking>; by_asset: Record<string, Ranking>;
  moves: Record<string, { share_all_days_z2: Num; days_per_year: Record<string, number>; days: StudyEvent[] }>;
}
export const loadImpact = () => get<ImpactDoc>("impact.json");

/** How strong the evidence is, in words, from a q-value (a p-value corrected for how many
 *  comparisons were tried) and the number of events. */
export function evidenceWord(q: Num | undefined, n: number, min = 20): string {
  if (q == null) return "too few events to test";
  if (n < min) return q < 0.05 ? "hint only, few events" : "no clear pattern";
  return q < 0.01 ? "strong" : q < 0.05 ? "moderate" : q < 0.1 ? "weak" : "no clear pattern";
}
