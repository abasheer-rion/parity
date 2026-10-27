// API keys for the Parity public API (DEC-0071). A key looks like
//
//   pk_test_<43 base62 characters><6 base62 characters>
//
// The 43 characters are 32 random bytes (256 bits) written in base62. The last 6 are a CRC32
// checksum of everything before them, also in base62, so a secret scanner (GitHub, GitLab)
// can tell a real key from look-alike text without asking us, and we can turn away a typo
// without a database read. "pk_test_" keys are the only kind issued until live billing;
// "pk_live_" is reserved for then.
//
// We never store a key. We store HMAC-SHA-256(key, pepper) as hex, plus the prefix and the
// last 4 characters so a person can tell their keys apart. The pepper is a server secret
// (PARITY_API_KEY_PEPPER), so a copy of the database alone cannot be used to test guesses.
// Pure functions on Web Crypto: they run in Pages Functions, in the browser and in tests.

export const PREFIXES = ["pk_test_", "pk_live_"] as const;
export type Prefix = (typeof PREFIXES)[number];

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 62^43 > 2^256, so 32 bytes always fit in 43 characters. */
export const BODY_LEN = 43;
/** 62^6 > 2^32, so a CRC32 always fits in 6 characters. */
export const CHECK_LEN = 6;
export const KEY_LEN = 8 + BODY_LEN + CHECK_LEN;
const SHAPE = /^pk_(test|live)_[0-9A-Za-z]{49}$/;
/** The shortest pepper we accept: 32 bytes written as hex or base64 is longer than this. */
export const MIN_PEPPER = 32;

export function base62(n: bigint, width: number): string {
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  if (out.length > width) throw new Error("number too large for the width");
  return out.padStart(width, "0");
}

let CRC_TABLE: Uint32Array | null = null;
export function crc32(text: string): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of new TextEncoder().encode(text)) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const checksum = (head: string) => base62(BigInt(crc32(head)), CHECK_LEN);

/** A new key from 32 bytes of the platform's secure random source. */
export function generateKey(prefix: Prefix = "pk_test_", random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(32);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const head = prefix + base62(n, BODY_LEN);
  return head + checksum(head);
}

/** True when the text has a key's shape and its checksum matches. Says nothing about
 *  whether the key exists: that needs the database. */
export function wellFormed(key: string): boolean {
  if (typeof key !== "string" || key.length !== KEY_LEN || !SHAPE.test(key)) return false;
  return constantTimeEqual(checksum(key.slice(0, -CHECK_LEN)), key.slice(-CHECK_LEN));
}

export const prefixOf = (key: string): Prefix => (key.startsWith("pk_live_") ? "pk_live_" : "pk_test_");
export const last4 = (key: string): string => key.slice(-4);

/** HMAC-SHA-256(key, pepper), lower-case hex. This is the only form of a key we keep. */
export async function hashKey(key: string, pepper: string): Promise<string> {
  if (!pepper || pepper.length < MIN_PEPPER) throw new Error("pepper missing or too short");
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(key)));
  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in time that depends only on their lengths, not on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0;
}

/** The key in an "Authorization: Bearer <key>" header, or null. */
export function bearer(header: string | null): string | null {
  const m = /^Bearer[ ]+([^\s]+)\s*$/i.exec(header ?? "");
  return m ? m[1] : null;
}
