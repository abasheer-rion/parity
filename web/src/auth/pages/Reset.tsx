// Reset: without a session, ask for a reset email (Forgot). With one (from the reset link,
// the code, or an invite), choose a new password, then carry on to ?next=.
import { useEffect, useState } from "react";
import { explain, requireClient } from "../client";
import { Field, LEAVING, Notice, PasswordField, Submit, useSubmit } from "../fields";
import { Screen, useFlow } from "../flow";
import { go } from "../nav";
import { codeProblem, passwordProblem } from "../rules";
import { needsSecondStep, useSession } from "../session";
import { Forgot } from "./Forgot";
import { SecondStep } from "./SignIn";

export function Reset() {
  const { next, carry } = useFlow();
  const session = useSession();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [nonce, setNonce] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [saved, setSaved] = useState(false);
  // Supabase refuses a new password until an account with an authenticator app has typed its code.
  const [mfa, setMfa] = useState<"unknown" | "needed" | "done">("unknown");
  const form = useSubmit();

  const signedIn = Boolean(session.session);
  useEffect(() => {
    if (!signedIn) return;
    needsSecondStep().then((pending) => setMfa(pending ? "needed" : "done"), () => setMfa("done"));
  }, [signedIn]);

  const save = form.run(async () => {
    const bad = passwordProblem(password);
    if (bad) return { field: "password", message: bad };
    if (password !== again) return { field: "again", message: "The two passwords do not match." };
    if (needCode) { const c = codeProblem(nonce); if (c) return { field: "nonce", message: c }; }
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
    setSaved(true);
    go(next);
    return LEAVING;
  });

  const title = carry.invite ? "Choose a password" : "Choose a new password";
  if (session.loading) return <Forgot wait onSignedIn={() => form.setProblem(null)} />;
  if (!session.session) return <Forgot onSignedIn={() => form.setProblem(null)} />;
  if (mfa === "unknown") return <Screen id="reset-wait" title={title} wait />;
  if (mfa === "needed") return <SecondStep title="Confirm it is you" onDone={() => setMfa("done")} />;

  const againError = form.errorFor("again") ?? (again && password !== again ? "Does not match yet." : null);
  return (
    <Screen id="reset-choose" title={title} lead={session.session.user.email}>
      <form className="pa-form" onSubmit={save} noValidate>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="email" autoComplete="username" value={session.session.user.email ?? ""} readOnly hidden />
        <PasswordField label="New password" auto="new-password" value={password} onChange={setPassword} rules email={session.session.user.email} autoFocus error={form.errorFor("password")} />
        <PasswordField label="Type it again" auto="new-password" name="confirm-password" value={again} onChange={setAgain} error={againError} />
        <Notice tone="info">{needCode ? "For safety, we emailed you a 6-digit code. Type it below, then save again." : null}</Notice>
        {needCode && <Field label="Code from the email" auto="one-time-code" value={nonce} onChange={setNonce} autoFocus error={form.errorFor("nonce")} />}
        <Notice>{form.general}</Notice>
        <Notice tone="good">{saved ? "Password saved. Opening Parity." : null}</Notice>
        <Submit busy={form.busy}>Save password</Submit>
      </form>
    </Screen>
  );
}
