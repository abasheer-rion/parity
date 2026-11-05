// The proof behind a broker-connected record (DEC-0091). When Parity reads trades from a
// broker itself, the server signs what it read and what it worked out: the venue, a one-way
// code for the account, when it fetched, the verdict and a fingerprint of every card. The
// signature is Ed25519 (a compact JWS, alg EdDSA), made with BROKER_RECORD_SIGNING_KEY, which
// only the server holds. The public key is published at /api/connect/keys, so anyone can
// check a badge without asking us: the badge page, the badge image and a prop firm's own code.
//
// A badge is shown as broker-connected only when the signature checks out AND every number on
// the badge matches the signed ones. Anything else is shown as self-reported, with a note.
// Pure apart from WebCrypto hashing, so the browser, the functions and the tests share it.
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJson, fromB64url, fromUtf8, hkdf, hmac, randomBytes, sha256, sha256Hex, toB64url, utf8 } from "./bytes";

export const RECORD_TYP = "parity-record+jws";

/** What the server signs. Short keys keep the badge row small; every one is listed here. */
export interface RecordClaims {
  v: 1;
  /** A random id for this proof, so it can be used for one badge only. */
  jti: string;
  /** When it was signed, in seconds. */
  iat: number;
  /** Which venue the trades came from (see venues.ts). */
  venue: string;
  /** "live" for a real account, "paper" for a broker's own practice account. */
  env: "live" | "paper";
  /** A one-way code for the account (accountCode below). Not the account number. */
  account: string;
  /** When Parity fetched the trades, ISO time in UTC. */
  fetched_at: string;
  /** The dates asked for, YYYY-MM-DD. */
  from: string;
  to: string;
  /** "real" for a live account, "demo" for a paper one. Set by the venue, not the person. */
  kind: "real" | "demo";
  /** Tries stated by the person (the luck check depends on it). */
  tries: number;
  /** True when the person typed a starting balance. */
  balance: boolean;
  trades: number | null;
  date_from: string | null;
  date_to: string | null;
  verdict: string;
  survives: number | null;
  method: string;
  /** SHA-256 of the badge's cards, as canonical JSON. */
  cards: string;
  /** SHA-256 of the trades file Parity read (the CSV the person can download). */
  file: string;
  /** SHA-256 of "<user id>:<jti>": ties the proof to the person who fetched it, without naming them. */
  own: string;
}

export interface PublicKey { kid: string; x: string }

/** The signing key from its secret: 32 bytes as base64url. Throws on anything else. */
export function seedFrom(secret: string | undefined): Uint8Array | null {
  if (!secret) return null;
  let b: Uint8Array;
  try { b = fromB64url(secret.trim()); } catch { return null; }
  return b.length === 32 ? b : null;
}

export async function publicKeyOf(seed: Uint8Array): Promise<PublicKey> {
  const pub = ed25519.getPublicKey(seed);
  return { x: toB64url(pub), kid: toB64url(await sha256(pub)).slice(0, 16) };
}

/** The published key list (a JWKS), the current key first, then any old ones still trusted. */
export function jwks(keys: PublicKey[]) {
  return { keys: keys.map((k) => ({ kty: "OKP", crv: "Ed25519", use: "sig", alg: "EdDSA", kid: k.kid, x: k.x })) };
}

/** Old public keys from BROKER_RECORD_OLD_PUBLIC_KEYS: a comma list of base64url keys. */
export async function oldKeys(list: string | undefined): Promise<PublicKey[]> {
  const out: PublicKey[] = [];
  for (const x of (list ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      const pub = fromB64url(x);
      if (pub.length === 32) out.push({ x, kid: toB64url(await sha256(pub)).slice(0, 16) });
    } catch { /* not a key: left out */ }
  }
  return out;
}

export async function signRecord(claims: RecordClaims, seed: Uint8Array): Promise<string> {
  const { kid } = await publicKeyOf(seed);
  const head = toB64url(utf8(JSON.stringify({ alg: "EdDSA", typ: RECORD_TYP, kid })));
  const body = toB64url(utf8(JSON.stringify(claims)));
  const sig = ed25519.sign(utf8(`${head}.${body}`), seed);
  return `${head}.${body}.${toB64url(sig)}`;
}

/** The claims inside a proof, read WITHOUT checking the signature. For display after a check only. */
export function peekClaims(jws: string): RecordClaims | null {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  try { return JSON.parse(fromUtf8(fromB64url(parts[1]))) as RecordClaims; } catch { return null; }
}

/** The claims when the signature is good under one of the keys, else null. */
export function verifyRecord(jws: string, keys: readonly PublicKey[]): RecordClaims | null {
  const parts = jws.split(".");
  if (parts.length !== 3 || jws.length > 8000) return null;
  try {
    const head = JSON.parse(fromUtf8(fromB64url(parts[0]))) as { alg?: string; typ?: string; kid?: string };
    if (head.alg !== "EdDSA" || head.typ !== RECORD_TYP) return null;
    const key = keys.find((k) => k.kid === head.kid);
    if (!key) return null;
    const ok = ed25519.verify(fromB64url(parts[2]), utf8(`${parts[0]}.${parts[1]}`), fromB64url(key.x));
    if (!ok) return null;
    const c = JSON.parse(fromUtf8(fromB64url(parts[1]))) as RecordClaims;
    return c && c.v === 1 && typeof c.jti === "string" ? c : null;
  } catch {
    return null;
  }
}

export const newJti = () => toB64url(randomBytes(16));

/** SHA-256 of the cards as canonical JSON: the same cards give the same hash after a database round trip. */
export const cardsHash = (cards: unknown) => sha256Hex(canonicalJson(cards));

export const ownHash = (userId: string, jti: string) => sha256Hex(`${userId}:${jti}`);

/**
 * A one-way code for an account: "acct_" and 16 characters. Keyed with a key derived from the
 * signing secret, so nobody can turn a code back into an account number by trying numbers,
 * and the same account always gets the same code, which lets a reader see that two badges (or
 * a withdrawn one) came from one account.
 */
export async function accountCode(seed: Uint8Array, venue: string, account: string): Promise<string> {
  const key = await hkdf(seed, "parity broker account code v1");
  return `acct_${toB64url(await hmac("SHA-256", key, `${venue}:${account.trim()}`)).slice(0, 16)}`;
}

// ------------------------------------------------------------------- what a badge shows

/** The facts a badge row carries that a proof must match. */
export interface BadgeFacts {
  attestation?: string | null;
  input_kind: string | null;
  stated_tries: number | null;
  trade_count: number | null;
  date_from: string | null;
  date_to: string | null;
  verdict: string | null;
  survives_tries: number | null;
  method_version: string | null;
  file_sha256: string | null;
  cards: unknown;
}

export type Trust =
  | { level: "self_reported"; why?: "no_proof" | "bad_signature" | "numbers_differ" }
  | { level: "broker_connected"; venue: string; env: "live" | "paper"; account: string; fetchedAt: string; balanceStated: boolean };

const day = (s: string | null) => (s ? s.slice(0, 10) : null);

/** Broker-connected only when the proof is signed by us and every number on the badge matches it. */
export async function trustOf(b: BadgeFacts, keys: readonly PublicKey[]): Promise<Trust> {
  if (!b.attestation) return { level: "self_reported", why: "no_proof" };
  const c = verifyRecord(b.attestation, keys);
  if (!c) return { level: "self_reported", why: "bad_signature" };
  const same = c.kind === b.input_kind && c.tries === b.stated_tries && c.trades === b.trade_count
    && c.date_from === day(b.date_from) && c.date_to === day(b.date_to) && c.verdict === b.verdict
    && c.survives === b.survives_tries && c.method === b.method_version && c.file === b.file_sha256
    && c.cards === (await cardsHash(b.cards));
  if (!same) return { level: "self_reported", why: "numbers_differ" };
  return { level: "broker_connected", venue: c.venue, env: c.env, account: c.account, fetchedAt: c.fetched_at, balanceStated: c.balance };
}
