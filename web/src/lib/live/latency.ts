// Latency for live feeds (DEC-0049, REF-0019): the browser's clock offset from our edge,
// each hop of every update, and whether a feed is fresh, late or stale.
//
// Hops, in milliseconds, all in the edge's clock:
//   feed    exchange time to our edge receiving it
//   edge    our edge receiving it to sending it (includes the conflation window)
//   net     our edge sending it to this browser receiving it
//   screen  this browser receiving it to drawing it (the next animation frame)
//   e2e     exchange time to drawn on screen, the whole trip
import type { FeedType, Tick } from "./protocol";

export type Hop = "feed" | "edge" | "net" | "screen" | "e2e";
export const HOPS: Hop[] = ["feed", "edge", "net", "screen", "e2e"];

/**
 * The browser's clock against the edge's, from ping/pong pairs. Keeps the pair with the
 * shortest round trip among the last few, as NTP does, since its midpoint is the least
 * uncertain.
 */
export class ClockOffset {
  private samples: { rtt: number; offset: number }[] = [];
  /** Edge time minus browser time, ms. 0 until the first pong. */
  offset = 0;
  /** Round trip of the sample in use, ms. */
  rtt = Infinity;

  add(sentAt: number, serverTs: number, receivedAt: number) {
    const rtt = receivedAt - sentAt;
    if (!(rtt >= 0) || rtt > 10_000) return;
    this.samples.push({ rtt, offset: serverTs - (sentAt + receivedAt) / 2 });
    if (this.samples.length > 8) this.samples.shift();
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = best.rtt;
  }

  /** The edge's time now, as best this browser can tell. */
  now(browserNow = Date.now()): number { return browserNow + this.offset; }
}

export interface HopTimes { feed: number; edge: number; net: number; screen: number; e2e: number }

/** Each hop of one update. `recv` and `paint` are already in the edge's clock. */
export function hops(t: Pick<Tick, "te" | "tr" | "ts">, recv: number, paint: number): HopTimes {
  const nz = (x: number) => Math.max(0, Math.round(x));
  return { feed: nz(t.tr - t.te), edge: nz(t.ts - t.tr), net: nz(recv - t.ts), screen: nz(paint - recv), e2e: nz(paint - t.te) };
}

export type Freshness = "ok" | "late" | "stale";

/** Limits per feed type: [late after, stale after] in ms of data age. */
export const AGE_LIMITS: Record<FeedType, [number, number]> = {
  rt: [5_000, 60_000],
  d15: [20 * 60_000, 40 * 60_000],
  eod: [4 * 86_400_000, 7 * 86_400_000],
};

/** How fresh a feed looks: its age, its end-to-end time and whether the line is up. */
export function freshness(feed: FeedType, ageMs: number | null, e2eMs: number | null, up: boolean): Freshness {
  if (!up || ageMs == null) return "stale";
  const [late, stale] = AGE_LIMITS[feed];
  if (ageMs > stale) return "stale";
  if (ageMs > late || (feed === "rt" && e2eMs != null && e2eMs > 1_000)) return "late";
  return "ok";
}

/** Short text for a duration: 84 ms, 3.2 s, 4 min, 2 h, 3 d. */
export function msText(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  const a = Math.abs(ms);
  if (a < 1000) return `${Math.round(ms)} ms`;
  if (a < 60_000) return `${(ms / 1000).toFixed(a < 10_000 ? 1 : 0)} s`;
  if (a < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (a < 172_800_000) return `${Math.round(ms / 3_600_000)} h`;
  return `${Math.round(ms / 86_400_000)} d`;
}

/**
 * A fixed-size random sample of each hop over a window (reservoir sampling), so a busy
 * feed and a quiet one send the same few numbers and the hourly histograms still get an
 * unbiased picture.
 */
export class Reservoir {
  private kept = new Map<string, number[]>();
  private seen = new Map<string, number>();
  constructor(private size = 4, private rand: () => number = Math.random) {}

  add(key: string, v: number) {
    const n = (this.seen.get(key) ?? 0) + 1;
    this.seen.set(key, n);
    const k = this.kept.get(key) ?? [];
    if (k.length < this.size) k.push(v);
    else { const j = Math.floor(this.rand() * n); if (j < this.size) k[j] = v; }
    this.kept.set(key, k);
  }

  /** Everything kept since the last drain, then empty. */
  drain(): { key: string; v: number }[] {
    const out: { key: string; v: number }[] = [];
    for (const [key, vs] of this.kept) for (const v of vs) out.push({ key, v });
    this.kept.clear();
    this.seen.clear();
    return out;
  }
}
