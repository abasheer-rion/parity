// Log in with email and password, a one-time email code, a provider or a passkey.
// If the account has an authenticator app, a second step asks for its code.
import { useEffect, useState } from "react";
import { Button, Segmented } from "../../ui";
import { explain, supabase } from "../client";
import { nextPath, ROUTES } from "../config";
import { AuthCard, Field, go, Notice, params, useSubmit } from "../form";
import { needsSecondStep } from "../session";
import { ProviderButtons } from "./Providers";

type Method = "password" | "code";

export function SignIn() {
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [secondStep, setSecondStep] = useState(params().get("mfa") === "1");
  const { busy, error, setError, run } = useSubmit();

  // Already signed in (or just back from Google or GitHub): carry on to the app.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (await needsSecondStep()) setSecondStep(true);
      else go(nextPath());
    });
  }, []);

  const finish = async () => {
    if (await needsSecondStep()) { setSecondStep(true); return; }
    go(nextPath());
  };

  const withPassword = run(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === "email_not_confirmed") return go(`${ROUTES.signup}?check=${encodeURIComponent(email.trim())}`);
    if (error) return explain(error);
    await finish();
  });

  const sendCode = run(async () => {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) return explain(error);
    setCodeSent(true);
  });

  const verifyCode = run(async () => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) return explain(error);
    await finish();
  });

  if (secondStep) return <SecondStep />;

  const switchTo = (m: Method) => { setMethod(m); setCodeSent(false); setCode(""); setError(null); };

  return (
    <AuthCard title="Log in to Parity">
      <ProviderButtons onError={setError} />
      <div className="auth-seg">
        <Segmented<Method> label="Log-in method" value={method} onChange={switchTo} options={[["password", "Password"], ["code", "Email code"]]} />
      </div>
      <Notice>{error}</Notice>

      {method === "password" && (
        <form className="auth-form" onSubmit={withPassword}>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Field label="Password" type="password" auto="current-password" value={password} onChange={setPassword} />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Log in</Button>
        </form>
      )}

      {method === "code" && !codeSent && (
        <form className="auth-form" onSubmit={sendCode}>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Email me a code</Button>
        </form>
      )}

      {method === "code" && codeSent && (
        <form className="auth-form" onSubmit={verifyCode}>
          <Notice tone="info">We sent a code to <strong>{email.trim()}</strong>. It works once and expires in 60 minutes.</Notice>
          <Field label="Code" auto="one-time-code" value={code} onChange={setCode} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Log in</Button>
        </form>
      )}

      <div className="auth-links">
        <a href={ROUTES.reset}>Forgot your password?</a>
        <a href={ROUTES.signup}>Create an account</a>
      </div>
    </AuthCard>
  );
}

/** The authenticator-app step for accounts that turned on two-step sign-in. */
function SecondStep() {
  const [code, setCode] = useState("");
  const { busy, error, run } = useSubmit();

  const verify = run(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return explain(error);
    const factor = data.totp.find((f) => f.status === "verified");
    if (!factor) return go(nextPath());
    const res = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (res.error) return explain(res.error);
    go(nextPath());
  });

  return (
    <AuthCard title="Two-step sign-in" lead="Type the 6-digit code from your authenticator app.">
      <Notice>{error}</Notice>
      <form className="auth-form" onSubmit={verify}>
        <Field label="Code" auto="one-time-code" value={code} onChange={setCode} autoFocus />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Continue</Button>
      </form>
      <div className="auth-links">
        <button type="button" onClick={() => void supabase.auth.signOut().then(() => go(ROUTES.login))}>Use another account</button>
      </div>
    </AuthCard>
  );
}
