// The dashboard's entry: /app/ and /research/ are its two sides (DEC-0015, DEC-0020).
// Parity Terminal (/sim/, sim.paritytrading.app) has its own entry, src/terminal/main.tsx, so
// neither downloads the other's code (REF-0024). The loading screen in index.html shows
// until the first page draws.
import { setLiveApp } from "./lib/live/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startSmoothScroll } from "./lib/scroll";
import { ErrorBoundary } from "./ui/boundary";
import { startPwa } from "./pwa/install";
import "./ui/tokens.css";
import "./styles.css";
import "./ui/ui.css";
import "./ui/dark.css";
import "./legal/notice";
import "./lib/scrollRegions";
import "./a11y.css";
import { startRum } from "./lib/rum";
import { isDesktop } from "./desktop/bridge";
import "./lib/a11y/scrollRegions";

startSmoothScroll();
startPwa();
setLiveApp("product");
startRum(window.location.pathname.startsWith("/research") ? "research" : "product", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
