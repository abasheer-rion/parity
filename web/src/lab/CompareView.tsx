// Compare (DEC-0043): every strategy in the run on the same data. Four tables: the league
// table, what each did in the worst stock market episodes, how they move together, and
// how each holds up (DEC-0067) with the full section for the one picked below it.
// The table, its sort and the pick live in the address (#/compare?t=holdup&s=fx_carry).
import { useMemo, useState } from "react";
import { hashQuery, setHashQuery } from "../lib/deeplink";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import { productUrl } from "../lib/space";
import { nameOf, verdictOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { Badge, Segmented, Select, Tooltip } from "../ui";
import { HoldupSection } from "../components/holdup/HoldupSection";
import { dec, pct as pct1, pText, regimeTally, verdictLine } from "../components/holdup/text";

type Tab = "league" | "crisis" | "corr" | "holdup";
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
  const [tab, setTabState] = useState<Tab>(() => (["league", "crisis", "corr", "holdup"].includes(q.get("t") ?? "") ? q.get("t") as Tab : "league"));
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
      <div className="lb-bar lb-bar-wrap">
        <Segmented size="sm" label="Table" value={tab} onChange={setTab}
          options={[["league", "League table"], ["crisis", "Crises"], ["corr", "Correlation"], ["holdup", "How they hold up"]] as [Tab, string][]} />
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

      {tab === "holdup" && <HoldupTable report={report} ranked={ranked} link={link} colors={colors} />}

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

/** Every strategy's "how it holds up" numbers in one table, and the full section for one. */
function HoldupTable({ report, ranked, link, colors }: { report: Report; ranked: StrategyRun[]; link: (id: string) => React.ReactNode; colors: Record<string, string> }) {
  const withH = ranked.filter((r) => r.holdup);
  const first = withH.find((r) => !r.is_benchmark)?.strategy ?? withH[0]?.strategy ?? "";
  const [pick, setPickState] = useState(() => {
    const s = hashQuery().get("s");
    return s && withH.some((r) => r.strategy === s) ? s : first;
  });
  const setPick = (s: string) => { setPickState(s); setHashQuery({ s }); };
  if (!withH.length) return <div className="lb-msg">This run was published before the "how it holds up" checks were added.</div>;
  const run = report.runs.find((r) => r.strategy === pick);
  const n = withH.find((r) => !r.is_benchmark)?.holdup?.luck.n_trials ?? 1;
  return (
    <div className="lb-box lb-flush lb-grow">
      <div className="lb-box-h"><span>Luck, error bars and where each one wins, after allowing for {n.toLocaleString("en-US")} strategies tried</span><span className="lb-dim">same order as the league table</span></div>
      <div className="lb-table-wrap">
        <table className="lb-table ui-stagger-rows">
          <caption className="sr-only">How each strategy holds up</caption>
          <thead>
            <tr>
              <th className="l" scope="col">Strategy</th>
              <th scope="col"><Tooltip text="The chance the true Sharpe is above zero after allowing for every strategy tried. 95% is the line."><span>Luck check</span></Tooltip></th>
              <th scope="col"><Tooltip text="Where the Sharpe ratio lands in 95 of 100 reshuffles of the record."><span>Sharpe, 95% range</span></Tooltip></th>
              <th scope="col"><Tooltip text="The chance of a Sharpe this high with no edge, corrected for the number of strategies tried (Bonferroni)."><span>Corrected p-value</span></Tooltip></th>
              <th scope="col">With stocks</th>
              <th scope="col">With bonds</th>
              <th scope="col"><Tooltip text="Periods (rates, volatility, crises, decades) where it beat the US stock market."><span>Periods won</span></Tooltip></th>
              <th scope="col">Deepest fall</th>
              <th scope="col">Checks hold</th>
            </tr>
          </thead>
          <tbody>
            {withH.map((r) => {
              const h = r.holdup!;
              const t = regimeTally(h);
              const s95 = h.bootstrap?.sharpe.ci95;
              const v = verdictLine(h);
              return (
                <tr key={r.strategy}>
                  <td className="l"><span className="swatch" style={{ background: colors[r.strategy] }} />{link(r.strategy)}</td>
                  <td className={h.luck.probability == null ? "lb-dim" : h.luck.probability >= h.luck.line ? "good" : "bad"}>{h.luck.probability == null ? "n/a" : pct1(h.luck.probability, 0)}</td>
                  <td className={s95?.[0] != null && s95[0] > 0 ? "good" : ""}>{s95 ? `${dec(s95[0])} to ${dec(s95[1])}` : "n/a"}</td>
                  <td className={h.p_values.significant.bonferroni ? "good" : ""}>{pText(h.p_values.bonferroni)}</td>
                  <td>{dec(h.rolling_correlation?.full_period.stocks)}</td>
                  <td>{dec(h.rolling_correlation?.full_period.bonds)}</td>
                  <td>{t.total ? `${t.won} of ${t.total}` : "n/a"}</td>
                  <td>{pct1(h.worst_periods.drawdowns[0]?.depth, 0)}</td>
                  <td className="lb-dim">{v.title.replace(" checks hold", "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="lb-holdup">
        <div className="lb-holdup-pick">
          <span aria-hidden>Show the full checks for</span>
          <Select label="Show the full checks for" value={pick} onChange={setPick}
            options={withH.map((r) => [r.strategy, nameOf(r)] as [string, string])} />
        </div>
        {run && <HoldupSection holdup={run.holdup} name={nameOf(run)} level={3} />}
      </div>
    </div>
  );
}
