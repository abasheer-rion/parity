// Alerts (DEC-0033): price, RSI and moving average alerts checked against delayed daily
// closes; each fires once, shows a message and lands under the bell. Nothing is emailed
// and nothing is bought or sold.
import { useEffect, useState } from "react";
import { Button, Dialog, Select, toast } from "../ui";
import { ALERT_KINDS, alertKindDef, validateAlert, type AlertKind } from "../lib/alerts";
import { rsi } from "../lib/indicators";
import { digitsFor, loadBars, priceText, type Instrument } from "../lib/tradeData";
import { useRows } from "../lib/userStore";
import { InstrumentSelect } from "./shared";
import { alertsTable, alertText, alertValueText, checkAlerts, type AlertRow } from "./trackers";
import { timeIn } from "./state";
import { TTable } from "./TTable";

export function AlertsView({ list, tz, onSymbol, onNew }: { list: Instrument[]; tz: string; onSymbol: (k: string) => void; onNew: () => void }) {
  const alerts = useRows(alertsTable, "trade_alerts");
  const name = (k: string) => { const s = list.find((x) => x.key === k); return s ? s.short || s.label : k; };
  return (
    <div className="view">
      <div className="vbar">
        <strong>Alerts</strong>
        <span className="vdim">{alerts.rows.filter((a) => a.active).length} active · {alerts.rows.filter((a) => a.triggered_at).length} fired</span>
        <span className="vbar-gap" />
        <Button size="sm" icon="restart" onClick={() => void checkAlerts(list)} disabled={!list.length}>Check now</Button>
        <Button size="sm" icon="plus" variant="primary" onClick={onNew} disabled={!list.length}>New alert</Button>
      </div>
      <section className="vbox vbox-fill" aria-label="Alerts">
        <TTable<AlertRow> label="Alerts" rows={alerts.rows} rowKey={(a) => a.id} onRow={(a) => onSymbol(a.symbol)} empty={alerts.loading ? "Loading" : "No alerts"}
          initial={{ key: "st", dir: "asc" }}
          cols={[
            { key: "s", head: "Symbol", align: "left", width: 110, sort: (a) => name(a.symbol), cell: (a) => <strong>{name(a.symbol)}</strong> },
            { key: "c", head: "Condition", align: "left", cell: (a) => alertText(a) },
            { key: "st", head: "Status", align: "left", sort: (a) => a.triggered_at ?? "", cell: (a) => (a.triggered_at ? <span className="vtag on">Fired</span> : <span className="vtag">Waiting</span>) },
            { wide: true, key: "b", head: "Bar", align: "left", sort: (a) => a.triggered_bar ?? "", cell: (a) => a.triggered_bar ?? "" },
            { key: "v", head: "Value", cell: (a) => (a.triggered_at ? alertValueText(a, a.triggered_value) : "") },
            { wide: true, key: "t", head: "Set", align: "left", sort: (a) => a.created_at ?? "", cell: (a) => timeIn(a.created_at, tz) },
            { key: "x", head: <span className="sr-only">Remove</span>, width: 72, cell: (a) => (
              <button type="button" className="tt-btn" onClick={(e) => { e.stopPropagation(); alertsTable.remove(a.id).catch((er: Error) => toast(er.message, { tone: "bad" })); }}>Remove</button>
            ) },
          ]} />
      </section>
    </div>
  );
}

export function AlertDialog({ symbol, list, onClose }: { symbol: string | null; list: Instrument[]; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [kind, setKind] = useState<AlertKind>("price_above");
  const [value, setValue] = useState("");
  const [param, setParam] = useState("14");
  const [now, setNow] = useState<{ close: number; rsi: number | null; bar: string } | null>(null);
  useEffect(() => { if (symbol != null) { setKey(symbol); setValue(""); } }, [symbol]);
  const inst = list.find((s) => s.key === key);
  useEffect(() => {
    setNow(null);
    if (!inst) return;
    let live = true;
    void loadBars(inst, "D").then((r) => {
      if (!live || r.status !== "ok" || !r.data.length) return;
      const last = r.data[r.data.length - 1];
      setNow({ close: last.close, rsi: rsi(r.data, 14).at(-1) ?? null, bar: last.time });
    });
    return () => { live = false; };
  }, [inst]);
  const def = alertKindDef(kind);
  const pickKind = (k: AlertKind) => { setKind(k); const d = alertKindDef(k); if (d.defaultParam) setParam(String(d.defaultParam)); };
  const rule = { kind, value: def.needsValue && value.trim() !== "" ? Number(value) : null, param: def.needsParam ? Number(param) : null };
  const problem = !inst ? "Pick a symbol" : validateAlert(rule);
  const save = () => {
    if (problem || !inst) return;
    alertsTable.insert({ symbol: inst.key, kind, value: rule.value, param: rule.param, active: true, triggered_at: null, triggered_value: null, triggered_bar: null })
      .then(() => { toast(`Alert set: ${inst.short || inst.label}`, { tone: "good" }); onClose(); void checkAlerts(list); }, (e: Error) => toast(e.message, { tone: "bad" }));
  };
  return (
    <Dialog open={symbol != null} onClose={onClose} title="New alert" width={420}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!problem} onClick={save}>Set alert</Button></>}>
      <form className="dlg-fields" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="ot-field"><span>Symbol</span><InstrumentSelect list={list} value={key} onChange={setKey} /></label>
        <label className="ot-field"><span>Condition</span><Select label="Condition" value={kind} onChange={pickKind} options={ALERT_KINDS.map((d) => [d.kind, d.label])} /></label>
        <div className="ot-grid">
          {def.needsValue && <label className="ot-field"><span>{kind.startsWith("rsi") ? "RSI level" : "Price"}</span><input className="ot-input" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></label>}
          {def.needsParam && <label className="ot-field"><span>Length (bars)</span><input className="ot-input" type="number" value={param} onChange={(e) => setParam(e.target.value)} /></label>}
        </div>
        <dl className="pnl">
          <div><dt>Last</dt><dd className="tabular">{now ? priceText(now.close, digitsFor(now.close)) : "n/a"}</dd></div>
          <div><dt>RSI(14)</dt><dd className="tabular">{now?.rsi != null ? now.rsi.toFixed(1) : "n/a"}</dd></div>
          <div><dt>Bar</dt><dd className="tabular">{now?.bar ?? "n/a"}</dd></div>
        </dl>
        <p className="ot-problem">{problem && value !== "" ? problem : ""}</p>
      </form>
    </Dialog>
  );
}
