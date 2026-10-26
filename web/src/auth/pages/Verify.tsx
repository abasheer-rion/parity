// Where every email link lands: /verify/?type=...&token_hash=...&next=...
// It asks for one click before using the token, because some mail filters open every
// link in an email to scan it, and that would use up a one-time link before you can.
// `next` is the address the person started from (Supabase's {{ .RedirectTo }}); it is
// checked by safeNext like every other next.
import type { EmailOtpType } from "@supabase/supabase-js";
import { useState } from "react";
import { explain, requireClient } from "../client";
import { LEAVING, Notice, params as pageParams, Submit, useSubmit } from "../fields";
import { Screen, SwitchLink, useFlow } from "../flow";
import { go } from "../nav";
import { continueTo, welcomeNew } from "../session";

const COPY: Record<string, { title: string; lead: string; button: string }> = {
  email: { title: "Confirm your email", lead: "One click to confirm your address and sign in.", button: "Confirm and continue" },
  signup: { title: "Confirm your email", lead: "One click to confirm your address and sign in.", button: "Confirm and continue" },
  magiclink: { title: "Sign in to Parity", lead: "One click to finish signing in.", button: "Sign in" },
  recovery: { title: "Reset your password", lead: "Continue to choose a new password.", button: "Continue" },
  invite: { title: "Accept your invite", lead: "Continue to join Parity and choose a password.", button: "Accept the invite" },
  email_change: { title: "Confirm your new email", lead: "One click to confirm the change of address.", button: "Confirm the change" },
};

export function Verify() {
  const { next, show } = useFlow();
  const [{ type, tokenHash }] = useState(() => {
    const q = pageParams();
    return { type: q.get("type") ?? "", tokenHash: q.get("token_hash") ?? "" };
  });
  const copy = COPY[type];
  const [done, setDone] = useState<string | null>(null);
  const { busy, general, run } = useSubmit();

  const confirm = run(async () => {
    const { data, error } = await requireClient().auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) return explain(error);
    // A reset link or an invite signs the person in; the reset form then asks for the password.
    if (type === "recovery" || type === "invite") { show("reset", { invite: type === "invite" }); return LEAVING; }
    if (type === "email_change") {
      const pending = data.user?.new_email;
      setDone(pending
        ? `Confirmed here. Now confirm from the email sent to ${pending} as well.`
        : "Your email address is changed.");
      return;
    }
    // A new account gets the short welcome first; it ends at next.
    if (type === "signup") { await welcomeNew(show); return LEAVING; }
    if ((await continueTo(next, go)) === "second-step") show("login", { mfa: true });
    return LEAVING;
  });

  if (!copy || !tokenHash) {
    return (
      <Screen id="verify-broken" title="This link is not complete" lead="Copy the whole link from the email, or ask for a new one.">
        <div className="pa-alt">
          <SwitchLink className="pa-text" to="login">Back to log in</SwitchLink>
          <SwitchLink className="pa-text" to="reset">Reset password</SwitchLink>
        </div>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen id="verify-done" title="Thanks" lead={done}>
        <a className="btn primary pa-btn" href="/app/#/settings/account">Go to account settings</a>
      </Screen>
    );
  }

  return (
    <Screen id="verify" title={copy.title} lead={copy.lead}>
      <div className="pa-form">
        <Notice>{general}</Notice>
        <Submit type="button" busy={busy} onClick={() => void confirm()} autoFocus>{copy.button}</Submit>
      </div>
      {general && (
        <div className="pa-alt">
          <SwitchLink className="pa-text" to="login">Back to log in</SwitchLink>
          <SwitchLink className="pa-text" to="reset">Send a new reset email</SwitchLink>
        </div>
      )}
    </Screen>
  );
}
