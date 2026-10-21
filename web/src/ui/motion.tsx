// Motion. Short (90 to 400ms), eased out, and only where it explains a change:
// something appearing, a value updating, a panel opening. Never decorative loops.
// People who ask their system for reduced motion get none of it (see ui.css).
import { useEffect, useRef, useState, type ReactNode } from "react";

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
