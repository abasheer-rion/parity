// Watchlists (DEC-0032): named lists of instruments, each row with its last delayed
// close, the day and week change, a one-year line and a link to the chart; and the
// alerts set on them. Saved to the person's account (supabase trade_watchlists and
// trade_alerts); the preview without sign-in keeps them in this browser.
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, DataTable, Delta, Dialog, IconButton, Input, Section, Select, Sparkline, toast, type Column } from "../../ui";
import { SkeletonTable } from "../../ui/skeleton";
import { ALERT_KINDS, alertKindDef, validateAlert, type AlertKind } from "../../lib/alerts";
import { rsi } from "../../lib/indicators";
import { CLASS_LABEL, digitsFor, loadBars, priceText, type Instrument } from "../../lib/tradeData";
import { useRows } from "../../lib/userStore";
import type { Point } from "../../lib/types";
import { InstrumentSelect, readPref, writePref } from "./shared";
import { alertsTable, alertText, alertValueText, byPosition, seedDefaultList, watchlistsTable, type AlertRow } from "./trackers";

const dateText = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const sparkPoints = (s: Instrument): Point[] => s.spark.flatMap((v, i) => (v == null || !Number.isFinite(v) ? [] : [[String(i), v] as Point]));

/** A change: percent for a price, a difference in points for a level such as a yield. */
export function Change({ inst, v }: { inst: Instrument; v: number | null | undefined }) {
  return inst.kind === "level" ? <Delta value={v} kind="num" digits={2} /> : <Delta value={v == null ? null : v / 100} digits={2} />;
}

export function WatchlistsView({ list }: { list: Instrument[] }) {
  const lists = useRows(watchlistsTable, "trade_watchlists");
  const alerts = useRows(alertsTable, "trade_alerts");
  const sorted = useMemo(() => [...lists.rows].sort(byPosition), [lists.rows]);
  // The last list and how many rows it and the alerts had, so the loading skeletons match.
  const [pref] = useState(() => readPref("watchlists", { active: "", rows: 6, alerts: 0 }));
  const [activeId, setActiveId] = useState<string>(pref.active);
  const active = sorted.find((l) => l.id === activeId) ?? sorted[0];
  const [naming, setNaming] = useState<null | "new" | "rename">(null);
  const [deleting, setDeleting] = useState(false);
  const [alertFor, setAlertFor] = useState<string | null>(null);

  useEffect(() => {
    if (!lists.loading && !lists.error && lists.rows.length === 0 && list.length) void seedDefaultList(list).catch((e: Error) => toast(e.message, { tone: "bad" }));
  }, [lists.loading, lists.error, lists.rows.length, list]);

  const choose = (id: string) => { setActiveId(id); writePref("watchlists", { ...readPref("watchlists", pref), active: id }); };
  const fail = (e: Error) => toast(e.message, { tone: "bad" });
  const save = (items: string[]) => active && watchlistsTable.update(active.id, { items }).catch(fail);
  const move = (key: string, step: -1 | 1) => {
    if (!active) return;
    const items = [...active.items];
    const i = items.indexOf(key), j = i + step;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    void save(items);
  };
  const add = (key: string) => {
    if (!active || !key) return;
    if (active.items.includes(key)) { toast("Already on this list."); return; }
    void save([...active.items, key]);
  };

  const rows = active ? active.items.flatMap((k) => { const s = list.find((x) => x.key === k); return s ? [s] : []; }) : [];
  const missing = active ? active.items.filter((k) => !list.some((x) => x.key === k)) : [];
  const alertCount = (key: string) => alerts.rows.filter((a) => a.symbol === key && a.active).length;
  useEffect(() => {
    if (lists.loading || alerts.loading || !active) return;
    writePref("watchlists", { ...readPref("watchlists", pref), rows: rows.length, alerts: alerts.rows.length });
  }, [lists.loading, alerts.loading, active, rows.length, alerts.rows.length, pref]);

  const columns: Column<Instrument>[] = [
    { key: "name", header: "Name", align: "left", render: (s) => (
      <a className="tr-name" href={`#/trade?s=${encodeURIComponent(s.key)}`}><strong>{s.short}</strong><span className="muted small">{s.label}</span></a>
    ) },
    { key: "last", header: "Last", render: (s) => <span className="num">{priceText(s.last)}{s.kind === "level" && s.unit ? <span className="muted small"> {s.unit}</span> : null}</span> },
    { key: "d1", header: "1D", render: (s) => <Change inst={s} v={s.chg.d1} /> },
    { key: "w1", header: "1W", render: (s) => <Change inst={s} v={s.chg.w1} /> },
    { key: "trend", header: "1 year", render: (s) => <Sparkline points={sparkPoints(s)} width={96} height={28} /> },
    { key: "asof", header: "As of", render: (s) => <span className="tr-asof">{dateText(s.asof)}<span className="muted small">Delayed</span></span> },
    { key: "act", header: <span className="sr-only">Actions</span>, render: (s) => (
      <span className="tr-row-act">
        <IconButton icon="bell" size={28} active={alertCount(s.key) > 0} label={alertCount(s.key) ? `Alerts on ${s.short}: ${alertCount(s.key)}. Add another` : `Set an alert on ${s.short}`} onClick={() => setAlertFor(s.key)} />
        <IconButton icon="chevronUp" size={28} label={`Move ${s.short} up`} onClick={() => move(s.key, -1)} />
        <IconButton icon="chevronDown" size={28} label={`Move ${s.short} down`} onClick={() => move(s.key, 1)} />
        <IconButton icon="close" size={28} label={`Remove ${s.short} from this list`} onClick={() => active && void save(active.items.filter((k) => k !== s.key))} />
      </span>
    ) },
  ];

  const loading = lists.loading || (!lists.rows.length && !lists.error);
  return (
    <>
      <div className="mk-banner" role="note">
        <span><strong>Single stocks and ETF prices are not shown.</strong> No free source licenses them for display, so lists hold indices, currencies, crypto, commodities and rates. Every value is a delayed daily close, not a live quote.</span>
      </div>
      <div className="tr-bar">
        <Select label="Watchlist" value={active?.id ?? ""} onChange={choose} options={sorted.length ? sorted.map((l) => [l.id, `${l.name} (${l.items.length})`]) : [["", "Loading lists"]]} />
        <Button size="sm" icon="plus" onClick={() => setNaming("new")}>New list</Button>
        <Button size="sm" onClick={() => setNaming("rename")} disabled={!active}>Rename</Button>
        <Button size="sm" variant="tertiary" onClick={() => setDeleting(true)} disabled={!active || sorted.length < 2} title={sorted.length < 2 ? "Keep at least one list" : undefined}>Delete</Button>
        <span className="pc-spacer" />
        <InstrumentSelect list={list.filter((s) => !active?.items.includes(s.key))} value="" onChange={add} label="Add an instrument" allowNone="Add an instrument…" />
      </div>
      {lists.error ? (
        <div className="mk-banner" role="note"><strong>Could not load your lists.</strong> {lists.error}</div>
      ) : loading ? (
        <SkeletonTable rows={Math.max(1, pref.rows)} cols={6} label="Loading your watchlist" />
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(s) => s.key} caption={active?.name} initialSort={{ key: "none", dir: "asc" }}
          empty="This list is empty. Add an instrument with the picker above." />
      )}
      {missing.length > 0 && <p className="muted small">Not in today's data, so not shown: {missing.join(", ")}.</p>}

      <Section title="Alerts" actions={<Button size="sm" icon="bell" onClick={() => setAlertFor(rows[0]?.key ?? list[0]?.key ?? "")} disabled={!list.length}>New alert</Button>}>
        <AlertsTable rows={alerts.rows} list={list} loading={alerts.loading} expect={pref.alerts} />
        <p className="muted small">Alerts are checked against the latest delayed daily close when you open Trade or this tab. Each one fires once, shows a message and goes under the bell at the top. Nothing is emailed and nothing is bought or sold.</p>
      </Section>

      <NameDialog open={naming != null} title={naming === "rename" ? "Rename list" : "New list"} initial={naming === "rename" ? active?.name ?? "" : ""}
        onClose={() => setNaming(null)}
        onSave={(name) => {
          setNaming(null);
          if (naming === "rename" && active) void watchlistsTable.update(active.id, { name }).catch(fail);
          else void watchlistsTable.insert({ name, items: [], position: (sorted.at(-1)?.position ?? -1) + 1 }).then((r) => r && choose(r.id), fail);
        }} />
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete this list?" width={420}
        footer={<><Button onClick={() => setDeleting(false)}>Keep it</Button><Button variant="danger" onClick={() => { setDeleting(false); if (active) void watchlistsTable.remove(active.id).then(() => choose(""), fail); }}>Delete</Button></>}>
        <p>“{active?.name}” and its {active?.items.length ?? 0} instruments will be removed. Alerts stay.</p>
      </Dialog>
      <AlertDialog symbol={alertFor} list={list} onClose={() => setAlertFor(null)} />
    </>
  );
}

function AlertsTable({ rows, list, loading, expect }: { rows: AlertRow[]; list: Instrument[]; loading: boolean; expect: number }) {
  const name = (k: string) => { const s = list.find((x) => x.key === k); return s ? s.short || s.label : k; };
  const columns: Column<AlertRow>[] = [
    { key: "symbol", header: "Instrument", align: "left", sort: (a) => name(a.symbol), render: (a) => <a href={`#/trade?s=${encodeURIComponent(a.symbol)}`}>{name(a.symbol)}</a> },
    { key: "rule", header: "Condition", align: "left", render: (a) => alertText(a) },
    { key: "status", header: "Status", align: "left", sort: (a) => a.triggered_at ?? "", render: (a) => (a.triggered_at
      ? <span className="tr-status"><Badge tone="accent">Fired</Badge><span className="muted small">close of {a.triggered_bar}: {alertValueText(a, a.triggered_value)}</span></span>
      : <Badge>Waiting</Badge>) },
    { key: "act", header: <span className="sr-only">Actions</span>, render: (a) => (
      <Button size="sm" variant="tertiary" onClick={() => alertsTable.remove(a.id).catch((e: Error) => toast(e.message, { tone: "bad" }))}>Remove</Button>
    ) },
  ];
  if (loading) return expect ? <SkeletonTable rows={expect} cols={4} rowHeight={38} label="Loading alerts" /> : <div className="ui-empty-inline">Loading alerts</div>;
  return <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} initialSort={{ key: "status", dir: "asc" }} empty="No alerts yet. Use the bell on a row, or New alert." dense />;
}

function NameDialog({ open, title, initial, onClose, onSave }: { open: boolean; title: string; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  useEffect(() => { if (open) setName(initial); }, [open, initial]);
  const clean = name.trim();
  const ok = clean.length >= 1 && clean.length <= 60;
  return (
    <Dialog open={open} onClose={onClose} title={title} width={420}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={() => onSave(clean)}>Save</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) onSave(clean); }}>
        <Input label="Name" value={name} onChange={setName} placeholder="For example, Energy" autoFocus />
      </form>
    </Dialog>
  );
}

function AlertDialog({ symbol, list, onClose }: { symbol: string | null; list: Instrument[]; onClose: () => void }) {
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
  const problem = !inst ? "Pick an instrument." : validateAlert(rule);
  const save = () => {
    if (problem || !inst) return;
    alertsTable.insert({ symbol: inst.key, kind, value: rule.value, param: rule.param, active: true, triggered_at: null, triggered_value: null, triggered_bar: null })
      .then(() => { toast(`Alert set on ${inst.short || inst.label}.`, { tone: "good" }); onClose(); }, (e: Error) => toast(e.message, { tone: "bad" }));
  };
  return (
    <Dialog open={symbol != null} onClose={onClose} title="New alert" width={480}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!problem} onClick={save}>Set alert</Button></>}>
      <form className="tr-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="ui-field"><span className="ui-field-label">Instrument</span><InstrumentSelect list={list} value={key} onChange={setKey} /></label>
        <label className="ui-field"><span className="ui-field-label">Condition</span><Select label="Condition" value={kind} onChange={pickKind} options={ALERT_KINDS.map((d) => [d.kind, d.label])} /></label>
        <div className="tr-form-row">
          {def.needsValue && <Input label={kind.startsWith("rsi") ? "RSI level (0 to 100)" : "Price level"} type="number" value={value} onChange={setValue} />}
          {def.needsParam && <Input label={kind.startsWith("rsi") ? "RSI look-back (bars)" : "Average length (bars)"} type="number" value={param} onChange={setParam} />}
        </div>
        <p className="muted small tr-now">
          {now && inst ? <>Latest close {priceText(now.close, digitsFor(now.close))} on {now.bar}{now.rsi != null ? `, RSI(14) ${now.rsi.toFixed(1)}` : ""}. {CLASS_LABEL[inst.class] ?? inst.class}, delayed.</> : "Loading the latest close."}
        </p>
        {problem && value !== "" && <p className="small bad">{problem}</p>}
      </form>
    </Dialog>
  );
}
