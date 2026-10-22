import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { IS_SIM } from "./lib/space";
import { startSmoothScroll } from "./lib/scroll";
import { TerminalApp } from "./terminal/TerminalApp";
import "./ui/tokens.css";
import "./styles.css";
import "./ui/ui.css";
import "./ui/dark.css";
import "./legal/notice";
import "./a11y.css";

startSmoothScroll();

// /sim/ (sim.endyland.com) is Parity Terminal, full screen (DEC-0023); /app/ and /research/ are the
// two sides of the dashboard (DEC-0015, DEC-0020).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {IS_SIM ? <TerminalApp /> : <App />}
  </StrictMode>,
);
