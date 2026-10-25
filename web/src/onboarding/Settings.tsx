// Account settings rows for getting started (DEC-0053): bring back the checklist, show tours
// again, the brokerage "Notify me" choice, and crypto wallets.
import { lazy, Suspense, useState } from "react";
import { Button, SettingsRow, Toggle, toast } from "../ui";
import { useChecklist } from "./Checklist";
import { resetTours, setChecklistHidden, setNotifyBrokerage } from "./store";

const WalletDialog = lazy(() => import("./Wallet").then((m) => ({ default: m.WalletDialog })));

export function OnboardingSettings() {
  const { s, p } = useChecklist();
  const [wallet, setWallet] = useState(false);
  if (!s.ready) return null;
  return (
    <>
      <div data-tour="acct-checklist">
        <SettingsRow label="Getting started" help={`The checklist on Home. ${p.done} of ${p.total} done.`}>
          {s.row.checklist_hidden
            ? <Button onClick={() => { void setChecklistHidden(false); toast("The checklist is back on Home"); }}>Show checklist</Button>
            : <Button href="#/">Open on Home</Button>}
        </SettingsRow>
      </div>
      <div data-tour="acct-tours">
        <SettingsRow label="Show tours again" help={s.row.tours_off ? "Tours are off because you chose Skip all tours. Turn them back on and each opens once more." : "Each area's short tour opens once, the first time you visit. Start them all over again."}>
          <Button onClick={() => { void resetTours(); toast("Tours are on. Each one opens the next time you visit that area."); }}>Show tours again</Button>
        </SettingsRow>
      </div>
      <SettingsRow label="Crypto wallets" help="Read only. Add a public address or sign a message to prove a wallet is yours. Parity never asks for a seed phrase or private key.">
        <Button onClick={() => setWallet(true)}>Manage wallets</Button>
      </SettingsRow>
      <SettingsRow label="Brokerage account" help="Coming later, through a regulated broker partner. Parity holds no money and never asks for bank or card details.">
        <label className="onb-notify"><span>Notify me</span><Toggle on={s.row.notify_brokerage} onChange={(v) => void setNotifyBrokerage(v)} label="Notify me when brokerage linking is available" /></label>
      </SettingsRow>
      {wallet && <Suspense fallback={null}><WalletDialog open={wallet} onClose={() => setWallet(false)} /></Suspense>}
    </>
  );
}
