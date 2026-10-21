// Settings, laid out like Mercury's: the sidebar becomes a settings menu, and each
// page is a list of rows with the label and a short description on the left and the
// value or control on the right. Kept bare on purpose: Account and Appearance only.
// Older sections live in SettingsHidden.tsx.
import { SETTINGS_SECTIONS } from "../components/Shell";
import { AccountSettings } from "../auth";
import { Segmented, SettingsRow } from "../ui";
import { setPrefs, usePrefs, type Theme } from "../lib/prefs";

export function Settings({ section = "account" }: { section?: string }) {
  const prefs = usePrefs();
  const known = SETTINGS_SECTIONS.flatMap((g) => g.items);
  const current = known.some((i) => i.id === section) ? section : "account";
  const title = known.find((i) => i.id === current)?.label ?? "Settings";

  return (
    <div className="settings">
      <h1 className="settings-title">{title}</h1>

      {current === "account" && <AccountSettings />}

      {current === "appearance" && (
        <SettingsRow label="Theme" help="Dark is the default. System follows your computer.">
          <Segmented<Theme> value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[["dark", "Dark"], ["light", "Light"], ["system", "System"]]} />
        </SettingsRow>
      )}
    </div>
  );
}
