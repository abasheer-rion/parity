// Try settings (DEC-0043): one strategy's settings test, one version at a time. Every
// version was already run by the settings test; nothing is computed here. The strategy
// and the settings live in the address (#/try?s=<strategy>&p.<setting>=<value>).
import { useMemo, useState } from "react";
import { hashQuery, setHashQuery } from "../lib/deeplink";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import { productUrl } from "../lib/space";
import { nameOf, searchTextOf, taglineOf } from "../lib/strategyMeta";
import type { Point, Report, StrategyRun } from "../lib/types";
import { AnimatedNumber, Button, LineChart, Tooltip } from "../ui";

// A stat that ticks to its new value as the settings change (REF-0023).
const tick = (v: number | null | undefined, f: (x: number) => string) => (v == null || !Number.isFinite(v) ? f(NaN) : <AnimatedNumber value={v} format={f} ms={450} />);

interface Variant { params: Record<string, unknown>; sharpe: number; cagr: number | null; max_drawdown: number | null; equity?: Point[] }

const variantsOf = (r?: StrategyRun): Variant[] => ((r?.gauntlet as unknown as { sensitivity?: { variants?: Variant[] } })?.sensitivity?.variants) ?? [];

export function TryView({ report }: { report: Report }) {
  const runs = useMemo(() => report.runs.filter((r) => !r.is_benchmark && variantsOf(r).length > 0).sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [report]);
  const bench = report.runs.find((r) => r.is_benchmark);
  const colors = useMemo(() => colorMap(report.runs), [report]);
  const [name, setName] = useState(() => {
    const s = hashQuery().get("s");
    return runs.some((r) => r.strategy === s) ? s! : runs[0]?.strategy ?? "";
  });
  const [find, setFind] = useState("");
  const run = runs.find((r) => r.strategy === name);
  const variants = variantsOf(run);
  const keys = variants.length ? Object.keys(variants[0].params) : [];
  const defaults = run ? run.params : {};
  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const q = hashQuery(), out: Record<string, string> = {};
    for (const [k, v] of q) if (k.startsWith("p.")) out[k.slice(2)] = v;
    return out;
  });
  const wanted = (k: string) => choice[k] ?? String(defaults[k]);
  const current = variants.find((v) => keys.every((k) => String(v.params[k]) === wanted(k))) ?? variants[0];

  const pick = (strategy: string) => {
    setName(strategy);
    setChoice({});
    const clear = Object.fromEntries([...hashQuery().keys()].filter((k) => k.startsWith("p.")).map((k) => [k, null]));
    setHashQuery({ ...clear, s: strategy });
  };
  const setParam = (k: string, v: string) => {
    setChoice((c) => ({ ...c, [k]: v }));
    setHashQuery({ [`p.${k}`]: String(defaults[k]) === v ? null : v });
  };
  const setVariant = (v: Variant) => {
    const next = Object.fromEntries(keys.map((k) => [k, String(v.params[k])]));
    setChoice(next);
    setHashQuery(Object.fromEntries(keys.map((k) => [`p.${k}`, String(defaults[k]) === next[k] ? null : next[k]])));
  };

  if (!runs.length) return <div className="lb-msg">No strategy in this run has a settings test.</div>;
  const needle = find.trim().toLowerCase();
  const shown = needle ? runs.filter((r) => searchTextOf(r).toLowerCase().includes(needle)) : runs;
  const positive = variants.filter((v) => v.sharpe > 0).length;
  const benchSharpe = bench?.metrics.sharpe ?? null;

  return (
    <div className="lb-split">
      <aside className="lb-side" aria-label="Strategy and settings">
        <div className="lb-side-sec">
          <label className="lb-field" data-lab-find>
            <span>Strategy</span>
            <input className="lb-input" type="search" value={find} placeholder={`Find among ${runs.length}`} onChange={(e) => setFind(e.target.value)} aria-label="Find a strategy" />
          </label>
        </div>
        <ul className="lb-list" aria-label="Strategies">
          {shown.map((r) => (
            <li key={r.strategy}>
              <button type="button" className={r.strategy === name ? "on" : ""} aria-pressed={r.strategy === name} onClick={() => pick(r.strategy)} title={taglineOf(r) || r.strategy}>
                <span className="lb-list-l">{nameOf(r)}</span>
                <span className="lb-list-r tabular">{num(r.metrics.sharpe)}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="lb-dim lb-pad">No match</li>}
        </ul>
        {keys.length > 0 && (
          <div className="lb-side-sec lb-params">
            <span className="lb-sub">Settings</span>
            {keys.map((k) => {
              const values = [...new Set(variants.map((v) => String(v.params[k])))];
              return (
                <label key={k} className="lb-field lb-field-row">
                  <span className="mono">{k}</span>
                  <select className="lb-select" value={choice[k] ?? String(current?.params[k])} onChange={(e) => setParam(k, e.target.value)}>
                    {values.map((v) => <option key={v} value={v}>{v}{String(defaults[k]) === v ? " (default)" : ""}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </aside>

      <section className="lb-pane" aria-label="Result">
        {run && current && (
          <>
            <div className="lb-bar">
              <strong className="lb-title">{nameOf(run)}</strong>
              <span className="lb-dim mono">{keys.map((k) => `${k}=${String(current.params[k])}`).join("  ")}</span>
              <span className="lb-gap" />
              <span className="lb-note">
                Version {variants.indexOf(current) + 1} of {variants.length}. All {variants.length} count as{" "}
                <Tooltip text="Every version tried counts toward the luck check, whichever one looks best. Picking the best and calling it a result is what the luck check catches.">
                  <span className="lb-tip" tabIndex={0}>trials</span>
                </Tooltip>.
              </span>
              <Button size="xs" href={productUrl(`#/strategy/${encodeURIComponent(run.strategy)}`)} target="_blank" rel="noopener" iconRight="arrowUpRight">Strategy page</Button>
            </div>
            <dl className="lb-stats">
              <div><dt>Sharpe ratio</dt><dd className={benchSharpe != null ? (current.sharpe > benchSharpe ? "good" : "bad") : ""}>{tick(current.sharpe, (x) => num(x))}</dd><dd className="lb-dim">S&amp;P 500 {num(benchSharpe)}</dd></div>
              <div><dt>Per year</dt><dd>{tick(current.cagr, (x) => pct(x))}</dd><dd className="lb-dim">default {pct(run.metrics.cagr)}</dd></div>
              <div><dt>Worst fall</dt><dd>{tick(current.max_drawdown, (x) => pct(x))}</dd><dd className="lb-dim">default {pct(run.metrics.max_drawdown)}</dd></div>
              <div><dt>Versions with positive Sharpe</dt><dd>{positive} of {variants.length}</dd><dd className="lb-dim">{pct(variants.length ? positive / variants.length : null, 0)}</dd></div>
            </dl>
            <div className="lb-box lb-chart">
              <div className="lb-box-h"><span>Growth of $1, log scale, after costs</span><span className="lb-dim">grey: S&amp;P 500</span></div>
              {current.equity?.length ? (
                <LineChart label="Growth of $1 for this version" log height={260} format={(v) => `$${v.toFixed(2)}`}
                  series={[
                    { name: nameOf(run), color: colors[run.strategy], points: current.equity, emphasis: true },
                    ...(bench ? [{ name: "S&P 500", color: colors[bench.strategy], points: bench.equity }] : []),
                  ]} />
              ) : <div className="lb-msg lb-chart-empty">No growth line kept for this version</div>}
            </div>
            <div className="lb-box lb-flush">
              <div className="lb-box-h"><span>All {variants.length} versions</span><span className="lb-dim">click a row to load it</span></div>
              <div className="lb-table-wrap">
                <table className="lb-table ui-stagger-rows">
                  <thead><tr>{keys.map((k) => <th key={k} className="l mono">{k}</th>)}<th>Sharpe</th><th>Per year</th><th>Worst fall</th></tr></thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={i} className={`click ${v === current ? "on" : ""}`} onClick={() => setVariant(v)}>
                        {keys.map((k, j) => (
                          <td key={k} className="l mono">{j === 0 ? <button type="button" className="lb-rowbtn" onClick={(e) => { e.stopPropagation(); setVariant(v); }} aria-pressed={v === current}>{String(v.params[k])}</button> : String(v.params[k])}</td>
                        ))}
                        <td className={v.sharpe > 0 ? "good" : "bad"}>{num(v.sharpe)}</td><td>{pct(v.cagr)}</td><td>{pct(v.max_drawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
