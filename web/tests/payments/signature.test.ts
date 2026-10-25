// The Stripe webhook signature check (DEC-0045). No network: signatures are made locally
// with a made-up secret.
import { describe, expect, it } from "vitest";
import { hmacSha256Hex, parseSignatureHeader, signForTest, timingSafeEqualHex, verifyStripeSignature } from "../../src/lib/payments/stripeSignature";

const SECRET = "whsec_testsecretfortheunittestsonly";
const BODY = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", livemode: false, data: { object: {} } });
const NOW = 1_800_000_000;

describe("Stripe signature", () => {
  it("matches a known HMAC-SHA256 vector", async () => {
    // RFC 4231 test case 2.
    expect(await hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("accepts a correctly signed, fresh body", async () => {
    const header = await signForTest(BODY, SECRET, NOW - 10);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW)).toEqual({ ok: true, timestamp: NOW - 10 });
  });

  it("accepts when any of several v1 signatures matches (secret roll)", async () => {
    const good = await signForTest(BODY, SECRET, NOW);
    const v1 = good.split("v1=")[1];
    const header = `t=${NOW},v1=${"0".repeat(64)},v1=${v1},v0=abc`;
    expect((await verifyStripeSignature(BODY, header, SECRET, NOW)).ok).toBe(true);
  });

  it("rejects a changed body", async () => {
    const header = await signForTest(BODY, SECRET, NOW);
    const r = await verifyStripeSignature(BODY.replace("updated", "deleted"), header, SECRET, NOW);
    expect(r).toEqual({ ok: false, reason: "signature mismatch" });
  });

  it("rejects the wrong secret", async () => {
    const header = await signForTest(BODY, "whsec_someoneelse", NOW);
    expect((await verifyStripeSignature(BODY, header, SECRET, NOW)).ok).toBe(false);
  });

  it("rejects an old timestamp (replay) and one from the future", async () => {
    const old = await signForTest(BODY, SECRET, NOW - 301);
    expect(await verifyStripeSignature(BODY, old, SECRET, NOW)).toEqual({ ok: false, reason: "timestamp outside tolerance" });
    const future = await signForTest(BODY, SECRET, NOW + 301);
    expect((await verifyStripeSignature(BODY, future, SECRET, NOW)).ok).toBe(false);
  });

  it("rejects missing or malformed headers", async () => {
    expect(await verifyStripeSignature(BODY, null, SECRET, NOW)).toEqual({ ok: false, reason: "missing timestamp" });
    expect(await verifyStripeSignature(BODY, `t=${NOW}`, SECRET, NOW)).toEqual({ ok: false, reason: "missing v1 signature" });
    expect(await verifyStripeSignature(BODY, `t=${NOW},v1=nothex`, SECRET, NOW)).toEqual({ ok: false, reason: "missing v1 signature" });
    expect(await verifyStripeSignature(BODY, await signForTest(BODY, SECRET, NOW), "", NOW)).toEqual({ ok: false, reason: "no signing secret configured" });
  });

  it("parses headers and compares hex safely", () => {
    expect(parseSignatureHeader(` t=12 , v1=${"a".repeat(64)}, v0=zz`)).toEqual({ t: 12, v1: ["a".repeat(64)] });
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abc")).toBe(false);
  });
});
