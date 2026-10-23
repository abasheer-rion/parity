// The Academy's moving picture player (DEC-0028). It steps through a lesson's picture
// with Back and Next (or the arrow keys), tweening between step frames, and plays once
// through on its own the first time it scrolls into view. With reduced motion it jumps
// straight to each step frame and never plays on its own. "All steps" lays every frame
// out side by side with its caption. Motion rules: DEC-0017.
import DOMPurify from "dompurify";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { H, renderScene, W, type Visual } from "./scenes";

const TWEEN_MS = 700;
const STEP_MS = 3200;

function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** One frame of a picture. The markup is drawn by our own code, and still goes through DOMPurify. */
export function Frame({ visual, s }: { visual: Visual; s: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="ac-svg" aria-hidden="true" focusable="false">${renderScene(visual, s)}</svg>`;
    el.replaceChildren(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, RETURN_DOM_FRAGMENT: true }));
  }, [visual, s]);
  return <div ref={ref} className="ac-frame" />;
}

export function VisualPlayer({ visual, autoPlay = true }: { visual: Visual; autoPlay?: boolean }) {
  const reduced = useReducedMotion();
  const last = visual.steps.length - 1;
  const [step, setStep] = useState(0);
  const [s, setS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState(false);
  const sRef = useRef(0);
  const box = useRef<HTMLElement>(null);
  const played = useRef(false);
  const capId = useId();

  // A new lesson starts at its first frame.
  useEffect(() => { setStep(0); setS(0); sRef.current = 0; setPlaying(false); played.current = false; }, [visual]);

  // Tween s toward the chosen step.
  useEffect(() => {
    const from = sRef.current, to = step;
    if (reduced || from === to) { sRef.current = to; setS(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / TWEEN_MS);
      const v = from + (to - from) * ease(p);
      sRef.current = v;
      setS(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, reduced]);

  // Play once through the first time the picture is mostly on screen.
  useEffect(() => {
    const el = box.current;
    if (!el || !autoPlay || reduced || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !played.current) { played.current = true; setPlaying(true); }
      if (!e.isIntersecting) setPlaying(false);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, reduced, visual]);

  // While playing, advance one step at a time and stop at the end. A hidden tab waits.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const t = window.setTimeout(() => { if (!document.hidden) setStep((v) => Math.min(last, v + 1)); }, STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, step, last]);

  const go = (to: number) => { setPlaying(false); setStep(Math.max(0, Math.min(last, to))); };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (step >= last) { sRef.current = 0; setS(0); setStep(0); }
    setPlaying(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(last); }
  };

  return (
    <figure className="ac-visual" ref={box}>
      {grid ? (
        <ol className="ac-frames" aria-label={visual.alt}>
          {visual.steps.map((st, i) => (
            <li key={i}>
              <Frame visual={visual} s={i} />
              <p><span className="ac-frame-n">Step {i + 1}</span> {st.caption}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="ac-stage" role="img" aria-label={visual.alt} aria-describedby={capId}>
          <Frame visual={visual} s={s} />
        </div>
      )}
      <figcaption>
        {!grid && <p id={capId} className="ac-caption" aria-live="polite"><span className="ac-frame-n">Step {step + 1} of {last + 1}</span> {visual.steps[step].caption}</p>}
        <div className="ac-controls" role="group" aria-label="Picture steps. Arrow keys move between steps." onKeyDown={grid ? undefined : onKey}>
          {!grid && (
            <>
              <button type="button" className="ac-btn" onClick={() => go(step - 1)} disabled={step === 0}>Back</button>
              <span className="ac-dots" aria-hidden>
                {visual.steps.map((_, i) => <span key={i} className={i === step ? "on" : i < step ? "past" : ""} />)}
              </span>
              <button type="button" className="ac-btn ac-btn-main" onClick={() => go(step + 1)} disabled={step === last}>Next</button>
              {!reduced && (
                <button type="button" className="ac-btn" onClick={togglePlay} aria-pressed={playing}>
                  {playing ? "Pause" : step >= last ? "Replay" : "Play"}
                </button>
              )}
            </>
          )}
          <button type="button" className="ac-btn ac-btn-quiet" onClick={() => setGrid((g) => !g)} aria-pressed={grid}>
            {grid ? "One step at a time" : "All steps"}
          </button>
        </div>
        {!grid && reduced && <p className="ac-note">Motion is off because your device asks for less of it. Each step is a still frame.</p>}
      </figcaption>
    </figure>
  );
}
