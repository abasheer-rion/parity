// Home, laid out like Mercury's dashboard: a welcome line, quick actions, then cards.
// The market card is the headline chart; the others summarise strategies, the
// gauntlet, the research record and the best and worst strategies by year.
import { useState } from "react";
import { HeroChart, Sparkline, type RangeKey } from "../ui/charts";
import { Icon } from "../ui/icons";
import { Button, ButtonGroup } from "../ui";
import { colorMap } from "../lib/colors";
import { useDocs } from "../lib/docs";
import { num, pct } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import type { Report, StrategyRun } from "../lib/types";
import { ledger } from "../lib/catalog";
import { nameOf } from "../lib/strategyMeta";

export function Overview({ report, email }: { report: Report; email?: string | null }) {
  const prefs = usePrefs();
  const [range, setRange] = useState<RangeKey>(prefs.defaultRange);
  const [view, setView] = useState<"graph" | "table">("graph");
  const docs = useDocs();
  const colors = colorMap(report.runs);
  const bench = report.runs.find((r) => r.is_benchmark);
  const candidates = report.runs.filter((r) => !r.is_benchmark);
  const bySharpe = [...candidates].sort((a, b) => (b.metrics.sharpe ?? -9) - (a.metrics.sharpe ?? -9));
  const best = bySharpe[0];
  const beating = candidates.filter((r) => r.gauntlet?.beats_sp500);
  const name = email ? email.split("@")[0].replace(/[._-].*$/, "") : null;

  const years = [...new Set(report.runs.flatMap((r) => Object.keys(r.yearly)))].sort();
  const [yearIdx, setYearIdx] = useState(years.length - 1);
  const year = years[yearIdx];
  const ranked = candidates.filter((r) => r.yearly[year] != null).sort((a, b) => b.yearly[year] - a.yearly[year]);

  const tests = candidates.flatMap((r) => r.gauntlet?.tests ?? []);
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => t.passed === false).length;
  const lastRun = ledger[ledger.length - 1];

  const hyps = docs?.docs.filter((d) => d.type === "hypothesis") ?? [];
  const recent = docs ? [...docs.docs].sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id)).slice(0, 4) : [];

  return (
    <div className="home">
      <h1 className="welcome">Welcome{name ? `, ${name[0].toUpperCase()}${name.slice(1)}` : ""}</h1>
      <div className="actions">
        <ButtonGroup>
          <Button variant="primary" icon="chart" href="#/strategies">Strategies</Button>
          <Button icon="compare" href="#/compare">Compare</Button>
          <Button icon="flask" href="#/lab">Lab</Button>
          <Button icon="book" href="#/docs">Read</Button>
          <Button icon="search" onClick={() => window.dispatchEvent(new Event("parity:search"))}>Search</Button>
        </ButtonGroup>
      </div>

      <div className="home-grid">
        {bench && (
          <section className="mcard span2">
            {view === "graph" ? (
              <HeroChart
                title={<>US stock market <span className="chip-badge">benchmark</span></>}
                main={{ name: "US stock market", points: bench.equity }}
                amount={prefs.startingAmount}
                range={range}
                onRange={setRange}
                height={240}
                aside={<GraphTable view={view} setView={setView} />}
              />
            ) : (
              <>
                <div className="mcard-head"><h2>US stock market by year</h2><GraphTable view={view} setView={setView} /></div>
                <YearTable run={bench} />
              </>
            )}
          </section>
        )}

        <section className="mcard">
          <div className="mcard-head"><h2>Strategies</h2><a className="round-btn" href="#/strategies" aria-label="All strategies"><Icon name="list" size={14} /></a></div>
          <ul className="acct-list">
            {bySharpe.slice(0, 6).map((r) => (
              <li key={r.strategy}>
                <a href={`#/strategy/${r.strategy}`}>
                  <span className="acct-dot" style={{ background: colors[r.strategy] }} />
                  <span className="acct-name">{nameOf(r)}</span>
                  <Sparkline points={r.equity} width={56} height={22} />
                  <span className="acct-val">{num(r.metrics.sharpe)}</span>
                </a>
              </li>
            ))}
          </ul>
          <a className="more" href="#/strategies"><span className="more-badge">+{Math.max(0, candidates.length - 6)}</span> View all strategies</a>
        </section>

        <section className="mcard">
          <div className="mcard-head"><h2>Beating the S&P 500</h2></div>
          <div className="big-num">{beating.length} <span className="muted">of {candidates.length}</span></div>
          <div className="meter"><i style={{ width: `${Math.min(100, ((best?.metrics.sharpe ?? 0) / Math.max(bench?.metrics.sharpe ?? 1, 0.01)) * 50)}%` }} /><b style={{ left: "50%" }} /></div>
          <div className="meter-key">
            <span><i className="k1" /> Best Sharpe {num(best?.metrics.sharpe)}</span>
            <span><i className="k2" /> Market {num(bench?.metrics.sharpe)}</span>
          </div>
          <div className="mcard-foot">
            <div><div className="muted small">Best so far</div><a href={`#/strategy/${best?.strategy}`}>{best ? nameOf(best) : ""}</a></div>
            <div><div className="muted small">Trials counted</div>{report.n_trials}</div>
          </div>
        </section>

        <section className="mcard">
          <div className="mcard-head"><h2>Gauntlet</h2><a className="round-btn" href="#/doc/REF-0006" data-doc="REF-0006" aria-label="About the gauntlet"><Icon name="info" size={14} /></a></div>
          <div className="stat-row">
            <div><div className="muted small">Tests passed</div><div className="mid-num good">{passed}</div></div>
            <div><div className="muted small">Tests failed</div><div className="mid-num bad">{failed}</div></div>
            <div><div className="muted small">Strategies</div><div className="mid-num">{candidates.length}</div></div>
          </div>
          <div className="mcard-foot">
            <div><div className="muted small">Latest official run</div>{lastRun ? <a href="#/ledger">{lastRun.run_id}</a> : "none"}</div>
            <div className="muted small">{lastRun?.recorded_at.slice(0, 10)}</div>
          </div>
        </section>

        <section className="mcard">
          <div className="mcard-head"><h2>Research</h2><a className="round-btn" href="#/docs" aria-label="All docs"><Icon name="book" size={14} /></a></div>
          <div className="stat-row">
            {(["testing", "supported", "rejected"] as const).map((s) => (
              <div key={s}><div className="muted small">{s[0].toUpperCase() + s.slice(1)}</div><div className="mid-num">{hyps.filter((h) => h.status === s).length}</div></div>
            ))}
          </div>
          <ul className="mini-list">
            {recent.map((d) => <li key={d.id}><a href={`#/doc/${d.id}`} data-doc={d.id}>{d.title}</a></li>)}
          </ul>
        </section>

        {year && (
          <section className="mcard span3">
            <div className="mcard-head">
              <h2>Year in review</h2>
              <div className="stepper">
                <button className="round-btn" disabled={yearIdx <= 0} onClick={() => setYearIdx((i) => i - 1)} aria-label="Previous year"><Icon name="chevronLeft" size={14} /></button>
                <span>{year}</span>
                <button className="round-btn flip" disabled={yearIdx >= years.length - 1} onClick={() => setYearIdx((i) => i + 1)} aria-label="Next year"><Icon name="chevronLeft" size={14} /></button>
              </div>
            </div>
            <div className="review">
              <Movers title="Best" icon="arrowUpRight" runs={ranked.slice(0, 4)} year={year} market={bench?.yearly[year]} />
              <Movers title="Worst" icon="arrowDownRight" runs={ranked.slice(-4).reverse()} year={year} market={bench?.yearly[year]} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function GraphTable({ view, setView }: { view: "graph" | "table"; setView: (v: "graph" | "table") => void }) {
  return (
    <div className="seg-icons" role="tablist" aria-label="Graph or table">
      <button role="tab" aria-selected={view === "graph"} className={view === "graph" ? "on" : ""} onClick={() => setView("graph")} aria-label="Graph"><Icon name="graph" /></button>
      <button role="tab" aria-selected={view === "table"} className={view === "table" ? "on" : ""} onClick={() => setView("table")} aria-label="Table"><Icon name="table" /></button>
    </div>
  );
}

function YearTable({ run }: { run: StrategyRun }) {
  const ys = Object.keys(run.yearly).sort().reverse();
  return (
    <div className="table-wrap tall">
      <table className="mtable">
        <thead><tr><th>Year</th><th>Return</th></tr></thead>
        <tbody>{ys.map((y) => <tr key={y}><td>{y}</td><td className={run.yearly[y] >= 0 ? "good" : "bad"}>{pct(run.yearly[y])}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Movers({ title, icon, runs, year, market }: { title: string; icon: string; runs: StrategyRun[]; year: string; market?: number }) {
  return (
    <div className="movers">
      <div className="muted small"><Icon name={icon} size={13} /> {title} in {year}</div>
      <ul>
        {runs.map((r) => (
          <li key={r.strategy}>
            <a href={`#/strategy/${r.strategy}`} title={r.strategy}>{nameOf(r)}</a>
            <span className={r.yearly[year] >= 0 ? "good" : "bad"}>{r.yearly[year] >= 0 ? "+" : "−"}{pct(Math.abs(r.yearly[year]))}</span>
          </li>
        ))}
      </ul>
      {market != null && <div className="muted small">US stock market {market >= 0 ? "+" : "−"}{pct(Math.abs(market))}</div>}
    </div>
  );
}

