// Ranks the What's new feed (DEC-0068). A small model anyone can read:
//
//   score = 0.45 x content match + 0.15 x popularity + 0.25 x recency + 0.15 x exploration
//
// Content match compares the candidate's tags with the person's profile (asset classes,
// strategy families and kinds they use) and how well the kind fits a learner or a trader.
// Popularity is everyone's click rate on the item (aggregate counts, no ids). Recency decays
// over two weeks. Exploration is Thompson sampling: a draw from Beta(1 + clicks, 1 + shows -
// clicks), so items with few showings still get a chance. The random draws come from a
// generator seeded with the user id and the UTC day, so the order holds for the day.
// Dismissed items are dropped; items shown many times without a click sink.
import type { Arm, Feedback, Profile } from "./api";
import type { Candidate } from "./candidates";

export interface Ranked extends Candidate {
  score: number;
  /** Plain reasons, first one shown on the card's "Why you see this". */
  why: string[];
}

export interface RankOptions {
  profile: Profile | null;
  arms?: Arm[];
  feedback?: Feedback[];
  /** For the seeded draws; any stable string. */
  seed: string;
  now?: Date;
  /** Experiment whats_new_order: "control" is newest first, anything else is the model. */
  order?: string;
  limit?: number;
}

// ---------------------------------------------------------------- seeded random numbers

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** mulberry32: small, fast and good enough for shuffling a feed. */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) by Marsaglia and Tsang. */
function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(Math.max(rand(), 1e-12), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(rand); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** One draw from Beta(a, b). */
export function betaSample(a: number, b: number, rand: () => number): number {
  const x = gamma(a, rand), y = gamma(b, rand);
  return x / (x + y);
}

// ---------------------------------------------------------------- the parts of the score

const ASSET_WORDS: Record<string, string> = { fx: "currencies", stocks: "stocks", commodities: "commodities", crypto: "crypto", oil: "oil", gas: "gas", private: "private markets", mixed: "mixed assets" };
const KIND_WORDS: Record<string, string> = { algo: "strategies", lesson: "Academy courses", tool: "Workbench tools", market: "markets pages", scenario: "Sim World scenarios", verify: "Verify" };

function norm(rec: Record<string, number> | undefined): Record<string, number> {
  if (!rec) return {};
  const max = Math.max(0, ...Object.values(rec));
  if (max <= 0) return {};
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v / max]));
}

function kindFit(kind: string, p: Profile): number {
  switch (kind) {
    case "lesson": return p.learner;
    case "market": return p.trader;
    case "tool": return (p.learner + p.trader) / 2;
    case "verify": return 0.7 * p.trader + 0.3 * p.paid_use;
    case "scenario": return 0.6 * p.trader + 0.4 * p.learner;
    default: return 0.2 + 0.5 * p.trader + 0.3 * p.learner;
  }
}

function contentMatch(c: Candidate, p: Profile | null): { value: number; matched: string | null } {
  if (!p) return { value: 0.3, matched: null };
  const asset = norm(p.interests.asset), family = norm(p.interests.family), kind = norm(p.interests.kind);
  let best = 0, matched: string | null = null;
  for (const t of c.tags) {
    const [k, v] = t.split(":");
    const w = k === "asset" ? asset[v] ?? 0 : k === "family" ? family[v] ?? 0 : k === "kind" ? (kind[v] ?? 0) * 0.6 : 0;
    if (w > best) { best = w; matched = t; }
  }
  return { value: Math.min(1, 0.6 * best + 0.4 * Math.min(1, Math.max(0, kindFit(c.kind, p)))), matched: best > 0 ? matched : null };
}

const DAY = 86_400_000;
function ageDays(c: Candidate, now: Date): number | null {
  if (!c.addedAt) return null;
  const t = Date.parse(c.addedAt);
  return Number.isFinite(t) ? Math.max(0, (now.getTime() - t) / DAY) : null;
}

function reasonFor(matched: string | null, c: Candidate, p: Profile | null, age: number | null, popular: boolean, fresh: boolean): string[] {
  const why: string[] = [];
  if (age != null && age <= 7) why.push("New this week.");
  else if (age != null && age <= 30) why.push("Added in the last month.");
  if (matched) {
    const [k, v] = matched.split(":");
    if (k === "asset" && p?.stated?.asset.includes(v)) why.push(`You said you follow ${ASSET_WORDS[v] ?? v.replace(/-/g, " ")}.`);
    else if (k === "kind" && p?.stated?.kind.includes(v)) why.push(`You said you came for ${KIND_WORDS[v] ?? v}.`);
    else if (k === "asset") why.push(`You use ${ASSET_WORDS[v] ?? v.replace(/-/g, " ")} more than other markets.`);
    else if (k === "family") why.push(`You opened ${v.replace(/-/g, " ")} items before.`);
    else if (k === "kind") why.push(`You use ${KIND_WORDS[v] ?? v} often.`);
  }
  if (p && c.kind === "lesson" && (p.inputs.lessons_done ?? 0) > 0) {
    const n = p.inputs.lessons_done;
    why.push(`You finished ${n} Academy lesson${n === 1 ? "" : "s"}.`);
  }
  if (p && (c.kind === "market" || c.kind === "verify") && (p.inputs.demo_orders ?? 0) > 0) {
    const n = p.inputs.demo_orders;
    why.push(`You placed ${n} demo order${n === 1 ? "" : "s"}.`);
  }
  if (popular) why.push("Popular with other people.");
  if (fresh) why.push("Few people have seen this yet, so it gets a turn.");
  if (!why.length) why.push(p ? "Picked to show more of what Parity has." : "Personalization is off, so this is in the standard order.");
  return why;
}

// ---------------------------------------------------------------- ranking

/** Ranks candidates for one person. Pure: same inputs, same order. */
export function rank(cands: Candidate[], o: RankOptions): Ranked[] {
  const now = o.now ?? new Date();
  const fb = new Map((o.feedback ?? []).map((f) => [f.item, f]));
  const arms = new Map((o.arms ?? []).map((a) => [a.item, a]));
  const live = cands.filter((c) => !fb.get(c.item)?.dismissed_at);
  const limit = o.limit ?? 6;

  if (o.order === "control" || !o.profile) {
    // Newest first, then the catalog order: the standard feed, and the control arm.
    const ordered = live.map((c, i) => ({ c, i, t: c.addedAt ? Date.parse(c.addedAt) || 0 : 0 }))
      .sort((a, b) => b.t - a.t || a.i - b.i);
    return ordered.slice(0, limit).map(({ c }) => {
      const age = ageDays(c, now);
      return { ...c, score: 0, why: reasonFor(null, c, o.profile, age, false, false).slice(0, 1).concat(o.profile ? ["Shown newest first."] : []) };
    });
  }

  const rand = seededRandom(`${o.seed}:${now.toISOString().slice(0, 10)}`);
  const rates = live.map((c) => { const a = arms.get(c.item); return a ? (a.clicks + 1) / (a.shows + 20) : 1 / 20; });
  const maxRate = Math.max(...rates, 1e-9);
  const draws = live.map((c) => {
    const a = arms.get(c.item);
    const shows = Math.max(0, a?.shows ?? 0), clicks = Math.min(shows, Math.max(0, a?.clicks ?? 0));
    return betaSample(1 + clicks, 1 + shows - clicks, rand);
  });
  const maxDraw = Math.max(...draws, 1e-9);

  const scored = live.map((c, i) => {
    const m = contentMatch(c, o.profile);
    const age = ageDays(c, now);
    const recency = age == null ? 0 : Math.exp(-age / 14);
    const popularity = rates[i] / maxRate;
    const explore = draws[i] / maxDraw;
    let score = 0.45 * m.value + 0.15 * popularity + 0.25 * recency + 0.15 * explore;
    const f = fb.get(c.item);
    if (f?.clicked_at) score *= 0.6;
    else if ((f?.shown ?? 0) >= 10) score *= 0.25;
    else if ((f?.shown ?? 0) >= 5) score *= 0.5;
    const shows = arms.get(c.item)?.shows ?? 0;
    const why = reasonFor(m.matched, c, o.profile, age, popularity >= 0.8 && shows >= 50, shows < 20 && explore >= 0.8);
    return { ...c, score, why };
  });
  return scored.sort((a, b) => b.score - a.score || a.item.localeCompare(b.item)).slice(0, limit);
}
