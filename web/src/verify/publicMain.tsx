// The public Verify checker at /verify/ (DEC-0081), loaded by entry.ts when the address is
// not an email link. No sign-in is needed to check a file or a description.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { PublicVerify } from "./PublicVerify";
import { Toaster } from "../ui";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../legal/notice";
import "../a11y.css";
import { startRum } from "../lib/rum";
import "../lib/a11y/scrollRegions";

// The sign-in screen's backdrop belongs to the email confirm screen only.
document.querySelector(".orbs")?.remove();
document.documentElement.classList.add("vp-root");
applyTheme();
startRum("verify");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PublicVerify />
    <Toaster />
  </StrictMode>,
);
