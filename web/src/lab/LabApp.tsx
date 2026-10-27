// Parity Workbench (DEC-0043): Try settings, What if, Compare, Strategy search and the Edge
// Lab as one full-screen tool at /lab/ (lab.paritytrading.app). Its own rail, top bar, settings
// and keys. Each view keeps its state in the address, so Copy link reopens it as it is.
// Research numbers are shown read only and nothing done here is written to the research
// side (DEC-0015). One Back button returns to Parity.
//
//   #/try          Try settings: a strategy's settings test, one version at a time
//   #/whatif       What if: past events like a described one, and what markets did next
//   #/compare      Compare: league table, crises and correlation
//   #/search       Strategy search (research, read only)
//   #/edges        Edge Lab: the idea checklist and the lessons (research, read only)
//   #/pairs        Pairs: statistical arbitrage recipes and pair charts (research, read only)
//   #/settings     Settings
import { LiveMini } from "../components/LiveMini";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AppGuard } from "../auth";
import { copyLink } from "../components/CopyLink";
import { NotFound } from "../components/NotFound";
import { SkipLink } from "../components/SkipLink";
import { listBatches, loadReport, source, type BatchInfo } from "../lib/data";
import { date } from "../lib/format";
import { productUrl } from "../lib/space";
import type { Report } from "../lib/types";
import { setStoreUser } from "../lib/userStore";
import { Button, Dialog, ErrorBoundary, Icon, IconButton, lazyPage, Toaster } from "../ui";
import { FirstRunTour } from "../onboarding/FirstRunTour";
import { TryView } from "./TryView";
import { KeyTable } from "./KeyTable";
import { readSettings, VIEWS, writeSettings, type Settings, type View } from "./state";
import "./lab.css";

// Each view is its own file, loaded when opened; Try settings, the usual first view, is in
// the main file (REF-0024).
const CompareView = lazyPage(() => import("./CompareView").then((m) => ({ default: m.CompareView })));
const EdgesView = lazyPage(() => import("./EdgesView").then((m) => ({ default: m.EdgesView })));
const PairsView = lazyPage(() => import("./PairsView").then((m) => ({ default: m.PairsView })));
const SearchView = lazyPage(() => import("./SearchView").then((m) => ({ default: m.SearchView })));
const WhatIfView = lazyPage(() => import("./WhatIfView").then((m) => ({ default: m.WhatIfView })));
const SettingsView = lazyPage(() => import("./SettingsView").then((m) => ({ default: m.SettingsView })));
import { Assistant } from "../assistant/Mount";
import { isDesktop } from "../desktop/bridge";

export function LabApp() {
  return <AppGuard>{(user) => { setStoreUser(user.id); return <LabShell />; }}</AppGuard>;
}

// Parity opens the Workbench in a new tab, so a tab whose only history entry is this page was opened that way.
// Never in the desktop app: there the page is part of a window, and closing it left a black
// view and then an error when the window closed (desktop 0.2.0, DEC-0059).
const OPENED_AS_TAB = !isDesktop() && (!!window.opener || window.history.length <= 1);
function goBack() {
  if (OPENED_AS_TAB) {
    window.close();
    window.setTimeout(() => { window.location.href = productUrl(); }, 250);
    return;
  }
  window.location.href = productUrl();
}

function useHash(): string {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setH(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}

function useMobile(): boolean {
  const q = "(max-width: 760px)";
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
  return !!e?.tagName && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
};

const IDS = VIEWS.map((v) => v.id);

/** The run picked in the address (?run=), read once. */
const runFromHash = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("run") ?? undefined;

function LabShell() {
  const hash = useHash();
  const [settings, setSettingsState] = useState<Settings>(readSettings);
  const setSettings = useCallback((p: Partial<Settings>) => setSettingsState((s) => { const n = { ...s, ...p }; writeSettings(n); return n; }), []);
  const parts = hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const asked = parts[0] as View;
  const view: View = IDS.includes(asked) ? asked : (IDS.includes(settings.last) && settings.start === "last" ? settings.last : "try");
  // A view name the Workbench does not have shows its "not found" view (DEC-0055).
  const missing = parts[0] !== "" && !IDS.includes(asked);
  const arg = parts[1] ? decodeURIComponent(parts[1]) : undefined;
  const mobile = useMobile();
  const [keysOpen, setKeysOpen] = useState(false);

  // An address without a view opens the start view, in place.
  useEffect(() => {
    if (parts[0] === "") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/${view}`);
  }, [parts[0], view]);
  useEffect(() => { if (!missing && view !== "settings" && view !== settings.last) setSettings({ last: view }); }, [missing, view, settings.last, setSettings]);
  useEffect(() => { document.title = `${missing ? "Not found" : VIEWS.find((v) => v.id === view)?.label ?? ""} · Parity Workbench`; }, [missing, view]);

  // The run (Try settings and Compare read one). Loaded the first time a view needs it.
  const needsRun = !missing && (view === "try" || view === "compare");
  const [wanted, setWanted] = useState(needsRun);
  useEffect(() => { if (needsRun) setWanted(true); }, [needsRun]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [batchId, setBatchId] = useState<string | undefined>(runFromHash);
  const [report, setReport] = useState<Report | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  useEffect(() => { if (wanted) listBatches().then(setBatches).catch(() => setBatches([])); }, [wanted]);
  // Try settings also needs each strategy's settings test, a second file loaded only for it.
  const withTests = view === "try";
  useEffect(() => {
    if (!wanted) return;
    setRunError(null);
    loadReport(batchId, { sensitivity: withTests }).then(setReport).catch((e: Error) => setRunError(e.message));
  }, [wanted, batchId, withTests]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector(".ui-dialog-backdrop, [aria-modal='true']")) return;
      if (e.key === "?") { e.preventDefault(); setKeysOpen(true); return; }
      if (e.shiftKey && /^Digit[1-8]$/.test(e.code)) { e.preventDefault(); window.location.hash = `#/${VIEWS[Number(e.code.slice(5)) - 1].id}`; return; }
      if (e.shiftKey) return;
      if (e.key === "/") {
        const box = document.querySelector<HTMLInputElement>("[data-lab-find] input, input[data-lab-find]");
        if (box) { e.preventDefault(); box.focus(); box.select(); }
        return;
      }
      if (e.key.toLowerCase() === "l") { e.preventDefault(); void copyLink(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = VIEWS.find((v) => v.id === view)!;
  // The picked run follows into the other view that reads one.
  const hrefOf = (id: View) => `#/${id}${batchId && (id === "try" || id === "compare") ? `?run=${encodeURIComponent(batchId)}` : ""}`;
  const runPicker = needsRun && (batches.length > 0 || source === "local") ? (
    <label className="lb-run" title="Which run the numbers come from">
      <span className="sr-only">Run</span>
      <select value={batchId ?? ""} onChange={(e) => {
        const v = e.target.value || undefined;
        setBatchId(v);
        const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
        if (v) q.set("run", v); else q.delete("run");
        const s = q.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${window.location.hash.split("?")[0]}${s ? `?${s}` : ""}`);
      }}>
        <option value="">Latest run</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.kind === "official" ? `${b.run_id ?? "Official"} · ` : ""}{date(b.generated_at)}</option>)}
      </select>
    </label>
  ) : null;

  const body = missing ? <NotFound heading="h2" address={hash} home="#/" homeLabel="Workbench home" body="There is no Workbench view at this address. The link may be mistyped, or the page may have moved." />
    : view === "try" || view === "compare"
    ? (runError ? <div className="lb-msg">{runError}</div>
      : !report ? <div className="lb-msg lb-loading" aria-busy="true">Loading the run</div>
      : view === "try" ? <TryView key={report.generated_at} report={report} /> : <CompareView report={report} />)
    : view === "whatif" ? <WhatIfView />
    : view === "search" ? <SearchView />
    : view === "edges" ? <EdgesView key={arg ?? ""} focus={arg} />
    : view === "pairs" ? <PairsView />
    : view === "live" ? <div className="lb-live"><LiveMini height={360} /></div>
    : <SettingsView settings={settings} set={setSettings} />;

  return (
    <div className="plb" data-density={settings.density} data-mobile={mobile || undefined}>
      <div className="plb-glow" aria-hidden />
      <SkipLink />
      <header className="lb-top" data-desktop-header>
        <button type="button" className="lb-back" onClick={goBack} title="Back to Parity" aria-label="Back to Parity">
          <span aria-hidden>‹</span>
          <img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={16} height={16} />
          <span className="lb-back-t">Back</span>
        </button>
        <span className="lb-brand" aria-hidden>PARITY <b>WORKBENCH</b></span>
        <h1 className="lb-viewname">{missing ? "Not found" : current.label}</h1>
        {!missing && current.research && <span className="lb-ro" title="Numbers from the research side. Nothing here changes them.">Research · read only</span>}
        <span className="lb-gap" />
        {runPicker}
        <Button size="xs" icon="link" className="lb-copy" onClick={() => void copyLink()} title="Copy a link to this view as it is now (L)">
          <span className="lb-btn-t">Copy link</span>
        </Button>
        <IconButton icon="keyboard" size="sm" variant="plain" className="lb-keys" onClick={() => setKeysOpen(true)} label="Keys (?)" />
      </header>

      <div className="lb-mid">
        {!mobile && (
          <nav className="lb-rail" aria-label="Workbench">
            {VIEWS.map((v, i) => (
              <a key={v.id} href={hrefOf(v.id)} className={`lb-rail-i ${(!missing && view === v.id) ? "on" : ""} ${v.id === "settings" ? "end" : ""}`} aria-current={(!missing && view === v.id) ? "page" : undefined}
                title={`${v.label} (Shift+${i + 1})`} aria-label={v.label}>
                <Icon name={v.icon} size={17} />
              </a>
            ))}
          </nav>
        )}
        <main id="main" tabIndex={-1} className="lb-main ui-route-kids">
          <ErrorBoundary key={view} scope="page">
            <Suspense fallback={<div className="lb-msg lb-loading" aria-busy="true">Loading</div>}>{body}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <footer className="lb-legal">
        <span>Research and education only. Not investment advice. Backtests do not predict returns.</span>
        <span className="lb-legal-r">{needsRun && report ? `Run ${date(report.generated_at)}` : ""}</span>
      </footer>

      {mobile && (
        <nav className="lb-tabs" aria-label="Workbench">
          {VIEWS.map((v) => (
            <a key={v.id} href={hrefOf(v.id)} className={(!missing && view === v.id) ? "on" : ""} aria-current={(!missing && view === v.id) ? "page" : undefined}><Icon name={v.icon} size={17} /><span>{v.short}</span></a>
          ))}
        </nav>
      )}

      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keys" width={460}>
        <KeyTable />
      </Dialog>
      <Toaster />
      <Assistant place="workbench" />
      <FirstRunTour areas={["lab"]} ready={view !== "settings"} />
    </div>
  );
}
