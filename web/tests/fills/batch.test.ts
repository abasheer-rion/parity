// The fill price check on a prop firm's batch (DEC-0087, DEC-0092): one count per account,
// a faked account stands out, large batches are sampled evenly, and the CSV carries it.
import { beforeEach, describe, expect, it } from "vitest";
import { planBatch, screenFills } from "../../src/lib/screen/fills";
import { resultsCsv } from "../../src/lib/screen/export";
import type { AccountInput, AccountResult } from "../../src/lib/screen/score";
import { handleFills } from "../../src/lib/verify/range/server";
import { memoryCache, resetPacing } from "../../src/lib/verify/range/load";
import { memoryFillQuota } from "../../src/lib/verify/range/quota";
import { FILL_SOURCES } from "../../src/lib/verify/range/registry";
import type { Trade } from "../../src/lib/verify/types";
import { marketFetch, PATH } from "./market";

const NOW = Date.parse("2026-03-20T12:00:00Z");
const at = (iso: string) => Date.parse(`${iso}Z`);

function account(id: string, fake: boolean, n = 20): AccountInput {
  const trades: Trade[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = at("2026-03-04T08:00:00") + i * 45 * 60_000, t1 = t0 + 30 * 60_000;
    const entry = Math.round(PATH["ETH-USD"](t0) * 100) / 100, exit = Math.round(PATH["ETH-USD"](t1) * (fake ? 1.04 : 1) * 100) / 100;
    trades.push({ openTime: new Date(t0).toISOString().slice(0, 19), closeTime: new Date(t1).toISOString().slice(0, 19), symbol: "ETHUSD", side: "buy", size: 1, entry, exit, fees: 0, pnl: exit - entry });
  }
  return { id, trades, clock: "utc", format: "trades" };
}

function server() {
  const m = marketFetch(), cache = memoryCache(), quota = memoryFillQuota();
  return (async (_u: RequestInfo | URL, init?: RequestInit) => handleFills(new Request("https://paritytrading.app/api/verify/fills", {
    method: init?.method ?? "GET", headers: { Origin: "https://paritytrading.app", Authorization: "Bearer t", "CF-Connecting-IP": "10.2.2.2" }, body: init?.body as string | undefined,
  }), { env: {}, verify: async () => ({ userId: "u", clientId: null }), quota, sources: FILL_SOURCES, cache, fetch: m.fetch, siteDomain: "paritytrading.app", now: () => NOW, sleep: async () => undefined })) as typeof fetch;
}

beforeEach(() => resetPacing());

describe("a batch of challenge accounts", () => {
  it("counts each account's fills outside the traded range", async () => {
    const res = await screenFills([account("A-1", false), account("A-2", true)], { token: "t", fetch: server() });
    expect(res.get("A-1")).toMatchObject({ checked: 40, outside: 0, closed: 0 });
    expect(res.get("A-2")).toMatchObject({ checked: 40, outside: 20 });
    expect(res.get("A-2")!.outcome.ran).toBe(true);
  });

  it("samples the same share of every account when the batch is too large", () => {
    const plans = planBatch([account("A", false, 50), account("B", false, 10)], 60);
    expect(plans.get("A")!.points.length).toBe(50);
    expect(plans.get("B")!.points.length).toBe(10);
    expect(plans.get("A")!.total).toBe(100);
  });

  it("adds the counts to the CSV", async () => {
    const res = await screenFills([account("A-2", true)], { token: "t", fetch: server() });
    const row = { id: "A-2", label: "Holds up", reason: "x", trades: 20, days: 1, balance: 1, netProfit: 1, returnPct: 0, winRate: 1, expectancy: 1, tries: 1, dsr: null, survives: null, maxDrawdown: null, top5Share: null, bestDayShare: null, sizeGrowth: null, passed: null, passedFrom: null, outcome: null } as unknown as AccountResult;
    const csv = resultsCsv([row], res).split("\n");
    expect(csv[0]).toMatch(/fills_checked,fills_outside_traded_range,fills_while_market_closed$/);
    expect(csv[1]).toMatch(/,40,20,0$/);
  });
});
