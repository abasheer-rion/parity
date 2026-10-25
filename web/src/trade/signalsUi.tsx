// Strategy signals in Parity Trade (DEC-0049): a toggle per strategy, markers on the chart,
// and a card for each marker with the rule that fired and that strategy's verdict from the
// 11 tests (REF-0006) in the latest research report.
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "../ui";
import { loadReport } from "../lib/data";
import { RULES, ruleById, signals, type Signal } from "../lib/signals";
import type { Gauntlet } from "../lib/types";
import type { ChartMarker } from "../ui/proChart";

let verdictsP: Promise<Map<string, Gauntlet | null>> | null = null;
/** Each strategy's 11-test result from the latest report, loaded once. */
export function useVerdicts(on = true): Map<string, Gauntlet | null> | null {
  const [v, setV] = useState<Map<string, Gauntlet | null> | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    verdictsP ??= loadReport().then((r) => new Map(r.runs.map((x) => [x.strategy, x.gauntlet] as const))).catch(() => { verdictsP = null; return new Map(); });
    void verdictsP.then((m) => { if (live) setV(m); });
    return () => { live = false; };
  }, [on]);
  return v;
}

export const verdictText = (g: Gauntlet | null | undefined) =>
  g ? `${g.passed} of ${g.total} tests passed${g.beats_sp500 ? ", beats the S&P 500" : ", does not beat the S&P 500"}` : "Not in the latest report";

/** Markers for the enabled rules over the finished bars only. */
export function useSignals(bars: { time: string; close: number }[] | null, closed: number, enabled: string[]): Signal[] {
  return useMemo(() => {
    if (!bars?.length || !enabled.length) return [];
    return enabled.flatMap((id) => { const r = ruleById(id); return r ? signals(r, bars, Math.min(closed, bars.length)) : []; });
    // closed changes when a bar finishes; bars is mutated in place for live charts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, closed, enabled.join(",")]);
}

export function toChartMarkers(list: Signal[]): ChartMarker[] {
  return list.map((s) => ({ id: s.id, time: s.time, side: s.action, text: s.rule.short }));
}

const ACTION: Record<Signal["action"], string> = { buy: "Buy", sell: "Sell", exit: "Exit" };
const MARKET: Record<string, string> = { fx: "currencies", stocks: "US stocks", commodities: "oil" };

/** The toggles, one per strategy that can be drawn on one chart. */
export function SignalsMenu({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const verdicts = useVerdicts();
  const on = new Set(value);
  return (
    <div className="sgm" role="group" aria-label="Strategy signals">
      {RULES.map((r) => (
        <label key={r.id} className="sgm-row">
          <input type="checkbox" checked={on.has(r.id)} onChange={(e) => onChange(e.target.checked ? [...value, r.id] : value.filter((x) => x !== r.id))} />
          <span className="sgm-name">{r.name}</span>
          <span className="sgm-tag">{r.short}</span>
          <span className="sgm-v tabular">{verdicts ? (verdicts.get(r.id) ? `${verdicts.get(r.id)!.passed}/${verdicts.get(r.id)!.total}` : "n/a") : ""}</span>
        </label>
      ))}
      <p className="sgm-note">Rules from tested strategies, checked at each finished bar. Strategies that rank many markets or need macro data are not drawn.</p>
    </div>
  );
}

/** What a clicked marker means. */
export function SignalCard({ signal, symbol, onClose }: { signal: Signal | null; symbol: string; onClose: () => void }) {
  const verdicts = useVerdicts(!!signal);
  const g = signal ? verdicts?.get(signal.rule.id) : null;
  return (
    <Dialog open={!!signal} onClose={onClose} title={signal ? `${ACTION[signal.action]}: ${signal.rule.name}` : ""} width={440}>
      {signal && (
        <dl className="sgc">
          <div><dt>Symbol</dt><dd>{symbol}</dd></div>
          <div><dt>Bar</dt><dd className="tabular">{signal.time.replace("T", " ").replace(":00Z", " UTC")}</dd></div>
          <div><dt>Close</dt><dd className="tabular">{signal.close}</dd></div>
          <div className="sgc-wide"><dt>Rule</dt><dd>{signal.why}</dd></div>
          <div><dt>Tested on</dt><dd>{MARKET[signal.rule.tested]}{signal.rule.longOnly ? ", long or cash" : ""}</dd></div>
          <div><dt>11 tests</dt><dd>{verdicts ? verdictText(g) : "Loading"}</dd></div>
          {g?.verdict && <div className="sgc-wide"><dt>Verdict</dt><dd>{g.verdict}</dd></div>}
          <div className="sgc-wide sgc-note"><dd>Shown on this chart's own bars, with no costs or sizing. A signal uses only prices up to its bar's close.</dd></div>
        </dl>
      )}
    </Dialog>
  );
}
