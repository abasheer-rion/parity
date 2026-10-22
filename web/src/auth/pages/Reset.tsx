// /reset/: without a session, ask for a reset email (Forgot). With one (from the reset
// link, the code, or an invite), choose a new password, then carry on to ?next=.
import { useEffect, useState } from "react";
import { Button, toast } from "../../ui";
import { explain, requireClient } from "../client";
import { AuthCard, Field, go, Notice, params, PasswordField, Splash, useSubmit } from "../form";
import { nextFromQuery } from "../redirect";
import { codeProblem, passwordProblem } from "../rules";
import { needsSecondStep, type SessionState } from "../session";
import { Forgot } from "./Forgot";
import { SecondStep } from "./SignIn";

export function Reset({ session }: { session: SessionState }) {
  const next = nextFromQuery();
  const invited = params().get("from") === "invite";
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [nonce, setNonce] = useState("");
  const [needCode, setNeedCode] = useState(false);
  // Supabase refuses a new password until an account with an authenticator app has typed its code.
  const [mfa, setMfa] = useState<"unknown" | "needed" | "done">("unknown");
  const { busy, error, setError, run } = useSubmit();

  const signedIn = Boolean(session.session);
  useEffect(() => {
    if (!signedIn) return;
    needsSecondStep().then((pending) => setMfa(pending ? "needed" : "done"), () => setMfa("done"));
  }, [signedIn]);

  const save = run(async () => {
    const bad = passwordProblem(password);
    if (bad) return bad;
    if (password !== again) return "The two passwords do not match.";
    if (needCode) { const c = codeProblem(nonce); if (c) return c; }
    const client = requireClient();
    const { error } = await client.auth.updateUser(needCode ? { password, nonce } : { password });
    if (error?.code === "reauthentication_needed" || error?.code === "reauth_nonce_missing") {
      const sent = await client.auth.reauthenticate();
      if (sent.error) return explain(sent.error);
      setNeedCode(true);
      return null;
    }
    if (error?.code === "insufficient_aal") { setMfa("needed"); return null; }
    if (error) return explain(error);
    toast("Password saved", { tone: "good" });
    go(next);
  });

  if (session.loading) return <Splash />;
  if (!session.session) return <Forgot next={next} onSignedIn={() => setError(null)} />;
  if (mfa === "unknown") return <Splash />;
  if (mfa === "needed") return <SecondStep next={next} title="Confirm it is you" onDone={() => setMfa("done")} />;

  return (
    <AuthCard title={invited ? "Choose a password" : "Choose a new password"} lead={session.session.user.email}>
      <Notice>{error}</Notice>
      <Notice tone="info">{needCode ? "For safety, we emailed you a 6-digit code. Type it below, then save again." : null}</Notice>
      <form className="auth-form" onSubmit={save} noValidate>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="email" autoComplete="username" value={session.session.user.email ?? ""} readOnly hidden />
        <PasswordField label="New password" auto="new-password" value={password} onChange={setPassword} rules autoFocus />
        <PasswordField label="Type it again" auto="new-password" name="confirm-password" value={again} onChange={setAgain}
          error={again && password !== again ? "Does not match yet." : null} />
        {needCode && <Field label="Code from the email" auto="one-time-code" value={nonce} onChange={setNonce} autoFocus />}
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Save password</Button>
      </form>
    </AuthCard>
  );
}
