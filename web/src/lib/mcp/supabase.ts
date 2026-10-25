// The person's rows in Supabase for the hosted MCP server (DEC-0049): plain REST calls with
// the person's own access token, so the database's row rules decide what comes back. The
// call log and limits (mcp_begin_call, mcp_end_call) run as the person too. Imported by
// Pages Functions: no import.meta.env here.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, type McpCaller } from "./auth";
import { ToolError, type Db } from "./tools";

export type Begin = { ok: true; id: number } | { ok: false; reason: "minute" | "day" | "write" | string; retry_after?: number };

export interface Audit {
  begin(tool: string, write: boolean): Promise<Begin>;
  end(id: number, ok: boolean, ms: number): Promise<void>;
}

type Fetch = typeof fetch;

function headers(caller: McpCaller): Record<string, string> {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${caller.token}`, "Content-Type": "application/json", Accept: "application/json" };
}

async function answer<T>(res: Response): Promise<T> {
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  let message = `The database answered ${res.status}.`;
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.length < 300) message = body.message;
  } catch { /* keep the status line */ }
  // A refusal (bad input, not allowed, not found) is something the AI app should read.
  if (res.status >= 400 && res.status < 500) throw new ToolError(message);
  throw new Error(message);
}

export function supabaseDb(caller: McpCaller, f: Fetch = fetch, base = SUPABASE_URL): Db {
  return {
    async select<T>(table: string, query: string): Promise<T[]> {
      if (!/^[a-z_]+$/.test(table)) throw new Error("bad table name");
      return answer<T[]>(await f(`${base}/rest/v1/${table}?${query}`, { headers: headers(caller) }));
    },
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      if (!/^[a-z_]+$/.test(fn)) throw new Error("bad function name");
      return answer<T>(await f(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(caller), body: JSON.stringify(args) }));
    },
  };
}

export function supabaseAudit(db: Db): Audit {
  return {
    async begin(tool, write) {
      const r = await db.rpc<Begin>("mcp_begin_call", { p_tool: tool, p_write: write });
      if (!r || typeof r !== "object" || typeof r.ok !== "boolean") throw new Error("unexpected answer from mcp_begin_call");
      return r;
    },
    async end(id, ok, ms) {
      await db.rpc("mcp_end_call", { p_id: id, p_ok: ok, p_ms: Math.round(ms) });
    },
  };
}
