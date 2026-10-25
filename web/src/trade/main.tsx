// Parity Trade's entry (web/trade/index.html, DEC-0040). Its own bundle: it loads none of
// the product or research app, only the shared tokens, the UI library and the trade code.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../ui/boundary";
import { applyTheme } from "../lib/prefs";
import { TradeApp } from "./TradeApp";
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

applyTheme();
startPwa();
startRum("trade", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <TradeApp />
    </ErrorBoundary>
  </StrictMode>,
);
