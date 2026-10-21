// Every strategy in one list, Robinhood watchlist style (name, a small chart, the
// move over the chosen range) in Mercury's table layout.
import { useState } from "react";
import { RANGES, Sparkline, sliceRange, type RangeKey } from "../components/charts";
import { Title } from "../components/Shell";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import type { Report, StrategyRun } from "../lib/types";
import { Term } from "./Learn";

type SortKey = "move" | "cagr" | "sharpe" | "dd" | "dsr" | "gauntlet" | "name";

function move(r: StrategyRun, range: RangeKey): number | null {
  const p = sliceRange(r.equity, range);
  return p.length > 1 ? p[p.length - 1][1] / p[0][1] - 1 : null;
}

export function Strategies({ report }: { report: Report }) {
  const prefs = usePrefs();
  const [range, setRange] = useState<RangeKey>(prefs.defaultRange);
  const [sort, setSort] = useState<SortKey>("sharpe");
  const colors = colorMap(report.runs);
  const val = (r: StrategyRun): number | string => ({
    move: move(r, range) ?? -9, cagr: r.metrics.cagr ?? -9, sharpe: r.metrics.sharpe ?? -9, dd: r.metrics.max_drawdown ?? -9,
    dsr: r.metrics.deflated_sharpe ?? -9, gauntlet: r.gauntlet?.passed ?? -1, name: r.strategy,
  })[sort];
  const rows = [...report.runs].sort((a, b) => {
    if (a.is_benchmark !== b.is_benchmark) return a.is_benchmark ? -1 : 1;
    const x = val(a), y = val(b);
    return typeof x === "string" ? x.localeCompare(y as string) : (y as number) - x;
  });
  const th = (k: SortKey, label: React.ReactNode, cls = "") => (
    <th className={`${cls} sortable ${sort === k ? "sorted" : ""}`} onClick={() => setSort(k)} aria-sort={sort === k ? "descending" : "none"}>{label}</th>
  );

  return (
    <>
      <Title>Strategies</Title>
      <div className="toolbar">
        <div className="range-tabs inline" role="tablist" aria-label="Time range">
          {RANGES.map((r) => <button key={r} role="tab" aria-selected={r === range} className={r === range ? "on" : ""} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        <span className="muted small">{report.runs.length - 1} strategies against the US stock market, {report.n_trials} trials counted</span>
      </div>
      <div className="table-wrap">
        <table className="mtable">
          <thead>
            <tr>
              {th("name", "Strategy", "left")}
              <th className="left">{range}</th>
              {th("move", "Move")}
              {th("cagr", <Term id="cagr">CAGR</Term>)}
              {th("sharpe", <Term id="sharpe-ratio">Sharpe</Term>)}
              {th("dd", <Term id="drawdown">Max drawdown</Term>)}
              {th("dsr", <Term id="deflated-sharpe-ratio">Deflated</Term>)}
              {th("gauntlet", "Gauntlet")}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mv = move(r, range);
              return (
                <tr key={r.strategy} className="row-link" onClick={() => { window.location.hash = `#/strategy/${r.strategy}`; }}>
                  <td className="left">
                    <span className="acct-dot" style={{ background: colors[r.strategy] }} />
                    <a href={`#/strategy/${r.strategy}`} onClick={(e) => e.stopPropagation()}>{r.strategy}</a>
                    {r.is_benchmark && <span className="chip-badge">benchmark</span>}
                  </td>
                  <td className="left"><Sparkline points={sliceRange(r.equity, range)} /></td>
                  <td className={mv == null ? "" : mv >= 0 ? "good" : "bad"}>{mv == null ? "n/a" : `${mv >= 0 ? "+" : "−"}${pct(Math.abs(mv))}`}</td>
                  <td>{pct(r.metrics.cagr)}</td>
                  <td>{num(r.metrics.sharpe)}</td>
                  <td>{pct(r.metrics.max_drawdown)}</td>
                  <td>{num(r.metrics.deflated_sharpe)}</td>
                  <td>{r.gauntlet ? `${r.gauntlet.passed} of ${r.gauntlet.total}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
