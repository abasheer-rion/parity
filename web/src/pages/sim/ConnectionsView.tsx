// Connections: how closely major markets moved together, as a heat map of rolling
// correlations of weekly returns that plays through time. In a crisis, the squares often
// light up together.
import { useMemo, useState } from "react";
import { Segmented } from "../../ui";
import type { WorldData } from "../../lib/world";
import { useWidth } from "./shared";
import { WindowSelect } from "./play/Controls";
import { agoIndex, colorAt, crisisBands, dayMonthYear, monthYear, tone, weekly, windowRange } from "./play/data";
import { lastCommon } from "./play/SeriesRace";
import { Board, leaderOf, Stage, type BoardRow } from "./play/Stage";
import { usePlayback, WEEKLY } from "./play/usePlayback";

const ASSETS: { key: string; short: string }[] = [
  { key: "stocks", short: "US stocks" }, { key: "bonds10", short: "10y bonds" }, { key: "oil", short: "Oil" },
  { key: "USD", short: "Dollar" }, { key: "EUR", short: "Euro" }, { key: "JPY", short: "Yen" },
  { key: "CHF", short: "Franc" }, { key: "AUD", short: "Aussie" }, { key: "MXN", short: "Peso" },
];

type Span = "26" | "52" | "104";

function rollingCorr(x: (number | null)[], y: (number | null)[], k: number, n: number): number | null {
  let c = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let j = Math.max(1, k - n + 1); j <= k; j++) {
    const a = x[j], b = y[j];
    if (a == null || b == null) continue;
    c++; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b;
  }
  if (c < n * 0.7) return null;
  const vx = sxx - (sx * sx) / c, vy = syy - (sy * sy) / c;
  return vx > 0 && vy > 0 ? (sxy - (sx * sy) / c) / Math.sqrt(vx * vy) : null;
}

export function ConnectionsView({ data, win, setWin }: { data: WorldData; win: string; setWin: (w: string) => void }) {
  const [span, setSpan] = useState<Span>("52");
  const [focus, setFocus] = useState<string | null>(null);
  const assets = ASSETS.filter((x) => data.weekly.series[x.key]);
  const last = useMemo(() => lastCommon(data, assets.map((x) => x.key)), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, win, last), [data, win, last]);
  const dates = useMemo(() => data.weekly.dates.slice(a, b + 1), [data, a, b]);
  const pb = usePlayback(dates.length, WEEKLY, `${a}-${b}-${span}`);

  // Weekly log returns, then every pair's rolling correlation for every frame of the window.
  const mats = useMemo(() => {
    const rets = assets.map((x) => {
      const v = weekly(data, x.key);
      return v.map((p, k) => (k && p != null && v[k - 1] != null && p > 0 && (v[k - 1] as number) > 0 ? Math.log(p / (v[k - 1] as number)) : null));
    });
    const n = Number(span);
    const out: (number | null)[][][] = [];
    for (let k = a; k <= b; k++) {
      const m: (number | null)[][] = assets.map(() => assets.map(() => null));
      for (let i = 0; i < assets.length; i++) {
        m[i][i] = 1;
        for (let j = i + 1; j < assets.length; j++) m[i][j] = m[j][i] = rollingCorr(rets[i], rets[j], k, n);
      }
      out.push(m);
    }
    return out;
  }, [data, a, b, span]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = mats[pb.i] ?? [];
  const ago = agoIndex(data.weekly.dates, a + pb.i) - a;
  const offDiag = m.flatMap((row, i) => row.filter((v, j) => j > i && v != null) as number[]);
  const avg = offDiag.length ? offDiag.reduce((s, v) => s + Math.abs(v), 0) / offDiag.length : null;

  const rows: BoardRow[] = assets.slice(1).map((x, n) => {
    const i = n + 1;
    const now = m[i]?.[0] ?? null;
    const first = mats.find((mm) => mm[i][0] != null)?.[i][0] ?? null;
    const yr = ago >= 0 ? mats[ago]?.[i][0] ?? null : null;
    const d = (v: number | null) => (v == null ? "n/a" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`);
    return {
      key: x.key, label: x.short, color: colorAt(n), sort: now,
      cells: [now == null ? <span className="muted">n/a</span> : now.toFixed(2),
        <span className={tone(now == null || first == null ? null : now - first)}>{d(now == null || first == null ? null : now - first)}</span>,
        <span className={tone(now == null || yr == null ? null : now - yr)}>{d(now == null || yr == null ? null : now - yr)}</span>],
    };
  });

  const bands = useMemo(() => crisisBands(dates), [dates]);
  const date = dates[pb.i] ?? "";
  return (
    <Stage pb={pb} label="Connections replay" eyebrow={`Connections · how much markets moved together over the past ${span} weeks`}
      big={monthYear(date)} sub={[dayMonthYear(date), `average link ${avg == null ? "n/a" : avg.toFixed(2)}`]}
      leading={(() => { const l = leaderOf(rows); return l ? { ...l, label: `${l.label}, most in step with US stocks` } : null; })()}
      controls={<>
        <Segmented<Span> label="Correlation window" size="sm" value={span} onChange={setSpan} options={[["26", "26w"], ["52", "52w"], ["104", "104w"]]} />
        <WindowSelect value={win} onChange={setWin} />
      </>}
      bands={bands} startLabel={monthYear(dates[0] ?? "")} endLabel={monthYear(dates[dates.length - 1] ?? "")} valueText={(i) => dayMonthYear(dates[i] ?? "")}
      honest={<>History replayed, not a forecast. Each square is the correlation of weekly returns over the past {span} weeks: +1 moved together, 0 unrelated, −1 opposite. Currencies are their value in US dollars, so the dollar index moves against them by design. A link that held for years can break.</>}
      visual={<Heat assets={assets} m={m} focus={focus} />}
      board={<Board rows={rows} name="Moves with US stocks" headers={["Now", "Since start", "1 yr"]} picked={focus} onPick={(k) => setFocus(focus === k ? null : k)} playing={pb.playing}
        caption="Ranked by correlation with US stocks. Click a row to light up its row and column." />}
    />
  );
}

function Heat({ assets, m, focus }: { assets: { key: string; short: string }[]; m: (number | null)[][]; focus: string | null }) {
  const [ref, width] = useWidth<HTMLDivElement>(240);
  const n = assets.length;
  const labelW = width < 480 ? 58 : 80;
  const cell = Math.max(18, Math.min(56, (width - labelW - 8) / n));
  const size = labelW + cell * n;
  const fi = assets.findIndex((x) => x.key === focus);
  const fill = (v: number | null) => {
    if (v == null) return "var(--map-none)";
    const t = Math.max(-1, Math.min(1, v));
    return `color-mix(in oklab, var(${t >= 0 ? "--map-up" : "--map-down"}) ${Math.round(Math.abs(t) * 100)}%, var(--map-mid))`;
  };
  return (
    <div className="pb-heat" ref={ref}>
      <svg width={size} height={labelW + cell * n} role="img" aria-label="Correlation heat map">
        {assets.map((x, j) => (
          <text key={x.key} x={labelW + j * cell + cell / 2} y={labelW - 6} className={`pb-heat-lab ${j === fi ? "on" : ""}`}
            transform={`rotate(-45 ${labelW + j * cell + cell / 2} ${labelW - 6})`}>{x.short}</text>
        ))}
        {assets.map((x, i) => (
          <g key={x.key}>
            <text x={labelW - 6} y={labelW + i * cell + cell / 2 + 4} textAnchor="end" className={`pb-heat-lab ${i === fi ? "on" : ""}`}>{x.short}</text>
            {assets.map((y, j) => {
              const v = m[i]?.[j] ?? null;
              const dim = fi >= 0 && i !== fi && j !== fi;
              return (
                <g key={y.key} opacity={dim ? 0.35 : 1}>
                  <rect x={labelW + j * cell + 1} y={labelW + i * cell + 1} width={cell - 2} height={cell - 2} rx={3} style={{ fill: fill(v) }}>
                    <title>{`${x.short} and ${y.short}: ${v == null ? "not enough data" : v.toFixed(2)}`}</title>
                  </rect>
                  {cell >= 34 && i !== j && v != null && <text x={labelW + j * cell + cell / 2} y={labelW + i * cell + cell / 2 + 4} textAnchor="middle" className="pb-heat-val">{v.toFixed(1)}</text>}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="wm-scale pb-heat-key"><span className="wm-scale-row"><span>−1 opposite</span><span className="wm-scale-bar" aria-hidden /><span>+1 together</span></span></div>
    </div>
  );
}
