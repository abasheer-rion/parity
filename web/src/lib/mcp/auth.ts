// Who is calling the hosted MCP server (DEC-0051), and how an AI app finds out where to sign
// in. Parity does not run its own OAuth server: Supabase Auth's OAuth 2.1 server is the
// authorization server, and its access tokens are ordinary Supabase user tokens with one extra
// claim, client_id, naming the app. So the same public-key check as the site middleware
// proves who the person is, and every database read with the token goes through the person's
// own row rules. No secret is needed. Imported by Pages Functions: no import.meta.env here.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
/** Public by design: the same key the browser uses (src/auth/config.ts). */
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_12CQmnbBgVYpkflKhwHD-A_2Xby8b-x";
export const ISSUER = `${SUPABASE_URL}/auth/v1`;
/** Supabase's OAuth server publishes its metadata here (RFC 8414, path form). */
export const AS_METADATA_URL = `${SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`;
/** The only scopes Supabase's OAuth server issues. Custom scopes are not supported there, so
 *  Parity keeps "may this app make changes" in its own table (ai_grants), set by the person. */
export const SCOPES = ["openid", "email", "profile"];
export const MCP_PATH = "/mcp";

export interface McpCaller {
  userId: string;
  email: string | null;
  /** The OAuth client id of the AI app, or null for Parity's own browser session. */
  clientId: string | null;
  /** The bearer token itself, passed on to Supabase so its row rules apply. */
  token: string;
}

let jwks: JWTVerifyGetKey | null = null;

export function bearer(header: string | null): string | null {
  const m = (header ?? "").trim().match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/);
  return m ? m[1] : null;
}

/** The person behind a Supabase access token, or null when it is missing, forged or expired. */
export async function verifyToken(token: string, keys?: JWTVerifyGetKey): Promise<McpCaller | null> {
  try {
    const getKey = keys ?? (jwks ??= createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`)));
    const { payload } = await jwtVerify(token, getKey, { issuer: ISSUER, audience: "authenticated", clockTolerance: 30 });
    if (typeof payload.sub !== "string" || payload.role !== "authenticated") return null;
    const clientId = typeof payload.client_id === "string" && payload.client_id ? payload.client_id : null;
    return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : null, clientId, token };
  } catch {
    return null;
  }
}

export const resourceUrl = (origin: string) => `${origin}${MCP_PATH}`;
export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`;

/** Protected Resource Metadata (RFC 9728): tells an AI app which server signs people in. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: resourceUrl(origin),
    authorization_servers: [ISSUER],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Parity",
    resource_documentation: `${origin}/connect/`,
  };
}

/** The WWW-Authenticate value on a 401, pointing the app at the metadata above. */
export function challenge(origin: string, error?: "invalid_token"): string {
  const parts = [`resource_metadata="${resourceMetadataUrl(origin)}"`, `scope="${SCOPES.join(" ")}"`];
  if (error) parts.push(`error="${error}"`, `error_description="The access token is missing, expired or not valid"`);
  return `Bearer ${parts.join(", ")}`;
}

/** Origins that may call /mcp from a browser. Server-side apps (Claude, ChatGPT) send no
 *  Origin at all. The spec requires refusing a present but unexpected Origin. */
export function originAllowed(origin: string | null, siteDomain: string, extra: string[] = []): boolean {
  if (!origin) return true;
  let u: URL;
  try { u = new URL(origin); } catch { return false; }
  if (extra.includes(u.origin)) return true;
  const host = u.hostname;
  if (u.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) return true;
  if (u.protocol !== "https:") return false;
  return host === siteDomain || host.endsWith(`.${siteDomain}`) || host === "parity-research.pages.dev" || host.endsWith(".parity-research.pages.dev");
}
