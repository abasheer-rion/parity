import { Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AppGuard } from "./auth";
import { NotFound } from "./components/NotFound";
import { Shell } from "./components/Shell";
import { listBatches, loadReport, loadSearch, source, type BatchInfo } from "./lib/data";
import { date } from "./lib/format";
import { applyTheme } from "./lib/prefs";
import { scrollToTop } from "./lib/scroll";
import type { Report } from "./lib/types";
import { Button, ErrorBoundary, lazyPage, ListSelect, PageSkeleton, preload, Toaster } from "./ui";
import { loadDocIndex } from "./lib/docs";
import { academyHashFor, academyUrl, LAB_ROUTES, labHashFor, labUrl, otherSide, simUrl, SPACE, SPACE_ROOT, tradeHashFor, tradeUrl, unknownRoute } from "./lib/space";
import { setStoreUser } from "./lib/userStore";
import { syncConsent } from "./lib/personalize/api";
import { useRouteMeta } from "./lib/deeplink";
import { PAYMENTS_ENABLED } from "./lib/payments/flag";
import { nameById, nameOf } from "./lib/strategyMeta";

// Every page is its own file, loaded when it is first opened, so the app starts with only
// the frame and the page in front of you (REF-0024). The likely next pages load while idle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<M extends Record<K, ComponentType<any>>, K extends keyof M & string>(load: () => Promise<M>, name: K) {
  return lazyPage(() => load().then((m) => ({ default: m[name] })));
}
const PAGE_FILES = {
  AlgorithmReport: () => import("./pages/AlgorithmReport"),
  Catalog: () => import("./pages/Catalog"),
  Competitors: () => import("./pages/Competitors"),
  DataPage: () => import("./pages/DataPage"),
  DataSources: () => import("./pages/DataSources"),
  Latency: () => import("./pages/Latency"),
  Metrics: () => import("./pages/Metrics"),
  Explore: () => import("./pages/Explore"),
  LedgerPage: () => import("./pages/LedgerPage"),
  News: () => import("./pages/News"),
  Markets: () => import("./pages/markets/Markets"),
  Learn: () => import("./pages/Learn"),
  PrivateResearch: () => import("./pages/PrivateResearch"),
  Pairs: () => import("./pages/Pairs"),
  Overview: () => import("./pages/Overview"),
  Settings: () => import("./pages/Settings"),
  SimLanding: () => import("./pages/SimLanding"),
  UILibrary: () => import("./pages/UILibrary"),
  Signals: () => import("./pages/Signals"),
  Start: () => import("./pages/Start"),
  HowItWorks: () => import("./pages/HowItWorks"),
  ProductHome: () => import("./pages/ProductHome"),
  ResearchHome: () => import("./pages/ResearchHome"),
  Watchlist: () => import("./pages/Watchlist"),
  Verify: () => import("./pages/Verify"),
  Strategies: () => import("./pages/Strategies"),
  StrategyPage: () => import("./pages/StrategyPage"),
  Pricing: () => import("./pages/Pricing"),
  Reader: () => import("./pages/Reader"),
  Share: () => import("./pages/verify/Share"),
  DataCatalog: () => import("./pages/registry/DataCatalog"),
  Candidates: () => import("./pages/registry/Candidates"),
  DataHealth: () => import("./pages/registry/DataHealth"),
};
const AlgorithmReport = page(PAGE_FILES.AlgorithmReport, "AlgorithmReport");
const Catalog = page(PAGE_FILES.Catalog, "Catalog");
const Competitors = page(PAGE_FILES.Competitors, "Competitors");
const DataPage = page(PAGE_FILES.DataPage, "DataPage");
const DataSources = page(PAGE_FILES.DataSources, "DataSources");
const Latency = page(PAGE_FILES.Latency, "Latency");
const Metrics = page(PAGE_FILES.Metrics, "Metrics");
const Explore = page(PAGE_FILES.Explore, "Explore");
const LedgerPage = page(PAGE_FILES.LedgerPage, "LedgerPage");
const News = page(PAGE_FILES.News, "News");
const Markets = page(PAGE_FILES.Markets, "Markets");
const Learn = page(PAGE_FILES.Learn, "Learn");
const PrivateResearch = page(PAGE_FILES.PrivateResearch, "PrivateResearch");
const Pairs = page(PAGE_FILES.Pairs, "Pairs");
const Overview = page(PAGE_FILES.Overview, "Overview");
const Settings = page(PAGE_FILES.Settings, "Settings");
const SimLanding = page(PAGE_FILES.SimLanding, "SimLanding");
const UILibrary = page(PAGE_FILES.UILibrary, "UILibrary");
const Signals = page(PAGE_FILES.Signals, "Signals");
const Start = page(PAGE_FILES.Start, "Start");
const HowItWorks = page(PAGE_FILES.HowItWorks, "HowItWorks");
const ProductHome = page(PAGE_FILES.ProductHome, "ProductHome");
const ResearchHome = page(PAGE_FILES.ResearchHome, "ResearchHome");
const Watchlist = page(PAGE_FILES.Watchlist, "Watchlist");
const Verify = page(PAGE_FILES.Verify, "Verify");
const Strategies = page(PAGE_FILES.Strategies, "Strategies");
const StrategyPage = page(PAGE_FILES.StrategyPage, "StrategyPage");
const Pricing = page(PAGE_FILES.Pricing, "Pricing");
const DataCatalog = page(PAGE_FILES.DataCatalog, "DataCatalog");
const SeriesPage = page(PAGE_FILES.DataCatalog, "SeriesPage");
const Candidates = page(PAGE_FILES.Candidates, "Candidates");
const DataHealth = page(PAGE_FILES.DataHealth, "DataHealth");
// The command palette and the hover cards carry the catalog and glossary (about 190 kB), so
// they arrive once the first page has drawn.
const Palette = page(() => import("./components/Palette"), "Palette");
const Popups = page(() => import("./components/Popups"), "Popups");
const DocPage = page(PAGE_FILES.Reader, "DocPage");
const DocsHome = page(PAGE_FILES.Reader, "DocsHome");
const RefsPage = page(PAGE_FILES.Reader, "RefsPage");
const SharePanel = page(PAGE_FILES.Share, "SharePanel");

// Which file draws each route, so a link can start loading its page on hover.
const ROUTE_FILE: Record<string, () => Promise<unknown>> = {
  "": PAGE_FILES.ProductHome, home: PAGE_FILES.ProductHome, strategies: PAGE_FILES.Strategies, strategy: PAGE_FILES.StrategyPage,
  watchlist: PAGE_FILES.Watchlist, news: PAGE_FILES.News, markets: PAGE_FILES.Markets, learn: PAGE_FILES.Learn, verify: PAGE_FILES.Verify,
  settings: PAGE_FILES.Settings, start: PAGE_FILES.Start, how: PAGE_FILES.HowItWorks, docs: PAGE_FILES.Reader, doc: PAGE_FILES.Reader,
  refs: PAGE_FILES.Reader, catalog: PAGE_FILES.Catalog, algo: PAGE_FILES.AlgorithmReport, ledger: PAGE_FILES.LedgerPage,
  sources: PAGE_FILES.DataSources, latency: PAGE_FILES.Latency, metrics: PAGE_FILES.Metrics, explore: PAGE_FILES.Explore, overview: PAGE_FILES.Overview,
  signals: PAGE_FILES.Signals, data: PAGE_FILES.DataPage, private: PAGE_FILES.PrivateResearch, competitors: PAGE_FILES.Competitors, pairs: PAGE_FILES.Pairs,
  pricing: PAGE_FILES.Pricing, ui: PAGE_FILES.UILibrary, sim: PAGE_FILES.SimLanding, registry: PAGE_FILES.DataCatalog,
};

/** Loads a route's page file when the pointer or focus reaches a link to it. */
function warmOnHover() {
  const seen = new Set<string>();
  const on = (e: Event) => {
    const href = (e.target as HTMLElement | null)?.closest?.("a")?.getAttribute("href") ?? "";
    if (!href.startsWith("#/")) return;
    const route = href.slice(2).split(/[/?]/)[0];
    if (seen.has(route) || !ROUTE_FILE[route]) return;
    seen.add(route);
    void ROUTE_FILE[route]().catch(() => seen.delete(route));
  };
  document.addEventListener("pointerover", on, { passive: true });
  document.addEventListener("focusin", on);
}

/** Starts loading pages before they are opened: the home page at once, the usual next ones when idle. */
function warmPages(space: string) {
  void (space === "research" ? PAGE_FILES.ResearchHome() : PAGE_FILES.ProductHome());
  // The research home also shows the strategy search and the newest docs: ask for both now.
  if (space === "research" && !(window.location.hash || "#/").split("/")[1]) {
    preload("search", loadSearch);
    void loadDocIndex().catch(() => {});
  }
  // After the first page and its data have had the network to themselves.
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
  window.setTimeout(() => idle(() => { for (const f of [PAGE_FILES.Strategies, PAGE_FILES.StrategyPage, PAGE_FILES.Learn, PAGE_FILES.Settings]) void f().catch(() => {}); }), 4000);
}

applyTheme();
warmPages(SPACE);
warmOnHover();


/** Draws its children once the browser is idle after the first paint, never in the way of it. */
function WhenIdle({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    const id = idle(() => setReady(true), { timeout: 1500 } as IdleRequestOptions);
    return () => { (window.cancelIdleCallback ?? window.clearTimeout)(id as number); };
  }, []);
  return ready ? <Suspense fallback={null}>{children}</Suspense> : null;
}

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
  return <AppGuard>{(user) => { setStoreUser(user.id); syncConsent(); return <Dashboard email={user.email} onSignOut={user.signOut} />; }}</AppGuard>;
}

// Pages that read only what is bundled in the build, not the selected run.
// The pricing page exists only when the payments flag is on (DEC-0046).
const STANDALONE = [...(PAYMENTS_ENABLED ? ["pricing"] : []), "start", "how", "search", "news", "learn", "catalog", "algo", "ledger", "sources", "latency", "metrics", "docs", "doc", "refs", "settings", "ui", "scenarios", "sim", "markets", "edges", "academy", "private", "trade", "verify", "competitors", "registry", "pairs"];

// The newest run is the largest file the dashboard reads: ask for it now, while the code and
// the sign-in check are still arriving, unless the page opening does not read it.
{
  const first = (window.location.hash || "#/").split("?")[0].split("/")[1] ?? "";
  if (!STANDALONE.includes(first)) void loadReport().catch(() => {});
}

function Dashboard({ email, onSignOut }: { email: string | null; onSignOut?: () => void }) {
  const hash = useHash();
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [batchId, setBatchId] = useState<string | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBatches().then(setBatches).catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    setError(null);
    loadReport(batchId).then(setReport).catch((e: Error) => setError(e.message));
  }, [batchId]);

  useEffect(() => { scrollToTop(); }, [hash.split("/").slice(0, 3).join("/")]);

  // Sim World (DEC-0020), Parity Trade (DEC-0040), Parity Academy (DEC-0042) and Parity
  // Workbench (DEC-0043) run full screen on their own sites: any link to #/sim, #/trade,
  // #/academy or a Workbench page (#/lab, #/compare, #/scenarios, #/search, #/edges) opens
  // them in a new tab. Typing #/sim still lands on a small card that links there; typing
  // one of the others goes straight to that app.
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
      if (/^#\/academy(\/|\?|$)/.test(href)) {
        e.preventDefault();
        window.open(academyUrl(academyHashFor(href)), "_blank", "noopener");
        return;
      }
      if (LAB_ROUTES.includes(href.replace(/^#\/?/, "").split(/[/?]/)[0]) && href.startsWith("#/")) {
        e.preventDefault();
        window.open(labUrl(labHashFor(href)), "_blank", "noopener");
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
  const missing = unknownRoute(route, arg, PAYMENTS_ENABLED);
  const standalone = STANDALONE.includes(route) || missing;
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);
  // The tab title and share tags follow the page (DEC-0038).
  const run = route === "strategy" && arg && report ? report.runs.find((r) => r.strategy === dec(arg)) : undefined;
  useRouteMeta(SPACE, route, dec(arg), route === "strategy" && arg ? (run ? nameOf(run) : nameById(dec(arg)!)) : undefined);
  // A page from the other side of Parity opens there instead (DEC-0015).
  const away = otherSide(route);
  useEffect(() => { if (away) window.location.replace(`${SPACE_ROOT[away]}${hash}`); }, [away, hash]);
  // Old #/trade links (bookmarks, history) open Parity Trade in place (DEC-0040).
  useEffect(() => { if (route === "trade") window.location.replace(tradeUrl(tradeHashFor(hash))); }, [route, hash]);
  // Old #/academy links open Parity Academy in place, at the same course and lesson (DEC-0042).
  useEffect(() => { if (route === "academy") window.location.replace(academyUrl(academyHashFor(hash))); }, [route, hash]);
  // Old Try settings, What if, Compare, Strategy search and Edge Lab links open Parity
  // Workbench in place, with the same strategy filters, scenario or lesson (DEC-0043).
  const toLab = LAB_ROUTES.includes(route);
  useEffect(() => { if (toLab) window.location.replace(labUrl(labHashFor(hash))); }, [toLab, hash]);
  if (away || route === "trade" || route === "academy" || toLab) return null;

  // The run picker lives in the sidebar footer, and only on pages that read a run.
  const runPicker = standalone || (batches.length === 0 && source !== "local") ? undefined : (
    <>
      <span className="side-run-label">Results from{source === "local" && <span className="chip-badge">local run</span>}</span>
      {batches.length > 0 && (
        <ListSelect className="side-lsel" label="Research run" value={batchId ?? ""} onChange={(v) => setBatchId(v || undefined)}
          options={[["", "Latest run"], ...batches.map((b) => [b.id, `${b.kind === "official" ? `${b.run_id ?? "Official"} · ` : ""}${date(b.generated_at)}`] as [string, string])]} />
      )}
    </>
  );

  return (
    <Shell route={route} arg={arg} hash={hash} run={runPicker} email={email} onSignOut={onSignOut} wide={route === "doc"}>
      {/* Keyed by route: each page eases in when it opens (transform and opacity only). */}
      <div key={route} className="ui-route">
      {missing && (
        <NotFound address={hash} home="#/" homeLabel={SPACE === "research" ? "Research home" : "Home"}>
          <Button variant="secondary" icon="search" onClick={() => window.dispatchEvent(new Event("parity:search"))}>Search</Button>
        </NotFound>
      )}
      <ErrorBoundary key={route} scope="page">
      <Suspense fallback={<PageSkeleton parts={["stats", "table"]} label="Loading page" />}>
      {route === "docs" && <DocsHome tag={arg === "tag" ? dec(extra) : undefined} type={arg === "type" ? dec(extra) : undefined} query={q} />}
      {route === "doc" && arg && <DocPage id={dec(arg)!} anchor={dec(extra)} />}
      {route === "refs" && <RefsPage focus={dec(arg)} />}
      {route === "start" && <Start report={report} />}
      {route === "how" && <HowItWorks />}
      {route === "ui" && <UILibrary section={arg} />}
      {route === "sim" && <SimLanding />}
      {route === "learn" && <Learn focus={arg} />}
      {route === "catalog" && <Catalog />}
      {route === "private" && <PrivateResearch />}
      {route === "competitors" && <Competitors focus={dec(arg)} />}
      {route === "pairs" && <Pairs />}
      {route === "verify" && <Verify share={(r, file) => <SharePanel key={`${file?.sha256 ?? ""}:${r.tries}:${r.kind}:${r.verdict.sentence}`} r={r} file={file} />} />}
      {route === "algo" && arg && <AlgorithmReport slug={dec(arg)!} />}
      {route === "ledger" && <LedgerPage />}
      {route === "news" && <News view={arg} />}
      {route === "markets" && <Markets view={arg?.split("?")[0]} />}
      {route === "sources" && <DataSources focus={arg} />}
      {route === "pricing" && PAYMENTS_ENABLED && <Pricing />}
      {route === "latency" && <Latency />}
      {route === "registry" && (arg === "candidates" ? <Candidates /> : arg === "health" ? <DataHealth /> :
        arg === "s" && extra ? <SeriesPage id={dec(extra)!} /> : <DataCatalog key={hash} />)}
      {route === "metrics" && <Metrics />}
      {route === "settings" && (
        <Settings section={arg} />
      )}
      {!standalone && error && (
        <div className="error" role="alert">{error} <button type="button" className="ui-crash-inline" onClick={() => { setError(null); loadReport(batchId).then(setReport).catch((e: Error) => setError(e.message)); }}>Try again</button></div>
      )}
      {!standalone && !report && !error && <PageSkeleton parts={["stats", "chart", "table"]} label="Loading results" />}
      {!standalone && report && (
        // Fades in over the space the skeleton held (REF-0023).
        <div className="ui-fade-in">
          {route === "explore" ? <Explore report={report} /> :
            route === "strategies" ? <Strategies report={report} query={q} /> :
            route === "strategy" && arg ? <StrategyPage report={report} name={dec(arg)!} /> :
            route === "signals" ? <Signals report={report} /> :
            route === "data" ? <DataPage report={report} /> :
            route === "overview" ? <Overview report={report} email={email} /> :
            route === "watchlist" ? <Watchlist report={report} /> :
            SPACE === "research" ? <ResearchHome report={report} /> :
            <ProductHome report={report} email={email} />}
        </div>
      )}
      </Suspense>
      </ErrorBoundary>
      </div>
      <WhenIdle>
        <Popups />
        <Palette report={report} />
      </WhenIdle>
      <Toaster />
    </Shell>
  );
}
