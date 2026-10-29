// The first-run intro (DEC-0077): the questions, who sees it, and how the answers feed the
// checklist order, Home's widget order and What's new. No React and no network here, so the
// rules are unit tested (tests/intro.test.ts).
import type { Profile } from "../lib/personalize/api";
import { INTERESTS_KEY } from "./items";

export type IntroStatus = "done" | "skipped";
export type IntroGoal = "verify" | "learn" | "trade" | "research";
export type IntroLevel = "new" | "some" | "experienced";
export type IntroMarket = "stocks" | "fx" | "crypto" | "commodities";

export interface Option<T extends string> { id: T; title: string; body: string }

export const GOALS: Option<IntroGoal>[] = [
  { id: "verify", title: "Check a strategy or a bot", body: "Upload a trade log or describe a bot. Verify says whether the record holds up." },
  { id: "learn", title: "Learn how trading works", body: "Short Academy lessons, each with a quick check at the end." },
  { id: "trade", title: "Practise with a demo account", body: "Charts and orders in Parity Trade, with virtual money and delayed prices." },
  { id: "research", title: "Read the research", body: "Every strategy we have tested, after trading costs, with its verdict." },
];

export const LEVELS: Option<IntroLevel>[] = [
  { id: "new", title: "Never", body: "We start with what each number means." },
  { id: "some", title: "A little", body: "You know what a stop loss is." },
  { id: "experienced", title: "For years", body: "You want the numbers first." },
];

export const MARKETS: Option<IntroMarket>[] = [
  { id: "stocks", title: "Stocks", body: "Shares and stock indexes." },
  { id: "fx", title: "Currencies", body: "Pairs such as EUR/USD." },
  { id: "crypto", title: "Crypto", body: "Bitcoin, Ether and others." },
  { id: "commodities", title: "Commodities", body: "Oil, gas, gold." },
];

/** The screens, in order. intro_step is an index into this list. */
export const SCREENS = ["goal", "level", "markets", "result"] as const;
export type Screen = (typeof SCREENS)[number];

const isGoal = (v: unknown): v is IntroGoal => GOALS.some((g) => g.id === v);
const isLevel = (v: unknown): v is IntroLevel => LEVELS.some((g) => g.id === v);
export const isMarket = (v: unknown): v is IntroMarket => MARKETS.some((g) => g.id === v);

/** What the row needs for the rules below. */
export interface IntroRow {
  intro_status: IntroStatus | null;
  intro_step: number;
  intro_goal: IntroGoal | null;
  intro_level: IntroLevel | null;
  intro_markets: IntroMarket[];
  tours_off: boolean;
  tours_seen: string[];
  ai_at: string | null; verify_at: string | null; trade_at: string | null; watch_at: string | null;
  lesson_at: string | null; mfa_at: string | null; wallet_at: string | null;
}

/**
 * Whether the intro opens by itself. Only for a signed-in person whose row is saved with the
 * account (so "never again" holds on every device), who has not ended it and has not turned
 * guidance off. Someone who already used the app before the intro existed (a tour seen or a
 * checklist item done) does not get it, unless they had started it.
 */
export function introDue(s: { ready: boolean; local: boolean; row: IntroRow }): boolean {
  const r = s.row;
  if (!s.ready || s.local || r.intro_status || r.tours_off) return false;
  if (r.intro_step > 0 || r.intro_goal) return true;
  const used = r.tours_seen.length > 0 || [r.ai_at, r.verify_at, r.trade_at, r.watch_at, r.lesson_at, r.mfa_at, r.wallet_at].some(Boolean);
  return !used;
}

/** The screen to resume on, within range. */
export function resumeStep(step: number): number {
  return Number.isInteger(step) ? Math.max(0, Math.min(SCREENS.length - 1, step)) : 0;
}

/**
 * The picks the checklist and Home already read (INTERESTS_KEY, from the old welcome): the
 * goal, and Academy first for someone who has never traded.
 */
export function picksFor(goal: IntroGoal | null, level: IntroLevel | null): string[] {
  const out: string[] = [];
  if (goal === "verify") out.push("verify");
  if (goal === "learn") out.push("learn");
  if (goal === "trade") out.push("trade");
  if (goal === "research") out.push("strategies");
  if (level === "new" && !out.includes("learn")) out.push("learn");
  return out;
}

/** The picks for this person: from their saved answers, else what this browser kept. */
export function picksOf(row: { intro_goal: IntroGoal | null; intro_level: IntroLevel | null }): string[] {
  if (row.intro_goal || row.intro_level) return picksFor(row.intro_goal, row.intro_level);
  try {
    const v = JSON.parse(window.localStorage.getItem(INTERESTS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writePicks(picks: string[]) {
  try { window.localStorage.setItem(INTERESTS_KEY, JSON.stringify(picks)); } catch { /* private window */ }
}

// ---------------------------------------------------------------- the first result

/** Well-known strategies to check on the last screen, by the market picked first. */
const SAMPLE: Record<IntroMarket | "any", string[]> = {
  stocks: ["stocks_trend_10m", "fx_carry"],
  fx: ["fx_carry", "fx_tsmom", "stocks_trend_10m"],
  crypto: ["stocks_trend_10m", "fx_carry"],
  commodities: ["stocks_trend_10m", "fx_carry"],
  any: ["stocks_trend_10m", "fx_carry"],
};

/** The strategy the last screen checks: a known one for the person's market, else any tested one. */
export function sampleFor<R extends { strategy: string; is_benchmark?: boolean; equity: unknown[]; gauntlet?: unknown }>(runs: R[], markets: IntroMarket[]): R | null {
  const ok = runs.filter((r) => !r.is_benchmark && r.gauntlet && r.equity.length > 30);
  for (const id of SAMPLE[markets.find((m) => SAMPLE[m]) ?? "any"]) {
    const r = ok.find((x) => x.strategy === id);
    if (r) return r;
  }
  return ok[0] ?? null;
}

// ---------------------------------------------------------------- What's new

const KIND_FOR_GOAL: Record<IntroGoal, string> = { verify: "verify", learn: "lesson", trade: "market", research: "algo" };

/**
 * The profile What's new ranks with, with the intro's answers mixed in. The answers count for
 * less as real use grows (weight 1 - engagement), so what someone does wins over what they
 * said. Returns the profile unchanged when there are no answers. Only called while
 * personalization is on.
 */
export function withStated(p: Profile | null, a: { goal: IntroGoal | null; level: IntroLevel | null; markets: IntroMarket[] }): Profile | null {
  const markets = a.markets.filter(isMarket);
  const goal = isGoal(a.goal) ? a.goal : null;
  const level = isLevel(a.level) ? a.level : null;
  if (!goal && !level && !markets.length) return p;
  const base: Profile = p ?? {
    learner: 0, trader: 0, risk: null, engagement: 0, paid_use: 0, segment: "new", risk_band: "unknown", engagement_band: "new",
    interests: { asset: {}, family: {}, kind: {} }, widgets: {}, inputs: {}, sources: [], computed_at: new Date(0).toISOString(),
  };
  const w = Math.max(0, Math.min(1, 1 - (base.engagement ?? 0)));
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const asset = { ...(base.interests?.asset ?? {}) };
  for (const m of markets) asset[m] = (asset[m] ?? 0) + w / markets.length;
  const kind = { ...(base.interests?.kind ?? {}) };
  if (goal) kind[KIND_FOR_GOAL[goal]] = (kind[KIND_FOR_GOAL[goal]] ?? 0) + w * 0.5;
  return {
    ...base,
    learner: clamp(base.learner + w * ((goal === "learn" ? 0.6 : 0) + (level === "new" ? 0.3 : 0))),
    trader: clamp(base.trader + w * ((goal === "trade" ? 0.6 : 0) + (level === "experienced" ? 0.3 : 0))),
    interests: { asset, family: { ...(base.interests?.family ?? {}) }, kind },
    stated: { asset: markets, kind: goal ? [KIND_FOR_GOAL[goal]] : [] },
  };
}
