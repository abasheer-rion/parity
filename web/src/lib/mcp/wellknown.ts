// The /.well-known/ addresses an AI app reads before it signs in to Parity's MCP server
// (DEC-0051). Served by the site middleware (functions/_middleware.ts), which hands over any
// path this answers. Imported by Pages Functions: no import.meta.env here.
//
//   /.well-known/oauth-protected-resource/mcp   Protected Resource Metadata (RFC 9728) for
//   /.well-known/oauth-protected-resource       /mcp, naming Supabase Auth as the sign-in server.
//   /.well-known/oauth-authorization-server     A copy of Supabase's own metadata, for older apps
//                                               (MCP 2025-03-26) that look for it on our host.
import { AS_METADATA_URL, protectedResourceMetadata } from "./auth";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
  "X-Robots-Tag": "noindex",
};

export const WELL_KNOWN = /^\/\.well-known\/(oauth-protected-resource(\/mcp)?|oauth-authorization-server)\/?$/;

export async function wellKnown(request: Request, f: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(WELL_KNOWN);
  if (!m) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "MCP-Protocol-Version" } });
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
  if (m[1].startsWith("oauth-protected-resource")) {
    return new Response(JSON.stringify(protectedResourceMetadata(url.origin)), { status: 200, headers: HEADERS });
  }
  try {
    const res = await f(AS_METADATA_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return new Response(JSON.stringify({ error: "The sign-in server's metadata is not available." }), { status: 502, headers: { ...HEADERS, "Cache-Control": "no-store" } });
    return new Response(await res.text(), { status: 200, headers: HEADERS });
  } catch {
    return new Response(JSON.stringify({ error: "The sign-in server's metadata is not available." }), { status: 502, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }
}
