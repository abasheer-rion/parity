// Candles from live trades (DEC-0052). History arrives as finished bars from the source's
// own candle endpoint; live updates fold into the bar that is forming. A bar is finished
// once a trade lands in a later period, and only finished bars feed the strategy signals,
// so a signal never uses a price from after its bar's close.
//
// Intraday bars are keyed by an ISO time string ("2026-10-25T14:05:00Z"), daily bars by
// their date ("2026-10-25"). Both sort as text, which the chart code relies on.
import type { Bar } from "../indicators";
import type { Tick } from "./protocol";

export type LiveTf = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const LIVE_TFS: { id: LiveTf; label: string; sec: number }[] = [
  { id: "1m", label: "1m", sec: 60 },
  { id: "5m", label: "5m", sec: 300 },
  { id: "15m", label: "15m", sec: 900 },
  { id: "1h", label: "1h", sec: 3600 },
  { id: "4h", label: "4h", sec: 14400 },
  { id: "1d", label: "1D", sec: 86400 },
];

export const tfSeconds = (tf: LiveTf) => LIVE_TFS.find((t) => t.id === tf)?.sec ?? 60;

/** The key of the bar a time (ms) falls in. */
export function barKey(ms: number, tf: LiveTf): string {
  const sec = tfSeconds(tf);
  const start = Math.floor(ms / 1000 / sec) * sec * 1000;
  const iso = new Date(start).toISOString();
  return tf === "1d" ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`;
}

/** Milliseconds of a bar key, the inverse of barKey. */
export function keyMs(key: string): number {
  return Date.parse(key.length === 10 ? `${key}T00:00:00Z` : key);
}

export type Change = "last" | "new";

/**
 * Holds the bars of one chart and folds live updates into them. `bars` is mutated in
 * place (the chart reads it on each frame); listeners hear "last" when the forming bar
 * changed and "new" when a bar finished and another began.
 */
export class CandleBuilder {
  readonly bars: Bar[];
  private listeners = new Set<(c: Change) => void>();
  /** The exchange time of the newest update folded in. */
  lastTe = 0;

  /** fromCloses: a new bar opens at the previous close (sources that give prices, not trades). */
  constructor(history: Bar[], readonly tf: LiveTf, private fromCloses = false) {
    this.bars = history.map((b) => ({ ...b }));
  }

  /** Number of finished bars: all but the forming one. */
  get closed(): number {
    if (!this.bars.length) return 0;
    const last = this.bars[this.bars.length - 1];
    return last.time === barKey(Date.now(), this.tf) ? this.bars.length - 1 : this.bars.length;
  }

  on(fn: (c: Change) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Fold one update in. Out-of-order updates for an older bar are ignored. */
  apply(t: Tick): Change | null {
    const key = barKey(t.te || t.tr, this.tf);
    const last = this.bars[this.bars.length - 1];
    let change: Change;
    if (last && last.time === key) {
      last.high = Math.max(last.high, t.h);
      last.low = Math.min(last.low, t.l);
      last.close = t.p;
      if (t.v) last.volume = (last.volume ?? 0) + t.v;
      change = "last";
    } else if (!last || key > last.time) {
      const open = this.fromCloses && last ? last.close : t.o;
      this.bars.push({ time: key, open, high: Math.max(open, t.h), low: Math.min(open, t.l), close: t.p, volume: t.v || (last?.volume != null ? 0 : null) });
      change = "new";
    } else {
      return null;
    }
    this.lastTe = Math.max(this.lastTe, t.te);
    for (const fn of this.listeners) fn(change);
    return change;
  }
}
