// The bottom dock under the charts (positions, open orders, fills, P&L) and the full
// Orders view. Both read the shared demo account.
import { useState, type ReactNode } from "react";
import { Icon } from "../ui";
import { FillsTable, OrdersTable, PnlStrip, PositionsTable } from "./blotter";
import { useDemo } from "./demo";
import type { DockTab } from "./state";

export function Tabs<T extends string>({ value, onChange, tabs, label, children }: {
  value: T; onChange: (v: T) => void; tabs: [T, string][]; label: string; children?: ReactNode;
}) {
  return (
    <div className="dk-tabs">
      <div className="dk-tablist" role="tablist" aria-label={label}>
        {tabs.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
      {children}
    </div>
  );
}

export function Dock({ tab, onTab, open, onToggle, tz, onSymbol, active }: {
  tab: DockTab; onTab: (t: DockTab) => void; open: boolean; onToggle: () => void; tz: string; onSymbol: (k: string) => void; active: string;
}) {
  const d = useDemo();
  const tabs: [DockTab, string][] = [["positions", `Positions ${d.holdings.length}`], ["orders", `Orders ${d.open.length}`], ["fills", "Fills"], ["pnl", "P&L"]];
  return (
    <section className="dk" aria-label="Account dock">
      <Tabs value={tab} onChange={(t) => { onTab(t); if (!open) onToggle(); }} tabs={tabs} label="Account">
        <span className="dk-gap" />
        <span className="dk-eq tabular" title="Equity">{d.book ? `$${d.equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : ""}</span>
        <button type="button" className="dk-tog" onClick={onToggle} aria-expanded={open} title={open ? "Collapse (Alt+B)" : "Expand (Alt+B)"} aria-label={open ? "Collapse dock" : "Expand dock"}><Icon name={open ? "chevronDown" : "chevronUp"} size={13} /></button>
      </Tabs>
      {open && (
        <div className="dk-body" role="tabpanel">
          {tab === "positions" && <PositionsTable onSymbol={onSymbol} active={active} />}
          {tab === "orders" && <OrdersTable rows={d.open} tz={tz} onCancel={d.cancelOrder} />}
          {tab === "fills" && <FillsTable rows={d.fills} tz={tz} />}
          {tab === "pnl" && <PnlStrip wide />}
        </div>
      )}
    </section>
  );
}

export function OrdersView({ tz }: { tz: string }) {
  const d = useDemo();
  const [tab, setTab] = useState<"open" | "history" | "fills">("open");
  return (
    <div className="view">
      <Tabs value={tab} onChange={setTab} label="Orders" tabs={[["open", `Open ${d.open.length}`], ["history", `History ${d.done.length}`], ["fills", `Fills ${d.fills.length}`]]} />
      <section className="vbox vbox-fill" aria-label="Orders">
        {tab === "open" && <OrdersTable rows={d.open} tz={tz} onCancel={d.cancelOrder} />}
        {tab === "history" && <OrdersTable rows={d.done} tz={tz} />}
        {tab === "fills" && <FillsTable rows={d.fills} tz={tz} />}
      </section>
    </div>
  );
}
