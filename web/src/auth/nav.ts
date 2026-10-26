// Page changes, in one place so the tests can watch them instead of navigating.

/** How long the sign-in panel shows its check and fades out before the next page loads. */
const LEAVE_MS = 420;

/**
 * Go to another page. replace() keeps one-time links out of the back button. From the
 * sign-in panel (DEC-0044), the button that was pressed turns into a check and the panel
 * fades out first (html.pa-leaving in flow.css); with reduced motion it goes at once.
 */
export function go(path: string) {
  const panel = typeof document !== "undefined" && document.querySelector(".pa-shell");
  const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!panel || still) { window.location.replace(path); return; }
  document.documentElement.classList.add("pa-leaving");
  window.setTimeout(() => window.location.replace(path), LEAVE_MS);
}

/** Go to another page and keep the current one in the history. */
export function goPush(path: string) {
  window.location.assign(path);
}
