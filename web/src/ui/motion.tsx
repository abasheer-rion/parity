// Motion. Short (90 to 400ms), eased out, and only where it explains a change:
// something appearing, a value updating, a panel opening. The one loop allowed in the
// app is HeroGlow's slow drift behind a hero area (DEC-0017). Nothing flashes.
// People who ask their system for reduced motion get none of it (see ui.css).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
    <span className="ui-roll" aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch)
          ? <span key={i} className="ui-roll-slot" aria-hidden><span className="ui-roll-strip" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>{"0123456789".split("").map((d) => <span key={d}>{d}</span>)}</span></span>
          : <span key={i} aria-hidden>{ch}</span>,
      )}
    </span>
  );
}

/**
 * A number that glides from its old value to its new one when it changes (a price, a
 * total after a filter). Tabular figures and a width held at the longest of the two
 * values, so the text around it never shifts. With reduced motion it simply changes.
 */
export function AnimatedNumber({ value, format, ms = 450, className = "" }:
  { value: number; format: (v: number) => string; ms?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const [width, setWidth] = useState(() => format(value).length);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    setWidth(Math.max(format(start).length, format(value).length));
    if (reducedMotion()) { from.current = value; setShown(value); setWidth(format(value).length); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else setWidth(format(value).length);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // format is usually an inline function; a new one each render must not restart the glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
  return <span className={`ui-anum ${className}`} style={{ minWidth: `${width}ch` }} aria-live="polite">{format(shown)}</span>;
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

/** Counts up from zero to `value` on first view. Use for one headline number, not for tables. */
export function CountUp({ value, format, ms = 700 }: { value: number; format: (v: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) { setV(value); return; }
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{format(v)}</>;
}

// ---------------------------------------------------------------------------------
// Added with DEC-0017: lift, tilt, draw-in, reveal on scroll, page transitions and a
// quiet animated backdrop for hero areas. Same rules: short, eased, no flashing, and
// nothing moves for people who ask for reduced motion.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    // Already on screen, or no observer, or reduced motion: show at once, nothing blinks.
    const r = el.getBoundingClientRect();
    if (reducedMotion() || !("IntersectionObserver" in window) || (r.top < window.innerHeight && r.bottom > 0)) {
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
