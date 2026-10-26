// A small assistant panel for Workbench, Verify and Trade (DEC-0051). Parity has no AI model
// of its own: the person connects their own (OpenRouter by sign-in, or a key for Anthropic,
// OpenAI or Google), and the model reads Parity through its MCP tools. Off unless the owner
// turns it on (VITE_AI_ASSISTANT=on) or this browser opted in with ?assistant=on.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../auth/client";
import { ask, ProviderError, type Conversation, type McpTool, type Step } from "./chat";
import { forgetAll, PROVIDERS, providerById, readKey, readModel, readProvider, writeKey, writeModel, writeProvider, type ProviderId } from "./keys";
import { callTool, listTools } from "./mcpClient";
import { startUrl } from "./openrouter";
import "./assistant.css";
import { Button, TextButton } from "../ui";

interface Line { who: "you" | "ai" | "note"; text: string; steps?: Step[] }

const token = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;

export default function AssistantPanel({ place }: { place: "workbench" | "verify" | "trade" }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(readProvider);
  const [key, setKey] = useState<string | null>(() => readKey(readProvider()));
  const [model, setModel] = useState(() => readModel(readProvider()));
  const [draftKey, setDraftKey] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const conv = useRef<Conversation | null>(null);
  const info = providerById(provider);

  useEffect(() => {
    if (!open || tools) return;
    listTools(token).then(setTools, (e: Error) => setLines((l) => [...l, { who: "note", text: `Parity's tools are not available: ${e.message}` }]));
  }, [open, tools]);

  function choose(p: ProviderId) {
    setProvider(p); writeProvider(p); setKey(readKey(p)); setModel(readModel(p)); setDraftKey(""); conv.current = null;
  }

  async function connectOpenRouter() {
    window.location.assign(await startUrl(window.location.origin, window.location.pathname + window.location.search + window.location.hash));
  }

  function saveKey() {
    writeKey(provider, draftKey); setKey(readKey(provider)); setDraftKey("");
  }

  function disconnect() {
    writeKey(provider, null); setKey(null); conv.current = null;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !key || busy) return;
    setQuestion(""); setBusy(true);
    setLines((l) => [...l, { who: "you", text: q }]);
    try {
      const a = await ask({ provider, key, model, conversation: conv.current, question: q, tools: tools ?? [], origin: window.location.origin,
        callTool: (name, args) => callTool(token, name, args) });
      conv.current = a.conversation;
      setLines((l) => [...l, { who: "ai", text: a.text || "(no answer)", steps: a.steps }]);
    } catch (err) {
      setLines((l) => [...l, { who: "note", text: err instanceof ProviderError ? err.message : "Something went wrong. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" className="ai-fab" onClick={() => setOpen(true)} aria-label="Open the assistant">Ask AI</button>;
  }

  return (
    <section className="ai-panel" aria-label="Assistant" data-place={place}>
      <header className="ai-head">
        <strong>Assistant</strong>
        <button type="button" className="ai-x" onClick={() => setOpen(false)} aria-label="Close the assistant">×</button>
      </header>
      <div className="ai-setup">
        <label>Model provider
          <select value={provider} onChange={(e) => choose(e.target.value as ProviderId)}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {key ? (
          <div className="ai-row">
            <label className="ai-grow">Model
              <input value={model} onChange={(e) => { setModel(e.target.value); writeModel(provider, e.target.value); }} spellCheck={false} />
            </label>
            <TextButton tone="muted" onClick={disconnect}>Disconnect</TextButton>
          </div>
        ) : info.connect === "oauth" ? (
          <div className="ai-row">
            <Button size="sm" onClick={connectOpenRouter}>Connect OpenRouter</Button>
            <span className="ai-small">or paste a key below</span>
          </div>
        ) : null}
        {!key && (
          <form className="ai-row" onSubmit={(e) => { e.preventDefault(); saveKey(); }}>
            <label className="ai-grow">{info.name.split(" (")[0]} key
              <input type="password" autoComplete="off" value={draftKey} placeholder={info.keyHint} onChange={(e) => setDraftKey(e.target.value)} />
            </label>
            <Button size="sm" type="submit" disabled={!draftKey.trim()}>Save</Button>
          </form>
        )}
        <p className="ai-small">Your key, your bill. The key stays in this browser and goes straight to {info.name.split(" (")[0]}; Parity never sees it. <a href={info.keysUrl} target="_blank" rel="noreferrer">Get a key</a> · <button type="button" className="ai-link" onClick={() => { forgetAll(); choose("openrouter"); }}>Forget all keys</button></p>
      </div>
      <div className="ai-log" aria-live="polite">
        {!lines.length && <p className="ai-small">Ask about a strategy, a market, a trading record or a word you do not know. Answers are research only, not investment advice.</p>}
        {lines.map((l, i) => (
          <div key={i} className={`ai-line ai-${l.who}`}>
            {l.steps?.length ? <div className="ai-steps">{l.steps.map((s, j) => <span key={j} className={s.isError ? "bad" : ""}>{s.name}</span>)}</div> : null}
            <p>{l.text}</p>
          </div>
        ))}
        {busy && <p className="ai-small">Thinking...</p>}
      </div>
      <form className="ai-ask" onSubmit={send}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={key ? "Ask a question" : "Connect a model first"} disabled={!key || busy} aria-label="Question" />
        <Button size="sm" variant="primary" type="submit" disabled={!key || busy || !question.trim()} loading={busy}>Ask</Button>
      </form>
    </section>
  );
}
