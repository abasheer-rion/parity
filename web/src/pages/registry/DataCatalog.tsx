// The data catalog (DEC-0064): every source and series in the registry, searchable and
// filtered by tag, licence rights, status and health, and a page per series with its chart
// (only where the rights allow showing values), lineage, quality, health history, the tests
// run when it arrived, and its licence.
import { useMemo, useState } from "react";
import { Title } from "../../components/Shell";
import { Card } from "../../ui/layout";
import { DataTable, Grid, KeyValues, LineChart, SearchInput, Select, Stat, TableScroll, type Column } from "../../ui";
import {
  counts, eventWords, filterSeries, FREQ_WORD, HEALTH_WORD, lagWords, loadSeries, loadSeriesDetail, loadSources, RIGHTS_HELP, RIGHTS_WORD, STATUS_WORD,
  uptimeShare, type DataSeries, type DataSource, type Health, type Rights, type SeriesDetail, type SeriesStatus,
} from "../../lib/registry";
import { date, HealthDot, num, Pending, pct, RegistryNav, RightsBadge, StatusBadge, useLoad, type Load } from "./common";

const ANY = "";

export function DataCatalog() {
  const series = useLoad(loadSeries);
  const sources = useLoad(loadSources);
  return (
    <>
      <div className="page-head">
        <Title>Data catalog</Title>
        <p>
          Every data source and series we use or could use: what its terms allow, where it is used and how healthy it is.
          Discovery adds candidates once a day. A candidate is enrolled only when its licence is recorded and its checks
          pass. Display rights decide who may see the values.
        </p>
        <RegistryNav here="#/registry" />
      </div>
      <Pending v={series} rows={14}>{(rows) => <Catalog rows={rows} />}</Pending>
      <Card title="Sources">
        <Pending v={sources} rows={10}>{(rows) => <Sources rows={rows} />}</Pending>
      </Card>
    </>
  );
}

/** A filter passed in the address, such as #/registry?tag=crypto or ?status=candidate. */
const fromHash = (name: string) => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(name) ?? ANY;

function Catalog({ rows }: { rows: DataSeries[] }) {
  const [q, setQ] = useState(() => fromHash("q"));
  const [status, setStatus] = useState(() => fromHash("status"));
  const [rights, setRights] = useState(() => fromHash("rights"));
  const [health, setHealth] = useState(() => fromHash("health"));
  const [asset, setAsset] = useState(() => fromHash("asset"));
  const [tag, setTag] = useState(() => fromHash("tag"));
  const shown = useMemo(() => filterSeries(rows, { q, status, rights, health, asset, tag }), [rows, q, status, rights, health, asset, tag]);
  const by = counts<SeriesStatus>(rows as never, "status");
  const assets = [...new Set(rows.map((r) => r.asset_class))].sort();
  const tagCount = new Map<string, number>();
  rows.forEach((r) => r.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t]) => t).sort();
  const sources = new Set(rows.map((r) => r.source_id)).size;

  const cols: Column<DataSeries>[] = [
    { key: "id", header: "Series", align: "left", sort: (r) => r.id,
      render: (r) => <div className="wrap"><a href={`#/registry/s/${encodeURIComponent(r.id)}`}><strong>{r.id}</strong></a><div className="muted small">{r.name}</div>
        <div className="muted small">{r.source_id}, {r.asset_class}, {(FREQ_WORD[r.frequency] ?? r.frequency).toLowerCase()}</div></div> },
    { key: "status", header: "Status", align: "left", sort: (r) => r.status, render: (r) => <StatusBadge s={r.status} /> },
    { key: "health", header: "Health", align: "left", sort: (r) => r.health, render: (r) => <HealthDot h={r.health} /> },
    { key: "rights", header: "Rights", align: "left", sort: (r) => r.display_rights, render: (r) => <RightsBadge r={r.display_rights} /> },
    { key: "quality", header: "Quality", sort: (r) => r.quality ?? -1, render: (r) => num(r.quality) },
    { key: "last", header: "Newest value", sort: (r) => r.last_obs ?? "", render: (r) => date(r.last_obs) },
  ];

  return (
    <>
      <Grid cols={4}>
        <Stat label="Series" value={rows.length.toLocaleString("en-US")} sub={`from ${sources} sources`} />
        <Stat label="Live" value={(by.live ?? 0).toLocaleString("en-US")} sub={`${by.enrolled ?? 0} enrolled, not yet checked`} />
        <Stat label="Degraded" value={(by.degraded ?? 0).toLocaleString("en-US")} sub="late, stale or failing" />
        <Stat label="Candidates" value={(by.candidate ?? 0).toLocaleString("en-US")} sub={<a href="#/registry/candidates">why each waits</a>} />
      </Grid>
      <Card title={`${shown.length.toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")} series`}>
        <div className="filters">
          <SearchInput value={q} onChange={setQ} placeholder="Search series, codes and tags" />
          <Select label="Status" value={status} onChange={setStatus} options={[[ANY, "Any status"], ...(Object.keys(STATUS_WORD) as SeriesStatus[]).map((s) => [s, STATUS_WORD[s]] as [string, string])]} />
          <Select label="Display rights" value={rights} onChange={setRights} options={[[ANY, "Any rights"], ...(Object.keys(RIGHTS_WORD) as Rights[]).map((r) => [r, RIGHTS_WORD[r]] as [string, string])]} />
          <Select label="Health" value={health} onChange={setHealth} options={[[ANY, "Any health"], ...(Object.keys(HEALTH_WORD) as Health[]).map((h) => [h, HEALTH_WORD[h]] as [string, string])]} />
          <Select label="Asset class" value={asset} onChange={setAsset} options={[[ANY, "Any asset class"], ...assets.map((a) => [a, a] as [string, string])]} />
          <Select label="Tag" value={tag} onChange={setTag} options={[[ANY, "Any tag"], ...tags.map((t) => [t, t] as [string, string])]} />
        </div>
        <DataTable rows={shown} columns={cols} rowKey={(r) => r.id} initialSort={{ key: "id", dir: "asc" }} href={(r) => `#/registry/s/${encodeURIComponent(r.id)}`}
          dense maxHeight={720} empty="No series match these filters." caption="Data series" />
      </Card>
    </>
  );
}

function Sources({ rows }: { rows: DataSource[] }) {
  return (
    <TableScroll label="Data sources">
      <table className="catalog">
        <thead><tr><th>Source</th><th>Rights</th><th>Licence</th><th>Terms read</th><th>Cost</th><th>Rate limit</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="wrap"><strong>{s.id}</strong><div className="muted small">{s.name}</div></td>
              <td><RightsBadge r={s.display_rights} /></td>
              <td className="wrap small">{s.licence}</td>
              <td>{s.terms_url ? <a href={s.terms_url} target="_blank" rel="noreferrer">{date(s.terms_read_on)}</a> : date(s.terms_read_on)}</td>
              <td className="wrap small">{s.cost}</td>
              <td className="wrap small">{s.rate_limit || "n/a"}</td>
              <td>{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

// ------------------------------------------------------------------ one series

export function SeriesPage({ id }: { id: string }) {
  const all = useLoad(loadSeries);
  const sources = useLoad(loadSources);
  const detail = useLoad(() => loadSeriesDetail(id), [id]);
  return (
    <>
      <div className="page-head">
        <Title label={id}>{id}</Title>
        <RegistryNav here="" />
      </div>
      <Pending v={all} rows={10}>{(rows) => {
        const s = rows.find((r) => r.id === id);
        if (!s) return <p className="muted">No series called {id} in the registry. <a href="#/registry">Back to the catalog</a></p>;
        const src = sources.state === "ok" ? sources.data.find((x) => x.id === s.source_id) : undefined;
        return <SeriesBody s={s} src={src} detail={detail} />;
      }}</Pending>
    </>
  );
}

function SeriesBody({ s, src, detail }: { s: DataSeries; src?: DataSource; detail: Load<SeriesDetail> }) {
  const hd = s.health_detail ?? {};
  const age = typeof hd.age_hours === "number" ? `${(hd.age_hours / 24).toFixed(1)} days old` : null;
  const cad = typeof hd.cadence_hours === "number" ? `expected within ${(hd.cadence_hours / 24).toFixed(1)} days` : null;
  const labels = Object.entries(s.labels ?? {}).filter(([k]) => !["frequency"].includes(k));
  return (
    <>
      <p>{s.name}</p>
      <KeyValues cols={4} items={[
        ["Source", s.source_id], ["Code", <code key="c">{s.code || "n/a"}</code>], ["Asset class", s.asset_class], ["Region", s.region || "n/a"],
        ["Frequency", FREQ_WORD[s.frequency] ?? s.frequency], ["Units", s.units || "n/a"], ["History", `${date(s.start_date)} to ${date(s.end_date)}`], ["Look-ahead", lagWords(s)],
        ["Status", <StatusBadge key="s" s={s.status} />], ["Health", <HealthDot key="h" h={s.health} />], ["Quality", num(s.quality)], ["Display rights", <RightsBadge key="r" r={s.display_rights} />],
      ]} />
      {s.reason && <p className="small"><strong>{s.status === "candidate" ? "Why it waits" : "Note"}:</strong> {s.reason}</p>}
      <p className="small muted">
        {[age, cad, typeof hd.error_kind === "string" ? `last problem: ${hd.error_kind}` : null, s.backup_id ? `backup: ${s.backup_id}` : null,
          s.origin === "discovered" ? `found by the ${s.discovered_by} discoverer on ${date(s.discovered_at)}` : s.origin === "live" ? "a live feed" : "from the catalog",
          s.required ? "required by official runs" : null].filter(Boolean).map((x) => String(x).charAt(0).toUpperCase() + String(x).slice(1)).join(". ")}
      </p>
      <div className="filters">{s.tags.map((t) => <a key={t} href={`#/registry?tag=${encodeURIComponent(t)}`} className="ui-badge ui-badge-neutral">{t}</a>)}</div>
      <Pending v={detail} rows={12}>{(d) => (
        <>
          <Card title="Chart">
            {d.preview && d.preview.length > 1 ? (
              <LineChart series={[{ name: s.id, color: "var(--series-1)", points: d.preview, emphasis: true }]} height={260} format={(v) => v.toPrecision(5)} label={`${s.id}, weekly or monthly closes`} />
            ) : (
              <p className="muted small">{s.display_rights === "research" ? "Research-only data: the values are used in tests but never shown." :
                s.display_rights === "internal" ? "Team-only data: the chart shows for team members." :
                s.display_rights === "none" ? "Not used, so nothing is shown." : "No chart yet. It appears once the series is enrolled with history."}</p>
            )}
          </Card>
          <Card title="Where it is used">
            {d.lineage.length ? (
              <ul className="small">{(["strategy", "search", "page", "feed", "derived"] as const).map((k) => {
                const items = d.lineage.filter((l) => l.kind === k).map((l) => l.consumer);
                if (!items.length) return null;
                const word = { strategy: "Strategies", search: "Strategy search", page: "Pages", feed: "Live feed in", derived: "Builds" }[k];
                return <li key={k}><strong>{word}:</strong> {items.slice(0, 30).join(", ")}{items.length > 30 ? ` and ${items.length - 30} more` : ""}</li>;
              })}</ul>
            ) : <p className="muted small">Nothing uses it yet. The strategy search draws it once it is enrolled with three years of history.</p>}
          </Card>
          <Card title="Health history">
            <p className="small">Checks that found it fresh: {pct(uptimeShare(d.uptime.filter((u) => u.day >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))))} over 7 days, {pct(uptimeShare(d.uptime))} over 90 days.</p>
            {d.uptime.length > 0 && (
              <TableScroll label="Daily checks">
                <table className="catalog"><thead><tr><th>Day</th><th>Checks</th><th>Fresh</th><th>Late</th><th>Stale</th><th>Dead</th></tr></thead>
                  <tbody>{d.uptime.slice(-14).reverse().map((u) => <tr key={u.day}><td>{u.day}</td><td>{u.checks}</td><td>{u.ok}</td><td>{u.late}</td><td>{u.stale}</td><td>{u.down}</td></tr>)}</tbody></table>
              </TableScroll>
            )}
          </Card>
          <Card title="Tests on arrival">
            {d.backtest?.battery?.tests?.length ? (
              <>
                <TableScroll label="Tests on arrival">
                  <table className="catalog"><thead><tr><th>Test</th><th>Sharpe</th><th>Yearly return</th><th>Worst fall</th><th>Years</th><th>Beats US stocks</th></tr></thead>
                    <tbody>{d.backtest.battery.tests.map((t) => (
                      <tr key={t.test}><td className="wrap">{t.test}{t.error && <div className="muted small">{t.error}</div>}</td><td>{num(t.sharpe)}</td><td>{pct(t.cagr)}</td><td>{pct(t.max_dd)}</td><td>{num(t.years, 1)}</td><td>{t.beats_market == null ? "n/a" : t.beats_market ? "yes" : "no"}</td></tr>
                    ))}</tbody></table>
                </TableScroll>
                {d.backtest.battery.correlations && <p className="small">Weekly correlation with: {Object.entries(d.backtest.battery.correlations).map(([k, v]) => `${k} ${num(v)}`).join(", ")}.</p>}
                <p className="small muted">Run {date(d.backtest.ran_at)}. {d.backtest.battery.note} {d.backtest.battery.new_trials ?? 0} new trials; the search had {(d.backtest.battery.search_trials ?? 0).toLocaleString("en-US")} in all.</p>
              </>
            ) : <p className="muted small">{s.origin === "catalog" ? "Curated series are tested by the strategy search and the nightly run, not by the arrival tests." : d.backtest?.battery?.error ? `The tests failed: ${d.backtest.battery.error}.` : "Not tested yet. Tests run within an hour of enrolment; signed-in people see the results."}</p>}
          </Card>
          <Card title="Licence">
            {src ? (
              <KeyValues cols={2} items={[["Provider", src.name], ["Licence", src.licence], ["Display rights", `${RIGHTS_WORD[s.display_rights]}: ${RIGHTS_HELP[s.display_rights]}`],
                ["Terms", src.terms_url ? <a key="t" href={src.terms_url} target="_blank" rel="noreferrer">read {date(src.terms_read_on)}</a> : "n/a"], ["Cost", src.cost || "n/a"], ["Rate limit", src.rate_limit || "n/a"]]} />
            ) : <p className="muted small">Source {s.source_id}.</p>}
            {labels.length > 0 && <p className="small muted">Labels: {labels.map(([k, v]) => `${k.replace(/_/g, " ")} ${String(v)}`).join(", ")}.</p>}
          </Card>
          <Card title="Log">
            {d.events.length ? (
              <ul className="small">{d.events.map((e) => <li key={e.id}><span className="muted">{e.at.slice(0, 16).replace("T", " ")}</span> {eventWords(e)}</li>)}</ul>
            ) : <p className="muted small">No events yet.</p>}
          </Card>
        </>
      )}</Pending>
    </>
  );
}
