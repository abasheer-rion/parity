// Watchlists (DEC-0033): named lists of instruments with the last delayed close, day,
// week and year change and a one-year line. Saved to the person's account (trade_watchlists);
// the preview without sign-in keeps them in this browser. Also the small watchlist panel
// beside the chart.
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Icon, Input, Sparkline, toast } from "../ui";
import type { Point } from "../lib/types";
import { priceText, type Instrument } from "../lib/tradeData";
import { useRows } from "../lib/userStore";
import { InstrumentSelect, readPref, writePref } from "./shared";
import { alertsTable, byPosition, seedDefaultList, watchlistsTable, type WatchlistRow } from "./trackers";
import { TTable } from "./TTable";

const sparkPoints = (s: Instrument): Point[] => s.spark.flatMap((v, i) => (v == null || !Number.isFinite(v) ? [] : [[String(i), v] as Point]));

/** A change: percent for a price, points for a level such as a yield. */
export function chgText(inst: Instrument, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return inst.kind === "level" ? `${sign}${Math.abs(v).toFixed(2)}` : `${sign}${Math.abs(v).toFixed(2)}%`;
}

/** The watchlists, the active one and its instruments, shared by the panel and the view. */
export function useWatchlists(list: Instrument[]) {
  const lists = useRows(watchlistsTable, "trade_watchlists");
  const sorted = useMemo(() => [...lists.rows].sort(byPosition), [lists.rows]);
  const [activeId, setActiveId] = useState<string>(() => readPref("watchlists", { active: "" }).active);
  const active = sorted.find((l) => l.id === activeId) ?? sorted[0];
  useEffect(() => {
    if (!lists.loading && !lists.error && lists.rows.length === 0 && list.length) void seedDefaultList(list).catch((e: Error) => toast(e.message, { tone: "bad" }));
  }, [lists.loading, lists.error, lists.rows.length, list]);
  const choose = (id: string) => { setActiveId(id); writePref("watchlists", { active: id }); };
  const rows = active ? active.items.flatMap((k) => { const s = list.find((x) => x.key === k); return s ? [s] : []; }) : [];
  return { lists, sorted, active, choose, rows };
}

const fail = (e: Error) => toast(e.message, { tone: "bad" });

/** The small list beside the chart: symbol, last, day change. Click loads it into the active chart. */
export function WatchMini({ list, current, onSymbol }: { list: Instrument[]; current: string; onSymbol: (k: string) => void }) {
  const w = useWatchlists(list);
  return (
    <div className="wm">
      <div className="wm-head">
        <select className="ot-input wm-pick" aria-label="Watchlist" value={w.active?.id ?? ""} onChange={(e) => w.choose(e.target.value)}>
          {w.sorted.length ? w.sorted.map((l) => <option key={l.id} value={l.id}>{l.name}</option>) : <option value="">Loading</option>}
        </select>
        <InstrumentSelect list={list.filter((s) => !w.active?.items.includes(s.key))} value="" label="Add symbol" allowNone="+ Add"
          onChange={(k) => { if (w.active && k) void watchlistsTable.update(w.active.id, { items: [...w.active.items, k] }).catch(fail); }} />
      </div>
      <TTable<Instrument> label="Watchlist" rows={w.rows} rowKey={(s) => s.key} onRow={(s) => onSymbol(s.key)} active={(s) => s.key === current}
        empty={w.lists.loading ? "Loading" : "Empty"}
        cols={[
          { key: "s", head: "Symbol", align: "left", cell: (s) => <span title={s.label}>{s.short}</span> },
          { key: "l", head: "Last", cell: (s) => priceText(s.last) },
          { key: "d", head: "1D", tone: (s) => s.chg.d1, cell: (s) => chgText(s, s.chg.d1) },
        ]} />
    </div>
  );
}

export function WatchlistsView({ list, onSymbol, onAlert }: { list: Instrument[]; onSymbol: (k: string) => void; onAlert: (k: string) => void }) {
  const w = useWatchlists(list);
  const alerts = useRows(alertsTable, "trade_alerts");
  const [naming, setNaming] = useState<null | "new" | "rename">(null);
  const [deleting, setDeleting] = useState(false);
  const active: WatchlistRow | undefined = w.active;
  const save = (items: string[]) => active && watchlistsTable.update(active.id, { items }).catch(fail);
  const move = (key: string, step: -1 | 1) => {
    if (!active) return;
    const items = [...active.items];
    const i = items.indexOf(key), j = i + step;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    void save(items);
  };
  const alertCount = (key: string) => alerts.rows.filter((a) => a.symbol === key && a.active).length;
  const missing = active ? active.items.filter((k) => !list.some((x) => x.key === k)) : [];

  return (
    <div className="view">
      <div className="vbar">
        <select className="ot-input vbar-pick" aria-label="Watchlist" value={active?.id ?? ""} onChange={(e) => w.choose(e.target.value)}>
          {w.sorted.length ? w.sorted.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>) : <option value="">Loading</option>}
        </select>
        <Button size="sm" icon="plus" onClick={() => setNaming("new")}>New</Button>
        <Button size="sm" onClick={() => setNaming("rename")} disabled={!active}>Rename</Button>
        <Button size="sm" variant="tertiary" onClick={() => setDeleting(true)} disabled={!active || w.sorted.length < 2}>Delete</Button>
        <span className="vbar-gap" />
        <InstrumentSelect list={list.filter((s) => !active?.items.includes(s.key))} value="" onChange={(k) => { if (active && k) void save([...active.items, k]); }} label="Add symbol" allowNone="+ Add symbol" />
      </div>
      <section className="vbox vbox-fill" aria-label={active?.name ?? "Watchlist"}>
        {w.lists.error ? <div className="vbox-empty">{w.lists.error}</div> : (
          <TTable<Instrument> label={active?.name ?? "Watchlist"} rows={w.rows} rowKey={(s) => s.key} onRow={(s) => onSymbol(s.key)} empty={w.lists.loading ? "Loading" : "Empty"}
            cols={[
              { key: "s", head: "Symbol", align: "left", width: 110, sort: (s) => s.short, cell: (s) => <strong>{s.short}</strong> },
              { wide: true, key: "n", head: "Name", align: "left", sort: (s) => s.label, cell: (s) => <span className="tt-dim">{s.label}</span> },
              { key: "l", head: "Last", sort: (s) => s.last, cell: (s) => priceText(s.last) },
              { key: "d1", head: "1D", sort: (s) => s.chg.d1, tone: (s) => s.chg.d1, cell: (s) => chgText(s, s.chg.d1) },
              { wide: true, key: "w1", head: "1W", sort: (s) => s.chg.w1, tone: (s) => s.chg.w1, cell: (s) => chgText(s, s.chg.w1) },
              { wide: true, key: "m1", head: "1M", sort: (s) => s.chg.m1, tone: (s) => s.chg.m1, cell: (s) => chgText(s, s.chg.m1) },
              { key: "ytd", head: "YTD", sort: (s) => s.chg.ytd, tone: (s) => s.chg.ytd, cell: (s) => chgText(s, s.chg.ytd) },
              { wide: true, key: "tr", head: "1Y", width: 104, cell: (s) => <Sparkline points={sparkPoints(s)} width={96} height={18} /> },
              { wide: true, key: "a", head: "As of", sort: (s) => s.asof, cell: (s) => <span className="tt-dim">{s.asof}</span> },
              { key: "x", head: <span className="sr-only">Actions</span>, width: 128, cell: (s) => (
                <span className="tt-acts" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={`tt-btn ${alertCount(s.key) ? "on" : ""}`} aria-label={`Alert on ${s.short}`} title="Alert" onClick={() => onAlert(s.key)}><Icon name="bell" size={12} /></button>
                  <button type="button" className="tt-btn" aria-label={`Move ${s.short} up`} title="Up" onClick={() => move(s.key, -1)}>↑</button>
                  <button type="button" className="tt-btn" aria-label={`Move ${s.short} down`} title="Down" onClick={() => move(s.key, 1)}>↓</button>
                  <button type="button" className="tt-btn" aria-label={`Remove ${s.short}`} title="Remove" onClick={() => active && void save(active.items.filter((k) => k !== s.key))}>×</button>
                </span>
              ) },
            ]} />
        )}
      </section>
      {missing.length > 0 && <div className="vdim">Not in data: {missing.join(", ")}</div>}
      <NameDialog open={naming != null} title={naming === "rename" ? "Rename list" : "New list"} initial={naming === "rename" ? active?.name ?? "" : ""}
        onClose={() => setNaming(null)}
        onSave={(name) => {
          setNaming(null);
          if (naming === "rename" && active) void watchlistsTable.update(active.id, { name }).catch(fail);
          else void watchlistsTable.insert({ name, items: [], position: (w.sorted.at(-1)?.position ?? -1) + 1 }).then((r) => r && w.choose(r.id), fail);
        }} />
      <Dialog open={deleting} onClose={() => setDeleting(false)} title={`Delete ${active?.name ?? "list"}?`} width={380}
        footer={<><Button onClick={() => setDeleting(false)}>Cancel</Button><Button variant="danger" onClick={() => { setDeleting(false); if (active) void watchlistsTable.remove(active.id).then(() => w.choose(""), fail); }}>Delete</Button></>}>
        <p>{active?.items.length ?? 0} symbols. Alerts stay.</p>
      </Dialog>
    </div>
  );
}

export function NameDialog({ open, title, initial, onClose, onSave }: { open: boolean; title: string; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  useEffect(() => { if (open) setName(initial); }, [open, initial]);
  const clean = name.trim();
  const ok = clean.length >= 1 && clean.length <= 60;
  return (
    <Dialog open={open} onClose={onClose} title={title} width={380}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={() => onSave(clean)}>Save</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) onSave(clean); }}>
        <Input label="Name" value={name} onChange={setName} autoFocus />
      </form>
    </Dialog>
  );
}
