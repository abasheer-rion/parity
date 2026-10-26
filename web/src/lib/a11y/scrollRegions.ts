// A box that scrolls sideways (a wide table, a long code line) must be reachable with the
// keyboard, or its hidden part cannot be read without a mouse (WCAG 2.1.1). This watches the
// page and, for each such box that has nothing focusable inside, makes the box itself a
// named, focusable region; arrow keys then scroll it. Boxes that fit lose it again.
const BOXES = ".table-wrap, pre, .cx-copy > code, .term-stats, .term-meta, [data-scroll-region]";
// Lists keep their own meaning: they only become focusable, without a region role over them.
const KEEP_ROLE = new Set(["DL", "UL", "OL", "TABLE"]);
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

function nameFor(el: HTMLElement): string {
  const table = el.querySelector("table");
  const caption = table?.querySelector("caption")?.textContent?.trim() || table?.getAttribute("aria-label");
  if (caption) return caption;
  let n: Element | null = el;
  for (let i = 0; n && i < 4; i++, n = n.parentElement) {
    let prev = n.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/.test(prev.tagName)) return prev.textContent?.trim() ?? "";
      prev = prev.previousElementSibling;
    }
  }
  return el.tagName === "TABLE" || table ? "Table" : "Code";
}

function update(el: HTMLElement) {
  const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  const owned = el.dataset.a11yRegion === "1";
  if (scrolls && !el.hasAttribute("tabindex") && !el.querySelector(FOCUSABLE)) {
    el.tabIndex = 0;
    if (!KEEP_ROLE.has(el.tagName)) {
      if (!el.hasAttribute("role")) el.setAttribute("role", "region");
      if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", `${nameFor(el)}, scrolls sideways`);
    }
    el.dataset.a11yRegion = "1";
  } else if (!scrolls && owned) {
    el.removeAttribute("tabindex");
    if (!KEEP_ROLE.has(el.tagName)) { el.removeAttribute("role"); el.removeAttribute("aria-label"); }
    delete el.dataset.a11yRegion;
  }
}

let started = false;
export function watchScrollRegions() {
  if (started || typeof window === "undefined" || typeof ResizeObserver === "undefined") return;
  started = true;
  const seen = new WeakSet<Element>();
  const sizes = new ResizeObserver((entries) => { for (const e of entries) update(e.target as HTMLElement); });
  let queued = false;
  const scan = () => {
    queued = false;
    for (const el of document.querySelectorAll<HTMLElement>(BOXES)) {
      if (!seen.has(el)) { seen.add(el); sizes.observe(el); }
      update(el);
    }
  };
  const later = () => { if (!queued) { queued = true; setTimeout(scan, 200); } };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  later();
}

watchScrollRegions();
