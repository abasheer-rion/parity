// How old the data is at every hop and how fast pages get it (DEC-0045). Three public
// tables: data_freshness (one row per source series), pipeline_steps (scheduled jobs and
// service steps) and rum_hourly (hourly totals from real browsers). Everything is read once
// on open; the tables have fixed shapes and reserved heights, so nothing jumps as it loads.
import { useEffect, useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { SOURCES } from "../lib/live/sources";
import { Card } from "../ui/layout";
import { metricsAllowed } from "../lib/metrics";
import {
  bySource, bytes, dur, groupRum, isLiveEndpoint, liveCounts, liveFeeds, LIVE_HOPS, loadFreshness, loadRum, loadSteps, ms, pct, percentile, status, stepStats, ageHours,
  type FreshRow, type RumRow, type Status, type StepRow,
} from "../lib/latency";
import { TableScroll } from "../ui";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

function useLoad<T>(fn: () => Promise<T>): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    fn().then((data) => live && setV({ state: "ok", data })).catch((e: Error) => live && setV({ state: "error", message: e.message || "Could not load." }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

const DOT: Record<Status, string> = { ok: "live", late: "late", stale: "stale", unknown: "unknown" };
const WORD: Record<Status, string> = { ok: "ok", late: "late", stale: "stale", unknown: "no fetch yet" };

function Dot({ s }: { s: Status }) {
  return <><span className={`service-dot ${DOT[s]}`} aria-hidden="true" /><span className="sr-only">{WORD[s]}</span></>;
}

const when = (iso: string | null, now: number) => (iso ? `${dur((now - Date.parse(iso)) / 1000)} ago` : "n/a");

export function Latency() {
  const fresh = useLoad(loadFreshness);
  const runs = useLoad(() => loadSteps(24 * 7, true));
  const steps = useLoad(() => loadSteps(48));
  const rum = useLoad(() => loadRum(24 * 7));
  const [now] = useState(() => Date.now());

  return (
    <>
      <div className="page-head">
        <Title>Latency</Title>
        <p>
          How old each source is against how often it should change, how long each scheduled job and service step
          takes, and how fast pages get their data in real browsers. Late means past its cadence; stale means past twice
          its cadence. Nobody is paged: stale sources are fetched once more by themselves and the retry is listed here.
        </p>
        <MetricsLink />
      </div>
      <Hops fresh={fresh} runs={runs} rum={rum} now={now} />
      <Sources fresh={fresh} now={now} />
      <Pipelines runs={runs} steps={steps} />
      <Client rum={rum} />
      <LiveFeeds rum={rum} />
    </>
  );
}

function Pending<T>({ v, rows, children }: { v: Load<T>; rows: number; children: (d: T) => React.ReactNode }) {
  if (v.state === "ok") return <>{children(v.data)}</>;
  // Reserve roughly the table's height while it loads, so the page does not jump.
  return <p className="muted small lat-pending" style={{ minHeight: `${rows * 30}px` }}>{v.state === "error" ? `Not available: ${v.message}` : "Loading."}</p>;
}

// ------------------------------------------------------------------ hops

function Hops({ fresh, runs, rum, now }: { fresh: Load<FreshRow[]>; runs: Load<StepRow[]>; rum: Load<RumRow[]>; now: number }) {
  const rows = useMemo(() => {
    const out: { hop: string; what: string; p50: string; p95: string; n: number }[] = [];
    if (fresh.state === "ok") {
      const data = fresh.data.filter((r) => r.kind !== "site");
      const leg = (a: (r: FreshRow) => string | null, b: (r: FreshRow) => string | null) =>
        data.map((r) => (a(r) && b(r) ? (Date.parse(b(r)!) - Date.parse(a(r)!)) / 1000 : null)).filter((x): x is number => x != null && x >= 0);
      const s2f = leg((r) => r.source_at, (r) => r.fetched_at);
      const f2p = leg((r) => r.fetched_at, (r) => r.published_at);
      const age = data.map((r) => (r.source_at ? (now - Date.parse(r.source_at)) / 1000 : null)).filter((x): x is number => x != null);
      out.push({ hop: "Source to our fetch", what: "source's own as-of time to our last fetch", p50: dur(pct(s2f, 0.5)), p95: dur(pct(s2f, 0.95)), n: s2f.length });
      out.push({ hop: "Fetch to publish", what: "our fetch to the deploy that put it on the site", p50: dur(pct(f2p, 0.5)), p95: dur(pct(f2p, 0.95)), n: f2p.length });
      out.push({ hop: "Age now", what: "source's as-of time to this moment", p50: dur(pct(age, 0.5)), p95: dur(pct(age, 0.95)), n: age.length });
    }
    if (runs.state === "ok") {
      const of = (p: string, s: string) => runs.data.filter((r) => r.pipeline === p && r.step === s).map((r) => r.seconds);
      const add = (hop: string, what: string, v: number[]) => out.push({ hop, what, p50: dur(pct(v, 0.5)), p95: dur(pct(v, 0.95)), n: v.length });
      add("Refresh start delay", "hourly news and markets job: scheduled time to start", of("gha:news", "_queue"));
      add("Time between refreshes", "start to start of the hourly job (60 min intended)", of("gha:news", "_gap"));
      add("Fetch job", "hourly news and markets job, start to end", of("gha:news", "_run"));
      add("Deploy job", "build, export and publish the site", of("gha:deploy", "_run"));
      add("Fetch to live site", "hourly job start to the end of the deploy it triggered", of("gha:deploy", "_chain"));
    }
    if (rum.state === "ok") {
      const ttd = groupRum(rum.data, "ttd", () => "all")[0];
      const fetch = groupRum(rum.data, "fetch", () => "all")[0];
      const age = groupRum(rum.data, "age", () => "all")[0];
      if (ttd) out.push({ hop: "Time to first data", what: "page start to its first data in a browser", p50: ms(percentile(ttd.bins, 0.5)), p95: ms(percentile(ttd.bins, 0.95)), n: ttd.n });
      if (fetch) out.push({ hop: "Data request", what: "one data file or database read in a browser", p50: ms(percentile(fetch.bins, 0.5)), p95: ms(percentile(fetch.bins, 0.95)), n: fetch.n });
      if (age) out.push({ hop: "Age on screen", what: "data's own time to when a page showed it", p50: dur(percentile(age.bins, 0.5)), p95: dur(percentile(age.bins, 0.95)), n: age.n });
    }
    return out;
  }, [fresh, runs, rum, now]);
  return (
    <Card title="Every hop, p50 and p95" help="Server hops over the last 7 days of jobs and the current state of every source; browser hops over the last 7 days of sampled page loads.">
      <TableScroll style={{ minHeight: 11 * 30 }}>
        <table className="lat-table">
          <thead><tr><th>Hop</th><th>What it measures</th><th className="num">p50</th><th className="num">p95</th><th className="num">n</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.hop}><td>{r.hop}</td><td className="muted wrap">{r.what}</td><td className="num">{r.p50}</td><td className="num">{r.p95}</td><td className="num">{r.n.toLocaleString("en-US")}</td></tr>
          ))}</tbody>
        </table>
      </TableScroll>
    </Card>
  );
}

// ------------------------------------------------------------------ sources

function Sources({ fresh, now }: { fresh: Load<FreshRow[]>; now: number }) {
  return (
    <Card title="Data freshness by source" help="Age is measured from the source's own as-of time for prices, and from our last fetch for news and markets feeds, whose own sources can be quiet for weeks.">
      <Pending v={fresh} rows={16}>{(rows) => {
        const groups = bySource(rows, now);
        const bad = rows.map((r) => ({ r, s: status(r, now), a: ageHours(r, now) })).filter((x) => x.s === "late" || x.s === "stale")
          .sort((x, y) => (y.a ?? 0) / y.r.cadence_hours - (x.a ?? 0) / x.r.cadence_hours).slice(0, 25);
        return (
          <>
            <TableScroll>
              <table className="lat-table">
                <thead><tr><th>Source</th><th className="num">Series</th><th className="num">Late</th><th className="num">Stale</th><th>Worst</th><th className="num">Its age</th><th className="num">Cadence</th><th>Last fetch</th><th>Last publish</th></tr></thead>
                <tbody>{groups.map((g) => (
                  <tr key={g.source}>
                    <td><Dot s={g.status} />{g.source}</td>
                    <td className="num">{g.rows}</td>
                    <td className="num">{g.late || ""}</td>
                    <td className="num">{g.stale || ""}</td>
                    <td><code>{g.worst?.series}</code></td>
                    <td className="num">{dur(g.worstAge == null ? null : g.worstAge * 3600)}</td>
                    <td className="num">{dur((g.worst?.cadence_hours ?? 0) * 3600)}</td>
                    <td>{when(g.lastFetch, now)}</td>
                    <td>{when(g.lastPublish, now)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableScroll>
            {bad.length > 0 && (
              <TableScroll>
                <table className="lat-table">
                  <caption className="small muted">Late and stale series, worst first ({bad.length} shown)</caption>
                  <thead><tr><th>Series</th><th>What</th><th className="num">Age</th><th className="num">Cadence</th><th>Measured from</th></tr></thead>
                  <tbody>{bad.map(({ r, s, a }) => (
                    <tr key={`${r.source}/${r.series}`}>
                      <td><Dot s={s} /><code>{r.series}</code></td>
                      <td className="muted wrap">{r.label}</td>
                      <td className="num">{dur(a == null ? null : a * 3600)}</td>
                      <td className="num">{dur(r.cadence_hours * 3600)}</td>
                      <td>{r.basis === "source" ? "source's as-of time" : r.basis === "fetch" ? "our last fetch" : "last publish"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableScroll>
            )}
          </>
        );
      }}</Pending>
    </Card>
  );
}

// ------------------------------------------------------------------ pipelines

const NAMES: Record<string, string> = {
  "gha:news": "Hourly news and markets", "gha:deploy": "Site deploy", "gha:research": "Nightly research run", "gha:official": "Official run",
  "gha:migrate": "Database migrations", "gha:ci": "Checks", "service:sims": "Sims service", "service:search": "Strategy search", retry: "Retries",
};

function Bars({ values, max }: { values: { v: number; ok: boolean }[]; max: number }) {
  const w = 240, h = 28, bw = Math.max(1, w / Math.max(values.length, 1) - 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${values.length} runs`} className="lat-bars">
      {values.map((x, i) => {
        const bh = Math.max(1, (x.v / (max || 1)) * h);
        return <rect key={i} x={i * (bw + 1)} y={h - bh} width={bw} height={bh} className={x.ok ? "ok" : "bad"} />;
      })}
    </svg>
  );
}

function Pipelines({ runs, steps }: { runs: Load<StepRow[]>; steps: Load<StepRow[]> }) {
  return (
    <>
      <Card title="Job durations, last 7 days" help="Each bar is one run, oldest on the left, scaled to the slowest run of that job. Failed runs are red.">
        <Pending v={runs} rows={8}>{(rows) => {
          const byPipe = new Map<string, StepRow[]>();
          for (const r of rows) if (r.step === "_run") byPipe.set(r.pipeline, [...(byPipe.get(r.pipeline) ?? []), r]);
          const list = [...byPipe.entries()].sort((a, b) => a[0].localeCompare(b[0]));
          return (
            <TableScroll>
              <table className="lat-table">
                <thead><tr><th>Job</th><th className="num">Runs</th><th className="num">p50</th><th className="num">p95</th><th className="num">Failed</th><th>Each run</th></tr></thead>
                <tbody>{list.map(([p, rs]) => {
                  const sorted = [...rs].sort((a, b) => a.started_at.localeCompare(b.started_at));
                  const v = sorted.map((r) => r.seconds);
                  return (
                    <tr key={p}>
                      <td>{NAMES[p] ?? p}</td><td className="num">{rs.length}</td>
                      <td className="num">{dur(pct(v, 0.5))}</td><td className="num">{dur(pct(v, 0.95))}</td>
                      <td className="num">{rs.filter((r) => !r.ok).length || ""}</td>
                      <td><Bars values={sorted.slice(-120).map((r) => ({ v: r.seconds, ok: r.ok }))} max={Math.max(...v)} /></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </TableScroll>
          );
        }}</Pending>
      </Card>
      <Card title="Slowest steps, last 48 hours" help="Every step of every job and service cycle, by p95 time. Retries of stale sources show under Retries.">
        <Pending v={steps} rows={12}>{(rows) => {
          const stats = stepStats(rows.filter((r) => !r.step.startsWith("_"))).sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0)).slice(0, 15);
          const retries = rows.filter((r) => r.pipeline === "retry" || r.step.startsWith("retry ") || r.step === "start news refresh").slice(0, 10);
          return (
            <>
              <TableScroll>
                <table className="lat-table">
                  <thead><tr><th>Job</th><th>Step</th><th className="num">Runs</th><th className="num">p50</th><th className="num">p95</th><th className="num">Failed</th></tr></thead>
                  <tbody>{stats.map((s) => (
                    <tr key={`${s.pipeline}/${s.step}`}><td>{NAMES[s.pipeline] ?? s.pipeline}</td><td className="wrap">{s.step}</td><td className="num">{s.n}</td><td className="num">{dur(s.p50)}</td><td className="num">{dur(s.p95)}</td><td className="num">{s.failed || ""}</td></tr>
                  ))}</tbody>
                </table>
              </TableScroll>
              <p className="small muted">
                {retries.length
                  ? `Retries in the last 48 hours: ${retries.map((r) => `${r.step} ${r.ok ? "fixed it" : "did not fix it"} (${dur(r.seconds)})`).join("; ")}.`
                  : "No retries in the last 48 hours."}
              </p>
            </>
          );
        }}</Pending>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ browsers

const APP_NAMES: Record<string, string> = { site: "Front page", product: "Product", research: "Research", sim: "Terminal", trade: "Trade", academy: "Academy", lab: "Workbench", desktop: "Desktop app", auth: "Sign in", verify: "Verify badge" };

function Client({ rum }: { rum: Load<RumRow[]> }) {
  return (
    <Card title="Real browsers, last 7 days" help="One page load in ten, without cookies, ids or addresses, and never when the browser asks not to be tracked. Percentiles come from hourly totals, so they are within about 15%.">
      <Pending v={rum} rows={10}>{(rows) => {
        if (!rows.length) return <p className="muted small">No page timings yet.</p>;
        const p = (bins: number[] | undefined, q: number, f = ms) => f(bins ? percentile(bins, q) : null);
        const by = (metric: string, key: (r: RumRow) => string) => new Map(groupRum(rows, metric, key).map((g) => [g.key, g]));
        const appTtd = by("ttd", (r) => r.app), appFetch = by("fetch", (r) => r.app), appLcp = by("lcp", (r) => r.app), appInp = by("inp", (r) => r.app), appCls = by("cls", (r) => r.app);
        const apps = [...new Set(rows.map((r) => r.app))].sort();
        const regions = groupRum(rows, "ttd", (r) => r.region);
        const regionFetch = by("fetch", (r) => r.region);
        const endpoints = groupRum(rows, "fetch", (r) => r.endpoint).map((g) => ({ ...g, p95: percentile(g.bins, 0.95) ?? 0 })).sort((a, b) => b.p95 - a.p95).slice(0, 10);
        const sizes = by("bytes", (r) => r.endpoint);
        const lags = groupRum(rows.filter((r) => !isLiveEndpoint(r.endpoint)), "lag", (r) => r.endpoint);
        return (
          <>
            <TableScroll>
              <table className="lat-table">
                <thead><tr><th>App</th><th className="num">Loads</th><th className="num">To data p50</th><th className="num">p95</th><th className="num">p99</th><th className="num">Request p50</th><th className="num">p95</th><th className="num">p99</th><th className="num">Cached</th><th className="num">LCP p75</th><th className="num">INP p75</th><th className="num">CLS p75</th></tr></thead>
                <tbody>{apps.map((a) => {
                  const t = appTtd.get(a), f = appFetch.get(a), c = appCls.get(a);
                  return (
                    <tr key={a}>
                      <td>{APP_NAMES[a] ?? a}</td><td className="num">{(c?.n ?? t?.n ?? 0).toLocaleString("en-US")}</td>
                      <td className="num">{p(t?.bins, 0.5)}</td><td className="num">{p(t?.bins, 0.95)}</td><td className="num">{p(t?.bins, 0.99)}</td>
                      <td className="num">{p(f?.bins, 0.5)}</td><td className="num">{p(f?.bins, 0.95)}</td><td className="num">{p(f?.bins, 0.99)}</td>
                      <td className="num">{f && f.n ? `${Math.round((100 * f.hits) / f.n)}%` : "n/a"}</td>
                      <td className="num">{p(appLcp.get(a)?.bins, 0.75)}</td><td className="num">{p(appInp.get(a)?.bins, 0.75)}</td>
                      <td className="num">{c ? ((percentile(c.bins, 0.75) ?? 0) / 1000).toFixed(3) : "n/a"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </TableScroll>
            <TableScroll label="By region (continent)">
              <table className="lat-table">
                <caption className="small muted">By region (continent)</caption>
                <thead><tr><th>Region</th><th className="num">Loads</th><th className="num">To data p50</th><th className="num">p95</th><th className="num">Request p50</th><th className="num">p95</th></tr></thead>
                <tbody>{regions.map((g) => (
                  <tr key={g.key}><td>{g.key === "XX" ? "unknown" : g.key}</td><td className="num">{g.n}</td><td className="num">{p(g.bins, 0.5)}</td><td className="num">{p(g.bins, 0.95)}</td><td className="num">{p(regionFetch.get(g.key)?.bins, 0.5)}</td><td className="num">{p(regionFetch.get(g.key)?.bins, 0.95)}</td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
            <TableScroll label="Slowest data requests, by p95">
              <table className="lat-table">
                <caption className="small muted">Slowest data requests, by p95</caption>
                <thead><tr><th>Request</th><th className="num">n</th><th className="num">p50</th><th className="num">p95</th><th className="num">Size p50</th><th className="num">Cached</th></tr></thead>
                <tbody>{endpoints.map((g) => (
                  <tr key={g.key}><td><code>{g.key}</code></td><td className="num">{g.n}</td><td className="num">{p(g.bins, 0.5)}</td><td className="num">{ms(g.p95)}</td><td className="num">{p(sizes.get(g.key)?.bins, 0.5, bytes)}</td><td className="num">{g.n ? `${Math.round((100 * g.hits) / g.n)}%` : ""}</td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
            {lags.length > 0 && (
              <p className="small muted">Timed refreshes, how late they ran (p95): {lags.map((g) => `${g.key} ${ms(percentile(g.bins, 0.95))}`).join("; ")}.</p>
            )}
          </>
        );
      }}</Pending>
    </Card>
  );
}

// ------------------------------------------------------------------ live feeds (DEC-0052)

const HOP_NAME: Record<string, string> = { feed: "Exchange to our edge", edge: "At our edge", net: "Edge to browser", screen: "Browser to screen", e2e: "Exchange to screen" };

interface EdgeStatus { src: string; feed?: string; upstream?: string; why?: string | null; viewers?: number; feedLagMs?: { p50: number | null; p95: number | null; p99: number | null; n: number }; upstreamOpens?: number; reconnects?: number; error?: string }

/** Every source the edge can stream: public ones and team-only ones (DEC-0056). */
const STREAMED = SOURCES.filter((s) => s.streams && s.id !== "vendor" && (s.licence === "display" || s.licence === "internal"));

function useEdgeStatus(): EdgeStatus[] | null | "error" {
  const [v, setV] = useState<EdgeStatus[] | null | "error">(null);
  useEffect(() => {
    let live = true;
    const load = () => fetch("/live/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { sources: EdgeStatus[] }) => { if (live) setV(d.sources); }).catch(() => { if (live) setV("error"); });
    void load();
    const t = window.setInterval(load, 15_000);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  return v;
}

function LiveFeeds({ rum }: { rum: Load<RumRow[]> }) {
  const edge = useEdgeStatus();
  return (
    <Card title="Live feeds, last 7 days" help="Each streamed price carries the exchange's time, our edge's receive and send times, and the browser's receive and draw times, corrected for the browser's clock. Browsers send a small random sample every 30 seconds. The edge's own line state refreshes every 15 seconds.">
      <TableScroll style={{ minHeight: 70 }} label="Our edge now">
        <table className="lat-table">
          <caption className="small muted">Our edge now</caption>
          <thead><tr><th>Source</th><th>Line</th><th className="num">Viewers</th><th className="num">Exchange to edge p50</th><th className="num">p95</th><th className="num">p99</th><th className="num">Reconnects</th></tr></thead>
          {/* One row per source from the start, filled in when the edge answers, so the table never changes height. */}
          <tbody>{STREAMED.map((m) => {
            const e = Array.isArray(edge) ? edge.find((x) => x.src === m.id) : undefined;
            const line = edge === "error" ? "not available here" : !edge ? "loading" : !e ? "off" : e.error ? "error" : `${e.upstream ?? "n/a"}${e.why ? ` (${e.why})` : ""}`;
            return (
              <tr key={m.id}><td>{m.name}{m.licence === "internal" ? " (team only)" : ""}</td><td>{line}</td><td className="num">{e?.viewers ?? 0}</td>
                <td className="num">{ms(e?.feedLagMs?.p50 ?? null)}</td><td className="num">{ms(e?.feedLagMs?.p95 ?? null)}</td><td className="num">{ms(e?.feedLagMs?.p99 ?? null)}</td><td className="num">{e?.reconnects ?? Math.max(0, (e?.upstreamOpens ?? 0) - 1)}</td></tr>
            );
          })}</tbody>
        </table>
      </TableScroll>
      <div style={{ minHeight: 220 }}><Pending v={rum} rows={6}>{(rows) => {
        const feeds = liveFeeds(rows);
        const counts = liveCounts(rows);
        // Fixed height either way, so the section never moves the page when samples arrive.
        if (!feeds.length) return <p className="muted small">No live samples from browsers yet.</p>;
        return (
          <TableScroll label="Real browsers, per hop">
            <table className="lat-table">
              <caption className="small muted">Real browsers, per hop</caption>
              <thead><tr><th>Source</th><th>Hop</th><th className="num">Samples</th><th className="num">p50</th><th className="num">p95</th><th className="num">p99</th><th className="num">Reconnects</th><th className="num">Lost updates</th></tr></thead>
              <tbody>{feeds.flatMap((f) => LIVE_HOPS.filter((h) => f.hops[h]).map((h, i) => {
                const g = f.hops[h]!;
                const c = i === 0 ? counts[f.src] : undefined;
                return <tr key={`${f.src}/${h}`}><td>{f.src}</td><td>{HOP_NAME[h]}</td><td className="num">{g.n}</td><td className="num">{ms(percentile(g.bins, 0.5))}</td><td className="num">{ms(percentile(g.bins, 0.95))}</td><td className="num">{ms(percentile(g.bins, 0.99))}</td><td className="num">{c ? c.reconnect : ""}</td><td className="num">{c ? c.lost : ""}</td></tr>;
              }))}</tbody>
            </table>
          </TableScroll>
        );
      }}</Pending></div>
    </Card>
  );
}

/**
 * The speed panels on their own, for the Metrics page (DEC-0053): every hop and the browser
 * page timings, next to the product analytics.
 */
export function SpeedPanels() {
  const fresh = useLoad(loadFreshness);
  const runs = useLoad(() => loadSteps(24 * 7, true));
  const rum = useLoad(() => loadRum(24 * 7));
  const [now] = useState(() => Date.now());
  return (
    <>
      <Hops fresh={fresh} runs={runs} rum={rum} now={now} />
      <Client rum={rum} />
    </>
  );
}

/** A link to the Metrics page, shown only to accounts on the team list (DEC-0053). */
function MetricsLink() {
  const [ok, setOk] = useState(false);
  useEffect(() => { let live = true; metricsAllowed().then((v) => live && setOk(v)).catch(() => {}); return () => { live = false; }; }, []);
  return ok ? <p className="small"><a href="#/metrics">Product metrics</a>: pages, clicks, funnel and retention, next to these speed panels.</p> : null;
}
