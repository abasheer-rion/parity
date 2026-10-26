// Compare (DEC-0043): every strategy in the run on the same data. Three tables: the league
// table, what each did in the worst stock market episodes, and how they move together.
// The table and its sort live in the address (#/compare?t=crisis&sort=sharpe).
import { useMemo, useState } from "react";
import { hashQuery, setHashQuery } from "../lib/deeplink";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import { productUrl } from "../lib/space";
import { nameOf, verdictOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { Badge, Segmented, Tooltip } from "../ui";

type Tab = "league" | "crisis" | "corr";
type SortKey = "tests" | "sharpe" | "deflated" | "cagr" | "vol" | "dd" | "corr";

const heat = (v: number) => {
  const a = Math.min(Math.abs(v), 1);
  return v >= 0 ? `color-mix(in srgb, var(--series-1) ${Math.round(a * 70)}%, transparent)` : `color-mix(in srgb, var(--series-8) ${Math.round(a * 70)}%, transparent)`;
};

const SORTS: Record<SortKey, (r: StrategyRun) => number> = {
  tests: (r) => (r.gauntlet?.passed ?? -1) * 1000 + (r.metrics.sharpe ?? 0),
  sharpe: (r) => r.metrics.sharpe ?? -99,
  deflated: (r) => r.metrics.deflated_sharpe ?? -99,
  cagr: (r) => r.metrics.cagr ?? -99,
  vol: (r) => -(r.metrics.ann_vol ?? 99),
  dd: (r) => r.metrics.max_drawdown ?? -99,
  corr: (r) => -(r.is_benchmark ? 1 : r.metrics.correlation ?? 1),
};

function Head({ k, label, tip, sort, setSort }: { k: SortKey; label: string; tip?: string; sort: SortKey; setSort: (k: SortKey) => void }) {
  const b = <button type="button" onClick={() => setSort(k)} aria-pressed={sort === k}>{label}{sort === k ? " ↓" : ""}</button>;
  return <th aria-sort={sort === k ? "descending" : undefined}>{tip ? <Tooltip text={tip}>{b}</Tooltip> : b}</th>;
}

export function CompareView({ report }: { report: Report }) {
  const q = hashQuery();
  const [tab, setTabState] = useState<Tab>(() => (["league", "crisis", "corr"].includes(q.get("t") ?? "") ? q.get("t") as Tab : "league"));
  const [sort, setSortState] = useState<SortKey>(() => ((q.get("sort") ?? "") in SORTS ? q.get("sort") as SortKey : "tests"));
  const setTab = (t: Tab) => { setTabState(t); setHashQuery({ t: t === "league" ? null : t }); };
  const setSort = (k: SortKey) => { setSortState(k); setHashQuery({ sort: k === "tests" ? null : k }); };
  const colors = useMemo(() => colorMap(report.runs), [report]);
  const ranked = useMemo(() => [...report.runs].sort((a, b) => SORTS[sort](b) - SORTS[sort](a)), [report, sort]);
  const cmp = report.comparison;
  const byId = Object.fromEntries(report.runs.map((r) => [r.strategy, r]));
  const label = (id: string) => (byId[id] ? nameOf(byId[id]) : id);
  const link = (id: string) => <a href={productUrl(`#/strategy/${encodeURIComponent(id)}`)} target="_blank" rel="noopener" title={id}>{label(id)}</a>;

  return (
    <div className="lb-view lb-scroll">
      <div className="lb-bar">
        <Segmented size="sm" label="Table" value={tab} onChange={setTab}
          options={[["league", "League table"], ["crisis", "Crises"], ["corr", "Correlation"]] as [Tab, string][]} />
        <span className="lb-gap" />
        <span className="lb-dim">{report.runs.length} strategies · same data since 1999 · exploratory unless the ledger lists the run</span>
      </div>

      {tab === "league" && (
        <div className="lb-box lb-flush lb-grow">
          <div className="lb-table-wrap">
            <table className="lb-table ui-stagger-rows">
              <thead>
                <tr>
                  <th className="l">Strategy</th>
                  <Head k="tests" label="Tests passed" sort={sort} setSort={setSort} />
                  <Head k="sharpe" label="Sharpe" sort={sort} setSort={setSort} tip="Return per unit of risk, after costs." />
                  <Head k="deflated" label="Deflated Sharpe" sort={sort} setSort={setSort} tip="The Sharpe ratio after allowing for how many strategies were tried. Low next to a high Sharpe means it may be luck." />
                  <Head k="cagr" label="Per year" sort={sort} setSort={setSort} />
                  <Head k="vol" label="Volatility" sort={sort} setSort={setSort} />
                  <Head k="dd" label="Worst fall" sort={sort} setSort={setSort} />
                  <Head k="corr" label="With stocks" sort={sort} setSort={setSort} tip="Correlation of monthly returns with the S&P 500. Lower helps a stock investor diversify." />
                  <th className="l">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.strategy}>
                    <td className="l"><span className="swatch" style={{ background: colors[r.strategy] }} />{link(r.strategy)}</td>
                    <td><Badge tone={verdictOf(r).tone}>{verdictOf(r).label}</Badge>{r.gauntlet && <span className="lb-dim"> {r.gauntlet.passed}/{r.gauntlet.total}</span>}</td>
                    <td>{num(r.metrics.sharpe)}</td><td>{num(r.metrics.deflated_sharpe)}</td><td>{pct(r.metrics.cagr)}</td>
                    <td>{pct(r.metrics.ann_vol)}</td><td>{pct(r.metrics.max_drawdown)}</td>
                    <td>{r.is_benchmark ? "1.00" : num(r.metrics.correlation)}</td>
                    <td className="l lb-wrap lb-dim">{r.gauntlet?.verdict ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "crisis" && (cmp ? (
        <div className="lb-box lb-flush lb-grow">
          <div className="lb-box-h"><span>Total return over each episode, start to end</span><span className="lb-dim">green in a crash offsets a stock investor's loss</span></div>
          <div className="lb-table-wrap">
            <table className="lb-table ui-stagger-rows">
              <thead><tr><th className="l">Strategy</th>{cmp.crises.map((c) => <th key={c.name} title={`${c.start} to ${c.end}`}>{c.name}</th>)}</tr></thead>
              <tbody>
                {cmp.names.map((n) => (
                  <tr key={n}><td className="l">{link(n)}</td>{cmp.crises.map((c) => {
                    const v = c.returns[n];
                    return <td key={c.name} className={v == null ? "lb-dim" : v >= 0 ? "good" : "bad"}>{pct(v)}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="lb-msg">This run has no crisis table.</div>)}

      {tab === "corr" && (cmp ? (
        <div className="lb-box lb-flush lb-grow">
          <div className="lb-box-h"><span>Monthly correlation</span><span className="lb-dim">blue: move together · red: move opposite</span></div>
          <div className="lb-table-wrap">
            <table className="lb-table lb-heat ui-stagger-rows">
              <thead><tr><th className="l" />{cmp.names.map((n) => <th key={n} className="lb-rot" title={label(n)}><span>{n}</span></th>)}</tr></thead>
              <tbody>
                {cmp.names.map((row, i) => (
                  <tr key={row}><td className="l" title={label(row)}>{row}</td>{cmp.correlation[i].map((v, j) => <td key={j} style={{ background: heat(v) }} title={`${label(row)} vs ${label(cmp.names[j])}: ${v.toFixed(2)}`}>{v.toFixed(2)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="lb-msg">This run has no correlation table.</div>)}
    </div>
  );
}
