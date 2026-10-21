import { useEffect, useState } from "react";
import { AppGuard } from "./auth";
import { Palette } from "./components/Palette";
import { Popups } from "./components/Popups";
import { Shell } from "./components/Shell";
import { listBatches, loadReport, source, type BatchInfo } from "./lib/data";
import { loadDocs } from "./lib/docs";
import { date, REPO_URL } from "./lib/format";
import { applyTheme } from "./lib/prefs";
import { scrollToTop } from "./lib/scroll";
import type { Report } from "./lib/types";
import { AlgorithmReport } from "./pages/AlgorithmReport";
import { Catalog } from "./pages/Catalog";
import { Compare } from "./pages/Compare";
import { DataPage } from "./pages/DataPage";
import { DataSources } from "./pages/DataSources";
import { Explore } from "./pages/Explore";
import { Lab } from "./pages/Lab";
import { LedgerPage } from "./pages/LedgerPage";
import { News } from "./pages/News";
import { Learn } from "./pages/Learn";
import { Overview } from "./pages/Overview";
import { DocPage, DocsHome, RefsPage } from "./pages/Reader";
import { Scenarios } from "./pages/Scenarios";
import { Settings } from "./pages/Settings";
import { SimWorld } from "./pages/SimWorld";
import { UILibrary } from "./pages/UILibrary";
import { Toaster } from "./ui";
import { Signals } from "./pages/Signals";
import { Strategies } from "./pages/Strategies";
import { StrategyPage } from "./pages/StrategyPage";

applyTheme();

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  // Every page of the app needs a session (DEC-0012). The public pages (/, /login/,
  // /signup/, /reset/, /verify/) are a separate entry: src/auth/main.tsx.
  return <AppGuard>{(user) => <Dashboard email={user.email} onSignOut={user.signOut} />}</AppGuard>;
}

// Pages that read only what is bundled in the build, not the selected run.
const STANDALONE = ["news", "learn", "catalog", "algo", "ledger", "sources", "docs", "doc", "refs", "settings", "ui", "scenarios"];

function Dashboard({ email, onSignOut }: { email: string | null; onSignOut?: () => void }) {
  const hash = useHash();
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [batchId, setBatchId] = useState<string | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBatches().then(setBatches).catch(() => setBatches([]));
    // Fetch the docs once the page is idle, so previews and the reader open instantly.
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300));
    idle(() => void loadDocs());
  }, []);

  useEffect(() => {
    setError(null);
    loadReport(batchId).then(setReport).catch((e: Error) => setError(e.message));
  }, [batchId]);

  useEffect(() => { scrollToTop(); }, [hash.split("/").slice(0, 3).join("/")]);

  const [path, query = ""] = hash.split("?");
  const [, route = "", arg, extra] = path.split("/");
  const q = new URLSearchParams(query).get("q") ?? undefined;
  const standalone = STANDALONE.includes(route);
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);

  const runPicker = (
    <>
      {batches.length > 0 && (
        <select className="run-picker" aria-label="Research run" value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || undefined)}>
          <option value="">Latest run</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.kind === "official" ? `${b.run_id ?? "Official"} · ` : ""}{date(b.generated_at)}</option>)}
        </select>
      )}
      {source === "local" && <span className="chip-badge">local run</span>}
    </>
  );

  return (
    <Shell route={route} arg={arg} hash={hash} top={runPicker} email={email} onSignOut={onSignOut} wide={route === "doc"} full={route === "" || route === "home"}>
      {route === "docs" && <DocsHome tag={arg === "tag" ? dec(extra) : undefined} type={arg === "type" ? dec(extra) : undefined} query={q} />}
      {route === "doc" && arg && <DocPage id={dec(arg)!} anchor={dec(extra)} />}
      {route === "refs" && <RefsPage focus={dec(arg)} />}
      {route === "ui" && <UILibrary section={arg} />}
      {route === "scenarios" && <Scenarios />}
      {route === "learn" && <Learn focus={arg} />}
      {route === "catalog" && <Catalog />}
      {route === "algo" && arg && <AlgorithmReport slug={dec(arg)!} />}
      {route === "ledger" && <LedgerPage />}
      {route === "news" && <News view={arg} />}
      {route === "sources" && <DataSources focus={arg} />}
      {route === "settings" && (
        <Settings section={arg} />
      )}
      {!standalone && error && <div className="error">{error}</div>}
      {!standalone && !report && !error && <p className="muted">Loading results</p>}
      {!standalone && report && (
        <>
          {route === "compare" ? <Compare report={report} /> :
            route === "lab" ? <Lab report={report} /> :
            route === "explore" ? <Explore report={report} /> :
            route === "strategies" ? <Strategies report={report} /> :
            route === "strategy" && arg ? <StrategyPage report={report} name={dec(arg)!} /> :
            route === "signals" ? <Signals report={report} /> :
            route === "data" ? <DataPage report={report} /> :
            route === "overview" ? <Overview report={report} email={email} /> :
            <SimWorld report={report} />}
          <footer className="muted small">
            {report.kind === "official" ? `Official run ${report.run_id ?? ""}` : "Exploratory nightly run"} generated {date(report.generated_at)}
            {report.git_sha && <> from commit <a href={`${REPO_URL}/commit/${report.git_sha}`}>{report.git_sha}</a></>}.
            Research only, not investment advice.
          </footer>
        </>
      )}
      <Popups />
      <Palette />
      <Toaster />
    </Shell>
  );
}
