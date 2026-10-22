// Choose a new password. Reached after a reset or invite link (or code) signs you in.
import { useState } from "react";
import { Button, toast } from "../../ui";
import { explain, requireClient } from "../client";
import { PASSWORD_MIN, ROUTES } from "../config";
import { AuthCard, Field, go, Notice, params, useSubmit } from "../form";
import { Forgot } from "./Forgot";
import type { SessionState } from "../session";

export function Reset({ session }: { session: SessionState }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const { busy, error, run } = useSubmit();
  const invited = params().get("from") === "invite";

  const save = run(async () => {
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
    if (password !== again) return "The two passwords do not match.";
    const { error } = await requireClient().auth.updateUser({ password });
    if (error) return explain(error);
    toast("Password saved", { tone: "good" });
    go(ROUTES.app);
  });

  // No session: this is the "forgot password" request. With one (from the email link
  // or code), choose the new password.
  if (session.loading) return <div className="auth-splash">Loading</div>;
  if (!session.session) return <Forgot />;

  return (
    <AuthCard title={invited ? "Choose a password" : "Choose a new password"} lead={session.session?.user.email}>
      <Notice>{error}</Notice>
      <form className="auth-form" onSubmit={save}>
        <Field label="New password" type="password" auto="new-password" value={password} onChange={setPassword}
          minLength={PASSWORD_MIN} hint={`At least ${PASSWORD_MIN} characters, with letters and numbers.`} autoFocus />
        <Field label="Type it again" type="password" auto="new-password" name="confirm-password" value={again} onChange={setAgain} />
        <Button type="submit" variant="primary" size="lg" full loading={busy}>Save password</Button>
      </form>
    </AuthCard>
  );
}
