// Settings, laid out like Mercury's: the sidebar becomes a settings menu, and each
// page is a list of rows with the label and a short description on the left and the
// value or control on the right. Kept bare on purpose: Account and Appearance only.
// Older sections live in SettingsHidden.tsx.
import { Suspense } from "react";
import { SETTINGS_SECTIONS } from "../components/Shell";
import { AccountSettings, AUTH_ENABLED } from "../auth";
import { Button, Segmented, SettingsRow } from "../ui";
import { source } from "../lib/data";
import { setPrefs, usePrefs, type Theme } from "../lib/prefs";

export function Settings({ section = "account", email, onSignOut }: {
  section?: string;
  email?: string | null;
  onSignOut?: () => void;
}) {
  const prefs = usePrefs();
  const known = SETTINGS_SECTIONS.flatMap((g) => g.items);
  const current = known.some((i) => i.id === section) ? section : "account";
  const title = known.find((i) => i.id === current)?.label ?? "Settings";

  return (
    <div className="settings">
      <h1 className="settings-title">{title}</h1>

      {current === "account" && (AUTH_ENABLED ? (
        <Suspense fallback={<p className="muted">Loading</p>}><AccountSettings /></Suspense>
      ) : (
        <>
          <SettingsRow label="Email" help="The address you signed in with. Only the research team's emails are let in, by a one-time code from Cloudflare.">{email ?? (source === "local" ? "Local session, no sign-in" : "Loading")}</SettingsRow>
          {onSignOut && <SettingsRow label="Sign out" help="Ends the Cloudflare session in this browser. You will need a new code to come back."><Button onClick={onSignOut} icon="external">Sign out</Button></SettingsRow>}
        </>
      ))}

      {current === "appearance" && (
        <SettingsRow label="Theme" help="Dark is the default. System follows your computer.">
          <Segmented<Theme> value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[["dark", "Dark"], ["light", "Light"], ["system", "System"]]} />
        </SettingsRow>
      )}
    </div>
  );
}
