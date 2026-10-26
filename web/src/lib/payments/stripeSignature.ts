// Stripe webhook signature check (DEC-0046), with Web Crypto so it runs in Pages Functions
// without the Stripe SDK. Stripe signs `${timestamp}.${raw body}` with HMAC-SHA256 using
// the endpoint's signing secret, and sends `Stripe-Signature: t=<unix seconds>,v1=<hex>`,
// possibly with several v1 values while a secret is being rolled
// (https://docs.stripe.com/webhooks#verify-manually). We accept the event only if one v1
// matches and the timestamp is within the tolerance, which stops replays of old events.

export const DEFAULT_TOLERANCE_S = 300;

export type SignatureResult = { ok: true; timestamp: number } | { ok: false; reason: string };

export function parseSignatureHeader(header: string | null | undefined): { t: number | null; v1: string[] } {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of (header ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d{1,12}$/.test(v)) t = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v)) v1.push(v.toLowerCase());
  }
  return { t, v1 };
}

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two equal-length hex strings without stopping at the first difference. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a webhook delivery. `rawBody` must be the exact bytes Stripe sent, as text,
 *  before any JSON parsing. `nowS` is the current Unix time in seconds. */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowS: number = Math.floor(Date.now() / 1000),
  toleranceS: number = DEFAULT_TOLERANCE_S,
): Promise<SignatureResult> {
  if (!secret) return { ok: false, reason: "no signing secret configured" };
  const { t, v1 } = parseSignatureHeader(header);
  if (t === null) return { ok: false, reason: "missing timestamp" };
  if (v1.length === 0) return { ok: false, reason: "missing v1 signature" };
  if (Math.abs(nowS - t) > toleranceS) return { ok: false, reason: "timestamp outside tolerance" };
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  // Check every candidate so the time taken does not depend on which one matched.
  let match = false;
  for (const s of v1) match = timingSafeEqualHex(expected, s) || match;
  return match ? { ok: true, timestamp: t } : { ok: false, reason: "signature mismatch" };
}

/** Builds a valid header for a body, for tests and local replays only. */
export async function signForTest(rawBody: string, secret: string, t: number): Promise<string> {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${rawBody}`)}`;
}
