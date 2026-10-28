// The bottom dock under the charts (positions, open orders, fills, P&L) and the full
// Orders view. Both read the shared demo account, or the broker account when the server
// carries orders (DEC-0046).
import { useState, type ReactNode } from "react";
import { Icon } from "../ui";
import { FillsTable, OrdersTable, PnlStrip, PositionsTable } from "./blotter";
import { useDemo } from "./demo";
import { BalancesStrip, BrokerFillsTable, BrokerOrdersTable, BrokerPositionsTable, ExportButton } from "./brokerBlotter";
import { useTrading } from "./trading";
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

type DockProps = { tab: DockTab; onTab: (t: DockTab) => void; open: boolean; onToggle: () => void; tz: string; onSymbol: (k: string) => void; active: string };

export function Dock(props: DockProps) {
  return useTrading().server ? <BrokerDock {...props} /> : <DemoDock {...props} />;
}

function DockToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button type="button" className="dk-tog" onClick={onToggle} aria-expanded={open} title={open ? "Collapse (Alt+B)" : "Expand (Alt+B)"} aria-label={open ? "Collapse dock" : "Expand dock"}><Icon name={open ? "chevronDown" : "chevronUp"} size={13} /></button>;
}

function BrokerDock({ tab, onTab, open, onToggle, tz }: DockProps) {
  const t = useTrading();
  const tabs: [DockTab, string][] = [["positions", `Positions ${t.positions.length}`], ["orders", `Orders ${t.open.length}`], ["fills", "Fills"], ["pnl", "Balances"]];
  return (
    <section className="dk" aria-label="Account dock">
      <Tabs value={tab} onChange={(v) => { onTab(v); if (!open) onToggle(); }} tabs={tabs} label="Account">
        <span className="dk-gap" />
        <span className="dk-eq tabular" title="Equity">{t.balances?.equity != null ? `$${t.balances.equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : ""}</span>
        <DockToggle open={open} onToggle={onToggle} />
      </Tabs>
      {open && (
        <div className="dk-body" role="tabpanel">
          {tab === "positions" && <BrokerPositionsTable />}
          {tab === "orders" && <BrokerOrdersTable rows={t.open} tz={tz} actions />}
          {tab === "fills" && <BrokerFillsTable tz={tz} />}
          {tab === "pnl" && <BalancesStrip wide />}
        </div>
      )}
    </section>
  );
}

function DemoDock({ tab, onTab, open, onToggle, tz, onSymbol, active }: DockProps) {
  const d = useDemo();
  const tabs: [DockTab, string][] = [["positions", `Positions ${d.holdings.length}`], ["orders", `Orders ${d.open.length}`], ["fills", "Fills"], ["pnl", "P&L"]];
  return (
    <section className="dk" aria-label="Account dock">
      <Tabs value={tab} onChange={(t) => { onTab(t); if (!open) onToggle(); }} tabs={tabs} label="Account">
        <span className="dk-gap" />
        <span className="dk-eq tabular" title="Equity">{d.book ? `$${d.equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : ""}</span>
        <DockToggle open={open} onToggle={onToggle} />
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
  return useTrading().server ? <BrokerOrdersView tz={tz} /> : <DemoOrdersView tz={tz} />;
}

function BrokerOrdersView({ tz }: { tz: string }) {
  const t = useTrading();
  const [tab, setTab] = useState<"open" | "history" | "fills">("open");
  return (
    <div className="view">
      <Tabs value={tab} onChange={setTab} label="Orders" tabs={[["open", `Open ${t.open.length}`], ["history", `History ${t.done.length}`], ["fills", `Fills ${t.fills.length}`]]}>
        <span className="dk-gap" />
        <ExportButton />
      </Tabs>
      {t.error && <p className="ot-problem">{t.error}</p>}
      <section className="vbox vbox-fill" aria-label="Orders">
        {tab === "open" && <BrokerOrdersTable rows={t.open} tz={tz} actions />}
        {tab === "history" && <BrokerOrdersTable rows={t.done} tz={tz} />}
        {tab === "fills" && <BrokerFillsTable tz={tz} />}
      </section>
    </div>
  );
}

function DemoOrdersView({ tz }: { tz: string }) {
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
