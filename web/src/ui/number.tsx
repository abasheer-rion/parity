// Numbers that never overflow (DEC-0058). Every figure on the site that can grow (money,
// counts, prices, percentages) goes through Num: tabular figures so columns line up, a
// true minus, an optional sign colour, and a compact form (1.2M) chosen by itself when the
// full number does not fit its box. The full value is always in the title and for
// screen readers, so shortening never hides information.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { MINUS } from "./text";

export type NumKind = "number" | "money" | "percent";
export type NumMode = "full" | "compact" | "auto";

export interface NumFormat {
  kind?: NumKind;
  /** Digits after the point in the full form. Percent values are fractions (0.123 = 12.3%). */
  digits?: number;
  /** Print + for gains (always on for `signed` deltas). */
  signed?: boolean;
  currency?: string;
}

const SUFFIX: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];

/** The full form: separators, a true minus, the currency or percent sign. */
export function formatFull(value: number | null | undefined, { kind = "number", digits, signed, currency = "$" }: NumFormat = {}): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const v = kind === "percent" ? value * 100 : value;
  const d = digits ?? (kind === "money" ? 2 : kind === "percent" ? 1 : Math.abs(v) >= 1000 ? 0 : 2);
  const body = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = value < 0 ? MINUS : signed && value > 0 ? "+" : "";
  return `${sign}${kind === "money" ? currency : ""}${body}${kind === "percent" ? "%" : ""}`;
}

/** The compact form: 1.23M, 45.6K, 999. Three significant figures at most. */
export function formatCompact(value: number | null | undefined, { kind = "number", signed, currency = "$" }: NumFormat = {}): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (kind === "percent") return formatFull(value, { kind, digits: Math.abs(value) >= 10 ? 0 : 1, signed });
  const a = Math.abs(value);
  const [div, suf] = SUFFIX.find(([n]) => a >= n) ?? [1, ""];
  const scaled = a / div;
  const body = suf ? String(+scaled.toPrecision(3)) : a >= 100 ? String(Math.round(a)) : String(+a.toPrecision(3));
  const sign = value < 0 ? MINUS : signed && value > 0 ? "+" : "";
  return `${sign}${kind === "money" ? currency : ""}${body}${suf}`;
}

/**
 * A number. `mode="auto"` (the default) prints the full form and switches to the compact
 * form when its box is too narrow; `tone="sign"` colours gains and losses (the sign is
 * printed as well, never colour alone). Put it in a cell or tile and it stays inside.
 */
export function Num({ value, kind = "number", digits, signed, mode = "auto", tone, currency, className = "", suffix }: NumFormat & {
  value: number | null | undefined; mode?: NumMode; tone?: "sign" | "positive" | "negative" | "muted"; className?: string; suffix?: ReactNode;
}) {
  const opts: NumFormat = { kind, digits, signed, currency };
  const full = formatFull(value, opts);
  const compact = formatCompact(value, opts);
  const root = useRef<HTMLSpanElement>(null);

  // Before paint, and again whenever the space around it changes: show the full form,
  // measure how far each box around the number (up to the nearest scroll box) overflows,
  // then show the compact form and measure again. If the full form makes any box overflow
  // more, the compact form stays. Both forms are in the page, so this toggles a data
  // attribute instead of re-rendering, and nothing flickers.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const set = (shortForm: boolean) => {
      el.dataset.short = shortForm ? "1" : "0";
      if (shortForm) el.title = full; else el.removeAttribute("title");
    };
    if (mode !== "auto" || compact === full) { set(mode === "compact" && compact !== full); return; }
    const boxes: HTMLElement[] = [];
    for (let a = el.parentElement, n = 0; a && a !== document.body && n < 6; a = a.parentElement, n++) {
      boxes.push(a);
      const cs = getComputedStyle(a);
      if (/(auto|scroll)/.test(cs.overflowX) || cs.position === "fixed") break;
    }
    const over = () => boxes.map((b) => b.scrollWidth - b.clientWidth);
    const check = () => {
      set(true);
      const withShort = over();
      set(false);
      const withFull = over();
      set(withFull.some((o, k) => o > withShort[k] + 0.5));
    };
    check();
    document.fonts?.ready.then(check).catch(() => {});
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => check());
    for (const b of boxes) ro.observe(b);
    return () => ro.disconnect();
  }, [full, compact, mode]);

  const t = tone === "sign" ? (value == null || value === 0 ? "" : value > 0 ? "positive" : "negative") : tone ?? "";
  const startShort = mode === "compact" && compact !== full;
  return (
    <span ref={root} className={`ui-num ${t ? `ui-num-${t}` : ""} ${className}`} data-short={startShort ? "1" : "0"} title={startShort ? full : undefined}>
      <span className="ui-num-full">{full}</span>
      {compact !== full && <><span className="ui-num-short" aria-hidden>{compact}</span></>}
      {suffix}
    </span>
  );
}
