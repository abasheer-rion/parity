// POST /api/wallet/verify {"chain", "address", "message", "signature"}: checks that a signed
// message proves the signed-in person holds this wallet (DEC-0060), then saves the public
// address, the chain and the time. Nothing else is stored. The browser can save an address by
// itself but can never set the verification time; only this endpoint can, with the service
// role key from the Pages environment (never committed, never sent to the browser).
// Without that key it answers 503 and the page says verification is not switched on yet.
import { callerFrom } from "../../../src/lib/payments/auth";
import { DEFAULT_SUPABASE_URL, json } from "../../../src/lib/payments/guard";
import { checkProof } from "../../../src/lib/wallet/verify";

function appToken(request: Request): boolean {
  try {
    const part = (request.headers.get("Authorization") ?? "").split(".")[1] ?? "";
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { client_id?: unknown };
    return typeof claims.client_id === "string" && claims.client_id !== "";
  } catch {
    return true;
  }
}

interface Env { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }
interface Context { request: Request; env: Env }

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "POST only" });
  const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const caller = await callerFrom(request, supabaseUrl);
  if (!caller) return json(401, { error: "Sign in first" });
  // A token issued to a connected AI app (it carries client_id) may read but never write
  // (DEC-0051), so it cannot save a wallet here either. The token was verified just above.
  if (appToken(request)) return json(403, { error: "Connected apps cannot add wallets" });
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json(503, { error: "Wallet verification is not switched on yet" });
  const raw = await request.text();
  if (raw.length > 8 * 1024) return json(413, { error: "Too large" });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "Send JSON" }); }
  const url = new URL(request.url);
  const proof = checkProof(body, { userId: caller.userId, host: url.host, origin: url.origin });
  if (!proof.ok) return json(proof.status, { error: proof.error });
  const verifiedAt = new Date().toISOString();
  const res = await fetch(`${supabaseUrl}/rest/v1/crypto_wallets?on_conflict=user_id,chain,address`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id: caller.userId, chain: proof.chain, address: proof.address, verified_at: verifiedAt }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("wallet save failed", res.status, text.slice(0, 200));
    return json(res.status === 400 && text.includes("at most 10") ? 409 : 502, { error: text.includes("at most 10") ? "You already have 10 wallets" : "Could not save the wallet" });
  }
  return json(200, { chain: proof.chain, address: proof.address, verified_at: verifiedAt });
};
