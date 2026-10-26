// Smooth, gliding page scroll (Lenis, MIT). Wheel and trackpad input is eased so the
// page keeps moving briefly after you stop, instead of stepping. Anything that scrolls
// on its own (sidebar, preview cards, search results, wide tables) opts out with
// data-lenis-prevent, and reduced motion gets normal scrolling.
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { motionLevel } from "../ui/motionCore";
import { durationMs } from "../ui/tokens";

let lenis: Lenis | null = null;

export function startSmoothScroll() {
  if (lenis || typeof window === "undefined") return;
  // Reduced motion (the device, unless the Motion setting says Full; or the setting) scrolls normally.
  if (motionLevel() === "reduced") return;
  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.11,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    respectReducedMotion: false,
    prevent: (node) => !!node.closest?.("[data-lenis-prevent], .pop, .palette, .table-wrap, .side, .doc-rail, .doc-nav"),
  });
  // A dialog or drawer from the UI library holds the page still while it is open.
  window.addEventListener("ui:scroll-lock", (e) => {
    if ((e as CustomEvent<boolean>).detail) lenis?.stop();
    else lenis?.start();
  });
}

/** Jump without easing (route changes), or glide (in-page links). */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

export function scrollToEl(el: HTMLElement, offset = -64) {
  // Lenis takes seconds; the glide lasts as long as the longest motion token.
  if (lenis) lenis.scrollTo(el, { offset, duration: durationMs("dur-6") / 1000 });
  else el.scrollIntoView({ block: "start" });
}
