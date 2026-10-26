// Conflation for the fan-out (REF-0019): at most MAX_PER_SECOND updates a second per
// symbol. A trade after a quiet spell goes out at once (no added delay); trades inside a
// window are folded into one update (last price, high, low, summed volume) that goes out
// when the window ends. So a busy symbol costs at most four messages a second per viewer
// and a quiet one is never held back.
import { WINDOW_MS, type Tick } from "./protocol";

/** One trade as an adapter reports it. */
export interface Trade { s: string; p: number; v: number; te: number; /** 1 buy, 2 sell (the taker side), 0 or missing when unknown. */ side?: 0 | 1 | 2 }

interface Slot { pending: Tick | null; lastSent: number; seq: number }

export class Conflator {
  private slots = new Map<string, Slot>();
  /** Trades folded into an update that was not sent on its own. */
  folded = 0;

  constructor(private windowMs = WINDOW_MS) {}

  /**
   * Add a trade received at `now`. Returns the updates to send now (usually none or one).
   * A window never spans two minutes, so a candle's open and close stay in their own bar.
   */
  add(t: Trade, now: number): Tick[] {
    if (!Number.isFinite(t.p) || t.p <= 0) return [];
    let slot = this.slots.get(t.s);
    if (!slot) { slot = { pending: null, lastSent: -Infinity, seq: 0 }; this.slots.set(t.s, slot); }
    const v = Number.isFinite(t.v) && t.v > 0 ? t.v : 0;
    const out: Tick[] = [];
    if (slot.pending && Math.floor(slot.pending.te / 60_000) !== Math.floor(t.te / 60_000)) {
      out.push(this.stamp(slot, slot.pending, now));
      slot.pending = null;
    }
    if (slot.pending) {
      const p = slot.pending;
      p.p = t.p; p.h = Math.max(p.h, t.p); p.l = Math.min(p.l, t.p); p.v += v; p.n += 1;
      p.te = Math.max(p.te, t.te); p.tr = now;
      this.folded += 1;
      return out;
    }
    const tick: Tick = { s: t.s, o: t.p, p: t.p, h: t.p, l: t.p, v, n: 1, te: t.te, tr: now, ts: 0, q: 0 };
    if (!out.length && now - slot.lastSent >= this.windowMs) out.push(this.stamp(slot, tick, now));
    else slot.pending = tick;
    return out;
  }

  /** Updates whose window has ended by `now`. */
  due(now: number): Tick[] {
    const out: Tick[] = [];
    for (const slot of this.slots.values()) {
      if (slot.pending && now - slot.lastSent >= this.windowMs) {
        const t = slot.pending;
        slot.pending = null;
        out.push(this.stamp(slot, t, now));
      }
    }
    return out;
  }

  /** Whether any update is waiting for its window. */
  get waiting(): boolean {
    for (const s of this.slots.values()) if (s.pending) return true;
    return false;
  }

  drop(symbol: string) { this.slots.delete(symbol); }

  private stamp(slot: Slot, t: Tick, now: number): Tick {
    slot.lastSent = now;
    slot.seq += 1;
    t.ts = now;
    t.q = slot.seq;
    return t;
  }
}
