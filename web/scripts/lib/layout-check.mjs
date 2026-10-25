// Finds text that collides or gets cut off on a rendered page. Run inside the page with
// `page.evaluate(layoutCheck)`. Used by the every-route smoke test (scripts/smoke.mjs)
// and by the screenshot audit (scripts/layout-audit.mjs).
//
// It reports four kinds of problem, each as { kind, text, other?, where }:
//   overlap    two pieces of visible text whose boxes cross by more than 2px both ways
//   clipped    text cut off by a box with hidden overflow, or a number cut in half by
//              the edge of a scroll box (from tablet width up)
//   ellipsis   a number shortened with "..." (a number must never be cut; words may be)
//   hscroll    the page itself scrolls sideways
//
// Text that should never be checked carries data-layout-ignore on itself or an ancestor
// (a decorative marquee, a ticker that scrolls by design). Text hidden for screen readers
// only (aria-hidden) is still drawn, so it is still checked.
// Text only collides with text in the same layer: things that are fixed or sticky are
// compared with each other, never with the page that scrolls under them.
export function layoutCheck() {
  const out = [];
  const W = window.innerWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth - W > 1) out.push({ kind: "hscroll", text: `${doc.scrollWidth - W}px`, where: "page" });

  const NUM = /^[\s+\-−$€£¥%.,:/()0-9kKMBTx×bp]*[0-9][\s+\-−$€£¥%.,:/()0-9kKMBTx×bp]*$/;
  const describe = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) {
      const cls = typeof e.className === "string" ? e.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      parts.unshift(e.tagName.toLowerCase() + (cls ? "." + cls : ""));
    }
    return parts.join(" > ");
  };
  const styleOf = new Map();
  const cs = (el) => {
    let s = styleOf.get(el);
    if (!s) { s = getComputedStyle(el); styleOf.set(el, s); }
    return s;
  };
  const hidden = (el) => {
    // Cards skipped by content-visibility: auto have no real layout yet, so their text
    // boxes are meaningless until they scroll near the screen.
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return true;
    for (let e = el; e; e = e.parentElement) {
      if (e.hasAttribute?.("data-layout-ignore") || e.hasAttribute?.("inert")) return true;
      const s = cs(e);
      if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || Number(s.opacity) < 0.05) return true;
      if (s.clipPath && s.clipPath !== "none" && /inset\(50%|circle\(0/.test(s.clipPath)) return true;
      if (s.position === "absolute" && (parseFloat(s.width) <= 1 || parseFloat(s.height) <= 1) && s.overflow === "hidden") return true;
    }
    return false;
  };
  // The layer an element paints in: its nearest fixed or sticky ancestor, else the page.
  const layerOf = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const p = cs(e).position;
      if (p === "fixed" || p === "sticky") return e;
    }
    return document.body;
  };

  // The part of the screen an element can paint in: the intersection of every ancestor
  // that clips (a scroll box or hidden overflow). Text scrolled out of its box is unseen.
  const clipOf = new Map();
  const clipRect = (el) => {
    if (!el || el === document.body || el === document.documentElement) return { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
    if (clipOf.has(el)) return clipOf.get(el);
    const s = cs(el);
    let c = s.position === "fixed" ? { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity } : clipRect(el.parentElement);
    if (s.overflowX !== "visible" || s.overflowY !== "visible") {
      const r = el.getBoundingClientRect();
      c = {
        left: s.overflowX !== "visible" ? Math.max(c.left, r.left) : c.left,
        right: s.overflowX !== "visible" ? Math.min(c.right, r.right) : c.right,
        top: s.overflowY !== "visible" ? Math.max(c.top, r.top) : c.top,
        bottom: s.overflowY !== "visible" ? Math.min(c.bottom, r.bottom) : c.bottom,
      };
    }
    clipOf.set(el, c);
    return c;
  };
  const cut = (r, c) => ({ left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) });

  // Every visible run of text, with the box it draws in.
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,canvas,textarea,option,select,input,code,pre")) continue;
    // Chart labels drawn in SVG: one box per <text>, measured on the element.
    if (el.closest("svg")) {
      const t = el.closest("text");
      if (!t || hidden(t) || items.some((x) => x.el === t)) continue;
      const r = t.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const c = clipRect(t.closest("svg").parentElement);
      const v = cut(r, c);
      const seen = v.right - v.left > 1 && v.bottom - v.top > 1 ? [{ ...v, width: v.right - v.left, height: v.bottom - v.top }] : [];
      items.push({ node: n, el: t, rects: [r], seen, box: r, text: t.textContent.trim().slice(0, 40), layer: layerOf(t), svg: true });
      continue;
    }
    if (hidden(el)) continue;
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const c = clipRect(el.parentElement);
    const seen = rects.map((r) => cut(r, c)).filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1).map((r) => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }));
    items.push({ node: n, el, rects, seen, box, text: n.nodeValue.trim().slice(0, 40), layer: layerOf(el) });
  }

  // Clipping: a hidden-overflow ancestor that cuts the text, and numbers with an ellipsis.
  for (const it of items) {
    if (it.svg) continue;
    const s = cs(it.el);
    const isNum = NUM.test(it.text);
    if (isNum && s.textOverflow === "ellipsis" && it.el.scrollWidth > it.el.clientWidth + 1) {
      out.push({ kind: "ellipsis", text: it.text, where: describe(it.el) });
      continue;
    }
    // A number cut in half by the edge of a scroll box. Phones scroll wide tables
    // sideways by design, so this only counts from tablet width up.
    if (isNum && W >= 1024) {
      const c = clipRect(it.el);
      const half = (it.box.left < c.left - 1 && it.box.right > c.left + 1) || (it.box.right > c.right + 1 && it.box.left < c.right - 1);
      if (half && it.box.bottom > c.top && it.box.top < c.bottom) { out.push({ kind: "clipped", text: it.text, where: describe(it.el) }); continue; }
    }
    for (let e = it.el; e && e !== document.body; e = e.parentElement) {
      const es = cs(e);
      const ox = es.overflowX, oy = es.overflowY;
      if (ox === "auto" || ox === "scroll" || oy === "auto" || oy === "scroll") break;
      const clipX = ox === "hidden" || ox === "clip";
      const clipY = oy === "hidden" || oy === "clip";
      if (!clipX && !clipY) { if (es.position === "fixed") break; continue; }
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) break;
      const cutX = clipX && (it.box.left < r.left - 2 || it.box.right > r.right + 2);
      const cutY = clipY && (it.box.top < r.top - 2 || it.box.bottom > r.bottom + 2);
      // Words cut with an ellipsis on purpose are fine; numbers never are.
      const clamp = (x) => x.webkitLineClamp && x.webkitLineClamp !== "none";
      const ell = cs(it.el).textOverflow === "ellipsis" || es.textOverflow === "ellipsis" || clamp(cs(it.el)) || clamp(es);
      if ((cutX || cutY) && !(ell && !isNum)) {
        // Only report text that is partly visible: fully hidden text is a closed panel.
        const visible = it.box.right > r.left && it.box.left < r.right && it.box.bottom > r.top && it.box.top < r.bottom;
        if (visible) out.push({ kind: "clipped", text: it.text, where: describe(it.el) });
      }
      break;
    }
  }

  // Overlap: line boxes of different text runs that cross. Sweep by top edge.
  const lines = [];
  for (const it of items) for (const r of it.seen) lines.push({ it, r });
  lines.sort((a, b) => a.r.top - b.r.top);
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    for (let j = i + 1; j < lines.length; j++) {
      const b = lines[j];
      if (b.r.top >= a.r.bottom - 2) break;
      if (a.it === b.it || a.it.layer !== b.it.layer) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      // Line boxes of two-line labels touch by a pixel or two by design; glyphs cross at 3+.
      if (w <= 2 || h <= Math.max(3, Math.min(a.r.height, b.r.height) * 0.3)) continue;
      // Text stacked on purpose (a value painted over its own skeleton, a stretched link)
      // shares an ancestor that is a single grid cell; skip if one contains the other.
      if (a.it.el.contains(b.it.el) || b.it.el.contains(a.it.el)) continue;
      const key = a.it.text + "|" + b.it.text;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: "overlap", text: a.it.text, other: b.it.text, where: describe(a.it.el) + "  x  " + describe(b.it.el) });
    }
  }
  return out;
}
