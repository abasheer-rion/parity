// /oauth/openrouter/: where OpenRouter sends the person back after they connect their account
// (DEC-0051, openrouter.ts). Swaps the code for their key, keeps it in this browser, and
// returns them to the page they started from.
import { finish } from "./openrouter";

const out = document.getElementById("status")!;
void finish(new URLSearchParams(window.location.search).get("code")).then((r) => {
  if (r.ok) {
    out.textContent = "Connected. Taking you back...";
    window.location.replace(r.returnTo);
  } else {
    out.textContent = r.message;
    const a = document.createElement("a");
    a.href = r.returnTo;
    a.textContent = "Go back";
    out.after(a);
  }
});
