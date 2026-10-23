import { describe, expect, it } from "vitest";
import { checkIdea, DEFAULT_ANSWERS, QUESTIONS, summary, type Answers } from "../src/lib/edgeChecklist";
import { exampleById, lessonById, lessons } from "../src/lib/edgeLab";

const ask = (over: Partial<Answers>) => checkIdea({ ...DEFAULT_ANSWERS, ...over });
const ids = (over: Partial<Answers>) => ask(over).map((p) => p.id);

describe("edge checklist", () => {
  it("finds no serious problem in a careful, slow, registered idea", () => {
    const list = ask({ frequency: "monthly", trials: "one" });
    expect(list.filter((p) => p.severity === "high")).toEqual([]);
    expect(list.map((p) => p.id)).toContain("register-first");
    expect(summary(list)).toMatch(/No major red flags/);
  });

  it("flags cash-only results and untradable prices first", () => {
    const list = ask({ cash: "almost-always", instrument: "spot", trials: "one" });
    expect(list[0].id).toBe("cash-fake-sharpe");
    expect(list[1].id).toBe("untradable-spot");
    expect(list[1].example).toBe("natural-gas");
  });

  it("knows each kind of data's release lag", () => {
    expect(ids({ data: ["macro"] })).toContain("lag-macro");
    expect(ids({ data: ["weekly"] })).toContain("lag-weekly");
    expect(ids({ data: ["fundamentals"] })).toContain("lag-fundamentals");
    expect(ids({ data: ["news"] })).toContain("lag-news");
    expect(ids({ data: ["prices"], frequency: "monthly" })).not.toContain("lag-closes");
  });

  it("says there is no clean test left when the period was seen and nothing kept aside", () => {
    expect(ids({ seen: "yes", holdout: "no" })).toContain("no-clean-test");
    expect(ids({ seen: "no", holdout: "no" })).toContain("no-holdout");
    expect(ids({ seen: "yes", holdout: "yes" })).not.toContain("no-clean-test");
  });

  it("raises the bar with the number of tries", () => {
    expect(ask({ trials: "hundreds" }).find((p) => p.id === "many-trials")?.severity).toBe("high");
    expect(ask({ trials: "unknown" }).find((p) => p.id === "many-trials")?.title).toMatch(/Count/);
    expect(ask({ trials: "dozens" }).find((p) => p.id === "some-trials")?.severity).toBe("medium");
    expect(ids({ trials: "one" }).some((id) => id.endsWith("trials"))).toBe(false);
  });

  it("treats costs, capacity and decay by how and where it trades", () => {
    expect(ask({ frequency: "intraday" }).find((p) => p.lesson === "costs")?.severity).toBe("high");
    expect(ask({ frequency: "daily", assets: "illiquid" }).find((p) => p.id === "costs-daily")?.severity).toBe("high");
    expect(ids({ assets: "illiquid" })).toContain("capacity");
    expect(ask({ published: "old" }).find((p) => p.id === "decay")?.severity).toBe("medium");
    expect(ids({ published: "no" })).not.toContain("decay");
  });

  it("always sorts high, then medium, then low", () => {
    const order = { high: 0, medium: 1, low: 2 };
    const list = ask({ data: ["macro", "weekly", "news", "prices"], frequency: "intraday", trials: "dozens", instrument: "index", seen: "unsure", holdout: "unsure", sharpe: "high", cash: "mostly", published: "new", assets: "illiquid" });
    const ranks = list.map((p) => order[p.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
  });

  it("links every pitfall to a real lesson and example", () => {
    expect(lessons).toHaveLength(7);
    for (const q of QUESTIONS) {
      for (const [v] of q.options) {
        for (const p of ask({ [q.key]: v } as Partial<Answers>)) {
          expect(lessonById[p.lesson], p.id).toBeTruthy();
          if (p.example) expect(exampleById[p.example], p.example).toBeTruthy();
        }
      }
    }
  });
});
