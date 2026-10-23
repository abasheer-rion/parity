// Long lists without the weight: only the rows on screen (plus a few either side) are
// drawn, and the space for the rest is reserved, so the scroll bar is right from the
// start and nothing jumps. Rows may differ in height and may grow (an opened detail):
// each drawn row is measured and the space above and below is corrected before paint.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

export interface VirtualItem { index: number; start: number; size: number }

/**
 * The windowing maths. Scrolls with the page, or with `scrollRef` when the list sits in
 * its own scrolling box. `estimate` is the usual row height; give the real one when
 * rows are fixed and nothing is ever measured wrong.
 */
export function useVirtual({ count, estimate, overscan = 6, scrollRef, getKey }:
  { count: number; estimate: number; overscan?: number; scrollRef?: RefObject<HTMLElement | null>; getKey?: (i: number) => string | number }) {
  const listRef = useRef<HTMLElement | null>(null);
  const sizes = useRef(new Map<string | number, number>());
  const [version, setVersion] = useState(0);
  const key = useCallback((i: number) => (getKey ? getKey(i) : i), [getKey]);

  // Offsets of every row from the top of the list.
  const offsets = useMemo(() => {
    const out = new Float64Array(count + 1);
    for (let i = 0; i < count; i++) out[i + 1] = out[i] + (sizes.current.get(key(i)) ?? estimate);
    return out;
    // `version` is in the list so the offsets are recomputed when a measured size changes.
  }, [count, estimate, key, version]);

  const first = () => Math.min(count, Math.ceil((typeof window === "undefined" ? 800 : window.innerHeight) / estimate) + overscan);
  const [range, setRange] = useState<[number, number]>(() => [0, first()]);

  // The box that scrolls: the one passed in, or (if its ref is not attached yet) the
  // nearest scrolling ancestor, or the page.
  const scroller = useCallback((): HTMLElement | null => {
    if (!scrollRef) return null;
    if (scrollRef.current) return scrollRef.current;
    for (let el = listRef.current?.parentElement; el; el = el.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return null;
  }, [scrollRef]);

  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const box = scroller();
    const rect = list.getBoundingClientRect();
    let top: number, height: number;
    if (box) {
      const b = box.getBoundingClientRect();
      top = b.top - rect.top;
      height = box.clientHeight;
    } else {
      top = -rect.top;
      height = window.innerHeight;
    }
    // Binary search for the first row whose bottom is below the top of the view.
    let lo = 0, hi = count;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (offsets[mid + 1] <= top) lo = mid + 1; else hi = mid; }
    let end = lo;
    while (end < count && offsets[end] < top + height) end++;
    const next: [number, number] = [Math.max(0, lo - overscan), Math.min(count, end + overscan)];
    setRange((r) => (r[0] === next[0] && r[1] === next[1] ? r : next));
  }, [count, offsets, overscan, scroller]);

  useLayoutEffect(() => {
    update();
    const target: HTMLElement | Window = scroller() ?? window;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    target.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); target.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [update, scroller]);

  // One observer for every drawn row: a row that grows or shrinks corrects the offsets.
  const observer = useRef<ResizeObserver | null>(null);
  const nodes = useRef(new Map<Element, string | number>());
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const k = nodes.current.get(e.target);
        if (k == null) continue;
        const h = (e.target as HTMLElement).getBoundingClientRect().height;
        if (Math.abs((sizes.current.get(k) ?? -1) - h) > 0.5) { sizes.current.set(k, h); changed = true; }
      }
      if (changed) setVersion((v) => v + 1);
    });
    nodes.current.forEach((_, el) => observer.current!.observe(el));
    return () => observer.current?.disconnect();
  }, []);
  const measure = useCallback((index: number) => (el: Element | null) => {
    if (!el) return;
    const k = key(index);
    for (const [node, nk] of nodes.current) if (nk === k && node !== el) { observer.current?.unobserve(node); nodes.current.delete(node); }
    if (nodes.current.get(el) === k) return;
    // Forget rows that have scrolled away and been removed.
    if (nodes.current.size > 160) for (const node of nodes.current.keys()) if (!node.isConnected) { observer.current?.unobserve(node); nodes.current.delete(node); }
    nodes.current.set(el, k);
    observer.current?.observe(el);
  }, [key]);

  const [start, end] = [Math.min(range[0], count), Math.min(range[1], count)];
  const items: VirtualItem[] = [];
  for (let i = start; i < end; i++) items.push({ index: i, start: offsets[i], size: offsets[i + 1] - offsets[i] });
  const total = offsets[count];
  return { listRef, items, total, padTop: offsets[start] ?? 0, padBottom: total - (offsets[end] ?? total), measure };
}

/**
 * A long list that draws only what is on screen. `render` gets each item; keep rows the
 * same height where you can (pass it as `rowHeight`), and they may still grow.
 */
export function VirtualList<T>({ items, rowHeight, render, getKey, overscan, scrollRef, className = "", label }:
  { items: T[]; rowHeight: number; render: (item: T, index: number) => ReactNode; getKey?: (item: T, index: number) => string | number;
    overscan?: number; scrollRef?: RefObject<HTMLElement | null>; className?: string; label?: string }) {
  const keyOf = useCallback((i: number) => (getKey ? getKey(items[i], i) : i), [getKey, items]);
  const v = useVirtual({ count: items.length, estimate: rowHeight, overscan, scrollRef, getKey: keyOf });
  return (
    <div ref={v.listRef as RefObject<HTMLDivElement>} className={`ui-vlist ${className}`} role="list" aria-label={label}
      style={{ paddingTop: v.padTop, paddingBottom: v.padBottom }}>
      {v.items.map((it) => (
        <div key={keyOf(it.index)} ref={v.measure(it.index)} role="listitem" className="ui-vlist-row" style={{ minHeight: rowHeight }}>
          {render(items[it.index], it.index)}
        </div>
      ))}
    </div>
  );
}
