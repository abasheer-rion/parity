// Entry for the stand-alone sign-in pages: /login/, /signup/, /reset/, /verify/. They show
// the same panel as the front page (DEC-0044) over the same backdrop, which the HTML
// paints before any script runs (src/site/kit.css).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../legal/notice";
import "../site/viewTransitions";
import { AuthFlow } from "./AuthFlow";
import { carryFromQuery, viewFromPath } from "./views";
import { startRum } from "../lib/rum";
import { isDesktop } from "../desktop/bridge";

// Coming back with the back button after the logo faded the page out shows it again.
window.addEventListener("pageshow", () => { document.body.classList.remove("leaving"); document.documentElement.classList.remove("pa-leaving"); });
startRum("auth", { desktop: isDesktop() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthFlow host="page" initial={viewFromPath(window.location.pathname)} initialCarry={carryFromQuery(window.location.search)} />
  </StrictMode>,
);
