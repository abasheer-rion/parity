// The numbers behind the latency page and the health line (DEC-0045): how old each source
// is against its cadence, how long jobs and steps take, and what real browsers saw. All
// three tables are public and hold no personal data. The rules match engine/src/parity/
// latency.py: past its cadence a row is late, past twice its cadence it is stale.
//
// No imports at the top level, so tests can load it without a database.

export const STALE_FACTOR = 2;

export interface FreshRow {
  source: string; series: string; label: string; kind: "prices" | "markets" | "news" | "site" | "service";
  basis: "source" | "fetch" | "publish"; cadence_hours: number;
  source_at: string | null; fetched_at: string | null; published_at: string | null; ok: boolean; reported_at: string;
}
export interface StepRow { pipeline: string; run_key: string; step: string; started_at: string; finished_at: string; seconds: number; ok: boolean; detail: Record<string, unknown> }
export interface RumRow { hour: string; app: string; metric: string; endpoint: string; region: string; n: number; hits: number; total: number; bins: number[] }

export type Status = "ok" | "late" | "stale" | "unknown";

const HOUR = 3_600_000;

/** Hours since the time the row's cadence applies to, or null when it was never fetched. */
export function ageHours(r: FreshRow, now: number): number | null {
  const t = r.basis === "source" ? r.source_at : r.basis === "fetch" ? r.fetched_at : r.published_at ?? r.fetched_at;
  if (!t) return null;
  return (now - Date.parse(t)) / HOUR;
}

export function status(r: FreshRow, now: number): Status {
  const age = ageHours(r, now);
  if (age == null) return "unknown";
  if (!r.ok || age > r.cadence_hours * STALE_FACTOR) return "stale";
  return age > r.cadence_hours ? "late" : "ok";
}

export interface SourceSummary {
  source: string; kind: FreshRow["kind"]; rows: number; ok: number; late: number; stale: number; unknown: number;
  worst: FreshRow | null; worstAge: number | null; status: Status; lastFetch: string | null; lastPublish: string | null;
}

const rank: Record<Status, number> = { ok: 0, unknown: 1, late: 2, stale: 3 };

/** One line per source, worst first. A source takes the status of its worst row. */
export function bySource(rows: FreshRow[], now: number): SourceSummary[] {
  const out = new Map<string, SourceSummary>();
  for (const r of rows) {
    const s = out.get(r.source) ?? { source: r.source, kind: r.kind, rows: 0, ok: 0, late: 0, stale: 0, unknown: 0, worst: null, worstAge: null, status: "ok" as Status, lastFetch: null, lastPublish: null };
    const st = status(r, now);
    s.rows += 1;
    s[st] += 1;
    const ratio = (x: FreshRow) => (ageHours(x, now) ?? Infinity) / x.cadence_hours;
    if (!s.worst || rank[st] > rank[status(s.worst, now)] || (rank[st] === rank[status(s.worst, now)] && ratio(r) > ratio(s.worst))) {
      s.worst = r;
      s.worstAge = ageHours(r, now);
    }
    if (r.fetched_at && (!s.lastFetch || r.fetched_at > s.lastFetch)) s.lastFetch = r.fetched_at;
    if (r.published_at && (!s.lastPublish || r.published_at > s.lastPublish)) s.lastPublish = r.published_at;
    if (rank[st] > rank[s.status]) s.status = st;
    out.set(r.source, s);
  }
  return [...out.values()].sort((a, b) => rank[b.status] - rank[a.status] || b.stale - a.stale || b.late - a.late || a.source.localeCompare(b.source));
}

// ------------------------------------------------------------------ histograms

export const BINS = 64;

/** The bin a value falls in: 0 below 1, then eight per tenfold step (as in rum_ingest). */
export function binOf(v: number): number {
  if (!(v >= 1)) return 0;
  return Math.min(BINS - 1, Math.floor(8 * Math.log10(v)) + 1);
}

/** The middle of a bin, on a log scale. */
export function binMid(k: number): number {
  return k <= 0 ? 0.5 : 10 ** ((k - 0.5) / 8);
}

export function addBins(a: number[], b: number[]): number[] {
  const out = a.length ? [...a] : new Array(BINS).fill(0);
  b.forEach((x, i) => { out[i] = (out[i] ?? 0) + x; });
  return out;
}

/** A percentile (0 to 1) read from summed bins, or null with no data. */
export function percentile(bins: number[], q: number): number | null {
  const n = bins.reduce((s, x) => s + x, 0);
  if (!n) return null;
  const target = q * n;
  let cum = 0;
  for (let k = 0; k < bins.length; k++) {
    cum += bins[k];
    if (cum >= target) return binMid(k);
  }
  return binMid(bins.length - 1);
}

/** Plain percentiles of a list of numbers (nearest rank). */
export function pct(values: number[], q: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

export interface RumGroup { key: string; n: number; hits: number; bins: number[] }

/** Sums timing rows by a key (app, region, endpoint), for one metric. */
export function groupRum(rows: RumRow[], metric: string, key: (r: RumRow) => string): RumGroup[] {
  const out = new Map<string, RumGroup>();
  for (const r of rows) {
    if (r.metric !== metric) continue;
    const k = key(r);
    const g = out.get(k) ?? { key: k, n: 0, hits: 0, bins: [] };
    g.n += r.n;
    g.hits += r.hits;
    g.bins = addBins(g.bins, r.bins);
    out.set(k, g);
  }
  return [...out.values()].sort((a, b) => b.n - a.n);
}

// ------------------------------------------------------------------ steps

export interface StepStat { pipeline: string; step: string; n: number; p50: number | null; p95: number | null; failed: number; last: string }

export function stepStats(rows: StepRow[]): StepStat[] {
  const out = new Map<string, { pipeline: string; step: string; v: number[]; failed: number; last: string }>();
  for (const r of rows) {
    const k = `${r.pipeline}\u0000${r.step}`;
    const s = out.get(k) ?? { pipeline: r.pipeline, step: r.step, v: [], failed: 0, last: r.started_at };
    s.v.push(r.seconds);
    if (!r.ok) s.failed += 1;
    if (r.started_at > s.last) s.last = r.started_at;
    out.set(k, s);
  }
  return [...out.values()].map((s) => ({ pipeline: s.pipeline, step: s.step, n: s.v.length, p50: pct(s.v, 0.5), p95: pct(s.v, 0.95), failed: s.failed, last: s.last }));
}

// ------------------------------------------------------------------ words

export function dur(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "n/a";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 90) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const m = seconds / 60;
  if (m < 90) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

export const ms = (v: number | null) => (v == null ? "n/a" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(v < 10_000 ? 2 : 1)} s`);
export const bytes = (v: number | null) => (v == null ? "n/a" : v < 1024 ? `${Math.round(v)} B` : v < 1024 ** 2 ? `${Math.round(v / 1024)} KB` : `${(v / 1024 ** 2).toFixed(1)} MB`);

export interface HealthExtra { text: string; stale: boolean }

/**
 * The two parts the health line adds: how old the news and prices on the site are, and
 * how late the last scheduled refresh started. Null parts are left out.
 */
export function healthExtras(fresh: FreshRow[], steps: StepRow[], now: number): HealthExtra[] {
  const out: HealthExtra[] = [];
  const newest = (rows: FreshRow[], field: "fetched_at" | "source_at") =>
    rows.map((r) => r[field]).filter((x): x is string => !!x).sort().pop() ?? null;
  const news = newest(fresh.filter((r) => r.kind === "news"), "fetched_at");
  const prices = newest(fresh.filter((r) => r.kind === "prices" && r.series !== "fetch"), "source_at");
  const parts: string[] = [];
  let stale = false;
  if (news) {
    const h = (now - Date.parse(news)) / HOUR;
    parts.push(`news ${dur(h * 3600)}`);
    stale ||= h > 3;
  }
  if (prices) parts.push(`prices ${dur((now - Date.parse(prices)) / 1000)}`);
  if (parts.length) out.push({ text: `data age: ${parts.join(", ")}`, stale });
  const queue = steps.filter((s) => s.pipeline === "gha:news" && s.step === "_queue").sort((a, b) => a.finished_at.localeCompare(b.finished_at)).pop();
  if (queue) out.push({ text: `refresh lag: ${dur(queue.seconds)}`, stale: queue.seconds > 3600 });
  return out;
}

// ------------------------------------------------------------------ loading

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 10_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadFreshness(): Promise<FreshRow[]> {
  const { supabase } = await import("../auth/client");
  return all<FreshRow>((a, b) => supabase.from("data_freshness").select("*").order("source").range(a, b));
}

/** Step rows since `sinceHours` ago; `summary` keeps only whole runs and the timing rows. */
export async function loadSteps(sinceHours: number, summary = false): Promise<StepRow[]> {
  const { supabase } = await import("../auth/client");
  const since = new Date(Date.now() - sinceHours * HOUR).toISOString();
  return all<StepRow>((a, b) => {
    let q = supabase.from("pipeline_steps").select("pipeline, run_key, step, started_at, finished_at, seconds, ok, detail").gte("started_at", since);
    if (summary) q = q.in("step", ["_run", "_queue", "_gap", "_chain"]);
    return q.order("started_at", { ascending: false }).range(a, b);
  });
}

export async function loadRum(sinceHours: number): Promise<RumRow[]> {
  const { supabase } = await import("../auth/client");
  const since = new Date(Date.now() - sinceHours * HOUR).toISOString();
  return all<RumRow>((a, b) => supabase.from("rum_hourly").select("*").gte("hour", since).order("hour").range(a, b));
}

/** Just what the health line needs: three one-row reads, not the whole table. */
export async function loadHealthExtras(): Promise<{ fresh: FreshRow[]; steps: StepRow[] }> {
  const { supabase } = await import("../auth/client");
  const [news, prices, queue] = await Promise.all([
    supabase.from("data_freshness").select("*").eq("kind", "news").not("fetched_at", "is", null).order("fetched_at", { ascending: false }).limit(1),
    supabase.from("data_freshness").select("*").eq("kind", "prices").neq("series", "fetch").not("source_at", "is", null).order("source_at", { ascending: false }).limit(1),
    supabase.from("pipeline_steps").select("pipeline, run_key, step, started_at, finished_at, seconds, ok, detail").eq("pipeline", "gha:news").eq("step", "_queue").order("finished_at", { ascending: false }).limit(1),
  ]);
  for (const r of [news, prices, queue]) if (r.error) throw r.error;
  return { fresh: [...(news.data ?? []), ...(prices.data ?? [])] as FreshRow[], steps: (queue.data ?? []) as StepRow[] };
}

// ------------------------------------------------------------------ live feeds (DEC-0052)

/** The hops the live feeds report, in trip order. */
export const LIVE_HOPS = ["feed", "edge", "net", "screen", "e2e"] as const;
export type LiveHop = (typeof LIVE_HOPS)[number];
const LIVE_EP = /^trade:live\/([a-z0-9-]+)\/(feed|edge|net|screen|e2e)$/;

/** Per live feed, each hop's summed histogram (browser samples, metric "lag", in ms). */
export function liveFeeds(rows: RumRow[]): { src: string; hops: Partial<Record<LiveHop, RumGroup>> }[] {
  const out = new Map<string, Partial<Record<LiveHop, RumGroup>>>();
  for (const r of rows) {
    if (r.metric !== "lag") continue;
    const m = r.endpoint.match(LIVE_EP);
    if (!m) continue;
    const [, src, hop] = m as unknown as [string, string, LiveHop];
    const f = out.get(src) ?? {};
    const g = f[hop] ?? { key: hop, n: 0, hits: 0, bins: [] };
    g.n += r.n; g.hits += r.hits; g.bins = addBins(g.bins, r.bins);
    f[hop] = g;
    out.set(src, f);
  }
  return [...out.entries()].map(([src, hops]) => ({ src, hops })).sort((a, b) => a.src.localeCompare(b.src));
}

export const isLiveEndpoint = (e: string) => e.startsWith("trade:live/");

const COUNT_EP = /^trade:live\/([a-z0-9-]+)\/(reconnect|lost)$/;

/** Per live feed, the reconnects and lost updates browsers reported (metric "gap", DEC-0053). */
export function liveCounts(rows: RumRow[]): Record<string, { reconnect: number; lost: number }> {
  const out: Record<string, { reconnect: number; lost: number }> = {};
  for (const r of rows) {
    if (r.metric !== "gap") continue;
    const m = r.endpoint.match(COUNT_EP);
    if (!m) continue;
    const c = (out[m[1]] ??= { reconnect: 0, lost: 0 });
    c[m[2] as "reconnect" | "lost"] += r.total;
  }
  return out;
}
