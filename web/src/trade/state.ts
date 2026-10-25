// Parity Trade's own state (DEC-0040): which view is open, the workspace layout (chart
// grid, panels and their sizes) and the settings. The working layout and the settings are
// kept in this browser; named layouts are saved to the account (layouts.ts).
import { CHART_TYPES, type ChartType } from "../ui/proChart";
import { TIMEFRAMES, type Timeframe } from "../lib/bars";
import { INDICATORS, type IndicatorInstance } from "../lib/indicators";
import { readPref, writePref } from "./shared";
import { LIVE_TFS, type LiveTf } from "../lib/live/candles";
import { RULES } from "../lib/signals";

export type View = "chart" | "watchlists" | "screener" | "portfolio" | "orders" | "alerts" | "strategies" | "settings";

export const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "chart", label: "Chart", icon: "graph" },
  { id: "watchlists", label: "Watchlists", icon: "list" },
  { id: "screener", label: "Screener", icon: "filter" },
  { id: "portfolio", label: "Portfolio", icon: "chart" },
  { id: "orders", label: "Orders", icon: "table" },
  { id: "alerts", label: "Alerts", icon: "bell" },
  { id: "strategies", label: "Strategies", icon: "flask" },
  { id: "settings", label: "Settings", icon: "gear" },
];
export const VIEW_IDS = VIEWS.map((v) => v.id);

export type DockTab = "positions" | "orders" | "fills" | "pnl";
export type Grid = 1 | 2 | 4;
export interface Cell { symbol: string; tf: Timeframe; /** A second symbol drawn over the chart, both indexed to 100. */ cmp?: string; /** Timeframe for a live symbol (DEC-0049). */ ltf?: LiveTf }

export interface Layout {
  grid: Grid;
  cells: Cell[];
  active: number;
  /** A maximised chart cell, or null. */
  max: number | null;
  type: ChartType;
  log: boolean;
  indicators: IndicatorInstance[];
  /** Strategy rules drawn as buy, sell and exit markers (DEC-0049). */
  signals: string[];
  side: { open: boolean; width: number; dock: "right" | "left"; ticket: boolean; watch: boolean; split: number };
  bottom: { open: boolean; height: number; tab: DockTab };
}

export interface Settings {
  symbol: string;
  type: ChartType;
  tf: Timeframe;
  /** "local" or an IANA time zone, for order and fill times. */
  tz: string;
  density: "compact" | "comfortable";
  typeToSearch: boolean;
  /** Shift+B and Shift+S place a market order at once, instead of opening the ticket. */
  oneKey: boolean;
  confirm: boolean;
}

export const TIME_ZONES: [string, string][] = [
  ["local", "Local"], ["UTC", "UTC"], ["America/New_York", "New York"], ["America/Chicago", "Chicago"], ["Europe/London", "London"],
  ["Europe/Berlin", "Frankfurt"], ["Asia/Tokyo", "Tokyo"], ["Asia/Hong_Kong", "Hong Kong"], ["Australia/Sydney", "Sydney"],
];

export const DEFAULT_SYMBOLS = ["eq.US_MKT", "crypto.BTC", "fx.EUR", "cmd.WTI"];
export const DEFAULT_SIGNALS = ["fx_trend_3m", "fx_macd", "fx_donchian"];
const RULE_IDS = RULES.map((r) => r.id);
const LTF_IDS = LIVE_TFS.map((t) => t.id);

export const DEFAULT_SETTINGS: Settings = {
  symbol: "eq.US_MKT", type: "candles", tf: "D", tz: "local", density: "compact", typeToSearch: true, oneKey: false, confirm: false,
};

export function freshLayout(s: Settings = DEFAULT_SETTINGS): Layout {
  return {
    grid: 1,
    cells: DEFAULT_SYMBOLS.map((sym, i) => ({ symbol: i === 0 ? s.symbol : sym, tf: s.tf })),
    active: 0,
    max: null,
    type: s.type,
    log: false,
    indicators: [{ id: "sma50", type: "sma", params: { n: 50 } }, { id: "rsi14", type: "rsi", params: { n: 14 } }],
    signals: DEFAULT_SIGNALS,
    side: { open: true, width: 300, dock: "right", ticket: true, watch: true, split: 0.62 },
    bottom: { open: true, height: 220, tab: "positions" },
  };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const oneOf = <T,>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const TF_IDS = TIMEFRAMES.map((t) => t.id);
const TYPE_IDS = CHART_TYPES.map(([t]) => t);
const IND_TYPES = INDICATORS.map((d) => d.type);
export const SIDE_MIN = 240, SIDE_MAX = 560, BOTTOM_MIN = 120, BOTTOM_MAX = 520;

/** A layout from storage or the database, checked field by field; anything odd falls back. */
export function cleanLayout(raw: unknown, s: Settings = DEFAULT_SETTINGS): Layout {
  const d = freshLayout(s);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const side = (r.side ?? {}) as Record<string, unknown>;
  const bottom = (r.bottom ?? {}) as Record<string, unknown>;
  const cells = Array.isArray(r.cells) ? r.cells : [];
  const grid = oneOf(r.grid, [1, 2, 4] as const, d.grid);
  const inds = Array.isArray(r.indicators) ? r.indicators : d.indicators;
  return {
    grid,
    cells: d.cells.map((c, i) => {
      const x = (cells[i] ?? {}) as Record<string, unknown>;
      const cell: Cell = { symbol: typeof x.symbol === "string" && x.symbol.length < 80 ? x.symbol : c.symbol, tf: oneOf(x.tf, TF_IDS, c.tf) };
      if (typeof x.cmp === "string" && x.cmp.length > 0 && x.cmp.length < 80) cell.cmp = x.cmp;
      if (LTF_IDS.includes(x.ltf as LiveTf)) cell.ltf = x.ltf as LiveTf;
      return cell;
    }),
    active: Math.round(clamp(r.active, 0, grid - 1, 0)),
    max: r.max == null ? null : Math.round(clamp(r.max, 0, grid - 1, 0)),
    type: oneOf(r.type, TYPE_IDS, d.type),
    log: r.log === true,
    indicators: inds.slice(0, 12).flatMap((x): IndicatorInstance[] => {
      const i = x as Record<string, unknown>;
      if (typeof i?.id !== "string" || !IND_TYPES.includes(i.type as never)) return [];
      const params: Record<string, number> = {};
      for (const [k, v] of Object.entries((i.params ?? {}) as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) params[k] = v;
      return [{ id: i.id, type: i.type as IndicatorInstance["type"], params }];
    }),
    signals: Array.isArray(r.signals) ? [...new Set(r.signals.filter((x): x is string => RULE_IDS.includes(x as string)))] : d.signals,
    side: {
      open: side.open !== false, width: clamp(side.width, SIDE_MIN, SIDE_MAX, d.side.width), dock: oneOf(side.dock, ["right", "left"] as const, "right"),
      ticket: side.ticket !== false, watch: side.watch !== false, split: clamp(side.split, 0.2, 0.85, d.side.split),
    },
    bottom: { open: bottom.open !== false, height: clamp(bottom.height, BOTTOM_MIN, BOTTOM_MAX, d.bottom.height), tab: oneOf(bottom.tab, ["positions", "orders", "fills", "pnl"] as const, "positions") },
  };
}

export function readSettings(): Settings {
  const s = readPref<Settings>("settings", DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS, ...s,
    type: oneOf(s.type, TYPE_IDS, DEFAULT_SETTINGS.type), tf: oneOf(s.tf, TF_IDS, DEFAULT_SETTINGS.tf),
    tz: TIME_ZONES.some(([z]) => z === s.tz) ? s.tz : "local", density: oneOf(s.density, ["compact", "comfortable"] as const, "compact"),
  };
}
export const writeSettings = (s: Settings) => writePref("settings", s);

export const readLayout = (s: Settings) => cleanLayout(readPref<unknown>("layout", null), s);
export const writeLayout = (l: Layout) => writePref("layout", l);

/** A date and time in the chosen zone, short: "24 Oct 14:05". */
export function timeIn(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, ...(tz === "local" ? {} : { timeZone: tz }) });
}
