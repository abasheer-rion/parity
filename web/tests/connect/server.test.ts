// @vitest-environment node
// /api/connect end to end with recorded venue answers (DEC-0091): the switch, who may call,
// refusing keys that can do more than read, the signed record, keep in sync, Alpaca's
// sign-in, rate limits, plain errors, and that no credential ever reaches a log, a stored row
// or a reply.
import { describe, expect, it } from "vitest";
import type { McpCaller } from "../../src/lib/mcp/auth";
import { cardsHash, trustOf, type PublicKey } from "../../src/lib/connect/attest";
import { sha256Hex } from "../../src/lib/connect/bytes";
import { handleConnect, makeState, type ConnectEnv } from "../../src/lib/connect/server";
import { memoryConnectStore } from "../../src/lib/connect/store";
import { seedFrom } from "../../src/lib/connect/attest";
import { fx, json, KRAKEN_DOC_SECRET, realFx, recorded, testSecret } from "./helpers";

const NOW = Date.parse("2026-02-03T12:00:00Z");
const ORIGIN = "https://paritytrading.app";
const KRAKEN_KEY = "K".repeat(56);
const SECRETS = { BROKER_RECORD_SIGNING_KEY: testSecret(1), BROKER_CREDENTIAL_KEY: testSecret(2), ALPACA_OAUTH_CLIENT_ID: "alpaca-client", ALPACA_OAUTH_CLIENT_SECRET: "alpaca-secret-test-only" };
const USER: McpCaller = { userId: "11111111-1111-4111-8111-111111111111", email: "a@example.com", clientId: null, token: "good" };

function setup(over: { env?: ConnectEnv; flag?: boolean; venue?: ReturnType<typeof recorded> } = {}) {
  const mem = memoryConnectStore();
  const logs: Record<string, unknown>[] = [];
  const venue = over.venue ?? recorded([
    [/GetApiKeyInfo/, json(fx("kraken-keyinfo-read.json"))],
    [/AssetPairs/, json(fx("kraken-assetpairs.json"))],
    [/TradesHistory/, json(fx("kraken-trades.json"))],
  ]);
  const deps = {
    env: over.env ?? SECRETS,
    buildFlag: async () => over.flag ?? true,
    verify: async (t: string) => (t === "good" ? USER : t === "app" ? { ...USER, clientId: "some-ai-app" } : null),
    store: mem.store,
    venueFetch: venue.fetch,
    prices: async () => null,
    siteDomain: "paritytrading.app",
    now: () => NOW,
    sleep: async () => undefined,
    log: (l: Record<string, unknown>) => logs.push(l),
  };
  const call = (path: string, body?: unknown, headers: Record<string, string> = {}) => handleConnect(new Request(`${ORIGIN}/api/connect/${path}`, body === undefined
    ? { headers }
    : { method: "POST", headers: { Origin: ORIGIN, Authorization: "Bearer good", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }), deps);
  return { call, mem, logs, venue, deps };
}

const krakenBody = (over: Record<string, unknown> = {}) => ({
  venue: "kraken", credentials: { apiKey: KRAKEN_KEY, secret: KRAKEN_DOC_SECRET }, from: "2026-01-01", to: "2026-01-31", tries: 3, balance: null, ...over,
});

/** Everything the server wrote down or sent back, for the "never a credential" checks. */
const everything = (s: ReturnType<typeof setup>, ...replies: unknown[]) => JSON.stringify({ logs: s.logs, events: s.mem.events, kept: [...s.mem.kept.values()].map((k) => ({ ...k, userToken: "" })), replies });

async function keysOf(s: ReturnType<typeof setup>): Promise<PublicKey[]> {
  return ((await (await s.call("keys")).json()) as { keys: PublicKey[] }).keys;
}

describe("the switch and who may call", () => {
  it("answers 404 while switched off, but always publishes the keys", async () => {
    const s = setup({ flag: false });
    expect((await s.call("fetch", krakenBody())).status).toBe(404);
    expect((await s.call("status")).status).toBe(404);
    const keys = await s.call("keys");
    expect(keys.status).toBe(200);
    expect(keys.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(((await keys.json()) as { keys: unknown[] }).keys).toHaveLength(1);
    // The environment's "off" wins over the build's "on".
    expect((await setup({ env: { ...SECRETS, BROKER_CONNECT: "off" } }).call("status")).status).toBe(404);
  });

  it("says what is set up", async () => {
    expect(await (await setup().call("status")).json()).toEqual({ on: true, signing: true, keep: true, alpaca: true });
    expect(await (await setup({ env: {} }).call("status")).json()).toEqual({ on: true, signing: false, keep: false, alpaca: false });
  });

  it("takes requests only from Parity's own pages, from a signed-in person, never from a connected AI app", async () => {
    const s = setup();
    expect((await s.call("fetch", krakenBody(), { Origin: "https://evil.example" })).status).toBe(403);
    expect((await s.call("fetch", krakenBody(), { Origin: "https://claude.ai" })).status).toBe(403);
    expect((await s.call("fetch", krakenBody(), { Origin: "https://feat-x.parity-research.pages.dev" })).status).toBe(200);
    expect((await s.call("fetch", krakenBody(), { Authorization: "Bearer nope" })).status).toBe(401);
    const app = await s.call("fetch", krakenBody(), { Authorization: "Bearer app" });
    expect(app.status).toBe(403);
    expect(((await app.json()) as { error: string }).error).toBe("Connected apps cannot read from brokers.");
  });

  it("refuses to read without a signing key, in plain words", async () => {
    const r = await setup({ env: {} }).call("fetch", krakenBody());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "Broker connections are not set up on this server yet.", code: "not_set_up" });
  });
});

describe("reading once", () => {
  it("checks the key, reads, signs a record anyone can check with the published key, and keeps nothing", async () => {
    const s = setup();
    const res = await s.call("fetch", krakenBody());
    expect(res.status).toBe(200);
    const out = await res.json() as { record: { result: { trades: number; kind: string; tries: number; verdict: { id: string }; dateFrom: string; dateTo: string; card3: { survives: number } | null; methodVersion: string }; cards: unknown; attestation: string; csv: string }; source: Record<string, string>; connection: string | null };
    expect(out.source).toMatchObject({ venue: "kraken", name: "Kraken", env: "live", from: "2026-01-01", to: "2026-01-31" });
    expect(out.source.account).toMatch(/^acct_/);
    expect(out.connection).toBeNull();
    expect(out.record.result.trades).toBe(2);
    expect(out.record.result.kind).toBe("real");
    expect(out.record.csv.split("\n")[0]).toBe("open_time,close_time,symbol,side,size,entry,exit,fees,pnl");
    // The badge the browser would publish from this answer checks out as broker-connected.
    const r = out.record.result;
    const trust = await trustOf({
      attestation: out.record.attestation, input_kind: r.kind, stated_tries: r.tries, trade_count: r.trades, date_from: r.dateFrom, date_to: r.dateTo,
      verdict: r.verdict.id, survives_tries: r.card3?.survives ?? null, method_version: r.methodVersion, file_sha256: await sha256Hex(out.record.csv), cards: out.record.cards,
    }, await keysOf(s));
    expect(trust).toMatchObject({ level: "broker_connected", venue: "kraken", account: out.source.account });
    expect(await cardsHash(out.record.cards)).toMatch(/^[0-9a-f]{64}$/);
    expect(s.mem.events.map((e) => e.event)).toEqual(["fetch", "fetched"]);
    expect(s.mem.kept.size).toBe(0);
    expect(everything(s, out)).not.toContain(KRAKEN_KEY);
    expect(everything(s, out)).not.toContain(KRAKEN_DOC_SECRET);
    expect(everything(s, out)).not.toContain("AA12 N84G TEST KEY0");
    expect(s.logs.find((l) => l.route === "fetch")).toMatchObject({ msg: "connect", route: "fetch", venue: "kraken", status: 200, trades: 2 });
  });

  it("refuses a key that can trade or withdraw before reading a single trade, and says so", async () => {
    const venue = recorded([[/GetApiKeyInfo/, json(fx("kraken-keyinfo-trade.json"))], [/TradesHistory/, json(fx("kraken-trades.json"))]]);
    const s = setup({ venue });
    const res = await s.call("fetch", krakenBody());
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; code: string };
    expect(body.code).toBe("refused");
    expect(body.error).toBe("This Kraken key can place and change orders, withdraw money. Parity only takes keys that can read and nothing else. Make a new key with read access only and try again. We did not keep the key you sent.");
    expect(venue.seen.some((x) => x.url.includes("TradesHistory"))).toBe(false);
    expect(s.mem.events.map((e) => e.event)).toEqual(["fetch", "refused"]);
    expect(everything(s, body)).not.toContain(KRAKEN_DOC_SECRET);
  });

  it("answers bad input and venue trouble in plain words, never with the venue's raw reply", async () => {
    const s = setup();
    expect(await (await s.call("fetch", krakenBody({ from: "2026-02-01", to: "2026-01-01" }))).json()).toMatchObject({ error: "The start date is after the end date." });
    expect(await (await s.call("fetch", krakenBody({ to: "2027-01-01" }))).json()).toMatchObject({ error: "The end date is in the future." });
    expect(await (await s.call("fetch", krakenBody({ venue: "ftx" }))).json()).toMatchObject({ error: "Pick a broker or exchange." });
    expect(await (await s.call("fetch", krakenBody({ credentials: { apiKey: KRAKEN_KEY } }))).json()).toMatchObject({ error: "Fill in the private key." });
    expect(await (await s.call("fetch", { ...krakenBody(), venue: "binance", credentials: { apiKey: "k".repeat(64), secret: "s".repeat(64) } })).json()).toMatchObject({ error: "Name the markets you traded, such as BTCUSDT." });
    const down = setup({ venue: recorded([[/GetApiKeyInfo/, new Response("<html>upstream secret stack trace</html>", { status: 500 })]]) });
    const r = await down.call("fetch", krakenBody());
    expect(r.status).toBe(502);
    const text = JSON.stringify(await r.json());
    expect(text).toContain("Kraken had a problem answering");
    expect(text).not.toContain("stack trace");
  });

  it("stops at the database's rate limit with its words", async () => {
    const s = setup();
    for (let i = 0; i < 10; i++) await s.call("fetch", krakenBody());
    const r = await s.call("fetch", krakenBody());
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: "You can read from a broker 10 times an hour. Try again later." });
  });
});

describe("keep in sync", () => {
  it("is refused when the server has no sealing key", async () => {
    const r = await setup({ env: { BROKER_RECORD_SIGNING_KEY: testSecret(1) } }).call("fetch", krakenBody({ keep: true }));
    expect(r.status).toBe(503);
    expect(((await r.json()) as { error: string }).error).toMatch(/Untick it to read once/);
  });

  it("stores the key sealed, reads again from it by id, and logs each use", async () => {
    const s = setup();
    const first = await (await s.call("fetch", krakenBody({ keep: true, label: "Main account" }))).json() as { connection: string };
    expect(first.connection).toMatch(/^[0-9a-f-]{36}$/);
    const kept = s.mem.kept.get(first.connection)!;
    expect(kept).toMatchObject({ venue: "kraken", env: "live", label: "Main account" });
    expect(kept.sealed).toMatch(/^v1\./);
    expect(kept.sealed).not.toContain(KRAKEN_KEY);
    const again = await s.call("sync", { connection: first.connection, from: "2026-01-01", to: "2026-01-31", tries: 3 });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { record: { result: { trades: number } } }).record.result.trades).toBe(2);
    expect(s.mem.events.map((e) => e.event)).toEqual(["fetch", "saved", "fetched", "fetch", "synced"]);
    expect(everything(s)).not.toContain(KRAKEN_DOC_SECRET);
    // Under another server key the sealed credential cannot be opened, and the page says what to do.
    s.deps.env = { ...SECRETS, BROKER_CREDENTIAL_KEY: testSecret(3) };
    const rotated = await s.call("sync", { connection: first.connection, from: "2026-01-01", to: "2026-01-31" });
    expect(rotated.status).toBe(409);
    expect(((await rotated.json()) as { error: string }).error).toMatch(/Revoke it in Settings and connect again/);
  });
});

describe("Alpaca's sign-in", () => {
  it("sends the person to Alpaca with a signed state, and passes the code back in the fragment only", async () => {
    const s = setup();
    const start = await (await s.call("alpaca/start", { env: "paper" })).json() as { url: string };
    const u = new URL(start.url);
    expect(u.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/connect/alpaca/callback`);
    expect(u.searchParams.get("state")).not.toContain(USER.userId);
    const back = await s.call(`alpaca/callback?code=abc123&state=${encodeURIComponent(u.searchParams.get("state")!)}`);
    expect(back.status).toBe(302);
    expect(back.headers.get("Location")).toMatch(/^\/verify\/\?connect=alpaca#code=abc123&state=/);
    expect(back.headers.get("Referrer-Policy")).toBe("no-referrer");
    const denied = await s.call("alpaca/callback?error=access_denied");
    expect(denied.headers.get("Location")).toBe("/verify/?connect=alpaca#error=denied");
  });

  it("swaps the code on the server, reads, and refuses a state made for someone else", async () => {
    const acts = JSON.parse(realFx("real/alpaca-activities-alpacapy.json")).map((a: Record<string, unknown>, i: number) => ({ ...a, transaction_time: `2026-01-${String(5 + i).padStart(2, "0")}T15:00:00Z` }));
    const venue = recorded([[/oauth\/token/, json(fx("alpaca-token.json"))], [/\/v2\/account$/, json(fx("alpaca-account.json"))], [/activities\/FILL/, json(acts)]]);
    const s = setup({ venue });
    const seed = seedFrom(SECRETS.BROKER_RECORD_SIGNING_KEY)!;
    const state = await makeState(seed, USER.userId, "paper", NOW);
    const ok = await s.call("fetch", { venue: "alpaca", credentials: { code: "abc123", state }, from: "2026-01-01", to: "2026-01-31" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { source: { env: string } }).source.env).toBe("paper");
    expect(venue.seen[0].body).toContain("client_secret=alpaca-secret-test-only");
    expect(everything(s)).not.toContain("alpaca-secret-test-only");
    expect(everything(s)).not.toContain("test-alpaca-access-token-not-real");
    const theirs = await makeState(seed, "22222222-2222-4222-8222-222222222222", "paper", NOW);
    const bad = await s.call("fetch", { venue: "alpaca", credentials: { code: "abc123", state: theirs }, from: "2026-01-01", to: "2026-01-31" });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toMatch(/could not be matched to you/);
  });
});
