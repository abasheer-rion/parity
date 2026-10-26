// The candidates queue (DEC-0064): what discovery found and why each one waits. A candidate
// moves to enrolled by itself once every check of the gate passes.
import { useMemo, useState } from "react";
import { Title } from "../../components/Shell";
import { Card } from "../../ui/layout";
import { DataTable, Grid, SearchInput, Select, Stat, type Column } from "../../ui";
import { filterSeries, loadSeries, type DataSeries } from "../../lib/registry";
import { date, Pending, RegistryNav, RightsBadge, useLoad } from "./common";

/** The gate step a reason belongs to, from its first word. */
export function reasonKind(reason: string): string {
  const head = reason.split(":")[0].trim();
  if (["licence", "schema", "history", "sanity", "feed"].includes(head)) return head;
  if (reason.startsWith("quality")) return "quality";
  if (reason.startsWith("waiting")) return "not checked yet";
  return reason ? "other" : "not checked yet";
}

const KIND_WORD: Record<string, string> = {
  licence: "Licence not recorded or too narrow", schema: "No fetcher or not a series", history: "Not enough history",
  sanity: "Failed a sanity check", quality: "Quality below 0.6", feed: "Feed check", "not checked yet": "Not checked yet", other: "Other",
};

export function Candidates() {
  const series = useLoad(loadSeries);
  return (
    <>
      <div className="page-head">
        <Title>Candidates</Title>
        <p>
          What discovery found and why each one waits. A candidate is enrolled by itself once its licence is recorded and
          allows the use, a fetcher exists, enough history arrived, a look-ahead lag is set and its checks pass with a
          quality score of at least 0.6. Each is checked at most once a day.
        </p>
        <RegistryNav here="#/registry/candidates" />
      </div>
      <Pending v={series} rows={14}>{(rows) => <Queue rows={rows} />}</Pending>
    </>
  );
}

function Queue({ rows }: { rows: DataSeries[] }) {
  const [q, setQ] = useState("");
  const [by, setBy] = useState("");
  const [kind, setKind] = useState("");
  const cands = rows.filter((r) => r.status === "candidate");
  const finders = [...new Set(cands.map((r) => r.discovered_by))].sort();
  const kinds = [...new Set(cands.map((r) => reasonKind(r.reason)))].sort();
  const shown = useMemo(() => filterSeries(cands, { q }).filter((r) => (!by || r.discovered_by === by) && (!kind || reasonKind(r.reason) === kind)), [cands, q, by, kind]);
  const recent = rows.filter((r) => r.origin === "discovered" && r.status !== "candidate" && r.enrolled_at)
    .sort((a, b) => (b.enrolled_at ?? "").localeCompare(a.enrolled_at ?? "")).slice(0, 20);

  const cols: Column<DataSeries>[] = [
    { key: "id", header: "Candidate", align: "left", sort: (r) => r.id,
      render: (r) => <div className="wrap"><a href={`#/registry/s/${encodeURIComponent(r.id)}`}><strong>{r.id}</strong></a><div className="muted small">{r.name}</div>
        <div className="muted small">found by {r.discovered_by} on {date(r.discovered_at)}</div></div> },
    { key: "rights", header: "Rights", align: "left", sort: (r) => r.display_rights, render: (r) => <RightsBadge r={r.display_rights} /> },
    { key: "why", header: "Why it waits", align: "left", sort: (r) => r.reason, render: (r) => <span className="wrap small">{r.reason || "not checked yet"}</span> },
  ];
  const kindCount = (k: string) => cands.filter((r) => reasonKind(r.reason) === k).length;

  return (
    <>
      <Grid cols={4}>
        <Stat label="Waiting" value={cands.length.toLocaleString("en-US")} sub={`found by ${finders.length} discoverers`} />
        <Stat label="Enrolled by the gate" value={rows.filter((r) => r.origin === "discovered" && ["enrolled", "live", "degraded"].includes(r.status)).length.toLocaleString("en-US")} sub="discovered and accepted" />
        <Stat label="Not enough history" value={kindCount("history").toLocaleString("en-US")} sub="they pass once more arrives" />
        <Stat label="Licence" value={kindCount("licence").toLocaleString("en-US")} sub="never used without a recorded licence" />
      </Grid>
      <Card title={`${shown.length.toLocaleString("en-US")} candidates`}>
        <div className="filters">
          <SearchInput value={q} onChange={setQ} placeholder="Search candidates" />
          <Select label="Found by" value={by} onChange={setBy} options={[["", "Any discoverer"], ...finders.map((f) => [f, f] as [string, string])]} />
          <Select label="Why it waits" value={kind} onChange={setKind} options={[["", "Any reason"], ...kinds.map((k) => [k, KIND_WORD[k] ?? k] as [string, string])]} />
        </div>
        <DataTable rows={shown} columns={cols} rowKey={(r) => r.id} initialSort={{ key: "id", dir: "asc" }} href={(r) => `#/registry/s/${encodeURIComponent(r.id)}`}
          dense maxHeight={720} empty="Nothing waits. Discovery runs once a day." caption="Candidates" />
      </Card>
      <Card title="Enrolled most recently">
        {recent.length ? (
          <ul className="small">{recent.map((r) => (
            <li key={r.id}><a href={`#/registry/s/${encodeURIComponent(r.id)}`}>{r.id}</a> <span className="muted">{date(r.enrolled_at)}, quality {r.quality?.toFixed(2) ?? "n/a"}, found by {r.discovered_by}</span></li>
          ))}</ul>
        ) : <p className="muted small">Nothing discovered has been enrolled yet.</p>}
      </Card>
    </>
  );
}
