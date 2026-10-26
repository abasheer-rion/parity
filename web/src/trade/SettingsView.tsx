// Parity Trade settings (DEC-0040): defaults for new charts, time zone, density, keys,
// layouts and the demo account, and the legal links. Kept in this browser; saved layouts
// and the demo account live in the person's account.
import { useState, type ReactNode } from "react";
import { Button, MotionControl, Select, Toggle, toast, useMotionHelp } from "../ui";
import { CHART_TYPES } from "../ui/proChart";
import { TIMEFRAMES } from "../lib/bars";
import { LEGAL_PAGES } from "../legal/LegalLinks";
import { productUrl } from "../lib/space";
import type { Instrument } from "../lib/tradeData";
import { useRows } from "../lib/userStore";
import { InstrumentSelect } from "./shared";
import { CostsDialog, ResetDialog } from "./PortfolioView";
import { useDemo } from "./demo";
import { layoutsTable } from "./layouts";
import { TIME_ZONES, type Settings } from "./state";
import { HOTKEYS } from "./keys";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="st-row"><span className="st-label">{label}</span><span className="st-ctl">{children}</span></div>;
}

export function SettingsView({ list, settings, set, onResetLayout, onLoadLayout }: {
  list: Instrument[]; settings: Settings; set: (p: Partial<Settings>) => void; onResetLayout: () => void; onLoadLayout: (id: string) => void;
}) {
  const d = useDemo();
  const layouts = useRows(layoutsTable, "trade_layouts");
  const [reset, setReset] = useState(false);
  const [costs, setCosts] = useState(false);
  const help = useMotionHelp();
  return (
    <div className="view view-scroll">
      <div className="st">
        <section className="st-sec" aria-labelledby="st-chart">
          <h2 id="st-chart" className="vh">Chart</h2>
          <Row label="Default symbol"><InstrumentSelect list={list} value={settings.symbol} onChange={(symbol) => set({ symbol })} label="Default symbol" /></Row>
          <Row label="Chart type"><Select label="Chart type" value={settings.type} onChange={(type) => set({ type })} options={CHART_TYPES} /></Row>
          <Row label="Timeframe"><Select label="Timeframe" value={settings.tf} onChange={(tf) => set({ tf })} options={TIMEFRAMES.map((t) => [t.id, t.label])} /></Row>
          <Row label="Time zone"><Select label="Time zone" value={settings.tz} onChange={(tz) => set({ tz })} options={TIME_ZONES} /></Row>
          <Row label="Density"><Select label="Density" value={settings.density} onChange={(density) => set({ density })} options={[["compact", "Compact"], ["comfortable", "Comfortable"]]} /></Row>
        </section>

        <section className="st-sec" aria-labelledby="st-motion">
          <h2 id="st-motion" className="vh">Motion</h2>
          <Row label="Motion"><MotionControl /></Row>
          <p className="st-help">{help}</p>
        </section>

        <section className="st-sec" aria-labelledby="st-layout">
          <h2 id="st-layout" className="vh">Layouts</h2>
          <Row label="Current layout"><Button size="sm" icon="restart" onClick={onResetLayout}>Reset layout</Button></Row>
          {layouts.rows.map((l) => (
            <Row key={l.id} label={l.name}>
              <Button size="sm" onClick={() => onLoadLayout(l.id)}>Load</Button>
              <Button size="sm" variant="tertiary" onClick={() => layoutsTable.remove(l.id).then(() => toast("Deleted"), (e: Error) => toast(e.message, { tone: "bad" }))}>Delete</Button>
            </Row>
          ))}
          {!layouts.rows.length && <Row label="Saved layouts"><span className="vdim">{layouts.loading ? "Loading" : "None"}</span></Row>}
        </section>

        <section className="st-sec" aria-labelledby="st-keys">
          <h2 id="st-keys" className="vh">Keys</h2>
          <Row label="Type to search symbols"><Toggle on={settings.typeToSearch} onChange={(typeToSearch) => set({ typeToSearch })} label="Type to search symbols" /></Row>
          <Row label="One-key orders (Shift+B, Shift+S)"><Toggle on={settings.oneKey} onChange={(oneKey) => set({ oneKey })} label="One-key orders" /></Row>
          <Row label="Confirm orders"><Toggle on={settings.confirm} onChange={(confirm) => set({ confirm })} label="Confirm orders" /></Row>
          <table className="tt st-keys" aria-label="Keyboard shortcuts">
            <tbody>{HOTKEYS.map(([k, what]) => <tr key={k}><td className="l"><kbd>{k}</kbd></td><td className="l">{what}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="st-sec" aria-labelledby="st-demo">
          <h2 id="st-demo" className="vh">Demo account</h2>
          <Row label="Account">{d.account?.name ?? "n/a"}</Row>
          <Row label="Fees and slippage"><Button size="sm" icon="gear" disabled={!d.account} onClick={() => setCosts(true)}>Edit</Button></Row>
          <Row label="Reset account"><Button size="sm" variant="danger" disabled={!d.account} onClick={() => setReset(true)}>Reset</Button></Row>
          {d.account && <ResetDialog open={reset} onClose={() => setReset(false)} account={d.account} />}
          {d.account && <CostsDialog open={costs} onClose={() => setCosts(false)} account={d.account} />}
        </section>

        <section className="st-sec" aria-labelledby="st-legal">
          <h2 id="st-legal" className="vh">Legal</h2>
          <nav className="st-links" aria-label="Legal">
            {LEGAL_PAGES.map((p) => <a key={p.href} href={p.href} target="_blank" rel="noopener">{p.label}</a>)}
            <a href={productUrl("#/how")} target="_blank" rel="noopener">How Parity works</a>
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts: TradingView Lightweight Charts</a>
          </nav>
        </section>
      </div>
    </div>
  );
}
