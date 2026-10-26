// Screener (DEC-0033): filter the instruments by asset class and a few indicator
// conditions. Each series is loaded once, six at a time. The table is sorted by name;
// it filters and never ranks markets by return.
import { useEffect, useMemo, useState } from "react";
import { FilterBar, FilterChip, Select } from "../ui";
import { CLASS_LABEL, CLASS_ORDER, loadBars, priceText, type Instrument } from "../lib/tradeData";
import { TTable, type TCol } from "./TTable";
import { activeCount, EMPTY_FILTER, passes, runPool, screenMetrics, type ScreenFilter, type ScreenMetrics, type Side } from "../lib/screener";
import { readPref, writePref } from "./shared";
import { chgText } from "./WatchlistsView";

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
    <fieldset className="sc-range">
      <legend>{label}</legend>
      <input className="ot-input" type="number" aria-label={`${label}, from`} value={lo == null ? "" : String(lo)} onChange={(e) => onLo(num(e.target.value))} placeholder="Min" />
      <input className="ot-input" type="number" aria-label={`${label}, to`} value={hi == null ? "" : String(hi)} onChange={(e) => onHi(num(e.target.value))} placeholder="Max" />
    </fieldset>
  );
}

export function ScreenerView({ list, onSymbol }: { list: Instrument[]; onSymbol: (k: string) => void }) {
  const { done, metrics } = useMetrics(list);
  const [f, setF] = useState<ScreenFilter>(() => readPref("screener", EMPTY_FILTER));
  const set = (p: Partial<ScreenFilter>) => setF((old) => { const next = { ...old, ...p }; writePref("screener", next); return next; });
  const classes = CLASS_ORDER.filter((c) => list.some((s) => s.class === c));

  const rows: Row[] = useMemo(() => (metrics ? list.flatMap((inst) => {
    const m = metrics.get(inst.key);
    return m && passes({ class: inst.class, m1: inst.chg.m1, ytd: inst.chg.ytd, m }, f) ? [{ inst, m }] : [];
  }) : []), [list, metrics, f]);

  const vs = (r: Row, avg: number | null) => { const v = pctOf(r.m.close, avg); return v == null ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`; };
  const cols: TCol<Row>[] = [
    { key: "name", head: "Symbol", align: "left", width: 100, sort: (r) => r.inst.short, cell: (r) => <strong>{r.inst.short}</strong> },
    { wide: true, key: "label", head: "Name", align: "left", sort: (r) => r.inst.label, cell: (r) => <span className="tt-dim">{r.inst.label}</span> },
    { wide: true, key: "class", head: "Class", align: "left", sort: (r) => CLASS_ORDER.indexOf(r.inst.class), cell: (r) => <span className="tt-dim">{CLASS_LABEL[r.inst.class] ?? r.inst.class}</span> },
    { key: "last", head: "Last", sort: (r) => r.m.close, cell: (r) => priceText(r.m.close) },
    { key: "rsi", head: "RSI14", sort: (r) => r.m.rsi14, cell: (r) => fmtN(r.m.rsi14) },
    { key: "s50", head: "vs SMA50", sort: (r) => pctOf(r.m.close, r.m.sma50), tone: (r) => pctOf(r.m.close, r.m.sma50), cell: (r) => vs(r, r.m.sma50) },
    { key: "s200", head: "vs SMA200", sort: (r) => pctOf(r.m.close, r.m.sma200), tone: (r) => pctOf(r.m.close, r.m.sma200), cell: (r) => vs(r, r.m.sma200) },
    { key: "m1", head: "1M", sort: (r) => r.inst.chg.m1, tone: (r) => r.inst.chg.m1, cell: (r) => chgText(r.inst, r.inst.chg.m1) },
    { key: "ytd", head: "YTD", sort: (r) => r.inst.chg.ytd, tone: (r) => r.inst.chg.ytd, cell: (r) => chgText(r.inst, r.inst.chg.ytd) },
    { wide: true, key: "high", head: "From 1Y high", sort: (r) => r.m.fromHigh, cell: (r) => (r.m.fromHigh == null ? "n/a" : r.m.fromHigh === 0 ? "0.0%" : `−${Math.abs(r.m.fromHigh * 100).toFixed(1)}%`) },
    { key: "adx", head: "ADX14", sort: (r) => r.m.adx14, cell: (r) => fmtN(r.m.adx14) },
    { wide: true, key: "freq", head: "Bars", align: "left", sort: (r) => r.inst.freq, cell: (r) => <span className="tt-dim">{FREQ[r.inst.freq] ?? r.inst.freq}</span> },
  ];

  const sideOptions: [Side, string][] = [["any", "Any"], ["above", "Above"], ["below", "Below"]];
  const numField = (label: string, v: number | null, on: (x: number | null) => void) => (
    <label className="ot-field"><span>{label}</span><input className="ot-input" type="number" value={v == null ? "" : String(v)} onChange={(e) => on(num(e.target.value))} placeholder="Any" /></label>
  );
  return (
    <div className="view">
      <FilterBar count={activeCount(f)} onReset={() => set(EMPTY_FILTER)}>
        {classes.map((c) => (
          <FilterChip key={c} label={CLASS_LABEL[c] ?? c} active={f.classes.includes(c)}
            onClick={() => set({ classes: f.classes.includes(c) ? f.classes.filter((x) => x !== c) : [...f.classes, c] })}
            onRemove={() => set({ classes: f.classes.filter((x) => x !== c) })} />
        ))}
      </FilterBar>
      <div className="sc-filters">
        <RangeField label="RSI14" lo={f.rsiMin} hi={f.rsiMax} onLo={(v) => set({ rsiMin: v })} onHi={(v) => set({ rsiMax: v })} />
        <label className="ot-field"><span>vs SMA50</span><Select label="Close vs SMA50" value={f.sma50} onChange={(v) => set({ sma50: v })} options={sideOptions} /></label>
        <label className="ot-field"><span>vs SMA200</span><Select label="Close vs SMA200" value={f.sma200} onChange={(v) => set({ sma200: v })} options={sideOptions} /></label>
        <RangeField label="1M %" lo={f.m1Min} hi={f.m1Max} onLo={(v) => set({ m1Min: v })} onHi={(v) => set({ m1Max: v })} />
        <RangeField label="YTD %" lo={f.ytdMin} hi={f.ytdMax} onLo={(v) => set({ ytdMin: v })} onHi={(v) => set({ ytdMax: v })} />
        {numField("Within % of 1Y high", f.nearHigh, (v) => set({ nearHigh: v }))}
        {numField("ADX14 min", f.adxMin, (v) => set({ adxMin: v }))}
      </div>
      <div className="vdim sc-count" aria-live="polite">{metrics ? `${rows.length} / ${list.length}` : `Loading ${done} / ${list.length}`}</div>
      <section className="vbox vbox-fill" aria-label="Screener results">
        <TTable<Row> label="Screener results" rows={rows} cols={cols} rowKey={(r) => r.inst.key} initial={{ key: "name", dir: "asc" }} onRow={(r) => onSymbol(r.inst.key)}
          empty={metrics ? "No matches" : "Loading"} />
      </section>
    </div>
  );
}
