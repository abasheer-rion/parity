// Strategies: forward tests on the demo account (DEC-0034). Attach a strategy from the
// latest research report (or an MCP draft spec) and follow its out-of-sample curve from
// that day next to what the backtest promised. The nightly run extends it by itself.
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, LineChart, Segmented, Select, toast } from "../ui";
import { loadReport } from "../lib/data";
import type { Report, StrategyRun } from "../lib/types";
import { nameById, nameOf } from "../lib/strategyMeta";
import { attachStrategy, detachStrategy, type AccountRow } from "../lib/paper/account";
import { forwardView, parseDraftSpec } from "../lib/paper/forward";
import type { Stats } from "../lib/paper/stats";
import { fmt } from "../ui/text";
import { AccountBar } from "./PortfolioView";
import { useDemo } from "./demo";

const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
/** Today in the viewer's own time zone, as YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString("en-CA");

let reportP: Promise<Report> | null = null;
function useReport(on: boolean): { report: Report | null; error: string | null } {
  const [state, setState] = useState<{ report: Report | null; error: string | null }>({ report: null, error: null });
  useEffect(() => {
    if (!on) return;
    let live = true;
    reportP ??= loadReport();
    reportP.then((r) => { if (live) setState({ report: r, error: null }); }, (e: Error) => { reportP = null; if (live) setState({ report: null, error: e.message }); });
    return () => { live = false; };
  }, [on]);
  return state;
}

function StatList({ s, label, forward }: { s: Stats; label: string; forward?: boolean }) {
  return (
    <dl className="pnl" aria-label={label}>
      <div><dt>Return</dt><dd className="tabular">{fmt.signedPct(s.total_return)}</dd></div>
      {!forward && <div><dt>CAGR</dt><dd className="tabular">{fmt.signedPct(s.cagr)}</dd></div>}
      <div><dt>Sharpe</dt><dd className="tabular">{fmt.num(s.sharpe)}</dd></div>
      <div><dt>Max DD</dt><dd className="tabular">{fmt.pct(s.max_drawdown)}</dd></div>
      <div><dt>Periods</dt><dd className="tabular">{s.periods}</dd></div>
    </dl>
  );
}

export function StrategiesView() {
  const d = useDemo();
  const account = d.account;
  const attached = !!account?.strategy_source;
  const [open, setOpen] = useState(false);
  const { report, error } = useReport(attached || open);
  const run = attached && report ? report.runs.find((r) => r.strategy === account?.strategy_key) ?? null : null;
  const view = useMemo(() => (run && account?.strategy_start && account.strategy_capital ? forwardView(run, account.strategy_start, Number(account.strategy_capital)) : null), [run, account?.strategy_start, account?.strategy_capital]);

  return (
    <div className="view">
      <AccountBar />
      <section className="vbox" aria-label="Forward test">
        <div className="vh-row">
          <h2 className="vh">{attached ? (run ? nameOf(run) : account?.strategy_name) : "Forward test"}</h2>
          {attached && <span className="vtag">{account?.strategy_source === "draft" && !run ? "Draft, waiting" : "Live"}</span>}
          {attached && <span className="vdim">from {account?.strategy_start} · {usd0(Number(account?.strategy_capital))}</span>}
          <span className="vbar-gap" />
          {account && (attached
            ? <Button size="sm" variant="tertiary" onClick={() => detachStrategy(account).catch((e: Error) => toast(e.message, { tone: "bad" }))}>Detach</Button>
            : <Button size="sm" icon="plus" onClick={() => setOpen(true)}>Attach strategy</Button>)}
        </div>
        {!attached && <div className="vbox-empty">No strategy attached</div>}
        {attached && error && <div className="vbox-empty">{error}</div>}
        {attached && !report && !error && <div className="vbox-empty">Loading</div>}
        {attached && report && !run && <div className="vbox-empty">{account?.strategy_source === "draft" ? "Not in the nightly run yet" : `Missing from the latest run: ${account?.strategy_key ? nameById(account.strategy_key) : "this strategy"}`}</div>}
        {view && (
          <>
            <LineChart label="Backtest and forward test" height={260} format={usd0} series={[
              { name: "Backtest", color: "var(--series-1)", points: view.backtest.slice(-260) },
              ...(view.forward.length ? [{ name: "Forward", color: "var(--series-2)", points: view.forward, emphasis: true }] : []),
            ]} />
            <div className="vcols">
              <div><h3 className="vh3">Backtest</h3><StatList s={view.promise} label="Backtest" /></div>
              <div><h3 className="vh3">Forward</h3>{view.forward.length > 1 ? <StatList s={view.so_far} label="Forward" forward /> : <div className="vdim">No forward periods yet</div>}</div>
            </div>
          </>
        )}
      </section>
      {account && <AttachDialog open={open} onClose={() => setOpen(false)} account={account} runs={report?.runs ?? null} error={error} />}
    </div>
  );
}

function AttachDialog({ open, onClose, account, runs, error }: { open: boolean; onClose: () => void; account: AccountRow; runs: StrategyRun[] | null; error: string | null }) {
  const [mode, setMode] = useState<"report" | "draft">("report");
  const [key, setKey] = useState("");
  const [start, setStart] = useState(today());
  const [capital, setCapital] = useState(String(account.starting_cash ?? 100000));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => (runs ?? []).map((r) => [r.strategy, nameOf(r)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1])), [runs]);
  const chosen = key || options[0]?.[0] || "";
  const draft = mode === "draft" && text.trim() ? parseDraftSpec(text) : null;
  const cap = Number(capital);
  const problem = start < today() ? "Start date cannot be in the past"
    : !(cap > 0) ? "Enter capital"
    : mode === "report" ? (chosen ? null : runs ? "No strategies in the report" : "Loading")
    : !draft ? "Paste a spec" : "error" in draft ? draft.error : null;

  const attach = async () => {
    if (problem) return;
    setBusy(true);
    try {
      if (mode === "report") {
        const r = runs!.find((x) => x.strategy === chosen)!;
        await attachStrategy(account, { source: "report", key: r.strategy, name: nameOf(r), spec: null, start, capital: cap });
      } else if (draft && !("error" in draft)) {
        const known = draft.name && runs?.find((x) => x.strategy === draft.name);
        await attachStrategy(account, { source: "draft", key: known ? known.strategy : draft.name, name: draft.name ?? `Draft ${String(draft.spec.kind)} spec`, spec: draft.spec, start, capital: cap });
      }
      toast("Attached");
      onClose();
    } catch (e) {
      toast((e as Error).message, { tone: "bad" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Attach strategy" width={520}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!problem || busy} loading={busy} onClick={attach}>Attach</Button></>}>
      <Segmented size="sm" label="Source" value={mode} onChange={setMode} options={[["report", "Research report"], ["draft", "MCP draft"]]} />
      <div className="dlg-fields">
        {mode === "report" ? (
          error ? <p className="bad small">{error}</p> : (
            <label className="ot-field"><span>Strategy</span>
              {runs ? <Select label="Strategy" value={chosen} onChange={setKey} options={options} /> : <span className="vdim">Loading</span>}
            </label>
          )
        ) : (
          <label className="ot-field"><span>Spec (JSON)</span>
            <textarea className="ot-input ot-area" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
              placeholder='{"kind": "trend", "universe": "g10", "lookback": 126}' />
          </label>
        )}
        <div className="ot-grid">
          <label className="ot-field"><span>Start</span>
            <input className="ot-input" type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="ot-field"><span>Capital ($)</span>
            <input className="ot-input" type="number" min="1" step="any" value={capital} onChange={(e) => setCapital(e.target.value)} /></label>
        </div>
        <p className="ot-problem">{problem ?? ""}</p>
      </div>
    </Dialog>
  );
}
