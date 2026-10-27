// What's new on the product home (DEC-0068): research results, Academy courses, Workbench tools,
// markets pages, Sim World scenarios and Verify, ranked for the person (lib/personalize/rank.ts).
// Each card says why it is there. The lines describe past test results; none is advice to put
// money anywhere, and the app footer carries the research-only line (REF-0017 rule 11).
// Shows, clicks and dismissals are stored only while personalization is on; with it off the
// feed is newest first and nothing is recorded.
import { useEffect, useMemo, useRef, useState } from "react";
import { allCandidates, type CandidateSources } from "../lib/personalize/candidates";
import { lineFor } from "../lib/personalize/hooks";
import { loadArms, logReco, type Arm } from "../lib/personalize/api";
import { trackOutcome, useVariant } from "../lib/personalize/experiments";
import { rank, type Ranked } from "../lib/personalize/rank";
import { reloadPersonal, usePersonal } from "../lib/personalize/usePersonal";
import { storeUserId } from "../lib/userStore";
import type { Report } from "../lib/types";
import { Disclosure, IconButton } from "../ui";
import "./whatsNew.css";

export function WhatsNew({ report }: { report: Report }) {
  const personal = usePersonal();
  const order = useVariant("whats_new_order");
  const hook = useVariant("whats_new_hook");
  const [extra, setExtra] = useState<CandidateSources>({});
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [gone, setGone] = useState<string[]>([]);

  // Courses, bots and the algorithm library load after the page, so Home does not wait on them.
  useEffect(() => {
    let live = true;
    void Promise.all([
      import("../lib/academy").then((m) => m.courses).catch(() => null),
      import("../lib/bots").then((m) => m.loadBotsIndex()).then((r) => (r.status === "ok" ? r.data : null)).catch(() => null),
      import("../lib/docs").then((m) => m.loadDocIndex()).catch(() => null),
    ]).then(([courses, bots, docs]) => { if (live) setExtra({ courses, bots, docs }); });
    return () => { live = false; };
  }, []);

  const cands = useMemo(() => allCandidates({ report, ...extra }), [report, extra]);
  const on = !!personal?.settings.enabled;

  useEffect(() => {
    if (!on) { setArms([]); return; }
    let live = true;
    void loadArms(cands.map((c) => c.item)).then((a) => { if (live) setArms(a); });
    return () => { live = false; };
  }, [on, cands]);

  const ready = personal !== undefined && order.ready && hook.ready && arms !== null;
  const items: Ranked[] = useMemo(() => {
    if (!ready) return [];
    return rank(cands, {
      profile: on ? personal?.profile ?? null : null,
      arms: arms ?? [],
      feedback: personal?.feedback ?? [],
      seed: storeUserId() ?? "anon",
      order: on ? order.variant : "control",
      limit: 6,
    }).filter((r) => !gone.includes(r.item));
  }, [ready, cands, on, personal, arms, order.variant, gone]);

  // One show per item per page view; the database counts at most one an hour.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!on || !items.length) return;
    const fresh = items.filter((r) => !shown.current.has(r.item));
    if (!fresh.length) return;
    fresh.forEach((r) => shown.current.add(r.item));
    void logReco(fresh.map((r) => ({ item: r.item, ev: "show", tags: r.tags })));
  }, [on, items]);

  if (!ready || !items.length) return null;
  const withHook = !on || hook.variant !== "control";

  const open = (r: Ranked) => {
    if (!on) return;
    void logReco([{ item: r.item, ev: "click", tags: r.tags }]);
    trackOutcome("whats_new_click");
  };
  const dismiss = (r: Ranked) => {
    setGone((g) => [...g, r.item]);
    if (!on) return;
    void logReco([{ item: r.item, ev: "dismiss", tags: r.tags }]).then(() => reloadPersonal());
    trackOutcome("whats_new_dismiss");
  };

  return (
    <section className="wn" aria-labelledby="wn-title">
      <div className="wn-head">
        <h2 id="wn-title">What's new</h2>
        <a className="muted small" href="#/settings/personalization">{on ? "Picked from how you use Parity" : "Newest first"}</a>
      </div>
      <ul className="wn-list">
        {items.map((r) => (
          <li key={r.item} className="wn-card">
            <div className="wn-top">
              <a className="wn-title" href={r.href} onClick={() => open(r)}>{r.title}</a>
              <IconButton icon="close" label={`Hide ${r.title}`} size="sm" onClick={() => dismiss(r)} />
            </div>
            <p className="wn-line">{lineFor(r, withHook)}</p>
            <Disclosure summary="Why you see this" className="wn-why">
              <ul>{r.why.map((w) => <li key={w}>{w}</li>)}</ul>
            </Disclosure>
          </li>
        ))}
      </ul>
    </section>
  );
}
