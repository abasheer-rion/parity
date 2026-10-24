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
import { Markets } from "./pages/markets/Markets";
import { Learn } from "./pages/Learn";
import { EdgeLab } from "./pages/EdgeLab";
import { Academy } from "./pages/Academy";
import { PrivateResearch } from "./pages/PrivateResearch";
import { Overview } from "./pages/Overview";
import { DocPage, DocsHome, RefsPage } from "./pages/Reader";
import { Scenarios } from "./pages/Scenarios";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { SimLanding } from "./pages/SimLanding";
import { UILibrary } from "./pages/UILibrary";
import { PageSkeleton, Toaster } from "./ui";
import { LegalLinks } from "./legal/LegalLinks";
import { Signals } from "./pages/Signals";
import { Start } from "./pages/Start";
import { HowItWorks } from "./pages/HowItWorks";
import { ProductHome } from "./pages/ProductHome";
import { ResearchHome } from "./pages/ResearchHome";
import { Watchlist } from "./pages/Watchlist";
import { Verify } from "./pages/Verify";
import { SharePanel } from "./pages/verify/Share";
import { otherSide, simUrl, SPACE, SPACE_ROOT, tradeHashFor, tradeUrl } from "./lib/space";
import { Strategies } from "./pages/Strategies";
import { StrategyPage } from "./pages/StrategyPage";
import { setStoreUser } from "./lib/userStore";
import { useRouteMeta } from "./lib/deeplink";
import { nameById, nameOf } from "./lib/strategyMeta";

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
  return <AppGuard>{(user) => { setStoreUser(user.id); return <Dashboard email={user.email} onSignOut={user.signOut} />; }}</AppGuard>;
}

// Pages that read only what is bundled in the build, not the selected run.
const STANDALONE = ["start", "how", "search", "news", "learn", "catalog", "algo", "ledger", "sources", "docs", "doc", "refs", "settings", "ui", "scenarios", "sim", "markets", "edges", "academy", "private", "trade", "verify"];

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

  // Sim World (DEC-0020) and Parity Trade (DEC-0040) run full screen on their own sites:
  // any link to #/sim or #/trade opens them in a new tab. Typing #/sim still lands on a
  // small card that links there; typing #/trade goes straight to Parity Trade.
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") ?? "";
      if (/^#\/trade(\/|\?|$)/.test(href)) {
        e.preventDefault();
        window.open(tradeUrl(tradeHashFor(href)), "_blank", "noopener");
        return;
      }
      const m = /^#\/sim(?:\/([a-z]+))?/.exec(href);
      if (!m) return;
      e.preventDefault();
      window.open(simUrl(m[1]), "_blank", "noopener");
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, []);

  const [path, query = ""] = hash.split("?");
  const [, route = "", arg, extra] = path.split("/");
  const q = new URLSearchParams(query).get("q") ?? undefined;
  const standalone = STANDALONE.includes(route);
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);
  // The tab title and share tags follow the page (DEC-0038).
  const run = route === "strategy" && arg && report ? report.runs.find((r) => r.strategy === dec(arg)) : undefined;
  useRouteMeta(SPACE, route, dec(arg), route === "strategy" && arg ? (run ? nameOf(run) : nameById(dec(arg)!)) : undefined);
  // A page from the other side of Parity opens there instead (DEC-0015).
  const away = otherSide(route);
  useEffect(() => { if (away) window.location.replace(`${SPACE_ROOT[away]}${hash}`); }, [away, hash]);
  // Old #/trade links (bookmarks, history) open Parity Trade in place (DEC-0040).
  useEffect(() => { if (route === "trade") window.location.replace(tradeUrl(tradeHashFor(hash))); }, [route, hash]);
  if (away || route === "trade") return null;

  // The run picker lives in the sidebar footer, and only on pages that read a run.
  const runPicker = standalone || (batches.length === 0 && source !== "local") ? undefined : (
    <>
      <span className="side-run-label">Results from{source === "local" && <span className="chip-badge">local run</span>}</span>
      {batches.length > 0 && (
        <select className="run-picker" aria-label="Research run" value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || undefined)}>
          <option value="">Latest run</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.kind === "official" ? `${b.run_id ?? "Official"} · ` : ""}{date(b.generated_at)}</option>)}
        </select>
      )}
    </>
  );

  return (
    <Shell route={route} arg={arg} hash={hash} run={runPicker} email={email} onSignOut={onSignOut} wide={route === "doc"}>
      {/* Keyed by route: each page eases in when it opens (transform and opacity only). */}
      <div key={route} className="ui-route">
      {route === "docs" && <DocsHome tag={arg === "tag" ? dec(extra) : undefined} type={arg === "type" ? dec(extra) : undefined} query={q} />}
      {route === "doc" && arg && <DocPage id={dec(arg)!} anchor={dec(extra)} />}
      {route === "refs" && <RefsPage focus={dec(arg)} />}
      {route === "start" && <Start report={report} />}
      {route === "how" && <HowItWorks />}
      {route === "search" && <Search />}
      {route === "ui" && <UILibrary section={arg} />}
      {route === "scenarios" && <Scenarios />}
      {route === "sim" && <SimLanding />}
      {route === "learn" && <Learn focus={arg} />}
      {route === "catalog" && <Catalog />}
      {route === "edges" && <EdgeLab focus={dec(arg)} />}
      {route === "academy" && <Academy course={dec(arg)} lesson={dec(extra)} />}
      {route === "private" && <PrivateResearch />}
      {route === "verify" && <Verify share={(r, file) => <SharePanel key={`${file?.sha256 ?? ""}:${r.tries}:${r.kind}:${r.verdict.sentence}`} r={r} file={file} />} />}
      {route === "algo" && arg && <AlgorithmReport slug={dec(arg)!} />}
      {route === "ledger" && <LedgerPage />}
      {route === "news" && <News view={arg} />}
      {route === "markets" && <Markets view={arg?.split("?")[0]} />}
      {route === "sources" && <DataSources focus={arg} />}
      {route === "settings" && (
        <Settings section={arg} />
      )}
      {!standalone && error && <div className="error">{error}</div>}
      {!standalone && !report && !error && <PageSkeleton parts={["stats", "chart", "table"]} label="Loading results" />}
      {!standalone && report && (
        <>
          {route === "compare" ? <Compare report={report} /> :
            route === "lab" ? <Lab report={report} /> :
            route === "explore" ? <Explore report={report} /> :
            route === "strategies" ? <Strategies report={report} query={q} /> :
            route === "strategy" && arg ? <StrategyPage report={report} name={dec(arg)!} /> :
            route === "signals" ? <Signals report={report} /> :
            route === "data" ? <DataPage report={report} /> :
            route === "overview" ? <Overview report={report} email={email} /> :
            route === "watchlist" ? <Watchlist report={report} /> :
            SPACE === "research" ? <ResearchHome report={report} /> :
            <ProductHome report={report} email={email} />}
          <footer className="muted small">
            {report.kind === "official" ? `Official run ${report.run_id ?? ""}` : "Exploratory nightly run"} generated {date(report.generated_at)}
            {report.git_sha && <> from commit <a href={`${REPO_URL}/commit/${report.git_sha}`}>{report.git_sha}</a></>}.
            Research only, not investment advice.
            <LegalLinks className="start app-legal" />
          </footer>
        </>
      )}
      </div>
      <Popups />
      <Palette report={report} />
      <Toaster />
    </Shell>
  );
}
