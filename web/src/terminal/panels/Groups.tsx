// COT (net futures positioning) and ECO (macro, rates, credit, inflation): a table of the
// series in that family and a chart of the selected one.
import { useMemo } from "react";
import { useAsOf, useOpt, useTerm } from "../context";
import type { TermIndex, TermSeries } from "../data";
import { fmtChg, fmtLast, fmtNum, tone } from "../fmt";
import { Empty, fmtAxis, Loading, PctBar, RANGES, Seg, sliceRange, Spark, TChart, TTable, type Range, type TCol } from "../tui";
import { groupLabel, ordered, Select, usePick, WithIndex } from "./common";
import { usePoints } from "./Detail";

const isEco = (ix: TermIndex) => {
  const extra = new Set(ix.groups.filter((g) => /credit|inflation|rates|macro/i.test(`${g.id} ${g.label}`)).map((g) => g.id));
  return (s: TermSeries) => s.class === "macro" || s.class === "rates" || extra.has(s.group);
};

export function CotPanel() {
  return <WithIndex>{(ix) => <Family ix={ix} pick={(s) => s.class === "positioning"} kind="cot" />}</WithIndex>;
}

export function EcoPanel() {
  return <WithIndex>{(ix) => <Family ix={ix} pick={isEco(ix)} kind="eco" />}</WithIndex>;
}

function Family({ ix, pick: test, kind }: { ix: TermIndex; pick: (s: TermSeries) => boolean; kind: "cot" | "eco" }) {
  const t = useTerm();
  const pick = usePick();
  const [group, setGroup] = useOpt("group", "all");
  const [range, setRange] = useOpt("range", "5Y");
  const all = useMemo(() => ordered(ix).filter(test), [ix, test]);
  const gl = useMemo(() => groupLabel(ix), [ix]);
  const groups = [...new Set(all.map((s) => s.group))];
  const rows = group === "all" ? all : all.filter((s) => s.group === group);
  const sel = rows.find((s) => s.key === t.link.series) ?? rows[0] ?? null;
  useAsOf(sel?.asof ?? ix.data_through);
  const pts = usePoints(sel);
  const shown = useMemo(() => (pts.status === "ok" ? sliceRange(pts.data, range as Range) : []), [pts, range]);

  if (!all.length) {
    return kind === "cot"
      ? <Empty title="No positioning data yet">The export has no CFTC positioning series. They appear here once the engine adds them.</Empty>
      : <Empty title="No macro data yet">The export has no macro, rates, credit or inflation series yet.</Empty>;
  }
  const cols: TCol<TermSeries>[] = [
    { key: "short", label: "Ticker", align: "left", sort: (s) => s.short, render: (s) => <span className="term-sym">{s.short}</span> },
    { key: "label", label: "Name", align: "left", sort: (s) => s.label, render: (s) => <span className="term-name" title={`${s.label} · ${s.unit}`}>{s.label}</span>, className: "c-label" },
    { key: "last", label: kind === "cot" ? "Net" : "Last", sort: (s) => s.last, render: (s) => fmtLast(s.last) },
    { key: "w1", label: kind === "cot" ? "1W" : "Prev", sort: (s) => s.chg?.w1, render: (s) => <span className={tone(s.chg?.w1)}>{fmtChg(s.chg?.w1, s.kind)}</span>, title: "Change over a week (or since the previous release for monthly data)" },
    { key: "m1", label: "1M", sort: (s) => s.chg?.m1, render: (s) => <span className={tone(s.chg?.m1)}>{fmtChg(s.chg?.m1, s.kind)}</span>, className: "c-m1" },
    { key: "z", label: "Z", sort: (s) => (s.z == null ? null : Math.abs(s.z)), render: (s) => <span className={tone(s.z)}>{fmtNum(s.z, 1, true)}</span>, className: "c-vol" },
    { key: "pct", label: "1Y %ile", sort: (s) => s.pct1y, render: (s) => <PctBar value={s.pct1y} />, className: "c-pct" },
    { key: "spark", label: "1Y", render: (s) => <Spark values={s.spark} />, className: "c-spark" },
  ];
  return (
    <div className="term-col">
      <div className="term-bar">
        {groups.length > 1 && <Select label="Group" value={group} onChange={setGroup} options={[["all", "All groups"], ...groups.map((g): [string, string] => [g, gl(g)])]} />}
        <span className="term-bar-note">{rows.length} series{sel ? ` · ${sel.short}: ${sel.unit}` : ""}</span>
        <span className="term-bar-fill" />
        <Seg label="Range" value={range as Range} onChange={setRange} options={RANGES.map((r) => [r, r])} />
      </div>
      <div className="term-split">
        <div className="term-split-chart">
          {!sel ? null : pts.status === "loading" ? <Loading what={`Loading ${sel.short}`} />
            : pts.status !== "ok" ? <Empty title="No history file">{pts.message}</Empty>
            : <TChart series={[{ name: `${sel.short} ${kind === "cot" ? "net" : ""}`.trim(), color: kind === "cot" ? "var(--t-cyan)" : "var(--t-amber)", points: shown }]} format={fmtAxis} zero={kind === "cot"} label={`${sel.label}, ${range}`} area />}
        </div>
        <TTable rows={rows} cols={cols} rowKey={(s) => s.key} onPick={pick} picked={sel?.key} caption={kind === "cot" ? "Net positioning" : "Macro series"} />
      </div>
    </div>
  );
}
