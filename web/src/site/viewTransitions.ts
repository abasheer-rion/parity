// The public pages fade into each other with cross-document view transitions (kit.css,
// `@view-transition { navigation: auto }`). The apps (/app/, /trade/ and the rest) do not
// opt in, so a transition started on the way into one is aborted by the browser, which
// shows up as an uncaught "Transition was aborted because of invalid state" error after
// signing in. Skip the transition before leaving for a page that will not take part.
// Imported by the front page, the sign-in pages and /connect/.

const NO_TRANSITION = /^\/(app|research|sim|trade|academy|lab|data)(\/|$)/;

interface SwapEvent extends Event {
  viewTransition?: { skipTransition(): void; ready: Promise<void>; finished: Promise<void> } | null;
  activation?: { entry?: { url?: string } | null } | null;
}

/** True when a transition into this address would be aborted. Exported for the unit test. */
export function skipsTransition(url: string | undefined, here: string = location.href): boolean {
  if (!url) return true;
  try {
    const to = new URL(url, here);
    return to.origin !== new URL(here).origin || NO_TRANSITION.test(to.pathname);
  } catch {
    return true;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pageswap", (e) => {
    const { viewTransition: vt, activation } = e as SwapEvent;
    if (!vt || !skipsTransition(activation?.entry?.url ?? undefined)) return;
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
    vt.skipTransition();
  });
}
