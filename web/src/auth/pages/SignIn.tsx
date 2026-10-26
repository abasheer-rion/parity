// Log in: email first, then the password or a one-time code from an email. A provider or
// passkey shows only when one is switched on (config.ts). If the account has an
// authenticator app, a second step asks for its code.
import { useEffect, useState } from "react";
import { explain, supabase } from "../client";
import { Field, LEAVING, Notice, PasswordField, Submit, TextButton, useSubmit, Who } from "../fields";
import { Screen, SwitchLink, useFlow } from "../flow";
import { go } from "../nav";
import { emailLanding } from "../redirect";
import { codeProblem, emailProblem } from "../rules";
import { continueTo } from "../session";
import { ProviderButtons } from "./Providers";
import { track } from "../../lib/analytics";

type Step = "email" | "password" | "code" | "second";

export function SignIn() {
  const { next, email, setEmail, show, carry } = useFlow();
  const [step, setStep] = useState<Step>(carry.mfa ? "second" : "email");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // While we check for an existing session, the form stays hidden, so it never shows and vanishes.
  const [checking, setChecking] = useState(!carry.mfa);
  const form = useSubmit();
  const mail = useSubmit();

  // Already signed in (or just back from a provider): carry on.
  useEffect(() => {
    if (carry.mfa) return;
    let live = true;
    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        if ((await continueTo(next, go)) === "second-step" && live) setStep("second");
      })
      .catch(() => {})
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [next, carry.mfa]);

  const finish = async () => {
    if ((await continueTo(next, go)) === "done") return LEAVING;
    setStep("second");
    return null;
  };

  const toPassword = form.run(async () => {
    const bad = emailProblem(email);
    if (bad) return { field: "email", message: bad };
    setPassword("");
    setStep("password");
  });

  const withPassword = form.run(async () => {
    if (!password) return { field: "password", message: "Type your password." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === "email_not_confirmed") { show("signup", { check: email.trim() }); return LEAVING; }
    if (error) return { field: "password", message: explain(error) ?? "Something went wrong. Try again." };
    track("log_in", { method: "password" });
    return finish();
  });

  const sendCode = mail.run(async () => {
    const bad = emailProblem(email);
    if (bad) return bad;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: emailLanding(next) },
    });
    if (error) return explain(error);
    setCode("");
    form.setProblem(null);
    setStep("code");
  });

  const verifyCode = form.run(async () => {
    const bad = codeProblem(code);
    if (bad) return { field: "code", message: bad };
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) return { field: "code", message: explain(error) ?? "Something went wrong. Try again." };
    return finish();
  });

  if (step === "second") return <SecondStep onDone={() => go(next)} />;

  const back = () => { form.setProblem(null); mail.setProblem(null); setStep("email"); };

  if (step === "password") {
    return (
      <Screen id="login-password" title="Log in to Parity" lead={<Who email={email.trim()} onChange={back} />}>
        <form className="pa-form" onSubmit={withPassword} noValidate>
          {/* Lets password managers match the password to the right account. */}
          <input type="email" name="email" autoComplete="username" value={email.trim()} readOnly hidden />
          <PasswordField label="Password" auto="current-password" value={password} onChange={setPassword} autoFocus
            error={form.errorFor("password")}
            aside={<SwitchLink className="pa-aside" to="reset">Forgot password?</SwitchLink>} />
          <Notice>{form.general ?? mail.general}</Notice>
          <Submit busy={form.busy}>Log in</Submit>
        </form>
        <div className="pa-alt">
          <TextButton onClick={() => void sendCode()} disabled={mail.busy}>{mail.busy ? "Sending a code" : "Email me a code instead"}</TextButton>
        </div>
      </Screen>
    );
  }

  if (step === "code") {
    return (
      <Screen id="login-code" title="Log in to Parity" lead={<Who email={email.trim()} onChange={back} />}>
        <form className="pa-form" onSubmit={verifyCode} noValidate>
          <Notice tone="info">If <strong>{email.trim()}</strong> has an account, we sent it a 6-digit code. It works once and expires in 60 minutes.</Notice>
          <Field label="Code" auto="one-time-code" value={code} onChange={setCode} autoFocus error={form.errorFor("code")} />
          <Notice>{form.general ?? mail.general}</Notice>
          <Submit busy={form.busy}>Log in</Submit>
        </form>
        <div className="pa-alt">
          <TextButton onClick={() => void sendCode()} disabled={mail.busy}>{mail.busy ? "Sending" : "Send a new code"}</TextButton>
          <TextButton onClick={() => { form.setProblem(null); setStep("password"); }}>Use your password</TextButton>
        </div>
      </Screen>
    );
  }

  return (
    <Screen id="login-email" title="Log in to Parity" wait={checking}>
      <ProviderButtons onError={(m) => form.setProblem(m ? { message: m } : null)} />
      <form className="pa-form" onSubmit={toPassword} noValidate>
        <Field label="Email" type="email" auto="username" value={email} onChange={setEmail} autoFocus error={form.errorFor("email")} />
        <Notice>{form.general}</Notice>
        <Submit busy={form.busy}>Continue</Submit>
      </form>
      {/* The email typed so far goes with it, so the reset form is already filled in. */}
      <div className="pa-alt">
        <SwitchLink className="pa-text" to="reset">Forgot password?</SwitchLink>
      </div>
      <p className="pa-switch">New to Parity? <SwitchLink to="signup">Create an account</SwitchLink></p>
    </Screen>
  );
}

/**
 * The authenticator-app step, for accounts that turned on two-step sign-in. Also used
 * before choosing a new password, because Supabase asks for it there too.
 */
export function SecondStep({ onDone, title = "Two-step sign-in" }: { onDone: () => void; title?: string }) {
  const { show } = useFlow();
  const [code, setCode] = useState("");
  const { busy, run, errorFor, general } = useSubmit();

  const verify = run(async () => {
    const bad = codeProblem(code);
    if (bad) return { field: "code", message: bad };
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return explain(error);
    const factor = data.totp.find((f) => f.status === "verified");
    if (!factor) { onDone(); return LEAVING; }
    const res = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (res.error) { setCode(""); return { field: "code", message: explain(res.error) ?? "That code is wrong." }; }
    onDone();
    return LEAVING;
  });

  return (
    <Screen id={`second-${title}`} title={title} lead="Type the 6-digit code from your authenticator app.">
      <form className="pa-form" onSubmit={verify} noValidate>
        <Field label="Authenticator code" auto="one-time-code" value={code} onChange={setCode} autoFocus error={errorFor("code")} />
        <Notice>{general}</Notice>
        <Submit busy={busy}>Continue</Submit>
      </form>
      <p className="pa-switch">Lost your authenticator? Contact us from the email on your account.</p>
      <div className="pa-alt">
        <TextButton onClick={() => void supabase.auth.signOut().finally(() => show("login"))}>Use another account</TextButton>
      </div>
    </Screen>
  );
}
