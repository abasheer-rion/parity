// Parity Workbench's entry (web/lab/index.html, DEC-0043). Its own bundle: it loads none of
// the product or research app pages, only the shared tokens, the UI library and the tools.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { startPwa } from "../pwa/install";
import { LabApp } from "./LabApp";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../ui/dark.css";
import "../legal/notice";
import "../a11y.css";
import { startRum } from "../lib/rum";
import { isDesktop } from "../desktop/bridge";

applyTheme();
startPwa();
startRum("lab", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
);
