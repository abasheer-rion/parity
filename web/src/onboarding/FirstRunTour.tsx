// Opens an area's first-run tour once per person (DEC-0057): the first time they open the
// area, unless they chose "Skip all tours". Finishing or skipping marks the area seen; "Skip
// all tours" turns every tour off until "Show tours again" in Account settings.
//
//   <FirstRunTour areas={["home", "desktop"]} ready={loaded} />
//
// With more than one area, the first one not yet seen runs, then the next on a later visit
// or right after it ends. `ready` waits for the page's content, so targets exist.
import { useCallback, useEffect, useMemo, useState } from "react";
import { isDesktop } from "../desktop/bridge";
import { hasDecided, onConsentChange } from "../legal/consent";
import { track } from "../lib/analytics";
import { Tour, type GuidedStep, type TourEnd } from "../ui/guidedTour";
import { markTourSeen, skipAllTours, tourDue, useOnboarding } from "./store";
import { TOURS, type Area } from "./tours";

/** Asks any page's first-run tour for an area to open now, even if it was seen. */
export function replayTour(area: Area) {
  window.dispatchEvent(new CustomEvent("parity:tour", { detail: area }));
}

/** The cookie notice is up until the person chooses (the desktop app never shows one). */
const noticeUp = () => !isDesktop() && !hasDecided();

export function FirstRunTour({ areas, ready = true, delay = 700 }: { areas: Area[]; ready?: boolean; delay?: number }) {
  const s = useOnboarding();
  // A first visit shows the cookie notice too: the tour waits for that choice, so the two never
  // cover each other.
  const [notice, setNotice] = useState(noticeUp);
  useEffect(() => (notice ? onConsentChange(() => setNotice(noticeUp())) : undefined), [notice]);
  const [forced, setForced] = useState<Area | null>(null);
  const [open, setOpen] = useState(false);
  // Areas this page already ran, so a finished tour does not reopen before the save lands.
  const [done, setDone] = useState<Area[]>([]);
  const due = areas.find((a) => !done.includes(a) && tourDue(s, a)) ?? null;
  const area = forced ?? due;
  const tour = area ? TOURS[area] : null;
  const steps = useMemo<GuidedStep[]>(() => tour?.steps ?? [], [tour]);

  useEffect(() => {
    const on = (e: Event) => { const a = (e as CustomEvent<Area>).detail; if (areas.includes(a)) { setForced(a); setOpen(false); } };
    window.addEventListener("parity:tour", on);
    return () => window.removeEventListener("parity:tour", on);
  }, [areas]);

  // Wait for the page to settle (content loaded, entrance motion over) before opening.
  useEffect(() => {
    if (!ready || notice || !area || open) return;
    const t = window.setTimeout(() => setOpen(true), delay);
    return () => window.clearTimeout(t);
  }, [ready, notice, area, open, delay]);

  useEffect(() => { if (open && area) track("tour_started", { area }); }, [open, area]);

  const onEnd = useCallback((reason: TourEnd, step: number) => {
    if (!area) return;
    setOpen(false);
    setForced(null);
    setDone((d) => [...d, area]);
    // Nothing on screen to show (say the page is still empty): try again on a later visit.
    if (reason === "none") return;
    track("tour_finished", { area, reason, step });
    if (reason === "skip-all") void skipAllTours(area);
    else void markTourSeen(area);
  }, [area]);

  const onStep = useCallback((index: number, step: GuidedStep) => { if (area) track("tour_step", { area, step: step.id, index }); }, [area]);

  if (!tour) return null;
  return <Tour open={open} steps={steps} label={tour.label} onEnd={onEnd} onStep={onStep} />;
}
