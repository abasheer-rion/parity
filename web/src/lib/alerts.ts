// Trade alerts (DEC-0032): a price level, an RSI level or a close crossing a moving
// average, checked in the browser against delayed daily bars. Pure functions here; the
// Trade area loads the bars, calls evaluateAlert and saves the first hit so each alert
// fires once. Nothing here sends a message outside the app or places an order.
import { rsi, smaOf, type Bar } from "./indicators";

export type AlertKind = "price_above" | "price_below" | "rsi_above" | "rsi_below" | "cross_above_sma" | "cross_below_sma";

export interface AlertRule {
  kind: AlertKind;
  /** The price or RSI level. Not used by the moving average crosses. */
  value: number | null;
  /** The RSI or moving average look-back, in bars. Not used by price levels. */
  param: number | null;
}

export interface AlertHit {
  /** The date of the bar that met the condition. */
  bar: string;
  /** The close for price and cross alerts, the RSI for RSI alerts. */
  value: number;
}

export interface AlertKindDef { kind: AlertKind; label: string; needsValue: boolean; needsParam: boolean; defaultParam: number | null }

export const ALERT_KINDS: AlertKindDef[] = [
  { kind: "price_above", label: "Price closes above", needsValue: true, needsParam: false, defaultParam: null },
  { kind: "price_below", label: "Price closes below", needsValue: true, needsParam: false, defaultParam: null },
  { kind: "rsi_above", label: "RSI rises above", needsValue: true, needsParam: true, defaultParam: 14 },
  { kind: "rsi_below", label: "RSI falls below", needsValue: true, needsParam: true, defaultParam: 14 },
  { kind: "cross_above_sma", label: "Close crosses above its moving average", needsValue: false, needsParam: true, defaultParam: 50 },
  { kind: "cross_below_sma", label: "Close crosses below its moving average", needsValue: false, needsParam: true, defaultParam: 50 },
];

export const alertKindDef = (k: AlertKind) => ALERT_KINDS.find((d) => d.kind === k)!;

/** Why a rule cannot be saved, in words, or null when it is fine. Mirrors the database checks. */
export function validateAlert(r: AlertRule): string | null {
  const def = ALERT_KINDS.find((d) => d.kind === r.kind);
  if (!def) return "Pick a condition.";
  if (def.needsValue && (r.value == null || !Number.isFinite(r.value))) return "Enter a level.";
  if (def.needsValue && Math.abs(r.value as number) >= 1e12) return "That level is too large.";
  if ((r.kind === "rsi_above" || r.kind === "rsi_below") && ((r.value as number) < 0 || (r.value as number) > 100)) return "RSI runs from 0 to 100.";
  if (def.needsParam && (r.param == null || !Number.isInteger(r.param) || r.param < 2 || r.param > 400)) return "The look-back must be a whole number of bars from 2 to 400.";
  return null;
}

/** The rule in words, for lists and notifications. */
export function describeAlert(r: AlertRule, fmt: (v: number) => string = String): string {
  switch (r.kind) {
    case "price_above": return `Close above ${fmt(r.value ?? 0)}`;
    case "price_below": return `Close below ${fmt(r.value ?? 0)}`;
    case "rsi_above": return `RSI(${r.param}) above ${r.value}`;
    case "rsi_below": return `RSI(${r.param}) below ${r.value}`;
    case "cross_above_sma": return `Close crosses above its ${r.param}-bar average`;
    case "cross_below_sma": return `Close crosses below its ${r.param}-bar average`;
  }
}

/**
 * The first bar on or after `from` (a YYYY-MM-DD date, usually the day the alert was made)
 * that meets the rule, or null. When no bar is that new yet (the data is delayed), only
 * the latest bar is checked, so an alert set on a level the price is already past fires
 * on the latest close. A cross needs the bar before it too, so it compares each bar with
 * the one before.
 */
export function evaluateAlert(r: AlertRule, bars: Bar[], from?: string): AlertHit | null {
  if (!bars.length || validateAlert(r)) return null;
  let start = from ? bars.findIndex((b) => b.time >= from) : bars.length - 1;
  if (start < 0) start = bars.length - 1;
  const closes = bars.map((b) => b.close);
  const level = r.value as number;
  if (r.kind === "price_above" || r.kind === "price_below") {
    for (let i = start; i < bars.length; i++) {
      const c = closes[i];
      if (r.kind === "price_above" ? c > level : c < level) return { bar: bars[i].time, value: c };
    }
    return null;
  }
  if (r.kind === "rsi_above" || r.kind === "rsi_below") {
    const line = rsi(bars, r.param as number);
    for (let i = start; i < bars.length; i++) {
      const v = line[i];
      if (v == null) continue;
      if (r.kind === "rsi_above" ? v > level : v < level) return { bar: bars[i].time, value: v };
    }
    return null;
  }
  const avg = smaOf(closes, r.param as number);
  for (let i = Math.max(start, 1); i < bars.length; i++) {
    const a0 = avg[i - 1], a1 = avg[i];
    if (a0 == null || a1 == null) continue;
    const up = closes[i - 1] <= a0 && closes[i] > a1;
    const down = closes[i - 1] >= a0 && closes[i] < a1;
    if (r.kind === "cross_above_sma" ? up : down) return { bar: bars[i].time, value: closes[i] };
  }
  return null;
}

/** The date part of a timestamp, used as the first bar an alert may fire on. */
export const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : undefined);
