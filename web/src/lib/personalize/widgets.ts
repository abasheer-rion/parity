// Home widget adaptation (DEC-0068): widgets the person uses move up, and, in the
// widget_defaults experiment's "collapse5" arm, a widget passed over for 5 sessions in a row
// folds down to its title. Required widgets (the account and the disclaimer) keep their place
// and never fold. A widget the person chose to keep never folds; one they folded stays folded
// until they restore it. Every folded widget has a Restore button. With personalization off,
// the registry order is used and nothing folds.
//
// Home v2 owns the widget registry: each widget has a stable id and an order, and calls
// track() on view, click and dismiss. It calls useWidgetLayout(widgets) and renders in
// `order`, drawing ids in `collapsed` as a title row with restore(id).
import { useCallback, useEffect, useMemo, useRef } from "react";
import { widgetChoose, widgetSeen, type Profile, type WidgetState } from "./api";
import { trackOutcome, useVariant } from "./experiments";
import { readSession, writeSession } from "./session";
import { reloadPersonal, usePersonal } from "./usePersonal";

export interface WidgetDef { id: string; required?: boolean; order: number }

/** Never folded, never moved. */
export const REQUIRED_WIDGETS = ["account", "disclaimer"];

export interface Layout { order: string[]; collapsed: string[] }

/**
 * Orders widgets by predicted usefulness, (uses + 1) / (uses + passed-over sessions + 2), ties
 * by the registry order; required widgets stay at their registry position. `collapseAfter`
 * folds widgets passed over that many sessions (leave it out to fold nothing automatically).
 */
export function adaptWidgets(widgets: WidgetDef[], state: WidgetState[] | null | undefined, profile: Profile | null | undefined, opts: { collapseAfter?: number; enabled?: boolean } = {}): Layout {
  const base = [...widgets].sort((a, b) => a.order - b.order);
  const isRequired = (w: WidgetDef) => w.required || REQUIRED_WIDGETS.includes(w.id);
  if (opts.enabled === false || (!state?.length && !profile)) return { order: base.map((w) => w.id), collapsed: [] };
  const byId = new Map((state ?? []).map((s) => [s.widget_id, s]));
  const useful = (w: WidgetDef) => {
    const s = byId.get(w.id);
    const used = profile?.widgets?.[w.id]?.used ?? 0;
    const ignored = s?.ignored_sessions ?? profile?.widgets?.[w.id]?.ignored_sessions ?? 0;
    const recent = s?.last_used_at ? Math.exp(-(Date.now() - Date.parse(s.last_used_at)) / (14 * 86_400_000)) : 0;
    const pin = s?.choice === "keep" ? 0.5 : 0;
    return (used + 1) / (used + ignored + 2) + 0.2 * (Number.isFinite(recent) ? recent : 0) + pin;
  };
  const movable = base.filter((w) => !isRequired(w)).map((w) => ({ w, u: useful(w) })).sort((a, b) => b.u - a.u || a.w.order - b.w.order).map((x) => x.w);
  const order: string[] = [];
  let m = 0;
  for (const w of base) order.push(isRequired(w) ? w.id : movable[m++].id);
  const collapsed = base.filter((w) => {
    if (isRequired(w)) return false;
    const s = byId.get(w.id);
    if (s?.choice === "keep") return false;
    if (s?.choice === "collapse") return true;
    return opts.collapseAfter != null && (s?.ignored_sessions ?? 0) >= opts.collapseAfter;
  }).map((w) => w.id);
  // Folded widgets go after the open ones (required ones still hold their place).
  const folded = new Set(collapsed);
  const open = order.filter((id) => !folded.has(id));
  return { order: [...open, ...order.filter((id) => folded.has(id))], collapsed };
}

/** For Home v2: the layout, and calls to report use and to fold or restore a widget. */
export function useWidgetLayout(widgets: WidgetDef[]) {
  const personal = usePersonal();
  const { variant } = useVariant("widget_defaults");
  const enabled = !!personal?.settings.enabled;
  const layout = useMemo(
    () => adaptWidgets(widgets, personal?.widgets, personal?.profile, { enabled, collapseAfter: variant === "collapse5" ? 5 : undefined }),
    [widgets, personal, enabled, variant],
  );
  const seen = useRef(new Set<string>());
  const used = useRef(new Set<string>());

  // Reports the session once, when the page is hidden or left: widgets on screen and widgets used.
  useEffect(() => {
    if (!enabled) return;
    const send = () => {
      if (readSession().counted || !seen.current.size) return;
      writeSession({ counted: true });
      void widgetSeen([...seen.current], [...used.current]);
    };
    const onHide = () => { if (document.visibilityState === "hidden") send(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", send); send(); };
  }, [enabled]);

  const markSeen = useCallback((id: string) => { seen.current.add(id); }, []);
  const markUsed = useCallback((id: string) => {
    seen.current.add(id);
    if (!used.current.has(id)) { used.current.add(id); trackOutcome("widget_used"); }
  }, []);
  const restore = useCallback(async (id: string) => {
    await widgetChoose(id, "keep");
    trackOutcome("widget_restore");
    await reloadPersonal();
  }, []);
  const collapse = useCallback(async (id: string) => {
    if (REQUIRED_WIDGETS.includes(id) || widgets.find((w) => w.id === id)?.required) return;
    await widgetChoose(id, "collapse");
    await reloadPersonal();
  }, [widgets]);
  return { ...layout, markSeen, markUsed, restore, collapse };
}
