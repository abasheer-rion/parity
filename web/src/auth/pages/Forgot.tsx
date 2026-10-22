// Forgot password: email a reset link and code, then accept either.
import { useState } from "react";
import { Button } from "../../ui";
import { explain, requireClient } from "../client";
import { ROUTES } from "../config";
import { AuthCard, Field, Notice, useSubmit } from "../form";
import { emailLanding, withNext } from "../redirect";
import { codeProblem, emailProblem } from "../rules";

/** `onSignedIn` runs once the code from the email has signed the person in. */
export function Forgot({ next, onSignedIn }: { next: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();

  const send = run(async () => {
    const bad = emailProblem(email);
    if (bad) return bad;
    // The link in the email goes to /verify/, which then opens /reset/ to choose the
    // password and carries on to `next` (see the recovery template and Verify.tsx).
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: emailLanding(next) });
    if (error) return explain(error);
    setSent(true);
  });

  const verify = run(async () => {
    const bad = codeProblem(code);
    if (bad) return bad;
    const { error } = await requireClient().auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    if (error) return explain(error);
    onSignedIn();
  });

  return (
    <AuthCard title="Reset your password" lead={sent
      ? <>If an account exists for <strong>{email.trim()}</strong>, we sent it a link and a 6-digit code. Use either one.</>
      : "Enter your email and we will send you a link and a code to choose a new password."}>
      <Notice>{error}</Notice>
      {!sent ? (
        <form className="auth-form" onSubmit={send} noValidate>
          <Field label="Email" type="email" auto="email" value={email} onChange={setEmail} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Send reset email</Button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verify} noValidate>
          <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus />
          <Button type="submit" variant="primary" size="lg" full loading={busy}>Continue</Button>
          <button type="button" className="auth-text-btn" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
        </form>
      )}
      <div className="auth-links">
        <a href={withNext(ROUTES.login, next)}>Back to log in</a>
      </div>
    </AuthCard>
  );
}
