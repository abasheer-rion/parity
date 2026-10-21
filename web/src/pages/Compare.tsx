import { Title } from "../components/Shell";
import { Card } from "../ui/layout";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import type { Report } from "../lib/types";
import { Term } from "./Learn";

const heat = (v: number) => {
  const a = Math.min(Math.abs(v), 1);
  return v >= 0 ? `color-mix(in srgb, var(--series-1) ${Math.round(a * 70)}%, var(--surface-solid))`
    : `color-mix(in srgb, var(--series-8) ${Math.round(a * 70)}%, var(--surface-solid))`;
};

export function Compare({ report }: { report: Report }) {
  const colors = colorMap(report.runs);
  const ranked = [...report.runs].sort((a, b) => (b.gauntlet?.passed ?? 99) - (a.gauntlet?.passed ?? 99) || (b.metrics.sharpe ?? 0) - (a.metrics.sharpe ?? 0));
  const cmp = report.comparison;
  return (
    <>
      <div className="page-head">
        <Title>Compare</Title>
        <p>Every strategy we have built, side by side on the same data since 1999: how they score, how they move together,
          and what each did in the five worst stock market episodes. All of this is exploratory unless the ledger says
          otherwise.</p>
      </div>
      <Card title="League table" help={<>Sorted by gauntlet tests passed. A high <Term id="sharpe-ratio">Sharpe</Term> with a low <Term id="deflated-sharpe-ratio">deflated Sharpe</Term> means it may be luck.</>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Strategy</th><th>Gauntlet</th><th>Sharpe</th><th>Deflated Sharpe</th><th>CAGR</th><th>Volatility</th><th>Max drawdown</th><th>Corr. with stocks</th><th>Verdict</th></tr></thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.strategy}>
                  <td><span className="swatch" style={{ background: colors[r.strategy] }} /><a href={`#/strategy/${r.strategy}`}>{r.strategy}</a></td>
                  <td>{r.gauntlet ? `${r.gauntlet.passed}/${r.gauntlet.total}` : "benchmark"}</td>
                  <td>{num(r.metrics.sharpe)}</td><td>{num(r.metrics.deflated_sharpe)}</td><td>{pct(r.metrics.cagr)}</td>
                  <td>{pct(r.metrics.ann_vol)}</td><td>{pct(r.metrics.max_drawdown)}</td>
                  <td>{r.is_benchmark ? "1.00" : num(r.metrics.correlation)}</td>
                  <td className="wrap small">{r.gauntlet?.verdict ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {cmp && (
        <Card title="What each did in a crisis" help="Total return over each episode, start to end. Green numbers in a crash are what a stock investor would want to add.">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Strategy</th>{cmp.crises.map((c) => <th key={c.name} title={`${c.start} to ${c.end}`}>{c.name}</th>)}</tr></thead>
              <tbody>
                {cmp.names.map((n) => (
                  <tr key={n}><td>{n}</td>{cmp.crises.map((c) => {
                    const v = c.returns[n];
                    return <td key={c.name} style={{ color: v >= 0 ? "var(--good)" : "var(--bad)" }}>{pct(v)}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {cmp && (
        <Card title="How they move together" help={<>Monthly <Term id="correlation">correlation</Term>. Blue means they rise and fall together; red means opposite. Strategies that are not blue against stocks are the ones that could <Term id="diversification">diversify</Term>.</>}>
          <div className="table-wrap">
            <table className="heat">
              <thead><tr><th></th>{cmp.names.map((n) => <th key={n} className="rot"><span>{n}</span></th>)}</tr></thead>
              <tbody>
                {cmp.names.map((row, i) => (
                  <tr key={row}><td>{row}</td>{cmp.correlation[i].map((v, j) => <td key={j} style={{ background: heat(v) }} title={`${row} vs ${cmp.names[j]}: ${v}`}>{v.toFixed(2)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
