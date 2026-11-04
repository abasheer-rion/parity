// POST /api/verify/fills (DEC-0092) with the made-up market of tests/fills/market.ts: who may
// call it, what a body may carry, the answers, the cache, the budget, a refusing source and
// the switches. The recorded samples check each source reads its live layout.
import { beforeEach, describe, expect, it } from "vitest";
import { handleFills, readBody, BadRequest, type FillsDeps } from "../../src/lib/verify/range/server";
import { memoryCache, resetPacing } from "../../src/lib/verify/range/load";
import { memoryFillQuota } from "../../src/lib/verify/range/quota";
import { FILL_SOURCES } from "../../src/lib/verify/range/registry";
import { ALPACA_IEX } from "../../src/lib/verify/range/sources";
import { ONCHAIN, blockAt } from "../../src/lib/verify/range/onchain";
import type { RangeAnswer } from "../../src/lib/verify/range/types";
import { fxFile, marketFetch, PATH } from "./market";

const NOW = Date.parse("2026-03-10T12:00:00Z");
const ORIGIN = "https://paritytrading.app";
const ON = { FILL_CHECK_STOCKS: "on", ALPACA_KEY_ID: "test-key-id", ALPACA_SECRET_KEY: "test-secret" };

function deps(over: Partial<FillsDeps> = {}, m = marketFetch()): FillsDeps & { logs: Record<string, unknown>[] } {
  const logs: Record<string, unknown>[] = [];
  return {
    env: ON, verify: async (t) => (t === "good" ? { userId: "u1", clientId: null } : t === "app" ? { userId: "u1", clientId: "c1" } : null),
    quota: memoryFillQuota(), sources: FILL_SOURCES, cache: memoryCache(), fetch: m.fetch, siteDomain: "paritytrading.app",
    now: () => NOW, sleep: async () => undefined, log: (l) => logs.push(l), logs, ...over,
  };
}

const post = (body: unknown, headers: Record<string, string> = {}) => new Request("https://paritytrading.app/api/verify/fills", {
  method: "POST", headers: { Origin: ORIGIN, Authorization: "Bearer good", "Content-Type": "application/json", "CF-Connecting-IP": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const at = (iso: string) => Date.parse(`${iso}Z`);

beforeEach(() => resetPacing());

describe("the sources read their recorded layouts", () => {
  it("Alpaca's IEX minute and day bars", async () => {
    const ctx = { env: ON, now: NOW, get: async (_s: unknown, url: string) => JSON.parse(fxFile(url.includes("1Day") ? "alpaca-iex-1day.json" : "alpaca-iex-1min.json")) };
    const bars = await ALPACA_IEX.dayBars("AAPL", "2026-03-03", ctx);
    expect(bars.length).toBeGreaterThan(5);
    expect(bars[0][0]).toBe(at("2026-03-03T14:30:00"));
    expect(bars.every((b) => b[1] <= b[2] && b[1] > 190)).toBe(true);
    const days = await ALPACA_IEX.daily!("AAPL", "2026-03-02", "2026-03-06", ctx);
    expect([...days.keys()]).toEqual(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
  });

  it("a Base node's swap logs, in dollars, through ETH for pools priced in ETH", async () => {
    const ctx = { env: {}, now: NOW, get: async () => JSON.parse(fxFile("base-getlogs.json")) };
    const t = at("2026-03-03T14:30:00");
    const eth = await ONCHAIN.spanBars("ETH-USD", t, t + 60_000, ctx);
    const btc = await ONCHAIN.spanBars("BTC-USD", t, t + 60_000, ctx);
    expect(eth.length).toBeGreaterThan(0);
    for (const [when, lo, hi] of eth) { expect(lo).toBeCloseTo(PATH["ETH-USD"](when), 4); expect(hi).toBe(lo); }
    for (const [when, lo, hi] of btc) { expect(lo).toBeLessThanOrEqual(PATH["BTC-USD"](when) * 1.0001); expect(hi).toBeGreaterThanOrEqual(PATH["BTC-USD"](when) * 0.9999); }
    expect(blockAt(t)).toBe(Math.floor((t / 1000 - 1_686_789_347) / 2));
  });
});

describe("POST /api/verify/fills", () => {
  const good = (p: number) => ({ s: "AAPL", t: "2026-03-03T15:00:00", p });

  it("answers one status per fill, and only counts in the log", async () => {
    const d = deps();
    const genuine = PATH.AAPL(at("2026-03-03T15:00:30"));
    const eth = PATH["ETH-USD"](at("2026-03-04T10:00:00"));
    const res = await handleFills(post({ clock: "utc", fills: [good(genuine), good(genuine * 1.2), { s: "ETH-USDT", t: "2026-03-04T10:00:00", p: eth }, { s: "ETH-USDT", t: "2026-03-04T10:00:00", p: eth * 0.9 }, { s: "AAPL", t: "2026-03-07T15:00:00", p: genuine }, { s: "XAU/USD", t: "2026-03-04T10:00:00", p: 2000 }] }), d);
    expect(res.status).toBe(200);
    const a = (await res.json()) as RangeAnswer;
    expect(a.fills.map((f) => f.r)).toEqual(["in", "out", "in", "out", "closed", "none"]);
    expect(a.unsupported).toEqual(["XAU/USD"]);
    expect(JSON.stringify(a)).not.toMatch(/"(l|h|lo|hi|low|high|bars)"/);
    const line = d.logs[0];
    expect(line).toMatchObject({ msg: "fills", status: 200, fills: 6, in: 2, out: 2, closed: 1 });
    expect(JSON.stringify(line)).not.toMatch(/AAPL|ETH|2026-03/);
  });

  it("serves the second request for the same days from its cache", async () => {
    const m = marketFetch();
    const d = deps({}, m);
    const body = { clock: "utc", fills: [good(200), { s: "ETH-USD", t: "2026-03-04T10:00:00", p: 2000 }] };
    await handleFills(post(body), d);
    const first = m.calls.length;
    expect(first).toBeGreaterThan(0);
    await handleFills(post(body), d);
    expect(m.calls.length).toBe(first);
  });

  it("asks for the rest again when the call budget runs out", async () => {
    const fills = Array.from({ length: 30 }, (_, i) => ({ s: "ETH-USD", t: `2026-03-0${1 + (i % 9)}T${String(i % 24).padStart(2, "0")}:15:00`, p: 2000 }));
    const { checkFills } = await import("../../src/lib/verify/range/server");
    const d = deps();
    const a = await checkFills("utc", fills, d, NOW, {}, 6);
    const more = a.fills.filter((f) => f.n === "more").length;
    expect(more).toBeGreaterThan(0);
    expect(a.fills.filter((f) => f.r === "in" || f.r === "out").length).toBeGreaterThan(0);
  });

  it("refuses other sites, people not signed in, connected apps and over-full bodies", async () => {
    expect((await handleFills(post({ clock: "utc", fills: [good(1)] }, { Origin: "https://evil.example" }), deps())).status).toBe(403);
    expect((await handleFills(post({ clock: "utc", fills: [good(1)] }, { Authorization: "Bearer nope" }), deps())).status).toBe(401);
    expect((await handleFills(post({ clock: "utc", fills: [good(1)] }, { Authorization: "Bearer app" }), deps())).status).toBe(403);
    const extra = await handleFills(post({ clock: "utc", fills: [{ ...good(1), pnl: 5 }] }), deps());
    expect(extra.status).toBe(400);
    expect(((await extra.json()) as { error: string }).error).toMatch(/nothing else/);
    expect((await handleFills(new Request("https://paritytrading.app/api/verify/fills", { method: "PUT", headers: { Origin: ORIGIN } }), deps())).status).toBe(405);
  });

  it("says which markets and coins it can check, so the page sends nothing else", async () => {
    const cover = async (env: FillsDeps["env"]) => (await handleFills(new Request("https://paritytrading.app/api/verify/fills"), deps({ env }))).json() as Promise<{ markets: string[]; coins: string[] }>;
    const off = await cover({});
    expect(off.markets).toEqual(["crypto"]);
    expect(off.coins).toEqual(expect.arrayContaining(["BTC", "ETH"]));
    expect(off.coins).not.toContain("DOGE");
    expect((await cover(ON)).markets).toEqual(["stock", "crypto"]);
  });

  it("checks each part of a body", () => {
    expect(() => readBody(JSON.stringify({ clock: "local", fills: [good(1)] }))).toThrow(BadRequest);
    expect(() => readBody(JSON.stringify({ clock: "utc", fills: [] }))).toThrow(/at least one/);
    expect(() => readBody(JSON.stringify({ clock: "utc", fills: [{ s: "aapl", t: "2026-03-03", p: 1 }] }))).toThrow(/capital/);
    expect(() => readBody(JSON.stringify({ clock: "utc", fills: [{ s: "AAPL", t: "3/3/2026", p: 1 }] }))).toThrow(/YYYY/);
    expect(() => readBody(JSON.stringify({ clock: "utc", fills: [{ s: "AAPL", t: "2026-03-03", p: -1 }] }))).toThrow(/positive/);
    expect(() => readBody(JSON.stringify({ clock: "utc", fills: Array.from({ length: 1001 }, () => good(1)) }))).toThrow(/1,000/);
    expect(readBody(JSON.stringify({ clock: "new_york", fills: [{ s: "BRK.B", t: "2026-03-03T09:31", p: 1 }] })).fills[0].s).toBe("BRK.B");
  });

  it("stops at the day's allowance", async () => {
    const d = deps({ quota: memoryFillQuota({ fills: 3, requests: 400 }) });
    expect((await handleFills(post({ clock: "utc", fills: [good(1), good(2)] }), d)).status).toBe(200);
    const res = await handleFills(post({ clock: "utc", fills: [good(1), good(2)] }), d);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toMatch(/Try again tomorrow/);
  });

  it("leaves US stocks unchecked until the owner switches them on", async () => {
    const a = (await (await handleFills(post({ clock: "utc", fills: [good(200)] }), deps({ env: {} }))).json()) as RangeAnswer;
    expect(a.fills[0]).toEqual({ r: "none", n: "sym" });
  });

  it("says a source was busy when it refuses, and rests it", async () => {
    const m = marketFetch({ base: () => new Response("slow down", { status: 429 }) });
    const a = (await (await handleFills(post({ clock: "utc", fills: [{ s: "ETH-USD", t: "2026-03-04T10:00:00", p: 2000 }] }), deps({}, m))).json()) as RangeAnswer;
    expect(a.fills[0]).toMatchObject({ r: "none", n: "busy" });
  });

  it("says a fill is older than the free node keeps, and uses a full-history node when the owner sets one", async () => {
    const p = PATH["ETH-USD"](at("2026-03-04T10:00:00"));
    const body = { clock: "utc", fills: [{ s: "ETH-USD", t: "2026-03-04T10:00:00", p }] };
    const m = marketFetch({ base: () => new Response("Archive requests require a personal token", { status: 403 }) });
    const a = (await (await handleFills(post(body), deps({}, m))).json()) as RangeAnswer;
    expect(a.fills[0]).toMatchObject({ r: "none", n: "old" });
    resetPacing();
    const full = marketFetch();
    const b = (await (await handleFills(post(body), deps({ env: { BASE_RPC_URL: "https://base-rpc.publicnode.com/?token=owner" } }, full))).json()) as RangeAnswer;
    expect(b.fills[0].r).toBe("in");
    expect(full.calls.some((c) => c.url.includes("token=owner"))).toBe(true);
  });

  it("can be switched off", async () => {
    expect((await handleFills(post({ clock: "utc", fills: [good(1)] }), deps({ env: { FILL_CHECK: "off" } }))).status).toBe(404);
  });
});
