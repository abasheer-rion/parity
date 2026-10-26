// The front page, the sign-in pages and /connect/ fade into each other with cross-document
// view transitions (kit.css, `@view-transition { navigation: auto }`). No other page opts
// in: not the apps (/app/, /trade/ and the rest), and not the legal pages, the blog, the
// glossary, ideas or notes. A transition started on the way into one of those is aborted
// by the browser, which shows up there as an uncaught "Transition was aborted because of
// invalid state" error. So skip the transition unless the next page takes part.
// Imported by the front page, the sign-in pages and /connect/.

const TAKES_PART = /^\/((login|signup|reset|verify|connect)\/?)?$/;

interface SwapEvent extends Event {
  viewTransition?: { skipTransition(): void; ready: Promise<void>; finished: Promise<void> } | null;
  activation?: { entry?: { url?: string } | null } | null;
}

/** True when a transition into this address would be aborted. Exported for the unit test. */
export function skipsTransition(url: string | undefined, here: string = location.href): boolean {
  if (!url) return true;
  try {
    const to = new URL(url, here);
    return to.origin !== new URL(here).origin || !TAKES_PART.test(to.pathname);
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
