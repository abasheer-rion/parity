// Create an account. While email confirmation is off (auth/README.md), sign-up signs
// the person straight in and goes to the app. When it is on, it ends on the "check your
// email" screen, where the code from the email can also be typed.
import { useState } from "react";
import { Button } from "../../ui";
import { explain, requireClient } from "../client";
import { PASSWORD_MIN, ROUTES } from "../config";
import { ProviderButtons } from "./Providers";
import { AuthCard, Field, go, Notice, params, useSubmit } from "../form";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(() => params().get("check"));
  const { busy, error, setError, run } = useSubmit();

  const submit = run(async () => {
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}${ROUTES.login}` },
    });
    if (error) return explain(error);
    if (data.session) return go(ROUTES.app);
    setSentTo(email.trim());
  });

  if (sentTo) return <CheckEmail email={sentTo} />;

  return (
    <AuthCard title="Create your account" lead="Free. Research only, not investment advice.">
      <ProviderButtons onError={setError} />
      <Notice>{error}</Notice>
      <form className="auth-form" onSubmit={submit}>
        <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
        <Field label="Password" type="password" auto="new-password" value={password} onChange={setPassword}
          minLength={PASSWORD_MIN} hint={`At least ${PASSWORD_MIN} characters, with letters and numbers.`} />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Create account</Button>
      </form>
      <div className="auth-links">
        <span className="muted">Already have an account?</span>
        <a href={ROUTES.login}>Log in</a>
      </div>
    </AuthCard>
  );
}

/** The verification-required screen: confirm by link, or type the code here. */
export function CheckEmail({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const { busy, error, run } = useSubmit();
  const resend = useSubmit();

  const verify = run(async () => {
    const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: "signup" });
    if (error) return explain(error);
    go(ROUTES.app);
  });

  const again = resend.run(async () => {
    const { error } = await requireClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${ROUTES.login}` } });
    if (error) return explain(error);
    setResent(true);
  });

  return (
    <AuthCard title="Check your email" lead={<>We sent a link and a code to <strong>{email}</strong>. Confirm your address to finish. You cannot log in until you do.</>}>
      <Notice>{error ?? resend.error}</Notice>
      {resent && <Notice tone="good">Sent again. The newest email is the one that works.</Notice>}
      <form className="auth-form" onSubmit={verify}>
        <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Confirm email</Button>
      </form>
      <div className="auth-links">
        <button type="button" onClick={() => void again()} disabled={resend.busy}>Send the email again</button>
        <a href={ROUTES.login}>Back to log in</a>
      </div>
    </AuthCard>
  );
}
