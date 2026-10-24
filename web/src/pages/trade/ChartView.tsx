// The Trade chart: pick an instrument, a timeframe and a chart type, add indicators,
// draw lines (saved to your account) and compare against a second instrument.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dialog, IconButton, Segmented, Select, Toggle, toast } from "../../ui";
import { CHART_TYPES, ProChart, type ChartType, type Drawing, type DrawTool } from "../../ui/proChart";
import { barNote, TIMEFRAMES, type Timeframe } from "../../lib/bars";
import { defaultParams, INDICATORS, indicatorDef, instanceLabel, type Bar, type IndicatorInstance, type IndicatorType } from "../../lib/indicators";
import { delayText, digitsFor, loadBars, type Instrument, type Loadable } from "../../lib/tradeData";
import { newId, table, useRows, type Row } from "../../lib/userStore";
import { Skeleton } from "../../ui/skeleton";
import { hashParam, InstrumentSelect, isSmall, readPref, setHashParam, useInstruments, writePref } from "./shared";

interface DrawingRow extends Row { symbol: string; kind: Drawing["kind"]; points: Drawing["points"] }
export const drawingsTable = table<DrawingRow>("trade_drawings");

interface Prefs { symbol: string; tf: Timeframe; type: ChartType; log: boolean; indicators: IndicatorInstance[] }
const DEFAULTS: Prefs = {
  symbol: "", tf: "D", type: "candles", log: false,
  indicators: [{ id: "sma50", type: "sma", params: { n: 50 } }, { id: "rsi14", type: "rsi", params: { n: 14 } }],
};

function useBars(inst: Instrument | undefined, tf: Timeframe): Loadable<Bar[]> {
  const [state, setState] = useState<Loadable<Bar[]>>({ status: "loading" });
  useEffect(() => {
    if (!inst) return;
    let live = true;
    setState((s) => (s.status === "ok" ? s : { status: "loading" }));
    void loadBars(inst, tf).then((r) => { if (live) setState(r); });
    return () => { live = false; };
  }, [inst, tf]);
  return state;
}

export function ChartView() {
  const small = isSmall();
  const height = small ? 300 : 440;
  const paneHeight = small ? 96 : 120;
  const insts = useInstruments();
  const list = insts.status === "ok" ? insts.data : [];
  const [prefs, setPrefs] = useState<Prefs>(() => readPref("chart", DEFAULTS));
  const [symbol, setSymbol] = useState<string>(() => hashParam("s") ?? prefs.symbol);
  const [compareKey, setCompareKey] = useState("");
  const [tool, setTool] = useState<DrawTool>("none");
  const [editing, setEditing] = useState(false);
  const update = (p: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...p }; writePref("chart", next); return next; });

  const inst = list.find((s) => s.key === symbol) ?? list.find((s) => s.key === "eq.US_MKT") ?? list.find((s) => s.kind === "price") ?? list[0];
  const cmp = compareKey ? list.find((s) => s.key === compareKey) : undefined;
  const bars = useBars(inst, prefs.tf);
  const cmpBars = useBars(cmp, prefs.tf);

  const pick = (key: string) => { setSymbol(key); setHashParam("s", key); update({ symbol: key }); };

  const drawings = useRows(drawingsTable, "trade_drawings", inst ? { symbol: inst.key } : { symbol: "" });
  const saved: Drawing[] = useMemo(() => drawings.rows.map((r) => ({ id: r.id, kind: r.kind, points: r.points })), [drawings.rows]);
  const onDraw = useCallback((d: Omit<Drawing, "id">) => {
    if (!inst) return;
    drawingsTable.insert({ symbol: inst.key, kind: d.kind, points: d.points }).catch((e: Error) => toast(e.message, { tone: "bad" }));
    setTool("none");
  }, [inst]);

  const hasVolume = bars.status === "ok" && bars.data.some((b) => b.volume != null);
  const indicators = useMemo(() => prefs.indicators.filter((i) => !indicatorDef(i.type).needsVolume || hasVolume), [prefs.indicators, hasVolume]);
  const compare = useMemo(() => (cmp && cmpBars.status === "ok" ? { label: cmp.short || cmp.label, bars: cmpBars.data } : null), [cmp, cmpBars]);
  const paneCount = indicators.filter((i) => indicatorDef(i.type).place === "pane").length;

  if (insts.status === "missing" || insts.status === "error") {
    return <div className="mk-banner" role="note"><strong>No chart data yet.</strong> {insts.message}</div>;
  }

  const toolbar = (
    <>
      {list.length > 0 && inst ? <InstrumentSelect list={list} value={inst.key} onChange={pick} /> : <Skeleton width={220} height={32} />}
      <Segmented size="sm" label="Timeframe" value={prefs.tf} onChange={(tf) => update({ tf })} options={TIMEFRAMES.map((t) => [t.id, t.label])} />
      <Select label="Chart type" value={prefs.type} onChange={(type) => update({ type })} options={CHART_TYPES} />
      <Button size="sm" icon="graph" onClick={() => setEditing(true)}>Indicators{prefs.indicators.length ? ` (${prefs.indicators.length})` : ""}</Button>
      <Segmented size="sm" label="Drawing tool" value={tool} onChange={setTool}
        options={[["none", "Cursor"], ["hline", "Line"], ["trend", "Trend"], ["fib", "Fib"]]} />
      {saved.length > 0 && <IconButton icon="restart" label="Clear drawings on this chart" onClick={() => inst && drawingsTable.removeWhere({ symbol: inst.key }).catch((e: Error) => toast(e.message, { tone: "bad" }))} />}
      <label className="tr-inline"><Toggle on={prefs.log} onChange={(log) => update({ log })} label="Log scale" /> Log</label>
      {list.length > 0 && <InstrumentSelect list={list.filter((s) => s.key !== inst?.key)} value={compareKey} onChange={setCompareKey} label="Compare with" allowNone="Compare with…" />}
    </>
  );

  const footer = inst && (
    <>
      <span>{inst.label}{inst.unit ? `, ${inst.unit}` : ""}. Source: {inst.attribution_url ? <a href={inst.attribution_url} target="_blank" rel="noreferrer">{inst.attribution ?? inst.source}</a> : inst.source}. {inst.licence}.</span>
      <span>{delayText(inst)}</span>
      <span>{barNote(prefs.tf)}{prefs.tf === "D" && inst.freq === "D" ? " Daily charts start in 2016; earlier history is weekly." : ""}</span>
      {compare && <span>Compare mode shows both as an index starting at 100 on the first visible bar. Drawings are hidden while comparing.</span>}
      <span>Intraday timeframes are not offered: no free source lets us show intraday prices.</span>
    </>
  );

  return (
    <>
      {bars.status === "ok" && inst ? (
        <ProChart bars={bars.data} label={inst.short || inst.label} type={prefs.type} indicators={indicators} compare={compare} log={prefs.log}
          drawings={saved} tool={tool} onDraw={onDraw} height={height} paneHeight={paneHeight} digits={digitsFor(inst.last)} toolbar={toolbar} footer={footer} />
      ) : bars.status === "missing" || bars.status === "error" ? (
        <div className="mk-banner" role="note"><strong>Could not load this chart.</strong> {bars.message}</div>
      ) : (
        <div className="pc">
          <div className="pc-toolbar">{toolbar}</div>
          <Skeleton height={height + paneCount * paneHeight} />
          <div className="pc-foot"><span>Loading prices</span></div>
        </div>
      )}
      <IndicatorDialog open={editing} onClose={() => setEditing(false)} value={prefs.indicators} hasVolume={hasVolume} onChange={(indicators) => update({ indicators })} />
    </>
  );
}

function IndicatorDialog({ open, onClose, value, onChange, hasVolume }:
  { open: boolean; onClose: () => void; value: IndicatorInstance[]; onChange: (v: IndicatorInstance[]) => void; hasVolume: boolean }) {
  const add = (type: IndicatorType) => onChange([...value, { id: newId(), type, params: defaultParams(type) }]);
  const set = (id: string, key: string, v: number) => onChange(value.map((i) => (i.id === id ? { ...i, params: { ...i.params, [key]: v } } : i)));
  return (
    <Dialog open={open} onClose={onClose} title="Indicators" width={620} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      {value.length > 0 && (
        <div className="tr-ind-list">
          {value.map((i) => {
            const def = indicatorDef(i.type);
            return (
              <div key={i.id} className="tr-ind">
                <div className="tr-ind-head"><strong>{instanceLabel(i)}</strong><span className="muted small">{def.place === "overlay" ? "On the price" : "Own pane"}{def.needsVolume && !hasVolume ? ", needs volume (not available here)" : ""}</span>
                  <Button size="sm" variant="tertiary" onClick={() => onChange(value.filter((x) => x.id !== i.id))}>Remove</Button></div>
                {def.params.length > 0 && (
                  <div className="tr-ind-params">
                    {def.params.map((p) => (
                      <label key={p.key} className="ui-field"><span className="ui-field-label">{p.label}</span>
                        <input className="ui-input" type="number" min={p.min} max={p.max} step={p.step ?? 1} value={i.params[p.key] ?? p.value}
                          onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= p.min && n <= p.max) set(i.id, p.key, n); }} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <h3 className="tr-sub">Add</h3>
      <div className="tr-ind-add">
        {INDICATORS.map((d) => (
          <button key={d.type} type="button" className="tr-ind-btn" onClick={() => add(d.type)} disabled={d.needsVolume && !hasVolume}>
            <strong>{d.label}</strong><span className="muted small">{d.what}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Indicators describe past prices. None of them predicts the next move on its own; see the RSI and MACD lessons in the Academy.</p>
    </Dialog>
  );
}
