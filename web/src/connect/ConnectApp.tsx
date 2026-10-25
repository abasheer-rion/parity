// Two pages for AI apps that connect to Parity (DEC-0051):
//   /connect/          how to add Parity to Claude, ChatGPT and others, and the apps you connected,
//                      each with "may make changes" (off by default) and Disconnect.
//   /oauth/consent/    where Supabase Auth's OAuth server sends you to approve an app. You see
//                      which app is asking and what it can do, then allow or deny.
import { useEffect, useState } from "react";
import { supabase } from "../auth/client";

const MCP_URL = `${window.location.origin}/mcp`;

interface Grant { id: string; name: string; uri: string; granted: string; write: boolean }

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="corner corner-logo">
        <a href="/" aria-label="Parity home">
          <img src="/brand/2026-10-21-starburst/parity-mark-white.svg" width={22} height={22} alt="" />
          <img className="letters" src="/brand/2026-10-22-wordmark/parity-letters-on-dark.svg" width={70} height={15} alt="" />
        </a>
      </div>
      <main className="cx glass" id="main">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}

function useSignedIn(): boolean | null {
  const [signed, setSigned] = useState<boolean | null>(null);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSigned(!!data.session)); }, []);
  return signed;
}

const loginHref = () => `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cx-copy">
      <code>{text}</code>
      <button type="button" className="btn" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}

// ------------------------------------------------------------------------------- /connect/

function ConnectedApps() {
  const signed = useSignedIn();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.auth.oauth.listGrants();
    if (error) { setProblem("Connected apps will show here once sign-in for AI apps is switched on."); return; }
    const { data: rows } = await supabase.from("ai_grants").select("client_id, allow_write");
    const write = new Map((rows ?? []).map((r: { client_id: string; allow_write: boolean }) => [r.client_id, r.allow_write]));
    setGrants((data ?? []).map((g) => ({ id: g.client.id, name: g.client.name || "An AI app", uri: g.client.uri, granted: g.granted_at, write: write.get(g.client.id) === true })));
  }

  useEffect(() => { if (signed) void load(); }, [signed]);

  async function setWrite(g: Grant, on: boolean) {
    const { error } = await supabase.from("ai_grants").upsert({ client_id: g.id, client_name: g.name.slice(0, 200), allow_write: on, updated_at: new Date().toISOString() });
    if (error) { setProblem("Could not save that. Try again."); return; }
    setGrants((list) => list?.map((x) => (x.id === g.id ? { ...x, write: on } : x)) ?? null);
  }

  async function disconnect(g: Grant) {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId: g.id });
    if (error) { setProblem("Could not disconnect that app. Try again."); return; }
    await supabase.from("ai_grants").delete().eq("client_id", g.id);
    setGrants((list) => list?.filter((x) => x.id !== g.id) ?? null);
  }

  if (signed === null) return null;
  if (!signed) return <p><a href={loginHref()}>Log in</a> to see the AI apps you connected.</p>;
  if (problem && !grants) return <p className="cx-muted">{problem}</p>;
  if (!grants) return <p className="cx-muted">Loading...</p>;
  if (!grants.length) return <p className="cx-muted">No AI apps connected yet.</p>;
  return (
    <ul className="cx-apps">
      {problem && <li className="cx-bad">{problem}</li>}
      {grants.map((g) => (
        <li key={g.id}>
          <div>
            <strong>{g.name}</strong>
            <span className="cx-muted"> · connected {new Date(g.granted).toLocaleDateString()}</span>
          </div>
          <label className="cx-check">
            <input type="checkbox" checked={g.write} onChange={(e) => void setWrite(g, e.target.checked)} />
            May make changes: place demo orders and save Trade layouts
          </label>
          <button type="button" className="btn" onClick={() => void disconnect(g)}>Disconnect</button>
        </li>
      ))}
    </ul>
  );
}

function ConnectPage() {
  return (
    <Shell title="Connect your AI to Parity">
      <p className="cx-lead">Parity has no AI of its own. Add Parity to the AI app you already use and it can look up tested strategies and their 11 tests, run Verify on a trading record, read market data and news impact, and explain terms from the Academy. It acts as you, and sees only what you can see.</p>
      <h2>The address</h2>
      <Copy text={MCP_URL} />
      <p className="cx-muted">Your AI app opens a Parity sign-in page the first time. Log in and choose Allow.</p>

      <h2>Claude</h2>
      <p>On claude.ai, Claude Desktop or the Claude app: Settings, then Connectors, then Add custom connector. Paste the address and choose Connect. The free plan allows one custom connector.</p>
      <p>In Claude Code:</p>
      <Copy text={`claude mcp add --transport http parity ${MCP_URL}`} />
      <p className="cx-muted">Then type /mcp in Claude Code and choose parity to sign in.</p>

      <h2>ChatGPT</h2>
      <p>Where your plan allows custom connectors: Settings, then Apps and Connectors. Turn on developer mode under Advanced, create a connector, paste the address and choose OAuth. ChatGPT asks before any tool that changes something.</p>

      <h2>Gemini CLI</h2>
      <p>Add this to your Gemini CLI settings.json, then run /mcp auth parity:</p>
      <Copy text={`"mcpServers": { "parity": { "httpUrl": "${MCP_URL}" } }`} />

      <h2>Cursor, VS Code, Codex and others</h2>
      <p>Add an MCP server by its address (Streamable HTTP) and paste the address above. Each app signs you in with Parity the first time. In Codex, run codex mcp login parity after adding it.</p>

      <h2>Your connected apps</h2>
      <ConnectedApps />

      <h2>What an app can and cannot do</h2>
      <ul className="cx-list">
        <li>Read: tested strategies, the strategy search, Verify checks on numbers you give it, market data, news impact, Academy lessons and your demo accounts.</li>
        <li>Change: nothing, unless you tick "May make changes" for that app above. Then it can place limit and stop orders in your demo accounts (virtual money) and save Trade layouts.</li>
        <li>Never: real trades, payments, your password or account settings.</li>
        <li>Limits: 30 calls a minute and 1000 a day for each person. Each call is logged with the app and tool name. What you send and what comes back are not stored.</li>
        <li>Everything is research only, not investment advice.</li>
      </ul>
    </Shell>
  );
}

// ------------------------------------------------------------------------------- /oauth/consent/

const SCOPE_WORDS: Record<string, string> = {
  openid: "Know it is you (your Parity account id)",
  email: "See your email address",
  profile: "See your name, if you set one",
  phone: "See your phone number, if you set one",
};

type Details = { authorization_id: string; redirect_uri: string; client: { id: string; name: string; uri: string }; scope: string };

function ConsentPage() {
  const id = new URLSearchParams(window.location.search).get("authorization_id");
  const signed = useSignedIn();
  const [details, setDetails] = useState<Details | null>(null);
  const [problem, setProblem] = useState<string | null>(id ? null : "This page needs a sign-in request from an AI app. Start again from your AI app.");
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || signed === null) return;
    if (!signed) { window.location.replace(loginHref()); return; }
    supabase.auth.oauth.getAuthorizationDetails(id).then(({ data, error }) => {
      if (error || !data) { setProblem("This request has expired or is not valid. Start again from your AI app."); return; }
      if ("authorization_id" in data) setDetails(data as Details);
      else window.location.replace(data.redirect_url);
    });
  }, [id, signed]);

  async function allow() {
    if (!details) return;
    setBusy(true);
    const { error: grantError } = await supabase.from("ai_grants").upsert({ client_id: details.client.id, client_name: (details.client.name || "").slice(0, 200), allow_write: write, updated_at: new Date().toISOString() });
    if (grantError) { setBusy(false); setProblem("Could not save your choice. Try again."); return; }
    const { error } = await supabase.auth.oauth.approveAuthorization(details.authorization_id);
    if (error) { setBusy(false); setProblem("Could not finish connecting. Start again from your AI app."); }
  }

  async function deny() {
    if (!details) return;
    setBusy(true);
    const { error } = await supabase.auth.oauth.denyAuthorization(details.authorization_id);
    if (error) { setBusy(false); setProblem("Could not send your answer. You can close this page."); }
  }

  if (problem) return <Shell title="Connect an AI app"><p className="cx-bad">{problem}</p></Shell>;
  if (!details) return <Shell title="Connect an AI app"><p className="cx-muted">Loading...</p></Shell>;
  let host = details.redirect_uri;
  try { host = new URL(details.redirect_uri).host; } catch { /* show it as given */ }
  const scopes = details.scope.split(/\s+/).filter(Boolean);
  return (
    <Shell title={`Allow ${details.client.name || "this app"} to use Parity?`}>
      <p className="cx-lead">{details.client.name || "An AI app"} wants to use Parity as you. After you allow it, you go back to <strong>{host}</strong>.</p>
      <h2>It will be able to</h2>
      <ul className="cx-list">
        {scopes.map((s) => <li key={s}>{SCOPE_WORDS[s] ?? s}</li>)}
        <li>Read tested strategies, the strategy search, market data, news impact, Academy lessons and your demo accounts</li>
        <li>Run Verify on numbers it sends</li>
      </ul>
      <label className="cx-check">
        <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
        Also let it make changes: place demo orders (virtual money) and save Trade layouts
      </label>
      <p className="cx-muted">It can never place real trades, pay for anything or change your account. You can disconnect it at any time on <a href="/connect/">Connect your AI</a>. Only allow apps you trust.</p>
      <div className="cx-actions">
        <button type="button" className="btn primary" onClick={() => void allow()} disabled={busy}>Allow</button>
        <button type="button" className="btn" onClick={() => void deny()} disabled={busy}>Deny</button>
      </div>
    </Shell>
  );
}

export function ConnectApp() {
  return window.location.pathname.startsWith("/oauth/consent") ? <ConsentPage /> : <ConnectPage />;
}
