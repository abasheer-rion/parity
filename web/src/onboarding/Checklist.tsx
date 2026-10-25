// The getting started checklist (DEC-0053): a compact panel on the product home (also what the
// desktop app shows, since it loads the live site), with a progress ring. Each item ticks
// itself when the action happens. Hide closes it; Account settings brings it back.
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Icon, Toggle } from "../ui";
import { academyUrl, productUrl, tradeUrl } from "../lib/space";
import { itemList, progress, type ItemState } from "./items";
import { refreshSignals, setChecklistHidden, setNotifyBrokerage, stampsOf, useOnboarding } from "./store";
import "./onboarding.css";

const WalletDialog = lazy(() => import("./Wallet").then((m) => ({ default: m.WalletDialog })));

/** Links from the product app to where each action happens. */
export function productLinks() {
  const connect = productUrl("").replace(/\/app\/$/, "/connect/");
  return { connect, verify: "#/verify", trade: tradeUrl("chart"), watch: tradeUrl("watchlists"), academy: academyUrl(), account: "#/settings/account" };
}

export function useChecklist() {
  const s = useOnboarding();
  const items = useMemo(() => itemList(productLinks()), []);
  return { s, p: progress(items, stampsOf(s.row), s.signals, { mfaAvailable: s.mfaAvailable }) };
}

/** A ring that fills as items are done. */
export function ProgressRing({ done, total, size = 40 }: { done: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return (
    <svg className="onb-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} of ${total} done`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="onb-ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="onb-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="onb-ring-t">{done}</text>
    </svg>
  );
}

export function Checklist() {
  const { s, p } = useChecklist();
  const [wallet, setWallet] = useState(false);
  // Read the live signals each time Home opens: an AI app may have signed in from elsewhere.
  useEffect(() => { if (s.ready) void refreshSignals(); }, [s.ready]);
  if (!s.ready || !s.checked || s.row.checklist_hidden) return null;
  const all = p.done === p.total;
  return (
    <section className="onb" data-tour="checklist" aria-labelledby="onb-title">
      <header className="onb-head">
        <ProgressRing done={p.done} total={p.total} />
        <div className="onb-head-t">
          <h2 id="onb-title">{all ? "You are all set" : "Getting started"}</h2>
          <p className="muted small">{all ? "Every item is done. You can hide this list." : `${p.done} of ${p.total} done. Each item ticks itself when you do it.`}</p>
        </div>
        <button type="button" className="onb-x" onClick={() => void setChecklistHidden(true)} aria-label="Hide the checklist" title="Hide. Bring it back from Account settings.">
          <Icon name="close" size={14} />
        </button>
      </header>
      <ol className="onb-list">
        {p.items.map((i) => (
          <Row key={i.id} item={i} detail={i.id === p.next?.id || i.id === "broker"} notify={s.row.notify_brokerage} onWallet={() => setWallet(true)} />
        ))}
      </ol>
      {wallet && <Suspense fallback={null}><WalletDialog open={wallet} onClose={() => setWallet(false)} /></Suspense>}
    </section>
  );
}

/** One item. Only the next item to do (and brokerage) shows its line, so the panel stays short. */
function Row({ item, detail, notify, onWallet }: { item: ItemState; detail: boolean; notify: boolean; onWallet: () => void }) {
  const external = !!item.href && /^(https?:)?\//.test(item.href) && !item.href.startsWith("#");
  return (
    <li className={`onb-item ${item.done ? "done" : ""} ${item.id === "broker" ? "later" : ""} ${detail && !item.done ? "next" : ""}`} data-item={item.id}>
      <span className="onb-tick" aria-hidden>{item.done ? <Icon name="check" size={12} /> : null}</span>
      <div className="onb-text">
        <strong>{item.title}</strong>
        {!item.done && detail && <span className="onb-body">{item.body}</span>}
      </div>
      <div className="onb-act">
        {item.done ? <span className="sr-only">Done</span>
          : item.id === "broker" ? (
            <label className="onb-notify"><span>Notify me</span><Toggle on={notify} onChange={(v) => void setNotifyBrokerage(v)} label="Notify me when brokerage linking is available" /></label>
          ) : item.id === "wallet" ? (
            <button type="button" className="onb-btn" onClick={onWallet}>{item.action}</button>
          ) : item.href ? (
            <a className="onb-btn" href={item.href} {...(external && !item.href.includes("/connect/") ? { target: "_blank", rel: "noopener" } : {})}>{item.action}</a>
          ) : null}
      </div>
    </li>
  );
}
