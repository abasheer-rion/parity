// Wide tables and code blocks scroll sideways inside their box on a small screen. Someone
// using a keyboard can only scroll a box they can reach with Tab, so any such box that
// actually scrolls, and has nothing inside it to tab to, gets tabindex="0" and a name
// (WCAG 2.1.1; axe's scrollable-region-focusable). When it stops scrolling (the window got
// wider) it goes back to how it was. Imported once by each app's main file.

const BOXES = ".table-wrap, .lb-table-wrap, .pac-table-wrap, .term-table-wrap, pre, .cx-copy code";
const FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])";
const MARK = "scrollFocus";

/** A short name for the box: its table's caption, the nearest heading above it, or its kind. */
export function regionName(el: HTMLElement): string {
  const caption = el.querySelector("caption")?.textContent?.trim();
  if (caption) return caption;
  const section = el.closest("section, article, .card, .panel");
  const heading = section?.querySelector("h1, h2, h3, h4")?.textContent?.trim();
  if (heading) return el.matches("pre, code") ? `${heading}, code` : heading;
  return el.matches("pre, code") ? "Code" : "Table";
}

/** Marks or unmarks one box. Exported for the unit test. */
export function updateRegion(el: HTMLElement): void {
  const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  const ours = el.dataset[MARK] === "1";
  const needs = scrolls && !el.querySelector(FOCUSABLE);
  if (needs && !ours && !el.hasAttribute("tabindex")) {
    el.dataset[MARK] = "1";
    el.tabIndex = 0;
    if (!el.hasAttribute("role")) el.setAttribute("role", "region");
    if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) el.setAttribute("aria-label", regionName(el));
  } else if (!needs && ours) {
    delete el.dataset[MARK];
    el.removeAttribute("tabindex");
    if (el.getAttribute("role") === "region") el.removeAttribute("role");
    el.removeAttribute("aria-label");
  }
}

export function startScrollRegions(root: Document = document): () => void {
  let frame = 0;
  const scan = () => { frame = 0; root.querySelectorAll<HTMLElement>(BOXES).forEach(updateRegion); };
  const queue = () => { if (!frame) frame = requestAnimationFrame(scan); };
  const mo = new MutationObserver(queue);
  mo.observe(root.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", queue, { passive: true });
  queue();
  return () => { mo.disconnect(); window.removeEventListener("resize", queue); if (frame) cancelAnimationFrame(frame); };
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined" && !import.meta.env?.VITEST) startScrollRegions();
