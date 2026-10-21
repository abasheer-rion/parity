import { useState } from "react";
import { Card } from "../components/ui";
import { algorithms, docPathFor, ledger, registrations, STAGES } from "../lib/catalog";
import { docUrl, pct, REPO_URL } from "../lib/format";
import { Term } from "./Learn";

type View = "simple" | "analogy" | "precise";

const repoLink = (url: string) => (/^[a-z]+:/.test(url) ? url : `${REPO_URL}/blob/main/${url}`);

export function AlgorithmReport({ slug }: { slug: string }) {
  const a = algorithms.find((x) => x.slug === slug);
  const [view, setView] = useState<View>("simple");
  if (!a) return <p>No algorithm called {slug}.</p>;
  const runs = ledger.filter((e) => a.research.runs.includes(e.run_id));
  const regs = registrations.filter((r) => a.research.registrations.includes(r.id));
  const yr = a.origin.first_published;
  const age = yr ? new Date().getFullYear() - yr : null;

  return (
    <article className="report">
      <div className="report-head">
        <div>
          <div className="muted small">{a.id} · algorithm report · reviewed {a.last_reviewed}</div>
          <h1>{a.name}</h1>
          <p className="lead">{a.how_it_works.simple}</p>
        </div>
        <div className="noprint">
          <button className="quiet" onClick={() => window.print()}>Print or save as PDF</button>{" "}
          <a className="small" href={docUrl(docPathFor(a.id) ?? "README.md")} target="_blank" rel="noreferrer">Markdown version</a>
        </div>
      </div>

      <div className="facts">
        <Fact k="Family" v={a.family} />
        <Fact k="Markets" v={a.markets.join(", ")} />
        <Fact k="Horizon" v={a.horizon} />
        <Fact k="First published" v={yr ? `${yr} (${age} years ago)` : "n/a"} />
        <Fact k="Origin" v={`${a.origin.type}: ${a.origin.authors}`} />
        <Fact k="Relevance to us" v={`${a.relevance.score} of 5`} />
        <Fact k="Free data" v={a.testable_with_free_data ? "yes" : "no"} />
        <Fact k="Stage" v={`${a.research.stage} of 9: ${STAGES[a.research.stage - 1]}`} />
      </div>

      <Card title="How it works">
        <div className="tabs" role="tablist">
          {(["simple", "analogy", "precise"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
        <p className="big">{a.how_it_works[view]}</p>
        <h3>The rule</h3>
        <p>{a.rule}</p>
        <h3>Data it needs</h3>
        <ul>{a.data_needed.map((d) => <li key={d}>{d}</li>)}</ul>
        <div className="two">
          <div><h3>Why it might work</h3><p>{a.economic_rationale}</p></div>
          <div><h3>Why it might fail</h3><p>{a.why_it_might_fail}</p></div>
        </div>
        <p className="muted small">Source: {a.origin.source_url ? <a href={repoLink(a.origin.source_url)} target="_blank" rel="noreferrer">{a.origin.source_title}</a> : a.origin.source_title || "no single documented origin"}. Relevance: {a.relevance.reason}</p>
      </Card>

      <Card title="What others reported" help={<>These are the sources' own numbers. "Checked" means we read the number on the source page. Compare <Term id="backtest">backtest</Term> and live evidence separately, and treat very high <Term id="sharpe-ratio">Sharpe ratios</Term> with suspicion.</>}>
        {a.reported_results.length ? (
          <div className="table-wrap">
            <table className="gauntlet">
              <thead><tr><th>Source</th><th>Period</th><th>Market</th><th>Sharpe</th><th>Return a year</th><th>Volatility</th><th>Max drawdown</th><th>Evidence</th><th>Costs</th><th>Checked</th></tr></thead>
              <tbody>
                {a.reported_results.map((r, i) => (
                  <tr key={i}>
                    <td className="wrap"><a href={r.source_url} target="_blank" rel="noreferrer">{r.source}</a>{r.notes && <div className="muted small">{r.notes}</div>}</td>
                    <td>{r.period}</td>
                    <td className="wrap">{r.market}</td>
                    <td>{r.sharpe ?? "n/a"}</td>
                    <td>{pct(r.annual_return)}</td>
                    <td>{pct(r.volatility)}</td>
                    <td>{pct(r.max_drawdown)}</td>
                    <td><span className={`badge ev-${r.evidence_type}`}>{r.evidence_type}</span></td>
                    <td>{r.costs_included == null ? "unclear" : r.costs_included ? "yes" : "no"}</td>
                    <td>{r.verified_on_page ? "yes" : <span className="badge warn">no</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No source reports trading results.</p>}
        <h3>After it became known</h3>
        <p>{a.post_publication_evidence || "We found no evidence on how it did after publication."}</p>
      </Card>

      <Card title="Our research">
        <ol className="stages">
          {STAGES.map((s, i) => <li key={s} className={i < a.research.stage ? "done" : ""}>{s}</li>)}
        </ol>
        {a.research.notes && <p>{a.research.notes}</p>}
        <ul>
          {a.research.hypothesis && <li>Hypothesis: <a href={docUrl(docPathFor(a.research.hypothesis) ?? "README.md")} target="_blank" rel="noreferrer">{a.research.hypothesis}</a></li>}
          {a.research.strategy && <li>Strategy in our engine: <code>{a.research.strategy}</code> (<a href={`#/strategy/${a.research.strategy}`}>latest nightly result</a>)</li>}
          {regs.map((r) => <li key={r.id}>Registered plan <a href="#/ledger"><strong>{r.id}</strong></a>: {r.title} ({r.created})</li>)}
          {a.research.verdict && <li>Verdict: <strong>{a.research.verdict}</strong></li>}
        </ul>
        {runs.map((e) => {
          const res = a.research.strategy ? e.results[a.research.strategy] : undefined;
          return (
            <div key={e.run_id} className="runbox">
              <div><strong>{e.run_id}</strong> <span className="muted small">official run of {e.registration}, {e.recorded_at.slice(0, 10)}, commit {e.git_sha.slice(0, 8)}, hash {e.hash.slice(0, 12)}</span></div>
              {res ? <p>Sharpe {res.sharpe?.toFixed(2)}, CAGR {pct(res.cagr)}, max drawdown {pct(res.max_drawdown)}, gauntlet {res.gauntlet}. {res.verdict} Meets its registered plan: <strong>{res.meets_registered_criteria ? "yes" : "no"}</strong>.</p>
                : <p className="muted">This run did not include this strategy.</p>}
            </div>
          );
        })}
        {!runs.length && <p className="muted">Not tested by us yet.</p>}
      </Card>

      <Card title="Code you can read">
        {a.implementations.length ? <ul>{a.implementations.map((x) => <li key={x.url}><a href={repoLink(x.url)} target="_blank" rel="noreferrer">{x.url}</a> <span className="muted small">{x.language} · license {x.license || "none stated"}{x.notes ? ` · ${x.notes}` : ""}</span></li>)}</ul>
          : <p className="muted">No public implementation found.</p>}
      </Card>
    </article>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return <div className="fact"><div className="muted small">{k}</div><div>{v}</div></div>;
}
