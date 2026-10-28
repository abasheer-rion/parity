// Strategy cards (DEC-0075): the strongest strategies by our tests, each with its last 12
// months as candles drawn by the signature chart system (DEC-0067) and a plain up or down line.
// Ordered by verdict, then the luck-adjusted Sharpe ratio, never by return alone (DEC-0015).
import { useEffect, useMemo, useRef, useState } from "react";
import { SignatureFrame, type SigVisual } from "../../ui/signature";
import { useMotionLevel } from "../../ui/motionPref";
import { Badge } from "../../ui";
import { nameOf, tagsOf, verdictOf } from "../../lib/strategyMeta";
import type { StrategyRun } from "../../lib/types";
import { monthlyCandles } from "../candles";
import type { WidgetProps } from "../Home";
import { Src } from "./common";

const ORDER: Record<string, number> = { Passed: 3, Promising: 2, "Not proven": 1 };

export default function Strategies({ report }: WidgetProps) {
  const picks = useMemo(() => report.runs.filter((r) => !r.is_benchmark && r.gauntlet && r.equity?.length > 40)
    .sort((a, b) => (ORDER[verdictOf(b).label] ?? 0) - (ORDER[verdictOf(a).label] ?? 0) || (b.metrics.deflated_sharpe ?? 0) - (a.metrics.deflated_sharpe ?? 0))
    .slice(0, 3), [report]);
  return (
    <>
      <div className="sc-grid">{picks.map((r) => <Card key={r.strategy} r={r} />)}</div>
      <Src>Backtests after trading costs, from the research run. Each candle is one month of the strategy's value. Past results do not predict future ones.</Src>
    </>
  );
}

function Card({ r }: { r: StrategyRun }) {
  const c = useMemo(() => monthlyCandles(r.equity, 12), [r.equity]);
  const name = nameOf(r);
  const visual = useMemo<SigVisual>(() => ({ kind: "candles", alt: `${name}: the last ${c.candles.length} months as candles.`, params: { candles: c.candles, labels: c.labels }, steps: [{ caption: "" }] }), [c, name]);
  const reduced = useMotionLevel() === "reduced";
  const [s, setS] = useState(reduced ? 0 : -1);
  const ref = useRef<HTMLAnchorElement>(null);
  // Draw the candles in once, when the card comes into view.
  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") { setS(0); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1200); setS(p - 1); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [reduced]);
  const v = verdictOf(r);
  const up = (c.change ?? 0) >= 0;
  const pct = c.change == null ? "n/a" : `${up ? "+" : "-"}${Math.abs(c.change * 100).toFixed(1)}%`;
  return (
    <a ref={ref} className={`sc ${up ? "is-up" : "is-down"}`} href={`#/strategy/${encodeURIComponent(r.strategy)}`}>
      <div className="sc-top">
        <span className="sc-kind">{tagsOf(r).style || tagsOf(r).family}</span>
        <Badge tone={v.tone}>{v.label}</Badge>
      </div>
      <strong className="sc-name">{name}</strong>
      <div className="sc-chart" role="img" aria-label={`${name}: ${up ? "up" : "down"} ${pct.replace(/^[+-]/, "")} over the last ${c.candles.length} months`}>
        <SignatureFrame visual={visual} s={s} size="lesson" />
      </div>
      <div className={`sc-dir ${up ? "good" : "bad"}`}>
        <span aria-hidden>{up ? "▲" : "▼"}</span> {up ? "Up" : "Down"} {pct.replace(/^[+-]/, "")} <span className="sc-sub">over the last {c.candles.length} months</span>
      </div>
      <div className="sc-stats">
        <span><b>{r.gauntlet ? `${r.gauntlet.passed} of ${r.gauntlet.total}` : "n/a"}</b> tests passed</span>
        <span><b>{r.metrics.cagr != null ? `${(r.metrics.cagr * 100).toFixed(1)}%` : "n/a"}</b> a year</span>
      </div>
    </a>
  );
}
