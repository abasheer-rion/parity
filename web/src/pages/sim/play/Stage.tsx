// The stage every Sim World tab plays on (DEC-0020), in the strategy race's shape: a big
// date, a "leading:" line, Play and the speed, the visual beside a leaderboard that
// re-ranks as time moves, and a timeline with event bands to click and replay.
import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { Button, FilterChip, Segmented } from "../../../ui";
import { useWidth } from "../shared";
import { SPEEDS, type Playback, type Speed } from "./usePlayback";

export interface Band { label: string; a: number; b: number; title?: string }

export function Stage({ pb, eyebrow, big, sub, leading, controls, visual, board, bands = [], startLabel, endLabel, valueText, honest, below, label }: {
  pb: Playback;
  eyebrow: ReactNode;
  /** The big ticker: a month and year, or "Day 21". */
  big: string;
  sub?: ReactNode[];
  leading?: { label: string; color: string } | null;
  controls?: ReactNode;
  visual: ReactNode;
  board: ReactNode;
  /** Event bands (date timelines) or markers (a = b) on the timeline, in frame numbers. */
  bands?: Band[];
  startLabel: string;
  endLabel: string;
  valueText: (k: number) => string;
  /** One honest line under the stage: what this is and what it is not. */
  honest: ReactNode;
  below?: ReactNode;
  label: string;
}) {
  const inside = bands.find((b) => b.b > b.a && pb.i >= b.a && pb.i <= b.b);
  return (
    <section className="sw-race pb-stage" aria-label={label}>
      <div className="sw-race-top">
        <div className="pb-ticker">
          <div className="sw-eyebrow">{eyebrow}</div>
          <div className="sw-date" aria-live="off">{big}</div>
          <div className="sw-date-sub">
            {sub?.map((s, k) => <span key={k}>{k ? "· " : ""}{s}</span>)}
            {leading && <span>· leading: <span className="sw-dot" style={{ background: leading.color }} /> {leading.label}</span>}
            {inside && <span className="sw-inside">{inside.title ?? inside.label}</span>}
          </div>
        </div>
        <div className="sw-controls">
          <Button variant="primary" icon={pb.playing ? "pause" : pb.pos >= pb.end ? "restart" : "play"} onClick={pb.play}>
            {pb.playing ? "Pause" : pb.pos >= pb.end ? "Replay" : "Play"}
          </Button>
          <Segmented label="Speed" size="sm" value={pb.speed} onChange={pb.setSpeed} options={SPEEDS.map((s) => [s, s] as [Speed, string])} />
          {controls}
        </div>
      </div>

      <div className="sw-race-body pb-body">
        <div className="sw-track pb-visual">
          {visual}
          <Timeline pb={pb} bands={bands} startLabel={startLabel} endLabel={endLabel} valueText={valueText} />
        </div>
        <div className="sw-side pb-side">{board}</div>
      </div>
      <p className="pb-honest">{honest}</p>
      {below}
    </section>
  );
}

export function Timeline({ pb, bands, startLabel, endLabel, valueText }: { pb: Playback; bands: Band[]; startLabel: string; endLabel: string; valueText: (k: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>(200);
  const x = (k: number) => (pb.end ? (k / pb.end) * width : 0);
  const spans = bands.filter((b) => b.b > b.a);
  const marks = bands.filter((b) => b.b <= b.a);
  return (
    <div className="pb-timeline" ref={ref}>
      {bands.length > 0 && (
        <svg width={width} height={20} className="pb-bands" role="img" aria-label="Events on the timeline">
          {spans.map((b) => {
            const a = x(b.a), w = Math.max(3, x(b.b) - a);
            const on = pb.i >= b.a && pb.i <= b.b;
            return (
              <g key={b.label} className={`sw-band ${on ? "on" : ""}`} onClick={() => pb.playRange(b.a, b.b)}>
                <title>{`Replay ${b.title ?? b.label}`}</title>
                <rect x={a} y={10} width={w} height={8} rx={2} />
                {w > 26 || spans.length < 6 ? <text x={a + w / 2} y={8} textAnchor="middle">{b.label}</text> : null}
              </g>
            );
          })}
          {marks.map((m) => (
            <g key={m.label} className="pb-mark">
              <line x1={x(m.a)} x2={x(m.a)} y1={10} y2={20} />
              <text x={x(m.a)} y={8} textAnchor="middle">{m.label}</text>
            </g>
          ))}
        </svg>
      )}
      <input className="sw-scrub" type="range" min={0} max={pb.end} step={1} value={pb.i} aria-label="Move through time" aria-valuetext={valueText(pb.i)}
        onChange={(e) => pb.goTo(Number(e.target.value))} style={{ "--p": `${pb.end ? (pb.pos / pb.end) * 100 : 0}%` } as CSSProperties} />
      <div className="sw-scrub-ends"><span>{startLabel}</span><span>{endLabel}</span></div>
      {spans.length > 1 && (
        <div className="sw-events" aria-label="Replay an event">
          <span className="sw-mini-title">Replay</span>
          {spans.map((b) => <FilterChip key={b.label} label={b.label} active={pb.i >= b.a && pb.i <= b.b} onClick={() => pb.playRange(b.a, b.b)} />)}
        </div>
      )}
    </div>
  );
}

// ---------- the leaderboard ----------

export interface BoardRow {
  key: string;
  label: string;
  color: string;
  /** What it is ranked by, highest first. Null sorts last (no data yet). */
  sort: number | null;
  cells: [ReactNode, ReactNode, ReactNode];
  /** A reference row, drawn in italics (the US dollar, the mix). */
  bench?: boolean;
  title?: string;
}

const ROW = 32;

export function Board({ rows, headers = ["Value", "Total", "1 yr"], name = "Runner", picked, onPick, playing, caption }: {
  rows: BoardRow[]; headers?: [string, string, string]; name?: string; picked?: string | null; onPick?: (key: string) => void; playing: boolean; caption?: ReactNode;
}) {
  const standings = useMemo(() => [...rows].sort((a, b) => (b.sort ?? -Infinity) - (a.sort ?? -Infinity)), [rows]);
  // Re-rank at most every 180 ms while playing, so close neighbours swap cleanly.
  const order = useRef<{ at: number; rank: Map<string, number> } | null>(null);
  const now = performance.now();
  if (!order.current || !playing || now - order.current.at > 180 || order.current.rank.size !== rows.length || rows.some((r) => !order.current!.rank.has(r.key))) {
    order.current = { at: now, rank: new Map(standings.map((s, k) => [s.key, k])) };
  }
  const rank = order.current.rank;
  const leaderKey = standings[0]?.sort != null ? standings[0].key : null;
  return (
    <div className="pb-board">
      <div className="pb-board-head"><span>{name}</span><span>{headers[0]}</span><span>{headers[1]}</span><span>{headers[2]}</span></div>
      <div className="pb-board-scroll">
        <ol className="sw-board" style={{ height: rows.length * ROW }} aria-label="Leaderboard">
          {rows.map((r) => {
            const k = rank.get(r.key) ?? 0;
            const on = picked === r.key;
            return (
              <li key={r.key} className={`sw-row pb-row ${r.bench ? "bench" : ""} ${r.key === leaderKey ? "first" : ""} ${on ? "focus" : ""} ${r.sort == null ? "nodata" : ""}`}
                style={{ transform: `translateY(${k * ROW}px)` }}>
                <button className="pb-row-btn" onClick={() => onPick?.(r.key)} aria-pressed={on} title={r.title ?? r.label}>
                  <span className="sw-rank">{r.sort == null ? "" : k + 1}</span>
                  <span className="sw-dot" style={{ background: r.color }} />
                  <span className="sw-name">{r.label}</span>
                  <span className="sw-val">{r.cells[0]}</span>
                  <span className="sw-chg">{r.cells[1]}</span>
                  <span className="sw-chg">{r.cells[2]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {caption && <p className="pb-board-caption">{caption}</p>}
    </div>
  );
}

/** The board's leader, for the "leading:" line. */
export function leaderOf(rows: BoardRow[]): { label: string; color: string } | null {
  let best: BoardRow | null = null;
  for (const r of rows) if (r.sort != null && (!best || r.sort > (best.sort ?? -Infinity))) best = r;
  return best ? { label: best.label, color: best.color } : null;
}
