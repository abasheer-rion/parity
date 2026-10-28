// Verify for AI apps and programs (DEC-0082): the three tools verify_trades, verify_strategy
// and verify_claim on the hosted MCP server, their old names, and the matching /api/v1
// endpoints with scopes, bad input and size limits. Data files, tokens and the key store are
// faked: no test talks to the network.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKey, hashKey } from "../src/lib/api/keys";
import { MinuteLimiter } from "../src/lib/api/policy";
import { handleApi, MAX_BODY, resetMeter, ROUTES, type ApiDeps } from "../src/lib/api/server";
import type { KeyRecord, Store } from "../src/lib/api/store";
import { handleMcp, MODERN, type ServerDeps } from "../src/lib/mcp/server";
import { byName, TOOLS, type Data, type Db, type ToolContext } from "../src/lib/mcp/tools";
import { MAX_ROWS } from "../src/lib/mcp/verify";

const ORIGIN = "https://paritytrading.app";

// ---------------------------------------------------------------- fixtures

function weekdays(n: number, from = Date.UTC(2023, 0, 2)): string[] {
  const out: string[] = [];
  for (let t = from; out.length < n; t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

let v = 100;
const equity: [string, number][] = weekdays(500).map((d, i) => [d, (v *= 1 + 0.0004 + 0.01 * Math.sin(i * 1.7))]);
const gauntlet = { verdict: "Does not beat the S&P 500", beats_sp500: false, passed: 4, total: 11, tests: [], trials_including_gauntlet: 50 };
const run = (strategy: string, display_name: string, family: string, description: string) => ({
  strategy, display_name, description, summary: "", reference: "", is_benchmark: false, params: {}, config: {},
  tags: { family, asset: "fx", style: "risk premium", horizon: "monthly" },
  metrics: { years: 2, cagr: 0.03, sharpe: 0.4, max_drawdown: -0.2, deflated_sharpe: 0.3 },
  yearly: {}, equity, drawdown: [], ic_decay: [], exposure: {}, gauntlet,
});
const REPORT = {
  generated_at: "2026-10-26T00:00:00Z", n_trials: 120,
  runs: [
    run("fx_carry", "FX carry", "carry", "Buys high-rate currencies and sells low-rate ones"),
    run("fx_carry_top1", "The Gambit", "carry", "Buys the single highest-rate currency against the lowest"),
    run("fx_tsmom", "Currency trend", "trend", "Follows each currency's own trend"),
    { ...run("sp500", "S&P 500", "benchmark", ""), is_benchmark: true },
  ],
};
const SEARCH = {
  generated_at: "2026-10-26", trials: 4880, failed: 4000, beat_market: 10, passed_luck_check: 1, by_family: {}, by_asset: {},
  rows: [{ id: "s1", name: "Carry, top 2", line: "Two highest-rate currencies against two lowest", family: "carry", style: "risk premium", asset: "fx", start: "2000", years: 25, cagr: 0.02, vol: 0.1, sharpe: 0.3, max_dd: -0.3, turnover: 1, breakeven_bps: 5, corr: 0, beats_market: 0, deflated: 0.4, spec: {} }],
};
const FILES: Record<string, unknown> = { "/data/latest.json": REPORT, "/data/search.json": SEARCH };
const data: Data = { json: async <T,>(p: string) => (FILES[p] as T) ?? null };
const noDb: Db = { select: async () => [], rpc: async () => { throw new Error("no db"); } };
const ctx: ToolContext = { caller: { userId: "u1", email: null, clientId: "c", token: "t" }, data, db: noDb, origin: ORIGIN, now: new Date("2026-10-27T12:00:00Z") };

const days = weekdays(60, Date.UTC(2025, 0, 6));
const TRADES = days.map((d, i) => ({ close_time: d, pnl: i % 3 === 0 ? -50 : 40 }));

const run1 = (name: string, args: Record<string, unknown>) => byName(name).run(args, ctx) as Promise<Record<string, unknown>>;

// ---------------------------------------------------------------- MCP tools

describe("Verify tools on the hosted MCP server", () => {
  it("lists verify_trades, verify_strategy and verify_claim first, and marks the old names deprecated", async () => {
    const deps: ServerDeps = {
      verify: async () => ({ userId: "u1", email: null, clientId: "c", token: "t" }), data, db: () => noDb,
      audit: () => ({ begin: async () => ({ ok: true, id: 1 }), end: async () => {} }),
      enabled: true, writeEnabled: false, siteDomain: "paritytrading.app",
    };
    const res = await handleMcp(new Request(`${ORIGIN}/mcp`, {
      method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer t" },
    }), deps);
    const tools = ((await res.json()) as { result: { tools: { name: string; description: string }[] } }).result.tools;
    expect(tools.slice(0, 3).map((t) => t.name)).toEqual(["verify_trades", "verify_strategy", "verify_claim"]);
    for (const old of ["verify_record", "verify_description"]) expect(tools.find((t) => t.name === old)?.description).toMatch(/^Deprecated: use verify_/);
    expect(MODERN).toBeTruthy();
  });

  it("every Verify description has an example and no em dash", () => {
    for (const t of TOOLS.filter((x) => x.name.startsWith("verify_"))) {
      expect(t.description).not.toMatch(/\u2014|\u2013/);
      if (!t.description.startsWith("Deprecated")) expect(t.description).toMatch(/Example|such as/);
    }
  });

  it("verify_trades returns the verdict, sentence, five cards, survives and what it could not check", async () => {
    const r = await run1("verify_trades", { kind: "demo", trades: TRADES, tries: 12 });
    expect(r.verdict).toMatchObject({ id: expect.any(String), label: expect.any(String) });
    expect(r.sentence).toBe((r.verdict as { sentence: string }).sentence);
    for (const k of ["profit_per_trade", "worst_losses", "luck_check", "signs_of_peeking_or_editing", "signs_of_tuning"]) expect(r).toHaveProperty(k);
    expect(r.tries).toBe(12);
    expect(r.tries_defaulted).toBe(false);
    expect(r.method_version).toBe("verify-1.0");
    expect(r).toHaveProperty("survives_up_to_tries");
    expect(String(r.survives)).toMatch(/tries|try|measured/);
    const cannot = r.could_not_check as { check: string; why: string }[];
    expect(cannot.length).toBeGreaterThan(0);
    expect(cannot.every((c) => !c.why.startsWith("Cannot be checked"))).toBe(true);
    expect(r.methodology).toBe(`${ORIGIN}/methodology/`);
  });

  it("verify_record answers exactly as verify_trades", async () => {
    const args = { kind: "real", trades: TRADES, starting_balance: 10000, tries: 5, claim: { winRate: 0.95 } };
    expect(await run1("verify_record", args)).toEqual(await run1("verify_trades", args));
  });

  it("verify_trades refuses a call with no trades or equity", async () => {
    await expect(run1("verify_trades", { kind: "real" })).rejects.toThrow(/trades/);
  });

  it("verify_strategy finds a strategy by id or name and counts every try", async () => {
    const byId = await run1("verify_strategy", { strategy: "fx_carry_top1" });
    const byName = await run1("verify_strategy", { strategy: "the gambit" });
    expect((byId.strategy as { id: string }).id).toBe("fx_carry_top1");
    expect((byName.strategy as { name: string }).name).toBe("The Gambit");
    expect(byId.tries).toBe(120 + 4880);
    expect(byId.tries_counted).toEqual({ research: 120, search: 4880, total: 5000 });
    expect(byId.gauntlet).toEqual({ verdict: gauntlet.verdict, passed: 4, total: 11 });
    expect(byId.kind).toBe("backtest");
    expect(byId.sentence).toBeTruthy();
  });

  it("verify_strategy says when a name matches nothing or more than one", async () => {
    await expect(run1("verify_strategy", { strategy: "nothing like it" })).rejects.toThrow(/^No strategy matches/);
    await expect(run1("verify_strategy", { strategy: "currenc" })).rejects.toThrow(/More than one/);
    await expect(run1("verify_strategy", {})).rejects.toThrow(/Give strategy/);
  });

  it("verify_strategy gives the closest tested strategies for a described rule set", async () => {
    const r = await run1("verify_strategy", { description: "Carry trade: buys the highest interest rate currency and sells the lowest, monthly", limit: 2 });
    expect(r.mode).toBe("description");
    const close = r.closest as { id: string; verify_with: { tool: string; strategy: string } | null }[];
    expect(close.length).toBe(2);
    expect(close[0].verify_with?.tool).toBe("verify_strategy");
    expect(r.could_not_check).toHaveLength(1);
  });

  it("verify_claim reads a claim from text and marks what needs more data", async () => {
    const r = await run1("verify_claim", { text: "Is a 92% win rate with 5% take-profit and no stop possible?" });
    const claims = r.claims as { id: string; status: string; text: string }[];
    expect(claims.find((c) => c.id === "breakeven")?.status).toBe("needs_more_data");
    expect(claims.find((c) => c.id === "breakeven")?.text).toContain("57.5%");
    expect(r.claim_used).toMatchObject({ winRate: 0.92, takeProfit: 0.05 });
    expect(r.found_in_text).toEqual(expect.arrayContaining(["win rate 92%", "take-profit 5%", "no stop-loss"]));
  });

  it("verify_claim says which claims are impossible, and fields win over the text", async () => {
    const r = await run1("verify_claim", { text: "90% win rate", claim: { winRate: 0.8, takeProfit: 0.02, stopLoss: 0.1, maxDrawdown: 0.05, maxLoss: 0.1 } });
    expect(r.impossible).toBe(2);
    expect((r.claim_used as { winRate: number }).winRate).toBe(0.8);
    expect((r.verdict as { id: string }).id).toBe("does_not_hold_up");
    const capped = await run1("verify_claim", { claim: { martingale: true } });
    expect((capped.claims as { status: string }[])[0].status).toBe("loss_not_capped");
    await expect(run1("verify_claim", {})).rejects.toThrow(/Nothing to check/);
    // The same words as the local server's port (engine/src/parity/verify_claims.py).
    const monthly = await run1("verify_claim", { claim: { monthlyReturn: 0.2 } });
    expect((monthly.claims as { text: string }[])[0].text).toContain("792% a year");
    expect((monthly.claims as { text: string }[])[0].text).toContain("$79,497");
  });

  it("verify_description still answers a description with no numbers", async () => {
    const r = await run1("verify_description", { text: "A trend bot on gold" });
    expect((r.verdict as { id: string }).id).toBe("not_enough_data");
    expect(r).toHaveProperty("claim_arithmetic");
    expect(r).toHaveProperty("signs_of_tuning");
  });
});

// ---------------------------------------------------------------- the API

const PEPPER = "p".repeat(48);
const NOW = Date.parse("2026-10-27T12:00:00Z");

async function key(scopes: KeyRecord["scopes"]) {
  const k = generateKey();
  const hash = await hashKey(k, PEPPER);
  const rec: KeyRecord = { id: "k1", user_id: `u-${Math.random()}`, key_hash: hash, scopes, ip_allowlist: null, expires_at: new Date(NOW + 86_400_000).toISOString(), revoked_at: null, plan: "free", used_today: 0 };
  const store: Store = { lookup: vi.fn(async (h: string) => (h === hash ? rec : null)), record: vi.fn(async () => {}), revokeLeaked: vi.fn(async () => false) };
  const deps: ApiDeps = { pepper: PEPPER, store, data, siteDomain: "paritytrading.app", site: ORIGIN, limiter: new MinuteLimiter(() => NOW), missLimiter: new MinuteLimiter(() => NOW), now: () => NOW, log: () => {} };
  return { k, deps };
}

const post = (path: string, k: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/v1${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...headers } });

beforeEach(() => resetMeter());

describe("Verify endpoints on /api/v1", () => {
  it("POST /verify/trades, /verify/strategy and /verify/claim answer with the same functions as the tools", async () => {
    const { k, deps } = await key(["read:verify", "write:verify"]);
    const t = await handleApi(post("/verify/trades", k, { kind: "demo", trades: TRADES, tries: 12 }), deps);
    expect(t.status).toBe(200);
    expect(await t.json()).toEqual(await run1("verify_trades", { kind: "demo", trades: TRADES, tries: 12 }));
    const s = await handleApi(post("/verify/strategy", k, { strategy: "The Gambit" }), deps);
    expect(s.status).toBe(200);
    expect(((await s.json()) as { strategy: { id: string } }).strategy.id).toBe("fx_carry_top1");
    const c = await handleApi(post("/verify/claim", k, { claim: { winRate: 0.92, takeProfit: 0.05 } }), deps);
    expect(c.status).toBe(200);
    expect(((await c.json()) as { claims: unknown[] }).claims.length).toBeGreaterThan(0);
  });

  it("keeps POST /verify and /verify/description working", async () => {
    const { k, deps } = await key(["write:verify"]);
    expect((await handleApi(post("/verify", k, { kind: "real", trades: TRADES }), deps)).status).toBe(200);
    expect((await handleApi(post("/verify/description", k, { text: "Grid bot, 99% win rate" }), deps)).status).toBe(200);
  });

  it("checks scopes: write:verify to send records and claims, read:verify for our strategies", async () => {
    const reader = await key(["read:verify"]);
    expect((await handleApi(post("/verify/strategy", reader.k, { strategy: "fx_carry" }), reader.deps)).status).toBe(200);
    const denied = await handleApi(post("/verify/trades", reader.k, { kind: "demo", trades: TRADES }), reader.deps);
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Content-Type")).toBe("application/problem+json");
    expect(((await denied.json()) as { type: string }).type).toBe(`${ORIGIN}/developers/#problem-insufficient-scope`);
    const writer = await key(["write:verify"]);
    expect((await handleApi(post("/verify/claim", writer.k, { text: "92% win rate" }), writer.deps)).status).toBe(200);
    expect((await handleApi(post("/verify/strategy", writer.k, { strategy: "fx_carry" }), writer.deps)).status).toBe(403);
  });

  it("answers bad input with RFC 9457 problem details", async () => {
    const { k, deps } = await key(["read:verify", "write:verify"]);
    const pct = await handleApi(post("/verify/claim", k, { claim: { winRate: 92 } }), deps);
    expect(pct.status).toBe(400);
    expect(await pct.json()).toMatchObject({ title: "Bad request", status: 400, detail: "body.claim.winRate must be at most 1" });
    expect(((await (await handleApi(post("/verify/claim", k, {}), deps)).json()) as { detail: string }).detail).toMatch(/Nothing to check/);
    expect(((await (await handleApi(post("/verify/trades", k, { trades: TRADES }), deps)).json()) as { detail: string }).detail).toBe("body.kind is required");
    expect((await handleApi(post("/verify/trades", k, { kind: "paper", trades: TRADES }), deps)).status).toBe(400);
    expect((await handleApi(post("/verify/trades", k, { kind: "real", trades: [{ close_time: "yesterday", pnl: 1 }] }), deps)).status).toBe(400);
    expect((await handleApi(post("/verify/trades", k, [1, 2]), deps)).status).toBe(400);
    expect((await handleApi(post("/verify/strategy", k, { strategy: "unknown thing" }), deps)).status).toBe(404);
    expect((await handleApi(post("/verify/strategy", k, { strategy: "x", extra: 1 }), deps)).status).toBe(400);
    expect((await handleApi(post("/verify/claim", k, "{"), deps)).status).toBe(400);
    expect((await handleApi(post("/verify/claim", k, "{}", { "Content-Type": "text/plain" }), deps)).status).toBe(415);
  });

  it("refuses more than 5,000 trades and bodies over 1 MB", async () => {
    const { k, deps } = await key(["write:verify"]);
    const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) => ({ close_time: "2025-01-02", pnl: i % 2 ? 1 : -1 }));
    const tooMany = await handleApi(post("/verify/trades", k, { kind: "real", trades: many }), deps);
    expect(tooMany.status).toBe(400);
    expect(((await tooMany.json()) as { detail: string }).detail).toContain("at most 5000");
    const big = JSON.stringify({ text: "x".repeat(MAX_BODY) });
    expect((await handleApi(post("/verify/claim", k, big), deps)).status).toBe(413);
    expect((await handleApi(post("/verify/claim", k, "{}", { "Content-Length": String(MAX_BODY + 1) }), deps)).status).toBe(413);
    const long = await handleApi(post("/verify/claim", k, { text: "y".repeat(4001) }), deps);
    expect(((await long.json()) as { detail: string }).detail).toContain("at most 4000 characters");
  });

  it("documents the three endpoints in OpenAPI and marks the old ones deprecated", async () => {
    const { deps } = await key([]);
    const spec = (await (await handleApi(new Request(`${ORIGIN}/api/v1/openapi.json`), deps)).json()) as { paths: Record<string, Record<string, { requestBody?: unknown; deprecated?: boolean; "x-required-scope": string }>> };
    for (const p of ["/verify/trades", "/verify/strategy", "/verify/claim"]) {
      const op = spec.paths[`/api/v1${p}`].post;
      expect(op.requestBody).toBeTruthy();
      expect(op.deprecated).toBeUndefined();
    }
    expect(spec.paths["/api/v1/verify"].post.deprecated).toBe(true);
    expect(spec.paths["/api/v1/verify/description"].post.deprecated).toBe(true);
    expect(spec.paths["/api/v1/verify/strategy"].post["x-required-scope"]).toBe("read:verify");
    expect(ROUTES.filter((r) => r.path.startsWith("/verify")).length).toBe(6);
  });
});
