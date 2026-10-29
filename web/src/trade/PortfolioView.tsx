// Portfolio: the demo account's numbers, its equity curve and positions (DEC-0034), plus
// switching, adding and resetting demo accounts.
import { useState } from "react";
import { Button, Dialog, LineChart, toast } from "../ui";
import { resetAccount, saveCosts, STARTING_CASH, costsOf, type AccountRow } from "../lib/paper/account";
import type { Costs } from "../lib/paper/matching";
import { PnlStrip, PositionsTable } from "./blotter";
import { useDemo } from "./demo";
import { BalancesStrip, BrokerPositionsTable, ExportButton, SandboxCard } from "./brokerBlotter";
import { ModeBadge, useTrading } from "./trading";

export function AccountBar() {
  const d = useDemo();
  const [reset, setReset] = useState(false);
  const [costs, setCosts] = useState(false);
  return (
    <div className="vbar">
      {d.accounts.length > 1 && d.account ? (
        <select className="ot-input vbar-pick" aria-label="Demo account" value={d.account.id} onChange={(e) => d.chooseAccount(e.target.value)}>
          {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      ) : <strong>{d.account?.name ?? "Demo account"}</strong>}
      <span className="vbar-gap" />
      <Button size="sm" icon="plus" disabled={!d.account} onClick={d.addAccount}>New account</Button>
      <Button size="sm" icon="gear" disabled={!d.account} onClick={() => setCosts(true)}>Fees</Button>
      <Button size="sm" icon="restart" disabled={!d.account} onClick={() => setReset(true)}>Reset</Button>
      {d.account && <ResetDialog open={reset} onClose={() => setReset(false)} account={d.account} />}
      {d.account && <CostsDialog open={costs} onClose={() => setCosts(false)} account={d.account} />}
    </div>
  );
}

export function PortfolioView({ onSymbol }: { onSymbol: (k: string) => void }) {
  return useTrading().server ? <BrokerPortfolioView /> : <DemoPortfolioView onSymbol={onSymbol} />;
}

function BrokerPortfolioView() {
  const t = useTrading();
  return (
    <div className="view view-scroll">
      <div className="vbar">
        <strong>{t.mode === "sandbox" ? "Sandbox account" : "Demo account"}</strong>
        <ModeBadge />
        <span className="vbar-gap" />
        <ExportButton />
      </div>
      {t.status?.notes.map((note) => <p key={note} className="bt-note">{note}</p>)}
      {t.error && <p className="ot-problem">{t.error}</p>}
      <SandboxCard />
      <BalancesStrip wide />
      <section className="vbox vbox-fill" aria-label="Positions">
        <h2 className="vh">Positions</h2>
        <BrokerPositionsTable />
      </section>
    </div>
  );
}

function DemoPortfolioView({ onSymbol }: { onSymbol: (k: string) => void }) {
  const d = useDemo();
  if (d.error) return <div className="vmsg">{d.error}</div>;
  return (
    <div className="view">
      <AccountBar />
      <PnlStrip wide />
      <section className="vbox vbox-chart" aria-label="Equity">
        <h2 className="vh">Equity</h2>
        {d.curve.length > 1
          ? <LineChart label="Equity" height={220} format={(v) => `$${Math.round(v).toLocaleString("en-US")}`} series={[{ name: "Equity", color: "var(--series-1)", points: d.curve, emphasis: true }]} />
          : <div className="vbox-empty">{d.loaded ? "No history" : "Loading"}</div>}
      </section>
      <section className="vbox vbox-fill" aria-label="Positions">
        <h2 className="vh">Positions</h2>
        <PositionsTable onSymbol={onSymbol} />
      </section>
    </div>
  );
}

export function ResetDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountRow }) {
  const [cash, setCash] = useState(String(STARTING_CASH));
  const [busy, setBusy] = useState(false);
  const amount = Number(cash);
  const ok = amount > 0 && amount <= 1e9;
  const go = async () => {
    setBusy(true);
    try { await resetAccount(account, amount); toast("Account reset"); onClose(); }
    catch (e) { toast((e as Error).message, { tone: "bad" }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title={`Reset ${account.name}?`} width={420}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!ok || busy} loading={busy} onClick={go}>Reset</Button></>}>
      <p>Removes every order, fill and position. Cannot be undone.</p>
      <label className="ot-field"><span>Starting cash ($)</span>
        <input className="ot-input" type="number" min="1" step="any" value={cash} onChange={(e) => setCash(e.target.value)} /></label>
    </Dialog>
  );
}

export function CostsDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountRow }) {
  const c = costsOf(account);
  const [v, setV] = useState({ fee_bps: String(c.fee_bps), fee_min: String(c.fee_min), slippage_bps: String(c.slippage_bps) });
  const parsed: Costs = { fee_bps: Number(v.fee_bps), fee_min: Number(v.fee_min), slippage_bps: Number(v.slippage_bps) };
  const ok = Object.values(parsed).every((x) => Number.isFinite(x) && x >= 0 && x <= 1000);
  const field = (k: keyof typeof v, label: string) => (
    <label className="ot-field"><span>{label}</span>
      <input className="ot-input" type="number" min="0" max="1000" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <Dialog open={open} onClose={onClose} title="Fees and slippage" width={420}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={() => saveCosts(account, parsed).then(() => { toast("Saved"); onClose(); }, (e: Error) => toast(e.message, { tone: "bad" }))}>Save</Button></>}>
      <div className="ot-grid">
        {field("fee_bps", "Fee (bp)")}
        {field("fee_min", "Min fee ($)")}
        {field("slippage_bps", "Slippage (bp)")}
      </div>
    </Dialog>
  );
}
