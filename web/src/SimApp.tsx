// Sim World on its own site (DEC-0020): sim.endyland.com, or /sim/ on previews. Only the
// simulator and one Back button: no sidebar, no top bar. It signs in and loads data like
// the dashboard, and tabs live in the hash (#/map, #/crises, ...).
import { useEffect, useRef, useState } from "react";
import { AppGuard } from "./auth";
import { loadReport } from "./lib/data";
import { applyTheme } from "./lib/prefs";
import { researchUrl } from "./lib/space";
import type { Report } from "./lib/types";
import { SimWorld, TAB_IDS } from "./pages/SimWorld";
import { Icon, Toaster } from "./ui";
import "./sim-app.css";

applyTheme();

export function SimApp() {
  return <AppGuard>{() => <SimShell />}</AppGuard>;
}

// Parity opens Sim World in a new tab with rel="noopener", so window.opener is usually
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

function SimShell() {
  const [hash, setHash] = useState(window.location.hash || "#/map");
  const [report, setReport] = useState<Report | null>(null);
  const last = useRef(hash);

  useEffect(() => { loadReport().then(setReport).catch(() => setReport(null)); }, []);

  useEffect(() => {
    const on = () => {
      const h = window.location.hash || "#/map";
      const route = h.split("?")[0].split("/")[1] ?? "";
      if (route && !TAB_IDS.includes(route)) {
        // A link to a research page (a doc, a strategy): open it on the research side in
        // a new tab and stay on the tab that was showing.
        window.open(researchUrl(h), "_blank", "noopener");
        window.history.replaceState(null, "", last.current);
        return;
      }
      last.current = h;
      setHash(h);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const route = hash.split("?")[0].split("/")[1] || "map";

  return (
    <div className="simapp">
      <header className="simapp-bar">
        <button className="simapp-back" onClick={goBack} title="Back to Parity">
          <Icon name="chevronLeft" size={14} />
          <img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={20} height={20} />
          <span>Back</span>
        </button>
      </header>
      <main className="simapp-main">
        <SimWorld report={report} tab={route} base="#" />
      </main>
      <Toaster />
    </div>
  );
}
