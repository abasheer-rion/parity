// Settings > Account: email, password, two-step sign-in, passkeys, sign out, and a
// request to delete the account.
import { useEffect, useState } from "react";
import { Badge, Button, Dialog, SettingsRow, toast } from "../ui";
import { explain, requireClient } from "./client";
import { PASSKEYS_ENABLED, PASSWORD_MIN } from "./config";
import { Field, Notice, useSubmit } from "./form";
import { signOut, useSession, useTeamBadge } from "./session";
import { Passkeys, TwoStep } from "./SecuritySettings";

export default function AccountSettings() {
  const { session } = useSession();
  const email = session?.user.email ?? "";
  const team = useTeamBadge(session?.user.id);
  return (
    <>
      <SettingsRow label="Email" help="The address you sign in with. Changing it sends a confirmation to both the old and the new address.">
        <ChangeEmail current={email} pending={session?.user.new_email} />
        {team && <div style={{ marginTop: 8 }}><Badge tone="accent">Parity team</Badge></div>}
      </SettingsRow>
      <SettingsRow label="Password" help={`At least ${PASSWORD_MIN} characters, with letters and numbers. You may be asked for a code from your email first.`}>
        <ChangePassword />
      </SettingsRow>
      <SettingsRow label="Two-step sign-in" help="After your password, also ask for a code from an authenticator app such as 1Password, Google Authenticator or Authy.">
        <TwoStep />
      </SettingsRow>
      {PASSKEYS_ENABLED && (
        <SettingsRow label="Passkeys" help="Log in with Face ID, Touch ID or Windows Hello instead of a password. Saved to this device or your password manager.">
          <Passkeys />
        </SettingsRow>
      )}
      <SettingsRow label="Sign out" help="Ends your session in this browser.">
        <Button onClick={() => void signOut()} icon="external">Sign out</Button>
      </SettingsRow>
      <SettingsRow label="Delete my account" help="Sends a request to the owner, who deletes the account and its sign-in. Research results are shared and are not deleted.">
        <DeleteRequest userId={session?.user.id} email={email} />
      </SettingsRow>
    </>
  );
}

function ChangeEmail({ current, pending }: { current: string; pending?: string }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(pending ?? null);
  const [code, setCode] = useState("");
  const { busy, error, run } = useSubmit();

  const request = run(async () => {
    const { error } = await requireClient().auth.updateUser({ email: next.trim() }, { emailRedirectTo: `${window.location.origin}/` });
    if (error) return explain(error);
    setSentTo(next.trim());
    setOpen(false);
  });

  const verify = run(async () => {
    if (!sentTo) return;
    const { error } = await requireClient().auth.verifyOtp({ email: sentTo, token: code, type: "email_change" });
    if (error) return explain(error);
    toast("Confirmed", { tone: "good" });
    setCode("");
  });

  return (
    <div className="account-stack">
      <span>{current}</span>
      <Notice>{error}</Notice>
      {sentTo && (
        <form className="auth-form" onSubmit={verify}>
          <Notice tone="info">Waiting for you to confirm <strong>{sentTo}</strong>. Click the link in both emails, or type a code here.</Notice>
          <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} />
          <div className="account-actions"><Button type="submit" loading={busy}>Confirm</Button></div>
        </form>
      )}
      {!sentTo && !open && <div className="account-actions"><Button onClick={() => setOpen(true)}>Change email</Button></div>}
      {open && (
        <form className="auth-form" onSubmit={request}>
          <Field label="New email" type="email" auto="email" value={next} onChange={setNext} autoFocus />
          <div className="account-actions">
            <Button type="submit" variant="primary" loading={busy}>Send confirmation</Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [nonce, setNonce] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const reset = () => { setOpen(false); setPassword(""); setNonce(""); setNeedCode(false); setError(null); };

  const save = run(async () => {
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
    const client = requireClient();
    const { error } = await client.auth.updateUser(needCode ? { password, nonce } : { password });
    if (error?.code === "reauthentication_needed" || error?.code === "reauth_nonce_missing") {
      const sent = await client.auth.reauthenticate();
      if (sent.error) return explain(sent.error);
      setNeedCode(true);
      return "For safety, type the code we just emailed you, then save again.";
    }
    if (error) return explain(error);
    toast("Password changed", { tone: "good" });
    reset();
  });

  if (!open) return <div className="account-actions"><Button onClick={() => setOpen(true)}>Change password</Button></div>;
  return (
    <form className="auth-form account-stack" onSubmit={save}>
      <Notice tone={needCode ? "info" : "bad"}>{error}</Notice>
      <Field label="New password" type="password" auto="new-password" value={password} onChange={setPassword} minLength={PASSWORD_MIN} autoFocus />
      {needCode && <Field label="Code from the email" auto="one-time-code" value={nonce} onChange={setNonce} />}
      <div className="account-actions">
        <Button type="submit" variant="primary" loading={busy}>Save password</Button>
        <Button onClick={reset}>Cancel</Button>
      </div>
    </form>
  );
}

function DeleteRequest({ userId, email }: { userId?: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [requested, setRequested] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    if (!userId) return;
    requireClient().from("account_deletion_requests").select("requested_at").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setRequested((data?.requested_at as string | undefined) ?? null));
  }, [userId]);

  const send = run(async () => {
    if (!userId) return "You are not signed in.";
    const { error } = await requireClient().from("account_deletion_requests").insert({ user_id: userId, email, reason: reason.trim() || null });
    if (error) {
      if (error.code === "23505") { setRequested(new Date().toISOString()); setOpen(false); return; }
      if (error.code === "42P01" || error.code === "PGRST205") return "Deletion requests are not set up yet. Ask the owner directly.";
      return error.message;
    }
    setRequested(new Date().toISOString());
    setOpen(false);
    toast("Request sent", { tone: "good" });
  });

  if (requested) return <span className="muted">Requested on {new Date(requested).toLocaleDateString()}. The owner will confirm by email.</span>;
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Request deletion</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?" width={440}
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void send()}>Send request</Button></>}>
        <p>The owner will delete your account and sign-in for <strong>{email}</strong>. You will not be able to sign in again with it.</p>
        <Notice>{error}</Notice>
        <label className="ui-field">
          <span className="ui-field-label">Anything we should know? (optional)</span>
          <textarea className="ui-input" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: "auto" }} />
        </label>
      </Dialog>
    </>
  );
}
