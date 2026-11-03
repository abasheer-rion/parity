// POST /api/v1/verify/batch (DEC-0087) and the pilot form's sending (no network: both faked).
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateKey, hashKey } from "../../src/lib/api/keys";
import { openApi } from "../../src/lib/api/openapi";
import { MinuteLimiter } from "../../src/lib/api/policy";
import { handleApi, ROUTES } from "../../src/lib/api/server";
import type { KeyRecord, Store } from "../../src/lib/api/store";
import { runBatch, BatchError } from "../../src/lib/screen/api";
import { sendPilot, validate, type PilotForm } from "../../src/lib/screen/pilot";

const SITE = "https://paritytrading.app";
const PEPPER = "p".repeat(48);
const NOW = Date.parse("2026-11-03T12:00:00Z");

const day = (i: number) => new Date(Date.UTC(2026, 6, 1 + Math.floor(i / 3), 10 + (i % 3))).toISOString().slice(0, 19);
const trades = (n: number, pnl: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ close_time: day(i), pnl: pnl(i), size: 1 }));

async function setup(scopes: KeyRecord["scopes"]) {
  const key = generateKey();
  const hash = await hashKey(key, PEPPER);
  const rec: KeyRecord = { id: "k1", user_id: `u-${Math.random()}`, key_hash: hash, scopes, ip_allowlist: null, expires_at: new Date(NOW + 9e9).toISOString(), revoked_at: null, plan: "free", used_today: 0 };
  const store: Store = { lookup: vi.fn(async (h: string) => (h === hash ? rec : null)), record: vi.fn(async () => {}), revokeLeaked: vi.fn(async () => false) };
  const deps = { pepper: PEPPER, store, data: { json: async () => null }, siteDomain: "paritytrading.app", site: SITE, limiter: new MinuteLimiter(() => NOW), missLimiter: new MinuteLimiter(() => NOW), now: () => NOW, log: () => {} };
  const post = (body: string, len?: number) => handleApi(new Request(`${SITE}/api/v1/verify/batch`, {
    method: "POST", body, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(len ? { "Content-Length": String(len) } : {}) },
  }), deps);
  return { post };
}

describe("POST /api/v1/verify/batch", () => {
  const body = { accounts: [
    { id: "a1", trades: trades(40, (i) => ([0, 1, 3].includes(i % 4) ? 300 : -200)), passed: true, outcome: "payout" },
    { id: "a2", trades: trades(40, (i) => (i % 3 ? 100 : -260)), passed: true, outcome: "blowup" },
    { id: "a3", trades: trades(5, () => 50) },
  ], options: { starting_balance: 50_000 } };

  it("screens every account and back-tests the verdicts", async () => {
    const { post } = await setup(["write:verify"]);
    const res = await post(JSON.stringify(body));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.method_version).toBe("screen-1.0");
    expect(out.accounts.map((a: { id: string; verdict: string }) => [a.id, a.verdict])).toEqual([["a1", "holds_up"], ["a2", "likely_luck"], ["a3", "not_enough"]]);
    expect(out.accounts[0].starting_balance).toBe(50_000);
    expect(out.summary.passers).toBe(2);
    expect(out.backtest.table).toEqual({ likely_luck_blew_up: 1, likely_luck_paid_out: 0, holds_up_blew_up: 0, holds_up_paid_out: 1 });
    expect(out.stored).toBe(false);
  });

  it("needs write:verify, a valid body and unique ids", async () => {
    expect((await (await setup(["read:verify"])).post(JSON.stringify(body))).status).toBe(403);
    const { post } = await setup(["write:verify"]);
    expect((await post(JSON.stringify({ accounts: [] }))).status).toBe(400);
    expect((await post(JSON.stringify({ accounts: [{ id: "x", trades: [{ pnl: 1 }] }] }))).status).toBe(400);
    const dup = await post(JSON.stringify({ accounts: [body.accounts[0], body.accounts[0]] }));
    expect(dup.status).toBe(400);
    expect((await dup.json()).detail).toMatch(/sent twice/);
  });

  it("takes bodies up to 5 MB, more than the other endpoints", async () => {
    const { post } = await setup(["write:verify"]);
    expect((await post(JSON.stringify(body), 2_000_000)).status).toBe(200);
    expect((await post(JSON.stringify(body), 6_000_000)).status).toBe(413);
  });

  it("caps the trades in one request", () => {
    const many = { accounts: Array.from({ length: 11 }, (_, k) => ({ id: `x${k}`, trades: trades(5000, () => 1) })) };
    expect(() => runBatch(many, "")).toThrow(BatchError);
  });

  it("is in the OpenAPI file with its body schema", () => {
    const spec = openApi(SITE, ROUTES);
    const op = (spec.paths["/api/v1/verify/batch"] as Record<string, { requestBody?: unknown; "x-required-scope"?: string }>).post;
    expect(op["x-required-scope"]).toBe("write:verify");
    expect(JSON.stringify(op.requestBody)).toContain("count_batch_as_tries");
  });
});

describe("the pilot form", () => {
  const form: PilotForm = { kind: "prop_firm", firm: " Example Funding ", name: "Ana Ruiz", email: "ana@example.com", volume: "100_1000", message: "", page: "/business/prop-firms/" };

  it("checks each field", () => {
    expect(validate(form)).toEqual({});
    expect(Object.keys(validate({ ...form, firm: " ", email: "nope", volume: "lots" }))).toEqual(["firm", "email", "volume"]);
  });

  it("stores the request with the publishable key, then asks for the email", async () => {
    const calls: [string, RequestInit][] = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return url.includes("/functions/") ? new Response(JSON.stringify({ sent: true })) : new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const r = await sendPilot(form, { url: "https://db.example", key: "sb_publishable_x", fetch: f, uuid: () => "11111111-1111-1111-1111-111111111111" });
    expect(r).toEqual({ ok: true, emailed: true });
    expect(calls[0][0]).toBe("https://db.example/rest/v1/pilot_requests");
    expect(JSON.parse(calls[0][1].body as string)).toMatchObject({ id: "11111111-1111-1111-1111-111111111111", firm: "Example Funding", accounts_per_month: "100_1000", kind: "prop_firm" });
    expect((calls[0][1].headers as Record<string, string>).Prefer).toBe("return=minimal");
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ id: "11111111-1111-1111-1111-111111111111" });
  });

  it("says when the rate limit stops a request, and still counts a stored request whose email failed", async () => {
    const limited = vi.fn(async () => new Response('{"message":"rate_limited"}', { status: 400 })) as unknown as typeof fetch;
    expect(await sendPilot(form, { url: "u", key: "k", fetch: limited })).toEqual({ ok: false, reason: "rate_limited" });
    const noMail = vi.fn(async (url: string) => (url.includes("/functions/") ? new Response("{}", { status: 502 }) : new Response(null, { status: 201 }))) as unknown as typeof fetch;
    expect(await sendPilot(form, { url: "u", key: "k", fetch: noMail })).toEqual({ ok: true, emailed: false });
  });
});
