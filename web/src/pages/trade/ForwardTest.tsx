// Strategy forward testing on a demo account (DEC-0033): attach a strategy from the
// latest research report (or paste an MCP draft spec), and watch its out-of-sample curve
// from that day, next to what the backtest promised. The research nightly run reruns
// every strategy on new data each night, so the forward part grows by itself.
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, LineChart, Segmented, Select, toast } from "../../ui";
import { loadReport } from "../../lib/data";
import type { Report, StrategyRun } from "../../lib/types";
import { nameOf } from "../../lib/strategyMeta";
import { attachStrategy, detachStrategy, type AccountRow } from "../../lib/paper/account";
import { forwardView, parseDraftSpec } from "../../lib/paper/forward";
import type { Stats } from "../../lib/paper/stats";
import { fmt } from "../../ui/text";
import { Skeleton } from "../../ui/skeleton";

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
    <dl className="pt-kv" aria-label={label}>
      <div><dt>{forward ? "Return so far" : "Total return"}</dt><dd className="tabular">{fmt.signedPct(s.total_return)}</dd></div>
      {!forward && <div><dt>Yearly growth (CAGR)</dt><dd className="tabular">{fmt.signedPct(s.cagr)}</dd></div>}
      <div><dt>Sharpe</dt><dd className="tabular">{fmt.num(s.sharpe)}</dd></div>
      <div><dt>Max drawdown</dt><dd className="tabular">{fmt.pct(s.max_drawdown)}</dd></div>
    </dl>
  );
}

export function ForwardTest({ account }: { account: AccountRow }) {
  const attached = !!account.strategy_source;
  const [open, setOpen] = useState(false);
  const { report, error } = useReport(attached || open);
  const run = attached && report ? report.runs.find((r) => r.strategy === account.strategy_key) ?? null : null;
  const view = useMemo(() => (run && account.strategy_start && account.strategy_capital ? forwardView(run, account.strategy_start, Number(account.strategy_capital)) : null), [run, account.strategy_start, account.strategy_capital]);
  const per = view?.periods_per_year === 52 ? "week" : view?.periods_per_year === 12 ? "month" : "day";

  return (
    <section className="mcard pt-forward" aria-label="Strategy forward test">
      <div className="mcard-head">
        <h2>Strategy forward test</h2>
        {attached
          ? <Button size="sm" variant="tertiary" onClick={() => detachStrategy(account).catch((e: Error) => toast(e.message, { tone: "bad" }))}>Detach</Button>
          : <Button size="sm" icon="plus" onClick={() => setOpen(true)}>Attach a strategy</Button>}
      </div>
      {!attached && (
        <p className="muted">
          Attach one of the tested strategies, or a draft spec from the MCP server, to this demo account. From the start date on, its curve is
          out-of-sample: days the strategy had never seen. That is the honest complement to a backtest. The research nightly run reruns every strategy
          on new data each night with its code frozen, so the forward curve grows by itself.
        </p>
      )}
      {attached && (
        <>
          <p className="pt-forward-head">
            <strong>{account.strategy_name}</strong>{" "}
            <Badge tone={account.strategy_source === "draft" && !run ? "neutral" : "accent"}>{account.strategy_source === "draft" && !run ? "Draft, waiting" : "Forward testing"}</Badge>
            <span className="muted small"> Start {account.strategy_start}, capital {usd0(Number(account.strategy_capital))}, attached {account.strategy_attached_at?.slice(0, 10)}.</span>
          </p>
          {error && <div className="mk-banner" role="note"><strong>No research report.</strong> {error}</div>}
          {!report && !error && <Skeleton height={260} />}
          {report && !run && account.strategy_source === "draft" && (
            <div className="mk-banner" role="note">
              <span><strong>This draft is not in the nightly run yet.</strong> It will be forward tested once it is registered as a strategy and included in the
              research nightly run. Until then there are no numbers to show, and we do not estimate any.</span>
            </div>
          )}
          {report && !run && account.strategy_source === "report" && (
            <div className="mk-banner" role="note"><strong>Not in the latest report.</strong> The strategy {account.strategy_key} is missing from the newest research run.</div>
          )}
          {view && (
            <>
              <LineChart label="Backtest and forward test" height={260} format={usd0} series={[
                { name: "Backtest, before the start (in-sample)", color: "var(--series-1)", points: view.backtest.slice(-260) },
                ...(view.forward.length ? [{ name: "Forward test (out-of-sample)", color: "var(--series-2)", points: view.forward, emphasis: true }] : []),
              ]} />
              <div className="pt-forward-grid">
                <div>
                  <h3 className="tr-sub">What the backtest promised</h3>
                  <StatList s={view.promise} label="Backtest before the start date" />
                  <p className="muted small">From {view.backtest[0]?.[0]} to the start date, scaled to end at your capital. The chart shows its last five years.</p>
                </div>
                <div>
                  <h3 className="tr-sub">Forward test so far</h3>
                  {view.forward.length > 1 ? (
                    <>
                      <StatList s={view.so_far} label="Forward test since the start date" forward />
                      <p className="muted small">{view.so_far.periods} {per}s out-of-sample. Worth now {usd0(view.forward[view.forward.length - 1][1])}.</p>
                    </>
                  ) : (
                    <p className="muted">No out-of-sample days yet. The research nightly run adds the newest data each night; check back after it runs.</p>
                  )}
                </div>
              </div>
              <p className="muted small">
                Out-of-sample forward testing: everything after the start date was unknown when the strategy was attached. The curve comes from the research
                report, one point per {per}, so the first forward {per} can include a few days before the start. Sharpe uses the engine's formula with{" "}
                {view.periods_per_year} {per}s a year. A short forward test says little; a result needs months or years before it means much.
              </p>
            </>
          )}
        </>
      )}
      <AttachDialog open={open} onClose={() => setOpen(false)} account={account} runs={report?.runs ?? null} error={error} />
    </section>
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
  const problem = start < today() ? "The start date cannot be in the past: days already seen would not be out-of-sample."
    : !(cap > 0) ? "Enter the capital to scale the curve to."
    : mode === "report" ? (chosen ? null : runs ? "No strategies in the report." : "Loading strategies")
    : !draft ? "Paste a draft spec." : "error" in draft ? draft.error : null;

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
      toast("Strategy attached for forward testing");
      onClose();
    } catch (e) {
      toast((e as Error).message, { tone: "bad" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Attach a strategy" width={600}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!problem || busy} loading={busy} onClick={attach}>Attach</Button></>}>
      <Segmented label="Where the strategy comes from" value={mode} onChange={setMode} options={[["report", "Research report"], ["draft", "MCP draft spec"]]} />
      <div className="pt-attach">
        {mode === "report" ? (
          error ? <p className="bad small">{error}</p> : (
            <label className="ui-field"><span className="ui-field-label">Strategy</span>
              {runs ? <Select label="Strategy" value={chosen} onChange={setKey} options={options} /> : <Skeleton height={32} />}
            </label>
          )
        ) : (
          <label className="ui-field"><span className="ui-field-label">Draft spec (JSON from the MCP server)</span>
            <textarea className="ui-input pt-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
              placeholder='{"kind": "trend", "universe": "g10", "lookback": 126, "skip": 0, "rebalance": "M", "long_only": false}' />
            <span className="muted small">A draft is stored as it is. It is forward tested once it is registered and included in the nightly run; until then we show no numbers.</span>
          </label>
        )}
        <div className="pt-fields">
          <label className="ui-field pt-field"><span className="ui-field-label">Start date</span>
            <input className="ui-input" type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" /></label>
          <label className="ui-field pt-field"><span className="ui-field-label">Capital ($)</span>
            <input className="ui-input" type="number" min="1" step="any" value={capital} onChange={(e) => setCapital(e.target.value)} aria-label="Capital" /></label>
        </div>
        <p className={`small ${problem ? "bad" : "muted"}`}>{problem ?? "The forward curve starts at this capital on the start date. Demo money only."}</p>
      </div>
    </Dialog>
  );
}
