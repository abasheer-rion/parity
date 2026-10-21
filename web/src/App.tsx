import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { currentSession, listBatches, loadReport, sendSignInLink, source, supabase } from "./lib/data";
import { date, REPO_URL } from "./lib/format";
import type { BatchSummary, Report } from "./lib/types";
import { DataPage } from "./pages/DataPage";
import { Learn } from "./pages/Learn";
import { Overview } from "./pages/Overview";
import { Signals } from "./pages/Signals";
import { StrategyPage } from "./pages/StrategyPage";

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
      <Shell>
        <div className="center">
          <h1>Not connected</h1>
          <p>This build has no data source. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when building.</p>
        </div>
      </Shell>
    );
  }
  if (!checked) return <Shell><p className="center muted">Loading</p></Shell>;
  if (source === "supabase" && !session) return <Shell><SignIn /></Shell>;
  return <Dashboard />;
}

function Dashboard() {
  const hash = useHash();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
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

  const [, route, arg] = hash.split("/");
  const nav = [
    { href: "#/", label: "Overview", active: !route },
    { href: "#/signals", label: "Signals", active: route === "signals" },
    { href: "#/data", label: "Data", active: route === "data" },
    { href: "#/learn", label: "Learn", active: route === "learn" },
  ];

  return (
    <Shell
      nav={nav}
      right={
        <>
          {batches.length > 0 && (
            <select aria-label="Research run" value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || undefined)}>
              <option value="">Latest run</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {date(b.generated_at)} {b.git_sha ?? ""}
                </option>
              ))}
            </select>
          )}
          {source === "local" && <span className="badge">local run</span>}
          {supabase && <button className="quiet" onClick={() => supabase!.auth.signOut()}>Sign out</button>}
        </>
      }
    >
      {route === "learn" && <Learn focus={arg} />}
      {route !== "learn" && error && <div className="error">{error}</div>}
      {route !== "learn" && !report && !error && <p className="muted">Loading results</p>}
      {route !== "learn" && report && (
        <>
          {route === "strategy" && arg ? <StrategyPage report={report} name={decodeURIComponent(arg)} /> :
            route === "signals" ? <Signals report={report} /> :
            route === "data" ? <DataPage report={report} /> :
            <Overview report={report} />}
          <footer className="muted small">
            Run generated {date(report.generated_at)}
            {report.git_sha && <> from commit <a href={`${REPO_URL}/commit/${report.git_sha}`}>{report.git_sha}</a></>}.
            Research only, not investment advice.
          </footer>
        </>
      )}
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
      <h1>Parity research</h1>
      <p className="muted">Private to the research team. Enter your email and we will send a sign-in link.</p>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button type="submit">Send link</button>
      {state === "sent" && <p>Check your inbox.</p>}
      {state !== "idle" && state !== "sent" && <p className="error">{state}</p>}
    </form>
  );
}

function Shell({
  children,
  nav = [],
  right,
}: {
  children: React.ReactNode;
  nav?: { href: string; label: string; active: boolean }[];
  right?: React.ReactNode;
}) {
  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/">Parity</a>
        <nav>
          {nav.map((n) => (
            <a key={n.href} href={n.href} className={n.active ? "active" : ""}>{n.label}</a>
          ))}
          <a href={`${REPO_URL}/blob/main/docs/README.md`} target="_blank" rel="noreferrer">Docs</a>
        </nav>
        <div className="right">{right}</div>
      </header>
      <main>{children}</main>
    </div>
  );
}
