// The sign-in panel (DEC-0044): one element for log in, sign up, reset and verify, used in
// the front page's panel (front.tsx) and on the stand-alone pages (main.tsx), always over
// the front page's backdrop. No box: the form sits on the page, and the legal links sit
// quietly at the bottom of the screen. Switching between forms happens in place: the step fades,
// the panel's height follows the content and the address follows the form.
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { SkipLink } from "../components/SkipLink";
import { LegalLinks } from "../legal/LegalLinks";
import { FlowContext, plainClick, type Flow } from "./flow";
import { Reset } from "./pages/Reset";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { Verify } from "./pages/Verify";
import { nextFromQuery } from "./redirect";
import { authUrl, TITLES, type Carry, type View } from "./views";
import "./flow.css";

const FORMS: Record<View, () => ReactNode> = { login: SignIn, signup: SignUp, reset: Reset, verify: Verify };

interface Props {
  /** The form to open with. */
  initial: View;
  /** What the address handed to that form (views.ts carryFromQuery). */
  initialCarry?: Carry;
  /** "page" for /login/ and the other sign-in pages, "front" for the front page's panel. */
  host: "page" | "front";
  /** Told when the form changes in place, so the front page can update its address. */
  onView?: (view: View) => void;
  /** The logo: on the front page it closes the panel. */
  onHome?: () => void;
}

export function AuthFlow({ initial, initialCarry, host, onView, onHome }: Props) {
  const next = useMemo(() => nextFromQuery(), []);
  const [view, setView] = useState<View>(initial);
  const [carry, setCarry] = useState<Carry>(initialCarry ?? {});
  // Bumped on every switch, so asking for the same form again starts it afresh.
  const [round, setRound] = useState(0);
  const [email, setEmail] = useState("");
  const titleId = useId();

  const show = useCallback((to: View, handed: Carry = {}) => {
    setView(to);
    setCarry(handed);
    setRound((r) => r + 1);
    if (host === "page") {
      if (to !== "verify") window.history.replaceState(window.history.state, "", authUrl(to, next, handed));
      document.title = TITLES[to];
    } else {
      onView?.(to);
    }
  }, [host, next, onView]);

  const flow: Flow = useMemo(() => ({ host, next, email, setEmail, carry, show, titleId }), [host, next, email, carry, show, titleId]);
  const Form = FORMS[view];

  const home = (e: MouseEvent) => {
    if (!plainClick(e)) return;
    if (host === "front") { e.preventDefault(); onHome?.(); return; }
    // Browsers with cross-document view transitions fade to the front page from the CSS.
    const fades = "CSSViewTransitionRule" in globalThis;
    if (fades || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    document.body.classList.add("leaving");
    window.setTimeout(() => { window.location.href = "/"; }, 220);
  };

  const body = <SizeBox><Form key={`${view}-${round}`} /></SizeBox>;
  const frame = (
    <>
      <div className="corner corner-logo pa-corner">
        <a href="/" aria-label="Parity home" onClick={home}>
          <img src="/brand/2026-10-21-starburst/parity-mark-white.svg" width={22} height={22} alt="" />
          <img className="letters" src="/brand/2026-10-22-wordmark/parity-letters-on-dark.svg" width={70} height={15} alt="" />
        </a>
      </div>
      {host === "page"
        ? <main className="pa-main" id="main" aria-labelledby={titleId}>{body}</main>
        : <div className="pa-main">{body}</div>}
      <footer className="pa-foot">
        <LegalLinks className="pa-legal" />
        <p className="pa-disclaimer">Research and education only. Not investment advice.</p>
      </footer>
    </>
  );

  return (
    <FlowContext.Provider value={flow}>
      {host === "page" ? (
        <div className="pa-shell" data-host="page"><SkipLink />{frame}</div>
      ) : (
        <div className="pa-shell" data-host="front" role="dialog" aria-modal="true" aria-labelledby={titleId}>{frame}</div>
      )}
    </FlowContext.Provider>
  );
}

/**
 * Holds the panel at its content's height and lets the height follow, smoothly, when a
 * step or a message changes it. Nothing below jumps, and with reduced motion it is instant.
 */
function SizeBox({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => { o.style.height = `${i.offsetHeight}px`; };
    fit();
    // Only animate changes after the first measure.
    const raf = requestAnimationFrame(() => o.setAttribute("data-ready", ""));
    if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <div className="pa-size" ref={outer}><div className="pa-size-in" ref={inner}>{children}</div></div>;
}
