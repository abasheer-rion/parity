// "Read from your broker" (DEC-0091): the fifth way into Verify, shown when the build turns
// connections on. The person picks a venue, follows the steps to make a read-only key (or
// signs in at Alpaca), and Parity's server reads the trades once, checks them and signs the
// result. The key is cleared from this page as soon as it is sent, and the server drops it
// after the read unless the person ticks "keep in sync". Signing in is needed: reads are
// counted per person and logged.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { connectCall, connectStatus, ConnectFailed, VENUE_LIST, VENUES, type ConnectStatus, type FetchAnswer, type VenueId } from "../../lib/verify/connect";
import { rangeProblem } from "../../lib/connect/venues";
import type { Result } from "../../lib/verify/checks";
import { Button, Checkbox, ChoiceCards, Field, Input, type Choice } from "../../ui";
import { SignedIn } from "./signedIn";

const HERE = "/verify/";
const PENDING = "parity.connect.pending.v1";
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

interface Options { from: string; to: string; tries: string; balance: string; symbols: string; keep: boolean; label: string }

const VENUE_CHOICES: Choice<VenueId>[] = VENUE_LIST.map((v) => ({ value: v.id, title: v.name, body: v.line }));
const ENV_CHOICES: Choice<"live" | "paper">[] = [
  { value: "live", title: "Live account", body: "Real money." },
  { value: "paper", title: "Paper account", body: "Alpaca's practice account." },
];

/** What the page sends: the form's values, the credential and nothing else. */
export function requestBody(venue: VenueId, fields: Record<string, string>, o: Options) {
  return {
    venue,
    credentials: fields,
    from: o.from, to: o.to,
    tries: Math.max(1, Math.floor(Number(o.tries) || 1)),
    balance: Number(o.balance) > 0 ? Number(o.balance) : null,
    symbols: o.symbols.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
    keep: o.keep, label: o.label.trim(),
  };
}

/** The Alpaca sign-in came back to /verify/?connect=alpaca#code=...&state=... (or #error=...). */
function alpacaReturn(): { code: string; state: string } | { error: string } | null {
  if (typeof window === "undefined" || !/[?&]connect=alpaca\b/.test(window.location.search)) return null;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (h.get("error")) return { error: h.get("error") === "denied" ? "You did not allow Parity at Alpaca, so nothing was read." : "The Alpaca sign-in did not finish. Start again." };
  const code = h.get("code"), state = h.get("state");
  return code && state ? { code, state } : null;
}

function readPending(): Options | null {
  try { const v = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return v ? JSON.parse(v) as Options : null; } catch { return null; }
}

export function ConnectInput({ onResult }: { onResult: (r: Result, connected: FetchAnswer) => void }) {
  const signedIn = useContext(SignedIn);
  const [status, setStatus] = useState<ConnectStatus | "off" | null>(null);
  const [venue, setVenue] = useState<VenueId>("ibkr");
  const [env, setEnv] = useState<"live" | "paper">("live");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [o, setO] = useState<Options>({ from: daysAgo(364), to: today(), tries: "1", balance: "", symbols: "", keep: false, label: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = VENUES[venue];
  const set = (patch: Partial<Options>) => setO((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    connectStatus().then((s) => live && setStatus(s)).catch(() => live && setStatus("off"));
    return () => { live = false; };
  }, [signedIn]);

  const send = useCallback(async (v: VenueId, creds: Record<string, string>, opts: Options) => {
    setBusy(true); setError(null);
    // The key leaves the page now and is not kept in it.
    setFields({});
    try {
      const answer = await connectCall<FetchAnswer>("fetch", requestBody(v, creds, opts));
      onResult(answer.record.result, answer);
    } catch (e) {
      setError(e instanceof ConnectFailed ? e.message : "We could not reach Parity's server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [onResult]);

  // Back from Alpaca: read once with the one-time code, then take it out of the address.
  useEffect(() => {
    const back = alpacaReturn();
    if (!back) return;
    window.history.replaceState(null, "", HERE + window.location.search.replace(/[?&]connect=alpaca\b/, "").replace(/^&/, "?"));
    setVenue("alpaca");
    if ("error" in back) { setError(back.error); return; }
    const opts = readPending() ?? o;
    setO(opts);
    void send("alpaca", { code: back.code, state: back.state }, opts);
    // Once, on arrival.
  }, []);

  const startAlpaca = async () => {
    setBusy(true); setError(null);
    try {
      const { url } = await connectCall<{ url: string }>("alpaca/start", { env });
      try { sessionStorage.setItem(PENDING, JSON.stringify(o)); } catch { /* the defaults are used on return */ }
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ConnectFailed ? e.message : "We could not reach Parity's server. Try again.");
      setBusy(false);
    }
  };

  const missing = useMemo(() => [
    ...info.fields.filter((f) => f.id !== "symbols" && !(fields[f.id] ?? "").trim()).map((f) => f.label),
    ...(info.fields.some((f) => f.id === "symbols") && !o.symbols.trim() ? ["Markets to read"] : []),
  ], [info, fields, o.symbols]);
  // The dates are checked here too, so a key is never sent for a range the venue cannot read.
  const badRange = rangeProblem(o.from, o.to, venue);
  const tries = Number(o.tries);
  const badTries = o.tries.trim() !== "" && (!Number.isInteger(tries) || tries < 1 || tries > 10_000_000) ? "Tries must be a whole number from 1 to 10,000,000." : null;
  const badBalance = o.balance.trim() !== "" && !(Number(o.balance) > 0 && Number(o.balance) <= 1e12) ? "The starting balance must be a positive number, or left empty." : null;
  const problems = [badRange, badTries, badBalance].filter((x): x is string => !!x);

  if (!signedIn) {
    return (
      <div className="vf-panel">
        <p className="vf-small">Reading trades from your broker needs an account, so each read is counted and logged for you. Log in, then come back to this page.</p>
        <div className="vf-row">
          <Button variant="primary" href={`/login/?next=${encodeURIComponent(HERE)}`}>Log in to connect</Button>
        </div>
      </div>
    );
  }
  if (status === "off") return <div className="vf-panel"><p className="vf-small">Broker connections are not available here yet.</p></div>;

  const setUp = status && status.signing;
  return (
    <div className="vf-panel vc-panel">
      <p className="vf-privacy">
        Parity reads your trades from the venue with a key that can only read. We check that before reading, and refuse a key
        that can trade, move or withdraw money. The key is used for this one read and then dropped, unless you choose to keep it in sync.
      </p>
      {status && !status.signing && <p className="vf-warn" role="status">Broker connections are not set up on this server yet, so reading is switched off.</p>}

      <ChoiceCards<VenueId> label="Where are your trades?" value={venue} onChange={(v) => { setVenue(v); setFields({}); setError(null); }} options={VENUE_CHOICES} />

      <section className="vc-venue" aria-labelledby="vc-venue-h">
        <h3 id="vc-venue-h" className="vf-sub">At {info.name}</h3>
        <ol className="vc-steps">{info.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="vc-readonly"><strong>Read-only:</strong> {info.readOnly}</p>
        <details className="vc-limits">
          <summary>What {info.name} limits</summary>
          <ul>{info.limits.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="vf-small">Official pages we follow: {info.docs.map((d, i) => <span key={d}>{i ? ", " : ""}<a href={d} target="_blank" rel="noopener noreferrer">{new URL(d).hostname}</a></span>)}.</p>
        </details>
      </section>

      {venue === "alpaca" && <ChoiceCards<"live" | "paper"> label="Which Alpaca account?" value={env} onChange={setEnv} options={ENV_CHOICES} />}

      <div className="vc-fields">
        {info.fields.filter((f) => f.id !== "symbols").map((f) => (
          <Field key={f.id} label={f.label}>
            {f.multiline
              ? <textarea className="ui-input vc-secret" rows={5} value={fields[f.id] ?? ""} placeholder={f.placeholder} spellCheck={false} autoComplete="off" aria-label={f.label}
                  onChange={(e) => setFields((x) => ({ ...x, [f.id]: e.target.value }))} />
              : <input className="ui-input" type={f.secret ? "password" : "text"} value={fields[f.id] ?? ""} placeholder={f.placeholder} spellCheck={false} autoComplete="off" aria-label={f.label}
                  onChange={(e) => setFields((x) => ({ ...x, [f.id]: e.target.value }))} />}
          </Field>
        ))}
        {info.fields.some((f) => f.id === "symbols") && (
          <Field label="Markets to read" help="Binance has no list of every market you traded. Name each one, separated by commas: BTCUSDT, ETHUSDT.">
            <input className="ui-input" value={o.symbols} onChange={(e) => set({ symbols: e.target.value })} placeholder="BTCUSDT, ETHUSDT" spellCheck={false} aria-label="Markets to read" />
          </Field>
        )}
      </div>

      <div className="vf-questions vc-questions">
        <div className="vc-range">
          <Input label="From" type="date" value={o.from} onChange={(v) => set({ from: v })} />
          <Input label="To" type="date" value={o.to} onChange={(v) => set({ to: v })} />
        </div>
        <span className="vf-help">{info.name} can be read at most {info.maxDays.toLocaleString("en-US")} days at a time.</span>
        <div className="ui-field">
          <Input label="Starting balance (optional)" type="number" value={o.balance} onChange={(v) => set({ balance: v })} placeholder="For example 10000" />
          <span className="vf-help">Turns profits into returns. Without it, only the per-trade checks run. The badge says you stated it.</span>
        </div>
        <div className="ui-field">
          <Input label="How many strategies, bots or settings did you try before this one?" type="number" value={o.tries} onChange={(v) => set({ tries: v })} />
          <span className="vf-help">The luck check needs this number. A broker can show what was traded, not how many other things were tried, so this one stays yours to state.</span>
        </div>
        <div className="vf-optin">
          <Checkbox checked={o.keep} onChange={(v) => set({ keep: v })} label="Keep this connection in sync, so I can read it again without pasting the key" />
          <p className="vf-help">
            {status && !status.keep
              ? "Keeping a connection is not set up on this server yet, so the key is always used once and dropped."
              : "Off by default. When on, the key is stored sealed with a key only our server holds, used only when you ask for a new read, and every use is logged. Revoke it any time in Settings, Broker connections."}
          </p>
          {o.keep && <Input label="Name for this connection" value={o.label} onChange={(v) => set({ label: v.slice(0, 80) })} placeholder={`My ${info.name} account`} />}
        </div>
      </div>

      {error && <p className="vf-error" role="alert">{error}</p>}
      <div className="vf-row">
        {venue === "alpaca"
          ? <Button variant="primary" onClick={() => void startAlpaca()} loading={busy} disabled={!setUp || !(status && status.alpaca) || problems.length > 0 || busy}>Continue to Alpaca</Button>
          : <Button variant="primary" onClick={() => void send(venue, fields, o)} loading={busy} disabled={!setUp || missing.length > 0 || problems.length > 0 || busy}>Read trades and check</Button>}
        {venue === "alpaca" && status && setUp && !status.alpaca && <span className="vf-help">Signing in with Alpaca is not set up on this server yet.</span>}
        {venue !== "alpaca" && missing.length > 0 && <span className="vf-help">Still to fill in: {missing.join(", ")}.</span>}
        {problems.map((p) => <span key={p} className="vf-warn" role="status">{p}</span>)}
      </div>
    </div>
  );
}
