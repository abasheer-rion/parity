// The hosted MCP server (DEC-0051): sign-in challenge, both protocol eras, the tools, the
// limits and the write gate. Tokens, data files and the database are all faked: no test
// talks to the network.
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { challenge, originAllowed, protectedResourceMetadata, type McpCaller } from "../src/lib/mcp/auth";
import { check } from "../src/lib/mcp/schema";
import { decodeHeader, handleMcp, MODERN, VERSIONS, type ServerDeps } from "../src/lib/mcp/server";
import type { Begin } from "../src/lib/mcp/supabase";
import { thin, TOOLS, type Db } from "../src/lib/mcp/tools";
import { wellKnown } from "../src/lib/mcp/wellknown";
import { assetData } from "../functions/mcp";

const ORIGIN = "https://paritytrading.app";

const gauntletTests = Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, group: i < 6 ? "beat" : "real", name: `Test ${i}`, plain: "plain", passed: i % 2 === 0, value: "1", bar: "2" }));
const equity: [string, number][] = Array.from({ length: 400 }, (_, i) => [`2020-01-${String((i % 28) + 1).padStart(2, "0")}`, 100 + i]);
const REPORT = {
  schema_version: 1, generated_at: "2026-10-24T00:00:00Z", git_sha: null, n_trials: 42, config: {}, coverage: { fetched_at: null, series: [] },
  runs: [
    { strategy: "carry", display_name: "FX carry", description: "Buys high-rate currencies", tags: { family: "carry", asset: "fx", style: "value", horizon: "monthly" }, summary: "", reference: "ALG-1", is_benchmark: false, params: { n: 3 },
      config: {}, metrics: { start: "2000-01-01", end: "2026-01-01", years: 26, cagr: 0.021, ann_vol: 0.08, sharpe: 0.31, sortino: 0.4, max_drawdown: -0.3, calmar: 0.1, hit_rate: 0.5, deflated_sharpe: 0.2 },
      yearly: { 2020: 0.01 }, equity, drawdown: [], ic_decay: [], exposure: {},
      gauntlet: { verdict: "Does not beat the S&P 500", beats_sp500: false, passed: 4, total: 11, tests: gauntletTests, trials_including_gauntlet: 50 } },
    { strategy: "sp500", display_name: "S&P 500", tags: { family: "benchmark", asset: "equities", style: "", horizon: "" }, summary: "", reference: "", is_benchmark: true, params: {}, config: {},
      metrics: { start: null, end: null, years: 26, cagr: 0.08, ann_vol: 0.15, sharpe: 0.5, sortino: 0.6, max_drawdown: -0.5, calmar: 0.2, hit_rate: 0.5, deflated_sharpe: null },
      yearly: {}, equity: [], drawdown: [], ic_decay: [], exposure: {}, gauntlet: null },
  ],
};
const TERM = {
  generated_at: "2026-10-24", data_through: "2026-10-23", groups: [],
  series: [{ key: "fx.EUR", label: "Euro in dollars", short: "EUR", group: "fx", class: "fx", source: "ECB", licence: "free", kind: "price", unit: "USD", freq: "D", first: "1999-01-04", asof: "2026-10-23", last: 1.08, chg: { w1: 0.01, m1: -0.02 }, vol: 0.07, z: 0.1, pct1y: 0.5, spark: [], file: "s/fx.EUR.json" }],
};
const SERIES = { key: "fx.EUR", points: Array.from({ length: 1000 }, (_, i) => [`2020-${String((i % 12) + 1).padStart(2, "0")}-01`, 1 + i / 1000]) };
const IMPACT = {
  generated_at: "2026-10-24", horizons: ["1d", "5d", "20d"], pre: 5, post: 20, min_events: 20, n_items: 10,
  assets: [{ key: "oil", label: "Oil", unit: "pct", first: "2000", last: "2026" }], topics: [{ id: "opec", label: "OPEC", n_headlines: 30 }],
  studies: { oil: { opec: { n_headlines: 30, n_events: 25, warnings: [], horizons: {} } } },
  by_topic: { opec: { what: "assets after opec", horizon: "5d", tried: 9, warnings: [], rows: [{ asset: "oil", label: "Oil", n_events: 25, n_overlapping: 0, mean_z: 0.4, median_z: 0.3, ci_lo: 0.1, ci_hi: 0.7, hit_rate: 0.6, random_hit_rate: 0.5, mean_move: 0.01, p_random: 0.01, q: 0.03, thin: false }] } },
  by_asset: {}, moves: {},
};
const COURSES = [
  { id: "c2", order: 2, level: "intro", title: "Luck and skill", summary: "s", lessons: [{ id: "l1", title: "Many tries", minutes: 2, body: ["a"], terms: ["deflated sharpe"], check: [] }] },
  { id: "c1", order: 1, level: "intro", title: "Reading a backtest", summary: "s", lessons: [{ id: "cagr", title: "Return per year", minutes: 2, body: ["CAGR is a steady rate."], terms: ["cagr"], check: [] }] },
];
const FILES: Record<string, unknown> = {
  "/data/academy/courses.json": COURSES,
  "/data/latest.json": REPORT, "/data/terminal/index.json": TERM, "/data/terminal/s/fx.EUR.json": SERIES, "/data/news/impact.json": IMPACT,
};

function setup(opts: { write?: boolean; allowed?: boolean; begin?: Begin | Error } = {}) {
  const callers: Record<string, McpCaller> = {
    good: { userId: "u1", email: "a@b.c", clientId: "client-1", token: "good" },
    web: { userId: "u1", email: "a@b.c", clientId: null, token: "web" },
  };
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    if (fn === "mcp_write_allowed") return opts.allowed ?? false;
    if (fn === "mcp_place_demo_order") return { id: "o1", status: "pending", placed_on: args.p_placed_on };
    if (fn === "mcp_save_trade_layout") return { id: "l1", name: args.p_name };
    throw new Error(`unexpected rpc ${fn}`);
  });
  const select = vi.fn(async () => [{ id: "a1", name: "Demo account", cash: 100000, starting_cash: 100000, created_at: "2026-10-01" }]);
  const db: Db = { select: select as Db["select"], rpc: rpc as Db["rpc"] };
  const begin = vi.fn(async (): Promise<Begin> => { if (opts.begin instanceof Error) throw opts.begin; return opts.begin ?? { ok: true, id: 7 }; });
  const end = vi.fn(async () => {});
  const deps: ServerDeps = {
    verify: async (t) => callers[t] ?? null,
    data: { json: async <T,>(p: string) => (FILES[p] as T) ?? null },
    db: () => db,
    audit: () => ({ begin, end }),
    enabled: true,
    writeEnabled: opts.write ?? false,
    siteDomain: "paritytrading.app",
    now: () => new Date("2026-10-25T12:00:00Z"),
  };
  return { deps, rpc, select, begin, end };
}

function post(body: unknown, headers: Record<string, string> = {}, token: string | null = "good") {
  return new Request(`${ORIGIN}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
}

const meta = { "io.modelcontextprotocol/protocolVersion": MODERN, "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} };
function modernCall(name: string, args: Record<string, unknown> = {}, extra: Record<string, string> = {}) {
  return post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args, _meta: meta } },
    { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/call", "Mcp-Name": name, ...extra });
}
async function call(deps: ServerDeps, name: string, args: Record<string, unknown> = {}) {
  const res = await handleMcp(modernCall(name, args), deps);
  const body = (await res.json()) as { result: { isError: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> } };
  return { res, result: body.result };
}

describe("sign-in", () => {
  it("answers 401 with a pointer to the sign-in metadata", async () => {
    const { deps } = setup();
    const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {}, null), deps);
    expect(res.status).toBe(401);
    const h = res.headers.get("WWW-Authenticate")!;
    expect(h).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`);
    expect(h).not.toContain("invalid_token");
  });

  it("says invalid_token when a token was sent but does not check out", async () => {
    const { deps } = setup();
    const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {}, "forged"), deps);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
  });

  it("publishes metadata naming Supabase Auth as the sign-in server", async () => {
    const res = (await wellKnown(new Request(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`)))!;
    const doc = (await res.json()) as ReturnType<typeof protectedResourceMetadata>;
    expect(doc.resource).toBe(`${ORIGIN}/mcp`);
    expect(doc.authorization_servers).toEqual(["https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1"]);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(challenge(ORIGIN)).toContain('scope="openid email profile"');
  });

  it("copies Supabase's server metadata for older apps, and ignores other paths", async () => {
    const f = vi.fn(async () => new Response('{"issuer":"x"}', { status: 200 }));
    const res = (await wellKnown(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`), f as unknown as typeof fetch))!;
    expect(await res.text()).toBe('{"issuer":"x"}');
    expect(f).toHaveBeenCalledWith("https://ttqvpxvctnomfbeoqbbs.supabase.co/.well-known/oauth-authorization-server/auth/v1", expect.anything());
    expect(await wellKnown(new Request(`${ORIGIN}/.well-known/security.txt`))).toBeNull();
  });
});

describe("transport", () => {
  it("refuses an unexpected browser origin and allows our own", async () => {
    const { deps } = setup();
    expect((await handleMcp(post({}, { Origin: "https://evil.example" }), deps)).status).toBe(403);
    const ok = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "ping" }, { Origin: "https://lab.paritytrading.app" }), deps);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://lab.paritytrading.app");
    expect(originAllowed(null, "paritytrading.app")).toBe(true);
    expect(originAllowed("http://localhost:6274", "paritytrading.app")).toBe(true);
    expect(originAllowed("http://evil.paritytrading.app", "paritytrading.app")).toBe(false);
    expect(originAllowed("https://claude.ai", "paritytrading.app")).toBe(true);
    expect(originAllowed("https://vscode.dev", "paritytrading.app")).toBe(true);
    expect(originAllowed("https://claude.ai.evil.example", "paritytrading.app")).toBe(false);
  });

  it("has no stream or session: GET and DELETE are 405", async () => {
    const { deps } = setup();
    for (const method of ["GET", "DELETE"]) {
      const res = await handleMcp(new Request(`${ORIGIN}/mcp`, { method, headers: { Authorization: "Bearer good" } }), deps);
      expect(res.status).toBe(405);
    }
  });

  it("is 404 while switched off", async () => {
    const { deps } = setup();
    expect((await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "ping" }), { ...deps, enabled: false })).status).toBe(404);
  });

  it("legacy: initialize agrees a version and never hands out a session", async () => {
    const { deps } = setup();
    const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "c", version: "1" } } }), deps);
    const body = (await res.json()) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.serverInfo.name).toBe("parity");
    expect(res.headers.get("Mcp-Session-Id")).toBeNull();
    const old = await handleMcp(post({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2024-01-01" } }), deps);
    expect(((await old.json()) as { result: { protocolVersion: string } }).result.protocolVersion).toBe("2025-11-25");
  });

  it("legacy: a notification gets 202 and no body", async () => {
    const { deps } = setup();
    const res = await handleMcp(post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "MCP-Protocol-Version": "2025-06-18" }), deps);
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("modern: server/discover lists versions and needs no handshake", async () => {
    const { deps } = setup();
    const res = await handleMcp(post({ jsonrpc: "2.0", id: "d", method: "server/discover", params: { _meta: meta } }, { "MCP-Protocol-Version": MODERN, "Mcp-Method": "server/discover" }), deps);
    const body = (await res.json()) as { result: { resultType: string; supportedVersions: string[] } };
    expect(body.result.resultType).toBe("complete");
    expect(body.result.supportedVersions).toEqual(VERSIONS);
  });

  it("modern: headers must match the body", async () => {
    const { deps } = setup();
    const missing = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_academy_lessons", arguments: {}, _meta: meta } }, { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/call" }), deps);
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: { code: number } }).error.code).toBe(-32020);
    const wrong = await handleMcp(modernCall("list_academy_lessons", {}, { "Mcp-Name": "search" }), deps);
    expect(((await wrong.json()) as { error: { code: number } }).error.code).toBe(-32020);
    const encoded = await handleMcp(modernCall("list_academy_lessons", {}, { "Mcp-Name": `=?base64?${btoa("list_academy_lessons")}?=` }), deps);
    expect(encoded.status).toBe(200);
    expect(decodeHeader("=?base64?SGVsbG8sIOS4lueVjA==?=")).toBe("Hello, 世界");
  });

  it("modern: an unknown version lists what is supported, an unknown method is 404", async () => {
    const { deps } = setup();
    const v = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { "MCP-Protocol-Version": "1900-01-01" }), deps);
    const vb = (await v.json()) as { error: { code: number; data: { supported: string[] } } };
    expect(v.status).toBe(400);
    expect(vb.error.code).toBe(-32022);
    expect(vb.error.data.supported).toContain(MODERN);
    const m = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "nope/nope", params: { _meta: meta } }, { "MCP-Protocol-Version": MODERN, "Mcp-Method": "nope/nope" }), deps);
    expect(m.status).toBe(404);
    expect(((await m.json()) as { error: { code: number } }).error.code).toBe(-32601);
  });
});

describe("tools", () => {
  it("lists the read tools only, until changes are switched on", async () => {
    const off = setup();
    const list = async (deps: ServerDeps) => ((await (await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }), deps)).json()) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } }).result.tools;
    const offTools = await list(off.deps);
    expect(offTools.map((t) => t.name)).not.toContain("place_demo_order");
    expect(offTools.every((t) => t.annotations.readOnlyHint)).toBe(true);
    const onTools = await list(setup({ write: true }).deps);
    expect(onTools.map((t) => t.name)).toEqual(expect.arrayContaining(["place_demo_order", "save_trade_layout"]));
  });

  it("search_strategies and get_strategy return the verdict and all 11 tests", async () => {
    const { deps, begin, end } = setup();
    const s = await call(deps, "search_strategies", { query: "carry" });
    expect(s.result.isError).toBe(false);
    const found = s.result.structuredContent as { strategies: { id: string; tests_passed: string }[]; note: string };
    expect(found.strategies).toHaveLength(1);
    expect(found.strategies[0].tests_passed).toBe("4 of 11");
    expect(found.note).toBe("Research only, not investment advice.");
    const g = await call(deps, "get_strategy", { id: "carry" });
    const doc = g.result.structuredContent as { gauntlet: { tests: unknown[] }; equity: unknown[] };
    expect(doc.gauntlet.tests).toHaveLength(11);
    expect(doc.equity.length).toBeLessThanOrEqual(120);
    expect(begin).toHaveBeenCalledWith("get_strategy", false);
    expect(end).toHaveBeenCalledWith(7, true, expect.any(Number));
    const missing = await call(deps, "get_strategy", { id: "nope" });
    expect(missing.result.isError).toBe(true);
    expect(missing.result.content[0].text).toContain("search_strategies");
  });

  it("checks arguments against the tool's schema before running it", async () => {
    const { deps, begin } = setup();
    const r = await call(deps, "get_strategy", { id: 5 });
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toContain("arguments.id must be text");
    expect(begin).not.toHaveBeenCalled();
  });

  it("refuses over the limit, and refuses to run when the call cannot be logged", async () => {
    const limited = await call(setup({ begin: { ok: false, reason: "minute", retry_after: 60 } }).deps, "list_academy_lessons");
    expect(limited.result.isError).toBe(true);
    expect(limited.result.content[0].text).toContain("this minute");
    const unlogged = await call(setup({ begin: new Error("db down") }).deps, "list_academy_lessons");
    expect(unlogged.result.content[0].text).toContain("did not run");
  });

  it("verify_record runs Verify's checks on supplied trades", async () => {
    const { deps } = setup();
    const trades = Array.from({ length: 60 }, (_, i) => ({ close_time: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`, pnl: i % 3 === 0 ? -50 : 40 }));
    const r = await call(deps, "verify_record", { kind: "real", trades, starting_balance: 10000, tries: 5, claim: { winRate: 0.95 } });
    expect(r.result.isError).toBe(false);
    const doc = r.result.structuredContent as { verdict: { id: string }; trades: number; tries: number; claim_arithmetic: unknown[] };
    expect(doc.trades).toBe(60);
    expect(doc.tries).toBe(5);
    expect(typeof doc.verdict.id).toBe("string");
    const none = await call(deps, "verify_record", { kind: "real" });
    expect(none.result.isError).toBe(true);
  });

  it("verify_description catches claims that fail on their own numbers", async () => {
    const { deps } = setup();
    const r = await call(deps, "verify_description", { text: "Grid bot, 99% win rate", claim: { winRate: 0.99, grid: true, maxLossCapped: false } });
    expect(r.result.isError).toBe(false);
    expect((r.result.structuredContent as { verdict: { id: string } }).verdict.id).not.toBe("");
  });

  it("market series come from the published index, thinned", async () => {
    const { deps } = setup();
    const l = await call(deps, "list_market_series", { query: "eur" });
    expect((l.result.structuredContent as { matches: number }).matches).toBe(1);
    const g = await call(deps, "get_market_series", { key: "fx.EUR", max_points: 50 });
    expect((g.result.structuredContent as { points: unknown[] }).points).toHaveLength(50);
    const bad = await call(deps, "get_market_series", { key: "../../secret" });
    expect(bad.result.isError).toBe(true);
  });

  it("news_impact ranks assets after a topic with evidence words", async () => {
    const { deps } = setup();
    const r = await call(deps, "news_impact", { topic: "opec" });
    const rows = (r.result.structuredContent as { rows: { evidence: string }[] }).rows;
    expect(rows[0].evidence).toBe("moderate");
  });

  it("Academy lessons and the search and fetch pair", async () => {
    const { deps } = setup();
    const l = await call(deps, "list_academy_lessons", {});
    expect((l.result.structuredContent as { courses: unknown[] }).courses.length).toBe(COURSES.length);
    expect((l.result.structuredContent as { courses: { id: string }[] }).courses[0].id).toBe("c1");
    const g = await call(deps, "get_academy_lesson", { course: "c1", lesson: "cagr" });
    expect((g.result.structuredContent as { title: string }).title).toBe("Return per year");
    const s = await call(deps, "search", { query: "carry" });
    const results = (s.result.structuredContent as { results: { id: string }[] }).results;
    expect(results.map((x) => x.id)).toContain("strategy:carry");
    const f = await call(deps, "fetch", { id: "strategy:carry" });
    expect((f.result.structuredContent as { title: string }).title).toBe("FX carry");
  });

  it("lists the person's demo accounts with their own token", async () => {
    const { deps, select } = setup();
    const r = await call(deps, "list_demo_accounts");
    expect((r.result.structuredContent as { accounts: unknown[] }).accounts).toHaveLength(1);
    expect(select).toHaveBeenCalledWith("paper_accounts", expect.stringContaining("select=id,name"));
  });
});

describe("changes", () => {
  const order = { account_id: "0b6f4f8e-1d2c-4b5a-9e8f-7a6b5c4d3e2f", symbol: "fx.EUR", side: "buy", type: "limit", qty: 1000, price: 1.05 };

  it("are unknown tools while the server flag is off", async () => {
    const { deps } = setup({ allowed: true });
    const res = await handleMcp(modernCall("place_demo_order", order), deps);
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(-32602);
  });

  it("need the person's permission for this app", async () => {
    const { deps, rpc, begin } = setup({ write: true, allowed: false });
    const r = await call(deps, "place_demo_order", order);
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toContain("/connect/");
    expect(rpc).not.toHaveBeenCalledWith("mcp_place_demo_order", expect.anything());
    expect(begin).not.toHaveBeenCalled();
  });

  it("go through the database functions once allowed", async () => {
    const { deps, rpc, begin } = setup({ write: true, allowed: true });
    const r = await call(deps, "place_demo_order", order);
    expect(r.result.isError).toBe(false);
    expect(begin).toHaveBeenCalledWith("place_demo_order", true);
    expect(rpc).toHaveBeenCalledWith("mcp_place_demo_order", expect.objectContaining({ p_type: "limit", p_limit_price: 1.05, p_stop_price: null, p_placed_on: "2026-10-25" }));
    const l = await call(deps, "save_trade_layout", { name: "Majors", grid: 2, symbols: ["fx.EUR"] });
    expect(l.result.isError).toBe(false);
    expect(rpc).toHaveBeenCalledWith("mcp_save_trade_layout", expect.objectContaining({ p_name: "Majors", p_state: expect.objectContaining({ grid: 2 }) }));
    const bad = await call(deps, "save_trade_layout", { name: "X", grid: 1, symbols: ["nope"] });
    expect(bad.result.isError).toBe(true);
  });
});

describe("pieces", () => {
  it("every tool has a plain description and an object schema", () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z_]{1,64}$/);
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.inputSchema.type).toBe("object");
      expect(t.description).not.toMatch(/\u2014/);
    }
  });

  it("schema check", () => {
    const s = { type: "object" as const, properties: { n: { type: "integer" as const, minimum: 1 }, e: { type: "string" as const, enum: ["a"] } }, required: ["n"], additionalProperties: false };
    expect(check({ n: 2 }, s)).toBeNull();
    expect(check({}, s)).toContain("required");
    expect(check({ n: 1.5 }, s)).toContain("whole number");
    expect(check({ n: 2, e: "b" }, s)).toContain("one of");
    expect(check({ n: 2, x: 1 }, s)).toContain("not a known field");
  });

  it("thin keeps the last point", () => {
    const out = thin([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(out).toHaveLength(4);
    expect(out[3]).toBe(10);
  });

  it("site files are read only under /data/ and cached", async () => {
    const assets = { fetch: vi.fn(async () => new Response('{"a":1}', { headers: { "content-type": "application/json" } })) };
    const d = assetData(assets, ORIGIN);
    await expect(d.json("/secret")).rejects.toThrow();
    expect(await d.json("/data/x.json")).toEqual({ a: 1 });
    await d.json("/data/x.json");
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });
});
