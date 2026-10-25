// Read-only crypto wallets (DEC-0060): checking a public address before it is saved, and
// refusing anything that looks like a secret. Parity stores only the public address, the
// chain and when a signed message proved the wallet is the person's. It never asks for a seed
// phrase or private key, and this file makes sure one pasted by mistake goes nowhere.
import { keccak_256 } from "@noble/hashes/sha3.js";

export type Chain = "ethereum" | "solana";

export const CHAINS: { id: Chain; label: string; hint: string }[] = [
  { id: "ethereum", label: "Ethereum", hint: "Also Base, Arbitrum, Optimism and other networks that use the same 0x address" },
  { id: "solana", label: "Solana", hint: "A base58 address, 32 to 44 characters" },
];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Bitcoin alphabet) to bytes, or null for a character outside the alphabet. */
export function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) return null;
    n = n * 58n + BigInt(v);
  }
  const out: number[] = [];
  while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c === "1") out.unshift(0); else break; }
  return Uint8Array.from(out);
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = "1" + out; else break; }
  return out;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** The EIP-55 mixed-case form of an Ethereum address (0x plus 40 hex characters). */
export function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase().replace(/^0x/, "");
  const hash = hex(keccak_256(new TextEncoder().encode(lower)));
  let out = "0x";
  for (let i = 0; i < lower.length; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

/**
 * True when the text looks like a seed phrase or a private key: 12 or more words, a 64
 * character hex string, or a long base58 string (a Solana secret key is 64 bytes, about 88
 * characters). Used to refuse it before it is sent or stored anywhere.
 */
export function looksSecret(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter((w) => /^[a-z]+$/i.test(w));
  if (words.length >= 12) return true;
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(t)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(t)) return true;
  if (/^\[\s*\d+(\s*,\s*\d+){31,}\s*\]$/.test(t)) return true;
  return false;
}

export type AddressCheck = { ok: true; address: string } | { ok: false; problem: string };

/** Checks a typed public address. Ethereum comes back in lower case, as it is stored. */
export function checkAddress(chain: Chain, raw: string): AddressCheck {
  const t = raw.trim();
  if (looksSecret(t)) return { ok: false, problem: "That looks like a seed phrase or private key. Never share it with anyone, Parity included. Clear the box and paste the public address instead." };
  if (!t) return { ok: false, problem: "Paste the wallet's public address." };
  if (chain === "ethereum") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return { ok: false, problem: "An Ethereum address is 0x followed by 40 letters and digits (0 to 9, a to f)." };
    const mixed = /[a-f]/.test(t) && /[A-F]/.test(t);
    if (mixed && toChecksumAddress(t) !== t) return { ok: false, problem: "The capital letters in this address do not match its checksum, so a character may be wrong. Copy it again from your wallet." };
    return { ok: true, address: t.toLowerCase() };
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return { ok: false, problem: "A Solana address is 32 to 44 characters, without 0, O, I or l." };
  const bytes = base58Decode(t);
  if (!bytes || bytes.length !== 32) return { ok: false, problem: "This is not a valid Solana address. Copy it again from your wallet." };
  return { ok: true, address: t };
}

/** A short form for lists: 0x1234...abcd. */
export function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}
