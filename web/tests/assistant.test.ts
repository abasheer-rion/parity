// Bring your own model (DEC-0051): the OpenRouter sign-in, where keys live, the flag, and one
// tool round with each provider's message format. Every provider and /mcp call is faked.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ask, geminiSchema, MAX_RESULT_CHARS, ProviderError, type McpTool } from "../src/assistant/chat";
import { assistantEnabled, forgetAll, readKey, readModel, readProvider, writeKey, writeProvider } from "../src/assistant/keys";
import { callTool, listTools } from "../src/assistant/mcpClient";
import { challengeFor, finish, startUrl } from "../src/assistant/openrouter";

const TOOLS: McpTool[] = [{ name: "get_strategy", description: "One strategy", inputSchema: { type: "object", properties: { id: { type: "string", pattern: "^x" } }, required: ["id"], additionalProperties: false } }];

function memoryStore(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); } };
}

beforeEach(() => { localStorage.clear(); });

describe("OpenRouter sign-in (PKCE)", () => {
  it("makes the S256 challenge from RFC 7636's example", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("sends the person to OpenRouter with our callback and swaps the code for a key", async () => {
    const store = memoryStore();
    const url = new URL(await startUrl("https://lab.endyland.com", "/lab/#/try", store));
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("callback_url")).toBe("https://lab.endyland.com/oauth/openrouter/");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.code).toBe("abc");
      expect(await challengeFor(body.code_verifier)).toBe(url.searchParams.get("code_challenge"));
      return new Response(JSON.stringify({ key: "sk-or-test" }), { status: 200 });
    });
    const r = await finish("abc", store, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, returnTo: "/lab/#/try" });
    expect(readKey("openrouter")).toBe("sk-or-test");
    expect(store.getItem("parity.ai.openrouter.verifier")).toBeNull();
  });

  it("refuses without the verifier from this tab, and never returns off this address", async () => {
    const store = memoryStore();
    store.setItem("parity.ai.openrouter.return", "//evil.example/");
    const r = await finish("abc", store, vi.fn() as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.returnTo).toBe("/");
    expect(readKey("openrouter")).toBeNull();
  });
});

describe("keys and the flag", () => {
  it("keeps keys per provider in this browser and forgets them all", () => {
    writeProvider("anthropic");
    writeKey("anthropic", "  sk-ant-x  ");
    expect(readProvider()).toBe("anthropic");
    expect(readKey("anthropic")).toBe("sk-ant-x");
    expect(readModel("anthropic")).toBe("claude-opus-5");
    forgetAll();
    expect(readKey("anthropic")).toBeNull();
    expect(readProvider()).toBe("openrouter");
  });

  it("is off by default; ?assistant=on opts this browser in and ?assistant=off out", () => {
    expect(assistantEnabled("")).toBe(false);
    expect(assistantEnabled("?assistant=on")).toBe(true);
    expect(assistantEnabled("")).toBe(true);
    expect(assistantEnabled("?x=1&assistant=off")).toBe(false);
  });
});

describe("one tool round with each provider", () => {
  const callToolFn = vi.fn(async () => ({ text: "x".repeat(MAX_RESULT_CHARS + 50), isError: false }));

  it("OpenRouter (OpenAI format) sends the key only to the provider and cuts long results", async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-1");
      bodies.push(JSON.parse(String(init?.body)));
      const msg = bodies.length === 1
        ? { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "get_strategy", arguments: '{"id":"carry"}' } }] }
        : { role: "assistant", content: "Carry fails 7 of 11 tests." };
      return new Response(JSON.stringify({ choices: [{ message: msg }] }));
    });
    const a = await ask({ provider: "openrouter", key: "sk-or-1", model: "openrouter/auto", conversation: null, question: "carry?", tools: TOOLS, callTool: callToolFn, origin: "https://parity.endyland.com", fetch: f as unknown as typeof fetch });
    expect(a.text).toBe("Carry fails 7 of 11 tests.");
    expect(a.steps).toEqual([{ kind: "tool", name: "get_strategy", isError: false }]);
    expect(callToolFn).toHaveBeenCalledWith("get_strategy", { id: "carry" });
    const toolMsg = (bodies[1].messages as { role: string; content: string }[]).find((m) => m.role === "tool")!;
    expect(toolMsg.content.length).toBeLessThan(MAX_RESULT_CHARS + 60);
    expect(toolMsg.content).toContain("[cut");
  });

  it("Anthropic sends the browser header and returns the whole reply unchanged", async () => {
    let n = 0;
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      const h = init?.headers as Record<string, string>;
      expect(h["anthropic-dangerous-direct-browser-access"]).toBe("true");
      expect(h["x-api-key"]).toBe("sk-ant-1");
      n++;
      return new Response(JSON.stringify(n === 1
        ? { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "t1", name: "get_strategy", input: { id: "carry" } }] }
        : { stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] }));
    });
    const a = await ask({ provider: "anthropic", key: "sk-ant-1", model: "claude-opus-5", conversation: null, question: "q", tools: TOOLS, callTool: callToolFn, origin: "", fetch: f as unknown as typeof fetch });
    expect(a.text).toBe("Done.");
    const hist = a.conversation.history as { role: string; content: { type: string }[] }[];
    expect(hist[1].content[0].type).toBe("thinking");
    expect(hist[2].content[0].type).toBe("tool_result");
  });

  it("Gemini gets a schema it understands", async () => {
    let n = 0;
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("models/gemini-2.5-flash:generateContent");
      const body = JSON.parse(String(init?.body));
      if (n === 0) expect(body.tools[0].functionDeclarations[0].parameters).toEqual({ type: "object", required: ["id"], properties: { id: { type: "string" } } });
      n++;
      return new Response(JSON.stringify({ candidates: [{ content: n === 1 ? { role: "model", parts: [{ functionCall: { name: "get_strategy", args: { id: "carry" } } }] } : { role: "model", parts: [{ text: "Ok." }] } }] }));
    });
    const a = await ask({ provider: "gemini", key: "AIza1", model: "gemini-2.5-flash", conversation: null, question: "q", tools: TOOLS, callTool: callToolFn, origin: "", fetch: f as unknown as typeof fetch });
    expect(a.text).toBe("Ok.");
    expect(geminiSchema({ type: "integer", enum: [1, 2] })).toEqual({ type: "integer" });
  });

  it("explains a refused key without repeating it", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 }));
    const p = ask({ provider: "openai", key: "sk-secret", model: "gpt-5", conversation: null, question: "q", tools: [], callTool: callToolFn, origin: "", fetch: f as unknown as typeof fetch });
    await expect(p).rejects.toBeInstanceOf(ProviderError);
    await expect(p).rejects.toThrow(/401.*Check the key/);
    await expect(p).rejects.not.toThrow(/sk-secret/);
  });
});

describe("the panel's MCP client", () => {
  it("calls /mcp with the session token and the modern headers", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/mcp");
      const h = init?.headers as Record<string, string>;
      expect(h.Authorization).toBe("Bearer session-token");
      expect(h["MCP-Protocol-Version"]).toBe("2026-07-28");
      const body = JSON.parse(String(init?.body));
      expect(h["Mcp-Method"]).toBe(body.method);
      if (body.method === "tools/list") return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: TOOLS } }));
      expect(h["Mcp-Name"]).toBe("get_strategy");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "{}" }], isError: false } }));
    });
    const token = async () => "session-token";
    expect((await listTools(token, f as unknown as typeof fetch))[0].name).toBe("get_strategy");
    expect(await callTool(token, "get_strategy", { id: "carry" }, f as unknown as typeof fetch)).toEqual({ text: "{}", isError: false });
    expect((await callTool(async () => null, "get_strategy", {}, f as unknown as typeof fetch)).isError).toBe(true);
  });
});
