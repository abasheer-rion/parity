// Parity Academy's entry (web/academy/index.html, DEC-0042). Its own bundle: it loads none
// of the product or research app, only the shared tokens, the UI library and the course code.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../ui/boundary";
import { applyTheme } from "../lib/prefs";
import { startPwa } from "../pwa/install";
import { AcademyApp } from "./AcademyApp";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../ui/dark.css";
import "../legal/notice";
import "../lib/scrollRegions";
import "../a11y.css";
import { startRum } from "../lib/rum";
import { isDesktop } from "../desktop/bridge";
import "../lib/a11y/scrollRegions";

applyTheme();
startPwa();
startRum("academy", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <AcademyApp />
    </ErrorBoundary>
  </StrictMode>,
);
