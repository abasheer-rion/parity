import { Title } from "../components/Shell";
import { useState } from "react";
import { Card } from "../ui/layout";
import { datasets } from "../lib/catalog";

export function DataSources({ focus }: { focus?: string }) {
  const [cat, setCat] = useState("");
  const cats = [...new Set(datasets.map((d) => d.category))].sort();
  const shown = datasets.filter((d) => !cat || d.category === cat)
    .sort((a, b) => Number(b.in_use_by_parity) - Number(a.in_use_by_parity) || b.relevance.score - a.relevance.score);
  const sel = datasets.find((d) => d.slug === focus);

  return (
    <>
      <div className="page-head">
        <Title>Data sources</Title>
        <p>Every source of market data we have looked at, with what it has, its cost, its limits and terms, and how
          reliable it is. "Point in time" means it keeps numbers as they were first published. Backtests of economic data
          need that to avoid using later revisions.</p>
      </div>
      {sel && (
        <Card title={sel.name} help={sel.simple}>
          <div className="facts">
            <div className="fact"><div className="muted small">Provider</div>{sel.provider}</div>
            <div className="fact"><div className="muted small">Access</div>{sel.access}</div>
            <div className="fact"><div className="muted small">History from</div>{sel.history_start}</div>
            <div className="fact"><div className="muted small">Frequency</div>{sel.frequency.join(", ")}</div>
            <div className="fact"><div className="muted small">Point in time</div>{sel.point_in_time == null ? "unknown" : sel.point_in_time ? "yes" : "no"}</div>
            <div className="fact"><div className="muted small">Used by us</div>{sel.in_use_by_parity ? sel.parity_keys.join(", ") : "no"}</div>
          </div>
          <p>{sel.what_it_has}</p>
          <p><strong>Limits:</strong> {sel.rate_limits}</p>
          <p><strong>Terms:</strong> {sel.license_terms}</p>
          <p><strong>Quality:</strong> {sel.quality_notes}</p>
          <p className="small"><a href={sel.url} target="_blank" rel="noreferrer">Website</a>{sel.api_docs_url && <> · <a href={sel.api_docs_url} target="_blank" rel="noreferrer">API docs</a></>}
            {!sel.verified && <span className="badge warn">some details unverified</span>}</p>
        </Card>
      )}
      <Card title={`${shown.length} sources`}>
        <div className="filters">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead><tr><th>Source</th><th>Category</th><th>Access</th><th>History</th><th>Point in time</th><th>In use</th><th>Relevance</th></tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id}>
                  <td className="wrap"><a href={`#/sources/${d.slug}`}><strong>{d.name}</strong></a><div className="muted small">{d.simple}</div></td>
                  <td>{d.category}</td>
                  <td>{d.access}</td>
                  <td className="wrap">{d.history_start}</td>
                  <td>{d.point_in_time == null ? "?" : d.point_in_time ? "yes" : "no"}</td>
                  <td>{d.in_use_by_parity ? "yes" : ""}</td>
                  <td>{d.relevance.score} / 5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
