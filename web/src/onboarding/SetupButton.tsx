// The setup reminder (DEC-0075): a small progress ring at the top right of the product app.
// It opens the getting started list in a popover. When an important item is still to do (verify
// your email, two-step sign-in), a gentle toast says so, at most once every three days. The ring
// goes away once every item is done or the person hides the list.
import { Suspense, useEffect, useState } from "react";
import { Popover, toast } from "../ui";
import { Checklist, ProgressRing, useChecklist, WalletDialog } from "./Checklist";
import { refreshSignals } from "./store";
import { track } from "../lib/analytics";

const IMPORTANT = ["email", "mfa"];
const NUDGED = "parity.setup.nudged.v1";
const EVERY = 3 * 24 * 3600_000;

/** True when the reminder toast may show now: never more than once every three days. */
export function nudgeDue(last: string | null, now = Date.now()): boolean {
  const t = last ? Number(last) : 0;
  return !Number.isFinite(t) || now - t >= EVERY;
}

export function SetupButton() {
  const { s, p } = useChecklist();
  const [open, setOpen] = useState(false);
  // The wallet dialog lives here, outside the popover: opening it closes the popover, and a
  // dialog inside the popover would close with it. Focus goes back to the ring afterwards.
  const [wallet, setWallet] = useState(false);
  const pending = p.items.filter((i) => !i.done && IMPORTANT.includes(i.id));
  const visible = s.ready && s.checked && !s.row.checklist_hidden && p.done < p.total;

  // Read the live signals when the app opens: an AI app may have signed in from elsewhere.
  useEffect(() => { if (s.ready) void refreshSignals(); }, [s.ready]);

  useEffect(() => {
    if (!visible || !pending.length) return;
    let last: string | null = null;
    try { last = window.localStorage.getItem(NUDGED); } catch { /* no memory: still at most once a visit */ }
    if (!nudgeDue(last)) return;
    const t = window.setTimeout(() => {
      try { window.localStorage.setItem(NUDGED, String(Date.now())); } catch { /* fine */ }
      toast(`Still to do: ${pending[0].title.toLowerCase()}.`, { action: { label: "Show", run: () => setOpen(true) }, ms: 8000 });
      track("setup_nudge", { item: pending[0].id });
    }, 4000);
    return () => window.clearTimeout(t);
  }, [visible, pending.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;
  return (
    <>
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" width={380} label="Getting started"
      trigger={() => (
        <button type="button" className="setup-btn" data-tour="setup" title={`Getting started: ${p.done} of ${p.total} done`}>
          <ProgressRing done={p.done} total={p.total} size={28} />
          <span className="setup-lbl">Setup</span>
        </button>
      )}>
      <Checklist popover onWallet={() => { setOpen(false); setWallet(true); }} />
    </Popover>
    {wallet && (
      <Suspense fallback={null}>
        <WalletDialog open={wallet} onClose={() => { setWallet(false); window.setTimeout(() => document.querySelector<HTMLElement>(".setup-btn")?.focus(), 0); }} />
      </Suspense>
    )}
    </>
  );
}
