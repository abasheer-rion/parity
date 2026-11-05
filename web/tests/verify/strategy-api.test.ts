// verify_strategy with code or rules (DEC-0083), on the hosted MCP tool and POST
// /api/v1/verify/strategy: the same function, the same answer. Prices are the made-up test
// file; no test talks to the network.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { generateKey, hashKey } from "../../src/lib/api/keys";
import { MinuteLimiter } from "../../src/lib/api/policy";
import { handleApi, type ApiDeps } from "../../src/lib/api/server";
import type { KeyRecord, Store } from "../../src/lib/api/store";
import { byName, type Data, type Db, type ToolContext } from "../../src/lib/mcp/tools";

const ORIGIN = "https://paritytrading.app";
const dir = join(import.meta.dirname, "../fixtures/verify/strategy");
const PRICES = JSON.parse(readFileSync(join(dir, "prices.json"), "utf8"));
const code = (f: string) => readFileSync(join(dir, "code", f), "utf8");
const FILES: Record<string, unknown> = { "/data/verify/prices.json": PRICES, "/data/latest.json": { generated_at: "2026-11-01", n_trials: 10, runs: [] } };
const data: Data = { json: async <T,>(p: string) => (FILES[p] as T) ?? null };
const noDb: Db = { select: async () => [], rpc: async () => { throw new Error("no db"); } };
const ctx: ToolContext = { caller: { userId: "u1", email: null, clientId: "c", token: "t" }, data, db: noDb, origin: ORIGIN, now: new Date("2026-11-03T12:00:00Z") };
const run1 = (args: Record<string, unknown>) => byName("verify_strategy").run(args, ctx) as Promise<Record<string, unknown>>;

describe("verify_strategy runs code and rules", () => {
  it("Pine Script: the verdict, the rules it ran, the tries counted and the backtest", async () => {
    const r = await run1({ code: code("sma-cross.pine"), market: "BTCUSD", tries: 4 });
    expect(r.mode).toBe("code");
    expect(r.ran).toBe(true);
    expect(r.language).toBe("pine");
    expect((r.verdict as { id: string }).id).toMatch(/^(holds_up|could_be_luck|fragile|does_not_hold_up|not_enough_data)$/);
    expect(r.tries_counted).toEqual({ stated: 4, nearby_settings: 24, total: 28 });
    expect((r.rules as { long: { entry: string } }).long.entry).toBe("longCondition");
    const b = r.backtest as Record<string, number | string>;
    expect(b.market).toBe("BTCUSD");
    expect(b.cost_each_way).toBe(0.0015);
    expect(typeof b.total_return_one_day_later).toBe("number");
    expect((r.signs_of_tuning as { id: string }[]).map((x) => x.id)).toContain("sweep");
    expect((r.left_out as { what: string }[])[0].what).toBe("plot");
    expect(r.method_version).toMatch(/^verify-/);
  });

  it("rules written by an AI app from a description", async () => {
    const rules = { inputs: { n: 50 }, let: { m: ["sma", "close", "n"] }, long: { entry: ["crossover", "close", "m"], exit: ["crossunder", "close", "m"], stop_loss: 0.1 } };
    const r = await run1({ rules, market: "SPX" });
    expect(r.ran).toBe(true);
    expect(r.language).toBe("rules");
    expect((r.tries_counted as { nearby_settings: number }).nearby_settings).toBe(4);
  });

  it("code it cannot run is answered with each part and its line, and is not run", async () => {
    const r = await run1({ code: code("unsupported.pine"), market: "BTCUSD" });
    expect(r.ran).toBe(false);
    expect(r.verdict).toBeNull();
    expect((r.cannot_run as { what: string; line: number }[]).map((x) => `${x.what}@${x.line}`)).toEqual(["request.security@5", "high@8", "strategy.exit(trail_points=)@11", "strategy.exit(trail_offset=)@11"]);
    expect(r.sentence).toContain("cannot be turned into rules");
  });

  it("asks for a market, and says what is wrong with code or rules", async () => {
    await expect(run1({ code: code("sma-cross.pine") })).rejects.toThrow(/Give market/);
    await expect(run1({ code: 'strategy("x")\nfast = ta.sma(close, 10', market: "BTCUSD" })).rejects.toThrow(/could not be read\. Line 2/);
    await expect(run1({ rules: { long: { entry: ["atr", 14] } }, market: "BTCUSD" })).rejects.toThrow(/needs the day's high and low/);
  });

  it("a description in words still returns the closest strategies, and says how to backtest it", async () => {
    const r = await run1({ description: "buys bitcoin when the 50-day average crosses above the 200-day" });
    expect(r.mode).toBe("description");
    expect(JSON.stringify(r.could_not_check)).toContain("send rules with market");
  });
});

describe("POST /api/v1/verify/strategy with code", () => {
  it("gives the same answer as the tool, with a read:verify key", async () => {
    const PEPPER = "p".repeat(48), NOW = Date.parse("2026-11-03T12:00:00Z");
    const k = generateKey();
    const hash = await hashKey(k, PEPPER);
    const rec: KeyRecord = { id: "k1", user_id: "u-1", key_hash: hash, scopes: ["read:verify"], ip_allowlist: null, expires_at: new Date(NOW + 86_400_000).toISOString(), revoked_at: null, plan: "free", used_today: 0 };
    const store: Store = { lookup: vi.fn(async (h: string) => (h === hash ? rec : null)), record: vi.fn(async () => {}), revokeLeaked: vi.fn(async () => false) };
    const deps: ApiDeps = { pepper: PEPPER, store, data, siteDomain: "paritytrading.app", site: ORIGIN, limiter: new MinuteLimiter(() => NOW), missLimiter: new MinuteLimiter(() => NOW), now: () => NOW, log: () => {} };
    const body = { code: code("sma-cross-pandas.py"), market: "BTCUSD", tries: 2 };
    const res = await handleApi(new Request(`${ORIGIN}/api/v1/verify/strategy`, { method: "POST", body: JSON.stringify(body), headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" } }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(await run1(body))));
    const bad = await handleApi(new Request(`${ORIGIN}/api/v1/verify/strategy`, { method: "POST", body: JSON.stringify({ code: "x = (", market: "BTCUSD" }), headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" } }), deps);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { detail: string }).detail).toMatch(/^The code could not be read\. Line 1/);
  });
});
