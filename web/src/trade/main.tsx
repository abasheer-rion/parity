// Parity Trade's entry (web/trade/index.html, DEC-0039). Its own bundle: it loads none of
// the product or research app, only the shared tokens, the UI library and the trade code.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { TradeApp } from "./TradeApp";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../ui/dark.css";
import "../legal/notice";
import "../a11y.css";

applyTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TradeApp />
  </StrictMode>,
);
