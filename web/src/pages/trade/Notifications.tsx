// The bell in the Trade header: alerts that have fired, newest first, with a count of
// the ones not seen yet. Alerts fire in the app only; nothing is emailed or pushed.
import { useMemo, useState } from "react";
import { Button, EmptyState, Icon, Popover, toast } from "../../ui";
import { useRows } from "../../lib/userStore";
import type { Instrument } from "../../lib/tradeData";
import { alertsTable, alertText, alertValueText, readSeen, writeSeen } from "./trackers";

export function NotificationsBell({ list }: { list: Instrument[] }) {
  const alerts = useRows(alertsTable, "trade_alerts");
  const [seen, setSeen] = useState(readSeen);
  const fired = useMemo(() => alerts.rows.filter((a) => a.triggered_at).sort((a, b) => (b.triggered_at ?? "").localeCompare(a.triggered_at ?? "")), [alerts.rows]);
  const unseen = fired.filter((a) => (a.triggered_at ?? "") > seen).length;
  const name = (key: string) => { const s = list.find((x) => x.key === key); return s ? s.short || s.label : key; };
  const onOpen = (open: boolean) => {
    if (!open || !fired.length) return;
    const now = new Date().toISOString();
    writeSeen(now);
    setSeen(now);
  };
  return (
    <Popover label="Alert notifications" width={340} placement="bottom-end" onOpenChange={onOpen}
      trigger={() => (
        <button type="button" className="ui-iconbtn ui-iconbtn-soft tr-bell" aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}>
          <Icon name="bell" size={16} />
          <span className="tr-bell-dot" data-on={unseen > 0 || undefined} aria-hidden>{unseen > 9 ? "9+" : unseen || ""}</span>
        </button>
      )}>
      {(close) => (
        <div className="tr-notes">
          <div className="tr-notes-head"><strong>Alerts that fired</strong><span className="muted small">Checked on delayed daily closes</span></div>
          {fired.length === 0 ? (
            <EmptyState title="Nothing yet" icon="bell">Set an alert from a watchlist. When one fires, it shows here and as a message at the bottom of the screen.</EmptyState>
          ) : (
            <ul className="tr-notes-list">
              {fired.slice(0, 30).map((a) => (
                <li key={a.id}>
                  <a href={`#/trade?s=${encodeURIComponent(a.symbol)}`} onClick={close}><strong>{name(a.symbol)}</strong> {alertText(a)}</a>
                  <span className="muted small">Close of {a.triggered_bar}: {alertValueText(a, a.triggered_value)}</span>
                  <Button size="sm" variant="tertiary" onClick={() => alertsTable.remove(a.id).catch((e: Error) => toast(e.message, { tone: "bad" }))}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
