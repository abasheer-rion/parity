// Forgot password: email a reset link and code, then accept either.
import { useState } from "react";
import { explain, requireClient } from "../client";
import { explainSend, waitSeconds } from "../errors";
import { EMAIL_GAP_SECONDS, Field, Notice, Submit, TextButton, useCooldown, useSubmit } from "../fields";
import { Screen, SwitchLink, useFlow } from "../flow";
import { emailLanding } from "../redirect";
import { codeProblem, emailProblem } from "../rules";

/**
 * `onSignedIn` runs once the code from the email has signed the person in. `wait` holds the
 * form hidden while the session is still being read, so the panel keeps its size.
 */
export function Forgot({ onSignedIn, wait }: { onSignedIn: () => void; wait?: boolean }) {
  const { next, email, setEmail } = useFlow();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const form = useSubmit();
  const cooldown = useCooldown();
  const left = cooldown.leftFor(email);

  const send = form.run(async () => {
    const bad = emailProblem(email);
    if (bad) return { field: "email", message: bad };
    if (left) return null;
    // The link in the email goes to /verify/, which then opens /reset/ to choose the
    // password and carries on to `next` (see the recovery template and Verify.tsx).
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: emailLanding(next) });
    // One email per address every 30 seconds: count down instead of showing an error.
    const wait = waitSeconds(error);
    if (wait) { cooldown.start(wait, email); return null; }
    if (error) return explainSend(error);
    cooldown.start(EMAIL_GAP_SECONDS, email);
    setSent(true);
  });

  const verify = form.run(async () => {
    const bad = codeProblem(code);
    if (bad) return { field: "code", message: bad };
    const { error } = await requireClient().auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    if (error) return { field: "code", message: explain(error) ?? "Something went wrong. Try again." };
    onSignedIn();
  });

  if (sent) {
    return (
      <Screen id="reset-sent" title="Check your email" lead={<>If an account exists for <strong>{email.trim()}</strong>, we sent it a link to choose a new password. The email also has a 6-digit code you can type here.</>}>
        <form className="pa-form" onSubmit={verify} noValidate>
          <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus error={form.errorFor("code")} />
          <Notice>{form.general}</Notice>
          <Submit busy={form.busy}>Continue</Submit>
        </form>
        <div className="pa-alt">
          <TextButton onClick={() => { form.setProblem(null); setSent(false); setCode(""); }}>Use a different email</TextButton>
          <SwitchLink className="pa-text" to="login">Back to log in</SwitchLink>
        </div>
      </Screen>
    );
  }

  return (
    <Screen id="reset-email" wait={wait} title="Reset your password" lead="Type your email. We will send you a link to choose a new password.">
      <form className="pa-form" onSubmit={send} noValidate>
        <Field label="Email" type="email" auto="username" value={email} onChange={setEmail} autoFocus error={form.errorFor("email")} />
        <Notice>{form.general}</Notice>
        <Notice tone="info">{left ? `We just sent an email to this address. You can send another in ${left} seconds.` : null}</Notice>
        <Submit busy={form.busy} disabled={left > 0}>{left ? `Send again in ${left}s` : "Send reset email"}</Submit>
      </form>
      <p className="pa-switch">Remembered it? <SwitchLink to="login">Back to log in</SwitchLink></p>
    </Screen>
  );
}
