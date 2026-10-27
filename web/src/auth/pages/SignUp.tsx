// Create an account: email first, then a password and the terms. With email confirmation
// on (auth/CHECKLIST.md), sign-up ends on "check your email", where the 6-digit code from
// the email can be typed, or the link in the email clicked. With it off, sign-up signs the
// person straight in.
import { useState } from "react";
import { explain, requireClient } from "../client";
import { Field, LEAVING, Notice, PasswordField, Submit, TextButton, useSubmit, Who } from "../fields";
import { Screen, SwitchLink, useFlow } from "../flow";
import { passwordsMatch } from "../PasswordMeter";
import { emailLanding } from "../redirect";
import { codeProblem, emailProblem, passwordProblem } from "../rules";
import { welcomeNew } from "../session";
import { track } from "../../lib/analytics";
import { ProviderButtons } from "./Providers";

export function SignUp() {
  const { next, email, setEmail, carry, show } = useFlow();
  const [step, setStep] = useState<"email" | "password">("email");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(carry.check ?? null);
  const form = useSubmit();

  const toPassword = form.run(async () => {
    const bad = emailProblem(email);
    if (bad) return { field: "email", message: bad };
    setStep("password");
  });

  const submit = form.run(async () => {
    const bad = passwordProblem(password);
    if (bad) return { field: "password", message: bad };
    if (!passwordsMatch(password, again)) return { field: "again", message: "Passwords do not match." };
    if (!agreed) return { field: "terms", message: "Please agree to the terms and the privacy policy to continue." };
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: emailLanding(next) },
    });
    if (error) return explain(error);
    track("sign_up", { method: "email" });
    if (data.session) { await welcomeNew(show); return LEAVING; }
    // No session: confirmation is on. Supabase answers the same way for an address that
    // already has an account, so nobody can use this form to find out who has one.
    setSentTo(email.trim());
  });

  if (sentTo) return <CheckEmail email={sentTo} />;

  if (step === "password") {
    const termsError = form.errorFor("terms");
    return (
      <Screen id="signup-password" title="Create your account" lead={<Who email={email.trim()} onChange={() => { form.setProblem(null); setStep("email"); }} />}>
        <form className="pa-form" onSubmit={submit} noValidate>
          <input type="email" name="email" autoComplete="username" value={email.trim()} readOnly hidden />
          <PasswordField label="Choose a password" auto="new-password" value={password} onChange={setPassword} rules email={email} autoFocus error={form.errorFor("password")} />
          <PasswordField label="Confirm password" auto="new-password" name="confirm-password" value={again} onChange={setAgain} match={password} error={form.errorFor("again")} />
          <label className="pa-check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required
              aria-invalid={termsError ? true : undefined} aria-describedby={termsError ? "pa-terms-err" : undefined} />
            <span>I agree to the <a href="/legal/terms/" target="_blank" rel="noopener">terms</a> and have read the <a href="/legal/privacy/" target="_blank" rel="noopener">privacy policy</a> and the <a href="/legal/risk/" target="_blank" rel="noopener">risk notice</a>. Each opens in a new tab.</span>
          </label>
          {termsError && <span className="pa-error" id="pa-terms-err" role="alert">{termsError}</span>}
          <Notice>{form.general}</Notice>
          <Submit busy={form.busy} disabled={!passwordsMatch(password, again)}>Create account</Submit>
        </form>
      </Screen>
    );
  }

  return (
    <Screen id="signup-email" title="Create your account" lead="Free. One account for Parity, Sim World and Parity Trade.">
      <ProviderButtons onError={(m) => form.setProblem(m ? { message: m } : null)} />
      <form className="pa-form" onSubmit={toPassword} noValidate>
        <Field label="Email" type="email" auto="username" value={email} onChange={setEmail} autoFocus error={form.errorFor("email")} />
        <Notice>{form.general}</Notice>
        <Submit busy={form.busy}>Continue</Submit>
      </form>
      <p className="pa-switch">Already have an account? <SwitchLink to="login">Log in</SwitchLink></p>
    </Screen>
  );
}

/** The verification-required step: confirm by link, or type the code here. */
export function CheckEmail({ email }: { email: string }) {
  const { next, show } = useFlow();
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const form = useSubmit();
  const resend = useSubmit();

  const verify = form.run(async () => {
    const bad = codeProblem(code);
    if (bad) return { field: "code", message: bad };
    const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: "signup" });
    if (error) return { field: "code", message: explain(error) ?? "Something went wrong. Try again." };
    await welcomeNew(show);
    return LEAVING;
  });

  const again = resend.run(async () => {
    setResent(false);
    const { error } = await requireClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: emailLanding(next) } });
    if (error) return explain(error);
    setResent(true);
  });

  return (
    <Screen id="signup-check" title="Check your email" lead={<>We sent a link and a 6-digit code to <strong>{email}</strong>. Confirm your address to finish. You cannot log in until you do.</>}>
      <form className="pa-form" onSubmit={verify} noValidate>
        <Field label="Code from the email" auto="one-time-code" value={code} onChange={setCode} autoFocus error={form.errorFor("code")}
          hint="Not there after a minute? Check spam, or send it again." />
        <Notice>{form.general ?? resend.general}</Notice>
        <Notice tone="good">{resent ? "Sent again. The newest email is the one that works." : null}</Notice>
        <Submit busy={form.busy}>Confirm email</Submit>
      </form>
      <div className="pa-alt">
        <TextButton onClick={() => void again()} disabled={resend.busy}>{resend.busy ? "Sending" : "Send the email again"}</TextButton>
        <SwitchLink className="pa-text" to="login">Back to log in</SwitchLink>
      </div>
    </Screen>
  );
}
