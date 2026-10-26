// News page data. The deploy job runs `parity news export` and ships the files under
// /data/news/; in local development the engine's own export (engine/output/news) is
// served at /local/news/ instead. Shapes match engine/src/parity/news/export.py.
import type { Point } from "./types";
import { isMissing, source } from "./data";
import { rumAge } from "./rum";

export type Unit = "pct" | "pp" | "pt";
export interface Move { move: number | null; z: number | null; end_date?: string }
export interface Impact { label: string; unit: Unit; base_date: string; "1h": Move | null; "1d": Move | null; "1w": Move | null; "1m": Move | null }
export type Horizon = "1h" | "1d" | "1w" | "1m";

export interface NewsSource {
  id: string; name: string; licence: string; terms_url: string; summary_stored: boolean;
  key_env: string | null; needs_contact: boolean; display: "yes" | "no" | "ask";
}

export interface Article {
  id: string; source: string; publisher: string; published_at: string; title: string; url: string;
  summary: string; currencies: string[]; commodities: string[]; regions: string[]; category: string;
  tickers: string[]; primary: string | null; impacts: Record<string, Impact>; path: Point[];
}

export interface NewsDoc { generated_at: string; prices_through: string | null; sources: NewsSource[]; horizons: Horizon[]; articles: Article[] }

export interface RecordDay {
  date: string; series: string; label: string; unit: Unit; move: number | null; z: number | null; rank: number;
  news: { title: string; url: string; source: string; publisher: string; published_at: string | null }[];
  note: string | null;
}
export interface RecordsDoc { generated_at: string; prices_through: string | null; series: { key: string; label: string; unit: Unit }[]; records: RecordDay[] }

const base = source === "local" ? "/local/news" : "/data/news";

async function get<T>(name: string): Promise<T> {
  const res = await fetch(`${base}/${name}`, { cache: "no-cache" });
  if (!res.ok || isMissing(res)) throw new Error(isMissing(res) ? (source === "local" ? "No news has been exported yet. Run `parity news fetch` then `parity news export`." : "News has not been published yet.") : `Could not load news (${res.status}).`);
  const doc = (await res.json()) as T & { generated_at?: string };
  rumAge(`news/${name}`, doc.generated_at);
  return doc;
}

export const loadNews = () => get<NewsDoc>("articles.json");
export const loadRecords = () => get<RecordsDoc>("records.json");

/** A move as text, with its unit and a true minus sign. */
export function moveText(v: number | null | undefined, unit: Unit, digits = 2): string {
  if (v == null) return "n/a";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v).toFixed(digits);
  return unit === "pct" ? `${sign}${abs}%` : unit === "pp" ? `${sign}${abs} pp` : `${sign}${abs} pt`;
}

export function zText(z: number | null | undefined): string {
  if (z == null) return "z n/a";
  return `z ${z > 0 ? "+" : z < 0 ? "−" : ""}${Math.abs(z).toFixed(1)}`;
}

/** How unusual a move is, in words, so the chip never relies on colour alone. */
export function zWord(z: number | null | undefined): string {
  if (z == null) return "no baseline";
  const a = Math.abs(z);
  return a >= 3 ? "very unusual" : a >= 2 ? "unusual" : a >= 1 ? "normal size" : "small";
}
