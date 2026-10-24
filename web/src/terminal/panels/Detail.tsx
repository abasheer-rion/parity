// DES: one series in detail. The chart loads the series' own file; the statistics come
// from the index. It follows the linked series unless the panel is unlinked.
import { useEffect, useMemo, useState } from "react";
import type { Point } from "../../lib/types";
import { useAsOf, useOpt, usePanel, usePanelTitle, useTerm } from "../context";
import { loadSeries, type Loadable, type TermIndex, type TermSeries } from "../data";
import { fmtChg, fmtLast, fmtNum, shortDate, tone } from "../fmt";
import { Attribution, Empty, fmtAxis, Loading, PctBar, RANGES, Seg, sliceRange, TChart, type Range } from "../tui";
import { WithIndex } from "./common";

const FREQ: Record<string, string> = { D: "Daily", W: "Weekly", M: "Monthly", Q: "Quarterly" };

export function usePoints(s: TermSeries | null): Loadable<Point[]> {
  const [v, setV] = useState<Loadable<Point[]>>({ status: "loading" });
  useEffect(() => {
    if (!s) return;
    let live = true;
    setV({ status: "loading" });
    loadSeries(s).then((r) => { if (live) setV(r); });
    return () => { live = false; };
  }, [s]);
  return v;
}

export function DetailPanel() {
  return <WithIndex>{(ix) => <Detail ix={ix} />}</WithIndex>;
}

function Detail({ ix }: { ix: TermIndex }) {
  const t = useTerm();
  const p = usePanel();
  const follow = p.leaf.follow !== false;
  const s = useMemo(() => {
    const byKey = (k?: string) => (k ? ix.series.find((x) => x.key === k) ?? null : null);
    return (follow ? byKey(t.link.series) : null) ?? (p.leaf.args[0] ? t.find(p.leaf.args.join(" ")) ?? t.find(p.leaf.args[0]) : null) ?? byKey(t.link.series) ?? ix.series[0] ?? null;
  }, [ix, follow, t, p.leaf.args]);
  usePanelTitle(s ? `${s.short} · ${s.label}` : "Series detail");
  useAsOf(s?.asof ?? ix.data_through);
  if (!s) return <Empty title="No series">Type a series code in the command bar, for example EUR.</Empty>;
  return <DetailBody s={s} />;
}

function DetailBody({ s }: { s: TermSeries }) {
  const [range, setRange] = useOpt("range", "1Y");
  const pts = usePoints(s);
  const shown = useMemo(() => (pts.status === "ok" ? sliceRange(pts.data, range as Range) : []), [pts, range]);
  const rangeChg = shown.length > 1 ? (s.kind === "price" ? (shown[shown.length - 1][1] / shown[0][1] - 1) * 100 : shown[shown.length - 1][1] - shown[0][1]) : null;
  const stats: [string, React.ReactNode][] = [
    ["Last", fmtLast(s.last)],
    ["1D", <span className={tone(s.chg?.d1)}>{fmtChg(s.chg?.d1, s.kind)}</span>],
    ["1W", <span className={tone(s.chg?.w1)}>{fmtChg(s.chg?.w1, s.kind)}</span>],
    ["1M", <span className={tone(s.chg?.m1)}>{fmtChg(s.chg?.m1, s.kind)}</span>],
    ["YTD", <span className={tone(s.chg?.ytd)}>{fmtChg(s.chg?.ytd, s.kind)}</span>],
    [`${range}`, <span className={tone(rangeChg)}>{fmtChg(rangeChg, s.kind)}</span>],
    ["Vol 1Y", s.vol == null ? "n/a" : `${s.vol.toFixed(1)}%`],
    ["Z 1W", <span className={tone(s.z)}>{fmtNum(s.z, 2, true)}</span>],
    ["1Y %ile", <PctBar value={s.pct1y} />],
  ];
  return (
    <div className="term-col">
      <div className="term-bar">
        <span className="term-sym big">{s.short}</span>
        <span className="term-des-last">{fmtLast(s.last)}</span>
        <span className={`term-des-chg ${tone(s.chg?.d1)}`}>{fmtChg(s.chg?.d1, s.kind)}</span>
        <span className="term-bar-note">{s.unit}</span>
        <span className="term-bar-fill" />
        <Seg label="Range" value={range as Range} onChange={setRange} options={RANGES.map((r) => [r, r])} />
      </div>
      <div className="term-des">
        <div className="term-des-chart">
          {pts.status === "loading" ? <Loading what={`Loading ${s.short}`} />
            : pts.status !== "ok" ? <Empty title="No history file">{pts.message}</Empty>
            : <TChart series={[{ name: s.short, color: "var(--t-amber)", points: shown }]} format={fmtAxis} label={`${s.label}, ${range}`} area />}
        </div>
        <dl className="term-stats">
          {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <dl className="term-meta">
          <div><dt>Key</dt><dd>{s.key}</dd></div>
          <div><dt>Frequency</dt><dd>{FREQ[s.freq] ?? s.freq}</dd></div>
          <div><dt>First</dt><dd>{shortDate(s.first)}</dd></div>
          <div><dt>As of</dt><dd>{shortDate(s.asof)}</dd></div>
          <div><dt>Changes</dt><dd>{s.kind === "price" ? "percent" : `differences, in ${s.unit}`}</dd></div>
          <div className="wide"><dt>Source</dt><dd>{s.source}</dd></div>
          <div className="wide"><dt>Licence</dt><dd>{s.licence}</dd></div>
          {(s.attribution || s.attribution_url) && <div className="wide"><dt>Credit</dt><dd><Attribution text={s.attribution} url={s.attribution_url} /></dd></div>}
        </dl>
      </div>
    </div>
  );
}
