// The assistant panel's side of Parity's MCP server (DEC-0051): the same /mcp endpoint the
// outside AI apps use, called with the person's own Parity session token. That token has no
// client_id, so the server and the database treat the panel as read only.
import type { McpTool } from "./chat";

const VERSION = "2026-07-28";
const META = {
  "io.modelcontextprotocol/protocolVersion": VERSION,
  "io.modelcontextprotocol/clientInfo": { name: "parity-assistant", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

export type TokenSource = () => Promise<string | null>;

let id = 0;

async function rpc(token: TokenSource, method: string, params: Record<string, unknown>, name?: string, f: typeof fetch = fetch): Promise<Record<string, unknown>> {
  const t = await token();
  if (!t) throw new Error("Sign in to Parity to use its tools.");
  const res = await f("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${t}`,
      "MCP-Protocol-Version": VERSION, "Mcp-Method": method, ...(name ? { "Mcp-Name": name } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: { ...params, _meta: META } }),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: Record<string, unknown>; error?: { message?: string } };
  if (!res.ok || body.error || !body.result) throw new Error(body.error?.message ?? `Parity's tools answered ${res.status}.`);
  return body.result;
}

export async function listTools(token: TokenSource, f?: typeof fetch): Promise<McpTool[]> {
  const r = await rpc(token, "tools/list", {}, undefined, f);
  return ((r.tools ?? []) as McpTool[]).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

/** Header-safe tool names go as they are; anything else in the spec's Base64 form. */
const headerName = (n: string) => (/^[\x21-\x7e]+$/.test(n) && !n.startsWith("=?base64?") ? n : `=?base64?${btoa(unescape(encodeURIComponent(n)))}?=`);

export async function callTool(token: TokenSource, name: string, args: Record<string, unknown>, f?: typeof fetch): Promise<{ text: string; isError: boolean }> {
  try {
    const r = await rpc(token, "tools/call", { name, arguments: args }, headerName(name), f);
    const text = ((r.content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    return { text, isError: r.isError === true };
  } catch (e) {
    return { text: (e as Error).message, isError: true };
  }
}
