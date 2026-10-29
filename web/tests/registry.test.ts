// The data registry pages' helpers (DEC-0064): filters, uptime and the words they show.
import { describe, expect, it } from "vitest";
import { eventWords, filterSeries, lagWords, sourceUptime, uptimeShare, type DataEvent, type DataSeries, type Uptime } from "../src/lib/registry";
import { reasonKind } from "../src/pages/registry/Candidates";

const s = (over: Partial<DataSeries>): DataSeries => ({
  id: "fx.EUR", source_id: "fred", code: "DEXUSEU", name: "USD per EUR", symbol: "EUR", asset_class: "fx", region: "EU", frequency: "D", units: "",
  start_date: null, end_date: null, published_after: null, lag_days: 0, tags: ["fx", "g10"], labels: {}, quality: null, status: "live",
  display_rights: "public", origin: "catalog", intended_use: "research", required: true, reason: "", discovered_by: "", discovered_at: null,
  enrolled_at: null, health: "ok", health_checked_at: null, health_detail: {}, last_obs: null, backup_id: null, updated_at: "", ...over,
});

describe("registry helpers", () => {
  const rows = [s({}), s({ id: "kraken.XBTUSD", source_id: "kraken", asset_class: "crypto", tags: ["crypto"], display_rights: "internal", status: "candidate" })];

  it("filters by text, tag, status and rights", () => {
    expect(filterSeries(rows, { q: "xbt" }).map((r) => r.id)).toEqual(["kraken.XBTUSD"]);
    expect(filterSeries(rows, { tag: "g10" })).toHaveLength(1);
    expect(filterSeries(rows, { status: "candidate", rights: "internal" })).toHaveLength(1);
    expect(filterSeries(rows, { rights: "public", asset: "crypto" })).toHaveLength(0);
  });

  it("reads uptime from daily counters", () => {
    const u: Uptime[] = [
      { scope: "source", id: "fred", day: "2026-10-25", checks: 10, ok: 10, late: 0, stale: 0, down: 0 },
      { scope: "source", id: "fred", day: "2026-10-26", checks: 10, ok: 5, late: 0, stale: 5, down: 0 },
      { scope: "source", id: "ecb", day: "2026-10-26", checks: 4, ok: 4, late: 0, stale: 0, down: 0 },
    ];
    expect(uptimeShare(u.filter((x) => x.id === "fred"))).toBe(0.75);
    expect(uptimeShare([])).toBeNull();
    const by = sourceUptime(u);
    expect(by[0]).toEqual({ id: "fred", share: 0.75, days: 2, worst: "2026-10-26" });
  });

  it("says the lag and the events in plain words, without long dashes", () => {
    expect(lagWords({ frequency: "M", published_after: 22, lag_days: 0 })).toBe("used 22 business days after each month ends");
    expect(lagWords({ frequency: "D", published_after: null, lag_days: 1 })).toBe("used 1 business day after its date");
    const e = (kind: string, detail: Record<string, unknown> = {}, to: string | null = null): DataEvent => ({ id: 1, at: "", series_id: "x", source_id: "y", kind, from_state: "live", to_state: to, detail });
    const words = [eventWords(e("rejected", { reason: "history: 122 values" })), eventWords(e("status", {}, "degraded")), eventWords(e("backtest", { tests: 4, new_trials: 4 }))];
    expect(words).toEqual(["waits: history: 122 values", "live to degraded", "tested on arrival: 4 tests, 4 new trials"]);
    expect(words.join(" ")).not.toMatch(/—|–/);
  });

  it("groups wait reasons by gate step", () => {
    expect(reasonKind("history: 422 values, at least 500 needed")).toBe("history");
    expect(reasonKind("licence: Competitor feedback collector has no display rights")).toBe("licence");
    expect(reasonKind("quality 0.50 below 0.6: 30 outliers")).toBe("quality");
    expect(reasonKind("waiting for the enrolment checks")).toBe("not checked yet");
  });
});
