// The public API (DEC-0071): key format, hashing, the keyed request path (scopes, limits,
// revocation, expiry, allowlists), problem details, the spec, key management and the
// leaked-key endpoint. The store and data files are faked: no test talks to the network.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { base62, bearer, constantTimeEqual, crc32, generateKey, hashKey, KEY_LEN, last4, wellFormed } from "../src/lib/api/keys";
import { ipAllowed, LIMITS, MinuteLimiter, parseCidr, planOf } from "../src/lib/api/policy";
import { handleApi, resetMeter, ROUTES, type ApiDeps } from "../src/lib/api/server";
import { handleKeys, readNewKey, type ManageDeps } from "../src/lib/api/manage";
import type { KeyRecord, Store } from "../src/lib/api/store";
import type { Data } from "../src/lib/mcp/tools";

const SITE = "https://parity.endyland.com";
const PEPPER = "p".repeat(48);
const DAY = 86_400_000;
const NOW = Date.parse("2026-10-26T12:00:00Z");

describe("key format", () => {
  it("has the prefix, 49 base62 characters and a valid checksum", () => {
    const k = generateKey();
    expect(k).toMatch(/^pk_test_[0-9A-Za-z]{49}$/);
    expect(k.length).toBe(KEY_LEN);
    expect(wellFormed(k)).toBe(true);
  });

  it("uses all 32 random bytes", () => {
    const zeros = generateKey("pk_test_", (n) => new Uint8Array(n));
    const ones = generateKey("pk_test_", (n) => new Uint8Array(n).fill(255));
    expect(zeros.slice(8, 51)).toBe("0".repeat(43));
    expect(ones.slice(8, 51)).toBe(base62((1n << 256n) - 1n, 43));
    expect(new Set(Array.from({ length: 50 }, () => generateKey())).size).toBe(50);
  });

  it("catches a typo or a changed character with the checksum", () => {
    const k = generateKey();
    const flipped = k.slice(0, 20) + (k[20] === "a" ? "b" : "a") + k.slice(21);
    expect(wellFormed(flipped)).toBe(false);
    expect(wellFormed(k.slice(0, -1))).toBe(false);
    expect(wellFormed(k.replace("pk_test_", "pk_prod_"))).toBe(false);
    expect(wellFormed("")).toBe(false);
  });

  it("computes the standard CRC32", () => {
    expect(crc32("123456789")).toBe(0xcbf43926);
  });

  it("hashes with HMAC-SHA-256 and the pepper", async () => {
    const k = generateKey();
    const h = await hashKey(k, PEPPER);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashKey(k, PEPPER)).toBe(h);
    expect(await hashKey(k, "q".repeat(48))).not.toBe(h);
    await expect(hashKey(k, "short")).rejects.toThrow(/pepper/);
    // A known HMAC-SHA-256 value (RFC 4231 style check with our own inputs).
    const known = await hashKey("pk_test_x", "k".repeat(32));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode("k".repeat(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("pk_test_x")))].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(known).toBe(mac);
  });

  it("compares in constant time and reads bearer headers", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(bearer("Bearer pk_test_abc")).toBe("pk_test_abc");
    expect(bearer("Basic abc")).toBeNull();
    expect(last4("pk_test_abcdefgh")).toBe("efgh");
  });
});

describe("policy", () => {
  it("matches IPv4 and IPv6 allowlists", () => {
    expect(ipAllowed("203.0.113.7", [])).toBe(true);
    expect(ipAllowed("203.0.113.7", ["203.0.113.0/24"])).toBe(true);
    expect(ipAllowed("203.0.114.7", ["203.0.113.0/24"])).toBe(false);
    expect(ipAllowed("2001:db8::1", ["2001:db8::/32"])).toBe(true);
    expect(ipAllowed("2001:db9::1", ["2001:db8::/32"])).toBe(false);
    expect(ipAllowed("::ffff:192.0.2.1", ["::ffff:192.0.2.0/120"])).toBe(true);
    expect(ipAllowed(null, ["203.0.113.7"])).toBe(false);
    expect(parseCidr("10.0.0.0/33")).toBeNull();
    expect(parseCidr("not an ip")).toBeNull();
  });

  it("limits each key per minute", () => {
    let t = 0;
    const lim = new MinuteLimiter(() => t);
    for (let i = 0; i < 3; i++) expect(lim.take("k", 3).ok).toBe(true);
    expect(lim.take("k", 3).ok).toBe(false);
    t = 61_000;
    expect(lim.take("k", 3).ok).toBe(true);
    expect(planOf("platform")).toBe("platform");
    expect(planOf("anything")).toBe("free");
  });
});

// ---------------------------------------------------------------- the keyed request path

const report = {
  generated_at: "2026-10-26", n_trials: 2,
  runs: [{ strategy: "carry", display_name: "Carry", description: "FX carry", tags: { asset: "fx" }, gauntlet: { verdict: "fails", beats_sp500: false }, metrics: {}, params: {}, equity: [], yearly: [] }],
};
const term = { generated_at: "2026-10-26", data_through: "2026-10-25", groups: [], series: [{ key: "fx.EUR", label: "Euro", short: "EUR", group: "fx_g10", class: "fx", source: "FRED", licence: "Public domain", kind: "price", unit: "USD", freq: "D", first: "2000-01-03", asof: "2026-10-25", last: 1.08, chg: { d1: 0.001 }, vol: null, z: null, pct1y: null, spark: [], file: "fx.EUR.json" }] };
const data: Data = {
  async json<T>(path: string) {
    if (path === "/data/latest.json") return report as T;
    if (path === "/data/terminal/index.json") return term as T;
    if (path === "/data/terminal/fx.EUR.json") return { points: [["2026-10-24", 1.07], ["2026-10-25", 1.08]] } as T;
    return null;
  },
};

interface Fixture { key: string; hash: string; rec: KeyRecord }
async function fixture(over: Partial<KeyRecord> = {}): Promise<Fixture> {
  const key = generateKey();
  const hash = await hashKey(key, PEPPER);
  return { key, hash, rec: { id: "k1", user_id: `u-${Math.random()}`, key_hash: hash, scopes: ["read:strategies", "read:markets"], ip_allowlist: null, expires_at: new Date(NOW + 30 * DAY).toISOString(), revoked_at: null, plan: "free", used_today: 0, ...over } };
}

function fakeStore(f: Fixture | null): Store & { recorded: unknown[][]; revoked: string[] } {
  const s = {
    recorded: [] as unknown[][], revoked: [] as string[],
    lookup: vi.fn(async (h: string) => (f && h === f.hash ? f.rec : null)),
    record: vi.fn(async (...a: unknown[]) => { s.recorded.push(a); }),
    revokeLeaked: vi.fn(async (h: string) => { s.revoked.push(h); return !!f && h === f.hash; }),
  };
  return s;
}

function deps(store: Store, over: Partial<ApiDeps> = {}): ApiDeps {
  return { pepper: PEPPER, store, data, siteDomain: "endyland.com", site: SITE, limiter: new MinuteLimiter(() => NOW), missLimiter: new MinuteLimiter(() => NOW), now: () => NOW, log: () => {}, ...over };
}

const call = (path: string, key?: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request(`${SITE}/api/v1${path}`, { ...init, headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(init.headers ?? {}) } });

beforeEach(() => resetMeter());

describe("the API", () => {
  it("answers 503 not configured until the pepper is set", async () => {
    const f = await fixture();
    const res = await handleApi(call("/strategies", f.key), deps(fakeStore(f), { pepper: undefined }));
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await res.json()).type).toBe(`${SITE}/developers/#problem-not-configured`);
  });

  it("serves strategies with the right scope, rate headers and no caching", async () => {
    const f = await fixture();
    const res = await handleApi(call("/strategies?query=carry&limit=5", f.key), deps(fakeStore(f)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.strategies[0].id).toBe("carry");
    expect(res.headers.get("RateLimit-Limit")).toBe(String(LIMITS.free.minute));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("serves one strategy, a series, and the snapshot", async () => {
    const f = await fixture();
    const d = deps(fakeStore(f));
    expect((await (await handleApi(call("/strategies/carry", f.key), d)).json()).id).toBe("carry");
    expect((await handleApi(call("/strategies/nope", f.key), d)).status).toBe(404);
    const s = await (await handleApi(call("/markets/series/fx.EUR?max_points=10", f.key), d)).json();
    expect(s.points.length).toBe(2);
    const snap = await (await handleApi(call("/markets/snapshot", f.key), d)).json();
    expect(snap.series[0]).toMatchObject({ key: "fx.EUR", last: 1.08, change_1d: 0.001 });
  });

  it("refuses a missing, malformed, unknown, revoked or expired key", async () => {
    const f = await fixture();
    const d = deps(fakeStore(f));
    const missing = await handleApi(call("/strategies"), d);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect((await handleApi(call("/strategies", "pk_test_nope"), d)).status).toBe(401);
    expect((await handleApi(call("/strategies", generateKey()), d)).status).toBe(401);
    const r = await fixture({ revoked_at: new Date(NOW - DAY).toISOString() });
    expect((await (await handleApi(call("/strategies", r.key), deps(fakeStore(r)))).json()).title).toBe("Key revoked");
    const e = await fixture({ expires_at: new Date(NOW - 1).toISOString() });
    expect((await (await handleApi(call("/strategies", e.key), deps(fakeStore(e)))).json()).title).toBe("Key expired");
  });

  it("stops looking up unknown keys from an address after 20 misses a minute", async () => {
    const store = fakeStore(null);
    const d = deps(store);
    const from = { headers: { "CF-Connecting-IP": "198.51.100.9" } };
    for (let i = 0; i < 20; i++) expect((await handleApi(call("/strategies", generateKey(), from), d)).status).toBe(401);
    expect((await handleApi(call("/strategies", generateKey(), from), d)).status).toBe(429);
    expect(store.lookup).toHaveBeenCalledTimes(20);
  });

  it("never reads the store for a key that fails its checksum", async () => {
    const f = await fixture();
    const store = fakeStore(f);
    await handleApi(call("/strategies", f.key.slice(0, -1) + (f.key.endsWith("A") ? "B" : "A")), deps(store));
    expect(store.lookup).not.toHaveBeenCalled();
  });

  it("checks the scope for each endpoint", async () => {
    const f = await fixture({ scopes: ["read:markets"] });
    const d = deps(fakeStore(f));
    const res = await handleApi(call("/strategies", f.key), d);
    expect(res.status).toBe(403);
    expect(res.headers.get("WWW-Authenticate")).toContain('scope="read:strategies"');
    expect((await handleApi(call("/news/impact", f.key), d)).status).not.toBe(403);
    const v = await handleApi(call("/verify", f.key, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }), d);
    expect(v.status).toBe(403);
  });

  it("runs Verify on posted numbers with write:verify", async () => {
    const f = await fixture({ scopes: ["write:verify", "read:verify"] });
    const d = deps(fakeStore(f));
    const body = { kind: "backtest", equity: Array.from({ length: 300 }, (_, i) => ({ date: new Date(Date.UTC(2024, 0, 1) + i * DAY).toISOString().slice(0, 10), equity: 10000 + i * 5 })) };
    const res = await handleApi(call("/verify", f.key, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), d);
    expect(res.status).toBe(200);
    expect((await res.json()).verdict).toBeTruthy();
    expect((await handleApi(call("/verify", f.key, { method: "POST", body: "x", headers: { "Content-Type": "text/plain" } }), d)).status).toBe(415);
    expect((await handleApi(call("/verify", f.key, { method: "POST", body: "{", headers: { "Content-Type": "application/json" } }), d)).status).toBe(400);
    expect((await handleApi(call("/verify/tests", f.key), d)).status).toBe(200);
  });

  it("limits requests per minute and per day", async () => {
    const f = await fixture();
    const d = deps(fakeStore(f));
    for (let i = 0; i < LIMITS.free.minute; i++) expect((await handleApi(call("/strategies", f.key), d)).status).toBe(200);
    const res = await handleApi(call("/strategies", f.key), d);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    const q = await fixture({ used_today: LIMITS.free.day });
    const day = await handleApi(call("/strategies", q.key), deps(fakeStore(q)));
    expect(day.status).toBe(429);
    expect((await day.json()).title).toBe("Daily quota used");
  });

  it("enforces the IP allowlist", async () => {
    const f = await fixture({ ip_allowlist: ["203.0.113.0/24"] });
    const d = deps(fakeStore(f));
    expect((await handleApi(call("/strategies", f.key, { headers: { "CF-Connecting-IP": "203.0.113.9" } }), d)).status).toBe(200);
    expect((await handleApi(call("/strategies", f.key, { headers: { "CF-Connecting-IP": "198.51.100.1" } }), d)).status).toBe(403);
  });

  it("refuses other sites' browsers and unknown paths, and allows our own", async () => {
    const f = await fixture();
    const d = deps(fakeStore(f));
    expect((await handleApi(call("/strategies", f.key, { headers: { Origin: "https://evil.example" } }), d)).status).toBe(403);
    const own = await handleApi(call("/strategies", f.key, { headers: { Origin: "https://parity.endyland.com" } }), d);
    expect(own.headers.get("Access-Control-Allow-Origin")).toBe("https://parity.endyland.com");
    expect((await handleApi(call("/nothing", f.key), d)).status).toBe(404);
    expect((await handleApi(call("/strategies/%E0%A4%A", f.key), d)).status).toBe(404);
    expect((await handleApi(call("/strategies", f.key, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }), d)).status).toBe(405);
  });

  it("meters usage in batches and never logs the key", async () => {
    const f = await fixture();
    const store = fakeStore(f);
    const lines: string[] = [];
    const d = deps(store, { log: (l) => lines.push(JSON.stringify(l)) });
    for (let i = 0; i < 25; i++) await handleApi(call("/strategies", f.key), d);
    expect(store.recorded.length).toBe(1);
    const [hash, requests, errors, log] = store.recorded[0] as [string, number, number, { path: string }[]];
    expect(hash).toBe(f.hash);
    expect(requests).toBe(25);
    expect(errors).toBe(0);
    expect(log[0].path).toBe("/api/v1/strategies");
    expect(lines.join("\n")).not.toContain(f.key);
    expect(JSON.stringify(store.recorded)).not.toContain(f.key);
  });

  it("publishes an index and an OpenAPI 3.1 spec covering every route", async () => {
    const d = deps(fakeStore(null));
    const idx = await (await handleApi(call("/"), d)).json();
    expect(idx.endpoints.length).toBe(ROUTES.length);
    const spec = await (await handleApi(call("/openapi.json"), d)).json();
    expect(spec.openapi).toBe("3.1.0");
    for (const r of ROUTES) expect(spec.paths[`/api/v1${r.path}`][r.method.toLowerCase()]["x-required-scope"]).toBe(r.scope);
    expect(spec.paths["/api/v1/leaked-keys"].post).toBeTruthy();
  });

  it("revokes a reported leaked key and answers in GitHub's format", async () => {
    const f = await fixture();
    const store = fakeStore(f);
    const body = JSON.stringify([{ token: f.key, type: "parity_api_key", url: "https://github.com/x/y/blob/main/a.py", source: "content" }, { token: "pk_test_fake", type: "parity_api_key" }]);
    const res = await handleApi(call("/leaked-keys", undefined, { method: "POST", body, headers: { "Content-Type": "application/json" } }), deps(store));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.map((r: { label: string }) => r.label)).toEqual(["true_positive", "false_positive"]);
    expect(JSON.stringify(out)).not.toContain(f.key);
    expect(store.revoked).toEqual([f.hash]);
  });
});

// ---------------------------------------------------------------- key management

describe("making and rotating keys", () => {
  const caller = { userId: "u1", email: "a@example.com", clientId: null, token: "t" };
  const mdeps = (over: Partial<ManageDeps> = {}): ManageDeps & { made: unknown[] } => {
    const made: unknown[] = [];
    return {
      made, pepper: PEPPER, siteDomain: "endyland.com",
      verify: async (t) => (t === "good" ? caller : t === "app" ? { ...caller, clientId: "claude" } : null),
      create: async (_t, a) => { made.push(a); return { id: "00000000-0000-4000-8000-000000000001", expires_at: "2027-01-24T00:00:00Z" }; },
      rotate: async (_t, id, a) => { made.push({ id, ...a }); return { id: "00000000-0000-4000-8000-000000000002", expires_at: "2027-01-24T00:00:00Z" }; },
      ...over,
    };
  };
  const req = (path: string, token: string | null, body: unknown, origin = SITE) =>
    new Request(`${SITE}${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

  it("returns the key once and stores only its HMAC", async () => {
    const d = mdeps();
    const res = await handleKeys(req("/api/keys", "good", { name: "ci", scopes: ["read:markets"] }), d);
    expect(res.status).toBe(201);
    const { key } = await res.json();
    expect(wellFormed(key)).toBe(true);
    const stored = d.made[0] as { hash: string; last4: string; days: number };
    expect(stored.hash).toBe(await hashKey(key, PEPPER));
    expect(stored.last4).toBe(key.slice(-4));
    expect(stored.days).toBe(90);
    expect(JSON.stringify(d.made)).not.toContain(key);
  });

  it("refuses without the pepper, a session, our origin, or from an AI app", async () => {
    const body = { name: "ci", scopes: ["read:markets"] };
    expect((await handleKeys(req("/api/keys", "good", body), mdeps({ pepper: undefined }))).status).toBe(503);
    expect((await handleKeys(req("/api/keys", null, body), mdeps())).status).toBe(401);
    expect((await handleKeys(req("/api/keys", "good", body, "https://evil.example"), mdeps())).status).toBe(403);
    expect((await handleKeys(req("/api/keys", "app", body), mdeps())).status).toBe(403);
  });

  it("checks names, scopes, expiry and allowlists", () => {
    expect(readNewKey({ name: "", scopes: ["read:markets"] }).ok).toBe(false);
    expect(readNewKey({ name: "x", scopes: ["admin"] }).ok).toBe(false);
    expect(readNewKey({ name: "x", scopes: ["read:markets"], days: 400 }).ok).toBe(false);
    expect(readNewKey({ name: "x", scopes: ["read:markets"], ip: ["nope"] }).ok).toBe(false);
    expect(readNewKey({ name: "x", scopes: ["read:markets"], ip: ["203.0.113.0/24"], days: 30 })).toMatchObject({ ok: true, days: 30 });
  });

  it("rotates with an overlap", async () => {
    const d = mdeps();
    const res = await handleKeys(req("/api/keys/rotate", "good", { id: "00000000-0000-4000-8000-000000000001", overlap_hours: 24 }), d);
    expect(res.status).toBe(201);
    expect(d.made[0]).toMatchObject({ id: "00000000-0000-4000-8000-000000000001", overlapHours: 24 });
    expect((await handleKeys(req("/api/keys/rotate", "good", { id: "x" }), d)).status).toBe(400);
    expect((await handleKeys(req("/api/keys/rotate", "good", { id: "00000000-0000-4000-8000-000000000001", overlap_hours: 999 }), d)).status).toBe(400);
  });
});
