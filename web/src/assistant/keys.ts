// Bring your own model (DEC-0049): which AI provider the person chose, their model and their
// key. Everything here stays in this browser's local storage, on this one address. It is
// never sent to Parity's servers, never logged and never put in a URL: the browser sends the
// key straight to the provider. "Your key, your bill."

export type ProviderId = "openrouter" | "anthropic" | "openai" | "gemini";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** How the person connects: OpenRouter has a real sign-in (OAuth with PKCE); the rest take a key. */
  connect: "oauth" | "key";
  defaultModel: string;
  keyHint: string;
  keysUrl: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "openrouter", name: "OpenRouter (Claude, GPT, Gemini and more)", connect: "oauth", defaultModel: "openrouter/auto", keyHint: "sk-or-...", keysUrl: "https://openrouter.ai/settings/keys" },
  { id: "anthropic", name: "Anthropic (Claude)", connect: "key", defaultModel: "claude-opus-5", keyHint: "sk-ant-...", keysUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI (GPT)", connect: "key", defaultModel: "gpt-5", keyHint: "sk-...", keysUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", name: "Google (Gemini)", connect: "key", defaultModel: "gemini-2.5-flash", keyHint: "AIza...", keysUrl: "https://aistudio.google.com/app/apikey" },
];

export const providerById = (id: string): ProviderInfo => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

const K = { provider: "parity.ai.provider", key: (p: ProviderId) => `parity.ai.key.${p}`, model: (p: ProviderId) => `parity.ai.model.${p}` };

function get(name: string): string | null {
  try { return window.localStorage.getItem(name); } catch { return null; }
}
function set(name: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
  } catch { /* storage blocked: the key lasts only for this page */ }
}

export const readProvider = (): ProviderId => providerById(get(K.provider) ?? "openrouter").id;
export const writeProvider = (p: ProviderId) => set(K.provider, p);
export const readKey = (p: ProviderId): string | null => get(K.key(p));
export const writeKey = (p: ProviderId, key: string | null) => set(K.key(p), key && key.trim() ? key.trim() : null);
export const readModel = (p: ProviderId): string => get(K.model(p)) || providerById(p).defaultModel;
export const writeModel = (p: ProviderId, model: string) => set(K.model(p), model.trim() || null);

/** Forget every key and choice on this address. */
export function forgetAll() {
  for (const p of PROVIDERS) { set(K.key(p.id), null); set(K.model(p.id), null); }
  set(K.provider, null);
}

/** The panel is off unless the build sets VITE_AI_ASSISTANT=on (the owner's switch), or this
 *  browser opted in with ?assistant=on to try it first (?assistant=off undoes that). */
export function assistantEnabled(search: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  if (import.meta.env?.VITE_AI_ASSISTANT === "on") return true;
  const m = search.match(/[?&]assistant=(on|off)\b/);
  if (m) set("parity.ai.assistant", m[1] === "on" ? "on" : null);
  return get("parity.ai.assistant") === "on";
}
