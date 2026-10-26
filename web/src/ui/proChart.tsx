// ProChart: the trading chart for the Trade area. Candles, OHLC bars, line, area,
// Heikin-Ashi and baseline; indicators on the price or in panes of their own; drawings
// (horizontal line, trend line, Fibonacci); a crosshair legend; a compare overlay; log
// scale; and fullscreen.
//
// Drawn by TradingView Lightweight Charts (Apache 2.0). Its licence asks for this notice
// and a link to tradingview.com, which the chart shows (the logo) and the footer repeats:
//   TradingView Lightweight Charts™
//   Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/
//
// The chart's height is set from its props before the first paint, so loading data or
// adding an indicator never moves the page (DEC-0030).
import {
  AreaSeries, BarSeries, BaselineSeries, CandlestickSeries, createChart, createSeriesMarkers, HistogramSeries, LineSeries, LineStyle, PriceScaleMode,
  type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type MouseEventParams, type SeriesMarker, type SeriesType, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compute, heikinAshi, indicatorDef, instanceLabel, type Bar, type IndicatorInstance, type Line } from "../lib/indicators";
import { barAtOrBefore } from "../lib/bars";
import { IconButton } from "./buttons";
import { RAW, tokenValue, typePx, type TokenName } from "./tokens";
import "./proChart.css";

export type ChartType = "candles" | "bars" | "line" | "area" | "heikin" | "baseline";

export const CHART_TYPES: [ChartType, string][] = [
  ["candles", "Candles"], ["bars", "OHLC bars"], ["line", "Line"], ["area", "Area"], ["heikin", "Heikin-Ashi"], ["baseline", "Baseline"],
];

export type DrawTool = "none" | "hline" | "trend" | "fib";
export interface DrawPoint { time: string; price: number }
export interface Drawing { id: string; kind: "hline" | "trend" | "fib"; points: DrawPoint[] }

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export interface ProChartProps {
  bars: Bar[];
  label: string;
  type?: ChartType;
  indicators?: IndicatorInstance[];
  compare?: { label: string; bars: Bar[] } | null;
  log?: boolean;
  drawings?: Drawing[];
  tool?: DrawTool;
  onDraw?: (d: Omit<Drawing, "id">) => void;
  /** Height of the price pane; each indicator pane adds `paneHeight`. */
  height?: number;
  paneHeight?: number;
  digits?: number;
  /** Controls drawn above the chart, inside the fullscreen frame. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  /** Fill the parent's height instead of a fixed one (Parity Trade). `height` and
   *  `paneHeight` then only set how the price pane and indicator panes share it. */
  fill?: boolean;
  /** No footer line (Parity Trade shows the chart credit in its Settings; the logo stays on the chart). */
  bare?: boolean;
  /** Live updates (DEC-0052): `bars` of the source are mutated in place; the chart updates the
   *  forming bar on "last" and redraws once on "new" (a bar finished). No rebuild per tick. */
  live?: LiveBars | null;
  /** Strategy markers on the price series; clicking one calls onMarker with its id. */
  markers?: ChartMarker[];
  onMarker?: (id: string) => void;
  /** Reset the visible range only when this changes (a new symbol or timeframe), not on every update. */
  viewKey?: string;
}

/** closed: finished bars; the rest (the last one) is still forming and drawn faded, so
 *  nobody reads a signal or a close off a bar that has not finished (DEC-0056). */
export interface LiveBars { bars: Bar[]; on(fn: (c: "last" | "new") => void): () => void; readonly closed?: number }

/** A forming bar's colours: the usual ones, faded. */
const formingColors = (b: { open: number; close: number }, up: string, down: string) => {
  const c = withAlpha(b.close >= b.open ? up : down, 0.4);
  return { color: c, borderColor: c, wickColor: c };
};
export interface ChartMarker { id: string; time: string; side: "buy" | "sell" | "exit"; text: string }

/** Height of the time axis under the panes; the panes share the rest by stretch factor. */
const TIME_AXIS = 28;
const PANE_COLORS: TokenName[] = ["series-1", "series-3", "series-5", "series-2", "series-4"];

/** A colour token as a plain colour the chart library can parse (it cannot read
 *  color-mix or var), taken from the chart's own element so app themes apply. */
function cssVar(name: TokenName, el?: Element | null): string {
  return toCanvasColor(tokenValue(name, el), RAW[name]);
}

let probe: CanvasRenderingContext2D | null | undefined;
/** Any CSS colour (hex, rgb, color-mix) as the canvas writes it back: #rrggbb or rgba(). */
function toCanvasColor(color: string, fallback: string): string {
  probe ??= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!probe) return fallback;
  probe.fillStyle = fallback;
  probe.fillStyle = color;
  return String(probe.fillStyle);
}
/** Any CSS colour with an alpha channel, as rgba(), so tokens in any format work. */
function withAlpha(color: string, a: number): string {
  const v = toCanvasColor(color, RAW["palette-black"]);
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) { const [r, g, b] = m[1].split(",").map((x) => x.trim()); return `rgba(${r}, ${g}, ${b}, ${a})`; }
  return color;
}

/** Our bar keys to the chart's times: dates stay dates, intraday ISO times become seconds. */
export function toTime(key: string): Time {
  return (key.length <= 10 ? key : (Math.floor(Date.parse(key) / 1000) as UTCTimestamp)) as Time;
}

function timeKey(t: Time | undefined): string | null {
  if (t == null) return null;
  if (typeof t === "string") return t;
  if (typeof t === "number") return `${new Date(t * 1000).toISOString().slice(0, 19)}Z`;
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

const lineData = (bars: Bar[], v: Line) => bars.flatMap((b, i) => (v[i] == null ? [] : [{ time: toTime(b.time), value: v[i] as number }]));

function fmt(v: number | null | undefined, digits: number): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const a = Math.abs(v);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a.toFixed(digits);
  return (v < 0 ? "−" : "") + s;
}

function toMarkers(list: ChartMarker[] | undefined, up: string, down: string, exit: string): SeriesMarker<Time>[] {
  if (!list?.length) return [];
  return [...list].sort((a, b) => a.time.localeCompare(b.time)).map((m) => ({
    id: m.id, time: toTime(m.time), text: m.text, size: 0.8,
    ...(m.side === "buy" ? { position: "belowBar" as const, shape: "arrowUp" as const, color: up }
      : m.side === "sell" ? { position: "aboveBar" as const, shape: "arrowDown" as const, color: down }
      : { position: "aboveBar" as const, shape: "circle" as const, color: exit }),
  }));
}

interface Built {
  main: ISeriesApi<SeriesType> | null;
  lines: { label: string; values: Line; color: string; pane: number; digits: number }[];
  shown: Bar[];
}

export function ProChart({
  bars: barsProp, label, type = "candles", indicators = [], compare = null, log = false, drawings = [], tool = "none", onDraw,
  height = 420, paneHeight = 120, digits = 2, toolbar, footer, fill = false, bare = false, live = null, markers, onMarker, viewKey,
}: ProChartProps) {
  const frame = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const built = useRef<Built>({ main: null, lines: [], shown: [] });
  const drawn = useRef<{ lines: IPriceLine[]; series: ISeriesApi<SeriesType>[] }>({ lines: [], series: [] });
  const pending = useRef<DrawPoint | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const markerApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markersRef = useRef<ChartMarker[] | undefined>(markers);
  markersRef.current = markers;
  const onMarkerRef = useRef(onMarker);
  onMarkerRef.current = onMarker;
  // A bar finishing redraws everything once; ticks inside a bar only touch the last bar.
  const [liveVersion, setLiveVersion] = useState(0);

  const paneCount = useMemo(() => new Set(indicators.filter((i) => indicatorDef(i.type).place === "pane").map((i) => i.id)).size, [indicators]);
  const totalHeight = height + paneCount * paneHeight;
  // In fill mode the stage takes its parent's height; measure it for the pane legends.
  const stage = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    if (!fill || !stage.current || typeof ResizeObserver === "undefined") return;
    const el = stage.current;
    setMeasured(el.clientHeight);
    const ro = new ResizeObserver(() => setMeasured(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const stagePx = fill ? measured : totalHeight;

  // Create the chart once.
  useLayoutEffect(() => {
    if (!host.current) return;
    const text = cssVar("color-text-muted", host.current), grid = cssVar("color-grid", host.current), border = cssVar("color-border-strong", host.current);
    const c = createChart(host.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: text, fontFamily: tokenValue("font-text", host.current), fontSize: typePx("type-2xs"), attributionLogo: true, panes: { separatorColor: border, separatorHoverColor: border } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, rightOffset: 4 },
      crosshair: { mode: 0 },
    });
    chart.current = c;
    c.subscribeCrosshairMove((p: MouseEventParams) => {
      const key = timeKey(p.time);
      const shown = built.current.shown;
      if (!key || !p.point) { setHover(null); return; }
      const i = barAtOrBefore(shown, key);
      setHover(i >= 0 ? i : null);
    });
    return () => { c.remove(); chart.current = null; built.current = { main: null, lines: [], shown: [] }; drawn.current = { lines: [], series: [] }; };
  }, []);

  // Build every series whenever the data or the settings change.
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    for (const s of drawn.current.series) { try { c.removeSeries(s); } catch { /* already gone */ } }
    drawn.current = { lines: [], series: [] };
    for (const pane of [...c.panes()].reverse()) for (const s of pane.getSeries()) c.removeSeries(s);
    while (c.panes().length > 1) c.removePane(c.panes().length - 1);

    const up = cssVar("color-positive", host.current), down = cssVar("color-negative", host.current), accent = cssVar("series-1", host.current);
    const bars = live?.bars ?? barsProp;
    c.applyOptions({ timeScale: { timeVisible: (bars[0]?.time.length ?? 10) > 10, secondsVisible: false } });
    const shown = type === "heikin" ? heikinAshi(bars) : bars;
    const ohlc = shown.map((b) => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close }));
    const forming = !!live && live.closed != null && live.closed < bars.length;
    if (forming && ohlc.length && (type === "candles" || type === "heikin")) Object.assign(ohlc[ohlc.length - 1], formingColors(ohlc[ohlc.length - 1], up, down));
    const closes = shown.map((b) => ({ time: toTime(b.time), value: b.close }));
    const priceFormat = { type: "price" as const, precision: digits, minMove: 1 / 10 ** digits };
    let main: ISeriesApi<SeriesType>;
    if (type === "candles" || type === "heikin") {
      main = c.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, priceFormat });
      main.setData(ohlc);
    } else if (type === "bars") {
      main = c.addSeries(BarSeries, { upColor: up, downColor: down, priceFormat });
      main.setData(ohlc);
    } else if (type === "area") {
      main = c.addSeries(AreaSeries, { lineColor: accent, topColor: withAlpha(accent, 0.33), bottomColor: withAlpha(accent, 0.02), lineWidth: 2, priceFormat });
      main.setData(closes);
    } else if (type === "baseline") {
      const start = shown[Math.max(0, shown.length - 180)]?.close ?? 0;
      main = c.addSeries(BaselineSeries, { baseValue: { type: "price", price: start }, topLineColor: up, bottomLineColor: down, topFillColor1: withAlpha(up, 0.25), topFillColor2: withAlpha(up, 0.02), bottomFillColor1: withAlpha(down, 0.02), bottomFillColor2: withAlpha(down, 0.25), priceFormat });
      main.setData(closes);
    } else {
      main = c.addSeries(LineSeries, { color: accent, lineWidth: 2, priceFormat });
      main.setData(closes);
    }

    const lines: Built["lines"] = [];
    if (compare && compare.bars.length) {
      const color = cssVar("series-4", host.current);
      const s = c.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: compare.label });
      s.setData(compare.bars.map((b) => ({ time: toTime(b.time), value: b.close })));
      const byTime = new Map(compare.bars.map((b) => [b.time, b.close]));
      lines.push({ label: compare.label, values: shown.map((b) => byTime.get(b.time) ?? null), color, pane: 0, digits });
    }

    let pane = 0, colorIdx = 0;
    for (const ind of indicators) {
      const def = indicatorDef(ind.type);
      const out = compute(ind, bars);
      const onPane = def.place === "pane" ? ++pane : 0;
      const name = instanceLabel(ind);
      const color = (k: number) => cssVar(PANE_COLORS[(colorIdx + k) % PANE_COLORS.length], host.current);
      const lw = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
      const dg = ["rsi", "stochastic", "adx"].includes(ind.type) ? 1 : ind.type === "obv" || ind.type === "volume" ? 0 : digits;
      if (ind.type === "volume") {
        const s = c.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, onPane);
        s.setData(shown.flatMap((b, i) => (out.volume[i] == null ? [] : [{ time: toTime(b.time), value: out.volume[i] as number, color: b.close >= b.open ? withAlpha(up, 0.6) : withAlpha(down, 0.6) }])));
        lines.push({ label: name, values: out.volume, color: cssVar("color-text-muted", host.current), pane: onPane, digits: 0 });
      } else if (ind.type === "macd") {
        const h = c.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, onPane);
        h.setData(bars.flatMap((b, i) => (out.hist[i] == null ? [] : [{ time: toTime(b.time), value: out.hist[i] as number, color: (out.hist[i] as number) >= 0 ? withAlpha(up, 0.6) : withAlpha(down, 0.6) }])));
        const m = c.addSeries(LineSeries, { ...lw, color: color(0) }, onPane); m.setData(lineData(bars, out.macd));
        const s = c.addSeries(LineSeries, { ...lw, color: color(1) }, onPane); s.setData(lineData(bars, out.signal));
        lines.push({ label: "MACD", values: out.macd, color: color(0), pane: onPane, digits }, { label: "Signal", values: out.signal, color: color(1), pane: onPane, digits });
      } else {
        Object.entries(out).forEach(([k, values], j) => {
          const col = ind.type === "bollinger" && k !== "mid" ? color(1) : color(j);
          const s = c.addSeries(LineSeries, { ...lw, color: col, lineStyle: ind.type === "bollinger" && k !== "mid" ? LineStyle.Dashed : LineStyle.Solid }, onPane);
          s.setData(lineData(bars, values));
          if ((ind.type === "rsi" || ind.type === "stochastic") && j === 0) {
            for (const lvl of ind.type === "rsi" ? [30, 70] : [20, 80]) s.createPriceLine({ price: lvl, color: cssVar("color-axis", host.current), lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: "" });
          }
          lines.push({ label: Object.keys(out).length > 1 ? `${name} ${k}` : name, values, color: col, pane: onPane, digits: dg });
        });
      }
      colorIdx += 2;
    }
    const panes = c.panes();
    // Stretch factors are proportions, so the split holds when the chart resizes.
    panes[0]?.setStretchFactor(height);
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(paneHeight);

    c.priceScale("right").applyOptions({ mode: compare ? PriceScaleMode.IndexedTo100 : log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });
    built.current = { main, lines, shown };
    markerApi.current = createSeriesMarkers(main, toMarkers(markersRef.current, up, down, cssVar("color-text-muted", host.current)), { autoScale: true });
    setVersion((v) => v + 1);

    // Drawings sit on the price pane; they are hidden while comparing, when prices are rescaled.
    if (!compare) {
      for (const d of drawings) {
        if (d.kind === "hline" && d.points[0]) {
          drawn.current.lines.push(main.createPriceLine({ price: d.points[0].price, color: cssVar("series-4", host.current), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }));
        } else if (d.kind === "fib" && d.points.length === 2) {
          const [a, b] = d.points;
          for (const lvl of FIB_LEVELS) {
            drawn.current.lines.push(main.createPriceLine({ price: b.price + (a.price - b.price) * lvl, color: cssVar("series-6", host.current), lineWidth: 1, lineStyle: lvl === 0 || lvl === 1 ? LineStyle.Solid : LineStyle.Dotted, axisLabelVisible: false, title: `${(lvl * 100).toFixed(1)}%` }));
          }
        } else if (d.kind === "trend" && d.points.length === 2) {
          const pts = [...d.points].map((p) => ({ ...p, time: shown[Math.max(0, barAtOrBefore(shown, p.time))]?.time ?? p.time })).sort((x, y) => x.time.localeCompare(y.time));
          if (pts[0].time === pts[1].time) continue;
          const s = c.addSeries(LineSeries, { color: cssVar("series-4", host.current), lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, pointMarkersVisible: true }, 0);
          s.setData(pts.map((p) => ({ time: toTime(p.time), value: p.price })));
          drawn.current.series.push(s);
        }
      }
    }
  }, [barsProp, live, liveVersion, type, indicators, compare, log, drawings, digits, height, paneHeight]);

  // Markers change without a rebuild.
  useEffect(() => {
    markerApi.current?.setMarkers(toMarkers(markers, cssVar("color-positive", host.current), cssVar("color-negative", host.current), cssVar("color-text-muted", host.current)));
  }, [markers]);

  // Live ticks: update the forming bar in place; a finished bar triggers one redraw. The
  // legend follows at most four times a second.
  useEffect(() => {
    if (!live) return;
    let legendAt = 0;
    return live.on((change) => {
      const main = built.current.main;
      const bars = live.bars;
      const last = bars[bars.length - 1];
      if (!main || !last) return;
      if (change === "new") { setLiveVersion((v) => v + 1); return; }
      const sh = built.current.shown;
      if (sh !== bars && sh.length) {
        // Heikin-Ashi: the forming bar from the previous Heikin-Ashi bar.
        const prev = sh[sh.length - 2];
        const close = (last.open + last.high + last.low + last.close) / 4;
        const open = prev ? (prev.open + prev.close) / 2 : last.open;
        sh[sh.length - 1] = { ...last, open, close, high: Math.max(last.high, open, close), low: Math.min(last.low, open, close) };
      }
      const b = sh[sh.length - 1] ?? last;
      const t = toTime(b.time);
      if (type === "candles" || type === "heikin") main.update({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, ...formingColors(b, cssVar("color-positive", host.current), cssVar("color-negative", host.current)) });
      else if (type === "bars") main.update({ time: t, open: b.open, high: b.high, low: b.low, close: b.close });
      else main.update({ time: t, value: b.close });
      const now = performance.now();
      if (now - legendAt > 250) { legendAt = now; setVersion((v) => v + 1); }
    });
  }, [live, type]);

  // Show the latest stretch of history when a new instrument or timeframe loads.
  useEffect(() => {
    const c = chart.current;
    const n = (live?.bars ?? barsProp).length;
    if (!c || !n) return;
    c.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 200), to: n + 3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey ?? barsProp]);

  // Clicks place drawings.
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    pending.current = null;
    setHint(tool === "none" ? null : tool === "hline" ? "Click a price to draw a horizontal line." : "Click the first point, then the second.");
    if (tool === "none") {
      const pick = (p: MouseEventParams) => { if (typeof p.hoveredObjectId === "string") onMarkerRef.current?.(p.hoveredObjectId); };
      c.subscribeClick(pick);
      return () => c.unsubscribeClick(pick);
    }
    if (!onDraw) return;
    const on = (p: MouseEventParams) => {
      const main = built.current.main;
      const time = timeKey(p.time);
      if (!main || !p.point || !time) return;
      const price = main.coordinateToPrice(p.point.y);
      if (price == null) return;
      const pt = { time, price: Number(price) };
      if (tool === "hline") { onDraw({ kind: "hline", points: [pt] }); return; }
      if (!pending.current) { pending.current = pt; setHint("Now click the second point."); return; }
      onDraw({ kind: tool, points: [pending.current, pt] });
      pending.current = null;
      setHint("Click the first point, then the second.");
    };
    c.subscribeClick(on);
    return () => c.unsubscribeClick(on);
  }, [tool, onDraw]);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen?.().catch(() => setFull((f) => !f));
  };

  const { lines, shown } = built.current;
  const i = hover ?? shown.length - 1;
  const bar = shown[i];
  const prev = shown[i - 1];
  const chg = bar && prev ? (bar.close / prev.close - 1) * 100 : null;

  return (
    <div ref={frame} className={`pc ${full ? "pc-full" : ""} ${fill ? "pc-fill" : ""} ${tool !== "none" ? "pc-drawing" : ""}`}>
      {toolbar && <div className="pc-toolbar">{toolbar}<span className="pc-spacer" /><IconButton icon={full ? "close" : "external"} label={full ? "Leave fullscreen" : "Fullscreen"} onClick={toggleFull} /></div>}
      <div ref={stage} className="pc-stage" style={{ height: full || fill ? undefined : totalHeight }}>
        <div ref={host} className="pc-host" />
        <div className="pc-legend" aria-live="off">
          <div className="pc-legend-row">
            <strong>{label}</strong>
            {bar ? (
              <>
                <span className="pc-dim">{bar.time}</span>
                {live && live.closed != null && i >= live.closed && <span className="pc-forming" title="This bar has not finished. Signals use finished bars only.">Forming</span>}
                {type !== "line" && type !== "area" && type !== "baseline" && <>
                  <span>O <b>{fmt(bar.open, digits)}</b></span><span>H <b>{fmt(bar.high, digits)}</b></span><span>L <b>{fmt(bar.low, digits)}</b></span>
                </>}
                <span>C <b>{fmt(bar.close, digits)}</b></span>
                {chg != null && <span className={chg >= 0 ? "pc-up" : "pc-down"}>{chg >= 0 ? "+" : "−"}{Math.abs(chg).toFixed(2)}%</span>}
              </>
            ) : <span className="pc-dim">No data</span>}
          </div>
          {lines.filter((l) => l.pane === 0).map((l) => (
            <div key={l.label} className="pc-legend-row"><i style={{ background: l.color }} />{l.label} <b>{fmt(l.values[i], l.digits)}</b></div>
          ))}
        </div>
        {Array.from({ length: paneCount }, (_, k) => (
          <div key={k} className="pc-legend pc-legend-pane" style={{ top: Math.round(((stagePx - TIME_AXIS) * (height + k * paneHeight)) / totalHeight) + 6, visibility: stagePx ? undefined : "hidden" }}>
            <div className="pc-legend-row">
              {lines.filter((l) => l.pane === k + 1).map((l) => (
                <span key={l.label}><i style={{ background: l.color }} />{l.label} <b>{fmt(l.values[i], l.digits)}</b></span>
              ))}
            </div>
          </div>
        ))}
        {hint && <div className="pc-hint" role="status">{hint}</div>}
      </div>
      {!bare && (
        <div className="pc-foot">
          {footer}
          <span className="pc-attr">Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a> Lightweight Charts.</span>
        </div>
      )}
    </div>
  );
}
