// Markets (DEC-0056): every pair each live source lists, with live price, 24 h change, 24 h
// volume and a sparkline, sortable and filtered. Team members see every team-only venue in
// real time (and US stocks once a stock feed is keyed); everyone else sees CoinGecko's 100
// largest coins, about a minute behind. Rows are windowed (only those on screen are drawn,
// at a fixed height) and the page redraws at most once per animation frame, re-sorting at
// most once a second, so thousands of rows stay smooth.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveBadge } from "../components/LiveBadge";
import { subscribeBoard } from "../lib/live/client";
import type { BoardRow } from "../lib/live/protocol";
import { sourceById } from "../lib/live/sources";
import { useTeam } from "../lib/live/team";
import { digitsFor, priceText } from "../lib/tradeData";
import { isFxPair } from "./live";
import { readPref, writePref } from "./shared";

interface MRow { key: string; src: string; sym: string; p: number; chg: number | null; vol: number | null; te: number; spark: number[]; kind: Kind }
type Kind = "crypto" | "fx" | "stock";
type SortKey = "sym" | "src" | "p" | "chg" | "vol";
interface Prefs { venue: string; kind: "all" | Kind; sort: SortKey; dir: 1 | -1 }

const ROW = 26;
const OVERSCAN = 8;
const PUBLIC = ["coingecko"];
const TEAM_ORDER = ["hyperliquid", "kraken", "coinbase", "gemini", "binanceus", "alpaca", "coingecko"];

const compact = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return "";
  const a = Math.abs(v);
  return a >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(0);
};

function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return <svg className="mk-spark" width="72" height="16" aria-hidden />;
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { if (p < lo) lo = p; if (p > hi) hi = p; }
  const span = hi - lo || 1;
  const d = pts.map((p, i) => `${((i / (pts.length - 1)) * 70 + 1).toFixed(1)},${(15 - ((p - lo) / span) * 14).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return <svg className="mk-spark" width="72" height="16" aria-hidden><polyline points={d} fill="none" stroke={up ? "var(--good)" : "var(--bad)"} strokeWidth="1.2" /></svg>;
}

export function MarketsView({ onSymbol }: { onSymbol: (key: string) => void }) {
  const team = useTeam();
  const sources = useMemo(() => (team?.team ? TEAM_ORDER.filter((s) => s === "coingecko" || team.sources.includes(s)) : PUBLIC), [team]);
  const [prefs, setPrefsState] = useState<Prefs>(() => readPref("markets", { venue: "all", kind: "all", sort: "vol", dir: -1 } as Prefs));
  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsState((o) => { const n = { ...o, ...p }; writePref("markets", n); return n; }), []);
  const [q, setQ] = useState("");
  const venue = sources.includes(prefs.venue) ? prefs.venue : "all";
  const shown = venue === "all" ? sources : [venue];

  // Rows live in a ref; listeners only mark the view dirty. One redraw per frame at most.
  const rows = useRef(new Map<string, MRow>());
  const [version, setVersion] = useState(0);
  const dirty = useRef(false);
  const frame = useRef(0);
  const kick = useCallback(() => {
    dirty.current = true;
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; if (dirty.current) { dirty.current = false; setVersion((v) => v + 1); } });
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    if (!team) return;
    const offs = shown.map((src) => {
      const stock = !!sourceById(src)?.stocks;
      return subscribeBoard(src, (d: BoardRow[], full, sp) => {
        const m = rows.current;
        if (full) for (const k of [...m.keys()]) if (k.startsWith(`${src}:`)) m.delete(k);
        for (const [sym, p, chg, vol, te] of d) {
          const key = `${src}:${sym}`;
          const old = m.get(key);
          const spark = sp?.[sym] ?? old?.spark ?? [p];
          m.set(key, { key, src, sym, p, chg: chg ?? old?.chg ?? null, vol: vol ?? old?.vol ?? null, te, spark, kind: stock ? "stock" : isFxPair(sym) ? "fx" : "crypto" });
        }
        kick();
      });
    });
    // One sparkline point a minute per row, so lines keep moving between snapshots.
    const t = window.setInterval(() => {
      for (const r of rows.current.values()) if (r.src !== "coingecko") { r.spark = [...r.spark.slice(-59), r.p]; }
      kick();
    }, 60_000);
    return () => { offs.forEach((f) => f()); window.clearInterval(t); for (const k of [...rows.current.keys()]) if (!shown.some((s) => k.startsWith(`${s}:`))) rows.current.delete(k); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, shown.join(",")]);

  // Sorted and filtered keys: recomputed when the sort or filter changes, and at most once a second as prices move.
  const [order, setOrder] = useState<string[]>([]);
  const lastSort = useRef(0);
  const sizeAtSort = useRef(0);
  const sortNow = useCallback(() => {
    lastSort.current = Date.now();
    sizeAtSort.current = rows.current.size;
    const needle = q.trim().toUpperCase();
    const list = [...rows.current.values()].filter((r) => shown.includes(r.src) && (prefs.kind === "all" || r.kind === prefs.kind) && (!needle || r.sym.includes(needle)));
    const get = (r: MRow): number | string | null => (prefs.sort === "sym" ? r.sym : prefs.sort === "src" ? r.src : prefs.sort === "p" ? r.p : prefs.sort === "chg" ? r.chg : r.vol);
    list.sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * prefs.dir;
    });
    setOrder(list.map((r) => r.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, prefs.kind, prefs.sort, prefs.dir, shown.join(",")]);
  useEffect(() => { sortNow(); }, [sortNow]);
  useEffect(() => { if (Date.now() - lastSort.current > 1000 || sizeAtSort.current !== rows.current.size) sortNow(); }, [version, sortNow]);

  // Windowing: fixed row height, so the visible slice is plain arithmetic.
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, h: 600 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setView({ top: el.scrollTop, h: el.clientHeight });
    on();
    el.addEventListener("scroll", on, { passive: true });
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", on); ro.disconnect(); };
  }, []);
  const first = Math.max(0, Math.floor(view.top / ROW) - OVERSCAN);
  const last = Math.min(order.length, Math.ceil((view.top + view.h) / ROW) + OVERSCAN);
  const slice = order.slice(first, last);

  const head = (k: SortKey, label: string, cls = "") => (
    <span role="columnheader" className={`mk-h ${cls}`} aria-sort={prefs.sort === k ? (prefs.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setPrefs(prefs.sort === k ? { dir: prefs.dir === 1 ? -1 : 1 } : { sort: k, dir: k === "sym" || k === "src" ? 1 : -1 })}>
        {label}{prefs.sort === k ? <span aria-hidden>{prefs.dir === 1 ? " ▲" : " ▼"}</span> : null}
      </button>
    </span>
  );

  const open = (r: MRow) => onSymbol(r.kind === "stock" ? `S:${r.sym}` : `L:${r.src}:${r.sym}`);

  return (
    <div className="mk">
      <div className="mk-bar" role="toolbar" aria-label="Markets">
        <input className="ot-input mk-q" type="search" placeholder="Filter symbols" aria-label="Filter symbols" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="cb-group" role="radiogroup" aria-label="Venue">
          {["all", ...sources].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={venue === s} className={venue === s ? "on" : ""} onClick={() => setPrefs({ venue: s })}>{s === "all" ? "All" : sourceById(s)?.short ?? s}</button>
          ))}
        </span>
        <span className="cb-group" role="radiogroup" aria-label="Kind">
          {(["all", "crypto", "fx", "stock"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={prefs.kind === k} className={prefs.kind === k ? "on" : ""} onClick={() => setPrefs({ kind: k })}>{k === "all" ? "All" : k === "fx" ? "FX" : k === "stock" ? "Stocks" : "Crypto"}</button>
          ))}
        </span>
        <span className="mk-n tabular">{order.length.toLocaleString("en-US")} rows</span>
        <span className="mk-badges">{shown.map((s) => <LiveBadge key={s} src={s} compact />)}</span>
      </div>
      <p className="mk-note">{prefs.kind === "fx" ? "FX here is the fiat pairs that crypto venues trade, not the interbank rate."
        : team == null ? "" : team.team ? "Real-time venue feeds for the team only, not shown to the public."
        : "CoinGecko, about a minute behind. Team members also see Hyperliquid, Kraken, Coinbase, Gemini and Binance.US in real time."}</p>
      <div className="mk-table" role="table" aria-label="Markets" aria-rowcount={order.length + 1}>
      <div role="rowgroup"><div className="mk-grid mk-head" role="row" aria-rowindex={1}>
        {head("sym", "Symbol", "l")}{head("src", "Venue", "l")}{head("p", "Last")}{head("chg", "24h")}{head("vol", "Vol 24h")}<span role="columnheader" className="mk-h">Trend</span>
      </div></div>
      <div ref={box} className="mk-body" role="rowgroup">
        <div style={{ height: order.length * ROW, position: "relative" }}>
          {slice.map((k, i) => {
            const r = rows.current.get(k);
            if (!r) return null;
            const chg = r.chg;
            return (
              <div key={k} role="row" tabIndex={0} className="mk-grid mk-row" style={{ transform: `translateY(${(first + i) * ROW}px)` }}
                onClick={() => open(r)} onKeyDown={(e) => { if (e.key === "Enter") open(r); }} aria-rowindex={first + i + 2}>
                <span role="cell" className="l mk-sym">{r.sym}</span>
                <span role="cell" className="l mk-src">{sourceById(r.src)?.short ?? r.src}</span>
                <span role="cell" className="tabular">{priceText(r.p, digitsFor(r.p))}</span>
                <span role="cell" className={`tabular ${chg == null ? "" : chg >= 0 ? "good" : "bad"}`}>{chg == null ? "" : `${chg >= 0 ? "+" : "−"}${Math.abs(chg).toFixed(2)}%`}</span>
                <span role="cell" className="tabular">{compact(r.vol)}</span>
                <span role="cell"><Spark pts={r.spark} /></span>
              </div>
            );
          })}
        </div>
        {!order.length && <div className="mk-empty">{team == null ? "Loading" : "No rows yet"}</div>}
      </div>
      </div>
      <p className="mk-foot">{shown.includes("coingecko") ? <><a href="https://www.coingecko.com/" target="_blank" rel="noreferrer">Data provided by CoinGecko</a>. </> : null}Volume is in each pair's quote currency. Trend is the last hour (CoinGecko: the last day).</p>
    </div>
  );
}
