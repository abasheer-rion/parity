// Personalization (DEC-0068): hooks are true statements, the ranking is stable and drops what
// was dismissed, widgets never fold required ones, assignment matches the database, and the
// experiment intervals match known values.
import { describe, expect, it } from "vitest";
import type { Profile, WidgetState } from "../src/lib/personalize/api";
import type { Candidate } from "../src/lib/personalize/candidates";
import { bucket, pickVariant } from "../src/lib/personalize/experiments";
import { hookFor, lineFor } from "../src/lib/personalize/hooks";
import { rank } from "../src/lib/personalize/rank";
import { diffInterval, wilson } from "../src/lib/personalize/stats";
import { adaptWidgets, type WidgetDef } from "../src/lib/personalize/widgets";

const cand = (item: string, over: Partial<Candidate> = {}): Candidate => ({
  item, kind: item.split(":")[0] as Candidate["kind"], title: item, description: `About ${item}.`, href: "#/x", tags: [], facts: {}, ...over,
});

const profile = (over: Partial<Profile> = {}): Profile => ({
  learner: 0.2, trader: 0.6, risk: 0.5, engagement: 0.4, paid_use: 0, segment: "trader", risk_band: "moderate",
  engagement_band: "light", interests: { asset: { crypto: 1 }, family: {}, kind: {} }, widgets: {},
  inputs: { demo_orders: 3, lessons_done: 0 }, sources: ["product"], computed_at: "2026-10-26T00:00:00Z", ...over,
});

describe("hooks", () => {
  it("quotes a win rate with a loss only when both are in the data", () => {
    const bot = cand("algo:bot-a", { facts: { winRate: 0.991, pnl: -120, trades: 200 } });
    expect(hookFor(bot)).toBe("This bot won 99.1% of trades and still lost money.");
    expect(hookFor(cand("algo:bot-b", { facts: { winRate: 0.991, pnl: 50, trades: 200 } }))).toBeNull();
    expect(hookFor(cand("algo:bot-c", { facts: { winRate: 0.991, pnl: -1, trades: 3 } }))).toBeNull();
  });
  it("falls back to the description, and the control arm shows no hook", () => {
    const bot = cand("algo:bot-a", { facts: { winRate: 0.991, pnl: -120, trades: 200 } });
    expect(lineFor(bot, false)).toBe("About algo:bot-a.");
    expect(lineFor(cand("tool:try"))).toBe("About tool:try.");
  });
  it("never uses dashes or advice words", () => {
    const lines = [
      hookFor(cand("algo:a", { facts: { cagr: 0.05, beatsMarket: false } })),
      hookFor(cand("algo:b", { facts: { maxDrawdown: -0.55 } })),
      hookFor(cand("algo:c", { facts: { passed: 3, total: 11 } })),
      hookFor(cand("lesson:l", { facts: { lessons: 4, minutes: 30 } })),
    ];
    for (const l of lines) {
      expect(l).toBeTruthy();
      expect(l).not.toMatch(/[–—]|invest|buy|should/i);
    }
  });
});

describe("rank", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const cands = [
    cand("market:crypto", { tags: ["asset:crypto"], addedAt: "2026-10-01" }),
    cand("lesson:basics", { addedAt: "2026-10-20" }),
    cand("tool:try", { addedAt: "2026-10-25" }),
    cand("algo:x", { tags: ["asset:fx"] }),
  ];
  it("is the same within a day", () => {
    const a = rank(cands, { profile: profile(), seed: "u1", now, order: "personal" }).map((r) => r.item);
    const b = rank(cands, { profile: profile(), seed: "u1", now: new Date("2026-10-26T20:00:00Z"), order: "personal" }).map((r) => r.item);
    expect(a).toEqual(b);
  });
  it("drops dismissed items", () => {
    const r = rank(cands, { profile: profile(), seed: "u1", now, feedback: [{ item: "tool:try", shown: 1, clicked_at: null, dismissed_at: "2026-10-25" }] });
    expect(r.map((x) => x.item)).not.toContain("tool:try");
  });
  it("control is newest first, and so is personalization off", () => {
    const want = ["tool:try", "lesson:basics", "market:crypto", "algo:x"];
    expect(rank(cands, { profile: profile(), seed: "u1", now, order: "control" }).map((r) => r.item)).toEqual(want);
    expect(rank(cands, { profile: null, seed: "u1", now }).map((r) => r.item)).toEqual(want);
  });
  it("gives every item a reason in plain words", () => {
    for (const r of rank(cands, { profile: profile(), seed: "u1", now, order: "personal" })) {
      expect(r.why.length).toBeGreaterThan(0);
      expect(r.why.join(" ")).not.toMatch(/[–—]/);
    }
  });
});

describe("widgets", () => {
  const defs: WidgetDef[] = [
    { id: "account", order: 0, required: true }, { id: "news", order: 1 }, { id: "markets", order: 2 }, { id: "disclaimer", order: 3 },
  ];
  const state = (over: Partial<WidgetState>[]): WidgetState[] =>
    over.map((o) => ({ widget_id: "news", ignored_sessions: 0, choice: "auto", last_used_at: null, ...o }));

  it("never folds required widgets, even when ignored or chosen", () => {
    const l = adaptWidgets(defs, state([{ widget_id: "account", ignored_sessions: 9, choice: "collapse" }, { widget_id: "disclaimer", ignored_sessions: 9 }]), profile(), { collapseAfter: 5 });
    expect(l.collapsed).toEqual([]);
    expect(l.order[0]).toBe("account");
  });
  it("folds after 5 ignored sessions only in the collapse arm", () => {
    const s = state([{ widget_id: "news", ignored_sessions: 5 }]);
    expect(adaptWidgets(defs, s, profile(), { collapseAfter: 5 }).collapsed).toEqual(["news"]);
    expect(adaptWidgets(defs, s, profile(), {}).collapsed).toEqual([]);
    expect(adaptWidgets(defs, state([{ widget_id: "news", ignored_sessions: 4 }]), profile(), { collapseAfter: 5 }).collapsed).toEqual([]);
  });
  it("never folds a widget the person chose to keep", () => {
    expect(adaptWidgets(defs, state([{ widget_id: "news", ignored_sessions: 50, choice: "keep" }]), profile(), { collapseAfter: 5 }).collapsed).toEqual([]);
  });
  it("uses the registry order when personalization is off", () => {
    const l = adaptWidgets(defs, state([{ widget_id: "news", ignored_sessions: 9 }]), profile(), { collapseAfter: 5, enabled: false });
    expect(l).toEqual({ order: ["account", "news", "markets", "disclaimer"], collapsed: [] });
  });
  it("moves used widgets up", () => {
    const l = adaptWidgets(defs, state([{ widget_id: "news", ignored_sessions: 3 }, { widget_id: "markets", ignored_sessions: 0 }]),
      profile({ widgets: { markets: { used: 6, ignored_sessions: 0 } } }));
    expect(l.order).toEqual(["account", "markets", "news", "disclaimer"]);
  });
});

describe("experiments", () => {
  it("buckets the same as the database test vector", () => {
    expect(bucket("t", "11111111-1111-1111-1111-111111111111")).toBeCloseTo(0.5389482050668448, 12);
  });
  it("picks by cumulative weight", () => {
    const v = [{ key: "control", weight: 50 }, { key: "b", weight: 50 }];
    expect(pickVariant(v, 0.49)).toBe("control");
    expect(pickVariant(v, 0.5)).toBe("b");
  });
});

describe("stats", () => {
  it("matches the Wilson interval for 10 of 100", () => {
    const w = wilson(10, 100)!;
    expect(w.lo).toBeCloseTo(0.0552, 3);
    expect(w.hi).toBeCloseTo(0.1744, 3);
    expect(wilson(0, 0)).toBeNull();
  });
  it("matches Newcombe's interval for 56/70 against 48/80", () => {
    // Newcombe (1998), example (b): difference 0.2, interval 0.0524 to 0.3339.
    const d = diffInterval(56, 70, 48, 80)!;
    expect(d.estimate).toBeCloseTo(0.2, 6);
    expect(d.lo).toBeCloseTo(0.0524, 3);
    expect(d.hi).toBeCloseTo(0.3339, 3);
  });
});
