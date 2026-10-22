import { Title } from "../components/Shell";
import { useState } from "react";
import { LineChart } from "../ui/charts";
import { Card, StatTile } from "../ui/layout";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import type { Point, Report } from "../lib/types";
import { Term } from "./Learn";
import { nameOf } from "../lib/strategyMeta";

interface Variant { params: Record<string, unknown>; sharpe: number; cagr: number | null; max_drawdown: number | null; equity?: Point[] }

export function Lab({ report }: { report: Report }) {
  const runs = report.runs.filter((r) => !r.is_benchmark && r.gauntlet);
  const bench = report.runs.find((r) => r.is_benchmark);
  const colors = colorMap(report.runs);
  const [name, setName] = useState(runs[0]?.strategy ?? "");
  const run = runs.find((r) => r.strategy === name);
  const variants: Variant[] = ((run?.gauntlet as unknown as { sensitivity?: { variants?: Variant[] } })?.sensitivity?.variants) ?? [];
  const keys = variants.length ? Object.keys(variants[0].params) : [];
  const [choice, setChoice] = useState<Record<string, string>>({});
  const defaults = run ? run.params : {};
  const wanted = (k: string) => choice[k] ?? String(defaults[k]);
  const current = variants.find((v) => keys.every((k) => String(v.params[k]) === wanted(k))) ?? variants[0];

  if (!runs.length) return <p className="muted">No strategy in this run has lab variants.</p>;

  return (
    <>
      <div className="page-head">
        <Title>Lab</Title>
        <p>Change a strategy's settings and see what happens. Each combination here was already run by the gauntlet's
          sensitivity test, so nothing is computed in your browser and nothing here is an official result. To try new
          settings or a new algorithm, run <code>parity run</code> on your own machine, and to make it count, register it
          first (see the research routine guide).</p>
      </div>
      <Card title="Settings">
        <div className="filters">
          <label>Strategy <select value={name} onChange={(e) => { setName(e.target.value); setChoice({}); }}>
            {runs.map((r) => <option key={r.strategy} value={r.strategy}>{nameOf(r)}</option>)}</select></label>
          {keys.map((k) => {
            const values = [...new Set(variants.map((v) => String(v.params[k])))];
            return (
              <label key={k}>{k} <select value={choice[k] ?? String(current?.params[k])} onChange={(e) => setChoice({ ...choice, [k]: e.target.value })}>
                {values.map((v) => <option key={v} value={v}>{v}{String(defaults[k]) === v ? " (default)" : ""}</option>)}</select></label>
            );
          })}
        </div>
        <p className="warning small">You are looking at 1 of {variants.length} versions. All {variants.length} count as <Term id="data-snooping">trials</Term>, whichever one you like best. Picking the best-looking one here and calling it a result is exactly the mistake the gauntlet exists to catch.</p>
      </Card>
      {current && (
        <>
          <div className="tiles">
            <StatTile label="Sharpe ratio" learn="sharpe-ratio" value={num(current.sharpe)} note={`S&P 500: ${num(bench?.metrics.sharpe)}`}
              tone={(current.sharpe ?? 0) > (bench?.metrics.sharpe ?? 0) ? "good" : "bad"} />
            <StatTile label="CAGR" learn="cagr" value={pct(current.cagr)} />
            <StatTile label="Max drawdown" learn="drawdown" value={pct(current.max_drawdown)} />
            <StatTile label="Versions with positive Sharpe" value={`${variants.filter((v) => v.sharpe > 0).length} of ${variants.length}`} />
          </div>
          {current.equity && (
            <Card title="Growth of $1" help="Log scale, net of costs, at the strategy's own risk. Grey is the S&P 500.">
              <LineChart label="Lab variant growth" log format={(v) => `$${v.toFixed(2)}`}
                series={[
                  { name: `${name} (${keys.map((k) => `${k}=${current.params[k]}`).join(", ")})`, color: colors[name], points: current.equity, emphasis: true },
                  ...(bench ? [{ name: bench.strategy, color: colors[bench.strategy], points: bench.equity }] : []),
                ]} />
            </Card>
          )}
          <Card title="All versions side by side">
            <div className="table-wrap">
              <table>
                <thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}<th>Sharpe</th><th>CAGR</th><th>Max drawdown</th></tr></thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={i} className={v === current ? "selected" : ""}>
                      {keys.map((k) => <td key={k}>{String(v.params[k])}</td>)}
                      <td>{num(v.sharpe)}</td><td>{pct(v.cagr)}</td><td>{pct(v.max_drawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
