// The first-run intro's rules (src/onboarding/introRules.ts, DEC-0077).
import { describe, expect, it } from "vitest";
import { introDue, picksFor, resumeStep, sampleFor, withStated, type IntroRow } from "../src/onboarding/introRules";
import { rank } from "../src/lib/personalize/rank";
import type { Candidate } from "../src/lib/personalize/candidates";

const ROW: IntroRow = {
  intro_status: null, intro_step: 0, intro_goal: null, intro_level: null, intro_markets: [], tours_off: false, tours_seen: [],
  ai_at: null, verify_at: null, trade_at: null, watch_at: null, lesson_at: null, mfa_at: null, wallet_at: null,
};
const due = (row: Partial<IntroRow>, s: { ready?: boolean; local?: boolean } = {}) => introDue({ ready: true, local: false, ...s, row: { ...ROW, ...row } });

describe("who gets the intro", () => {
  it("opens for a new account with its row saved with the account", () => {
    expect(due({})).toBe(true);
  });
  it("waits for the row, and never runs from a row kept only in this browser", () => {
    expect(due({}, { ready: false })).toBe(false);
    expect(due({}, { local: true })).toBe(false);
  });
  it("never opens again once finished or skipped", () => {
    expect(due({ intro_status: "done" })).toBe(false);
    expect(due({ intro_status: "skipped", intro_step: 2 })).toBe(false);
  });
  it("stays away for someone who turned guidance off or used the app before it existed", () => {
    expect(due({ tours_off: true })).toBe(false);
    expect(due({ tours_seen: ["home"] })).toBe(false);
    expect(due({ trade_at: "2026-10-20T00:00:00Z" })).toBe(false);
  });
  it("comes back where it was for someone who started it", () => {
    expect(due({ tours_seen: ["verify"], intro_step: 2 })).toBe(true);
    expect(resumeStep(2)).toBe(2);
    expect(resumeStep(9)).toBe(3);
    expect(resumeStep(-1)).toBe(0);
  });
});

describe("answers to suggestions", () => {
  it("maps the goal onto the checklist and Home picks, with Academy first for a beginner", () => {
    expect(picksFor("trade", "experienced")).toEqual(["trade"]);
    expect(picksFor("research", null)).toEqual(["strategies"]);
    expect(picksFor("verify", "new")).toEqual(["verify", "learn"]);
    expect(picksFor("learn", "new")).toEqual(["learn"]);
    expect(picksFor(null, null)).toEqual([]);
  });

  it("checks a well-known strategy for the market picked, else any tested one", () => {
    const run = (strategy: string, extra: object = {}) => ({ strategy, equity: new Array(40).fill(["2020-01-01", 1]), gauntlet: {}, ...extra });
    const runs = [run("us_market_buy_hold", { is_benchmark: true }), run("fx_carry"), run("stocks_trend_10m"), run("other")];
    expect(sampleFor(runs, ["fx"])?.strategy).toBe("fx_carry");
    expect(sampleFor(runs, ["stocks"])?.strategy).toBe("stocks_trend_10m");
    expect(sampleFor(runs, [])?.strategy).toBe("stocks_trend_10m");
    expect(sampleFor([run("other"), run("short", { equity: [] })], ["crypto"])?.strategy).toBe("other");
    expect(sampleFor([run("us_market_buy_hold", { is_benchmark: true })], [])).toBeNull();
  });

  it("mixes the answers into a profile, and they count for less as use grows", () => {
    expect(withStated(null, { goal: null, level: null, markets: [] })).toBeNull();
    const fresh = withStated(null, { goal: "learn", level: "new", markets: ["fx"] })!;
    expect(fresh.learner).toBeCloseTo(0.9);
    expect(fresh.interests.asset.fx).toBe(1);
    expect(fresh.interests.kind.lesson).toBe(0.5);
    expect(fresh.stated).toEqual({ asset: ["fx"], kind: ["lesson"] });
    const used = withStated({ ...fresh, engagement: 0.8, learner: 0, interests: { asset: { stocks: 1 }, family: {}, kind: {} }, stated: undefined }, { goal: "learn", level: null, markets: ["fx"] })!;
    expect(used.interests.asset.stocks).toBe(1);
    expect(used.interests.asset.fx).toBeCloseTo(0.2);
    expect(used.learner).toBeCloseTo(0.12);
  });

  it("ranks What's new toward the markets someone said they follow, and says so", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    const c = (item: string, tags: string[]): Candidate => ({ item, kind: item.split(":")[0], tags, title: item, href: "#/", addedAt: "2026-10-20T00:00:00Z" } as unknown as Candidate);
    const cands = [c("algo:stocks-a", ["asset:stocks"]), c("algo:fx-b", ["asset:fx"])];
    const p = withStated(null, { goal: null, level: null, markets: ["fx"] });
    const out = rank(cands, { profile: p, seed: "u1", now });
    expect(out[0].item).toBe("algo:fx-b");
    expect(out[0].why).toContain("You said you follow currencies.");
  });
});
