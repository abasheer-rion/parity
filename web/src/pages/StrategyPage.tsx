// One strategy, laid out like a Robinhood stock page: name, the value of a starting
// amount, a range-tabbed chart you can scrub, About, Key statistics, then detail.
// The right column holds the verdict where Robinhood puts its order panel.
import { useState } from "react";
import { BarChart, HeroChart, LineChart, type RangeKey } from "../ui/charts";
import { GauntletCard } from "../components/GauntletCard";
import { Button } from "../ui";
import { Title } from "../components/Shell";
import { Card } from "../ui/layout";
import { algorithms, STAGES } from "../lib/catalog";
import { colorMap } from "../lib/colors";
import { mentions, useDocs } from "../lib/docs";
import { num, pct, signedPct } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import type { Report } from "../lib/types";
import { Term } from "./Learn";

export function StrategyPage({ report, name }: { report: Report; name: string }) {
  const prefs = usePrefs();
  const [range, setRange] = useState<RangeKey>(prefs.defaultRange);
  const docs = useDocs();
  const run = report.runs.find((r) => r.strategy === name);
  const bench = report.runs.find((r) => r.is_benchmark);
  if (!run) return <p>No strategy named {name} in this run.</p>;
  const colors = colorMap(report.runs);
  const m = run.metrics;
  const bm = bench?.metrics;
  const color = colors[run.strategy];
  const years = Object.keys(run.yearly).sort();
  const algo = algorithms.find((a) => a.research.strategy === run.strategy);
  const refDoc = docs?.docs.find((d) => d.path === `docs/${run.reference}`);
  const related = docs ? mentions(docs, run.strategy).filter((x) => x.id !== refDoc?.id).slice(0, 6) : [];
  const better = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && a > b;

  const stats: [React.ReactNode, string][] = [
    [<Term id="cagr">CAGR</Term>, pct(m.cagr)],
    [<Term id="volatility">Volatility</Term>, pct(m.ann_vol)],
    [<Term id="sharpe-ratio">Sharpe ratio</Term>, num(m.sharpe)],
    [<Term id="sortino-ratio">Sortino ratio</Term>, num(m.sortino)],
    [<Term id="drawdown">Max drawdown</Term>, pct(m.max_drawdown)],
    [<Term id="calmar-ratio">Calmar ratio</Term>, num(m.calmar)],
    [<Term id="hit-rate">Hit rate</Term>, pct(m.hit_rate)],
    [<Term id="deflated-sharpe-ratio">Deflated Sharpe</Term>, num(m.deflated_sharpe)],
    ...(run.is_benchmark ? [] : [
      [<Term id="excess-return">Excess CAGR</Term>, signedPct(m.excess_cagr)],
      [<Term id="information-ratio">Information ratio</Term>, num(m.information_ratio)],
      [<Term id="beta">Beta</Term>, num(m.beta)],
      [<Term id="correlation">Correlation</Term>, num(m.correlation)],
      [<Term id="turnover">Turnover a year</Term>, m.turnover_per_year == null ? "n/a" : `${num(m.turnover_per_year, 1)}x`],
      [<Term id="break-even-cost">Break-even cost</Term>, m.breakeven_cost_bps == null ? "n/a" : `${num(m.breakeven_cost_bps, 1)} bp`],
    ] as [React.ReactNode, string][]),
    ["Start", m.start ?? "n/a"],
    ["Years", num(m.years, 1)],
  ];

  return (
    <div className="rh">
      <div className="rh-main">
        <div className="crumbs"><a href="#/strategies">Strategies</a> <span className="muted">/</span> {run.strategy}</div>
        <Title>{run.strategy}</Title>
        <HeroChart
          title={`Growth of $${prefs.startingAmount.toLocaleString()}`}
          main={{ name: run.strategy, points: run.equity }}
          compare={bench && !run.is_benchmark ? { name: "US stock market", points: bench.equity } : undefined}
          amount={prefs.startingAmount}
          range={range}
          onRange={setRange}
        />

        <section className="rh-sec">
          <h2>About</h2>
          <p className="lead">{algo?.how_it_works.simple ?? run.summary}</p>
          {algo && <p className="muted">{run.summary}</p>}
          <div className="facts-row">
            {algo && <div><div className="muted small">Origin</div>{algo.origin.authors}{algo.origin.first_published ? ` (${algo.origin.first_published})` : ""}</div>}
            {algo && <div><div className="muted small">Family</div>{algo.family}</div>}
            {algo && <div><div className="muted small">Holding period</div>{algo.horizon}</div>}
            {algo && <div><div className="muted small">Research stage</div>{algo.research.stage} of 9, {STAGES[algo.research.stage - 1]}</div>}
            {refDoc && <div><div className="muted small">Doc</div><a href={`#/doc/${refDoc.id}`} data-doc={refDoc.id}>{refDoc.id}</a></div>}
            {algo && <div><div className="muted small">Catalog</div><a href={`#/algo/${algo.slug}`}>{algo.id}</a></div>}
          </div>
        </section>

        <section className="rh-sec">
          <h2>Key statistics</h2>
          <dl className="kstats">
            {stats.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>

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
          <Card title="Signal information by horizon" help="The information coefficient: mean rank correlation between the signal and the return that follows. Where it peaks tells you how fast to trade.">
            <BarChart
              label={`Information coefficient by horizon for ${run.strategy}`}
              format={(v) => v.toFixed(2)}
              groups={run.ic_decay.map((r) => ({ label: `${r.horizon_days}d`, values: [{ name: run.strategy, color, value: r.mean_ic }] }))}
            />
          </Card>
        )}

        <div className="two">
          <Card title="Current positions" help="Weights held on the last day of the run, after volatility scaling.">
            <table className="mtable">
              <thead><tr><th className="left">Instrument</th><th>Weight</th></tr></thead>
              <tbody>{Object.entries(run.exposure).map(([k, v]) => <tr key={k}><td className="left">{k}</td><td>{pct(v, 1)}</td></tr>)}</tbody>
            </table>
          </Card>
          <Card title="Settings">
            <pre className="code">{JSON.stringify({ params: run.params, backtest: run.config }, null, 2)}</pre>
          </Card>
        </div>

        {related.length > 0 && (
          <section className="rh-sec">
            <h2>In the research</h2>
            <ul className="news">
              {related.map((r) => (
                <li key={r.id}>
                  <div className="muted small">{r.id} · {r.count} mention{r.count > 1 ? "s" : ""}</div>
                  <a href={`#/doc/${r.id}`} data-doc={r.id}>{docs?.byId[r.id]?.title}</a>
                  <div className="snip">{r.snippet}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="rh-side">
        <div className="order-card">
          <div className="order-head">Verdict</div>
          {run.is_benchmark ? (
            <p className="muted">This is the benchmark every strategy has to beat.</p>
          ) : (
            <>
              <Row label="Beats the S&P 500" value={run.gauntlet ? (run.gauntlet.beats_sp500 ? "Yes" : "No") : "n/a"} good={run.gauntlet?.beats_sp500} />
              <Row label="Gauntlet" value={run.gauntlet ? `${run.gauntlet.passed} of ${run.gauntlet.total}` : "n/a"} />
              <Row label="Sharpe vs market" value={`${num(m.sharpe)} vs ${num(bm?.sharpe)}`} good={better(m.sharpe, bm?.sharpe)} />
              <Row label="CAGR vs market" value={`${pct(m.cagr)} vs ${pct(bm?.cagr)}`} good={better(m.cagr, bm?.cagr)} />
              <Row label="Worst fall vs market" value={`${pct(m.max_drawdown)} vs ${pct(bm?.max_drawdown)}`} good={better(m.max_drawdown, bm?.max_drawdown)} />
              <Row label="Deflated Sharpe" value={`${num(m.deflated_sharpe)} (0.95 needed)`} good={(m.deflated_sharpe ?? 0) >= 0.95} />
              {run.gauntlet && <p className="order-note">{run.gauntlet.verdict}</p>}
            </>
          )}
          <Button variant="primary" size="lg" full href="#/lab">Try other settings in the Lab</Button>
        </div>
        <Button variant="outline" size="lg" full href="#/compare">Compare with others</Button>
        {refDoc && <Button variant="outline" size="lg" full href={`#/doc/${refDoc.id}`}>Read the write-up</Button>}
      </aside>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean | null }) {
  return (
    <div className="order-row">
      <span>{label}</span>
      <strong className={good == null ? "" : good ? "good" : "bad"}>{value}</strong>
    </div>
  );
}
