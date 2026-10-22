// Entry for the public sign-in pages: /login/, /signup/, /reset/, /verify/.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "../lib/prefs";
import { Toaster } from "../ui";
import "../ui/tokens.css";
import "../styles.css";
import "../ui/ui.css";
import "../legal/notice";
import { Reset } from "./pages/Reset";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { Verify } from "./pages/Verify";
import { useSession } from "./session";

applyTheme();

function Page() {
  const session = useSession();
  const path = window.location.pathname.replace(/\/?$/, "/");
  if (path === "/signup/") return <SignUp />;
  if (path === "/reset/") return <Reset session={session} />;
  if (path === "/verify/") return <Verify />;
  return <SignIn />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
    <Toaster />
  </StrictMode>,
);
