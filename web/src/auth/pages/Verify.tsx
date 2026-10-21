// Where every email link lands: #/auth/verify?type=...&token_hash=...
// It asks for one click before using the token, because some mail filters open every
// link in an email to scan it, and that would use up a one-time link before you can.
import type { EmailOtpType } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "../../ui";
import { explain, requireClient } from "../client";
import { ROUTES } from "../config";
import { AuthCard, go, hashParams, Notice, useSubmit } from "../form";

const COPY: Record<string, { title: string; lead: string; button: string }> = {
  email: { title: "Confirm your email", lead: "One click to confirm your address and sign in.", button: "Confirm and sign in" },
  signup: { title: "Confirm your email", lead: "One click to confirm your address and sign in.", button: "Confirm and sign in" },
  magiclink: { title: "Sign in to Parity", lead: "One click to finish signing in.", button: "Sign in" },
  recovery: { title: "Reset your password", lead: "Continue to choose a new password.", button: "Continue" },
  invite: { title: "Accept your invite", lead: "Continue to join Parity and choose a password.", button: "Accept the invite" },
  email_change: { title: "Confirm your new email", lead: "One click to confirm the change of address.", button: "Confirm the change" },
};

export function Verify() {
  const params = hashParams();
  const type = params.get("type") ?? "";
  const tokenHash = params.get("token_hash") ?? "";
  const copy = COPY[type];
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();

  const confirm = run(async () => {
    const { data, error } = await requireClient().auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) return explain(error);
    if (type === "recovery") return go(ROUTES.reset);
    if (type === "invite") return go(`${ROUTES.reset}?from=invite`);
    if (type === "email_change") {
      const pending = data.user?.new_email;
      setDone(pending
        ? `Confirmed here. Now confirm from the email sent to ${pending} as well.`
        : "Your email address is changed.");
      return;
    }
    go("#/");
  });

  if (!copy || !tokenHash) {
    return (
      <AuthCard title="This link is not complete" lead="Copy the whole link from the email, or ask for a new one.">
        <div className="auth-links"><a href={ROUTES.signIn}>Back to sign in</a></div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Thanks" lead={done}>
        <Button variant="primary" size="lg" full href="#/settings/account">Go to account settings</Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={copy.title} lead={copy.lead}>
      <Notice>{error}</Notice>
      <Button variant="primary" size="lg" full loading={busy} onClick={() => void confirm()}>{copy.button}</Button>
      {error && <div className="auth-links"><a href={ROUTES.signIn}>Back to sign in</a><a href={ROUTES.forgot}>Reset password</a></div>}
    </AuthCard>
  );
}
