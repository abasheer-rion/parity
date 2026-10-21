// Market panels beside the race: the viewer picks currencies, commodities, rates,
// the VIX and more from the report's data series. Each panel follows the race date.
import { useMemo, useState } from "react";
import { Button, Delta, Dialog, Icon } from "../../ui";
import { setPrefs, usePrefs } from "../../lib/prefs";
import type { SeriesBlock } from "../../lib/types";
import { DAY, indexAtOrBefore, monthYear, t, thin } from "./shared";

const GROUPS: [string, string][] = [
  ["risk", "Fear gauge"], ["fx", "Currencies"], ["cmd", "Commodities"], ["rate", "Interest rates"],
  ["bond", "Bonds"], ["eq", "Stocks"], ["reer", "Real exchange rates"],
];

export function seriesLabel(key: string, s?: SeriesBlock): string {
  const [g, code] = key.split(".");
  if (g === "risk" && code === "VIX") return "VIX, the fear gauge";
  if (g === "fx") return `${code} against the dollar`;
  if (g === "rate") return code === "TBILL3M" ? "US 3-month T-bill" : `${code} 3-month rate`;
  if (g === "reer") return `${code} real exchange rate`;
  if (g === "bond") return "US 10-year yield";
  if (g === "cmd") return ({ WTI: "WTI crude oil", BRENT: "Brent crude oil", HH_GAS: "US natural gas", COPPER: "Copper" } as Record<string, string>)[code] ?? code;
  return s?.description.split(",")[0] ?? key;
}

function formatValue(key: string, v: number): string {
  const g = key.split(".")[0];
  if (g === "rate" || g === "bond") return `${v.toFixed(2)}%`;
  if (g === "fx") return v.toFixed(4);
  if (g === "cmd") return `$${v.toLocaleString("en-US", { maximumFractionDigits: v > 100 ? 0 : 2 })}`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function WidgetTray({ series, date, startDate, suggested }: {
  series: Record<string, SeriesBlock>; date: string; startDate: string; suggested: string[];
}) {
  const prefs = usePrefs();
  const [adding, setAdding] = useState(false);
  const chosen = prefs.simWidgets.filter((k) => series[k]);
  const toggle = (k: string) => setPrefs({ simWidgets: chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k] });

  return (
    <section className="sw-widgets" aria-label="Market panels">
      <div className="sw-widgets-head">
        <span className="sw-mini-title">Markets on {monthYear(date)}</span>
        <Button size="sm" variant="tertiary" icon="plus" onClick={() => setAdding(true)}>Add panel</Button>
      </div>
      {chosen.length === 0
        ? <p className="sw-hint">Add a panel to watch a currency, a commodity, a rate or the VIX move with the race.</p>
        : (
          <div className="sw-widget-grid">
            {chosen.map((k) => <Widget key={k} k={k} s={series[k]} date={date} startDate={startDate} onRemove={() => toggle(k)} />)}
          </div>
        )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Market panels" width={620}
        footer={<Button variant="secondary" onClick={() => setAdding(false)}>Done</Button>}>
        <p className="sw-hint">Tick what to show beside the race. Items marked "in the race" are traded by at least one runner.</p>
        <div className="sw-pick-groups">
          {GROUPS.map(([g, label]) => {
            const keys = Object.keys(series).filter((k) => k.startsWith(g + "."));
            if (!keys.length) return null;
            return (
              <div key={g} className="sw-pick-group">
                <div className="sw-mini-title">{label}</div>
                {keys.map((k) => (
                  <label key={k} className="sw-pick-row">
                    <input type="checkbox" checked={chosen.includes(k)} onChange={() => toggle(k)} />
                    <span>{seriesLabel(k, series[k])}</span>
                    {suggested.includes(k) && <span className="sw-tag">in the race</span>}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </Dialog>
    </section>
  );
}

const W = 240, H = 56;

function Widget({ k, s, date, startDate, onRemove }: { k: string; s: SeriesBlock; date: string; startDate: string; onRemove: () => void }) {
  const pts = useMemo(() => thin(s.points, 800), [s.points]);
  const dates = useMemo(() => pts.map((p) => p[0]), [pts]);
  const geo = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const [, v] of pts) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const t0 = t(startDate < pts[0][0] ? startDate : pts[0][0]), t1 = t(pts[pts.length - 1][0]);
    const x = (iso: string) => ((t(iso) - t0) / (t1 - t0 || 1)) * W;
    const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
    return { x, y, d: pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("") };
  }, [pts, startDate]);

  const i = indexAtOrBefore(dates, date);
  const v = i >= 0 ? pts[i][1] : null;
  const yearAgo = indexAtOrBefore(dates, new Date(t(date) - 365 * DAY).toISOString().slice(0, 10));
  const g = k.split(".")[0];
  const levels = g === "rate" || g === "bond";
  const change = v != null && yearAgo >= 0 ? (levels ? v - pts[yearAgo][1] : v / pts[yearAgo][1] - 1) : null;
  const cx = geo.x(date);

  return (
    <div className="sw-widget">
      <div className="sw-widget-top">
        <span className="sw-widget-name" title={s.description}>{seriesLabel(k, s)}</span>
        <button className="sw-x" aria-label={`Remove ${seriesLabel(k, s)}`} onClick={onRemove}><Icon name="close" size={11} /></button>
      </div>
      <div className="sw-widget-val">
        <span>{v == null ? "no data yet" : formatValue(k, v)}</span>
        {change != null && (levels
          ? <Delta value={change} kind="num" digits={2} label="pts, 1y" />
          : <Delta value={change} label="1y" />)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="sw-widget-chart" aria-hidden>
        <defs><clipPath id={`swc-${k.replace(".", "-")}`}><rect x={0} y={0} width={Math.max(0, cx)} height={H} /></clipPath></defs>
        <path d={geo.d} className="sw-widget-ghost" />
        <path d={geo.d} className="sw-widget-line" clipPath={`url(#swc-${k.replace(".", "-")})`} />
        <line x1={cx} x2={cx} y1={0} y2={H} className="sw-widget-now" />
      </svg>
    </div>
  );
}
