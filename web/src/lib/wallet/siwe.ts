// Proving a wallet is yours by signing a message (DEC-0057). Ethereum uses Sign-In With
// Ethereum (EIP-4361); Solana uses the same text format, as Phantom and Solflare show it.
// Signing a message moves no funds and gives no access to them.
//
// The message names this site, the wallet, the Parity account (as a resource line) and a
// 10 minute window. The server (functions/api/wallet/verify.ts) checks all of that and the
// signature before it marks the wallet verified, so a signature cannot be reused for another
// account, another site, or after the window.
import type { Chain } from "./address";

export const WINDOW_MS = 10 * 60_000;
const STATEMENT = "Prove this wallet is yours for your Parity account. Read only: this does not move funds or give access to them.";

export interface SiweFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  resources: string[];
}

export function newNonce(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

/** The text the wallet app shows and signs. */
export function buildMessage(o: { chain: Chain; domain: string; origin: string; address: string; userId: string; nonce: string; now?: Date }): string {
  const now = o.now ?? new Date();
  const kind = o.chain === "ethereum" ? "Ethereum" : "Solana";
  return [
    `${o.domain} wants you to sign in with your ${kind} account:`,
    o.address,
    "",
    STATEMENT,
    "",
    `URI: ${o.origin}`,
    "Version: 1",
    `Chain ID: ${o.chain === "ethereum" ? "1" : "mainnet"}`,
    `Nonce: ${o.nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${new Date(now.getTime() + WINDOW_MS).toISOString()}`,
    "Resources:",
    `- parity:user:${o.userId}`,
  ].join("\n");
}

const HEAD = /^(\S+) wants you to sign in with your (Ethereum|Solana) account:$/;

/** Reads the fields back out of a message, or null when it is not in this format. */
export function parseMessage(text: string): (SiweFields & { chain: Chain }) | null {
  if (text.length > 2000) return null;
  const lines = text.split("\n");
  const head = (lines[0] ?? "").match(HEAD);
  if (!head || lines[2] !== "" || lines[4] !== "") return null;
  const field = (name: string) => {
    const l = lines.find((x) => x.startsWith(`${name}: `));
    return l ? l.slice(name.length + 2) : "";
  };
  const at = lines.indexOf("Resources:");
  const resources = at < 0 ? [] : lines.slice(at + 1).filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return {
    chain: head[2] === "Ethereum" ? "ethereum" : "solana",
    domain: head[1],
    address: lines[1] ?? "",
    statement: lines[3] ?? "",
    uri: field("URI"),
    version: field("Version"),
    chainId: field("Chain ID"),
    nonce: field("Nonce"),
    issuedAt: field("Issued At"),
    expirationTime: field("Expiration Time"),
    resources,
  };
}

/** Why a signed message does not fit this request, or null when it does. Signature not checked here. */
export function messageProblem(text: string, want: { chain: Chain; address: string; host: string; origin: string; userId: string; now?: number }): string | null {
  const m = parseMessage(text);
  if (!m) return "The message is not in the expected format.";
  const now = want.now ?? Date.now();
  if (m.chain !== want.chain) return "The message is for another chain.";
  if (m.domain !== want.host) return "The message is for another site.";
  if (m.uri !== want.origin) return "The message is for another address.";
  if (m.version !== "1") return "Unknown message version.";
  if (m.chainId !== (want.chain === "ethereum" ? "1" : "mainnet")) return "The message names another network.";
  if (m.statement !== STATEMENT) return "The message text was changed.";
  const same = want.chain === "ethereum" ? m.address.toLowerCase() === want.address.toLowerCase() : m.address === want.address;
  if (!same) return "The message names another wallet.";
  if (!/^[A-Za-z0-9]{8,64}$/.test(m.nonce)) return "The message has no valid nonce.";
  if (!m.resources.includes(`parity:user:${want.userId}`)) return "The message was signed for another Parity account.";
  const issued = Date.parse(m.issuedAt), expires = Date.parse(m.expirationTime);
  if (!Number.isFinite(issued) || !Number.isFinite(expires)) return "The message has no valid times.";
  if (issued > now + 60_000) return "The message is dated in the future.";
  if (now - issued > WINDOW_MS || now > expires || expires - issued > WINDOW_MS) return "The message is too old. Sign a new one.";
  return null;
}
