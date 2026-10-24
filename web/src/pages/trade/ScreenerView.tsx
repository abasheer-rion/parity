// Screener (DEC-0032): filter the instruments by asset class and a few indicator
// conditions. Each series is loaded once, six at a time. The table is sorted by name;
// it filters and never ranks markets by return.
import { useEffect, useMemo, useState } from "react";
import { DataTable, FilterBar, FilterChip, Input, Select, type Column } from "../../ui";
import { SkeletonTable } from "../../ui/skeleton";
import { CLASS_LABEL, CLASS_ORDER, loadBars, priceText, type Instrument } from "../../lib/tradeData";
import { activeCount, EMPTY_FILTER, passes, runPool, screenMetrics, type ScreenFilter, type ScreenMetrics, type Side } from "../../lib/screener";
import { readPref, writePref } from "./shared";
import { Change } from "./WatchlistsView";

interface Row { inst: Instrument; m: ScreenMetrics }

let cache: Map<string, ScreenMetrics> | null = null;

function useMetrics(list: Instrument[]) {
  const [done, setDone] = useState(cache ? list.length : 0);
  const [metrics, setMetrics] = useState<Map<string, ScreenMetrics> | null>(cache);
  useEffect(() => {
    if (cache || !list.length) return;
    let live = true;
    void runPool(list, 6, async (inst) => {
      const r = await loadBars(inst, "D");
      return [inst.key, screenMetrics(r.status === "ok" ? r.data : [])] as const;
    }, (d) => { if (live) setDone(d); }).then((pairs) => {
      cache = new Map(pairs);
      if (live) setMetrics(cache);
    });
    return () => { live = false; };
  }, [list]);
  return { done, metrics };
}

const num = (s: string): number | null => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
const fmtN = (v: number | null, d = 1) => (v == null ? "n/a" : v.toFixed(d));
const pctOf = (close: number | null, avg: number | null) => (close == null || avg == null || avg === 0 ? null : (close / avg - 1) * 100);
const FREQ: Record<string, string> = { D: "Daily", W: "Weekly", M: "Monthly", Q: "Quarterly" };

function RangeField({ label, lo, hi, onLo, onHi }: { label: string; lo: number | null; hi: number | null; onLo: (v: number | null) => void; onHi: (v: number | null) => void }) {
  return (
    <fieldset className="tr-range">
      <legend className="ui-field-label">{label}</legend>
      <input className="ui-input" type="number" aria-label={`${label}, from`} value={lo == null ? "" : String(lo)} onChange={(e) => onLo(num(e.target.value))} placeholder="From" />
      <input className="ui-input" type="number" aria-label={`${label}, to`} value={hi == null ? "" : String(hi)} onChange={(e) => onHi(num(e.target.value))} placeholder="To" />
    </fieldset>
  );
}

export function ScreenerView({ list }: { list: Instrument[] }) {
  const { done, metrics } = useMetrics(list);
  const [f, setF] = useState<ScreenFilter>(() => readPref("screener", EMPTY_FILTER));
  const set = (p: Partial<ScreenFilter>) => setF((old) => { const next = { ...old, ...p }; writePref("screener", next); return next; });
  const classes = CLASS_ORDER.filter((c) => list.some((s) => s.class === c));

  const rows: Row[] = useMemo(() => (metrics ? list.flatMap((inst) => {
    const m = metrics.get(inst.key);
    return m && passes({ class: inst.class, m1: inst.chg.m1, ytd: inst.chg.ytd, m }, f) ? [{ inst, m }] : [];
  }) : []), [list, metrics, f]);

  const columns: Column<Row>[] = [
    { key: "name", header: "Name", align: "left", sort: (r) => r.inst.short, render: (r) => <span className="tr-name"><strong>{r.inst.short}</strong><span className="muted small">{r.inst.label}</span></span> },
    { key: "class", header: "Class", align: "left", sort: (r) => CLASS_ORDER.indexOf(r.inst.class), render: (r) => <span className="small">{CLASS_LABEL[r.inst.class] ?? r.inst.class}</span> },
    { key: "last", header: "Last", sort: (r) => r.m.close, render: (r) => priceText(r.m.close) },
    { key: "rsi", header: "RSI(14)", sort: (r) => r.m.rsi14, render: (r) => fmtN(r.m.rsi14) },
    { key: "s50", header: "vs SMA 50", sort: (r) => pctOf(r.m.close, r.m.sma50), tone: (r) => pctOf(r.m.close, r.m.sma50), render: (r) => { const v = pctOf(r.m.close, r.m.sma50); return v == null ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`; } },
    { key: "s200", header: "vs SMA 200", sort: (r) => pctOf(r.m.close, r.m.sma200), tone: (r) => pctOf(r.m.close, r.m.sma200), render: (r) => { const v = pctOf(r.m.close, r.m.sma200); return v == null ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`; } },
    { key: "m1", header: "1M", sort: (r) => r.inst.chg.m1, render: (r) => <Change inst={r.inst} v={r.inst.chg.m1} /> },
    { key: "ytd", header: "YTD", sort: (r) => r.inst.chg.ytd, render: (r) => <Change inst={r.inst} v={r.inst.chg.ytd} /> },
    { key: "high", header: "From 1y high", sort: (r) => r.m.fromHigh, render: (r) => (r.m.fromHigh == null ? "n/a" : r.m.fromHigh === 0 ? "At high" : `−${Math.abs(r.m.fromHigh * 100).toFixed(1)}%`) },
    { key: "adx", header: "ADX(14)", sort: (r) => r.m.adx14, render: (r) => fmtN(r.m.adx14) },
    { key: "freq", header: "Bars", align: "left", sort: (r) => r.inst.freq, render: (r) => <span className="small muted">{FREQ[r.inst.freq] ?? r.inst.freq}</span> },
  ];

  const sideOptions: [Side, string][] = [["any", "Any"], ["above", "Close above"], ["below", "Close below"]];
  return (
    <>
      <FilterBar count={activeCount(f)} onReset={() => set(EMPTY_FILTER)}>
        {classes.map((c) => (
          <FilterChip key={c} label={CLASS_LABEL[c] ?? c} active={f.classes.includes(c)}
            onClick={() => set({ classes: f.classes.includes(c) ? f.classes.filter((x) => x !== c) : [...f.classes, c] })}
            onRemove={() => set({ classes: f.classes.filter((x) => x !== c) })} />
        ))}
      </FilterBar>
      <div className="tr-filters">
        <RangeField label="RSI(14)" lo={f.rsiMin} hi={f.rsiMax} onLo={(v) => set({ rsiMin: v })} onHi={(v) => set({ rsiMax: v })} />
        <label className="ui-field"><span className="ui-field-label">50-bar average</span><Select label="50-bar average" value={f.sma50} onChange={(v) => set({ sma50: v })} options={sideOptions} /></label>
        <label className="ui-field"><span className="ui-field-label">200-bar average</span><Select label="200-bar average" value={f.sma200} onChange={(v) => set({ sma200: v })} options={sideOptions} /></label>
        <RangeField label="1M change" lo={f.m1Min} hi={f.m1Max} onLo={(v) => set({ m1Min: v })} onHi={(v) => set({ m1Max: v })} />
        <RangeField label="YTD change" lo={f.ytdMin} hi={f.ytdMax} onLo={(v) => set({ ytdMin: v })} onHi={(v) => set({ ytdMax: v })} />
        <Input type="number" label="Within % of 1y high" value={f.nearHigh == null ? "" : String(f.nearHigh)} onChange={(v) => set({ nearHigh: num(v) })} placeholder="Any" />
        <Input type="number" label="ADX(14) at least" value={f.adxMin == null ? "" : String(f.adxMin)} onChange={(v) => set({ adxMin: num(v) })} placeholder="Any" />
      </div>
      <p className="muted small">Changes are in percent for prices and in points for rates and other levels. Measures use each series' own bars: daily for most, monthly for real exchange rates and some interest rates. Daily bars are built from closes, so ADX reads trend from closing prices only. All values are delayed. Sorted by name: this filters, it does not rank or recommend.</p>
      <p className="small tr-progress" aria-live="polite">
        {metrics ? `${rows.length} of ${list.length} instruments match.` : `Loading prices: ${done} of ${list.length} series.`}
      </p>
      {metrics ? (
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.inst.key} initialSort={{ key: "name", dir: "asc" }} href={(r) => `#/trade?s=${encodeURIComponent(r.inst.key)}`}
          empty="Nothing matches these filters. Loosen one or press Reset." caption="Screener results" />
      ) : (
        <SkeletonTable rows={Math.max(1, list.filter((s) => !f.classes.length || f.classes.includes(s.class)).length)} cols={8} label="Loading the screener" />
      )}
    </>
  );
}
