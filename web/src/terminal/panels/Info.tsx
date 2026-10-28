// NEWS, KPI and HELP.
import { useMemo } from "react";
import { moveText, zText } from "../../lib/news";
import { nameOf, taglineOf } from "../../lib/strategyMeta";
import type { StrategyRun } from "../../lib/types";
import { useAsOf, useLoad, useTerm } from "../context";
import { getNews } from "../data";
import { fmtNum, fmtPct, tone } from "../fmt";
import { FUNCTIONS, HONEST } from "../functions";
import { WORKSPACES } from "../layout";
import { Empty, Loading, TTable, type TCol } from "../tui";
import { MotionControl, MotionHelp } from "../../ui/motionSetting";

// ---------- NEWS ----------

const ago = (iso: string) => {
  const m = (Date.now() - Date.parse(iso)) / 60000;
  if (!Number.isFinite(m)) return "";
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

export function NewsPanel() {
  const t = useTerm();
  const news = useLoad(getNews);
  const doc = news.status === "ok" ? news.data : null;
  useAsOf(doc?.prices_through ?? doc?.generated_at?.slice(0, 10));
  const rows = useMemo(() => (doc ? [...doc.articles].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 120) : []), [doc]);
  if (news.status === "loading") return <Loading what="Loading headlines" />;
  if (news.status !== "ok") return <Empty title={news.status === "missing" ? "No headlines yet" : "Could not load headlines"}>{news.message}</Empty>;
  if (!rows.length) return <Empty title="No headlines">The news export is empty.</Empty>;
  return (
    <div className="term-scroll">
      <ul className="term-news">
        {rows.map((a) => {
          const imp = a.primary ? a.impacts?.[a.primary] : null;
          const mv = imp?.["1d"] ?? imp?.["1h"] ?? null;
          const s = a.primary ? t.find(a.primary) : null;
          return (
            <li key={a.id}>
              <span className="term-news-time" title={a.published_at}>{ago(a.published_at)}</span>
              <span className="term-news-src">{a.publisher || a.source}</span>
              <a className="term-news-title" href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
              {imp && mv && (
                <button type="button" className="term-news-move" disabled={!s} onClick={() => s && t.run(s.short)}
                  title={`${imp.label} over the following day${s ? ": open its detail" : ""}`}>
                  <b>{a.primary}</b> <span className={tone(mv.move)}>{moveText(mv.move, imp.unit)}</span> <span className="muted">{zText(mv.z)}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- KPI ----------

export function KpiPanel() {
  const t = useTerm();
  const rep = t.report;
  useAsOf(rep.status === "ok" ? rep.data.generated_at?.slice(0, 10) : null);
  if (rep.status === "loading") return <Loading what="Loading strategy results" />;
  if (rep.status !== "ok") return <Empty title={rep.status === "missing" ? "No strategy results yet" : "Could not load results"}>{rep.message}</Empty>;
  const m = (r: StrategyRun) => r.metrics;
  const cols: TCol<StrategyRun>[] = [
    { key: "name", label: "Strategy", align: "left", sort: (r) => nameOf(r), render: (r) => <span className="term-name strong" title={taglineOf(r) || r.summary}>{nameOf(r)}{r.is_benchmark ? <span className="term-tag">BENCH</span> : null}</span> },
    { key: "sharpe", label: "Sharpe", sort: (r) => m(r).sharpe, render: (r) => fmtNum(m(r).sharpe, 2), title: "Return per unit of risk, per year" },
    { key: "cagr", label: "CAGR", sort: (r) => m(r).cagr, render: (r) => <span className={tone(m(r).cagr)}>{fmtPct(m(r).cagr, 1, true)}</span>, title: "Growth per year", className: "c-n3" },
    { key: "dd", label: "Worst fall", sort: (r) => m(r).max_drawdown, render: (r) => <span className="down">{fmtPct(m(r).max_drawdown, 1)}</span>, title: "Largest fall from a peak", className: "c-n2" },
    { key: "dsr", label: "Luck check", sort: (r) => m(r).deflated_sharpe, render: (r) => fmtPct(m(r).deflated_sharpe, 0), title: "Deflated Sharpe: the chance the Sharpe is not luck, after counting every trial", className: "c-vol" },
    { key: "verdict", label: "Verdict", align: "left", sort: (r) => r.gauntlet?.verdict ?? null, render: (r) => <span className={`term-verdict ${r.gauntlet?.passed === r.gauntlet?.total && r.gauntlet ? "up" : ""}`}>{r.gauntlet?.verdict ?? "n/a"}</span>, className: "c-label" },
    { key: "tests", label: "Tests", sort: (r) => (r.gauntlet ? r.gauntlet.passed / Math.max(1, r.gauntlet.total) : null), render: (r) => (r.gauntlet ? `${r.gauntlet.passed}/${r.gauntlet.total}` : "n/a"), className: "c-m1" },
  ];
  return (
    <div className="term-col">
      <div className="term-bar"><span className="term-bar-note">{rep.data.runs.length} strategies · {rep.data.n_trials} trials counted · click to link · past data</span></div>
      <TTable rows={rep.data.runs} cols={cols} rowKey={(r) => r.strategy} initial={{ key: "sharpe", dir: "desc" }}
        onPick={(r) => t.setLink({ strategy: r.strategy })} picked={t.link.strategy} caption="Strategy KPIs" />
    </div>
  );
}

// ---------- HELP ----------

const KEYS: [string, string][] = [
  ["/  or  Ctrl+K", "Focus the command bar"],
  ["Enter", "Run the command in the focused panel"],
  ["Shift+Enter", "Run it in a new panel"],
  ["Up / Down", "Choose a suggestion; Up on an empty bar walks the history"],
  ["Tab", "Complete the suggestion"],
  ["Esc", "Leave the command bar; restore a maximised panel"],
  ["F1", "This help"],
  ["Ctrl+1 to 6  or  F2 to F7", "Switch workspace"],
  ["Ctrl+Arrow", "Move between panels"],
  ["Arrow keys on a divider", "Resize panels (Shift for bigger steps); double-click resets"],
  ["Up / Down in a table", "Move between rows; Enter links the row"],
];

export function HelpPanel() {
  const t = useTerm();
  useAsOf(t.index.status === "ok" ? t.index.data.data_through : null);
  return (
    <div className="term-scroll term-help">
      <p className="term-honest"><b>{HONEST}.</b> Every chart and number here comes from past prices. The simulations replay or reshuffle that history. Nothing here is investment advice.</p>
      <h3>Functions</h3>
      <table className="term-table">
        <caption className="sr-only">Function codes</caption>
        <tbody>
          {FUNCTIONS.map((f) => (
            <tr key={f.code} className="pick" tabIndex={0} onClick={() => t.run(f.code)} onKeyDown={(e) => { if (e.key === "Enter") t.run(f.code); }}>
              <td className="l"><span className="term-sym">{f.code}</span></td>
              <td className="l muted">{f.args ?? ""}</td>
              <td className="l">{f.title}</td>
              <td className="l muted c-label">{f.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Or type a series code or name (EUR, BRENT, UST10Y, VIX) to open its detail, and a strategy name to select it. <code>EUR CMP JPY</code> works too.</p>
      <h3>Keys</h3>
      <dl className="term-keys">
        {KEYS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}
      </dl>
      <h3>Workspaces</h3>
      <p className="muted">{WORKSPACES.map((w, i) => `F${i + 2} ${w.label}`).join(" · ")}. Changes are saved in this browser per workspace; RESET puts the preset back.</p>
      <h3>Linking</h3>
      <p className="muted">Clicking a row, a tile or a country selects it everywhere: detail and compare panels follow the linked series unless their link button is off.</p>
      <h3>Motion</h3>
      <div className="term-motion"><MotionControl /><MotionHelp className="muted" /></div>
    </div>
  );
}
