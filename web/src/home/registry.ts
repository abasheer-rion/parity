// The product home's widgets (DEC-0075): one list with stable ids, the order each kind of
// person sees first, and the one place widget events go. The personalization engine
// (DEC-0068, lib/personalize) plugs in here: it can set a planner that ranks, collapses
// and hides widgets and fills What's new, and it can listen to every view, click and
// dismiss. Until it does, Home uses DEFAULT_ORDER and the local "ignored" rule below.
// No React here, so the rules are unit tested (tests/home.test.ts).
import { track as analytics } from "../lib/analytics";

export type WidgetId =
  | "ticker" | "strategies" | "sims" | "whats-new" | "account" | "heatmap" | "news" | "movers" | "algos" | "training";

/** Same names as lib/personalize's Segment, so its profile drops straight in. */
export type Segment = "new" | "learner" | "trader" | "both" | "browser";

export interface WidgetDef {
  id: WidgetId;
  title: string;
  /** What it shows, for the "Add widgets" list and the hover text. */
  what: string;
  /** Grid width: 1 = one column, 2 = two columns, "full" = the whole row. */
  span: 1 | 2 | "full";
  /** Space held while it loads, so nothing below it moves when it arrives (px). */
  minHeight: number;
  /** The same on a phone, where text wraps more (px). */
  phoneMin: number;
}

export const WIDGETS: WidgetDef[] = [
  { id: "ticker", title: "Ticker tape", what: "Prices scrolling across the top, each with how late it is", span: "full", minHeight: 44, phoneMin: 44 },
  { id: "strategies", title: "Strategies to look at", what: "The strongest strategies by our tests, with their last 12 months as candles", span: "full", minHeight: 470, phoneMin: 500 },
  { id: "sims", title: "Sims running now", what: "Sims and searches you started, and the always-on sims", span: 1, minHeight: 440, phoneMin: 440 },
  { id: "whats-new", title: "What's new", what: "New strategies, lessons and tools picked for you", span: 1, minHeight: 800, phoneMin: 840 },
  { id: "account", title: "Your account", what: "Demo account value, profit and loss, positions and watchlist", span: 1, minHeight: 440, phoneMin: 440 },
  { id: "heatmap", title: "Market heatmap", what: "S&P 500 and Nasdaq-100 companies, sized by value", span: 2, minHeight: 480, phoneMin: 570 },
  { id: "news", title: "Market news", what: "Headlines with how far markets moved after them", span: "full", minHeight: 640, phoneMin: 1580 },
  { id: "movers", title: "Biggest movers", what: "Coins, ETFs and stocks that moved most", span: 1, minHeight: 480, phoneMin: 620 },
  { id: "algos", title: "New algos", what: "Strategies added to the library and the search most recently", span: 1, minHeight: 480, phoneMin: 730 },
  { id: "training", title: "Training", what: "Academy courses and where you left off", span: 1, minHeight: 440, phoneMin: 470 },
];
export const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w])) as Record<WidgetId, WidgetDef>;
export const isWidgetId = (v: unknown): v is WidgetId => typeof v === "string" && v in WIDGET_BY_ID;

/** What each kind of person sees first. Every widget appears in every order. */
export const DEFAULT_ORDER: Record<Segment, WidgetId[]> = {
  new: ["ticker", "strategies", "whats-new", "training", "account", "heatmap", "news", "movers", "algos", "sims"],
  learner: ["ticker", "training", "strategies", "whats-new", "news", "heatmap", "account", "movers", "algos", "sims"],
  trader: ["ticker", "account", "strategies", "heatmap", "movers", "news", "sims", "whats-new", "algos", "training"],
  both: ["ticker", "account", "strategies", "sims", "whats-new", "heatmap", "news", "movers", "algos", "training"],
  browser: ["ticker", "strategies", "heatmap", "news", "movers", "whats-new", "algos", "account", "training", "sims"],
};

/** A widget seen this many sessions in a row without a click is collapsed, unless the
 *  person chose to keep it open. The same number as the personalization engine's rule. */
export const IGNORED_LIMIT = 8;

export interface WhatsNewItem {
  id: string;
  kind: "algo" | "lesson" | "tool" | "market" | "scenario" | "verify";
  /** One true line from our own data that makes someone want to look. */
  hook: string;
  /** What it is, in a few words. */
  title: string;
  href: string;
  /** Where the number in the hook comes from. */
  source: string;
}

export interface HomePlan { order?: WidgetId[]; collapse?: WidgetId[]; hide?: WidgetId[]; feed?: WhatsNewItem[] }
export type HomePlanner = (ctx: { segment: Segment; widgets: WidgetId[] }) => Promise<HomePlan | null>;

let planner: HomePlanner | null = null;
/** The personalization engine calls this once to take over ranking and the feed. */
export function setHomePlanner(p: HomePlanner | null) { planner = p; }
export function getHomePlanner(): HomePlanner | null { return planner; }

export type WidgetEvent = "view" | "click" | "dismiss" | "collapse" | "expand" | "move" | "hide" | "restore";
type Listener = (widget: WidgetId, ev: WidgetEvent, item?: string) => void;
const listeners = new Set<Listener>();
/** Listen to every widget event (the personalization engine logs them). Returns an unsubscribe. */
export function onWidgetEvent(f: Listener): () => void { listeners.add(f); return () => listeners.delete(f); }

/** Records a widget event: product analytics (only with consent, lib/analytics) and listeners. */
export function track(widget: WidgetId, ev: WidgetEvent, item?: string) {
  analytics(`home_widget_${ev}`, item ? { widget, item: item.slice(0, 40) } : { widget });
  for (const f of listeners) { try { f(widget, ev, item); } catch { /* a listener never breaks Home */ } }
}

export interface Layout {
  order: WidgetId[];
  hidden: WidgetId[];
  collapsed: WidgetId[];
  /** Widgets the person opened again after an automatic collapse: never collapse them again. */
  kept: WidgetId[];
  /** Sessions in a row each widget was on screen without a click. */
  ignored: Partial<Record<WidgetId, number>>;
  /** True once the person moved or hid something: their order then wins over any planner. */
  custom: boolean;
}

export const emptyLayout = (segment: Segment = "new"): Layout =>
  ({ order: [...DEFAULT_ORDER[segment]], hidden: [], collapsed: [], kept: [], ignored: {}, custom: false });

/** A saved layout made safe: unknown ids dropped, missing widgets added at the end. */
export function normalize(raw: unknown, segment: Segment): Layout {
  const base = emptyLayout(segment);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof Layout, unknown>>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter(isWidgetId))] : []);
  const order = ids(r.order);
  for (const id of base.order) if (!order.includes(id)) order.push(id);
  const ignored: Layout["ignored"] = {};
  if (r.ignored && typeof r.ignored === "object") {
    for (const [k, v] of Object.entries(r.ignored)) if (isWidgetId(k) && typeof v === "number" && v >= 0) ignored[k] = Math.min(999, Math.floor(v));
  }
  return { order, hidden: ids(r.hidden), collapsed: ids(r.collapsed), kept: ids(r.kept), ignored, custom: r.custom === true };
}

/** The order to draw: the person's own order once they changed it, else the planner's,
 *  else the default for their segment. Hidden widgets are left out. */
export function arrange(layout: Layout, plan: HomePlan | null): { shown: WidgetId[]; collapsed: Set<WidgetId>; auto: Set<WidgetId> } {
  let order = layout.order;
  if (!layout.custom && plan?.order?.length) {
    const p = plan.order.filter(isWidgetId);
    order = [...p, ...layout.order.filter((id) => !p.includes(id))];
  }
  const hide = new Set([...layout.hidden, ...(layout.custom ? [] : plan?.hide ?? [])]);
  const auto = new Set<WidgetId>();
  for (const id of order) {
    if (layout.kept.includes(id) || layout.collapsed.includes(id)) continue;
    if ((layout.ignored[id] ?? 0) >= IGNORED_LIMIT || plan?.collapse?.includes(id)) auto.add(id);
  }
  return { shown: order.filter((id) => !hide.has(id)), collapsed: new Set([...layout.collapsed, ...auto]), auto };
}

/** End of a session: widgets seen and not used count one more ignored session; used ones reset. */
export function countSession(layout: Layout, seen: Set<WidgetId>, used: Set<WidgetId>): Layout {
  const ignored = { ...layout.ignored };
  for (const id of seen) ignored[id] = used.has(id) ? 0 : (ignored[id] ?? 0) + 1;
  for (const id of used) ignored[id] = 0;
  return { ...layout, ignored };
}

/** Moves a widget one place earlier (-1) or later (+1) in the shown order. */
export function move(layout: Layout, id: WidgetId, by: -1 | 1, shown: WidgetId[]): Layout {
  const i = shown.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= shown.length) return layout;
  const next = [...shown];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...layout, order: [...next, ...layout.order.filter((x) => !next.includes(x))], custom: true };
}

/** Puts a dragged widget where another one is. */
export function dropOn(layout: Layout, id: WidgetId, target: WidgetId, shown: WidgetId[]): Layout {
  if (id === target) return layout;
  const next = shown.filter((x) => x !== id);
  next.splice(next.indexOf(target) + (shown.indexOf(id) < shown.indexOf(target) ? 1 : 0), 0, id);
  return { ...layout, order: [...next, ...layout.order.filter((x) => !next.includes(x))], custom: true };
}

/** The kind of person, from what they picked in the welcome and what they have done. */
export function segmentOf(picks: string[], done: { trade?: boolean; lesson?: boolean; verify?: boolean; watch?: boolean }): Segment {
  const trades = done.trade || picks.includes("trade");
  const learns = done.lesson || picks.includes("learn");
  if (trades && learns) return "both";
  if (trades) return "trader";
  if (learns) return "learner";
  if (done.verify || done.watch || picks.includes("strategies") || picks.includes("verify")) return "browser";
  return "new";
}
