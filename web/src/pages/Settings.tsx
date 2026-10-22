// Settings, laid out like Mercury's: the sidebar becomes a settings menu, and each
// page is a list of rows with the label and a short description on the left and the
// value or control on the right. Kept bare on purpose: Account only, since Parity is
// dark only and there is no theme to pick (DEC-0020). Older sections live in
// SettingsHidden.tsx.
import { SETTINGS_SECTIONS } from "../components/Shell";
import { AccountSettings } from "../auth";

export function Settings({ section = "account" }: { section?: string }) {
  const known = SETTINGS_SECTIONS.flatMap((g) => g.items);
  const current = known.some((i) => i.id === section) ? section : "account";
  const title = known.find((i) => i.id === current)?.label ?? "Settings";

  return (
    <div className="settings">
      <h1 className="settings-title">{title}</h1>
      {current === "account" && <AccountSettings />}
    </div>
  );
}
