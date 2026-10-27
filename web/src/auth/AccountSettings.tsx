// Settings > Account: email, password, two-step sign-in, passkeys, sign out, and a
// request to delete the account.
import { useEffect, useState } from "react";
import { LegalLinks } from "../legal/LegalLinks";
import { Badge, Button, Dialog, SettingsRow, toast } from "../ui";
import { explain, requireClient } from "./client";
import { PASSKEYS_ENABLED, PASSWORD_MIN } from "./config";
import { Field, Notice, PasswordField, useSubmit } from "./form";
import { passwordsMatch } from "./PasswordMeter";
import { emailLanding } from "./redirect";
import { codeProblem, emailProblem, passwordProblem } from "./rules";
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
        <ChangePassword email={email} />
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
      <SettingsRow label="Privacy and legal" help="What we keep about you, the rules for using Parity, and the cookies we use. Research and education only. Not investment advice.">
        <LegalLinks className="start" />
      </SettingsRow>
    </>
  );
}

function ChangeEmail({ current, pending }: { current: string; pending?: string }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(pending ?? null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const { busy, error, setError, run } = useSubmit();

  // The session loads after the first render, so pick up a pending change when it arrives.
  useEffect(() => { setSentTo(pending ?? null); }, [pending]);

  const request = run(async () => {
    const bad = emailProblem(next);
    if (bad) return bad;
    if (next.trim().toLowerCase() === current.toLowerCase()) return "That is already your email.";
    const { error } = await requireClient().auth.updateUser({ email: next.trim() }, { emailRedirectTo: emailLanding("/app/") });
    if (error) return explain(error);
    setSentTo(next.trim());
    setStatus(null);
    setOpen(false);
  });

  // Both addresses get a code. Try the new address first, then the current one.
  const verify = run(async () => {
    if (!sentTo) return;
    const bad = codeProblem(code);
    if (bad) return bad;
    const client = requireClient();
    let res = await client.auth.verifyOtp({ email: sentTo, token: code, type: "email_change" });
    if (res.error && current) res = await client.auth.verifyOtp({ email: current, token: code, type: "email_change" });
    if (res.error) return explain(res.error);
    setCode("");
    if (res.data.user?.new_email) {
      setStatus("One address confirmed. Now type the code sent to the other address.");
    } else {
      setSentTo(null);
      setStatus(null);
      toast("Email changed", { tone: "good" });
    }
  });

  return (
    <div className="account-stack">
      <span>{current}</span>
      <Notice>{error}</Notice>
      <Notice tone="good">{status}</Notice>
      {sentTo && (
        <form className="auth-form" onSubmit={verify} noValidate>
          <Notice tone="info">Waiting for you to confirm <strong>{sentTo}</strong>. We emailed both addresses. Click the link in each email, or type each code here.</Notice>
          <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} />
          <div className="account-actions"><Button type="submit" loading={busy}>Confirm</Button></div>
        </form>
      )}
      {!sentTo && !open && <div className="account-actions"><Button onClick={() => setOpen(true)}>Change email</Button></div>}
      {open && (
        <form className="auth-form" onSubmit={request} noValidate>
          <Field label="New email" type="email" auto="email" value={next} onChange={setNext} autoFocus />
          <div className="account-actions">
            <Button type="submit" variant="primary" loading={busy}>Send confirmation</Button>
            <Button onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChangePassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [nonce, setNonce] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const reset = () => { setOpen(false); setPassword(""); setAgain(""); setNonce(""); setNeedCode(false); setError(null); };

  const save = run(async () => {
    const bad = passwordProblem(password);
    if (bad) return bad;
    if (!passwordsMatch(password, again)) return "Passwords do not match.";
    if (needCode) { const c = codeProblem(nonce); if (c) return c; }
    const client = requireClient();
    const { error } = await client.auth.updateUser(needCode ? { password, nonce } : { password });
    if (error?.code === "reauthentication_needed" || error?.code === "reauth_nonce_missing") {
      const sent = await client.auth.reauthenticate();
      if (sent.error) return explain(sent.error);
      setNeedCode(true);
      return null;
    }
    if (error) return explain(error);
    toast("Password changed", { tone: "good" });
    reset();
  });

  if (!open) return <div className="account-actions"><Button onClick={() => setOpen(true)}>Change password</Button></div>;
  return (
    <form className="auth-form account-stack" onSubmit={save} noValidate>
      <Notice>{error}</Notice>
      <Notice tone="info">{needCode ? "For safety, we emailed you a 6-digit code. Type it below, then save again." : null}</Notice>
      <PasswordField label="New password" auto="new-password" value={password} onChange={setPassword} rules email={email} autoFocus />
      <PasswordField label="Confirm password" auto="new-password" name="confirm-password" value={again} onChange={setAgain} match={password} />
      {needCode && <Field label="Code from the email" auto="one-time-code" value={nonce} onChange={setNonce} autoFocus />}
      <div className="account-actions">
        <Button type="submit" variant="primary" loading={busy} disabled={!passwordsMatch(password, again)}>Save password</Button>
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
      if (error.code === "42P01" || error.code === "PGRST205") return "Deletion requests are not set up yet. Email us instead (see the privacy policy).";
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
          <textarea className="ui-input" rows={3} name="reason" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: "auto" }} />
        </label>
      </Dialog>
    </>
  );
}
