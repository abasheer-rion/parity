import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { IS_SIM } from "./lib/space";
import { startSmoothScroll } from "./lib/scroll";
import { SimApp } from "./SimApp";
import "./ui/tokens.css";
import "./styles.css";
import "./ui/ui.css";

startSmoothScroll();

// /sim/ (sim.endyland.com) is Sim World alone, full screen; /app/ and /research/ are the
// two sides of the dashboard (DEC-0015, DEC-0017).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {IS_SIM ? <SimApp /> : <App />}
  </StrictMode>,
);
