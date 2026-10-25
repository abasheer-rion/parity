// Who is calling a payments endpoint (DEC-0045). The same check as the site middleware:
// the Supabase access token's signature against the project's public keys, its issuer,
// audience and expiry. No secret is needed. Imported by Pages Functions.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { DEFAULT_SUPABASE_URL } from "./guard";

let jwks: JWTVerifyGetKey | null = null;

export interface Caller { userId: string; email: string | null }

export function bearer(header: string | null): string | null {
  const m = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(header ?? "");
  return m ? m[1] : null;
}

export async function callerFrom(request: Request, supabaseUrl = DEFAULT_SUPABASE_URL, keys?: JWTVerifyGetKey): Promise<Caller | null> {
  const token = bearer(request.headers.get("Authorization"));
  if (!token) return null;
  const issuer = `${supabaseUrl}/auth/v1`;
  try {
    const getKey = keys ?? (jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)));
    const { payload } = await jwtVerify(token, getKey, { issuer, audience: "authenticated" });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}
