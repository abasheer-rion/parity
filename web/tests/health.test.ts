// The health line for the always-on search and sims (DEC-0037): plain words, and a
// service silent for more than two hours shows as stale.
import { describe, expect, it } from "vitest";
import { ago, healthParts, STALE_AFTER_MS, type Heartbeat } from "../src/lib/health";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const at = (mins: number) => new Date(NOW - mins * 60000).toISOString();

describe("health line", () => {
  it("says how far along each service is and when it last reported", () => {
    const rows: Heartbeat[] = [
      { service: "search", reported_at: at(2), summary: { trials: 130466 } },
      { service: "sims", reported_at: at(14), summary: { bot_paths: 52000, cycles: 40 } },
    ];
    expect(healthParts(rows, NOW).map((p) => p.text)).toEqual([
      "search: 130,466 tries, last batch 2 min ago",
      "sims: 52,000 bot paths, last cycle 14 min ago",
    ]);
    expect(healthParts(rows, NOW).every((p) => !p.stale)).toBe(true);
  });

  it("marks a service stale after two hours without a report", () => {
    const rows: Heartbeat[] = [{ service: "search", reported_at: at(150), summary: { trials: 10 } }];
    const [search, sims] = healthParts(rows, NOW);
    expect(search).toEqual({ service: "search", stale: true, text: "search: 10 tries, no report for 2.5 hours (stale)" });
    expect(sims).toEqual({ service: "sims", stale: true, text: "sims: no report yet" });
    expect(healthParts([{ service: "sims", reported_at: at(119), summary: {} }], NOW)[1].stale).toBe(false);
    expect(STALE_AFTER_MS).toBe(7200000);
  });

  it("writes times the way people say them", () => {
    expect(ago(at(0), NOW)).toBe("just now");
    expect(ago(at(59), NOW)).toBe("59 min ago");
    expect(ago(at(120), NOW)).toBe("2 hours ago");
    expect(ago(at(60 * 72), NOW)).toBe("3 days ago");
  });

  it("never uses a long dash", () => {
    const rows: Heartbeat[] = [{ service: "search", reported_at: at(500), summary: {} }];
    expect(healthParts(rows, NOW).map((p) => p.text).join(" ")).not.toMatch(/\u2014|\u2013/);
  });
});

describe("data registry part", () => {
  it("adds the registry counts the sims service sends (DEC-0064)", () => {
    const rows: Heartbeat[] = [{ service: "sims", reported_at: at(5), summary: { bot_paths: 10, data: { series: 366, live: 320, degraded: 4, candidate: 34 } } }];
    const parts = healthParts(rows, NOW);
    expect(parts.map((p) => p.text)[2]).toBe("data: 320 live, 4 degraded, 34 waiting");
    expect(parts[2].stale).toBe(true);
    expect(healthParts([{ service: "sims", reported_at: at(5), summary: {} }], NOW)).toHaveLength(2);
  });
});

describe("egress part", () => {
  it("shows only while the daily egress check warns (REF-0028)", () => {
    const warn: Heartbeat = { service: "egress", reported_at: at(5), summary: { warn: true, gb_30d_projected: 6.2, limit_gb: 5 } };
    const parts = healthParts([warn], NOW);
    expect(parts.at(-1)).toEqual({ service: "egress", stale: true, text: "database transfer: 6.2 GB a month at this rate, plan allows 5 GB" });
    expect(healthParts([{ ...warn, summary: { warn: false, gb_30d_projected: 1.2 } }], NOW)).toHaveLength(2);
  });
});
