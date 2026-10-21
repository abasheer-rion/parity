// Text: headings, body text, labels, keys and every way we print a number.
// Numbers always use tabular figures so columns line up. A change is never shown
// by colour alone: it carries a sign (+ or U+2212) and, where it helps, an arrow.
import type { ElementType, ReactNode } from "react";
import { Icon } from "./icons";

export const MINUS = "−";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
type Tone = "default" | "secondary" | "muted" | "good" | "bad" | "accent";

export function Heading({ level = 2, size, children, className = "" }: { level?: 1 | 2 | 3 | 4; size?: Size; children: ReactNode; className?: string }) {
  const Tag = `h${level}` as ElementType;
  const s = size ?? ({ 1: "2xl", 2: "xl", 3: "lg", 4: "md" } as const)[level];
  return <Tag className={`ui-h ui-fs-${s} ${className}`}>{children}</Tag>;
}

export function Text({ size = "md", tone = "default", as = "p", mono, tabular, children, className = "" }: {
  size?: Size; tone?: Tone; as?: "p" | "span" | "div"; mono?: boolean; tabular?: boolean; children: ReactNode; className?: string;
}) {
  const Tag = as as ElementType;
  return <Tag className={`ui-text ui-fs-${size} ui-tone-${tone} ${mono ? "ui-mono" : ""} ${tabular ? "ui-tab" : ""} ${className}`}>{children}</Tag>;
}

/** A small label above a value, Mercury style. With `term` it links to the glossary and previews on hover. */
export function Label({ children, term }: { children: ReactNode; term?: string }) {
  return term
    ? <a className="ui-label ui-label-term" href={`#/learn/${term}`} data-term={term}>{children}</a>
    : <span className="ui-label">{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export const fmt = {
  pct: (v: number | null | undefined, d = 1) => (v == null ? "n/a" : `${v < 0 ? MINUS : ""}${Math.abs(v * 100).toFixed(d)}%`),
  signedPct: (v: number | null | undefined, d = 1) => (v == null ? "n/a" : `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v * 100).toFixed(d)}%`),
  num: (v: number | null | undefined, d = 2) => (v == null ? "n/a" : `${v < 0 ? MINUS : ""}${Math.abs(v).toFixed(d)}`),
  compact: (v: number) => {
    const a = Math.abs(v);
    const s = a >= 1e9 ? `${+(a / 1e9).toPrecision(3)}B` : a >= 1e6 ? `${+(a / 1e6).toPrecision(3)}M` : a >= 1e3 ? `${+(a / 1e3).toPrecision(3)}K` : `${+a.toPrecision(3)}`;
    return `${v < 0 ? MINUS : ""}$${s}`;
  },
  date: (iso: string) => new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
};

/** Money the way Mercury prints it: separators, a true minus, small raised cents. */
export function Money({ value, cents = true, signed = false, compact = false }: { value: number; cents?: boolean; signed?: boolean; compact?: boolean }) {
  if (compact) return <span className="money">{signed && value > 0 ? "+" : ""}{fmt.compact(value)}</span>;
  const neg = value < 0;
  const abs = Math.abs(value);
  let whole = Math.floor(abs);
  let c = Math.round((abs - whole) * 100);
  if (c === 100) { whole += 1; c = 0; }
  return (
    <span className="money">
      {neg ? MINUS : signed ? "+" : ""}${whole.toLocaleString("en-US")}
      {cents && <span className="cents">.{String(c).padStart(2, "0")}</span>}
    </span>
  );
}

/** A change, as a percent or money: always signed, coloured, and optionally with an arrow. */
export function Delta({ value, kind = "pct", arrow = false, digits = 1, label }: { value: number | null | undefined; kind?: "pct" | "money" | "num"; arrow?: boolean; digits?: number; label?: ReactNode }) {
  if (value == null) return <span className="ui-delta">n/a</span>;
  const up = value >= 0;
  const body = kind === "money" ? <Money value={value} signed /> : kind === "num" ? `${up ? "+" : MINUS}${Math.abs(value).toFixed(digits)}` : fmt.signedPct(value, digits);
  return (
    <span className={`ui-delta ${up ? "good" : "bad"}`}>
      {arrow && <Icon name={up ? "arrowUpRight" : "arrowDownRight"} size={13} />}
      {body}
      {label && <span className="ui-delta-label"> {label}</span>}
    </span>
  );
}
