// The assistant's loop (DEC-0049): the person's own model, called straight from this browser
// with their key, and Parity's MCP tools (/mcp) called with their own Parity session. The
// model asks for a tool, we run it on /mcp, hand back the result and repeat, at most a few
// rounds per question. Parity's servers see the tool calls (and log their names), never the
// conversation or the key.
//
// Each provider keeps its own message format, so a conversation's history is kept in that
// format and starts over when the person switches provider.
import type { ProviderId } from "./keys";

export interface McpTool { name: string; description: string; inputSchema: Record<string, unknown> }
export type CallTool = (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }>;
export type Fetch = typeof fetch;

export interface Conversation { provider: ProviderId; history: unknown[] }
export interface Step { kind: "tool"; name: string; isError: boolean }
export interface Answer { text: string; steps: Step[]; conversation: Conversation }

export const MAX_ROUNDS = 6;
/** Long tool results are cut before they go to the model, so a question cannot run up a big bill. */
export const MAX_RESULT_CHARS = 20_000;

export const SYSTEM = [
  "You are the assistant inside Parity, a research site that tests trading strategies against the S&P 500 and checks trading records.",
  "Use the Parity tools to look things up instead of guessing; say which tool a number came from.",
  "Write plainly and briefly, in short sentences. Explain any trading term in a few words.",
  "Everything is research only, not investment advice. Most strategies fail once luck and costs are counted; never recommend buying or selling anything.",
].join(" ");

const clip = (s: string) => (s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}\n[cut: the result was longer]` : s);

/** A provider's error, in words, without ever echoing the key. */
export class ProviderError extends Error {}

async function post(f: Fetch, url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await f(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch {
    throw new ProviderError("Could not reach the model provider. Check the connection.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: unknown } | string | undefined;
    const msg = typeof err === "string" ? err : typeof err?.message === "string" ? err.message : "";
    const hint = res.status === 401 || res.status === 403 ? " Check the key, or connect again." : res.status === 402 ? " The account may be out of credit." : res.status === 429 ? " Wait a moment and try again." : "";
    throw new ProviderError(`The provider answered ${res.status}${msg ? `: ${msg.slice(0, 200)}` : "."}${hint}`);
  }
  return json;
}

/** Gemini takes a smaller schema language: drop what it does not know. */
export function geminiSchema(s: unknown): unknown {
  if (!s || typeof s !== "object") return s;
  const src = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["type", "description", "required", "minimum", "maximum", "minItems", "maxItems"]) if (src[k] !== undefined) out[k] = src[k];
  if (Array.isArray(src.enum) && src.type === "string") out.enum = src.enum;
  if (src.properties && typeof src.properties === "object") {
    out.properties = Object.fromEntries(Object.entries(src.properties as Record<string, unknown>).map(([k, v]) => [k, geminiSchema(v)]));
    if (!Object.keys(out.properties as object).length) delete out.properties;
  }
  if (src.items) out.items = geminiSchema(src.items);
  return out;
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

// ------------------------------------------------------------------ OpenAI and OpenRouter

async function openaiStyle(base: string, extra: Record<string, string>, key: string, model: string, conv: Conversation, question: string, tools: McpTool[], callTool: CallTool, f: Fetch): Promise<Answer> {
  const history = [...conv.history, { role: "user", content: question }] as Record<string, unknown>[];
  const defs = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
  const steps: Step[] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const body = { model, messages: [{ role: "system", content: SYSTEM }, ...history], ...(round < MAX_ROUNDS ? { tools: defs } : {}) };
    const json = await post(f, `${base}/chat/completions`, { Authorization: `Bearer ${key}`, ...extra }, body);
    const msg = ((json.choices as { message?: Record<string, unknown> }[] | undefined)?.[0]?.message ?? {}) as { content?: unknown; tool_calls?: { id: string; function: { name: string; arguments: unknown } }[] };
    history.push({ role: "assistant", content: msg.content ?? null, ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
    if (!msg.tool_calls?.length) return { text: typeof msg.content === "string" ? msg.content : "", steps, conversation: { provider: conv.provider, history } };
    for (const call of msg.tool_calls) {
      const r = await callTool(call.function.name, parseArgs(call.function.arguments));
      steps.push({ kind: "tool", name: call.function.name, isError: r.isError });
      history.push({ role: "tool", tool_call_id: call.id, content: clip(r.text) });
    }
  }
  throw new ProviderError("The model kept asking for tools without answering.");
}

// ------------------------------------------------------------------ Anthropic

async function anthropic(key: string, model: string, conv: Conversation, question: string, tools: McpTool[], callTool: CallTool, f: Fetch): Promise<Answer> {
  const history = [...conv.history, { role: "user", content: question }] as Record<string, unknown>[];
  const defs = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const headers = { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
  const steps: Step[] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const json = await post(f, "https://api.anthropic.com/v1/messages", headers, { model, max_tokens: 8000, system: SYSTEM, messages: history, ...(round < MAX_ROUNDS ? { tools: defs } : {}) });
    const content = (json.content ?? []) as { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
    // The whole reply goes back unchanged, thinking blocks included, as the API expects.
    history.push({ role: "assistant", content });
    if (json.stop_reason === "refusal") return { text: "The model declined to answer this.", steps, conversation: { provider: conv.provider, history } };
    const uses = content.filter((b) => b.type === "tool_use");
    if (json.stop_reason !== "tool_use" || !uses.length) {
      return { text: content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n"), steps, conversation: { provider: conv.provider, history } };
    }
    const results = [];
    for (const u of uses) {
      const r = await callTool(u.name ?? "", parseArgs(u.input));
      steps.push({ kind: "tool", name: u.name ?? "", isError: r.isError });
      results.push({ type: "tool_result", tool_use_id: u.id, content: clip(r.text), ...(r.isError ? { is_error: true } : {}) });
    }
    history.push({ role: "user", content: results });
  }
  throw new ProviderError("The model kept asking for tools without answering.");
}

// ------------------------------------------------------------------ Google Gemini

async function gemini(key: string, model: string, conv: Conversation, question: string, tools: McpTool[], callTool: CallTool, f: Fetch): Promise<Answer> {
  const history = [...conv.history, { role: "user", parts: [{ text: question }] }] as Record<string, unknown>[];
  const decls = tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.inputSchema) }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const steps: Step[] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const json = await post(f, url, { "x-goog-api-key": key }, { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: history, ...(round < MAX_ROUNDS ? { tools: [{ functionDeclarations: decls }] } : {}) });
    const content = ((json.candidates as { content?: Record<string, unknown> }[] | undefined)?.[0]?.content ?? { role: "model", parts: [] }) as { role: string; parts?: { text?: string; functionCall?: { name: string; args?: unknown } }[] };
    history.push(content); // unchanged, so any thought signatures go back as they came
    const calls = (content.parts ?? []).filter((p) => p.functionCall);
    if (!calls.length) return { text: (content.parts ?? []).map((p) => p.text ?? "").join(""), steps, conversation: { provider: conv.provider, history } };
    const parts = [];
    for (const p of calls) {
      const r = await callTool(p.functionCall!.name, parseArgs(p.functionCall!.args));
      steps.push({ kind: "tool", name: p.functionCall!.name, isError: r.isError });
      parts.push({ functionResponse: { name: p.functionCall!.name, response: { result: clip(r.text), is_error: r.isError } } });
    }
    history.push({ role: "user", parts });
  }
  throw new ProviderError("The model kept asking for tools without answering.");
}

export async function ask(opts: {
  provider: ProviderId; key: string; model: string; conversation: Conversation | null; question: string;
  tools: McpTool[]; callTool: CallTool; origin: string; fetch?: Fetch;
}): Promise<Answer> {
  const f = opts.fetch ?? fetch.bind(globalThis);
  const conv = opts.conversation && opts.conversation.provider === opts.provider ? opts.conversation : { provider: opts.provider, history: [] };
  const args = [opts.key, opts.model, conv, opts.question, opts.tools, opts.callTool, f] as const;
  switch (opts.provider) {
    case "openrouter": return openaiStyle("https://openrouter.ai/api/v1", { "HTTP-Referer": opts.origin, "X-Title": "Parity" }, ...args);
    case "openai": return openaiStyle("https://api.openai.com/v1", {}, ...args);
    case "anthropic": return anthropic(...args);
    case "gemini": return gemini(...args);
  }
}
