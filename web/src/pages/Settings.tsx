// Settings, laid out like Mercury's: the sidebar becomes a settings menu, and each
// page is a list of rows with the label and a short description on the left and the
// value or control on the right. Account, Personalization, API keys and Trade profile only, since Parity is
// dark only and there is no theme to pick (DEC-0021). Older sections live in
// SettingsHidden.tsx.
import { SETTINGS_SECTIONS } from "../components/Shell";
import { AccountSettings } from "../auth";
import { ApiKeysSettings } from "./ApiKeys";
import { TradeProfileSettings } from "../tradeProfile/TradeProfile";
import { FirstRunTour } from "../onboarding/FirstRunTour";
import { PersonalizationSettings } from "../components/PersonalizationSettings";
import { OnboardingSettings } from "../onboarding/Settings";
import { MotionControl, MotionHelp, SettingsRow } from "../ui";

export function Settings({ section = "account" }: { section?: string }) {
  const known = SETTINGS_SECTIONS.flatMap((g) => g.items);
  const current = known.some((i) => i.id === section) ? section : "account";
  const title = known.find((i) => i.id === current)?.label ?? "Settings";

  return (
    <div className="settings">
      <h1 className="settings-title">{title}</h1>
      {current === "account" && <><AccountSettings /><OnboardingSettings /><FirstRunTour areas={["account"]} /></>}
      {current === "personalization" && <PersonalizationSettings />}
      {current === "api-keys" && <ApiKeysSettings />}
      {current === "trade-profile" && <TradeProfileSettings />}
      {current === "account" && (
        <section className="settings-motion" aria-labelledby="set-motion">
          <h2 id="set-motion" className="settings-sub">Motion</h2>
          <SettingsRow label="Motion" help={<MotionHelp />}><MotionControl /></SettingsRow>
        </section>
      )}
    </div>
  );
}
