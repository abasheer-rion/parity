// Parity Terminal (DEC-0023): the full-screen site at /sim/ (sim.endyland.com), now a
// dense, keyboard-first market terminal of its own. A command bar on top, workspaces of
// tiled panels, a ticker tape along the bottom. Sim World's tabs live on as panels.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppGuard } from "../auth";
import { NotFound } from "../components/NotFound";
import { SkipLink } from "../components/SkipLink";
import { applyTheme } from "../lib/prefs";
import { EMPTY_SPEC, specFromQuery, specToQuery, type Spec } from "../lib/scenarios";
import { researchUrl, ROUTES } from "../lib/space";
import { nameOf } from "../lib/strategyMeta";
import { Toaster, toast } from "../ui";
import { CommandBar, type CommandBarHandle } from "./CommandBar";
import { TermContext, useLoad, type Link, type TermCtx } from "./context";
import { getReport, loadIndex, type TermSeries } from "./data";
import { FN_BY_CODE, LEGACY_TABS } from "./functions";
import { clearWs, findLeaf, freshWs, leaf as newLeaf, leaves, readWs, splitLeaf, updateLeaf, writeWs, WORKSPACES, WS_BY_ID, type WsState } from "./layout";
import { Ticker } from "./Ticker";
import { useRouteMeta } from "../lib/deeplink";
import { Workspace } from "./Workspace";
import { DEFAULT_BASKET } from "../pages/SimWorld";
import "../pages/SimWorld.css";
import "../pages/sim/world.css";
import "./terminal.css";

applyTheme();

// Installable as an app (web/public/sim/manifest.webmanifest): the service worker keeps the
// shell for a flaky network. Production builds only; a refusal never breaks the page.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker.register("/sim/sw.js", { scope: "/sim/" }).catch(() => {});
    } catch { /* blocked: the terminal works without it */ }
  });
}

export function TerminalApp() {
  return <AppGuard>{() => <TermShell />}</AppGuard>;
}

// Parity opens the terminal in a new tab with rel="noopener", so window.opener is usually
// empty; a tab that started with this page as its only history entry was opened that way.
const OPENED_AS_TAB = !!window.opener || window.history.length <= 1;

function goBack() {
  // Opened from Parity in a new tab: close it, and the person is back where they were. If
  // the browser refuses to close it, go to the research home instead.
  if (OPENED_AS_TAB) {
    window.close();
    window.setTimeout(() => { window.location.href = researchUrl(); }, 250);
    return;
  }
  window.location.href = researchUrl();
}

const routeOf = (h: string) => h.split("?")[0].split("/")[1] ?? "";

function useMobile(): boolean {
  const q = "(max-width: 700px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  if (!e) return false;
  return e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable;
};

/** The workspace a hash names, and the panel an old Sim World link asks for. */
function parseHash(h: string): { ws: string; legacy?: string } | null {
  const r = routeOf(h);
  if (!r) return { ws: "overview" };
  if (WS_BY_ID[r]) return { ws: r };
  if (LEGACY_TABS[r]) return { ws: "simlab", legacy: LEGACY_TABS[r] };
  return null;
}

/**
 * True for a hash no app answers: not a workspace, an old Sim World tab or a product or
 * research page. The terminal shows its "not found" view for it (DEC-0055).
 */
function unknownTermHash(h: string): boolean {
  if (parseHash(h)) return false;
  const r = routeOf(h);
  return ![...ROUTES.both, ...ROUTES.product, ...ROUTES.research].includes(r);
}

function withPanel(s: WsState, fn: string, args: string[] = []): WsState {
  const have = leaves(s.tree).find((l) => l.fn === fn);
  if (have) return { ...s, focus: have.id, max: null };
  return { ...s, tree: updateLeaf(s.tree, s.focus, { fn, args, opts: {} }) };
}

const FKEYS: Record<string, number> = { F2: 0, F3: 1, F4: 2, F5: 3, F6: 4 };

function TermShell() {
  const index = useLoad(loadIndex);
  const report = useLoad(getReport);
  const mobile = useMobile();
  const cmd = useRef<CommandBarHandle>(null);

  const initial = useMemo(() => parseHash(window.location.hash) ?? { ws: "overview" }, []);
  const [missing, setMissing] = useState<string | null>(() => (unknownTermHash(window.location.hash) ? window.location.hash : null));
  const [wsId, setWsId] = useState(initial.ws);
  const [states, setStates] = useState<Record<string, WsState>>(() => {
    const s = readWs(initial.ws);
    return { [initial.ws]: initial.legacy ? withPanel(s, initial.legacy) : s };
  });
  const ws = states[wsId] ?? readWs(wsId);
  useRouteMeta("sim", wsId);

  const setWs = useCallback((f: (s: WsState) => WsState) => {
    setStates((all) => {
      const cur = all[wsId] ?? readWs(wsId);
      const next = f(cur);
      if (next === cur) return all;
      writeWs(wsId, next);
      return { ...all, [wsId]: next };
    });
  }, [wsId]);

  // Sim World's shared settings: the scenario (from an old link's query), the basket, the window.
  const [spec, setSpec] = useState<Spec>(() => specFromQuery(window.location.hash.split("?")[1] ?? "") ?? EMPTY_SPEC);
  const [basket, setBasket] = useState<string[]>(DEFAULT_BASKET);
  const [win, setWin] = useState("10y");
  const [link, setLinkState] = useState<Link>({});
  const setLink = useCallback((patch: Link) => setLinkState((l) => ({ ...l, ...patch })), []);

  // ---- Routing: the hash holds the workspace ----
  const lastHash = useRef(`#/${initial.ws}`);
  useEffect(() => {
    if (window.location.hash !== `#/${initial.ws}` && !unknownTermHash(window.location.hash)) window.history.replaceState(null, "", `#/${initial.ws}`);
    const on = () => {
      const h = window.location.hash;
      const p = parseHash(h);
      if (!p && unknownTermHash(h)) {
        setMissing(h);
        return;
      }
      setMissing(null);
      if (!p) {
        // A link to a research page (a doc, a strategy): open it on the research side in
        // a new tab and stay where we were.
        window.open(researchUrl(h), "_blank", "noopener");
        window.history.replaceState(null, "", lastHash.current);
        return;
      }
      if (p.legacy) {
        const q = specFromQuery(h.split("?")[1] ?? "");
        if (q) setSpec(q);
        setStates((all) => {
          const next = withPanel(all[p.ws] ?? readWs(p.ws), p.legacy!);
          writeWs(p.ws, next);
          return { ...all, [p.ws]: next };
        });
        window.history.replaceState(null, "", `#/${p.ws}`);
      }
      lastHash.current = `#/${p.ws}`;
      setWsId(p.ws);
      setStates((all) => (all[p.ws] ? all : { ...all, [p.ws]: readWs(p.ws) }));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [initial.ws]);

  // On the Sim lab, a scenario stays in the address (#/scenario?type=...), so a link or a
  // bookmark reopens it (DEC-0038). replaceState fires no hashchange.
  useEffect(() => {
    if (wsId !== "simlab") return;
    const q = specToQuery(spec);
    const next = q && specToQuery(EMPTY_SPEC) !== q ? `#/scenario?${q}` : "#/simlab";
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [wsId, spec]);

  const switchWs = useCallback((id: string) => { if (WS_BY_ID[id]) window.location.hash = `#/${id}`; }, []);

  // ---- Commands ----
  const series = index.status === "ok" ? index.data.series : [];
  const find = useCallback((token: string): TermSeries | null => {
    const n = token.trim().toLowerCase();
    if (!n) return null;
    return series.find((s) => s.short.toLowerCase() === n)
      ?? series.find((s) => s.key.toLowerCase() === n)
      ?? series.find((s) => s.label.toLowerCase() === n)
      ?? (n.length >= 3 ? series.find((s) => s.label.toLowerCase().startsWith(n)) : undefined)
      ?? null;
  }, [series]);
  const runs = report.status === "ok" ? report.data.runs : [];
  const strategy = useCallback((token: string) => {
    const n = token.trim().toLowerCase();
    if (!n) return null;
    return runs.find((r) => r.strategy.toLowerCase() === n) ?? runs.find((r) => nameOf(r).toLowerCase() === n) ?? null;
  }, [runs]);

  const place = useCallback((fn: string, args: string[], newPanel: boolean) => {
    setWs((s) => {
      if (newPanel) {
        const el = document.querySelector(`[data-panel="${s.focus}"]`);
        const r = el?.getBoundingClientRect();
        const dir = r && r.height > r.width ? "col" : "row";
        const n = newLeaf(fn, args);
        return { ...s, tree: splitLeaf(s.tree, s.focus, dir, n), focus: n.id, max: s.max ? n.id : null };
      }
      const cur = findLeaf(s.tree, s.focus);
      return { ...s, tree: updateLeaf(s.tree, s.focus, { fn, args, opts: cur?.fn === fn && !args.length ? cur.opts : {} }) };
    });
  }, [setWs]);

  const open = useCallback((fn: string, args: string[] = []) => {
    setWs((s) => {
      const have = leaves(s.tree).find((l) => l.fn === fn);
      if (have) return { ...s, focus: have.id, max: s.max ? have.id : null, tree: args.length ? updateLeaf(s.tree, have.id, { args }) : s.tree };
      const n = newLeaf(fn, args);
      return { ...s, tree: splitLeaf(s.tree, s.focus, "row", n), focus: n.id, max: s.max ? n.id : null };
    });
  }, [setWs]);

  const run = useCallback((line: string, opts: { newPanel?: boolean } = {}): boolean => {
    const toks = line.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return false;
    const code = toks[0].toUpperCase();
    const newPanel = !!opts.newPanel;
    if (FN_BY_CODE[code]) {
      const args = toks.slice(1);
      if (code === "DES" && args.length) {
        const s = find(args.join(" ")) ?? find(args[0]);
        if (!s) { toast(`No series called ${args.join(" ")}`, { tone: "bad" }); return false; }
        setLink({ series: s.key });
        place("DES", [s.short], newPanel);
        return true;
      }
      if (code === "KPI" && args.length) {
        const r = strategy(args.join(" "));
        if (r) setLink({ strategy: r.strategy });
      }
      place(code, args, newPanel);
      return true;
    }
    // "EUR CMP JPY", "EUR DES": a series, then a function.
    if (toks.length > 1 && FN_BY_CODE[toks[1].toUpperCase()]) {
      return run([toks[1], toks[0], ...toks.slice(2)].join(" "), opts);
    }
    const s = find(line) ?? (toks.length === 1 ? null : find(toks[0]));
    if (s) {
      setLink({ series: s.key });
      place("DES", [s.short], newPanel);
      return true;
    }
    const r = strategy(line);
    if (r) {
      setLink({ strategy: r.strategy });
      place("KPI", [], newPanel);
      return true;
    }
    if (index.status !== "ok" && toks.length === 1) {
      toast(`${code} is not a function code, and the series list has not loaded`, { tone: "bad" });
      return false;
    }
    toast(`Nothing called ${line.trim()}. Type HELP for the codes.`, { tone: "bad" });
    return false;
  }, [find, strategy, place, setLink, index.status]);

  const ctx: TermCtx = useMemo(() => ({
    index, report, link, setLink, run, open, find, strategy, spec, setSpec, basket, setBasket, win, setWin,
  }), [index, report, link, setLink, run, open, find, strategy, spec, basket, win]);

  // ---- Keyboard ----
  const focusPanel = useCallback((id: string) => {
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-panel="${id}"]`)?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);
      const ctrl = e.ctrlKey || e.metaKey;
      if ((ctrl && e.key.toLowerCase() === "k") || (!typing && e.key === "/" && !ctrl && !e.altKey)) {
        e.preventDefault(); cmd.current?.focus(); return;
      }
      if (e.key === "F1") { e.preventDefault(); run("HELP"); return; }
      if (e.key in FKEYS) { e.preventDefault(); switchWs(WORKSPACES[FKEYS[e.key]].id); return; }
      if (ctrl && !e.shiftKey && !e.altKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); switchWs(WORKSPACES[+e.key - 1].id); return; }
      if (typing) return;
      if (ctrl && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const cur = document.querySelector(`[data-panel="${ws.focus}"]`)?.getBoundingClientRect();
        if (!cur) return;
        const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
        let best: { id: string; d: number } | null = null;
        for (const el of document.querySelectorAll<HTMLElement>(".term-slot:not([hidden]) [data-panel]")) {
          const id = el.dataset.panel!;
          if (id === ws.focus) continue;
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          const ok = e.key === "ArrowLeft" ? r.right <= cur.left + 4 : e.key === "ArrowRight" ? r.left >= cur.right - 4 : e.key === "ArrowUp" ? r.bottom <= cur.top + 4 : r.top >= cur.bottom - 4;
          if (!ok) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (!best || d < best.d) best = { id, d };
        }
        if (best) { const id = best.id; setWs((s) => ({ ...s, focus: id })); focusPanel(id); }
        return;
      }
      if (e.key === "Escape" && ws.max) { setWs((s) => ({ ...s, max: null })); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, switchWs, ws.focus, ws.max, setWs, focusPanel]);

  const resetWs = () => {
    clearWs(wsId);
    const fresh = freshWs(wsId);
    setStates((all) => ({ ...all, [wsId]: fresh }));
    toast(`${WS_BY_ID[wsId].label} workspace reset`);
  };
  const addPanel = () => {
    const n = newLeaf("MON");
    setWs((s) => ({ ...s, tree: splitLeaf(s.tree, s.focus, "row", n), focus: n.id, max: null }));
  };

  const asof = index.status === "ok" ? index.data.data_through : null;
  const panelList = leaves(ws.tree);

  return (
    <TermContext.Provider value={ctx}>
      <div className="ptm">
        <SkipLink />
        <header className="term-top">
          <button className="term-back" onClick={goBack} title="Back to Parity" aria-label="Back to Parity">
            <span aria-hidden className="term-back-arrow">‹</span>
            <img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={16} height={16} />
            <span>Back</span>
          </button>
          <span className="term-brand" aria-hidden>PARITY<b>TERMINAL</b></span>
          <CommandBar ref={cmd} onLeave={() => focusPanel(ws.focus)} />
          <span className="term-top-asof" title="Market data through">{asof ? `DATA ${asof}` : index.status === "loading" ? "LOADING" : "NO DATA"}</span>
        </header>
        <nav className="term-wsbar" aria-label="Workspaces">
          <div className="term-wstabs" role="tablist" aria-label="Workspaces">
            {WORKSPACES.map((w, i) => (
              <button key={w.id} role="tab" aria-selected={w.id === wsId} className={w.id === wsId ? "on" : ""}
                onClick={() => switchWs(w.id)} title={`${w.label} (Ctrl+${w.key} or F${i + 2})`}>
                <span className="term-ws-key">F{i + 2}</span>{w.label}
              </button>
            ))}
          </div>
          {mobile && (
            <label className="term-switcher">
              <span className="sr-only">Panel</span>
              <select value={ws.focus} onChange={(e) => setWs((s) => ({ ...s, focus: e.target.value }))}>
                {panelList.map((l, i) => <option key={l.id} value={l.id}>{i + 1}. {l.fn} {FN_BY_CODE[l.fn]?.title ?? ""}{l.args.length ? ` ${l.args.join(" ")}` : ""}</option>)}
              </select>
            </label>
          )}
          <div className="term-wsact">
            <button type="button" onClick={addPanel} title="Add a panel" aria-label="Add a panel">+</button>
            <button type="button" onClick={resetWs} title="Reset this workspace to its preset">RESET</button>
            <button type="button" onClick={() => run("HELP")} title="Help (F1)">HELP</button>
          </div>
        </nav>
        <main id="main" tabIndex={-1} className="term-main">
          {missing !== null
            ? <NotFound address={missing} home="#/overview" homeLabel="Overview" body="There is no Terminal workspace at this address. The link may be mistyped, or the page may have moved." />
            : <Workspace key={wsId} ws={ws} setWs={setWs} mobile={mobile} />}
        </main>
        <Ticker />
        <Toaster />
      </div>
    </TermContext.Provider>
  );
}
