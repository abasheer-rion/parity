// One widget's frame on Home (DEC-0075): its title, collapse, a menu to move or hide it, and a
// drag handle. Dragging is never the only way: the menu moves a widget up or down too (WCAG
// 2.5.7). The body loads only when the frame comes near the screen, and the frame holds its
// height while it loads, so nothing below it moves.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Menu } from "../ui";
import { track, type WidgetDef, type WidgetId } from "./registry";

export function Frame({
  def, collapsed, auto, first, last, editing, onCollapse, onMove, onHide, onDrop, onSeen, onUsed, children,
}: {
  def: WidgetDef; collapsed: boolean; auto: boolean; first: boolean; last: boolean; editing: boolean;
  onCollapse: (v: boolean) => void; onMove: (by: -1 | 1) => void; onHide: () => void;
  onDrop: (from: WidgetId) => void; onSeen: () => void; onUsed: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const [over, setOver] = useState(false);
  // Load when within one screen of view; count a view once half of it has been on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "100% 0px" });
    let seen = false;
    const vo = new IntersectionObserver(([e]) => {
      if (!seen && e.intersectionRatio >= 0.5) { seen = true; onSeen(); track(def.id, "view"); vo.disconnect(); }
    }, { threshold: [0.5] });
    io.observe(el); vo.observe(el);
    return () => { io.disconnect(); vo.disconnect(); };
  }, [def.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyId = `w-${def.id}`;
  // A full-width widget (the ticker) has no title row unless being edited, so it holds all of it.
  const head = def.span === "full" ? 0 : 52;
  const span = def.span === "full" ? "w-full" : def.span === 2 ? "w-2" : "w-1";
  return (
    <section ref={ref} className={`w ${span} ${collapsed ? "is-collapsed" : ""} ${over ? "is-over" : ""} ${editing ? "is-editing" : ""}`}
      aria-labelledby={`${bodyId}-t`} data-widget={def.id}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-widget")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const from = e.dataTransfer.getData("text/x-widget"); if (from) { e.preventDefault(); onDrop(from as WidgetId); } }}
      onClickCapture={(e) => { const a = (e.target as Element).closest("a, button"); if (a && !a.closest(".w-head")) { onUsed(); track(def.id, "click", a.textContent?.trim()); } }}>
      <header className="w-head">
        <span className="w-grip" draggable aria-hidden title="Drag to move"
          onDragStart={(e) => { e.dataTransfer.setData("text/x-widget", def.id); e.dataTransfer.effectAllowed = "move"; }}>
          <Icon name="dots" size={14} />
        </span>
        <h2 id={`${bodyId}-t`}>{def.title}</h2>
        {auto && collapsed && <span className="w-note">Folded because you have not used it lately</span>}
        <div className="w-tools">
          <button type="button" className="w-btn" aria-expanded={!collapsed} aria-controls={bodyId}
            onClick={() => { onCollapse(!collapsed); track(def.id, collapsed ? "expand" : "collapse"); }}
            title={collapsed ? `Show ${def.title}` : `Fold ${def.title}`}>
            <Icon name={collapsed ? "chevronDown" : "chevronUp"} size={14} />
            <span className="sr-only">{collapsed ? `Show ${def.title}` : `Fold ${def.title}`}</span>
          </button>
          <Menu
            trigger={() => <button type="button" className="w-btn" aria-label={`${def.title} options`} title="Move or hide"><Icon name="gear" size={14} /></button>}
            items={[
              ...(first ? [] : [{ label: "Move up", icon: "chevronUp", onSelect: () => { onMove(-1); track(def.id, "move"); } }]),
              ...(last ? [] : [{ label: "Move down", icon: "chevronDown", onSelect: () => { onMove(1); track(def.id, "move"); } }]),
              { label: "Hide from Home", icon: "close", onSelect: () => { onHide(); track(def.id, "hide"); } },
            ]}
          />
        </div>
      </header>
      <div id={bodyId} className="w-body" hidden={collapsed} style={collapsed ? undefined : { ["--w-min" as string]: `${def.minHeight - head}px`, ["--w-min-phone" as string]: `${def.phoneMin - head}px` }}>
        {near && !collapsed ? children : null}
      </div>
    </section>
  );
}
