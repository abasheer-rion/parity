// Forgot password: email a reset link and code, then accept either.
import { useState } from "react";
import { Button } from "../../ui";
import { explain, requireClient } from "../client";
import { ROUTES } from "../config";
import { AuthCard, Field, Notice, useSubmit } from "../form";

export function Forgot() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();

  const send = run(async () => {
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${ROUTES.reset}` });
    if (error) return explain(error);
    setSent(true);
  });

  const verify = run(async () => {
    const { error } = await requireClient().auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    if (error) return explain(error);
    window.location.reload();
  });

  return (
    <AuthCard title="Reset your password" lead={sent
      ? <>If an account exists for <strong>{email.trim()}</strong>, we sent it a link and a code. Use either one.</>
      : "Enter your email and we will send you a link and a code to choose a new password."}>
      <Notice>{error}</Notice>
      {!sent ? (
        <form className="auth-form" onSubmit={send}>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Send reset email</Button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verify}>
          <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Continue</Button>
        </form>
      )}
      <div className="auth-links">
        <a href={ROUTES.login}>Back to log in</a>
      </div>
    </AuthCard>
  );
}
