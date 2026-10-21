// Sign in with email and password, or with a one-time code sent by email.
import { useState } from "react";
import { Button, Segmented } from "../../ui";
import { explain, requireClient } from "../client";
import { ROUTES } from "../config";
import { AuthCard, Field, go, Notice, useSubmit } from "../form";

type Method = "password" | "code";

export function SignIn() {
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const withPassword = run(async () => {
    const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === "email_not_confirmed") {
      go(`${ROUTES.signUp}?check=${encodeURIComponent(email.trim())}`);
      return;
    }
    return explain(error);
  });

  const sendCode = run(async () => {
    const { error } = await requireClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) return explain(error);
    setCodeSent(true);
  });

  const verifyCode = run(async () => {
    const { error } = await requireClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    return explain(error);
  });

  const switchTo = (m: Method) => { setMethod(m); setCodeSent(false); setCode(""); setError(null); };

  return (
    <AuthCard title="Sign in to Parity" lead="Use your password, or get a one-time code by email.">
      <div className="auth-seg">
        <Segmented<Method> label="Sign-in method" value={method} onChange={switchTo} options={[["password", "Password"], ["code", "Email code"]]} />
      </div>
      <Notice>{error}</Notice>

      {method === "password" && (
        <form className="auth-form" onSubmit={withPassword}>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Field label="Password" type="password" auto="current-password" value={password} onChange={setPassword} />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Sign in</Button>
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
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Sign in</Button>
        </form>
      )}

      <div className="auth-links">
        <a href={ROUTES.forgot}>Forgot your password?</a>
        <a href={ROUTES.signUp}>Create an account</a>
      </div>
    </AuthCard>
  );
}
