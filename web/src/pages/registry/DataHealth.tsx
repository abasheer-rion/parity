// Data health (DEC-0064): every enrolled series and live feed, checked each cycle of the
// always-on service. Status and uptime per source, the live feeds, the series in trouble and
// the newest events. Nobody is paged; the service heals what it can and logs every change.
import { Title } from "../../components/Shell";
import { Card } from "../../ui/layout";
import { Grid, Sparkline, Stat, TableScroll } from "../../ui";
import {
  counts, eventWords, loadEvents, loadSeries, loadUptime, sourceUptime, type DataEvent, type DataSeries, type Health, type Uptime,
} from "../../lib/registry";
import { HealthDot, num, Pending, pct, RegistryNav, StatusBadge, useLoad } from "./common";

const ACTIVE = new Set(["enrolled", "live", "degraded"]);
const RANK: Record<Health, number> = { dead: 0, stale: 1, late: 2, unknown: 3, idle: 4, ok: 5 };

export function DataHealth() {
  const series = useLoad(loadSeries);
  const uptime = useLoad(() => loadUptime("source", 30));
  const events = useLoad(() => loadEvents(60));
  return (
    <>
      <div className="page-head">
        <Title>Data health</Title>
        <p>
          Every enrolled series and live feed is checked each cycle of the always-on service, about every 20 minutes. Late
          means past its expected cadence; stale means past twice it. Nobody is paged. Stale series are fetched again with
          a growing wait, a backup source is named where one exists, and a series discovery added is retired after 14 days
          without data. Curated series are never retired by the service.
        </p>
        <RegistryNav here="#/registry/health" />
      </div>
      <Pending v={series} rows={6}>{(rows) => <Summary rows={rows.filter((r) => ACTIVE.has(r.status))} />}</Pending>
      <Card title="Sources, last 30 days">
        <Pending v={series} rows={12}>{(rows) => <Pending v={uptime} rows={12}>{(u) => <Sources rows={rows.filter((r) => ACTIVE.has(r.status))} uptime={u} />}</Pending>}</Pending>
      </Card>
      <Card title="Live feeds">
        <Pending v={series} rows={6}>{(rows) => <Feeds rows={rows.filter((r) => r.origin === "live" && ACTIVE.has(r.status))} />}</Pending>
      </Card>
      <Card title="Series that need attention">
        <Pending v={series} rows={8}>{(rows) => <Trouble rows={rows.filter((r) => ACTIVE.has(r.status) && ["late", "stale", "dead"].includes(r.health))} />}</Pending>
      </Card>
      <Card title="Newest events">
        <Pending v={events} rows={10}>{(e) => <Events rows={e} />}</Pending>
      </Card>
    </>
  );
}

function Summary({ rows }: { rows: DataSeries[] }) {
  const h = counts<Health>(rows as never, "health");
  const checked = rows.map((r) => r.health_checked_at).filter(Boolean).sort().pop();
  return (
    <Grid cols={4}>
      <Stat label="Fresh or idle" value={((h.ok ?? 0) + (h.idle ?? 0)).toLocaleString("en-US")} sub={`of ${rows.length.toLocaleString("en-US")} checked series and feeds`} />
      <Stat label="Late" value={(h.late ?? 0).toLocaleString("en-US")} sub="past their cadence" />
      <Stat label="Stale or dead" value={((h.stale ?? 0) + (h.dead ?? 0)).toLocaleString("en-US")} sub="past twice their cadence" />
      <Stat label="Last check" value={checked ? checked.slice(11, 16) : "n/a"} sub={checked ? `${checked.slice(0, 10)}, UTC` : "the service has not reported yet"} />
    </Grid>
  );
}

function Sources({ rows, uptime }: { rows: DataSeries[]; uptime: Uptime[] }) {
  const up = new Map(sourceUptime(uptime).map((u) => [u.id, u]));
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const bySrc = new Map<string, DataSeries[]>();
  rows.forEach((r) => bySrc.set(r.source_id, [...(bySrc.get(r.source_id) ?? []), r]));
  const list = [...bySrc.entries()].map(([id, rs]) => {
    const worst = rs.reduce((w, r) => (RANK[r.health] < RANK[w] ? r.health : w), "ok" as Health);
    const days = uptime.filter((u) => u.id === id);
    const recent = days.filter((u) => u.day >= week);
    const share7 = recent.reduce((s, u) => s + u.checks, 0) ? recent.reduce((s, u) => s + u.ok, 0) / recent.reduce((s, u) => s + u.checks, 0) : null;
    return { id, n: rs.length, worst, share7, share30: up.get(id)?.share ?? null, points: days.map((u) => [u.day, u.checks ? u.ok / u.checks : 0] as [string, number]) };
  }).sort((a, b) => RANK[a.worst] - RANK[b.worst] || (a.share30 ?? 2) - (b.share30 ?? 2) || a.id.localeCompare(b.id));
  return (
    <TableScroll label="Sources">
      <table className="catalog">
        <thead><tr><th>Source</th><th>Series</th><th>Worst now</th><th>Uptime 7 days</th><th>Uptime 30 days</th><th>Daily uptime</th></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td><a href={`#/registry?q=${encodeURIComponent(s.id)}`}>{s.id}</a></td>
              <td>{s.n}</td>
              <td><HealthDot h={s.worst} /></td>
              <td>{pct(s.share7)}</td>
              <td>{pct(s.share30)}</td>
              <td>{s.points.length > 1 ? <Sparkline points={s.points} /> : <span className="muted small">n/a</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Feeds({ rows }: { rows: DataSeries[] }) {
  if (!rows.length) return <p className="muted small">No live feeds checked yet.</p>;
  const n = (v: unknown, d = 0) => (typeof v === "number" ? v.toFixed(d) : "n/a");
  return (
    <TableScroll label="Live feeds">
      <table className="catalog">
        <thead><tr><th>Feed</th><th>Health</th><th>Viewers</th><th>Messages a minute</th><th>Lag, median</th><th>Lag, 95th percentile</th><th>Probe</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const d = r.health_detail ?? {};
            return (
              <tr key={r.id}>
                <td className="wrap"><a href={`#/registry/s/${encodeURIComponent(r.id)}`}>{r.id}</a><div className="muted small">{typeof d.why === "string" ? d.why : r.name}</div></td>
                <td><HealthDot h={r.health} /></td>
                <td>{n(d.viewers)}</td>
                <td>{n(d.msgs_per_min, 1)}</td>
                <td>{typeof d.lag_p50_ms === "number" ? `${d.lag_p50_ms} ms` : "n/a"}</td>
                <td>{typeof d.lag_p95_ms === "number" ? `${d.lag_p95_ms} ms` : "n/a"}</td>
                <td>{d.probe_ok === true ? `answered in ${n(d.probe_ms)} ms` : d.probe_ok === false ? "no answer" : "n/a"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Trouble({ rows }: { rows: DataSeries[] }) {
  if (!rows.length) return <p className="muted small">Every checked series is fresh.</p>;
  const sorted = [...rows].sort((a, b) => RANK[a.health] - RANK[b.health] || a.id.localeCompare(b.id));
  return (
    <TableScroll label="Series that need attention">
      <table className="catalog">
        <thead><tr><th>Series</th><th>Health</th><th>Status</th><th>Newest value</th><th>Age</th><th>Expected within</th><th>Backup</th></tr></thead>
        <tbody>
          {sorted.map((r) => {
            const d = r.health_detail ?? {};
            const backup = d.backup as { id?: string; health?: string } | undefined;
            return (
              <tr key={r.id}>
                <td className="wrap"><a href={`#/registry/s/${encodeURIComponent(r.id)}`}>{r.id}</a>{typeof d.error_kind === "string" && <div className="muted small">last problem: {d.error_kind}</div>}</td>
                <td><HealthDot h={r.health} /></td>
                <td><StatusBadge s={r.status} /></td>
                <td>{r.last_obs ?? "n/a"}</td>
                <td>{typeof d.age_hours === "number" ? `${num(d.age_hours / 24, 1)} days` : "n/a"}</td>
                <td>{typeof d.cadence_hours === "number" ? `${num(d.cadence_hours / 24, 1)} days` : "n/a"}</td>
                <td>{backup?.id ? `${backup.id} (${backup.health ?? "unknown"})` : r.backup_id ?? "none"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Events({ rows }: { rows: DataEvent[] }) {
  if (!rows.length) return <p className="muted small">No events yet.</p>;
  return (
    <ul className="small">
      {rows.map((e) => (
        <li key={e.id}>
          <span className="muted">{e.at.slice(0, 16).replace("T", " ")}</span>{" "}
          {e.series_id ? <a href={`#/registry/s/${encodeURIComponent(e.series_id)}`}>{e.series_id}</a> : e.source_id}{" "}
          {eventWords(e)}
        </li>
      ))}
    </ul>
  );
}
