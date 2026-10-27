// Decides when the first-run intro (DEC-0077) is on screen, and loads it only then. Home
// mounts this. The intro opens by itself once per account (introDue), after the cookie
// choice, and anyone can open it again with #/?intro=1 or the "parity:intro" event.
import { lazy, Suspense, useEffect, useState } from "react";
import { isDesktop } from "../desktop/bridge";
import { hasDecided, onConsentChange } from "../legal/consent";
import { setHashQuery } from "../lib/deeplink";
import type { Report } from "../lib/types";
import { introDue, resumeStep } from "./introRules";
import { setIntroOpen, useOnboarding } from "./store";

const Intro = lazy(() => import("./Intro").then((m) => ({ default: m.Intro })));

const asked = () => /[?&]intro=1(&|$)/.test(window.location.hash);
const noticeUp = () => !isDesktop() && !hasDecided();

/** Opens the first-run intro on Home, even for someone who has seen it. */
export function replayIntro() {
  window.dispatchEvent(new Event("parity:intro"));
}

export function IntroGate({ report }: { report: Report | null }) {
  const s = useOnboarding();
  const [forced, setForced] = useState(asked);
  const [closed, setClosed] = useState(false);
  const [notice, setNotice] = useState(noticeUp);
  useEffect(() => (notice ? onConsentChange(() => setNotice(noticeUp())) : undefined), [notice]);
  useEffect(() => {
    const on = () => { setClosed(false); setForced(true); };
    window.addEventListener("parity:intro", on);
    return () => window.removeEventListener("parity:intro", on);
  }, []);
  const due = introDue(s);
  const open = !closed && !notice && (forced || due);
  useEffect(() => { setIntroOpen(open); return () => setIntroOpen(false); }, [open]);
  if (!open) return null;
  const close = () => { setClosed(true); setForced(false); if (asked()) setHashQuery({ intro: null }); };
  return (
    <Suspense fallback={null}>
      <Intro report={report} row={s.row} startAt={due ? resumeStep(s.row.intro_step) : 0} onClose={close} />
    </Suspense>
  );
}
