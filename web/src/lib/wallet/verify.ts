// Server side of wallet proofs (DEC-0060), used by functions/api/wallet/verify.ts and its tests.
// Checks that a signature over a Parity wallet message came from the named wallet:
//   Ethereum: personal_sign (EIP-191) over the EIP-4361 text, secp256k1, address recovered
//             from the signature and compared.
//   Solana:   ed25519 signature over the same text's bytes, against the base58 public key.
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58Decode, checkAddress, type Chain } from "./address";
import { messageProblem } from "./siwe";

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function fromHex(s: string): Uint8Array | null {
  const t = s.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]*$/.test(t) || t.length % 2) return null;
  return Uint8Array.from(t.match(/../g) ?? [], (h) => parseInt(h, 16));
}

function fromBase64(s: string): Uint8Array | null {
  try { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); } catch { return null; }
}

/** The address (lower case 0x hex) that signed `message` with personal_sign, or null. */
export function recoverEthereumAddress(message: string, signature: string): string | null {
  const sig = fromHex(signature);
  if (!sig || sig.length !== 65) return null;
  const v = sig[64];
  const recovery = v >= 27 ? v - 27 : v;
  if (recovery !== 0 && recovery !== 1) return null;
  const body = enc.encode(message);
  const digest = keccak_256(new Uint8Array([...enc.encode(`\x19Ethereum Signed Message:\n${body.length}`), ...body]));
  try {
    const point = secp256k1.Signature.fromBytes(sig.slice(0, 64), "compact").addRecoveryBit(recovery).recoverPublicKey(digest);
    const pub = point.toBytes(false).slice(1);
    return `0x${hex(keccak_256(pub).slice(-20))}`;
  } catch {
    return null;
  }
}

/** True when `signature` (base64 or base58, 64 bytes) is the Solana wallet's signature of `message`. */
export function verifySolana(message: string, signature: string, address: string): boolean {
  const key = base58Decode(address);
  const sig = (signature.length === 88 && signature.endsWith("==") ? fromBase64(signature) : null) ?? base58Decode(signature) ?? fromBase64(signature);
  if (!key || key.length !== 32 || !sig || sig.length !== 64) return false;
  try { return ed25519.verify(sig, enc.encode(message), key); } catch { return false; }
}

export interface ProofInput { chain: Chain; address: string; message: string; signature: string }

export type ProofResult = { ok: true; chain: Chain; address: string } | { ok: false; status: number; error: string };

/** Checks a whole proof for one signed-in person on one site. Pure: no network, no storage. */
export function checkProof(body: unknown, ctx: { userId: string; host: string; origin: string; now?: number }): ProofResult {
  const b = (body ?? {}) as Partial<Record<keyof ProofInput, unknown>>;
  const chain = b.chain === "ethereum" || b.chain === "solana" ? b.chain : null;
  if (!chain) return { ok: false, status: 400, error: "Unknown chain" };
  if (typeof b.address !== "string" || typeof b.message !== "string" || typeof b.signature !== "string") return { ok: false, status: 400, error: "Send address, message and signature" };
  if (b.signature.length > 300 || b.message.length > 2000) return { ok: false, status: 400, error: "Too long" };
  const addr = checkAddress(chain, b.address);
  if (!addr.ok) return { ok: false, status: 400, error: "Not a valid address" };
  const problem = messageProblem(b.message, { chain, address: b.address, host: ctx.host, origin: ctx.origin, userId: ctx.userId, now: ctx.now });
  if (problem) return { ok: false, status: 400, error: problem };
  const good = chain === "ethereum" ? recoverEthereumAddress(b.message, b.signature) === addr.address : verifySolana(b.message, b.signature, addr.address);
  if (!good) return { ok: false, status: 400, error: "The signature does not match this wallet." };
  return { ok: true, chain, address: addr.address };
}
