// @vitest-environment node
// The signed proof behind a broker-connected badge, and the sealed credential behind "keep in
// sync" (DEC-0091). A badge is broker-connected only when our key signed the proof and every
// number on the badge matches it; a sealed credential opens only for its own person,
// connection and venue, and only with the server's secret.
import { describe, expect, it } from "vitest";
import { accountCode, cardsHash, jwks, oldKeys, peekClaims, publicKeyOf, seedFrom, signRecord, trustOf, verifyRecord, type BadgeFacts, type RecordClaims } from "../../src/lib/connect/attest";
import { canonicalJson, fromB64url, toB64url } from "../../src/lib/connect/bytes";
import { vaultFrom } from "../../src/lib/connect/vault";
import { badgeAlt, badgeCardHtml, badgeSvg, socialLine, type PublicBadge } from "../../src/lib/verify/badge";
import { badgeCard } from "../../src/lib/og/share";
import { testSecret } from "./helpers";

const seed = seedFrom(testSecret(1))!;
const cards = { verdict: { id: "could_be_luck", sentence: "x" }, card1: { n: 30, winRate: 0.5, expectancy: 1.25e-7 }, card4: [{ id: "fills", status: "na" }] };

async function claims(over: Partial<RecordClaims> = {}): Promise<RecordClaims> {
  return {
    v: 1, jti: "AAAAAAAAAAAAAAAAAAAAAA", iat: 1_770_000_000, venue: "kraken", env: "live", account: await accountCode(seed, "kraken", "AA12"),
    fetched_at: "2026-02-03T12:00:00.000Z", from: "2026-01-01", to: "2026-01-31", kind: "real", tries: 3, balance: false,
    trades: 40, date_from: "2026-01-05", date_to: "2026-01-30", verdict: "could_be_luck", survives: 2, method: "verify-1.1",
    cards: await cardsHash(cards), file: "a".repeat(64), own: "b".repeat(64), ...over,
  };
}

const badge = (jws: string, over: Partial<BadgeFacts> = {}): BadgeFacts => ({
  attestation: jws, input_kind: "real", stated_tries: 3, trade_count: 40, date_from: "2026-01-05", date_to: "2026-01-30",
  verdict: "could_be_luck", survives_tries: 2, method_version: "verify-1.1", file_sha256: "a".repeat(64),
  // As the database hands it back: keys reordered, the tiny number written out in full.
  cards: JSON.parse('{"card4":[{"status":"na","id":"fills"}],"card1":{"expectancy":0.000000125,"winRate":0.5,"n":30},"verdict":{"sentence":"x","id":"could_be_luck"}}'),
  ...over,
});

describe("the proof", () => {
  it("signs with Ed25519 and checks under the published key only", async () => {
    const key = await publicKeyOf(seed);
    const jws = await signRecord(await claims(), seed);
    expect(jws.split(".")).toHaveLength(3);
    expect(JSON.parse(new TextDecoder().decode(fromB64url(jws.split(".")[0])))).toEqual({ alg: "EdDSA", typ: "parity-record+jws", kid: key.kid });
    expect(verifyRecord(jws, [key])?.venue).toBe("kraken");
    const other = await publicKeyOf(seedFrom(testSecret(2))!);
    expect(verifyRecord(jws, [{ ...other, kid: key.kid }])).toBeNull();
    expect(jwks([key]).keys[0]).toEqual({ kty: "OKP", crv: "Ed25519", use: "sig", alg: "EdDSA", kid: key.kid, x: key.x });
    expect(await oldKeys(`${other.x}, not-a-key`)).toEqual([other]);
  });

  it("is broken by any edit to its claims", async () => {
    const key = await publicKeyOf(seed);
    const jws = await signRecord(await claims(), seed);
    const [h, , s] = jws.split(".");
    const forged = `${h}.${toB64url(new TextEncoder().encode(JSON.stringify(await claims({ verdict: "holds_up" }))))}.${s}`;
    expect(peekClaims(forged)?.verdict).toBe("holds_up");
    expect(verifyRecord(forged, [key])).toBeNull();
  });

  it("makes a badge broker-connected only when every number matches, after a database round trip", async () => {
    const keys = [await publicKeyOf(seed)];
    const jws = await signRecord(await claims(), seed);
    expect(canonicalJson(badge(jws).cards)).toBe(canonicalJson(cards));
    await expect(trustOf(badge(jws), keys)).resolves.toMatchObject({ level: "broker_connected", venue: "kraken", env: "live", balanceStated: false });
    await expect(trustOf(badge(jws, { verdict: "holds_up" }), keys)).resolves.toEqual({ level: "self_reported", why: "numbers_differ" });
    await expect(trustOf(badge(jws, { stated_tries: 1 }), keys)).resolves.toEqual({ level: "self_reported", why: "numbers_differ" });
    await expect(trustOf(badge(jws, { cards: { ...cards, card1: { n: 30, winRate: 0.9 } } }), keys)).resolves.toEqual({ level: "self_reported", why: "numbers_differ" });
    await expect(trustOf(badge(jws), [])).resolves.toEqual({ level: "self_reported", why: "bad_signature" });
    await expect(trustOf(badge(""), keys)).resolves.toEqual({ level: "self_reported", why: "no_proof" });
  });

  it("gives an account the same one-way code every time, different per venue and per secret", async () => {
    const a = await accountCode(seed, "kraken", "AA12 N84G");
    expect(a).toMatch(/^acct_[A-Za-z0-9_-]{16}$/);
    expect(await accountCode(seed, "kraken", " AA12 N84G ")).toBe(a);
    expect(await accountCode(seed, "bybit", "AA12 N84G")).not.toBe(a);
    expect(await accountCode(seedFrom(testSecret(9))!, "kraken", "AA12 N84G")).not.toBe(a);
    expect(a).not.toContain("AA12");
  });

  it("reads only a 32-byte base64url secret as a signing key", () => {
    expect(seedFrom(undefined)).toBeNull();
    expect(seedFrom("short")).toBeNull();
    expect(seedFrom(testSecret(3))).toHaveLength(32);
  });
});

describe("the badge's words follow its checked trust", () => {
  const b: PublicBadge = {
    id: "Ab3dEf6hIj9k", created_at: "2026-02-03T12:00:00Z", withdrawn_at: null, name: "My bot", input_kind: "real", stated_tries: 3,
    date_from: "2026-01-05", date_to: "2026-01-30", trade_count: 40, verdict: "could_be_luck", survives_tries: 2, cards: {}, method_version: "verify-1.1", file_sha256: "a".repeat(64),
  };
  const trust = { level: "broker_connected" as const, venue: "kraken", env: "live" as const, account: "acct_AAAAAAAAAAAAAAAA", fetchedAt: "2026-02-03T12:00:00.000Z", balanceStated: false };

  it("says self-reported by default and broker-connected only when given that trust", () => {
    expect(badgeSvg(b)).toContain("Self-reported: Parity checked the numbers in the file,");
    expect(badgeSvg(b, trust)).toContain("BROKER-CONNECTED");
    expect(badgeSvg(b, trust)).toContain("read by Parity from Kraken");
    expect(badgeAlt(b, trust)).toBe("Parity Verify: Could be luck. Survives up to 2 tries. Broker-connected record from Kraken.");
    expect(socialLine(b, "paritytrading.app", trust)).toBe("Parity Verify: Could be luck. Survives up to 2 tries. Broker-connected real money from Kraken, 40 trades. paritytrading.app/v/Ab3dEf6hIj9k");
    expect(badgeCardHtml(b, b.id, "https://paritytrading.app", trust)).toContain("Broker-connected: Parity read these trades from Kraken itself");
    expect(badgeCard(b, b.id, trust).detail).toMatch(/^Broker-connected real money/);
    expect(badgeCard(b, b.id).note).toMatch(/^Self-reported/);
  });
});

describe("the vault", () => {
  it("seals a credential that opens only for the same person, connection and venue", async () => {
    const v = (await vaultFrom(testSecret(5)))!;
    const dk = await v.newDataKey("user-1");
    const sealed = await v.seal(dk, "user-1", "conn-1:kraken", { apiKey: "k", secret: "s3cret-value" });
    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain("s3cret");
    expect(await v.open(dk, "user-1", "conn-1:kraken", sealed)).toEqual({ apiKey: "k", secret: "s3cret-value" });
    await expect(v.open(dk, "user-1", "conn-2:kraken", sealed)).rejects.toThrow(/could not be opened/);
    await expect(v.open(dk, "user-1", "conn-1:bybit", sealed)).rejects.toThrow(/could not be opened/);
    await expect(v.open(dk, "user-2", "conn-1:kraken", sealed)).rejects.toThrow(/could not be opened/);
    const other = (await vaultFrom(testSecret(6)))!;
    expect(other.keyId).not.toBe(v.keyId);
    await expect(other.open(dk, "user-1", "conn-1:kraken", sealed)).rejects.toThrow(/could not be opened/);
  });

  it("is off without a 32-byte secret", async () => {
    expect(await vaultFrom(undefined)).toBeNull();
    expect(await vaultFrom("too-short")).toBeNull();
  });
});
