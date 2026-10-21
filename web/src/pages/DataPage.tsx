import { Card } from "../components/ui";
import { date } from "../lib/format";
import type { Report } from "../lib/types";

// A daily series more than this many days behind the fetch date is flagged.
const STALE_DAILY = 7;
const STALE_MONTHLY = 75;

export function DataPage({ report }: { report: Report }) {
  const fetched = report.coverage.fetched_at;
  const ref = fetched ? new Date(fetched).getTime() : Date.now();
  const rows = report.coverage.series.map((s) => {
    const lag = s.last ? Math.floor((ref - new Date(s.last).getTime()) / 86_400_000) : null;
    const monthly = s.key.startsWith("rate.") || s.key.startsWith("reer.") || ["cmd.COPPER", "eq.US_MKT"].includes(s.key);
    const stale = !s.ok || lag == null || lag > (monthly ? STALE_MONTHLY : STALE_DAILY);
    return { ...s, lag, stale };
  });
  const problems = rows.filter((r) => r.stale);

  return (
    <>
      <div className="page-head">
        <h1>Data</h1>
        <p>
          Every series behind this run, fetched {date(fetched)}. A stale or broken series quietly ruins results, so
          check here before trusting a number. Run {report.git_sha ? <code>{report.git_sha}</code> : "from a local checkout"}.
        </p>
      </div>
      {report.source_checks && report.source_checks.length > 0 && (
        <Card title="Sources checked against each other" help="Pairs of series that should agree. A drop in correlation or a jump in the gap means one source has changed or broken.">
          <div className="table-wrap"><table>
            <thead><tr><th>Check</th><th>Series</th><th>Since</th><th>Daily correlation</th><th>Gap in yearly return</th></tr></thead>
            <tbody>{report.source_checks.map((c) => (
              <tr key={c.a + c.b}><td className="wrap">{c.label}</td><td><code>{c.a}</code> vs <code>{c.b}</code></td><td>{c.from}</td><td>{c.daily_correlation.toFixed(3)}</td><td>{(c.annual_return_gap * 100).toFixed(2)}%</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      <Card title={problems.length ? `${problems.length} series need attention` : "All series are current"}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Key</th><th>Source</th><th>Code</th><th>First</th><th>Last</th><th>Days behind</th><th>Rows</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><code>{r.key}</code></td>
                  <td>{r.source}</td>
                  <td>{r.code}</td>
                  <td>{r.first ?? ""}</td>
                  <td>{r.last ?? ""}</td>
                  <td>{r.lag ?? ""}</td>
                  <td>{r.rows ?? ""}</td>
                  <td>
                    <span className={`pass ${r.stale ? "no" : "yes"}`}>
                      <span aria-hidden>{r.stale ? "✕" : "✓"}</span> {r.ok ? (r.stale ? "Stale" : "Current") : "Failed"}
                    </span>
                    {r.error && <div className="muted small">{r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
