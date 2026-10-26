// The signature chart player (DEC-0067). It steps through a visual with Back and Next (or
// the arrow keys), eases the picture between steps, scrubs with a slider, and plays once on
// its own the first time it scrolls into view, drawing the first step in from empty. With
// reduced motion every step is a whole still frame that fills the chart, nothing plays on
// its own and the slider moves a whole step at a time. "All steps" lays every frame out
// with its caption, and "Show the numbers" opens the table behind the picture (the text
// alternative, WCAG 1.1.1). Motion rules: DEC-0017.
import DOMPurify from "dompurify";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../buttons";
import { useReducedMotion } from "../presence";
import { durationMs } from "../tokens";
import { easeInOut } from "./core";
import { renderSignature, signatureTable, type SigTable, type SigVisual } from "./scenes";
import { SIZES, type SizeName, type ThemeName } from "./theme";
import "./signature.css";

/** How long a step stays on screen while playing. */
const DWELL_MS = 3600;
/** Below this width the player draws the taller phone layout (matches the container query in signature.css). */
const COMPACT_BELOW = 480;

/** One frame of a visual as inline SVG. The markup is our own, and still goes through DOMPurify. */
export function SignatureFrame({ visual, s, size = "lesson", theme = "dark" }: { visual: SigVisual; s: number; size?: SizeName; theme?: ThemeName }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vp = SIZES[size];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vp.w} ${vp.h}" class="sg-svg" aria-hidden="true" focusable="false">${renderSignature(visual, s, { size, theme })}</svg>`;
    el.replaceChildren(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, RETURN_DOM_FRAGMENT: true }));
  }, [visual, s, size, theme]);
  return <div ref={ref} className="sg-frame" data-size={size} />;
}

/** The numbers behind a picture as a plain table. */
export function SignatureTable({ table, className = "" }: { table: SigTable; className?: string }) {
  return (
    <div className={`sg-table-wrap ${className}`} tabIndex={0} role="region" aria-label={`Table: ${table.caption}`}>
      <table className="sg-table">
        <caption>{table.caption}</caption>
        <thead><tr>{table.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

export interface SignaturePlayerProps {
  visual: SigVisual;
  /** Play once through when it first scrolls into view (default true). */
  autoPlay?: boolean;
  theme?: ThemeName;
  /** Force a size; by default it follows the width (lesson, or compact on phones). */
  size?: SizeName;
  /** Offer the data table (default true). */
  table?: boolean;
  className?: string;
}

export function SignaturePlayer({ visual, autoPlay = true, theme = "dark", size: forced, table = true, className = "" }: SignaturePlayerProps) {
  const reduced = useReducedMotion();
  const last = Math.max(0, visual.steps.length - 1);
  const willPlay = autoPlay && !reduced && typeof IntersectionObserver !== "undefined";
  const [step, setStep] = useState(0);
  const [s, setS] = useState(willPlay ? -1 : 0);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [auto, setAuto] = useState<SizeName>("lesson");
  const sRef = useRef(s);
  const raf = useRef(0);
  const box = useRef<HTMLElement>(null);
  const played = useRef(false);
  const capId = useId(), tableId = useId();
  const size = forced ?? auto;

  // Pick the layout from the width before the first paint, and again when it changes.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || forced) return;
    const pick = () => setAuto(el.clientWidth < COMPACT_BELOW ? "compact" : "lesson");
    pick();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(pick);
    ro.observe(el);
    return () => ro.disconnect();
  }, [forced]);

  const put = (v: number) => { sRef.current = v; setS(v); };
  const animateTo = useCallback((to: number) => {
    cancelAnimationFrame(raf.current);
    const from = sRef.current;
    const ms = Math.max(durationMs("dur-6"), 1) * (Math.abs(to - from) > 1 ? 1.3 : 1);
    if (reduced || from === to) { put(to); return; }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      put(from + (to - from) * easeInOut(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [reduced]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // A new visual starts again.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    setStep(0); put(willPlay ? -1 : 0); setPlaying(false); played.current = false;
  }, [visual]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reduced motion turned on part way: settle on the whole step.
  useEffect(() => { if (reduced) { cancelAnimationFrame(raf.current); setPlaying(false); put(Math.max(0, Math.round(sRef.current))); } }, [reduced]);

  // Play once through the first time the picture is mostly on screen; draw step one in first.
  useEffect(() => {
    const el = box.current;
    if (!el || !willPlay) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !played.current) { played.current = true; animateTo(0); setPlaying(true); }
      if (!e.isIntersecting) setPlaying(false);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [willPlay, visual, animateTo]);

  // While playing, move one step at a time and stop at the end. A hidden tab waits.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const t = window.setTimeout(() => {
      if (document.hidden) return;
      const next = Math.min(last, step + 1);
      setStep(next); animateTo(next);
    }, DWELL_MS);
    return () => window.clearTimeout(t);
  }, [playing, step, last, animateTo]);

  const go = (to: number) => {
    const k = Math.max(0, Math.min(last, to));
    setPlaying(false); setStep(k); animateTo(k);
  };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (step >= last) { setStep(0); put(-1); animateTo(0); }
    setPlaying(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(last); }
  };
  // The slider: dragging moves the picture freely; letting go settles on the nearest step.
  const scrub = (v: number) => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    put(v);
    setStep(Math.round(v));
  };
  const settleScrub = () => { const k = Math.round(sRef.current); setStep(k); animateTo(k); };

  const label = playing ? "Pause" : step >= last ? "Replay" : "Play";
  const data = table ? signatureTable(visual) : null;

  return (
    <figure className={`sg-player ${className}`} ref={box} data-theme-pic={theme}>
      {grid ? (
        <ol className="sg-frames" aria-label={visual.alt}>
          {visual.steps.map((st, i) => (
            <li key={i}>
              <SignatureFrame visual={visual} s={i} size={size} theme={theme} />
              <p><span className="sg-n">Step {i + 1}</span> {st.caption}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="sg-stage" data-size={size} role="img" aria-label={visual.alt} aria-describedby={capId}>
          <SignatureFrame visual={visual} s={s} size={size} theme={theme} />
        </div>
      )}
      <figcaption>
        {/* Every caption shares one grid cell, so the box is as tall as the longest one and
            the controls never move as the steps play. Only the current one shows and is read. */}
        {!grid && (
          <div className="sg-captions">
            {visual.steps.map((st, i) => (
              <p key={i} id={i === step ? capId : undefined} className="sg-caption" aria-live={i === step ? "polite" : undefined}
                aria-hidden={i === step ? undefined : true} data-on={i === step || undefined}>
                <span className="sg-n">Step {i + 1} of {last + 1}</span> {st.caption}
              </p>
            ))}
          </div>
        )}
        {!grid && last > 0 && (
          <input type="range" className="sg-scrub" min={0} max={last} step={reduced ? 1 : 0.01} value={Math.max(0, s)}
            aria-label="Move through the steps" aria-valuetext={`Step ${step + 1} of ${last + 1}`}
            onChange={(e) => scrub(Number(e.currentTarget.value))} onPointerUp={settleScrub} onKeyDown={onKey} />
        )}
        <div className="sg-controls" role="group" aria-label="Picture steps. Arrow keys move between steps." onKeyDown={grid ? undefined : onKey}>
          {!grid && (
            <>
              <Button size="sm" onClick={() => go(step - 1)} aria-disabled={step === 0}>Back</Button>
              <span className="sg-dots" aria-hidden>
                {visual.steps.map((_, i) => <span key={i} className={i === step ? "on" : i < step ? "past" : ""} />)}
              </span>
              <Button size="sm" variant="primary" onClick={() => go(step + 1)} aria-disabled={step === last}>Next</Button>
              {!reduced && (
                <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm sg-play" onClick={togglePlay} aria-pressed={playing}>
                  {/* All three labels share one cell, so the button keeps one width as it plays. */}
                  {["Pause", "Replay", "Play"].map((l) => <span key={l} aria-hidden={l !== label || undefined} data-on={l === label || undefined}>{l}</span>)}
                </button>
              )}
            </>
          )}
          <span className="sg-spacer" />
          {data && (
            <Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} aria-controls={tableId}>
              {showTable ? "Hide the numbers" : "Show the numbers"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setGrid((g) => !g)} aria-pressed={grid}>
            {grid ? "One step at a time" : "All steps"}
          </Button>
        </div>
        {!grid && reduced && <p className="sg-note">Motion is off because your device or your Motion setting asks for less. Each step is a still frame.</p>}
        {data && <div id={tableId} hidden={!showTable}>{showTable && <SignatureTable table={data} />}</div>}
      </figcaption>
    </figure>
  );
}
