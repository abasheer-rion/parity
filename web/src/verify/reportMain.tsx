// Entry for a shared Verify report, /verify/report/ (DEC-0089). No sign-in.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { ReportPage } from "./ReportPage";
import { Toaster } from "../ui";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../legal/notice";
import "../a11y.css";
import { startRum } from "../lib/rum";
import "../lib/a11y/scrollRegions";

document.documentElement.classList.add("vp-root");
applyTheme();
startRum("verify");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReportPage />
    <Toaster />
  </StrictMode>,
);
