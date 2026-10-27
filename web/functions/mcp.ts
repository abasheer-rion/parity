// /mcp: Parity's hosted MCP server (DEC-0051), so people can add Parity to Claude, ChatGPT,
// Gemini CLI, Cursor, VS Code and other AI apps that speak the Model Context Protocol. The
// app signs the person in through Supabase Auth's OAuth server and calls our tools as that
// person. The protocol and tools are in src/lib/mcp/; this file only wires in the Pages
// environment:
//   MCP_ENABLED        "off" switches the endpoint off (404). Anything else, or unset, is on.
//   MCP_WRITE_ENABLED  only "on" lists and allows the two tools that change anything, and
//                      even then only for apps the person allowed (ai_grants). Unset today.
//   MCP_EXTRA_ORIGINS  comma-separated browser origins allowed besides our own domains.
// No secret is needed: tokens are checked against Supabase's public keys.
import { verifyToken } from "../src/lib/mcp/auth";
import { handleMcp } from "../src/lib/mcp/server";
import { supabaseAudit, supabaseDb } from "../src/lib/mcp/supabase";
import type { Data } from "../src/lib/mcp/tools";
import { SITE_DOMAINS } from "../src/lib/meta";

interface Env {
  MCP_ENABLED?: string;
  MCP_WRITE_ENABLED?: string;
  MCP_EXTRA_ORIGINS?: string;
  ASSETS: { fetch: (input: Request | string) => Promise<Response> };
}

interface Context { request: Request; env: Env }

// Parsed site files, kept for a minute in this worker so a run of tool calls does not parse
// the same large file each time. The files only change when the site is deployed.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 60_000;

export function assetData(assets: Env["ASSETS"], base: string, now: () => number = Date.now): Data {
  return {
    async json<T>(path: string): Promise<T | null> {
      if (!path.startsWith("/data/") || path.includes("..")) throw new Error("bad data path");
      const hit = cache.get(path);
      if (hit && now() - hit.at < TTL) return hit.value as T;
      const res = await assets.fetch(new Request(new URL(path, base)));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${path} answered ${res.status}`);
      // A missing file can come back as the site's HTML page instead of a 404.
      if ((res.headers.get("content-type") ?? "").includes("text/html")) return null;
      const value = (await res.json()) as T;
      if (cache.size > 12) cache.clear();
      cache.set(path, { at: now(), value });
      return value;
    },
  };
}

export const onRequest = async ({ request, env }: Context): Promise<Response> =>
  handleMcp(request, {
    verify: (token) => verifyToken(token),
    data: assetData(env.ASSETS, request.url),
    db: (caller) => supabaseDb(caller),
    audit: (db) => supabaseAudit(db),
    enabled: env.MCP_ENABLED !== "off",
    writeEnabled: env.MCP_WRITE_ENABLED === "on",
    siteDomain: SITE_DOMAINS, // paritytrading.app, and endyland.com while it redirects (DEC-0069)
    extraOrigins: (env.MCP_EXTRA_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  });
