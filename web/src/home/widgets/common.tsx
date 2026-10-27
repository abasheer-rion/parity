// Small pieces every Home widget shares: the source and lateness line under the data, an
// empty state, and a signed percent with an arrow (colour is never the only cue).
import type { ReactNode } from "react";

export function Src({ children }: { children: ReactNode }) {
  return <p className="w-src">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="w-empty">{children}</p>;
}

/** A change in percent (10.5 means 10.5%), signed, with an up or down arrow. */
export function Chg({ v, digits = 1 }: { v: number | null | undefined; digits?: number }) {
  if (v == null || !Number.isFinite(v)) return <span className="w-chg">n/a</span>;
  const up = v >= 0;
  return <span className={`w-chg ${up ? "good" : "bad"}`}>{up ? "▲" : "▼"} {up ? "+" : ""}{v.toFixed(digits)}%</span>;
}

/** How old a date is, in plain words. */
export function age(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "date unknown";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "date unknown";
  const m = Math.round(ms / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
