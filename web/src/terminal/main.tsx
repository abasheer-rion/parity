// Parity Terminal's entry (/sim/, sim.endyland.com, DEC-0023), full screen. Its own bundle:
// it never downloads the dashboard (REF-0024).
import { setLiveApp } from "../lib/live/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TerminalApp } from "./TerminalApp";
import { startSmoothScroll } from "../lib/scroll";
import { ErrorBoundary } from "../ui/boundary";
import { startPwa } from "../pwa/install";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../ui/dark.css";
import "../legal/notice";
import "../lib/scrollRegions";
import "../a11y.css";
import { startRum } from "../lib/rum";
import { isDesktop } from "../desktop/bridge";

startSmoothScroll();
startPwa();
setLiveApp("sim");
startRum("sim", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <TerminalApp />
    </ErrorBoundary>
  </StrictMode>,
);
