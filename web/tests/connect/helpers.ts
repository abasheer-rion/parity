// Shared pieces for the broker connector tests (DEC-0091): recorded venue answers from
// tests/fixtures/connect (see SOURCES.md there), a fetch that serves them by address and
// remembers every request, and made-up keys. Nothing here is a real credential.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { p256 } from "@noble/curves/nist.js";
import { toB64, toB64url } from "../../src/lib/connect/bytes";
import type { VenueCtx } from "../../src/lib/connect/types";

const DIR = resolve(import.meta.dirname, "../fixtures/connect");
export const fx = (name: string) => readFileSync(resolve(DIR, name), "utf8");
export const realFx = (name: string) => readFileSync(resolve(import.meta.dirname, "../fixtures/verify", name), "utf8");

export interface Seen { url: string; method: string; headers: Record<string, string>; body: string }
type Answer = Response | ((req: Seen) => Response | Promise<Response>);

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
export const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

/** A fetch that answers from a list of [address pattern, answer], first match wins, in order. */
export function recorded(routes: [RegExp, Answer | Answer[]][]) {
  const seen: Seen[] = [];
  const queues = routes.map(([re, a]) => [re, Array.isArray(a) ? [...a] : a] as const);
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v; });
    const s: Seen = { url, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : "" };
    seen.push(s);
    for (const [re, a] of queues) {
      if (!re.test(url)) continue;
      const next = Array.isArray(a) ? (a.length > 1 ? a.shift()! : a[0]) : a;
      const res = typeof next === "function" ? await next(s) : next;
      return res.clone();
    }
    return new Response("no recorded answer for this address", { status: 599 });
  }) as typeof fetch;
  return { fetch: f, seen };
}

/** A context with a fixed clock (3 February 2026) and no real waiting. */
export function ctx(f: typeof fetch, now = Date.parse("2026-02-03T12:00:00Z")): VenueCtx & { slept: number[] } {
  const slept: number[] = [];
  let t = now;
  return { fetch: f, now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; }, deadline: now + 25_000_000, requests: { n: 0 }, slept };
}

/** A made-up P-256 key as Coinbase's SEC1 PEM, with its public key for checking signatures. */
export function testEcKey(seed = 7) {
  const secret = new Uint8Array(32).map((_, i) => (i * 31 + seed) % 251 + 1);
  const pub = p256.getPublicKey(secret, false);
  const der = new Uint8Array([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20, ...secret, 0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0xa1, 0x44, 0x03, 0x42, 0x00, ...pub]);
  const body = toB64(der).match(/.{1,64}/g)!.join("\n");
  return { pem: `-----BEGIN EC PRIVATE KEY-----\n${body}\n-----END EC PRIVATE KEY-----\n`, secret, pub };
}

/** Kraken's own documented example secret (docs.kraken.com, REST authentication). Public, not a key to any account. */
export const KRAKEN_DOC_SECRET = "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg==";

/** A made-up 32-byte secret as base64url, for the signing and sealing keys in tests. */
export const testSecret = (n: number) => toB64url(new Uint8Array(32).map((_, i) => (i * 13 + n) % 256));
