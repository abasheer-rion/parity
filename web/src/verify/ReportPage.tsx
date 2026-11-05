// A Verify report opened from a shared link, /verify/report/#r=... (DEC-0089). The report is
// in the address after "#", which the browser never sends, so this page fetches nothing to
// show it: it checks the link, then draws the same report the person saw.
import { useEffect, useState } from "react";
import { decodeReport, LinkError } from "../lib/verify/report/link";
import type { ReportData } from "../lib/verify/report/model";
import { PublicLinks } from "../pages/verify/Num";
import { Report } from "../pages/verify/report/Report";
import { Button, Skeleton } from "../ui";
import { PublicChrome } from "./Chrome";
import "../pages/verify/verify.css";

type State = { s: "loading" } | { s: "none" } | { s: "error"; why: string } | { s: "ok"; d: ReportData };

export function codeFromHash(hash: string): string | null {
  const m = hash.replace(/^#/, "").match(/(?:^|&)r=([^&]+)/);
  return m ? m[1] : null;
}

export function ReportPage() {
  const [state, setState] = useState<State>({ s: "loading" });
  useEffect(() => {
    const load = () => {
      const code = codeFromHash(window.location.hash);
      if (!code) { setState({ s: "none" }); return; }
      decodeReport(code).then((d) => {
        setState({ s: "ok", d });
        document.title = `${d.verdict.label}: ${d.what} · Parity Verify report`;
      }, (e) => setState({ s: "error", why: e instanceof LinkError ? e.message : "This link could not be read." }));
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);
  return (
    <PublicChrome here="/verify/report/">
      {state.s === "loading" && <div className="rp-wait" aria-busy="true"><Skeleton height={320} /><span className="sr-only">Opening the report</span></div>}
      {state.s === "none" && (
        <section className="rp-card rp-empty">
          <h1 className="rp-h2">No report in this link</h1>
          <p className="rp-lead">A shared Verify report carries the whole report in its address, after "#r=". This address has none: it may have been cut short when it was copied.</p>
          <Button variant="primary" href="/verify/">Check a record</Button>
        </section>
      )}
      {state.s === "error" && (
        <section className="rp-card rp-empty" role="alert">
          <h1 className="rp-h2">This report could not be opened</h1>
          <p className="rp-lead">{state.why}</p>
          <Button variant="primary" href="/verify/">Check a record</Button>
        </section>
      )}
      {state.s === "ok" && (
        <>
          <h1 className="sr-only">Parity Verify report: {state.d.what}</h1>
          <PublicLinks.Provider value={true}>
            <Report data={state.d} shared signedOut />
          </PublicLinks.Provider>
        </>
      )}
    </PublicChrome>
  );
}
