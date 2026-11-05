// Card 1's picture: the win rate a record needs at each payoff ratio, with the record as a
// point (REF-0016). Above the curve makes money, below it loses.
import { breakEvenAt } from "../../../lib/verify/checks";
import { explain } from "../../../lib/verify/explain";
import { Tooltip } from "../../../ui";
import { pct } from "./format";

/**
 * Card 1's chart: the break-even curve (win rate needed at each payoff ratio) on a log
 * scale, with the record as a point. Above the curve makes money, below it loses.
 */
export function BreakEvenChart({ winRate, payoff }: { winRate: number; payoff: number | null }) {
  const W = 360, H = 200, L = 40, R = 12, T = 12, B = 30;
  const p = payoff && payoff > 0 ? payoff : null;
  const lo = Math.min(0.2, p ? p / 3 : 0.2), hi = Math.max(5, p ? p * 3 : 5);
  const lx = (v: number) => L + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (W - L - R);
  const ly = (w: number) => T + (1 - w) * (H - T - B);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const v = 10 ** (Math.log10(lo) + (i / 60) * (Math.log10(hi) - Math.log10(lo)));
    pts.push(`${lx(v).toFixed(1)},${ly(breakEvenAt(v)).toFixed(1)}`);
  }
  const curve = `M${pts.join("L")}`;
  const above = `${curve}L${W - R},${T}L${L},${T}Z`;
  const below = `${curve}L${W - R},${H - B}L${L},${H - B}Z`;
  const ticks = [0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter((v) => v >= lo * 0.999 && v <= hi * 1.001);
  const label = p ? `Win rate ${pct(winRate)} at a payoff ratio of ${p.toFixed(2)}, against ${pct(breakEvenAt(p))} needed to break even.` : "No payoff ratio: the record has no losing or no winning results.";
  return (
    <figure className="vf-chart">
      <Tooltip text={explain("chart")}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} tabIndex={0} className="vf-num" data-explain={explain("chart")}>
          <path d={above} className="vf-zone-good" />
          <path d={below} className="vf-zone-bad" />
          {[0, 0.25, 0.5, 0.75, 1].map((w) => (
            <g key={w}>
              <line x1={L} x2={W - R} y1={ly(w)} y2={ly(w)} className="vf-grid" />
              <text x={L - 6} y={ly(w) + 3} textAnchor="end" className="vf-axis">{`${w * 100}%`}</text>
            </g>
          ))}
          {ticks.map((v) => <text key={v} x={lx(v)} y={H - B + 14} textAnchor="middle" className="vf-axis">{v}</text>)}
          <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" className="vf-axis">Payoff ratio (average win / average loss)</text>
          <path d={curve} className="vf-curve" />
          <text x={W - R - 4} y={T + 12} textAnchor="end" className="vf-zone-label">makes money</text>
          <text x={L + 6} y={H - B - 6} className="vf-zone-label">loses money</text>
          {p && <circle cx={lx(Math.min(Math.max(p, lo), hi))} cy={ly(winRate)} r={5} className={winRate >= breakEvenAt(p) ? "vf-dot-good" : "vf-dot-bad"} />}
        </svg>
      </Tooltip>
      <figcaption className="vf-small">{label}</figcaption>
    </figure>
  );
}

