import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Palette } from "./components/Palette";
import { Popups } from "./components/Popups";
import { Shell } from "./components/Shell";
import { currentSession, listBatches, loadReport, sendSignInLink, source, supabase } from "./lib/data";
import { loadDocs } from "./lib/docs";
import { date, REPO_URL } from "./lib/format";
import { applyTheme } from "./lib/prefs";
import type { BatchSummary, Report } from "./lib/types";
import { AlgorithmReport } from "./pages/AlgorithmReport";
import { Catalog } from "./pages/Catalog";
import { Compare } from "./pages/Compare";
import { DataPage } from "./pages/DataPage";
import { DataSources } from "./pages/DataSources";
import { Explore } from "./pages/Explore";
import { Lab } from "./pages/Lab";
import { LedgerPage } from "./pages/LedgerPage";
import { Learn } from "./pages/Learn";
import { Overview } from "./pages/Overview";
import { DocPage, DocsHome, RefsPage } from "./pages/Reader";
import { Settings } from "./pages/Settings";
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
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(source !== "supabase");

  useEffect(() => {
    if (!supabase) return;
    currentSession().then((s) => {
      setSession(s);
      setChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (source === "none") {
    return (
      <div className="center">
        <h1>Not connected</h1>
        <p>This build has no data source. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when building.</p>
      </div>
    );
  }
  if (!checked) return <p className="center muted">Loading</p>;
  if (source === "supabase" && !session) return <SignIn />;
  return <Dashboard email={session?.user.email ?? null} />;
}

// Pages that read only what is bundled in the build, not the selected run.
const STANDALONE = ["learn", "catalog", "algo", "ledger", "sources", "docs", "doc", "refs", "settings", "ui"];

function Dashboard({ email }: { email: string | null }) {
  const hash = useHash();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
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

  useEffect(() => { window.scrollTo(0, 0); }, [hash.split("/").slice(0, 3).join("/")]);

  const [path, query = ""] = hash.split("?");
  const [, route = "", arg, extra] = path.split("/");
  const q = new URLSearchParams(query).get("q") ?? undefined;
  const standalone = STANDALONE.includes(route);
  const signOut = supabase ? () => void supabase!.auth.signOut() : undefined;
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);

  const runPicker = (
    <>
      {batches.length > 0 && (
        <select className="run-picker" aria-label="Research run" value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || undefined)}>
          <option value="">Latest run</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{date(b.generated_at)} {b.git_sha ?? ""}</option>)}
        </select>
      )}
      {source === "local" && <span className="chip-badge">local run</span>}
    </>
  );

  return (
    <Shell route={route} arg={arg} hash={hash} top={runPicker} email={email} onSignOut={signOut} wide={route === "doc"}>
      {route === "docs" && <DocsHome tag={arg === "tag" ? dec(extra) : undefined} type={arg === "type" ? dec(extra) : undefined} query={q} />}
      {route === "doc" && arg && <DocPage id={dec(arg)!} anchor={dec(extra)} />}
      {route === "refs" && <RefsPage focus={dec(arg)} />}
      {route === "ui" && <UILibrary section={arg} />}
      {route === "learn" && <Learn focus={arg} />}
      {route === "catalog" && <Catalog />}
      {route === "algo" && arg && <AlgorithmReport slug={dec(arg)!} />}
      {route === "ledger" && <LedgerPage />}
      {route === "sources" && <DataSources focus={arg} />}
      {route === "settings" && (
        <Settings section={arg} email={email} onSignOut={signOut} report={report} batches={batches} batchId={batchId} setBatchId={setBatchId} />
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
            <Overview report={report} email={email} />}
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

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | string>("idle");
  return (
    <form
      className="center signin"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await sendSignInLink(email.trim());
        setState(err ?? "sent");
      }}
    >
      <div className="org"><span className="org-mark" aria-hidden /><span className="org-name">Parity</span></div>
      <h1>Sign in</h1>
      <p className="muted">Private to the research team. Enter your email and we will send a sign-in link.</p>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button type="submit">Send link</button>
      {state === "sent" && <p>Check your inbox.</p>}
      {state !== "idle" && state !== "sent" && <p className="error">{state}</p>}
    </form>
  );
}
