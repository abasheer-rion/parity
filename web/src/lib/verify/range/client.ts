// The browser side of the fill price check (DEC-0092). From a record's trades it builds the
// list of fills to send: for each fill, the symbol, the time and the price, and nothing else.
// The page tells the person this before it runs, and runs it only if they leave it on. The
// answers come back one per fill and are matched to the trades here; the market data itself
// never reaches the browser.
import { clockOf } from "./clock";
import { route } from "./market";
import { LIMITS, type Clock, type FillAnswer, type FillPoint, type RangeAnswer } from "./types";
import type { FormatId, Parsed, Trade } from "../types";

export interface Leg { trade: number; leg: "entry" | "exit" }

/** The fills that will be sent, each with the trades it stands for. */
export interface Planned {
  clock: Clock;
  points: (FillPoint & { legs: Leg[] })[];
  /** Fills with no time, or a symbol we cannot read (futures, options, indexes). */
  skipped: number;
  /** Fills not sent because no source covers their market or coin, by the file's symbol. */
  uncovered: Record<string, number>;
}

/** What the server can check: GET /api/verify/fills. */
export interface Coverage { markets: string[]; coins: string[] | null }

export type RangeOutcome =
  | {
    ran: true;
    clock: Clock;
    /** For an unknown clock, the zone that fit best, minutes east of UTC. */
    offset: number | null;
    points: (FillPoint & { legs: Leg[] })[];
    answers: FillAnswer[];
    unsupported: string[];
    /** Fills with no time, or a symbol we cannot read (futures, options, indexes). */
    skipped: number;
    /** Fills not sent because no source covers them, by the file's symbol. */
    uncovered: Record<string, number>;
  }
  | { ran: false; why: "opted_out" | "signed_out" | "off" | "failed" | "nothing"; message?: string };

/** Wall time as sent: "YYYY-MM-DDTHH:MM:SS", or the date alone when the file has no times of day. */
const asSent = (t: string, dateOnly: boolean) => (dateOnly ? t.slice(0, 10) : t.slice(0, 19).replace(" ", "T"));

/**
 * The fills of a record, as they will be sent. An exit price is always one fill. An entry is
 * one fill too, except when the importer averaged several opening fills at different prices
 * (then no trade happened at that average, and it is not sent).
 */
export function planFills(trades: readonly Trade[], format?: FormatId, clock: Clock = "unknown", cover?: Coverage | null): Planned {
  const times = trades.flatMap((t) => [t.openTime, t.closeTime]).filter((x): x is string => !!x);
  const dateOnly = times.length > 0 && times.every((x) => x.length === 10 || /T00:00(:00)?$/.test(x));
  const byKey = new Map<string, FillPoint & { legs: Leg[] }>();
  let skipped = 0;
  const uncovered: Record<string, number> = {};
  // Only fills a source can check are sent: a currency pair, or a coin with no pool, stays here.
  const covered = (m: NonNullable<ReturnType<typeof route>>) => !cover || (cover.markets.includes(m.market) && (m.market !== "crypto" || !cover.coins || cover.coins.includes(m.base ?? "")));
  trades.forEach((t, i) => {
    const r = t.symbol ? route(t.symbol, format) : null;
    const legs: [number | undefined, string | undefined, Leg["leg"]][] = [[t.entryMixed ? undefined : t.entry, t.openTime, "entry"], [t.exit, t.closeTime, "exit"]];
    for (const [price, when, leg] of legs) {
      if (price == null || !when) continue;
      if (!r || !(price > 0) || !/^\d{4}-\d{2}-\d{2}/.test(when)) { skipped++; continue; }
      if (!covered(r) || r.market === "fx") { uncovered[t.symbol!] = (uncovered[t.symbol!] ?? 0) + 1; continue; }
      const p: FillPoint = { s: r.symbol, t: asSent(when, dateOnly), p: price };
      const k = `${p.s}|${p.t}|${p.p}`;
      const have = byKey.get(k);
      if (have) have.legs.push({ trade: i, leg }); else byKey.set(k, { ...p, legs: [{ trade: i, leg }] });
    }
  });
  return { clock, points: [...byKey.values()], skipped, uncovered };
}

/** The same, for a parsed file: its clock is read from the file. */
export function planFile(p: Parsed, cover?: Coverage | null): Planned {
  return planFills(p.trades ?? [], p.format, clockOf(p), cover);
}

/** Which markets and coins the server can check now. Sends nothing from the file. */
export async function fetchCoverage(f: typeof fetch = fetch): Promise<Coverage | null> {
  try {
    const res = await f("/api/verify/fills", { headers: { Accept: "application/json" } });
    if (!res.ok) return res.status === 404 ? { markets: [], coins: [] } : null;
    const c = (await res.json()) as Partial<Coverage>;
    return Array.isArray(c.markets) ? { markets: c.markets, coins: Array.isArray(c.coins) ? c.coins : null } : null;
  } catch {
    return null;
  }
}

export class RangeFailed extends Error {
  constructor(message: string, public code: string) { super(message); }
}

export interface RunOptions {
  /** The person's session token. */
  token: string;
  fetch?: typeof fetch;
  /** Called after each part with how many fills have an answer. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Sends the planned fills to /api/verify/fills, in parts of at most 1,000 fills and 60
 * symbols, and sends again the ones the server had no time for, up to 8 rounds.
 */
export async function runFills(plan: Planned, opt: RunOptions): Promise<RangeOutcome> {
  if (!plan.points.length) return Object.keys(plan.uncovered).length
    ? { ran: true, clock: plan.clock, offset: null, points: [], answers: [], unsupported: [], skipped: plan.skipped, uncovered: plan.uncovered }
    : { ran: false, why: "nothing" };
  const f = opt.fetch ?? fetch;
  const answers: (FillAnswer | null)[] = plan.points.map(() => null);
  const unsupported = new Set<string>();
  let offset: number | null = null;
  let todo = plan.points.map((_, i) => i);
  let stopped = false;
  for (let round = 0; round < LIMITS.rounds && todo.length && !stopped; round++) {
    const next: number[] = [];
    for (const part of parts(todo, plan.points)) {
      const res = await f("/api/verify/fills", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opt.token}` },
        // Symbol, time and price only: the server refuses anything else.
        body: JSON.stringify({ clock: plan.clock, fills: part.map((i) => ({ s: plan.points[i].s, t: plan.points[i].t, p: plan.points[i].p })) }),
      }).catch(() => null);
      const body = (res ? await res.json().catch(() => ({})) : {}) as Partial<RangeAnswer> & { error?: string; code?: string };
      if (!res?.ok || !Array.isArray(body.fills) || body.fills.length !== part.length) {
        // Answers already in hand still count; the rest say they were not checked.
        if (!answers.some((a) => a)) throw new RangeFailed(body.error ?? "The fill price check could not be reached. Try again in a minute.", body.code ?? "failed");
        stopped = true;
        break;
      }
      body.fills.forEach((a, k) => {
        const i = part[k];
        if (a.n === "more") next.push(i);
        answers[i] = a;
      });
      for (const s of body.unsupported ?? []) unsupported.add(s);
      if (body.offset != null) offset = body.offset;
      opt.onProgress?.(answers.filter((a) => a && a.n !== "more").length, plan.points.length);
    }
    todo = next;
  }
  return {
    ran: true, clock: plan.clock, offset, points: plan.points,
    answers: answers.map((a) => a ?? { r: "none", n: "busy" }), unsupported: [...unsupported], skipped: plan.skipped, uncovered: plan.uncovered,
  };
}

/** Splits fill indexes into requests the server accepts. An unknown clock keeps them together, so one time zone is fitted to all. */
function parts(idx: number[], points: FillPoint[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let syms = new Set<string>();
  for (const i of idx) {
    const s = points[i].s;
    if (cur.length >= LIMITS.fills || (!syms.has(s) && syms.size >= LIMITS.symbols)) { out.push(cur); cur = []; syms = new Set(); }
    cur.push(i);
    syms.add(s);
  }
  if (cur.length) out.push(cur);
  return out;
}
