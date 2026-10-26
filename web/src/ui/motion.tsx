// Motion (REF-0023). Short (100 to 600ms), eased out, and only where it explains a change:
// something appearing, a value updating, a panel opening. The one loop allowed in the
// app is HeroGlow's slow drift behind a hero area (DEC-0017). Nothing flashes.
// Reduced motion (the device asks, or the Motion setting says so) keeps the fades and
// drops the movement: nothing slides, rises or counts (see motion.css and motionPref.ts).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motionLevel } from "./motionPref";
import { progressAt, tickAt, tickerWidth } from "./ticker";

export const MOTION = {
  fast: "var(--dur-1)",
  base: "var(--dur-2)",
  slow: "var(--dur-3)",
  reveal: "var(--dur-4)",
  easeOut: "var(--ease-out)",
  spring: "var(--ease-spring)",
} as const;

export type Animation = "fade" | "rise" | "pop" | "slide";

/** Plays an entrance animation once when mounted. `delay` staggers lists. */
export function Animate({ type = "rise", delay = 0, children, as: Tag = "div", className = "" }:
  { type?: Animation; delay?: number; children: ReactNode; as?: "div" | "span" | "li" | "section"; className?: string }) {
  return <Tag className={`anim-${type} ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</Tag>;
}

/** Mercury's rolling digits: each digit slides to its new value when the number changes. */
export function RollingNumber({ text }: { text: string }) {
  return (
    <span className="ui-roll">
      <span className="sr-only">{text}</span>
      {[...text].map((ch, i) =>
        /\d/.test(ch)
          ? <span key={i} className="ui-roll-slot" aria-hidden><span className="ui-roll-strip" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>{"0123456789".split("").map((d) => <span key={d}>{d}</span>)}</span></span>
          : <span key={i} aria-hidden>{ch}</span>,
      )}
    </span>
  );
}

/**
 * A number ticker: glides from its old value to its new one when it changes (a price, a
 * total after a filter). Tabular figures and a width held at the longer of the two values,
 * so the text around it never shifts. `from` makes it count up from that value the first
 * time it shows. With reduced motion it simply changes. The text always ends on the exact
 * formatted value, and frames are drawn straight into the text, so React does not
 * re-render on every frame.
 */
export function AnimatedNumber({ value, format, ms = 700, from, flash = false, className = "" }:
  { value: number; format: (v: number) => string; ms?: number; from?: number; flash?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Where the number is now: the last value drawn, mid-glide or settled.
  const shown = useRef(from ?? value);
  const fmt = useRef(format);
  fmt.current = format;
  useEffect(() => {
    const el = ref.current;
    const text = el?.firstChild;
    const start = shown.current;
    if (!el || !text || start === value) return;
    const f = fmt.current;
    const done = () => { shown.current = value; text.nodeValue = f(value); el.style.minWidth = ""; };
    if (flash) { el.classList.remove("ui-tick-flash"); void el.offsetWidth; el.classList.add("ui-tick-flash"); }
    if (motionLevel() === "reduced") { done(); return; }
    el.style.minWidth = `${tickerWidth(f, start, value)}ch`;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = progressAt(t0, t, ms);
      if (p >= 1) { done(); return; }
      shown.current = tickAt(start, value, p);
      text.nodeValue = f(shown.current);
      raf = requestAnimationFrame(step);
    };
    text.nodeValue = f(start);
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); };
  }, [value, ms, flash]);
  // The glide is for the eye only; screen readers read the final value (WCAG 4.1.3).
  return <><span ref={ref} className={`ui-anum ${className}`} aria-hidden="true">{format(value)}</span><span className="sr-only">{format(value)}</span></>;
}

/**
 * Brings its children in one after another: each rises a few pixels and fades in, 30ms
 * apart, capped so the last starts within 240ms (the motion rules keep entrances under
 * 400ms). Use for the first paint of a list of cards, not for content that updates.
 */
export function Stagger({ children, as: Tag = "div", className = "" }:
  { children: ReactNode; as?: "div" | "ul" | "ol" | "section"; className?: string }) {
  return <Tag className={`${STAGGER} ${className}`}>{children}</Tag>;
}

/** The class behind Stagger, for a grid or list you already have: its direct children come in one by one. */
export const STAGGER = "ui-stagger";

/** Counts up from zero to `value` the first time it shows. Use for one headline number, not for tables. */
export function CountUp({ value, format, ms = 700 }: { value: number; format: (v: number) => string; ms?: number }) {
  return <AnimatedNumber value={value} format={format} ms={ms} from={0} />;
}

// ---------------------------------------------------------------------------------
// Added with DEC-0017: lift, tilt, draw-in, reveal on scroll, page transitions and a
// quiet animated backdrop for hero areas. Same rules: short, eased, no flashing, and
// nothing moves for people who ask for reduced motion.

// Movement off: reduced motion (fades still play; see motionPref.ts).
const reducedMotion = () => typeof window !== "undefined" && motionLevel() === "reduced";

/** Class for a card that rises a little and gains a shadow on hover. */
export const LIFT = "ui-lift";

/**
 * Leans its child a few degrees toward the pointer, with a soft light that follows it.
 * Only with a mouse or trackpad; touch and reduced motion get a still card.
 */
export function Tilt({ children, max = 6, className = "", as: Tag = "div" }:
  { children: ReactNode; max?: number; className?: string; as?: "div" | "li" | "section" | "article" }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--tilt-x", `${(-y * max).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(x * max * 1.3).toFixed(2)}deg`);
        el.style.setProperty("--glare-x", `${((x + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty("--glare-y", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.setProperty("--tilt-x", "0deg"); el.style.setProperty("--tilt-y", "0deg"); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [max]);
  return <Tag ref={ref as never} className={`ui-tilt ${className}`}>{children}</Tag>;
}

/**
 * Draws the lines of any SVG inside it from start to end, once, when it mounts.
 * The library's own charts already draw in; use this for hand-made SVG.
 */
export function DrawIn({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll("polyline, path, line").forEach((n) => {
      const fill = n.getAttribute("fill");
      if (fill && fill !== "none") return;
      n.setAttribute("pathLength", "1");
      n.classList.add("ui-draw");
    });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

// One observer for every Reveal on the page; each element registers what to do on arrival.
const arrivals = new Map<Element, () => void>();
let revealObserver: IntersectionObserver | null = null;
function observeReveal(el: Element, onArrive: () => void) {
  revealObserver ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      arrivals.get(e.target)?.();
      arrivals.delete(e.target);
      revealObserver?.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -6% 0px" });
  arrivals.set(el, onArrive);
  revealObserver.observe(el);
  return () => { arrivals.delete(el); revealObserver?.unobserve(el); };
}

/** Fades and rises into place the first time it scrolls into view. `delay` staggers a row. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }:
  { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement | null>(null);
  // wait: hidden until seen. moving: arriving, with its stagger. here: arrived, no delay left.
  const [state, setState] = useState<"wait" | "moving" | "here">("wait");
  // Before paint, so a card that starts on screen is never drawn hidden first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen, or no observer: show at once, nothing blinks. Reduced motion
    // still reveals on scroll, as a fade with no rise (motion.css).
    const r = el.getBoundingClientRect();
    if (!("IntersectionObserver" in window) || (r.top < window.innerHeight && r.bottom > 0)) {
      setState("here");
      return;
    }
    let timer = 0;
    const stop = observeReveal(el, () => {
      setState("moving");
      // Once it has arrived, drop the stagger so hover effects respond at once.
      timer = window.setTimeout(() => setState("here"), 700 + delay);
    });
    return () => { stop(); window.clearTimeout(timer); };
  }, [delay]);
  const cls = state === "wait" ? "" : state === "moving" ? " in" : " in done";
  return <Tag ref={ref as never} className={`ui-reveal${cls} ${className}`} style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}>{children}</Tag>;
}

/** Wrap a page's content: it eases in when the page opens. Pages mount fresh on each route. */
export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-page ${className}`}>{children}</div>;
}

/**
 * The route or view wrapper for an app: whenever `route` changes, the new view fades in
 * and rises a few pixels (transform and opacity only, nothing moves once it has played).
 * Reduced motion: a short fade.
 */
export function RouteTransition({ route, children, className = "", as: Tag = "div" }:
  { route: string; children: ReactNode; className?: string; as?: "div" | "main" | "section" }) {
  return <Tag key={route} className={`ui-route ${className}`}>{children}</Tag>;
}

/**
 * A skeleton until `ready`, then the content fades in over the same space. Give the
 * skeleton the content's size (the Skeleton* blocks do) and nothing moves.
 */
export function Loaded({ ready, skeleton, children, className = "" }:
  { ready: boolean; skeleton: ReactNode; children: ReactNode; className?: string }) {
  if (!ready) return <>{skeleton}</>;
  return <div className={`ui-fade-in ${className}`}>{children}</div>;
}

/** Class for a canvas chart's box: it reveals left to right the first time it shows. */
export const CHART_REVEAL = "ui-chart-reveal";

/** Class for a table: its first dozen rows come in one after another. */
export const STAGGER_ROWS = "ui-stagger-rows";

/**
 * A quiet, slowly drifting wash of the brand blues behind a hero area. Put it first
 * inside a container with `position: relative`; content after it sits above. It never
 * flashes, takes about a minute per drift, and holds still for reduced motion.
 */
export function HeroGlow({ tone = "blue" }: { tone?: "blue" | "mint" }) {
  return (
    <div className={`ui-glow ui-glow-${tone}`} aria-hidden>
      <i /><i /><i />
    </div>
  );
}
