// A race of any weekly series through a window, on the shared stage: lines that draw in,
// a leaderboard of value, change since the start and change over a year, and an
// optional visual above the lines (a map, a yield curve). Most replay tabs are this.
import { useMemo, useState, type ReactNode } from "react";
import type { WorldData } from "../../../lib/world";
import { RaceLines, type Lane } from "./RaceLines";
import { Board, leaderOf, Stage, type BoardRow } from "./Stage";
import { agoIndex, at, crisisBands, dayMonthYear, monthYear, pct, rebase, tone, weekly, yearTicks } from "./data";
import { usePlayback, WEEKLY } from "./usePlayback";
import { useWidth } from "../shared";

export interface RaceItem { key: string; label: string; color: string; note?: string; dashed?: boolean; bench?: boolean;
  /** Values on the weekly dates, when not a series in the file (a rate gap, a mix). */
  values?: (number | null)[] }

export function SeriesRace({ data, items, a, b, mode, valueFmt, eyebrow, honest, name = "Runner", controls, above, below, focus: focusIn, onFocus, unitLabel, initialFocus }: {
  data: WorldData;
  items: RaceItem[];
  /** First and last weekly frame of the window. */
  a: number; b: number;
  /** growth: every line starts at 100 (log scale); level: raw values such as yields or rate gaps (linear). */
  mode: "growth" | "level";
  /** The Value column, given the raw value and, in growth mode, the value rebased to 100. */
  valueFmt: (v: number, key: string, rebased: number | null) => string;
  eyebrow: ReactNode;
  honest: ReactNode;
  name?: string;
  controls?: ReactNode;
  /** Drawn above the lines, given the weekly frame shown and the focused key. */
  above?: (k: number, focus: string | null) => ReactNode;
  below?: (k: number, focus: string | null) => ReactNode;
  focus?: string | null;
  onFocus?: (key: string | null) => void;
  /** For level mode: the unit of a change, " pts" or " bp". */
  unitLabel?: string;
  initialFocus?: string;
}) {
  const dates = data.weekly.dates;
  const span = useMemo(() => dates.slice(a, b + 1), [dates, a, b]);
  const pb = usePlayback(span.length, WEEKLY, `${a}-${b}-${items.map((x) => x.key).join(",")}`);
  const [ownFocus, setOwnFocus] = useState<string | null>(initialFocus ?? null);
  const focus = focusIn !== undefined ? focusIn : ownFocus;
  const setFocus = (k: string | null) => (onFocus ? onFocus(k) : setOwnFocus(k));

  const raw = useMemo(() => Object.fromEntries(items.map((it) => [it.key, it.values ?? weekly(data, it.key)])), [data, items]);
  const lanes: Lane[] = useMemo(() => items.map((it) => ({
    key: it.key, label: it.label, color: it.color, dashed: it.dashed,
    values: mode === "growth" ? rebase(raw[it.key], a, b) : raw[it.key].slice(a, b + 1),
  })), [items, raw, a, b, mode]);

  const k = a + pb.i;
  const ago = agoIndex(dates, k);
  const rows: BoardRow[] = items.map((it, n) => {
    const lane = lanes[n];
    const v = at(raw[it.key], k);
    const first = lane.values.find((x) => x != null) ?? null;
    const now = at(lane.values, pb.i);
    const yAgo = ago >= 0 ? at(raw[it.key], ago) : null;
    const total = now == null || first == null ? null : mode === "growth" ? now - 100 : now - first;
    const year = v == null || yAgo == null ? null : mode === "growth" ? (yAgo > 0 ? (v / yAgo - 1) * 100 : null) : v - yAgo;
    const pts = (x: number | null) => (x == null ? "n/a" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(unitLabel === " bp" ? 0 : 2)}`);
    return {
      key: it.key, label: it.label, color: it.color, bench: it.bench, title: it.note ?? it.label,
      sort: mode === "growth" ? now : v,
      cells: [
        v == null ? <span className="muted">n/a</span> : valueFmt(v, it.key, now),
        <span className={tone(total)}>{mode === "growth" ? pct(total, 0) : pts(total)}</span>,
        <span className={tone(year)}>{mode === "growth" ? pct(year, 0) : pts(year)}</span>,
      ],
    };
  });

  const [ref, width] = useWidth<HTMLDivElement>(240);
  const ticks = useMemo(() => yearTicks(span, width), [span, width]);
  const bands = useMemo(() => crisisBands(span), [span]);
  const date = span[pb.i] ?? "";
  const weeks = pb.i;
  const elapsed = weeks < 104 ? `${weeks} week${weeks === 1 ? "" : "s"} in` : `${(weeks / 52.18).toFixed(1)} years in`;
  const growthFmt = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v >= 10 ? v.toFixed(0) : v.toFixed(1));

  return (
    <Stage pb={pb} label="Replay" eyebrow={eyebrow} big={monthYear(date)} sub={[dayMonthYear(date), weeks === 0 ? "the starting line" : elapsed]}
      leading={leaderOf(rows)} controls={controls} bands={bands}
      startLabel={monthYear(span[0] ?? "")} endLabel={monthYear(span[span.length - 1] ?? "")} valueText={(i) => dayMonthYear(span[i] ?? "")}
      honest={honest}
      visual={
        <div ref={ref}>
          {above?.(k, focus)}
          <RaceLines lanes={lanes} pos={pb.pos} end={pb.end} focus={focus} log={mode === "growth"} baseline={mode === "growth" ? 100 : 0}
            format={mode === "growth" ? growthFmt : (v) => v.toFixed(Math.abs(v) < 10 ? 1 : 0)} xTicks={ticks} bands={bands}
            label={mode === "growth" ? "Growth of 100 from the start of the window, log scale" : "Levels through the window"} />
        </div>
      }
      board={<Board rows={rows} name={name} picked={focus} onPick={(key) => setFocus(focus === key ? null : key)} playing={pb.playing}
        headers={["Value", "Since start", "1 yr"]}
        caption={mode === "growth" ? "Since start: change from the first week of the window. Click a row to follow it." : `Since start and 1 yr are changes in the level${unitLabel === " pts" ? ", in percentage points" : unitLabel === " bp" ? ", in basis points" : ""}. Click a row to follow it.`} />}
      below={below?.(k, focus)}
    />
  );
}

/** Last weekly frame where at least half of `keys` have a value (currencies arrive a few days after commodities). */
export function lastCommon(data: WorldData, keys: string[]): number {
  const s = keys.map((key) => weekly(data, key));
  let last = data.weekly.dates.length - 1;
  while (last > 0 && s.filter((v) => v[last] != null).length < Math.max(1, s.length / 2)) last--;
  return last;
}

