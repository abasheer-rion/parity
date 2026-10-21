// Small helpers shared by the Sim World pieces.
import { useEffect, useRef, useState } from "react";
import type { Point } from "../../lib/types";

export const DAY = 86_400_000;
export const t = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");
export const monthYear = (iso: string) => new Date(t(iso)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const dayMonthYear = (iso: string) => new Date(t(iso)).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const dollars = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/** Keep at most about one point a day; long daily series are thinned to weekly. */
export function thin(points: Point[], maxPoints = 3000): Point[] {
  if (points.length <= maxPoints) return points;
  const out: Point[] = [];
  let last = -Infinity;
  for (const p of points) {
    const ms = t(p[0]);
    if (ms - last >= 6.5 * DAY) { out.push(p); last = ms; }
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** Index of the last point on or before `iso` (binary search), or -1. */
export function indexAtOrBefore(dates: string[], iso: string): number {
  let lo = 0, hi = dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** Return and Sharpe over the last `years` of an equity curve. */
export function windowStats(eq: Point[], years: number): { ret: number | null; sharpe: number | null } {
  if (eq.length < 3) return { ret: null, sharpe: null };
  const end = t(eq[eq.length - 1][0]);
  const from = end - years * 365.25 * DAY;
  const pts = eq.filter((p) => t(p[0]) >= from);
  if (pts.length < 10 || t(eq[0][0]) > from + 30 * DAY) return { ret: null, sharpe: null };
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) rets.push(pts[i][1] / pts[i - 1][1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  const perYear = rets.length / years;
  return { ret: pts[pts.length - 1][1] / pts[0][1] - 1, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(perYear) : null };
}

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function useWidth<T extends HTMLElement>(min = 200): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w];
}

export interface MarketEvent { name: string; short: string; start: string; end: string }

/** Market events to jump to. Crises come from the report when it has them. */
export function marketEvents(crises?: { name: string; start: string; end: string }[]): MarketEvent[] {
  const SHORT: Record<string, string> = {
    "Dot-com crash": "Dot-com", "Global financial crisis": "2008", "Euro debt crisis": "Euro crisis",
    "Covid crash": "Covid", "2022 inflation bear market": "2022",
  };
  const list = crises?.length ? crises : [
    { name: "Dot-com crash", start: "2000-03-24", end: "2002-10-09" },
    { name: "Global financial crisis", start: "2007-10-09", end: "2009-03-09" },
    { name: "Euro debt crisis", start: "2011-04-29", end: "2011-10-03" },
    { name: "Covid crash", start: "2020-02-19", end: "2020-03-23" },
    { name: "2022 inflation bear market", start: "2022-01-03", end: "2022-10-12" },
  ];
  return list.map((c) => ({ ...c, short: SHORT[c.name] ?? c.name }));
}
