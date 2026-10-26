// Where results come from: the deploy job copies published runs into static files
// (scripts/export_site_data.py) under /data/, which only signed-in people can fetch
// (web/functions/_middleware.ts). In local development the engine's own output is
// served instead.
import type { BatchSummary, Report } from "./types";
import { rumAge } from "./rum";

export type Source = "static" | "local";
// Optional chaining: Pages Functions import this file too (the hosted MCP server, DEC-0051),
// and there import.meta.env does not exist.
export const source: Source = import.meta.env?.DEV ? "local" : "static";

export interface BatchInfo extends BatchSummary { kind?: string; run_id?: string | null }

/**
 * True when a data file is not there. The host answers a missing file with the app's HTML
 * page and a 200 (single-page fallback), so a 404 alone is not enough: without this check
 * the page shows "Unexpected token '<'" instead of saying the file is missing.
 */
export function isMissing(res: Response): boolean {
  return res.status === 404 || (res.ok && (res.headers.get("content-type") ?? "").includes("text/html"));
}

/** A data file that is not there (yet): the deploy has not written it. */
export class MissingFile extends Error {}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" });
  if (isMissing(res)) throw new MissingFile("No research runs have been published yet.");
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  return (await res.json()) as T;
}

// One copy of each report per page for a few minutes: the app, Trade's signals and Verify
// all ask for the newest run, and it is the largest file they read.
const KEEP_MS = 5 * 60_000;
const kept = new Map<string, { at: number; p: Promise<unknown> }>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const k = kept.get(key);
  if (k && Date.now() - k.at < KEEP_MS) return k.p as Promise<T>;
  const p = load();
  kept.set(key, { at: Date.now(), p });
  p.catch(() => { if (kept.get(key)?.p === p) kept.delete(key); });
  return p;
}

type Sensitivity = Record<string, unknown>;

/**
 * A run in two files (scripts/export_site_data.py): `<name>.lite.json`, everything the pages
 * show, and `<name>.sensitivity.json`, each strategy's settings test (about two thirds of the
 * bytes), which only Workbench's Try settings reads. Before the deploy writes the split
 * files, the whole `<name>.json` is read instead.
 */
async function readRun(base: string, sensitivity: boolean): Promise<Report> {
  let report: Report;
  try {
    report = await once(`${base}.lite`, () => json<Report>(`${base}.lite.json`));
  } catch (e) {
    if (!(e instanceof MissingFile)) throw e;
    return once(base, () => json<Report>(`${base}.json`));
  }
  if (!sensitivity) return report;
  let extra: Record<string, Sensitivity>;
  try {
    extra = await once(`${base}.sensitivity`, () => json<Record<string, Sensitivity>>(`${base}.sensitivity.json`));
  } catch (e) {
    if (!(e instanceof MissingFile)) throw e;
    return once(base, () => json<Report>(`${base}.json`));
  }
  return { ...report, runs: report.runs.map((r) => (r.gauntlet && extra[r.strategy] ? { ...r, gauntlet: { ...r.gauntlet, sensitivity: extra[r.strategy] } } : r)) };
}

export async function listBatches(): Promise<BatchInfo[]> {
  if (source === "local") return [];
  return json<BatchInfo[]>("/data/batches.json");
}

export async function loadReport(batchId?: string, { sensitivity = false }: { sensitivity?: boolean } = {}): Promise<Report> {
  if (source === "local") return json<Report>("/local/latest.json");
  const report = await readRun(batchId ? `/data/batch/${batchId}` : "/data/latest", sensitivity);
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
  if (isMissing(res)) throw new Error("The strategy search has not sent any results yet.");
  if (!res.ok) throw new Error(`Could not load the search (${res.status}).`);
  const doc = (await res.json()) as SearchDoc;
  rumAge("search", doc.generated_at);
  return doc;
}
