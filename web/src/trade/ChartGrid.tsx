// Parity Trade's chart area: one, two or four charts, each with its own symbol and
// timeframe, sharing the chart type and indicators. The active chart drives the order
// ticket and takes drawings (saved to the account per symbol).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog } from "../ui";
import { ProChart, type ChartType, type Drawing, type DrawTool } from "../ui/proChart";
import { TIMEFRAMES, type Timeframe } from "../lib/bars";
import { defaultParams, INDICATORS, indicatorDef, instanceLabel, type Bar, type IndicatorInstance, type IndicatorType } from "../lib/indicators";
import { digitsFor, loadBars, priceText, type Instrument, type Loadable } from "../lib/tradeData";
import { newId, table, useRows, type Row } from "../lib/userStore";
import { toast } from "../ui";
import type { Cell, Layout } from "./state";
import { LiveBadge, StaticBadge } from "../components/LiveBadge";
import type { CandleBuilder, LiveTf } from "../lib/live/candles";
import type { Signal } from "../lib/signals";
import { instrumentForKey, tfFor, tfsFor, useClosedCount, useLiveBars, useUniverse, type UniverseDoc } from "./live";
import { SignalCard, toChartMarkers, useSignals } from "./signalsUi";

interface DrawingRow extends Row { symbol: string; kind: Drawing["kind"]; points: Drawing["points"] }
export const drawingsTable = table<DrawingRow>("trade_drawings");

export function useBars(inst: Instrument | undefined, tf: Timeframe): Loadable<Bar[]> {
  const [state, setState] = useState<Loadable<Bar[]>>({ status: "loading" });
  useEffect(() => {
    if (!inst) return;
    let live = true;
    setState({ status: "loading" });
    void loadBars(inst, tf).then((r) => { if (live) setState(r); });
    return () => { live = false; };
  }, [inst, tf]);
  return state;
}

export const findInst = (list: Instrument[], key: string) => list.find((s) => s.key === key) ?? list.find((s) => s.key === "eq.US_MKT") ?? list[0];

/** The live price in a chart header, written straight to the page on each frame (no re-render per tick). */
function LivePx({ b }: { b: CandleBuilder }) {
  const px = useRef<HTMLSpanElement>(null);
  const chg = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const draw = () => {
      const last = b.bars[b.bars.length - 1], prev = b.bars[b.bars.length - 2];
      if (!last) return;
      if (px.current) px.current.textContent = priceText(last.close, digitsFor(last.close));
      if (chg.current && prev) {
        const c = (last.close / prev.close - 1) * 100;
        chg.current.textContent = `${c >= 0 ? "+" : "−"}${Math.abs(c).toFixed(2)}%`;
        chg.current.className = `cg-chg tabular ${c >= 0 ? "good" : "bad"}`;
      }
    };
    draw();
    return b.on(draw);
  }, [b]);
  return <><span ref={px} className="cg-px tabular" /><span ref={chg} className="cg-chg tabular" /></>;
}

function ChartCell({ cell, index, active, list, universe, signalsOn, type, log, indicators, tool, onActivate, onDrawn, onTf, onLtf, maximised, onMax, onUncompare }: {
  cell: Cell; index: number; active: boolean; list: Instrument[]; universe: UniverseDoc | null; signalsOn: string[]; type: ChartType; log: boolean; indicators: IndicatorInstance[];
  tool: DrawTool; onActivate: () => void; onDrawn: () => void; onTf: (tf: Timeframe) => void; onLtf: (tf: LiveTf) => void; maximised: boolean; onMax: () => void; onUncompare: () => void;
}) {
  const ext = useMemo(() => instrumentForKey(cell.symbol, universe), [cell.symbol, universe]);
  const inst = ext ?? findInst(list, cell.symbol);
  const liveRef = ext?.live;
  const ltf: LiveTf = liveRef ? tfFor(liveRef.src, cell.ltf) : "1m";
  const liveState = useLiveBars(liveRef, ltf);
  const builder = liveState.status === "ok" ? liveState.data : null;
  const bars = useBars(ext ? undefined : inst, cell.tf);
  const cmpInst = cell.cmp && !ext ? list.find((s) => s.key === cell.cmp && s.key !== inst?.key) : undefined;
  const cmpBars = useBars(cmpInst, cell.tf);
  const compare = useMemo(() => (cmpInst && cmpBars.status === "ok" ? { label: cmpInst.short || cmpInst.label, bars: cmpBars.data } : null), [cmpInst, cmpBars]);
  const drawings = useRows(drawingsTable, "trade_drawings", { symbol: inst?.key ?? "" });
  const saved: Drawing[] = useMemo(() => drawings.rows.map((r) => ({ id: r.id, kind: r.kind, points: r.points })), [drawings.rows]);
  const onDraw = useCallback((d: Omit<Drawing, "id">) => {
    if (!inst) return;
    drawingsTable.insert({ symbol: inst.key, kind: d.kind, points: d.points }).catch((e: Error) => toast(e.message, { tone: "bad" }));
    onDrawn();
  }, [inst, onDrawn]);
  const closed = useClosedCount(builder);
  const data = builder ? builder.bars : bars.status === "ok" ? bars.data : null;
  const sigs = useSignals(data, builder ? closed : data?.length ?? 0, signalsOn);
  const markers = useMemo(() => toChartMarkers(sigs), [sigs]);
  const [picked, setPicked] = useState<Signal | null>(null);
  const onMarker = useCallback((id: string) => setPicked(sigs.find((s) => s.id === id) ?? null), [sigs]);
  const ok = !!data && !!inst;
  const hasVolume = ok && data.some((b) => b.volume != null);
  const shown = useMemo(() => indicators.filter((i) => !indicatorDef(i.type).needsVolume || hasVolume), [indicators, hasVolume]);
  const last = !builder && data ? data[data.length - 1] : null;
  const prev = !builder && data ? data[data.length - 2] : null;
  const chg = last && prev ? (last.close / prev.close - 1) * 100 : null;
  const missing = liveRef ? liveState.status === "error" || (builder && !builder.bars.length && false) : ext?.stock ? true : bars.status === "missing" || bars.status === "error";

  return (
    <section className={`cg-cell ${active ? "on" : ""}`} aria-label={`Chart ${index + 1}: ${inst?.short ?? ""}`} onPointerDown={onActivate}>
      <header className="cg-head" onDoubleClick={onMax}>
        <button type="button" className="cg-sym" onClick={onActivate} aria-pressed={active}>{inst?.short || inst?.label || "n/a"}</button>
        <span className="cg-name">{inst?.label}</span>
        {cmpInst && <span className="cg-cmp">vs {cmpInst.short}<button type="button" onClick={onUncompare} aria-label={`Stop comparing with ${cmpInst.short}`}>×</button></span>}
        {builder ? <LivePx b={builder} /> : <>
          <span className="cg-px tabular">{last ? priceText(last.close, digitsFor(last.close)) : ""}</span>
          <span className={`cg-chg tabular ${chg == null ? "" : chg >= 0 ? "good" : "bad"}`}>{chg == null ? "" : `${chg >= 0 ? "+" : "−"}${Math.abs(chg).toFixed(2)}%`}</span>
        </>}
        <span className="cg-tfs" role="radiogroup" aria-label="Timeframe">
          {liveRef
            ? tfsFor(liveRef.src).map((t) => <button key={t.id} type="button" role="radio" aria-checked={ltf === t.id} className={ltf === t.id ? "on" : ""} onClick={() => onLtf(t.id)}>{t.label}</button>)
            : TIMEFRAMES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={cell.tf === t.id} className={cell.tf === t.id ? "on" : ""} onClick={() => onTf(t.id)}>{t.label}</button>)}
        </span>
        {liveRef?.src === "coingecko" && <a className="cg-attr" href="https://www.coingecko.com/" target="_blank" rel="noreferrer">Data provided by CoinGecko</a>}
        {liveRef ? <LiveBadge src={liveRef.src} compact={!active} />
          : ext?.stock ? <StaticBadge feed="eod" source="No licensed feed" asOf={null} compact={!active} />
          : inst ? <StaticBadge feed="eod" source={inst.source} asOf={inst.asof || null} compact={!active} /> : null}
        <button type="button" className="cg-max" onClick={onMax} title={maximised ? "Restore (Alt+Enter)" : "Maximise (Alt+Enter)"} aria-label={maximised ? "Restore chart" : "Maximise chart"}>
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">{maximised ? <><rect x="2.6" y="0.6" width="7.8" height="7.8" /><path d="M0.6 2.6v7.8h7.8" /></> : <rect x="0.6" y="0.6" width="9.8" height="9.8" />}</svg>
        </button>
      </header>
      <div className="cg-body">
        {ok && inst ? (
          <ProChart fill bare bars={data} live={builder} viewKey={`${inst.key}:${builder ? ltf : cell.tf}`} label={inst.short || inst.label} type={type} indicators={shown} log={log} compare={compare}
            drawings={saved} tool={active ? tool : "none"} onDraw={onDraw} height={440} paneHeight={110} digits={digitsFor(data[data.length - 1]?.close ?? inst.last)}
            markers={markers} onMarker={onMarker} />
        ) : missing ? (
          <div className="cg-msg">{ext?.stock ? "No licensed price feed for single stocks yet" : "No data"}</div>
        ) : (
          <div className="cg-msg cg-loading" aria-label="Loading chart" />
        )}
      </div>
      <SignalCard signal={picked} symbol={inst?.short ?? ""} onClose={() => setPicked(null)} />
    </section>
  );
}

export function ChartGrid({ list, layout, set, tool, setTool }: {
  list: Instrument[]; layout: Layout; set: (f: (l: Layout) => Layout) => void; tool: DrawTool; setTool: (t: DrawTool) => void;
}) {
  // The stock list (for names) loads only when a chart shows a stock.
  const universe = useUniverse(layout.cells.some((c) => c.symbol.startsWith("S:")));
  const n = layout.max != null ? 1 : layout.grid;
  const idx = layout.max != null ? [layout.max] : Array.from({ length: layout.grid }, (_, i) => i);
  const onDrawn = useCallback(() => setTool("none"), [setTool]);
  return (
    <div className={`cg cg-${n}`}>
      {idx.map((i) => (
        <ChartCell key={i} index={i} cell={layout.cells[i]} active={layout.active === i} list={list} universe={universe} signalsOn={layout.signals} type={layout.type} log={layout.log} indicators={layout.indicators}
          tool={tool} onDrawn={onDrawn} maximised={layout.max === i}
          onActivate={() => { if (layout.active !== i) set((l) => ({ ...l, active: i })); }}
          onTf={(tf) => set((l) => ({ ...l, cells: l.cells.map((c, j) => (j === i ? { ...c, tf } : c)) }))}
          onLtf={(ltf) => set((l) => ({ ...l, cells: l.cells.map((c, j) => (j === i ? { ...c, ltf } : c)) }))}
          onMax={() => set((l) => ({ ...l, active: i, max: l.max === i ? null : i }))}
          onUncompare={() => set((l) => ({ ...l, cells: l.cells.map((c, j) => (j === i ? { symbol: c.symbol, tf: c.tf, ...(c.ltf ? { ltf: c.ltf } : {}) } : c)) }))} />
      ))}
    </div>
  );
}

export function IndicatorDialog({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: IndicatorInstance[]; onChange: (v: IndicatorInstance[]) => void }) {
  const add = (type: IndicatorType) => onChange([...value, { id: newId(), type, params: defaultParams(type) }]);
  const set = (id: string, key: string, v: number) => onChange(value.map((i) => (i.id === id ? { ...i, params: { ...i.params, [key]: v } } : i)));
  return (
    <Dialog open={open} onClose={onClose} title="Indicators" width={560} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="ind">
        {value.map((i) => {
          const def = indicatorDef(i.type);
          return (
            <div key={i.id} className="ind-row">
              <strong>{instanceLabel(i)}</strong>
              {def.params.map((p) => (
                <label key={p.key} className="ind-param"><span>{p.label}</span>
                  <input className="ot-input" type="number" min={p.min} max={p.max} step={p.step ?? 1} value={i.params[p.key] ?? p.value}
                    onChange={(e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x >= p.min && x <= p.max) set(i.id, p.key, x); }} />
                </label>
              ))}
              <button type="button" className="ind-x" aria-label={`Remove ${instanceLabel(i)}`} onClick={() => onChange(value.filter((x) => x.id !== i.id))}>×</button>
            </div>
          );
        })}
        <div className="ind-add" role="group" aria-label="Add indicator">
          {INDICATORS.map((d) => <button key={d.type} type="button" onClick={() => add(d.type)} title={d.what}>{d.label}</button>)}
        </div>
      </div>
    </Dialog>
  );
}
