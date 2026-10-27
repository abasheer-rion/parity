// Parity Trade (DEC-0040): the trading workspace as its own full-screen app at /trade/
// (trade.paritytrading.app). Its own rail, top bar, settings and keys; a chart grid with an
// order ticket and watchlist beside it and the account dock under it. Everything acts on
// the demo account with delayed data. One Back button returns to Parity.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppGuard } from "../auth";
import { NotFound } from "../components/NotFound";
import { SkipLink } from "../components/SkipLink";
import { Button, Dialog, ErrorBoundary, Icon, IconButton, lazyPage, Popover, Toaster, toast } from "../ui";

// Views other than the chart load when first opened (REF-0024).
const PortfolioView = lazyPage(() => import("./PortfolioView").then((m) => ({ default: m.PortfolioView })));
const ScreenerView = lazyPage(() => import("./ScreenerView").then((m) => ({ default: m.ScreenerView })));
const SettingsView = lazyPage(() => import("./SettingsView").then((m) => ({ default: m.SettingsView })));
const StrategiesView = lazyPage(() => import("./StrategiesView").then((m) => ({ default: m.StrategiesView })));
import { CHART_TYPES, type DrawTool } from "../ui/proChart";
import { TIMEFRAMES, type Timeframe } from "../lib/bars";
import { productUrl } from "../lib/space";
import { setStoreUser, useRows } from "../lib/userStore";
import type { Instrument } from "../lib/tradeData";
import { AlertDialog, AlertsView } from "./AlertsView";
import { ChartGrid, drawingsTable, findInst, IndicatorDialog } from "./ChartGrid";
import { DemoProvider, useDemo } from "./demo";
import { Dock, OrdersView } from "./Dock";
import { Finder, type Command } from "./Finder";
import { HOTKEYS, isTyping, MAC, startsSearch } from "./keys";
import { layoutsTable, MAX_LAYOUTS } from "./layouts";
import { NotificationsBell } from "./Notifications";
import { OrderTicket, type Cue } from "./OrderTicket";
import { Splitter } from "./Splitter";
import { hashParam, useInstruments } from "./shared";
import {
  BOTTOM_MAX, BOTTOM_MIN, cleanLayout, freshLayout, readLayout, readSettings, SIDE_MAX, SIDE_MIN, VIEW_IDS, VIEWS, writeLayout, writeSettings,
  type Grid, type Layout, type Settings, type View,
} from "./state";
import { checkAlerts } from "./trackers";
import { isDesktop } from "../desktop/bridge";
import { DesktopTicker } from "./DesktopTicker";
import { NameDialog, WatchlistsView, WatchMini } from "./WatchlistsView";
import "./trade.css";
import { rumRefresh } from "../lib/rum";
import { Assistant } from "../assistant/Mount";
import { instrumentForKey, tfFor, tfsFor, universeInstruments, useUniverse } from "./live";
import { SignalsMenu } from "./signalsUi";
import { BookPanel, hasBook } from "./BookPanel";
import { MarketsView } from "./MarketsView";
import { setLiveApp } from "../lib/live/client";
import { FirstRunTour } from "../onboarding/FirstRunTour";

setLiveApp("trade");

export function TradeApp() {
  return <AppGuard>{(user) => { setStoreUser(user.id); return <TradeShell />; }}</AppGuard>;
}

// Parity opens Trade in a new tab, so window.opener is usually empty (noopener); a tab that
// started with this page as its only history entry was opened that way.
// Never in the desktop app: there the page is part of a window, and closing it left a black
// view and then an error when the window closed (desktop 0.2.0, DEC-0059).
const OPENED_AS_TAB = !isDesktop() && (!!window.opener || window.history.length <= 1);
function goBack() {
  if (OPENED_AS_TAB) {
    window.close();
    window.setTimeout(() => { window.location.href = productUrl(); }, 250);
    return;
  }
  window.location.href = productUrl();
}

function useMobile(): boolean {
  const q = "(max-width: 760px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const clearDrawings = (symbol: string) => { drawingsTable.removeWhere({ symbol }).then(() => toast("Drawings cleared"), (e: Error) => toast(e.message, { tone: "bad" })); };

/** The layout with the address's ?s= and ?tf= applied to the active chart. */
function fromHash(l: Layout): Layout {
  const s = hashParam("s"), tf = TIMEFRAMES.find((t) => t.id === hashParam("tf"))?.id;
  if (!s && !tf) return l;
  return { ...l, cells: l.cells.map((c, i) => (i === l.active ? { ...c, symbol: s || c.symbol, tf: tf ?? c.tf } : c)) };
}

/** The hash itself when it names no Trade view (the app then shows "not found", DEC-0055), else null. */
const unknownView = (h: string): string | null => { const v = h.split("?")[0].split("/")[1] ?? ""; return v && !(VIEW_IDS as string[]).includes(v) ? h : null; };
const viewOf = (h: string): View => { const v = h.split("?")[0].split("/")[1] ?? ""; return (VIEW_IDS as string[]).includes(v) ? (v as View) : "chart"; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
type MTab = "chart" | "watch" | "ticket" | "dock" | "more";

function TradeShell() {
  const insts = useInstruments();
  const list = useMemo(() => (insts.status === "ok" ? insts.data : []), [insts]);
  const [settings, setSettingsState] = useState<Settings>(readSettings);
  const [layout, setLayoutState] = useState<Layout>(() => fromHash(readLayout(settings)));
  const set = useCallback((f: (l: Layout) => Layout) => setLayoutState((old) => { const next = f(old); if (next !== old) writeLayout(next); return next; }), []);
  const setSettings = useCallback((p: Partial<Settings>) => setSettingsState((old) => { const next = { ...old, ...p }; writeSettings(next); return next; }), []);
  const [view, setView] = useState<View>(() => viewOf(window.location.hash));
  const [missing, setMissing] = useState<string | null>(() => unknownView(window.location.hash));
  const mobile = useMobile();
  const [mtab, setMtab] = useState<MTab>("chart");

  const cell = layout.cells[layout.active];
  // The whole symbol universe (SEC list and live symbols) loads once the search first opens.
  const [wantUniverse, setWantUniverse] = useState(() => layout.cells.some((c) => c.symbol.startsWith("S:")));
  const universe = useUniverse(wantUniverse);
  const extra = useMemo(() => universeInstruments(universe), [universe]);
  const activeInst = instrumentForKey(cell.symbol, universe) ?? findInst(list, cell.symbol);
  const symbol = activeInst?.key ?? cell.symbol;

  const openSymbol = useCallback((key: string, go = true) => {
    set((l) => ({ ...l, cells: l.cells.map((c, i) => (i === l.active ? { ...c, symbol: key } : c)) }));
    if (go && window.location.hash.split("?")[0] !== "#/chart") window.location.hash = "#/chart";
    if (go) setMtab("chart");
  }, [set]);

  // The hash holds the view, and ?s=<key>&tf=<D|W|M> load into the active chart, so a link
  // reopens the same chart (DEC-0038).
  useEffect(() => {
    const on = () => { setView(viewOf(window.location.hash)); setMissing(unknownView(window.location.hash)); set(fromHash); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [set]);
  const go = useCallback((v: View) => { window.location.hash = `#/${v}`; }, []);
  // On the Chart view the address follows the active chart, without a history entry.
  useEffect(() => {
    if (view !== "chart" || missing) return;
    const want = `#/chart?s=${encodeURIComponent(symbol)}&tf=${cell.tf}`;
    if (window.location.hash !== want) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${want}`);
  }, [view, missing, symbol, cell.tf]);

  // A saved symbol the data no longer has (or a default it never had) becomes another price series.
  useEffect(() => {
    if (!list.length) return;
    set((l) => {
      const have = new Set(list.map((s) => s.key));
      const used = new Set(l.cells.map((c) => c.symbol).filter((k) => have.has(k)));
      let changed = false;
      const cells = l.cells.map((c) => {
        if (have.has(c.symbol) || c.symbol.startsWith("L:") || c.symbol.startsWith("S:")) return c;
        const alt = list.find((s) => s.kind === "price" && s.freq === "D" && !used.has(s.key));
        if (!alt) return c;
        used.add(alt.key); changed = true;
        return { ...c, symbol: alt.key };
      });
      return changed ? { ...l, cells } : l;
    });
  }, [list, set]);

  // Alerts are checked once the instruments load.
  const checked = useRef(false);
  useEffect(() => { if (list.length && !checked.current) { checked.current = true; void checkAlerts(list); } }, [list]);
  // The desktop app stays open for hours, so it checks again every 30 minutes (DEC-0041).
  useEffect(() => {
    if (!isDesktop() || !list.length) return;
    // Each run notes how late it came and the gap since the last (DEC-0045).
    const tick = rumRefresh("trade/alerts", 30 * 60_000, true);
    tick();
    const t = window.setInterval(() => { tick(); void checkAlerts(list); }, 30 * 60_000);
    return () => window.clearInterval(t);
  }, [list]);

  const [tool, setTool] = useState<DrawTool>("none");
  const [finder, setFinderState] = useState<{ open: boolean; mode: "symbols" | "all"; initial: string }>({ open: false, mode: "symbols", initial: "" });
  const setFinder = useCallback((f: typeof finder | ((x: typeof finder) => typeof finder)) => { setWantUniverse(true); setFinderState(f); }, []);
  const [indOpen, setIndOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [cue, setCue] = useState<Cue | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; go: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const layouts = useRows(layoutsTable, "trade_layouts");
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const layoutName = layouts.rows.find((r) => r.id === layoutId)?.name ?? null;

  const setTf = useCallback((tf: Timeframe) => set((l) => ({ ...l, cells: l.cells.map((c, i) => (i === l.active ? { ...c, tf } : c)) })), [set]);
  const setGrid = useCallback((g: Grid) => set((l) => ({ ...l, grid: g, active: Math.min(l.active, g - 1), max: null })), [set]);
  const toggleSide = useCallback(() => set((l) => ({ ...l, side: { ...l.side, open: !l.side.open } })), [set]);
  const toggleBottom = useCallback(() => set((l) => ({ ...l, bottom: { ...l.bottom, open: !l.bottom.open } })), [set]);
  const order = useCallback((side: "buy" | "sell", type: "market" | "limit" = "market") => {
    if (view !== "chart") go("chart");
    set((l) => (l.side.open && l.side.ticket ? l : { ...l, side: { ...l.side, open: true, ticket: true } }));
    if (mobile) setMtab("ticket");
    setCue({ side, type, at: Date.now(), fire: settings.oneKey && type === "market" });
  }, [view, go, set, mobile, settings.oneKey]);
  const resetLayout = useCallback(() => { const f = freshLayout(settings); setLayoutState(f); writeLayout(f); setLayoutId(null); toast("Layout reset"); }, [settings]);
  const loadLayout = useCallback((id: string) => {
    const row = layouts.rows.find((r) => r.id === id);
    if (!row) return;
    const l = cleanLayout(row.state, settings);
    setLayoutState(l); writeLayout(l); setLayoutId(id); go("chart");
  }, [layouts.rows, settings, go]);
  const saveLayout = useCallback((asNew: boolean) => {
    if (!asNew && layoutId) layoutsTable.update(layoutId, { state: layout }).then(() => toast("Layout saved"), (e: Error) => toast(e.message, { tone: "bad" }));
    else if (layouts.rows.length >= MAX_LAYOUTS) toast(`Up to ${MAX_LAYOUTS} layouts`, { tone: "bad" });
    else setSaving(true);
  }, [layoutId, layout, layouts.rows.length]);

  const commands: Command[] = useMemo(() => {
    const c: Command[] = [
      ...VIEWS.map((v, i) => ({ id: `v:${v.id}`, label: `Go to ${v.label}`, hint: `Shift+${i + 1}`, group: "View", run: () => go(v.id) })),
      ...TIMEFRAMES.map((t) => ({ id: `tf:${t.id}`, label: `Timeframe ${t.label}`, hint: `Shift+${t.id}`, group: "Timeframe", words: `${t.label.toLowerCase()} ${t.id.toLowerCase()} ${t.long.toLowerCase()}`, run: () => { setTf(t.id); go("chart"); } })),
      ...CHART_TYPES.map(([id, label]) => ({ id: `ct:${id}`, label: `Chart type: ${label}`, group: "Chart", run: () => set((l) => ({ ...l, type: id })) })),
      { id: "ind", label: "Indicators", hint: "/", group: "Chart", run: () => setIndOpen(true) },
      { id: "log", label: layout.log ? "Log scale off" : "Log scale on", hint: "Shift+L", group: "Chart", run: () => set((l) => ({ ...l, log: !l.log })) },
      { id: "dh", label: "Draw horizontal line", hint: "Alt+H", group: "Chart", run: () => setTool("hline") },
      { id: "dt", label: "Draw trend line", hint: "Alt+T", group: "Chart", run: () => setTool("trend") },
      { id: "df", label: "Draw Fibonacci", hint: "Alt+F", group: "Chart", run: () => setTool("fib") },
      { id: "dx", label: "Clear drawings on this symbol", group: "Chart", run: () => clearDrawings(symbol) },
      ...([1, 2, 4] as Grid[]).map((g) => ({ id: `g:${g}`, label: `${g} chart${g > 1 ? "s" : ""}`, hint: `Alt+${g}`, group: "Layout", run: () => setGrid(g) })),
      { id: "side", label: layout.side.open ? "Hide side panel" : "Show side panel", hint: "Alt+R", group: "Layout", run: toggleSide },
      { id: "bottom", label: layout.bottom.open ? "Collapse dock" : "Expand dock", hint: "Alt+B", group: "Layout", run: toggleBottom },
      { id: "dock", label: layout.side.dock === "right" ? "Dock side panel left" : "Dock side panel right", group: "Layout", run: () => set((l) => ({ ...l, side: { ...l.side, open: true, dock: l.side.dock === "right" ? "left" : "right" } })) },
      { id: "save", label: layoutName ? `Save layout: ${layoutName}` : "Save layout", hint: `${MAC ? "Cmd" : "Ctrl"}+S`, group: "Layout", run: () => saveLayout(false) },
      { id: "saveas", label: "Save layout as", group: "Layout", run: () => saveLayout(true) },
      { id: "reset", label: "Reset layout", group: "Layout", run: resetLayout },
      ...layouts.rows.map((r) => ({ id: `l:${r.id}`, label: `Load layout: ${r.name}`, group: "Layout", run: () => loadLayout(r.id) })),
      { id: "buy", label: "Buy", hint: "Shift+B", group: "Order", run: () => order("buy") },
      { id: "sell", label: "Sell", hint: "Shift+S", group: "Order", run: () => order("sell") },
      { id: "buyl", label: "Buy limit", hint: "Shift+Alt+B", group: "Order", run: () => order("buy", "limit") },
      { id: "selll", label: "Sell limit", hint: "Shift+Alt+S", group: "Order", run: () => order("sell", "limit") },
      { id: "alert", label: "New alert", hint: "Alt+A", group: "Order", run: () => setAlertFor(symbol) },
      { id: "keys", label: "Keyboard shortcuts", hint: "?", group: "Help", run: () => setKeysOpen(true) },
      { id: "back", label: "Back to Parity", group: "Help", run: goBack },
    ];
    return c;
  }, [go, setTf, set, layout.log, layout.side.open, layout.side.dock, layout.bottom.open, setGrid, toggleSide, toggleBottom, saveLayout, resetLayout, layouts.rows, loadLayout, order, symbol, layoutName]);

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setFinder({ open: true, mode: "all", initial: "" }); return; }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveLayout(false); return; }
      if (isTyping(e.target) || finder.open || document.querySelector(".ui-dialog-backdrop, [aria-modal='true']")) return;
      if (mod) return;
      const code = e.code;
      if (e.key === "?") { e.preventDefault(); setKeysOpen(true); return; }
      if (e.key === "/") { e.preventDefault(); setIndOpen(true); return; }
      if (e.key === "Escape") { if (tool !== "none") setTool("none"); else if (layout.max != null) set((l) => ({ ...l, max: null })); return; }
      if (e.shiftKey && !e.altKey && /^Digit[1-9]$/.test(code) && VIEWS[Number(code.slice(5)) - 1]) { e.preventDefault(); go(VIEWS[Number(code.slice(5)) - 1].id); return; }
      if (e.shiftKey && (code === "KeyB" || code === "KeyS")) { e.preventDefault(); order(code === "KeyB" ? "buy" : "sell", e.altKey ? "limit" : "market"); return; }
      if (e.altKey && !e.shiftKey) {
        const map: Record<string, () => void> = {
          KeyH: () => setTool("hline"), KeyT: () => setTool("trend"), KeyF: () => setTool("fib"),
          Digit1: () => setGrid(1), Digit2: () => setGrid(2), Digit4: () => setGrid(4),
          Enter: () => set((l) => ({ ...l, max: l.max === l.active ? null : l.active })), KeyR: toggleSide, KeyB: toggleBottom, KeyA: () => setAlertFor(symbol),
        };
        if (map[code]) { e.preventDefault(); if (view !== "chart" && code !== "KeyA") go("chart"); map[code](); }
        return;
      }
      if (e.shiftKey && !e.altKey) {
        const tf: Record<string, Timeframe> = { KeyD: "D", KeyW: "W", KeyM: "M" };
        if (tf[code]) { e.preventDefault(); setTf(tf[code]); return; }
        if (code === "KeyC") { e.preventDefault(); set((l) => ({ ...l, type: CHART_TYPES[(CHART_TYPES.findIndex(([t]) => t === l.type) + 1) % CHART_TYPES.length][0] })); return; }
        if (code === "KeyL") { e.preventDefault(); set((l) => ({ ...l, log: !l.log })); return; }
        return;
      }
      if ((e.key === "]" || e.key === "[") && view === "chart") {
        e.preventDefault();
        set((l) => ({ ...l, active: (l.active + (e.key === "]" ? 1 : l.grid - 1)) % l.grid, max: l.max != null ? (l.active + (e.key === "]" ? 1 : l.grid - 1)) % l.grid : null }));
        return;
      }
      if (settings.typeToSearch && startsSearch(e)) { e.preventDefault(); setFinder({ open: true, mode: "symbols", initial: e.key.toUpperCase() }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finder.open, tool, layout.max, set, go, order, setGrid, toggleSide, toggleBottom, symbol, view, setTf, settings.typeToSearch, saveLayout]);

  const focus = useMemo(() => layout.cells.slice(0, layout.grid).map((c) => c.symbol), [layout.cells, layout.grid]);
  const viewLabel = VIEWS.find((v) => v.id === view)?.label ?? "";
  // Live and stock charts do not need the daily export, so a missing export only blocks the daily charts.
  // Markets streams on its own, so it never waits for the daily export either.
  const noData = view !== "markets" && (insts.status === "missing" || insts.status === "error") && !layout.cells.slice(0, layout.grid).some((c) => c.symbol.startsWith("L:") || c.symbol.startsWith("S:"));

  return (
    <DemoProvider all={list} focus={focus.includes(symbol) ? focus : [...focus, symbol]}>
      <div className="ptr" data-density={settings.density} data-mobile={mobile || undefined}>
        <SkipLink />
        {isDesktop() && list.length > 0 && <DesktopTicker list={list} />}
        <header className="tb" data-desktop-header>
          <button type="button" className="tb-back" onClick={goBack} title="Back to Parity" aria-label="Back to Parity">
            <span aria-hidden>‹</span>
            <img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={16} height={16} />
            <span className="tb-back-t">Back</span>
          </button>
          <span className="tb-brand" aria-hidden>PARITY <b>TRADE</b></span>
          {view === "chart" && !missing ? (<>
            <h1 className="sr-only">Chart, {activeInst?.label ?? symbol}</h1>
            <ChartBar layout={layout} set={set} list={list} inst={activeInst} symbol={symbol} tool={tool} setTool={setTool} mobile={mobile}
              onSearch={() => setFinder({ open: true, mode: "symbols", initial: "" })} onIndicators={() => setIndOpen(true)} setTf={setTf} setGrid={setGrid} />
          </>) : <h1 className="tb-view">{missing ? "Not found" : viewLabel}</h1>}
          <span className="tb-gap" />
          {!mobile && (
            <Popover label="Layouts" width={240} placement="bottom-end" trigger={() => (
              <Button size="xs" variant="ghost" title="Layouts" iconRight="chevronDown">{layoutName ?? "Layout"}</Button>
            )}>
              {(close) => (
                <div className="lm">
                  <button type="button" onClick={() => { close(); saveLayout(false); }}>Save{layoutName ? ` "${layoutName}"` : ""}<kbd>{MAC ? "⌘S" : "Ctrl S"}</kbd></button>
                  <button type="button" onClick={() => { close(); saveLayout(true); }}>Save as</button>
                  <button type="button" onClick={() => { close(); resetLayout(); }}>Reset</button>
                  {layouts.rows.length > 0 && <div className="lm-sep" />}
                  {layouts.rows.map((r) => <button key={r.id} type="button" className={r.id === layoutId ? "on" : ""} onClick={() => { close(); loadLayout(r.id); }}>{r.name}</button>)}
                </div>
              )}
            </Popover>
          )}
          {!mobile && <Button size="xs" variant="ghost" className="tb-search" icon="search" onClick={() => setFinder({ open: true, mode: "all", initial: "" })} title="Command palette">
            Search <kbd>{MAC ? "⌘K" : "Ctrl K"}</kbd></Button>}
          <NotificationsBell list={list} />
          {!mobile && view === "chart" && <IconButton icon="sidebar" size="sm" variant="plain" active={layout.side.open} onClick={toggleSide} label="Side panel (Alt+R)" />}
          <EquityChip />
        </header>

        <div className="tr-mid">
          {!mobile && (
            <nav className="rail" aria-label="Trade">
              {VIEWS.map((v, i) => (
                <a key={v.id} href={`#/${v.id}`} className={`ui-rail-i ui-tipped rail-i ${view === v.id ? "on" : ""} ${v.id === "settings" ? "rail-end" : ""}`} aria-current={view === v.id ? "page" : undefined}
                  data-tip={`${v.label} · Shift+${i + 1}`} aria-label={v.label}>
                  <Icon name={v.icon} size={17} />
                </a>
              ))}
            </nav>
          )}
          <main id="main" tabIndex={-1} className="tr-main ui-route-kids">
            <ErrorBoundary key={view} scope="page">
            <Suspense fallback={<div className="vmsg" aria-busy="true">Loading</div>}>
            {missing ? <NotFound heading="h2" address={missing} home="#/chart" homeLabel="Chart" body="There is no Parity Trade page at this address. The link may be mistyped, or the page may have moved." />
              : noData ? <div className="vmsg">No market data</div>
              : view === "chart" ? (mobile
                ? <MobileChart mtab={mtab} list={list} layout={layout} set={set} tool={tool} setTool={setTool} symbol={symbol} cue={cue} settings={settings} openSymbol={openSymbol} go={go} onConfirm={(text, run) => setConfirm({ text, go: run })} />
                : <Workspace list={list} layout={layout} set={set} tool={tool} setTool={setTool} symbol={symbol} cue={cue} settings={settings} openSymbol={openSymbol} onConfirm={(text, run) => setConfirm({ text, go: run })} />)
              : view === "markets" ? <MarketsView onSymbol={openSymbol} />
              : view === "watchlists" ? <WatchlistsView list={list} onSymbol={openSymbol} onAlert={setAlertFor} />
              : view === "screener" ? <ScreenerView list={list} onSymbol={openSymbol} />
              : view === "portfolio" ? <PortfolioView onSymbol={openSymbol} />
              : view === "orders" ? <OrdersView tz={settings.tz} />
              : view === "alerts" ? <AlertsView list={list} tz={settings.tz} onSymbol={openSymbol} onNew={() => setAlertFor(symbol)} />
              : view === "strategies" ? <StrategiesView />
              : <SettingsView list={list} settings={settings} set={setSettings} onResetLayout={resetLayout} onLoadLayout={loadLayout} />}
            </Suspense>
            </ErrorBoundary>
          </main>
        </div>

        {mobile && (
          <nav className="mtabs" aria-label="Trade">
            {([["chart", "Chart", "graph"], ["watch", "Watch", "list"], ["ticket", "Trade", "plus"], ["dock", "Positions", "table"], ["more", "More", "menu"]] as [MTab, string, string][]).map(([t, l, ic]) => {
              const on = t === "more" ? view !== "chart" || mtab === "more" : view === "chart" && mtab === t;
              return (
                <button key={t} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => { setMtab(t); if (view !== "chart") go("chart"); }}>
                  <Icon name={ic} size={17} /><span>{l}</span>
                </button>
              );
            })}
          </nav>
        )}

        <Finder open={finder.open} mode={finder.mode} initial={finder.initial} list={list} extra={extra} commands={commands} onPick={(k) => openSymbol(k)}
          onClose={() => setFinder((f) => ({ ...f, open: false }))} />
        <IndicatorDialog open={indOpen} onClose={() => setIndOpen(false)} value={layout.indicators} onChange={(indicators) => set((l) => ({ ...l, indicators }))} />
        <AlertDialog symbol={alertFor} list={list} onClose={() => setAlertFor(null)} />
        <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keys" width={520}>
          <table className="tt st-keys" aria-label="Keyboard shortcuts"><tbody>{HOTKEYS.map(([k, w]) => <tr key={k}><td className="l"><kbd>{k}</kbd></td><td className="l">{w}</td></tr>)}</tbody></table>
        </Dialog>
        <Dialog open={confirm != null} onClose={() => setConfirm(null)} title="Confirm order" width={360}
          footer={<><Button variant="tertiary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" onClick={() => { confirm?.go(); setConfirm(null); }}>Place</Button></>}>
          <p className="tabular">{confirm?.text}</p>
        </Dialog>
        <NameDialog open={saving} title="Save layout" initial={layoutName ?? `Layout ${layouts.rows.length + 1}`} onClose={() => setSaving(false)}
          onSave={(name) => {
            setSaving(false);
            layoutsTable.insert({ name, state: layout, position: layouts.rows.length }).then((r) => { setLayoutId(r.id); toast(`Saved ${name}`); }, (e: Error) => toast(e.message, { tone: "bad" }));
          }} />
        <Toaster />
        <Assistant place="trade" />
        {/* The tour points at the chart, ticket and dock, so it waits for the Chart view with data. */}
        <FirstRunTour areas={["trade"]} ready={view === "chart" && mtab === "chart" && insts.status !== "loading" && !noData} />
      </div>
    </DemoProvider>
  );
}

function EquityChip() {
  const d = useDemo();
  const chg = d.book ? d.equity - d.start : 0;
  return (
    <a className="tb-eq tabular" href="#/portfolio" title="Demo account equity">
      <span className="tb-eq-v">{d.book ? `$${d.equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "n/a"}</span>
      <span className={`tb-eq-c ${chg > 0 ? "good" : chg < 0 ? "bad" : ""}`}>{d.book ? `${chg >= 0 ? "+" : "−"}${(Math.abs(chg) / d.start * 100).toFixed(2)}%` : ""}</span>
    </a>
  );
}

function ChartBar({ layout, set, list, inst, symbol, tool, setTool, onSearch, onIndicators, setTf, setGrid, mobile }: {
  layout: Layout; set: (f: (l: Layout) => Layout) => void; list: Instrument[]; inst: (Instrument & { live?: { src: string } }) | undefined; symbol: string; tool: DrawTool; setTool: (t: DrawTool) => void;
  onSearch: () => void; onIndicators: () => void; setTf: (tf: Timeframe) => void; setGrid: (g: Grid) => void; mobile: boolean;
}) {
  const cell = layout.cells[layout.active];
  const live = inst?.live;
  const ltf = live ? tfFor(live.src, cell.ltf) : null;
  return (
    <div className="cb" role="toolbar" aria-label="Chart">
      <button type="button" className="cb-sym" onClick={onSearch} title="Symbol search (type any letter)">
        <Icon name="search" size={12} /><strong>{inst?.short ?? "n/a"}</strong>
      </button>
      <span className="cb-group" role="radiogroup" aria-label="Timeframe">
        {live
          ? tfsFor(live.src).map((t) => <button key={t.id} type="button" role="radio" aria-checked={ltf === t.id} className={ltf === t.id ? "on" : ""} onClick={() => set((l) => ({ ...l, cells: l.cells.map((c, i) => (i === l.active ? { ...c, ltf: t.id } : c)) }))}>{t.label}</button>)
          : TIMEFRAMES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={cell.tf === t.id} className={cell.tf === t.id ? "on" : ""} onClick={() => setTf(t.id)} title={`${t.long} (Shift+${t.id})`}>{t.label}</button>)}
      </span>
      {!mobile && (
        <>
          <select className="cb-select" aria-label="Chart type" value={layout.type} onChange={(e) => set((l) => ({ ...l, type: e.target.value as Layout["type"] }))}>
            {CHART_TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
          </select>
          <Button size="xs" variant="ghost" onClick={onIndicators} title="Indicators (/)">Indicators{layout.indicators.length ? ` ${layout.indicators.length}` : ""}</Button>
          <Popover label="Signals" width={340} trigger={() => <Button size="xs" variant="ghost" title="Strategy signals on the chart">Signals{layout.signals.length ? ` ${layout.signals.length}` : ""}</Button>}>
            <SignalsMenu value={layout.signals} onChange={(signals) => set((l) => ({ ...l, signals }))} />
          </Popover>
          <span className="cb-group cb-draw" role="radiogroup" aria-label="Drawing tool">
            {([["none", "Cursor", "Esc", "↖"], ["hline", "Horizontal line", "Alt+H", "─"], ["trend", "Trend line", "Alt+T", "╱"], ["fib", "Fibonacci", "Alt+F", "Fib"]] as [DrawTool, string, string, string][]).map(([t, l, k, g]) => (
              <button key={t} type="button" role="radio" aria-checked={tool === t} aria-label={l} className={tool === t ? "on" : ""} onClick={() => setTool(t)} title={`${l} (${k})`}>{g}</button>
            ))}
          </span>
          <select className="cb-select cb-cmp" aria-label="Compare with" value={cell.cmp ?? ""}
            onChange={(e) => { const v = e.target.value; set((l) => ({ ...l, cells: l.cells.map((c, i) => (i === l.active ? (v ? { ...c, cmp: v } : { symbol: c.symbol, tf: c.tf, ...(c.ltf ? { ltf: c.ltf } : {}) }) : c)) })); }}>
            <option value="">Compare</option>
            {list.filter((s) => s.key !== symbol).map((s) => <option key={s.key} value={s.key}>{s.short}  {s.label}</option>)}
          </select>
          <Button size="xs" variant="ghost" className="cb-clear" onClick={() => clearDrawings(symbol)} title="Clear drawings on this symbol" aria-label="Clear drawings">Clear</Button>
          <Button size="xs" variant="ghost" className="cb-log" pressed={layout.log} onClick={() => set((l) => ({ ...l, log: !l.log }))} title="Log scale (Shift+L)">Log</Button>
          <span className="cb-group" role="radiogroup" aria-label="Charts">
            {([1, 2, 4] as Grid[]).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={layout.grid === g} aria-label={`${g} chart${g > 1 ? "s" : ""}`} className={`cb-grid ${layout.grid === g ? "on" : ""}`} onClick={() => setGrid(g)} title={`${g} chart${g > 1 ? "s" : ""} (Alt+${g})`}>
                <GridGlyph n={g} />
              </button>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

function GridGlyph({ n }: { n: Grid }) {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="0.6" y="0.6" width="12.8" height="10.8" rx="1" />
      {n >= 2 && <line x1="7" y1="0.6" x2="7" y2="11.4" />}
      {n === 4 && <line x1="0.6" y1="6" x2="13.4" y2="6" />}
    </svg>
  );
}

interface WsProps {
  list: Instrument[]; layout: Layout; set: (f: (l: Layout) => Layout) => void; tool: DrawTool; setTool: (t: DrawTool) => void;
  symbol: string; cue: Cue | null; settings: Settings; openSymbol: (k: string, go?: boolean) => void; onConfirm: (text: string, go: () => void) => void;
}

function Workspace({ list, layout, set, tool, setTool, symbol, cue, settings, openSymbol, onConfirm }: WsProps) {
  const base = useRef<number | null>(null);
  const side = useRef<HTMLElement>(null);
  const { side: s, bottom } = layout;
  const dragSide = (delta: number) => {
    base.current ??= s.width;
    const w = clamp(base.current + (s.dock === "right" ? -delta : delta), SIDE_MIN, SIDE_MAX);
    set((l) => ({ ...l, side: { ...l.side, width: w } }));
  };
  const dragBottom = (delta: number) => {
    base.current ??= bottom.height;
    set((l) => ({ ...l, bottom: { ...l.bottom, height: clamp(base.current! - delta, BOTTOM_MIN, BOTTOM_MAX) } }));
  };
  const dragSplit = (delta: number) => {
    const h = side.current?.clientHeight ?? 600;
    base.current ??= s.split;
    set((l) => ({ ...l, side: { ...l.side, split: clamp(base.current! + delta / h, 0.2, 0.85) } }));
  };
  const end = () => { base.current = null; };
  const both = s.ticket && s.watch;
  // A live crypto symbol has a book and a trades list; the lower section switches to them.
  const liveRef = symbol.startsWith("L:") ? instrumentForKey(symbol, null)?.live : undefined;
  const book = hasBook(liveRef?.src);
  const [lower, setLower] = useState<"watch" | "book">("book");
  const showBook = book && lower === "book";
  return (
    <div className={`ws ${s.dock === "left" ? "ws-left" : ""}`}>
      <div className="ws-center">
        <div className="ws-charts"><ChartGrid list={list} layout={layout} set={set} tool={tool} setTool={setTool} /></div>
        {bottom.open && <Splitter axis="y" label="Resize dock" value={bottom.height} min={BOTTOM_MIN} max={BOTTOM_MAX} onMove={dragBottom} onEnd={end} />}
        <div className="ws-dock" style={{ height: bottom.open ? bottom.height : undefined }}>
          <Dock tab={bottom.tab} onTab={(tab) => set((l) => ({ ...l, bottom: { ...l.bottom, tab } }))} open={bottom.open}
            onToggle={() => set((l) => ({ ...l, bottom: { ...l.bottom, open: !l.bottom.open } }))} tz={settings.tz} onSymbol={(k) => openSymbol(k, false)} active={symbol} />
        </div>
      </div>
      {s.open && <Splitter axis="x" label="Resize side panel" value={s.width} min={SIDE_MIN} max={SIDE_MAX} onMove={dragSide} onEnd={end} />}
      {s.open && (
        <aside ref={side} className="ws-side" style={{ width: s.width }} aria-label="Side panel">
          <section className={`sd ${s.ticket ? "" : "sd-closed"}`} style={both ? { flex: `${s.split} 1 0` } : s.ticket ? { flex: "1 1 0" } : undefined} aria-label="Order ticket">
            <SideHead label="Order" open={s.ticket} onToggle={() => set((l) => ({ ...l, side: { ...l.side, ticket: !l.side.ticket } }))}
              extra={<IconButton icon={s.dock === "right" ? "chevronLeft" : "chevronRight"} size="xs" variant="plain" className="sd-dock" onClick={() => set((l) => ({ ...l, side: { ...l.side, dock: l.side.dock === "right" ? "left" : "right" } }))} label={s.dock === "right" ? "Dock panel left" : "Dock panel right"} />} />
            {s.ticket && <div className="sd-body"><OrderTicket symbol={symbol} cue={cue} confirm={settings.confirm} onNeedConfirm={onConfirm} /></div>}
          </section>
          {both && <Splitter axis="y" label="Resize order and watchlist" value={Math.round(s.split * 100)} min={20} max={85} onMove={dragSplit} onEnd={end} />}
          <section className={`sd ${s.watch ? "" : "sd-closed"}`} style={both ? { flex: `${1 - s.split} 1 0` } : s.watch ? { flex: "1 1 0" } : undefined} aria-label="Watchlist">
            <SideHead label={showBook ? "Book" : "Watchlist"} open={s.watch} onToggle={() => set((l) => ({ ...l, side: { ...l.side, watch: !l.side.watch } }))}
              extra={book ? <Button size="xs" variant="ghost" className="sd-swap" onClick={() => setLower(showBook ? "watch" : "book")} title={showBook ? "Show watchlist" : "Show book and trades"}>{showBook ? "Watchlist" : "Book"}</Button> : undefined} />
            {s.watch && <div className="sd-body">{showBook && liveRef ? <BookPanel src={liveRef.src} sym={liveRef.sym} /> : <WatchMini list={list} current={symbol} onSymbol={(k) => openSymbol(k, false)} />}</div>}
          </section>
        </aside>
      )}
    </div>
  );
}

function SideHead({ label, open, onToggle, extra }: { label: string; open: boolean; onToggle: () => void; extra?: ReactNode }) {
  return (
    <div className="sd-head">
      <button type="button" className="sd-title" onClick={onToggle} aria-expanded={open}><Icon name={open ? "chevronDown" : "chevronRight"} size={11} />{label}</button>
      {extra}
    </div>
  );
}

function MobileChart({ mtab, list, layout, set, tool, setTool, symbol, cue, settings, openSymbol, go, onConfirm }: WsProps & { mtab: MTab; go: (v: View) => void }) {
  // One chart on a phone: the active one, shown as if maximised, without changing the saved grid.
  const one: Layout = { ...layout, max: layout.active };
  const set1 = (f: (l: Layout) => Layout) => set((l) => { const r = f({ ...l, max: l.active }); return { ...r, max: l.max }; });
  if (mtab === "watch") return <div className="m-pane"><WatchMini list={list} current={symbol} onSymbol={(k) => openSymbol(k)} /></div>;
  if (mtab === "ticket") return <div className="m-pane m-scroll"><OrderTicket symbol={symbol} cue={cue} confirm={settings.confirm} onNeedConfirm={onConfirm} /></div>;
  if (mtab === "dock") return <div className="m-pane"><Dock tab={layout.bottom.tab} onTab={(tab) => set((l) => ({ ...l, bottom: { ...l.bottom, tab } }))} open onToggle={() => {}} tz={settings.tz} onSymbol={(k) => openSymbol(k)} active={symbol} /></div>;
  if (mtab === "more") return <MoreSheet go={go} />;
  return <div className="m-pane"><ChartGrid list={list} layout={one} set={set1} tool={tool} setTool={setTool} /></div>;
}

function MoreSheet({ go }: { go: (v: View) => void }) {
  return (
    <nav className="m-more" aria-label="More">
      {VIEWS.filter((v) => v.id !== "chart").map((v) => (
        <button key={v.id} type="button" onClick={() => go(v.id)}><Icon name={v.icon} size={16} />{v.label}</button>
      ))}
    </nav>
  );
}
