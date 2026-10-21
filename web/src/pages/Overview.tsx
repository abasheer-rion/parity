import { LineChart } from "../components/charts";
import { Card, StatTile } from "../components/ui";
import { Term } from "./Learn";
import { colorMap } from "../lib/colors";
import { num, pct, signedPct } from "../lib/format";
import type { Report } from "../lib/types";

export function Overview({ report }: { report: Report }) {
  const colors = colorMap(report.runs);
  const bench = report.runs.find((r) => r.is_benchmark);
  const candidates = report.runs.filter((r) => !r.is_benchmark);
  const best = [...candidates].sort((a, b) => (b.metrics.sharpe ?? -9) - (a.metrics.sharpe ?? -9))[0];
  const beating = candidates.filter(
    (r) => (r.metrics.sharpe ?? -9) > (bench?.metrics.sharpe ?? 9) && (r.metrics.deflated_sharpe ?? 0) >= 0.95,
  );
  const targetVol = report.config.target_vol as number | null;

  return (
    <>
      <div className="tiles">
        <StatTile label="Strategies beating the S&P 500" value={`${beating.length} of ${candidates.length}`}
          note="Higher Sharpe and deflated Sharpe of at least 0.95" />
        <StatTile label="S&P 500 Sharpe" value={num(bench?.metrics.sharpe)}
          note={`${pct(bench?.metrics.cagr)} a year since ${bench?.metrics.start?.slice(0, 4) ?? "n/a"}`} />
        <StatTile label={`Best strategy: ${best?.strategy ?? "none"}`} value={num(best?.metrics.sharpe)}
          note={`S&P 500 Sharpe of ${num(bench?.metrics.sharpe)}`} tone={best && bench && (best.metrics.sharpe ?? 0) > (bench.metrics.sharpe ?? 0) ? "good" : "bad"} />
        <StatTile label="Trials counted" value={String(report.n_trials)} note="Used to deflate every Sharpe ratio" />
      </div>

      <Card
        title="Growth of $1"
        help={<>Log scale, net of costs{targetVol ? `, strategies scaled to ${pct(targetVol, 0)} volatility` : ", each at its own risk"}. The S&P 500 is the grey line. Compare at equal risk before drawing conclusions.</>}
      >
        <LineChart
          label="Growth of one dollar for each strategy and the S&P 500"
          log
          format={(v) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`}
          series={report.runs.map((r) => ({
            name: r.strategy,
            color: colors[r.strategy],
            points: r.equity,
            emphasis: r.is_benchmark,
          }))}
        />
      </Card>

      <Card title="Against the S&P 500" help="Underlined words open the Learn tab. The gauntlet column shows how many of the eleven tough tests each strategy passed; click a strategy to see them.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th><th><Term id="cagr">CAGR</Term></th><th><Term id="volatility">Volatility</Term></th>
                <th><Term id="sharpe-ratio">Sharpe</Term></th><th><Term id="drawdown">Max drawdown</Term></th>
                <th><Term id="deflated-sharpe-ratio">Deflated Sharpe</Term></th><th><Term id="correlation">Corr. with S&P</Term></th>
                <th><Term id="excess-return">Excess CAGR</Term></th><th>Gauntlet</th>
              </tr>
            </thead>
            <tbody>
              {report.runs.map((r) => {
                const m = r.metrics;
                return (
                  <tr key={r.strategy}>
                    <td>
                      <span className="swatch" style={{ background: colors[r.strategy] }} />
                      <a href={`#/strategy/${r.strategy}`}>{r.strategy}</a>
                      {r.is_benchmark && <span className="badge">benchmark</span>}
                    </td>
                    <td>{pct(m.cagr)}</td>
                    <td>{pct(m.ann_vol)}</td>
                    <td>{num(m.sharpe)}</td>
                    <td>{pct(m.max_drawdown)}</td>
                    <td>{num(m.deflated_sharpe)}</td>
                    <td>{r.is_benchmark ? "1.00" : num(m.correlation)}</td>
                    <td>{r.is_benchmark ? "" : signedPct(m.excess_cagr)}</td>
                    <td>{r.gauntlet ? <a href={`#/strategy/${r.strategy}`} title={r.gauntlet.verdict}>{r.gauntlet.passed} of {r.gauntlet.total}</a> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
