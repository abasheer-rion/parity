// One strategy, laid out like a Robinhood stock page: name, the value of a starting
// amount, a range-tabbed chart you can scrub, About, Key statistics, then detail.
// The right column holds the verdict where Robinhood puts its order panel.
import { useHashState } from "../lib/deeplink";
import { labUrl } from "../lib/space";
import { BarChart, HeroChart, LineChart, RANGES, type RangeKey } from "../ui/charts";
import { GauntletCard } from "../components/GauntletCard";
import { HoldupSection } from "../components/holdup/HoldupSection";
import { Badge, Button } from "../ui";
import { Title } from "../components/Shell";
import { Card } from "../ui/layout";
import { algorithms, STAGES } from "../lib/catalog";
import { colorMap } from "../lib/colors";
import { mentions, useDocs } from "../lib/docs";
import { num, pct, signedPct } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { nameOf, taglineOf, verdictOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { Term } from "./Learn";

export function StrategyPage({ report, name }: { report: Report; name: string }) {
  const prefs = usePrefs();
  // The range lives in the link, so Copy link and reload reopen the same view (DEC-0038).
  const [rangeRaw, setRange] = useHashState("range", prefs.defaultRange);
  const range: RangeKey = (RANGES as readonly string[]).includes(rangeRaw) ? (rangeRaw as RangeKey) : prefs.defaultRange;
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
        <div className="crumbs"><a href="#/strategies">Strategies</a> <span className="muted">/</span> {nameOf(run)}</div>
        <Title label={nameOf(run)} actions={<Badge tone={verdictOf(run).tone}>{verdictOf(run).label}</Badge>}>{nameOf(run)}</Title>
        {taglineOf(run) && <p className="lead strat-tagline">{taglineOf(run)}</p>}
        <p className="verdict-line">{storyOf(run, bench, prefs.startingAmount)}</p>
        <HeroChart
          title={`Growth of $${prefs.startingAmount.toLocaleString()}`}
          main={{ name: nameOf(run), points: run.equity }}
          compare={bench && !run.is_benchmark ? { name: nameOf(bench), points: bench.equity } : undefined}
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
            label={`Drawdown of ${nameOf(run)}`}
            format={(v) => pct(v, 0)}
            height={200}
            series={[
              { name: nameOf(run), color, points: run.drawdown, emphasis: true },
              ...(bench && !run.is_benchmark ? [{ name: nameOf(bench), color: colors[bench.strategy], points: bench.drawdown }] : []),
            ]}
          />
        </Card>

        <Card title="Return by calendar year" help="Shows whether the result depends on a few years.">
          <BarChart
            label={`Yearly returns of ${nameOf(run)}`}
            format={(v) => pct(v, 0)}
            groups={years.map((y) => ({
              label: years.length > 14 ? `'${y.slice(2)}` : y,
              values: [
                { name: nameOf(run), color, value: run.yearly[y] },
                ...(bench && !run.is_benchmark ? [{ name: nameOf(bench), color: colors[bench.strategy], value: bench.yearly[y] ?? null }] : []),
              ],
            }))}
          />
        </Card>

        <HoldupSection holdup={run.holdup} name={nameOf(run)} id="holds-up"
          missing="This run was published before these checks were added. They appear from the next research run." />

        {run.ic_decay.length > 0 && (
          <Card title="Signal information by horizon" help="The information coefficient: mean rank correlation between the signal and the return that follows. Where it peaks tells you how fast to trade.">
            <BarChart
              label={`Information coefficient by horizon for ${nameOf(run)}`}
              format={(v) => v.toFixed(2)}
              groups={run.ic_decay.map((r) => ({ label: `${r.horizon_days}d`, values: [{ name: nameOf(run), color, value: r.mean_ic }] }))}
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

        <p className="page-disclaimer">Research and education only. Not investment advice. Past results do not predict future returns.</p>
      </div>

      <aside className="rh-side">
        <div className="order-card">
          <div className="order-head">Verdict</div>
          {run.is_benchmark ? (
            <p className="muted">This is the benchmark every strategy has to beat.</p>
          ) : (
            <>
              <Row label="Beats the S&P 500" value={run.gauntlet ? (run.gauntlet.beats_sp500 ? "Yes" : "No") : "n/a"} good={run.gauntlet?.beats_sp500} />
              <Row label="Tests passed" value={run.gauntlet ? `${run.gauntlet.passed} of ${run.gauntlet.total}` : "n/a"} />
              <Row label="Sharpe vs market" value={`${num(m.sharpe)} vs ${num(bm?.sharpe)}`} good={better(m.sharpe, bm?.sharpe)} />
              <Row label="CAGR vs market" value={`${pct(m.cagr)} vs ${pct(bm?.cagr)}`} good={better(m.cagr, bm?.cagr)} />
              <Row label="Worst fall vs market" value={`${pct(m.max_drawdown)} vs ${pct(bm?.max_drawdown)}`} good={better(m.max_drawdown, bm?.max_drawdown)} />
              <Row label="Deflated Sharpe" value={`${num(m.deflated_sharpe)} (0.95 needed)`} good={(m.deflated_sharpe ?? 0) >= 0.95} />
              {run.gauntlet && <p className="order-note">{run.gauntlet.verdict}</p>}
            </>
          )}
          <Button variant="primary" size="lg" full href={labUrl(`try?s=${encodeURIComponent(run.strategy)}`)} target="_blank">Try other settings in the Workbench</Button>
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

/** One plain sentence: what a starting amount became, against the market, and the verdict. */
function storyOf(run: StrategyRun, bench: StrategyRun | undefined, amount: number): string {
  const grow = (r?: StrategyRun) => {
    const e = r?.equity;
    return e && e.length > 1 && e[0][1] ? amount * (e[e.length - 1][1] / e[0][1]) : null;
  };
  const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const mine = grow(run);
  const start = run.metrics.start ? ` from ${run.metrics.start.slice(0, 4)}` : "";
  if (mine == null) return verdictOf(run).plain;
  if (run.is_benchmark) return `${money(amount)} put in the US stock market${start} became ${money(mine)}. Every strategy has to beat this.`;
  const theirs = grow(bench);
  const vs = theirs != null ? `, against ${money(theirs)} in the US stock market` : "";
  return `${money(amount)} put in${start} became ${money(mine)}${vs}, after costs. ${verdictOf(run).plain}`;
}
