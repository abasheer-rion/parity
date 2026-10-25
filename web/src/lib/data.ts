// Where results come from: the deploy job copies published runs into static files
// (scripts/export_site_data.py) under /data/, which only signed-in people can fetch
// (web/functions/_middleware.ts). In local development the engine's own output is
// served instead.
import type { BatchSummary, Report } from "./types";
import { rumAge } from "./rum";

export type Source = "static" | "local";
export const source: Source = import.meta.env.DEV ? "local" : "static";

export interface BatchInfo extends BatchSummary { kind?: string; run_id?: string | null }

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status === 404 ? "No research runs have been published yet." : `Could not load ${url} (${res.status}).`);
  return (await res.json()) as T;
}

export async function listBatches(): Promise<BatchInfo[]> {
  if (source === "local") return [];
  return json<BatchInfo[]>("/data/batches.json");
}

export async function loadReport(batchId?: string): Promise<Report> {
  if (source === "local") return json<Report>("/local/latest.json");
  const report = await json<Report>(batchId ? `/data/batch/${batchId}.json` : "/data/latest.json");
  if (!batchId) rumAge("latest", (report as { generated_at?: string }).generated_at);
  return report;
}

export async function listMembers(): Promise<{ email: string; added_at: string }[]> {
  if (source === "local") return [];
  return json("/data/members.json");
}

/** One variation tried by the always-on strategy search (DEC-0014). */
export interface SearchRow {
  id: string; name: string; line: string; family: string; style: string; asset: string;
  start: string; years: number; cagr: number | null; vol: number | null; sharpe: number | null;
  max_dd: number | null; turnover: number | null; breakeven_bps: number | null; corr: number | null;
  beats_market: number | null; deflated: number | null; spec: Record<string, unknown>;
}

export interface SearchDoc {
  generated_at: string; trials: number; failed: number; beat_market: number;
  passed_luck_check: number; by_family: Record<string, number>; by_asset: Record<string, number>;
  rows: SearchRow[];
}

export async function loadSearch(): Promise<SearchDoc> {
  const url = source === "local" ? "/local/search.json" : "/data/search.json";
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status === 404 ? "The strategy search has not sent any results yet." : `Could not load the search (${res.status}).`);
  const doc = (await res.json()) as SearchDoc;
  rumAge("search", doc.generated_at);
  return doc;
}
