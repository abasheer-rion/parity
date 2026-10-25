// The front page's sign-in panel (DEC-0042). src/site/main.ts loads this when Log in or
// Sign up is clicked (or the address ends in #login, #signup or #reset). The page fades
// out (html.auth-open), the backdrop stays, and the same panel as /login/ fades in over it.
// Focus moves into the panel and comes back to the link that opened it; Escape and the
// logo close it.
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AuthFlow } from "./AuthFlow";
import type { View } from "./views";

export interface FrontHooks {
  /** Close was asked for (Escape, the logo): the page decides what happens to the address. */
  onClose: () => void;
  /** The form changed inside the panel. */
  onView: (view: View) => void;
  stopScroll: () => void;
  startScroll: () => void;
}

export interface FrontAuth {
  open: (view: View, opener?: HTMLElement | null) => void;
  close: () => void;
}

function Overlay({ open, view, round, hooks }: { open: boolean; view: View; round: number; hooks: FrontHooks & { current: (v: View) => void } }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // The cookie preferences dialog handles its own Escape.
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      hooks.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hooks]);

  return (
    // inert while closed, so the fading panel can be neither focused nor read.
    <div className={`pa-overlay${open ? " open" : ""}`} inert={!open} data-lenis-prevent="">
      {round > 0 && (
        <AuthFlow key={round} initial={view} host="front" onHome={hooks.onClose}
          onView={(v) => { hooks.current(v); hooks.onView(v); }} />
      )}
    </div>
  );
}

export function startFrontAuth(el: HTMLElement, hooks: FrontHooks): FrontAuth {
  const root = createRoot(el);
  const html = document.documentElement;
  let open = false;
  let view: View = "login";
  let round = 0;
  let opener: HTMLElement | null = null;
  const withCurrent = { ...hooks, current: (v: View) => { view = v; } };
  const render = () => root.render(<StrictMode><Overlay open={open} view={view} round={round} hooks={withCurrent} /></StrictMode>);

  return {
    open(to, from) {
      if (from) opener = from;
      html.classList.add("auth-open");
      if (open && to === view) return;
      if (!open) hooks.stopScroll();
      open = true;
      view = to;
      round += 1;
      render();
    },
    close() {
      html.classList.remove("auth-open");
      if (!open) return;
      open = false;
      render();
      hooks.startScroll();
      // Back to the link that opened the panel (or Log in, after a direct #login visit).
      (opener ?? document.querySelector<HTMLElement>("a[data-auth]"))?.focus({ preventScroll: true });
    },
  };
}
