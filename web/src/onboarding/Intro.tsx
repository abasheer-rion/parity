// The first-run intro (DEC-0077): one question per screen, then one real Verify result, then
// Home. Full screen over the app, which is inert behind it. Each screen fades and rises in,
// and the last one fades out with a little blur, Linear style; with reduced motion they only
// crossfade. Every screen can be skipped, Escape ends the intro, and the screen and answers
// are saved as they change, so a closed tab comes back where it was.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadReport, loadSearch } from "../lib/data";
import { nameOf, tagsOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { checkStrategy } from "../lib/verify/checks";
import { SignatureFrame, type SigVisual } from "../ui/signature";
import { useReducedMotion } from "../ui/presence";
import { fmt } from "../ui/text";
import { durationMs } from "../ui/tokens";
import { useResource } from "../ui";
import { track } from "../lib/analytics";
import { GOALS, LEVELS, MARKETS, SCREENS, sampleFor, type IntroGoal, type IntroLevel, type IntroMarket, type Option } from "./introRules";
import { endIntro, saveIntro, type OnboardingRow } from "./store";
import "./intro.css";

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

export interface IntroProps {
  report: Report | null;
  row: OnboardingRow;
  startAt: number;
  onClose: () => void;
}

export function Intro({ report, row, startAt, onClose }: IntroProps) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(startAt);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [goal, setGoal] = useState<IntroGoal | null>(row.intro_goal);
  const [level, setLevel] = useState<IntroLevel | null>(row.intro_level);
  const [markets, setMarkets] = useState<IntroMarket[]>(row.intro_markets ?? []);
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef(0);
  const id = useId();
  const screen = SCREENS[step];

  useEffect(() => { track("intro_screen", { screen, step }); }, [screen, step]);

  // The app behind is inert and does not scroll while the intro is up.
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const before = html.style.overflow;
    root?.setAttribute("inert", "");
    html.style.overflow = "hidden";
    return () => { root?.removeAttribute("inert"); html.style.overflow = before; window.clearTimeout(timer.current); };
  }, []);

  // Each new screen's question takes focus, so a screen reader reads it out.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  /** Moves to another screen: the current one fades out, the next one rises in. */
  const goTo = useCallback((next: number) => {
    const n = Math.max(0, Math.min(SCREENS.length - 1, next));
    void saveIntro({ intro_step: n });
    if (reduced) { setStep(n); return; }
    setLeaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setLeaving(false); setStep(n); }, durationMs("dur-2"));
  }, [reduced]);

  /** Ends the intro: finished on the last screen, skipped anywhere else. */
  const end = useCallback((status: "done" | "skipped", then?: string) => {
    void endIntro(status, step);
    const close = () => { onClose(); if (then) window.location.hash = then; };
    if (reduced) { close(); return; }
    setClosing(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(close, durationMs("dur-3"));
  }, [onClose, reduced, step]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(screen === "result" ? "done" : "skipped"); return; }
    if (e.key !== "Tab" || !box.current) return;
    const list = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!list.length) return;
    const a = list[0], z = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === a || document.activeElement === heading.current)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };

  const pickGoal = (g: IntroGoal) => { setGoal(g); void saveIntro({ intro_goal: g }); track("intro_answer", { q: "goal", a: g }); goTo(step + 1); };
  const pickLevel = (l: IntroLevel) => { setLevel(l); void saveIntro({ intro_level: l }); track("intro_answer", { q: "level", a: l }); goTo(step + 1); };
  const toggleMarket = (m: IntroMarket) => setMarkets((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]));
  const saveMarkets = () => { void saveIntro({ intro_markets: markets }); track("intro_answer", { q: "markets", a: markets.join(",") || "none" }); goTo(step + 1); };

  const head = (title: string, lead: string) => (
    <header className="intro-head">
      <h1 id={`${id}-q`} ref={heading} tabIndex={-1} className="intro-q">{title}</h1>
      <p className="intro-lead">{lead}</p>
    </header>
  );

  let body: ReactNode;
  if (screen === "goal") {
    body = (
      <>
        {head("What brings you to Parity?", "Pick one. It changes what Home shows first. You can change it later.")}
        <Choices options={GOALS} value={goal} onPick={pickGoal} label="What brings you to Parity" />
      </>
    );
  } else if (screen === "level") {
    body = (
      <>
        {head("How much have you traded?", "Real money or demo, either counts.")}
        <Choices options={LEVELS} value={level} onPick={pickLevel} label="How much you have traded" small />
      </>
    );
  } else if (screen === "markets") {
    body = (
      <>
        {head("Which markets do you follow?", "Pick any. What's new puts these first.")}
        <div className="intro-opts intro-opts-4" role="group" aria-label="Markets you follow">
          {MARKETS.map((m) => (
            <button key={m.id} type="button" className="intro-opt" aria-pressed={markets.includes(m.id)} onClick={() => toggleMarket(m.id)}>
              <span className="intro-opt-title">{m.title}</span>
              <span className="intro-opt-body">{m.body}</span>
              <span className="intro-tick" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 7.4l2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            </button>
          ))}
        </div>
        <div className="intro-go">
          <button type="button" className="intro-primary" onClick={saveMarkets}>{markets.length ? "Continue" : "Continue without picking"}</button>
        </div>
      </>
    );
  } else {
    body = <FirstResult report={report} markets={markets} headingRef={heading} headingId={`${id}-q`} onHome={() => end("done", "#/")} onOpen={(href) => end("done", href)} />;
  }

  return createPortal(
    <div ref={box} className="intro ui-mo" role="dialog" aria-modal="true" aria-labelledby={`${id}-q`} onKeyDown={onKey} data-leaving={leaving || undefined} data-closing={closing || undefined}>
      <div className="intro-glow" aria-hidden="true" />
      <div key={step} className="intro-stage ui-mo" data-screen={screen}>
        {body}
      </div>
      <footer className="intro-foot">
        <div className="intro-foot-side">
          {step > 0 && <button type="button" className="intro-text" onClick={() => goTo(step - 1)}>Back</button>}
        </div>
        <div className="intro-dots" role="img" aria-label={`Screen ${step + 1} of ${SCREENS.length}`}>
          {SCREENS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}
        </div>
        <div className="intro-foot-side intro-foot-end">
          {screen !== "result" && screen !== "goal" && <button type="button" className="intro-text" onClick={() => goTo(step + 1)}>Skip question</button>}
          <button type="button" className="intro-text" onClick={() => end(screen === "result" ? "done" : "skipped")} aria-keyshortcuts="Escape">{screen === "result" ? "Close" : "Skip intro"}</button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}

function Choices<T extends string>({ options, value, onPick, label, small = false }: { options: Option<T>[]; value: T | null; onPick: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`intro-opts ${small ? "intro-opts-3" : "intro-opts-2"}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="intro-opt" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
          <span className="intro-opt-title">{o.title}</span>
          <span className="intro-opt-body">{o.body}</span>
          <span className="intro-arrow" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the first result

/** Each line starts at 100 on the strategy's first date; the market is lined up by date. */
function equityVisual(run: StrategyRun, bench: StrategyRun | undefined, name: string): SigVisual {
  const pts = run.equity;
  const base = pts[0][1] || 1;
  const values = pts.map(([, v]) => Math.round((v / base) * 10000) / 100);
  const series: { label: string; values: number[]; role?: string }[] = [{ label: name, values }];
  if (bench?.equity.length) {
    const by = new Map(bench.equity.map(([d, v]) => [d, v]));
    let last: number | null = null;
    const raw = pts.map(([d]) => { const v = by.get(d); if (v != null) last = v; return last; });
    const b0 = raw.find((v) => v != null);
    if (b0) series.push({ label: "US stock market", values: raw.map((v) => Math.round(((v ?? b0) / b0) * 10000) / 100), role: "benchmark" });
  }
  return {
    kind: "equity",
    alt: `${name} and the US stock market from ${pts[0][0].slice(0, 4)} to ${pts[pts.length - 1][0].slice(0, 4)}, each starting at $100.`,
    params: { fmt: "money", labels: pts.map(([d]) => d.slice(0, 7)), series, headline: { label: `${name}, $100 at the start` } },
    steps: [{ caption: "", to: 1 }],
  } as SigVisual;
}

function FirstResult({ report: given, markets, headingRef, headingId, onHome, onOpen }: {
  report: Report | null; markets: IntroMarket[]; headingRef: React.RefObject<HTMLHeadingElement | null>; headingId: string;
  onHome: () => void; onOpen: (href: string) => void;
}) {
  const { data: loaded } = useResource(given ? null : "report-latest", () => loadReport());
  const { data: search } = useResource("search", loadSearch);
  const report = given ?? loaded ?? null;
  const run = useMemo(() => (report ? sampleFor(report.runs, markets) : null), [report, markets]);
  const bench = report?.runs.find((r) => r.is_benchmark);
  const out = useMemo(() => {
    if (!report || !run) return null;
    const name = nameOf(run);
    const tries = (search?.trials ?? 0) + report.n_trials;
    const r = checkStrategy({ name, equity: run.equity, tries, asset: tagsOf(run).asset,
      gauntlet: run.gauntlet ? { verdict: run.gauntlet.verdict, passed: run.gauntlet.passed, total: run.gauntlet.total } : null, holdup: run.holdup });
    return { name, r, visual: equityVisual(run, bench, name) };
  }, [report, run, bench, search]);

  if (!out || !run) {
    return (
      <>
        <header className="intro-head">
          <h1 id={headingId} ref={headingRef} tabIndex={-1} className="intro-q">{report ? "Your first check" : "Loading a real check"}</h1>
          <p className="intro-lead">{report ? "Our strategies are not published yet. Verify works on your own trade log." : "Reading our tested strategies."}</p>
        </header>
        {report ? (
          <div className="intro-go"><button type="button" className="intro-primary" onClick={onHome}>Go to Home</button></div>
        ) : <div className="intro-card intro-card-wait" aria-hidden="true" />}
      </>
    );
  }
  const { name, r, visual } = out;
  const from = r.dateFrom?.slice(0, 4), to = r.dateTo?.slice(0, 4);
  const years = from && to ? Number(to) - Number(from) : null;
  const tone = r.verdict.id === "holds_up" ? "pos" : r.verdict.id === "does_not_hold_up" ? "neg" : "warn";
  const href = `#/verify?mode=strategy&strategy=${encodeURIComponent(run.strategy)}`;
  return (
    <>
      <header className="intro-head">
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className="intro-q">Verify checked {name}</h1>
        <p className="intro-lead">
          {years ? `${years} years of results, ` : ""}after trading costs, counting all {r.tries.toLocaleString("en-US")} tries our research has made.
        </p>
      </header>
      <article className="intro-card" aria-labelledby={`${headingId}-v`}>
        <div className="intro-chart ui-chart-reveal">
          <SignatureFrame visual={visual} s={0} size="lesson" />
          <p className="sr-only">{visual.alt}</p>
        </div>
        <div className="intro-verdict" data-tone={tone}>
          <h2 id={`${headingId}-v`} className="intro-verdict-label">{r.verdict.label}</h2>
          <p className="intro-verdict-text">{r.verdict.sentence}</p>
          <dl className="intro-stats">
            {run.gauntlet && <div><dt>Tests passed</dt><dd>{run.gauntlet.passed} of {run.gauntlet.total}</dd></div>}
            <div><dt>Sharpe ratio</dt><dd>{run.metrics.sharpe == null ? "n/a" : run.metrics.sharpe.toFixed(2)}</dd></div>
            <div><dt>Worst fall</dt><dd>{fmt.signedPct(run.metrics.max_drawdown == null ? null : -Math.abs(run.metrics.max_drawdown), 0)}</dd></div>
          </dl>
        </div>
      </article>
      <div className="intro-go">
        <button type="button" className="intro-primary" onClick={onHome}>Go to Home</button>
        <a className="intro-text" href={href} onClick={(e) => { e.preventDefault(); onOpen(href); }}>Open the full check</a>
      </div>
    </>
  );
}
