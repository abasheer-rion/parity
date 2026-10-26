// The data registry (DEC-0064): every source and series, its display rights, status, health
// and lineage, read from the public registry tables. Previews follow display rights in the
// database itself (public series for anyone, internal ones for team members only), so a page
// shows a chart only when a preview row comes back. Backtests are for signed-in people.
//
// No imports at the top level, so tests can load the helpers without a database.

export type Rights = "public" | "internal" | "research" | "none";
export type SeriesStatus = "candidate" | "enrolled" | "live" | "degraded" | "retired";
export type Health = "ok" | "late" | "stale" | "dead" | "idle" | "unknown";

export interface DataSource {
  id: string; name: string; provider: string; access_method: string; licence: string;
  display_rights: Rights; terms_url: string; terms_read_on: string | null; cost: string;
  rate_limit: string; status: string; note: string; updated_at: string;
}

export interface DataSeries {
  id: string; source_id: string; code: string; name: string; symbol: string; asset_class: string;
  region: string; frequency: string; units: string; start_date: string | null; end_date: string | null;
  published_after: number | null; lag_days: number; tags: string[]; labels: Record<string, unknown>;
  quality: number | null; status: SeriesStatus; display_rights: Rights; origin: string;
  intended_use: string; required: boolean; reason: string; discovered_by: string;
  discovered_at: string | null; enrolled_at: string | null; health: Health;
  health_checked_at: string | null; health_detail: Record<string, unknown>; last_obs: string | null;
  backup_id: string | null; updated_at: string;
}

export interface DataEvent {
  id: number; at: string; series_id: string | null; source_id: string | null; kind: string;
  from_state: string | null; to_state: string | null; detail: Record<string, unknown>;
}

export interface Uptime { scope: "source" | "series"; id: string; day: string; checks: number; ok: number; late: number; stale: number; down: number }
export interface Lineage { series_id: string; kind: string; consumer: string }
export interface BacktestTest { test: string; name: string | null; sharpe: number | null; cagr: number | null; max_dd: number | null; years: number | null; beats_market: number | null; error: string | null }
export interface Backtest { series_id: string; ran_at: string; trials: number; battery: { tests?: BacktestTest[]; correlations?: Record<string, number | null>; new_trials?: number; search_trials?: number; note?: string; error?: string } }

// key_name is not readable through the API, so the columns are named.
const SOURCE_COLS = "id, name, provider, access_method, licence, display_rights, terms_url, terms_read_on, cost, rate_limit, status, note, updated_at";

async function client() {
  const { supabase } = await import("../auth/client");
  return supabase;
}

export async function loadSources(): Promise<DataSource[]> {
  const sb = await client();
  const { data, error } = await sb.from("data_sources").select(SOURCE_COLS).order("id");
  if (error) throw error;
  return (data ?? []) as DataSource[];
}

export async function loadSeries(): Promise<DataSeries[]> {
  const sb = await client();
  const out: DataSeries[] = [];
  // In pages of 1,000, the API's row limit.
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb.from("data_series").select("*").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as DataSeries[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadEvents(limit = 60, seriesId?: string): Promise<DataEvent[]> {
  const sb = await client();
  let q = sb.from("data_events").select("id, at, series_id, source_id, kind, from_state, to_state, detail").order("id", { ascending: false }).limit(limit);
  if (seriesId) q = q.eq("series_id", seriesId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DataEvent[];
}

export async function loadUptime(scope: "source" | "series", days = 30, id?: string): Promise<Uptime[]> {
  const sb = await client();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let q = sb.from("data_uptime").select("scope, id, day, checks, ok, late, stale, down").eq("scope", scope).gte("day", since).order("day");
  if (id) q = q.eq("id", id);
  const { data, error } = await q.limit(5000);
  if (error) throw error;
  return (data ?? []) as Uptime[];
}

export interface SeriesDetail { lineage: Lineage[]; events: DataEvent[]; uptime: Uptime[]; preview: [string, number][] | null; backtest: Backtest | null }

export async function loadSeriesDetail(id: string): Promise<SeriesDetail> {
  const sb = await client();
  const [lin, events, uptime, prev, bt] = await Promise.all([
    sb.from("data_lineage").select("series_id, kind, consumer").eq("series_id", id),
    loadEvents(40, id),
    loadUptime("series", 90, id),
    sb.from("data_series_preview").select("points").eq("series_id", id).maybeSingle(),
    sb.from("data_backtests").select("series_id, ran_at, trials, battery").eq("series_id", id).maybeSingle(),
  ]);
  if (lin.error) throw lin.error;
  return {
    lineage: (lin.data ?? []) as Lineage[], events, uptime,
    preview: prev.error || !prev.data ? null : ((prev.data as { points: [string, number][] }).points ?? null),
    backtest: bt.error || !bt.data ? null : (bt.data as Backtest),
  };
}

// ------------------------------------------------------------------ helpers (tested)

export interface SeriesFilter { q?: string; status?: string; rights?: string; health?: string; asset?: string; tag?: string; source?: string }

/** Series that match every filter given; the text search reads id, name, code, source and tags. */
export function filterSeries(rows: DataSeries[], f: SeriesFilter): DataSeries[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) =>
    (!f.status || r.status === f.status) && (!f.rights || r.display_rights === f.rights) &&
    (!f.health || r.health === f.health) && (!f.asset || r.asset_class === f.asset) &&
    (!f.source || r.source_id === f.source) && (!f.tag || r.tags.includes(f.tag)) &&
    (!q || [r.id, r.name, r.code, r.source_id, ...r.tags].some((s) => s.toLowerCase().includes(q))));
}

export function counts<T extends string>(rows: { [k: string]: unknown }[], key: string): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const r of rows) {
    const k = String(r[key]) as T;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Share of checks that were ok (or idle), from daily counters; null with no checks. */
export function uptimeShare(rows: Uptime[]): number | null {
  const checks = rows.reduce((s, r) => s + r.checks, 0);
  if (!checks) return null;
  return rows.reduce((s, r) => s + r.ok, 0) / checks;
}

/** One row per source: its uptime over the window and its worst day. */
export function sourceUptime(rows: Uptime[]): { id: string; share: number | null; days: number; worst: string | null }[] {
  const by = new Map<string, Uptime[]>();
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r]);
  return [...by.entries()].map(([id, rs]) => {
    let worst: Uptime | null = null;
    for (const r of rs) if (r.checks && (!worst || r.ok / r.checks < worst.ok / worst.checks)) worst = r;
    return { id, share: uptimeShare(rs), days: rs.length, worst: worst?.day ?? null };
  }).sort((a, b) => (a.share ?? 2) - (b.share ?? 2) || a.id.localeCompare(b.id));
}

export const RIGHTS_WORD: Record<Rights, string> = {
  public: "Public", internal: "Team only", research: "Research only", none: "Not used",
};
export const RIGHTS_HELP: Record<Rights, string> = {
  public: "Anyone may see the values, with the source named.",
  internal: "The terms allow internal use: team members only, never the public.",
  research: "Used to compute results; the values are never shown.",
  none: "Not used at all.",
};
export const STATUS_WORD: Record<SeriesStatus, string> = {
  candidate: "Candidate", enrolled: "Enrolled", live: "Live", degraded: "Degraded", retired: "Retired",
};
export const HEALTH_WORD: Record<Health, string> = {
  ok: "Fresh", late: "Late", stale: "Stale", dead: "Dead", idle: "Idle", unknown: "Not checked",
};
export const FREQ_WORD: Record<string, string> = { T: "Live", D: "Daily", W: "Weekly", M: "Monthly", Q: "Quarterly", A: "Yearly" };

/** The status dot class for a health value, matching the latency page. */
export function dotFor(h: Health): "live" | "late" | "stale" | "unknown" {
  return h === "ok" || h === "idle" ? "live" : h === "late" ? "late" : h === "unknown" ? "unknown" : "stale";
}

/** The look-ahead rule in words. */
export function lagWords(s: Pick<DataSeries, "frequency" | "published_after" | "lag_days">): string {
  if (s.published_after != null) return `used ${s.published_after} business days after each ${s.frequency === "Q" ? "quarter" : "month"} ends`;
  if (s.lag_days) return `used ${s.lag_days} business day${s.lag_days === 1 ? "" : "s"} after its date`;
  return "used on its own date";
}

/** Plain words for an event, for the logs on the catalog and health pages. */
export function eventWords(e: DataEvent): string {
  const d = e.detail ?? {};
  const why = typeof d.reason === "string" ? `: ${d.reason}` : "";
  switch (e.kind) {
    case "seeded": return "added from the catalog";
    case "discovered": return `found by the ${String(d.by ?? "")} discoverer`.replace("  ", " ");
    case "enrolled": return `enrolled${typeof d.quality === "number" ? `, quality ${d.quality.toFixed(2)}` : ""}`;
    case "rejected": return `waits${why}`;
    case "status": return `${e.from_state ?? "new"} to ${e.to_state ?? ""}${why}`;
    case "health": return `health ${e.from_state ?? "unknown"} to ${e.to_state ?? ""}`;
    case "retry": return d.ok ? "fetched again, worked" : "fetched again, failed";
    case "failover": return `backup ${e.to_state ?? ""} is fresh`;
    case "retired": return `retired${why}`;
    case "backtest": return `tested on arrival: ${String(d.tests ?? 0)} tests, ${String(d.new_trials ?? 0)} new trials`;
    case "licence": return `licence recorded: ${e.to_state ?? ""} rights`;
    case "schema": return "the data's shape changed";
    default: return e.kind;
  }
}
