import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startSmoothScroll } from "./lib/scroll";
import "./ui/tokens.css";
import "./styles.css";
import "./ui/ui.css";

startSmoothScroll();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
