// Shows rendered doc HTML. The docs come from this repo, but markdown allows raw
// HTML, so everything still goes through DOMPurify before it reaches the page.
import DOMPurify from "dompurify";
import { useLayoutEffect, useRef } from "react";

const KEEP = { ADD_ATTR: ["target", "data-term", "data-doc", "data-anchor", "data-ref"] };

export function Html({ html, className, onRender }: { html: string; className?: string; onRender?: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(DOMPurify.sanitize(html, { ...KEEP, RETURN_DOM_FRAGMENT: true }));
    onRender?.(el);
  }, [html, onRender]);
  return <div ref={ref} className={className} />;
}
