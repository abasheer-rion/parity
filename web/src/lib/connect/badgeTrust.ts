// Which trust level a published badge shows (DEC-0091): self-reported, unless it carries a
// broker proof that our public key checks and every number on it matches. The functions that
// draw a badge (image, card, share image, page head) check with the key from their own
// environment; the badge page in the browser fetches the published keys from /api/connect/keys.
import type { PublicBadge } from "../verify/badge";
import { oldKeys, publicKeyOf, seedFrom, trustOf, type PublicKey, type Trust } from "./attest";

export interface KeyEnv { BROKER_RECORD_SIGNING_KEY?: string; BROKER_RECORD_OLD_PUBLIC_KEYS?: string }

let memo: { from: string; keys: PublicKey[] } | null = null;

/** The keys this server trusts: its own signing key's public half, then any old ones. */
export async function serverKeys(env: KeyEnv): Promise<PublicKey[]> {
  const from = `${env.BROKER_RECORD_SIGNING_KEY ?? ""}|${env.BROKER_RECORD_OLD_PUBLIC_KEYS ?? ""}`;
  if (memo?.from === from) return memo.keys;
  const seed = seedFrom(env.BROKER_RECORD_SIGNING_KEY);
  const keys = [...(seed ? [await publicKeyOf(seed)] : []), ...(await oldKeys(env.BROKER_RECORD_OLD_PUBLIC_KEYS))];
  memo = { from, keys };
  return keys;
}

const SELF: Trust = { level: "self_reported" };

/** A badge's trust on the server. A missing, withdrawn or proof-less badge is self-reported. */
export async function badgeTrust(b: PublicBadge | null, env: KeyEnv): Promise<Trust> {
  if (!b || b.withdrawn_at || !b.attestation) return SELF;
  return trustOf(b, await serverKeys(env));
}

let published: Promise<PublicKey[]> | null = null;

/** The published keys, fetched once per page. */
export function publishedKeys(fetcher: typeof fetch = fetch): Promise<PublicKey[]> {
  published ??= fetcher("/api/connect/keys", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : { keys: [] }))
    .then((j: { keys?: { kid?: unknown; x?: unknown }[] }) => (j.keys ?? []).filter((k): k is PublicKey => typeof k.kid === "string" && typeof k.x === "string").map((k) => ({ kid: k.kid, x: k.x })))
    .catch(() => { published = null; return []; });
  return published;
}

/** A badge's trust in the browser, checked against the published keys. */
export async function browserTrust(b: PublicBadge | null, fetcher?: typeof fetch): Promise<Trust> {
  if (!b || b.withdrawn_at || !b.attestation) return SELF;
  return trustOf(b, await publishedKeys(fetcher));
}
