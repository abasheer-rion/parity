// Two-step sign-in (authenticator apps, TOTP) and passkeys, for Settings > Account.
import { useCallback, useEffect, useState } from "react";
import { Button, toast } from "../ui";
import { explain, supabase } from "./client";
import { Field, Notice, useSubmit } from "./form";
import { codeProblem } from "./rules";

interface Factor { id: string; friendly_name?: string; status: string; created_at: string }

export function TwoStep() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const { busy, error, setError, run } = useSubmit();

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []).filter((f) => f.factor_type === "totp") as Factor[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const start = run(async () => {
    // Clear any half-finished setup first, so a retry does not hit a name clash.
    for (const f of factors ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    if (error) return explain(error);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  });

  const confirm = run(async () => {
    if (!enrolling) return;
    const bad = codeProblem(code);
    if (bad) return bad;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code });
    if (error) return explain(error);
    setEnrolling(null);
    setCode("");
    toast("Two-step sign-in is on", { tone: "good" });
    await load();
  });

  const remove = (id: string) => run(async () => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setConfirmRemove(null);
    if (error) return explain(error);
    toast("Authenticator removed");
    await load();
  });

  const verified = (factors ?? []).filter((f) => f.status === "verified");
  if (factors === null) return <span className="muted">Loading</span>;

  return (
    <div className="account-stack">
      <Notice>{error}</Notice>
      {verified.map((f) => (
        <div key={f.id} className="account-actions" style={{ alignItems: "center" }}>
          <span>{f.friendly_name ?? "Authenticator app"}</span>
          {confirmRemove === f.id ? (
            <>
              <Button size="sm" variant="danger" loading={busy} onClick={() => void remove(f.id)()}>Yes, turn off two-step</Button>
              <Button size="sm" onClick={() => setConfirmRemove(null)}>Keep it</Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmRemove(f.id)}>Remove</Button>
          )}
        </div>
      ))}
      {!verified.length && !enrolling && <span className="muted">Off</span>}
      {enrolling ? (
        <form className="auth-form" onSubmit={confirm} noValidate>
          <span>Scan this with your authenticator app, then type the 6-digit code it shows.</span>
          <img className="mfa-qr" src={enrolling.qr} alt="QR code for your authenticator app" />
          <span className="mfa-secret">Or enter this key by hand: <code>{enrolling.secret}</code></span>
          <Field label="Code" auto="one-time-code" value={code} onChange={setCode} autoFocus />
          <div className="account-actions">
            <Button type="submit" variant="primary" loading={busy}>Turn on</Button>
            <Button onClick={() => { setEnrolling(null); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        !verified.length && <div className="account-actions"><Button onClick={() => void start()} loading={busy}>Set up an authenticator app</Button></div>
      )}
    </div>
  );
}

interface PasskeyRow { id: string; friendly_name?: string; created_at: string; last_used_at?: string }

export function Passkeys() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const { busy, error, run } = useSubmit();

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.passkey.list();
    setRows(error ? [] : ((data ?? []) as PasskeyRow[]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = run(async () => {
    const { error } = await supabase.auth.registerPasskey();
    if (error) return explain(error);
    toast("Passkey added", { tone: "good" });
    await load();
  });

  const remove = (id: string) => run(async () => {
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (error) return explain(error);
    await load();
  });

  return (
    <div className="account-stack">
      <Notice>{error}</Notice>
      {rows === null ? <span className="muted">Loading</span> : rows.length === 0 ? <span className="muted">None yet</span> : rows.map((p) => (
        <div key={p.id} className="account-actions" style={{ alignItems: "center" }}>
          <span>{p.friendly_name ?? "Passkey"} <span className="muted small">added {new Date(p.created_at).toLocaleDateString()}</span></span>
          <Button size="sm" variant="danger" loading={busy} onClick={() => void remove(p.id)()}>Remove</Button>
        </div>
      ))}
      <div className="account-actions"><Button onClick={() => void add()} loading={busy}>Add a passkey</Button></div>
    </div>
  );
}
