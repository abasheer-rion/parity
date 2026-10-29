// Settings > API keys (DEC-0071): make, name, scope, expire, rotate and revoke keys for the
// Parity API. The list, usage and the key log come straight from Supabase, where the row
// rules show only your own keys. Making and rotating go through /api/keys, because only the
// server holds the pepper the keys are hashed with. A new key is shown once and never again.
import { useCallback, useEffect, useState } from "react";
import { requireClient } from "../auth/client";
import { useSession } from "../auth/session";
import { Badge, Button, Checkbox, Dialog, Field, Input, Select, SettingsRow, toast } from "../ui";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS, MAX_ACTIVE_KEYS, OVERLAP_HOURS, SCOPE_TEXT, SCOPES, type Scope } from "../lib/api/policy";

interface KeyRow {
  id: string; name: string; prefix: string; last4: string; scopes: Scope[]; ip_allowlist: string[];
  created_at: string; expires_at: string; last_used_at: string | null; revoked_at: string | null; revoked_reason: string | null;
}
interface EventRow { id: number; key_id: string; event: string; at: string }
interface UsageRow { key_id: string; requests: number; errors: number }

const COLS = "id, name, prefix, last4, scopes, ip_allowlist, created_at, expires_at, last_used_at, revoked_at, revoked_reason";
const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "never");

export function keyState(k: Pick<KeyRow, "revoked_at" | "revoked_reason" | "expires_at">, now = Date.now()): { word: string; tone: "good" | "bad" | "warning" | "neutral" } {
  if (k.revoked_at) return { word: k.revoked_reason === "leaked" ? "Revoked, leaked" : "Revoked", tone: "bad" };
  const left = Date.parse(k.expires_at) - now;
  if (left <= 0) return { word: "Expired", tone: "neutral" };
  if (left < 7 * 86_400_000) return { word: "Expires soon", tone: "warning" };
  return { word: "Active", tone: "good" };
}

async function post(path: string, body: unknown): Promise<{ id: string; key: string; expires_at: string }> {
  const { data } = await requireClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in first.");
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as { error?: string; id?: string; key?: string; expires_at?: string };
  if (!res.ok || !out.key || !out.id) throw new Error(out.error ?? `The server answered ${res.status}.`);
  return { id: out.id, key: out.key, expires_at: out.expires_at ?? "" };
}

export function ApiKeysSettings() {
  const { session } = useSession();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [usage, setUsage] = useState<Record<string, UsageRow>>({});
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState<KeyRow | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const c = requireClient();
      const today = new Date().toISOString().slice(0, 10);
      const [k, e, u] = await Promise.all([
        c.from("api_keys").select(COLS).order("created_at", { ascending: false }),
        c.from("api_key_events").select("id, key_id, event, at").order("at", { ascending: false }).limit(20),
        c.from("api_key_usage").select("key_id, requests, errors").eq("day", today),
      ]);
      if (k.error) throw k.error;
      setKeys((k.data ?? []) as KeyRow[]);
      setEvents((e.data ?? []) as EventRow[]);
      setUsage(Object.fromEntries(((u.data ?? []) as UsageRow[]).map((r) => [r.key_id, r])));
      setError(null);
    } catch {
      setError("Could not load your keys. Reload to try again.");
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (k: KeyRow) => {
    if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working within a minute.`)) return;
    const { data, error: e } = await requireClient().rpc("api_key_revoke", { p_id: k.id });
    if (e || data === false) toast("Could not revoke that key.", { tone: "bad" });
    else toast("Key revoked.");
    await load();
  };

  const active = (keys ?? []).filter((k) => keyState(k).tone !== "bad" && keyState(k).word !== "Expired").length;
  const names = new Map((keys ?? []).map((k) => [k.id, k.name]));

  return (
    <section aria-labelledby="set-api-keys" data-testid="api-keys">
      <SettingsRow
        label={<span id="set-api-keys">API keys</span>}
        help={<>Keys let your own programs call the Parity API. Each key has scopes, an expiry and an optional list of allowed addresses. Guide and examples: <a href="/developers/">developers</a>.</>}
      >
        <Button variant="primary" icon="plus" onClick={() => setMaking(true)} disabled={active >= MAX_ACTIVE_KEYS}>Make a key</Button>
        {active >= MAX_ACTIVE_KEYS && <p className="settings-note">You have {MAX_ACTIVE_KEYS} active keys. Revoke one to make another.</p>}
      </SettingsRow>
      {error && <p role="alert" className="settings-note">{error}</p>}
      {keys && keys.length === 0 && <p className="settings-note">No keys yet.</p>}
      {keys && keys.length > 0 && (
        <ul className="api-keys" aria-label="Your API keys">
          {keys.map((k) => {
            const st = keyState(k);
            const live = st.tone === "good" || st.tone === "warning";
            const u = usage[k.id];
            return (
              <li key={k.id} className="srow">
                <div className="srow-l">
                  <div className="srow-label">{k.name} <Badge tone={st.tone}>{st.word}</Badge></div>
                  <div className="srow-help">
                    <code>{k.prefix}...{k.last4}</code> · {k.scopes.join(", ")} · made {day(k.created_at)} · expires {day(k.expires_at)} · last used {day(k.last_used_at)}
                    {k.ip_allowlist.length > 0 && <> · only from {k.ip_allowlist.join(", ")}</>}
                    {u && <> · today {u.requests} requests, {u.errors} errors</>}
                  </div>
                </div>
                <div className="srow-r">
                  {live && <Button size="sm" onClick={() => setRotating(k)}>Rotate</Button>}
                  {live && <Button size="sm" variant="danger" onClick={() => void revoke(k)}>Revoke</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {events.length > 0 && (
        <SettingsRow label="Key log" help="The last 20 things that happened to your keys.">
          <ul className="api-key-log">
            {events.map((e) => <li key={e.id}>{day(e.at)} · {names.get(e.key_id) ?? "a key"} · {e.event}</li>)}
          </ul>
        </SettingsRow>
      )}
      <NewKeyDialog open={making} onClose={() => setMaking(false)} onMade={(key) => { setMaking(false); setSecret(key); void load(); }} />
      <RotateDialog row={rotating} onClose={() => setRotating(null)} onMade={(key) => { setRotating(null); setSecret(key); void load(); }} />
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
    </section>
  );
}

function NewKeyDialog({ open, onClose, onMade }: { open: boolean; onClose: () => void; onMade: (key: string) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["read:strategies", "read:markets"]);
  const [days, setDays] = useState(String(DEFAULT_EXPIRY_DAYS));
  const [ips, setIps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await post("/api/keys", { name, scopes, days: Number(days), ip: ips.split(/[\s,]+/).filter(Boolean) });
      setName(""); setIps("");
      onMade(made.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Make an API key"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim() || scopes.length === 0} onClick={() => void submit()}>Make key</Button></>}>
      <Input label="Name" value={name} onChange={setName} placeholder="For example: build server" autoFocus />
      <fieldset className="api-scopes">
        <legend className="ui-field-label">Scopes</legend>
        {SCOPES.map((s) => (
          <Checkbox key={s} checked={scopes.includes(s)} onChange={(on) => setScopes(on ? [...scopes, s] : scopes.filter((x) => x !== s))} label={<><code>{s}</code> {SCOPE_TEXT[s]}</>} />
        ))}
      </fieldset>
      <Select label="Expires after" value={days} onChange={setDays} options={EXPIRY_DAYS.map((d) => [String(d), `${d} days`] as [string, string])} />
      <Field label="Allowed addresses (optional)" help="IP addresses or ranges, such as 203.0.113.7 or 2001:db8::/32, separated by spaces or commas. Leave empty to allow any address.">
        <input className="ui-input" value={ips} onChange={(e) => setIps(e.target.value)} aria-label="Allowed addresses" />
      </Field>
      {error && <p role="alert" className="ui-field-error">{error}</p>}
    </Dialog>
  );
}

function RotateDialog({ row, onClose, onMade }: { row: KeyRow | null; onClose: () => void; onMade: (key: string) => void }) {
  const [overlap, setOverlap] = useState("24");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      const made = await post("/api/keys/rotate", { id: row.id, overlap_hours: Number(overlap) });
      onMade(made.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rotate the key.");
    } finally {
      setBusy(false);
    }
  };
  const label = (h: number) => (h === 0 ? "Stop the old key now" : h === 1 ? "1 hour" : h === 24 ? "1 day" : "7 days");
  return (
    <Dialog open={!!row} onClose={onClose} title={`Rotate "${row?.name ?? ""}"`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void submit()}>Rotate</Button></>}>
      <p>You get a new key with the same scopes and allowed addresses. The old key keeps working for the time you pick, so you can swap it without downtime.</p>
      <Select label="Old key keeps working for" value={overlap} onChange={setOverlap} options={OVERLAP_HOURS.map((h) => [String(h), label(h)] as [string, string])} />
      {error && <p role="alert" className="ui-field-error">{error}</p>}
    </Dialog>
  );
}

function SecretDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(secret ?? ""); toast("Copied."); } catch { toast("Copy it by hand.", { tone: "bad" }); }
  };
  return (
    <Dialog open={!!secret} onClose={onClose} title="Your new API key"
      footer={<><Button onClick={() => void copy()}>Copy</Button><Button variant="primary" onClick={onClose}>I saved it</Button></>}>
      <p>This is the only time we show it. We keep only a fingerprint, so we cannot show it again. Store it in a password manager or your server's secret settings, never in code.</p>
      <pre className="api-secret" data-testid="api-secret" tabIndex={0}>{secret}</pre>
    </Dialog>
  );
}
