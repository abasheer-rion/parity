// Entry for the public badge pages, /v/<id> (REF-0016). No sign-in is needed to view one;
// functions/v/[id].ts serves this page for every /v/<id> address.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { VerifyBadge } from "../pages/VerifyBadge";
import { Toaster } from "../ui";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../legal/notice";
import "../a11y.css";

applyTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VerifyBadge />
    <Toaster />
  </StrictMode>,
);
