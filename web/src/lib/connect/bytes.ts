// Small byte helpers for the broker connectors (DEC-0091): base64, base64url, hex, SHA-256 and
// HMAC through WebCrypto, which both Cloudflare's Workers and the browser have. No secret is
// ever turned into text here except to sign a request; nothing in this file logs.

const enc = new TextEncoder();

export const utf8 = (s: string): Uint8Array => enc.encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

/** WebCrypto wants an ArrayBuffer-backed view; copy so a shared or offset buffer is never passed. */
export const ab = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer;

export function toB64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("not base64");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const toB64url = (b: Uint8Array): string => toB64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function fromB64url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : s.length % 4 === 1 ? null : "";
  if (pad == null) throw new Error("not base64url");
  return fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", ab(typeof data === "string" ? utf8(data) : data)));
}

export const sha256Hex = async (data: Uint8Array | string): Promise<string> => toHex(await sha256(data));

export async function hmac(hash: "SHA-256" | "SHA-512", key: Uint8Array, data: Uint8Array | string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ab(key), { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, ab(typeof data === "string" ? utf8(data) : data)));
}

/** HKDF-SHA-256: a key for one purpose from a secret, so one secret never serves two jobs directly. */
export async function hkdf(secret: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ab(secret), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new ArrayBuffer(32), info: ab(utf8(info)) }, k, length * 8);
  return new Uint8Array(bits);
}

export const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** Compares two strings in time that does not depend on where they differ. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * JSON with keys in sorted order and no spaces, so the same value always gives the same text
 * (and the same hash), whatever order a database or a browser hands the keys back in.
 * Numbers go through JSON.stringify, which writes the shortest text that reads back the same.
 */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") {
    if (typeof v === "number" && !Number.isFinite(v)) return "null";
    return JSON.stringify(v) ?? "null";
  }
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canonicalJson(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
