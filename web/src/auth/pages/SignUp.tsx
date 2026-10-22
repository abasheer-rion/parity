// Create an account. With email confirmation on (auth/CHECKLIST.md), sign-up ends on the
// "check your email" screen, where the 6-digit code from the email can be typed, or the
// link in the email clicked. With it off, sign-up signs the person straight in.
import { useState } from "react";
import { Button } from "../../ui";
import { explain, requireClient } from "../client";
import { ROUTES } from "../config";
import { AuthCard, Field, go, Notice, params, PasswordField, useSubmit } from "../form";
import { emailLanding, nextFromQuery, withNext } from "../redirect";
import { codeProblem, emailProblem, passwordProblem } from "../rules";
import { continueTo, secondStepUrl } from "../session";
import { ProviderButtons } from "./Providers";

export function SignUp() {
  const next = nextFromQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(() => params().get("check"));
  const { busy, error, setError, run } = useSubmit();

  const submit = run(async () => {
    const bad = emailProblem(email) ?? passwordProblem(password);
    if (bad) return bad;
    if (!agreed) return "Please agree to the terms and the privacy policy to continue.";
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: emailLanding(next) },
    });
    if (error) return explain(error);
    if (data.session) { await continueTo(next, go); return; }
    // No session: confirmation is on. Supabase answers the same way for an address that
    // already has an account, so nobody can use this form to find out who has one.
    setSentTo(email.trim());
  });

  if (sentTo) return <CheckEmail email={sentTo} next={next} />;

  return (
    <AuthCard title="Create your account" lead="Free. Research and education only, not investment advice.">
      <ProviderButtons onError={setError} next={next} />
      <Notice>{error}</Notice>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
        <PasswordField label="Password" auto="new-password" value={password} onChange={setPassword} rules />
        <label className="auth-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
          <span>I agree to the <a href="/legal/terms/" target="_blank" rel="noopener">terms</a> and have read the <a href="/legal/privacy/" target="_blank" rel="noopener">privacy policy</a> and the <a href="/legal/risk/" target="_blank" rel="noopener">risk notice</a>. (Each opens in a new tab.)</span>
        </label>
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Create account</Button>
      </form>
      <div className="auth-links">
        <span className="muted">Already have an account?</span>
        <a href={withNext(ROUTES.login, next)}>Log in</a>
      </div>
    </AuthCard>
  );
}

/** The verification-required screen: confirm by link, or type the code here. */
export function CheckEmail({ email, next }: { email: string; next: string }) {
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const { busy, error, run } = useSubmit();
  const resend = useSubmit();

  const verify = run(async () => {
    const bad = codeProblem(code);
    if (bad) return bad;
    const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: "signup" });
    if (error) return explain(error);
    if ((await continueTo(next, go)) === "second-step") go(secondStepUrl(next));
  });

  const again = resend.run(async () => {
    setResent(false);
    const { error } = await requireClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: emailLanding(next) } });
    if (error) return explain(error);
    setResent(true);
  });

  return (
    <AuthCard title="Check your email" lead={<>We sent a link and a 6-digit code to <strong>{email}</strong>. Confirm your address to finish. You cannot log in until you do.</>}>
      <Notice>{error ?? resend.error}</Notice>
      <Notice tone="good">{resent ? "Sent again. The newest email is the one that works." : null}</Notice>
      <form className="auth-form" onSubmit={verify} noValidate>
        <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus
          hint="Not there after a minute? Check spam, or send it again." />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Confirm email</Button>
      </form>
      <div className="auth-links">
        <button type="button" onClick={() => void again()} disabled={resend.busy}>{resend.busy ? "Sending" : "Send the email again"}</button>
        <a href={withNext(ROUTES.login, next)}>Back to log in</a>
      </div>
    </AuthCard>
  );
}
