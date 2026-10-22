// Log in with email and password, a one-time email code, a provider or a passkey.
// If the account has an authenticator app, a second step asks for its code.
import { useEffect, useState } from "react";
import { Button, Segmented } from "../../ui";
import { explain, supabase } from "../client";
import { ROUTES } from "../config";
import { AuthCard, Field, go, Notice, params, PasswordField, Splash, useSubmit } from "../form";
import { emailLanding, nextFromQuery, withNext } from "../redirect";
import { codeProblem, emailProblem } from "../rules";
import { continueTo } from "../session";
import { ProviderButtons } from "./Providers";

type Method = "password" | "code";

export function SignIn() {
  const next = nextFromQuery();
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [secondStep, setSecondStep] = useState(params().get("mfa") === "1");
  // While we check for an existing session, show a quiet placeholder, not a form that vanishes.
  const [checking, setChecking] = useState(true);
  const { busy, error, setError, run } = useSubmit();

  // Already signed in (or just back from Google or GitHub): carry on.
  useEffect(() => {
    let live = true;
    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        if ((await continueTo(next, go)) === "second-step" && live) setSecondStep(true);
      })
      .catch(() => {})
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [next]);

  const finish = async () => {
    if ((await continueTo(next, go)) === "second-step") setSecondStep(true);
  };

  const withPassword = run(async () => {
    const bad = emailProblem(email);
    if (bad) return bad;
    if (!password) return "Type your password.";
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === "email_not_confirmed") return go(withNext(`${ROUTES.signup}?check=${encodeURIComponent(email.trim())}`, next));
    if (error) return explain(error);
    await finish();
  });

  const sendCode = run(async () => {
    const bad = emailProblem(email);
    if (bad) return bad;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: emailLanding(next) },
    });
    if (error) return explain(error);
    setCodeSent(true);
  });

  const verifyCode = run(async () => {
    const bad = codeProblem(code);
    if (bad) return bad;
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) return explain(error);
    await finish();
  });

  if (secondStep) return <SecondStep next={next} onDone={() => go(next)} />;
  if (checking) return <Splash />;

  const switchTo = (m: Method) => { setMethod(m); setCodeSent(false); setCode(""); setError(null); };

  return (
    <AuthCard title="Log in to Parity">
      <ProviderButtons onError={setError} next={next} />
      <div className="auth-seg">
        <Segmented<Method> label="Log-in method" value={method} onChange={switchTo} options={[["password", "Password"], ["code", "Email code"]]} />
      </div>
      <Notice>{error}</Notice>

      {method === "password" && (
        <form className="auth-form" onSubmit={withPassword} noValidate>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <PasswordField label="Password" auto="current-password" value={password} onChange={setPassword} />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Log in</Button>
        </form>
      )}

      {method === "code" && !codeSent && (
        <form className="auth-form" onSubmit={sendCode} noValidate>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Email me a code</Button>
        </form>
      )}

      {method === "code" && codeSent && (
        <form className="auth-form" onSubmit={verifyCode} noValidate>
          <Notice tone="info">If <strong>{email.trim()}</strong> has an account, we sent it a 6-digit code. It works once and expires in 60 minutes.</Notice>
          <Field label="Code" auto="one-time-code" value={code} onChange={setCode} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Log in</Button>
          <button type="button" className="auth-text-btn" onClick={() => { setCodeSent(false); setCode(""); }}>Use a different email</button>
        </form>
      )}

      <div className="auth-links">
        <a href={withNext(ROUTES.reset, next)}>Forgot your password?</a>
        <a href={withNext(ROUTES.signup, next)}>Create an account</a>
      </div>
    </AuthCard>
  );
}

/**
 * The authenticator-app step, for accounts that turned on two-step sign-in. Also used
 * before choosing a new password, because Supabase asks for it there too.
 */
export function SecondStep({ next, onDone, title = "Two-step sign-in" }: { next: string; onDone: () => void; title?: string }) {
  const [code, setCode] = useState("");
  const { busy, error, run } = useSubmit();

  const verify = run(async () => {
    const bad = codeProblem(code);
    if (bad) return bad;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return explain(error);
    const factor = data.totp.find((f) => f.status === "verified");
    if (!factor) return onDone();
    const res = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (res.error) { setCode(""); return explain(res.error); }
    onDone();
  });

  return (
    <AuthCard title={title} lead="Type the 6-digit code from your authenticator app.">
      <Notice>{error}</Notice>
      <form className="auth-form" onSubmit={verify} noValidate>
        <Field label="Authenticator code" auto="one-time-code" value={code} onChange={setCode} autoFocus />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Continue</Button>
      </form>
      <div className="auth-links">
        <span className="muted">Lost your authenticator? Contact us from the email on your account.</span>
        <button type="button" onClick={() => void supabase.auth.signOut().finally(() => go(withNext(ROUTES.login, next)))}>Use another account</button>
      </div>
    </AuthCard>
  );
}
