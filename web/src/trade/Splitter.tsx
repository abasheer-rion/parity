// A drag handle between two panels. It reports how far it has moved since the drag began;
// arrow keys move it by 16px when it has focus, so it works without a mouse too.
import { useRef } from "react";

export function Splitter({ axis, label, onMove, onEnd, value, min, max }: {
  axis: "x" | "y"; label: string; onMove: (delta: number) => void; onEnd: () => void; value: number; min: number; max: number;
}) {
  const start = useRef<number | null>(null);
  return (
    <div className={`sp sp-${axis}`} role="separator" aria-orientation={axis === "x" ? "vertical" : "horizontal"} aria-label={label}
      aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); start.current = axis === "x" ? e.clientX : e.clientY; document.body.classList.add("sp-dragging"); }}
      onPointerMove={(e) => { if (start.current == null) return; onMove((axis === "x" ? e.clientX : e.clientY) - start.current); }}
      onPointerUp={(e) => { if (start.current == null) return; (e.target as HTMLElement).releasePointerCapture(e.pointerId); start.current = null; document.body.classList.remove("sp-dragging"); onEnd(); }}
      onKeyDown={(e) => {
        const back = axis === "x" ? "ArrowLeft" : "ArrowUp", fwd = axis === "x" ? "ArrowRight" : "ArrowDown";
        if (e.key !== back && e.key !== fwd) return;
        e.preventDefault();
        onMove(e.key === back ? -16 : 16);
        onEnd();
      }} />
  );
}
