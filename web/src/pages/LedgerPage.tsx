import { Title } from "../components/Shell";
import { Card, Pass } from "../ui/layout";
import { ledger, registrations } from "../lib/catalog";
import { num, pct, REPO_URL } from "../lib/format";

export function LedgerPage() {
  const linked = ledger.map((e, i) => ({ e, chained: i === 0 ? e.prev === "0".repeat(64) : e.prev === ledger[i - 1].hash }));
  const runFor = (reg: string) => ledger.filter((e) => e.registration === reg).map((e) => e.run_id);

  return (
    <>
      <div className="page-head">
        <Title>Ledger</Title>
        <p>The official record. Every result we cite comes from one of these runs. Each entry stores a hash of the entry
          before it, so changing an old result breaks every hash after it. CI runs the full check on every push
          (<code>parity ledger verify</code>). This page shows the links between entries. Every run also has a GitHub
          release with its outputs and the exact data it used.</p>
      </div>

      <Card title={`${ledger.length} official runs`}>
        {linked.slice().reverse().map(({ e, chained }) => (
          <div key={e.run_id} className="runbox">
            <div className="runhead">
              <strong>{e.run_id}</strong>
              <span className="muted small">{e.recorded_at.replace("T", " ").slice(0, 16)} UTC · plan {e.registration} · commit <a href={`${REPO_URL}/commit/${e.git_sha}`} target="_blank" rel="noreferrer">{e.git_sha.slice(0, 8)}</a> · data {e.data_snapshot?.slice(0, 12)} · {e.trials_counted} trials</span>
              <Pass ok={chained} label="Previous hash matches the entry before" />
              <a className="small" href={`${REPO_URL}/releases/tag/${e.run_id}`} target="_blank" rel="noreferrer">release</a>
            </div>
            <div className="mono small muted">hash {e.hash} · prev {e.prev.slice(0, 16)}...</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Strategy</th><th>Sharpe</th><th>CAGR</th><th>Max drawdown</th><th>Deflated Sharpe</th><th>Tests</th><th>Meets plan</th></tr></thead>
                <tbody>
                  {Object.entries(e.results).map(([name, r]) => (
                    <tr key={name}>
                      <td><a href={`#/strategy/${name}`}>{name}</a></td>
                      <td>{num(r.sharpe)}</td><td>{pct(r.cagr)}</td><td>{pct(r.max_drawdown)}</td><td>{num(r.deflated_sharpe)}</td>
                      <td>{r.gauntlet}</td><td><Pass ok={r.meets_registered_criteria} label="Meets its registered pass criteria" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!ledger.length && <p className="muted">No official runs yet.</p>}
      </Card>

      <Card title={`${registrations.length} registered plans`} help="Frozen before running. A changed plan becomes a new registration; the old one stays.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Plan</th><th>Title</th><th>Registered</th><th>Hypotheses</th><th>Prior trials</th><th>Runs</th></tr></thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong></td>
                  <td className="wrap">{r.title}<div className="muted small">{r.question}</div></td>
                  <td>{r.created}</td>
                  <td className="wrap code-cell">{r.hypotheses.join(", ")}</td>
                  <td>{r.prior_trials}</td>
                  <td>{runFor(r.id).join(", ") || <span className="muted">not run</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
