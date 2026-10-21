import { BarChart, LineChart } from "../components/charts";
import { GauntletCard } from "../components/GauntletCard";
import { Card, StatTile } from "../components/ui";
import { colorMap } from "../lib/colors";
import { docUrl, num, pct } from "../lib/format";
import type { Report } from "../lib/types";

export function StrategyPage({ report, name }: { report: Report; name: string }) {
  const run = report.runs.find((r) => r.strategy === name);
  const bench = report.runs.find((r) => r.is_benchmark);
  if (!run) return <p>No strategy named {name} in this run.</p>;
  const colors = colorMap(report.runs);
  const m = run.metrics;
  const color = colors[run.strategy];
  const years = Object.keys(run.yearly).sort();

  return (
    <>
      <div className="page-head">
        <h1>{run.strategy}</h1>
        <p>{run.summary}</p>
        {run.reference && (
          <p className="muted">
            Tests <a href={docUrl(run.reference)} target="_blank" rel="noreferrer">{run.reference}</a>
          </p>
        )}
      </div>

      <div className="tiles">
        <StatTile label="Sharpe ratio" learn="sharpe-ratio" value={num(m.sharpe)} note={bench && !run.is_benchmark ? `S&P 500: ${num(bench.metrics.sharpe)}` : undefined}
          tone={bench && !run.is_benchmark ? ((m.sharpe ?? 0) > (bench.metrics.sharpe ?? 0) ? "good" : "bad") : undefined} />
        <StatTile label="CAGR" learn="cagr" value={pct(m.cagr)} note={`at ${pct(m.ann_vol)} volatility`} />
        <StatTile label="Max drawdown" learn="drawdown" value={pct(m.max_drawdown)} />
        <StatTile label="Deflated Sharpe" learn="deflated-sharpe-ratio" value={num(m.deflated_sharpe)} note="0.95 or more needed" />
        {!run.is_benchmark && <StatTile label="Break-even cost" learn="break-even-cost" value={m.breakeven_cost_bps == null ? "n/a" : `${num(m.breakeven_cost_bps, 1)} bp`} note={`${num(m.turnover_per_year, 1)}x turnover a year`} />}
      </div>

      {run.gauntlet && <GauntletCard gauntlet={run.gauntlet} />}

      <Card title="Drawdown" help="How far below its previous peak the strategy was at each point.">
        <LineChart
          label={`Drawdown of ${run.strategy}`}
          format={(v) => pct(v, 0)}
          height={200}
          series={[
            { name: run.strategy, color, points: run.drawdown, emphasis: true },
            ...(bench && !run.is_benchmark ? [{ name: bench.strategy, color: colors[bench.strategy], points: bench.drawdown }] : []),
          ]}
        />
      </Card>

      <Card title="Return by calendar year" help="Shows whether the result depends on a few years.">
        <BarChart
          label={`Yearly returns of ${run.strategy}`}
          format={(v) => pct(v, 0)}
          groups={years.map((y) => ({
            label: years.length > 14 ? `'${y.slice(2)}` : y,
            values: [
              { name: run.strategy, color, value: run.yearly[y] },
              ...(bench && !run.is_benchmark ? [{ name: bench.strategy, color: colors[bench.strategy], value: bench.yearly[y] ?? null }] : []),
            ],
          }))}
        />
      </Card>

      {run.ic_decay.length > 0 && (
        <Card title="Signal information by horizon" help="The information coefficient (see Learn): mean rank correlation between the signal and the return that follows. Where it peaks tells you how fast to trade.">
          <BarChart
            label={`Information coefficient by horizon for ${run.strategy}`}
            format={(v) => v.toFixed(2)}
            groups={run.ic_decay.map((r) => ({
              label: `${r.horizon_days}d`,
              values: [{ name: run.strategy, color, value: r.mean_ic }],
            }))}
          />
        </Card>
      )}

      <Card title="Current positions" help="Weights held on the last day of the run, after volatility scaling.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Instrument</th><th>Weight</th></tr></thead>
            <tbody>
              {Object.entries(run.exposure).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{pct(v, 1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Settings">
        <pre className="code">{JSON.stringify({ params: run.params, backtest: run.config }, null, 2)}</pre>
      </Card>
    </>
  );
}
