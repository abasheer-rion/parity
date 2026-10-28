// The product home (DEC-0075): a greeting by first name, the Ask box, then the person's own
// grid of widgets. Each widget can be moved (drag, or Move up and down in its menu), folded or
// hidden, and the layout is saved to the person's account. A widget nobody clicks for a while
// folds itself. The personalization engine (DEC-0068) can rank the widgets and fill What's new
// through registry.setHomePlanner; until then each kind of person gets a sensible default order.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Button, Icon, PageTransition } from "../ui";
import type { Report } from "../lib/types";
import { greeting, saveFirstName, skipFirstName, useFirstName } from "../lib/firstName";
import { useOnboarding, stampsOf } from "../onboarding/store";
import { picksOf } from "../onboarding/introRules";
import { FirstRunTour } from "../onboarding/FirstRunTour";
import { NextStep } from "../onboarding/NextStep";
import { isDesktop } from "../desktop/bridge";
import { arrange, countSession, dropOn, getHomePlanner, isWidgetId, move, segmentOf, track, WIDGET_BY_ID, WIDGETS, type HomePlan, type WidgetId } from "./registry";
import { saveLayout, useLayout } from "./layoutStore";
import { useWidgetLayout } from "../lib/personalize/widgets";
import { usePersonal } from "../lib/personalize/usePersonal";
import { Frame } from "./Frame";
import "./home.css";

export interface WidgetProps { report: Report; plan: HomePlan | null; segment: ReturnType<typeof segmentOf> }

const BODY: Record<WidgetId, ComponentType<WidgetProps>> = {
  ticker: lazy(() => import("./widgets/Ticker")),
  strategies: lazy(() => import("./widgets/Strategies")),
  sims: lazy(() => import("./widgets/Sims")),
  "whats-new": lazy(() => import("./widgets/WhatsNew")),
  account: lazy(() => import("./widgets/Account")),
  heatmap: lazy(() => import("./widgets/Heatmap")),
  news: lazy(() => import("./widgets/News")),
  movers: lazy(() => import("./widgets/Movers")),
  algos: lazy(() => import("./widgets/Algos")),
  training: lazy(() => import("./widgets/Training")),
};

const SESSION_KEY = "parity.home.counted";
// The engine's view of the widgets: registry order, and the account never folds.
const PZ_WIDGETS = WIDGETS.map((w, i) => ({ id: w.id, order: i, required: w.id === "account" }));

export function Home({ report }: { report: Report }) {
  const ob = useOnboarding();
  const stamps = stampsOf(ob.row);
  const segment = segmentOf(picksOf(ob.row), { trade: !!stamps.trade, lesson: !!stamps.lesson, verify: !!stamps.verify, watch: !!stamps.watch });
  const layout = useLayout(segment);
  const [plan, setPlan] = useState<HomePlan | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const p = getHomePlanner();
    if (!p) return;
    let live = true;
    void p({ segment, widgets: WIDGETS.map((w) => w.id) }).then((r) => { if (live) setPlan(r); }).catch(() => {});
    return () => { live = false; };
  }, [segment]);
  // The personalization engine (DEC-0068) ranks and folds widgets while it is on. With it off,
  // nothing folds by itself and the person's own or default order is used. Only where there is
  // no account to read it from (signed out, offline, the local preview) does Home fold an unused
  // widget on its own, from this browser's count.
  const personal = usePersonal();
  const pz = useWidgetLayout(PZ_WIDGETS);
  const pzOn = !!personal?.settings.enabled;
  const merged = useMemo<HomePlan | null>(() => (pzOn ? { ...plan, order: pz.order.filter(isWidgetId), collapse: pz.collapsed.filter(isWidgetId) } : plan), [pzOn, plan, pz.order, pz.collapsed]);
  const { shown, collapsed, auto } = useMemo(() => arrange(personal === null ? layout : { ...layout, ignored: {} }, merged), [layout, merged, personal, pzOn]);
  const hidden = WIDGETS.filter((w) => !shown.includes(w.id));

  // Count this visit once per browser session: seen and not used adds one ignored session.
  const seen = useRef(new Set<WidgetId>());
  const used = useRef(new Set<WidgetId>());
  const latest = useRef(layout);
  latest.current = layout;
  useEffect(() => {
    const commit = () => {
      try { if (window.sessionStorage.getItem(SESSION_KEY)) return; window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { return; }
      if (seen.current.size) saveLayout(countSession(latest.current, seen.current, used.current));
    };
    const onHide = () => { if (document.visibilityState === "hidden") commit(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); commit(); };
  }, []);

  const tested = report.runs.filter((r) => !r.is_benchmark && r.gauntlet);
  const beating = tested.filter((r) => r.gauntlet?.beats_sp500).length;
  const name = useFirstName();

  return (
    <PageTransition className="phome home2">
      <section className="h2-hero">
        <div className="h2-hello">
          <h1>{greeting(name.name)}</h1>
          <p className="muted">{tested.length} strategies, each run through the same tests. {beating === 0 ? "None beats holding the US stock market." : `${beating} beat holding the US stock market.`}</p>
        </div>
        <button className="ask" onClick={() => window.dispatchEvent(new Event("parity:search"))}>
          <Icon name="sparkle" size={16} />
          <span>Ask anything: "what is carry", "does anything beat the market"</span>
        </button>
      </section>
      <NextStep />
      {!name.name && !name.asked && <AskName />}
      <FirstRunTour areas={isDesktop() ? ["home", "desktop"] : ["home"]} />

      <div className="h2-bar">
        <button type="button" className={`h2-edit ${editing ? "on" : ""}`} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
          <Icon name="gear" size={13} /> {editing ? "Done" : "Customise"}
        </button>
        {editing && hidden.length > 0 && (
          <div className="h2-hidden" role="group" aria-label="Hidden widgets">
            <span className="muted small">Add back:</span>
            {hidden.map((w) => (
              <button key={w.id} type="button" className="chip" title={w.what}
                onClick={() => { saveLayout({ ...layout, hidden: layout.hidden.filter((x) => x !== w.id), custom: true }); track(w.id, "restore"); }}>
                <Icon name="plus" size={12} /> {w.title}
              </button>
            ))}
          </div>
        )}
        {editing && <span className="muted small">Drag a widget by its handle, or use its menu to move it.</span>}
      </div>

      <div className="h2-grid">
        {shown.map((id, i) => {
          const Body = BODY[id];
          return (
            <Frame key={id} def={WIDGET_BY_ID[id]} collapsed={collapsed.has(id)} auto={auto.has(id)} first={i === 0} last={i === shown.length - 1} editing={editing}
              onCollapse={(v) => { if (pzOn) void (v ? pz.collapse(id) : pz.restore(id)); saveLayout({
                ...layout,
                collapsed: v ? [...new Set([...layout.collapsed, id])] : layout.collapsed.filter((x) => x !== id),
                kept: v ? layout.kept.filter((x) => x !== id) : [...new Set([...layout.kept, id])],
                ignored: v ? layout.ignored : { ...layout.ignored, [id]: 0 },
              }); }}
              onMove={(by) => saveLayout(move(layout, id, by, shown))}
              onHide={() => saveLayout({ ...layout, hidden: [...new Set([...layout.hidden, id])], custom: true })}
              onDrop={(from) => { if (WIDGET_BY_ID[from]) saveLayout(dropOn(layout, from, id, shown)); }}
              onSeen={() => { seen.current.add(id); pz.markSeen(id); }} onUsed={() => { used.current.add(id); pz.markUsed(id); }}>
              <Suspense fallback={<div className="w-load" aria-hidden />}>
                <Body report={report} plan={merged} segment={segment} />
              </Suspense>
            </Frame>
          );
        })}
      </div>
      <p className="muted small phome-foot">
        Results are backtests after trading costs. Past results do not predict future ones.
      </p>
    </PageTransition>
  );
}

/** Asked once when the profile has no first name: never greet by an email or username. */
function AskName() {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="h2-name" onSubmit={(e) => { e.preventDefault(); void saveFirstName(v).then(setErr); }}>
      <label htmlFor="h2-first">What should we call you?</label>
      <input id="h2-first" className="ui-input" autoComplete="given-name" maxLength={30} value={v} onChange={(e) => setV(e.target.value)} placeholder="First name" />
      <Button type="submit" variant="primary" size="sm">Save</Button>
      <Button variant="ghost" size="sm" onClick={skipFirstName}>Not now</Button>
      {err && <span className="h2-err" role="alert">{err}</span>}
    </form>
  );
}
