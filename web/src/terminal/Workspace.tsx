// A workspace: panels laid out by the tiling tree, with draggable dividers. Every panel
// stays mounted while the layout changes (it is positioned, not re-parented), so a split
// or a maximise never restarts a chart or a replay.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { PanelContext, useTerm, type PanelCtx } from "./context";
import { shortDate } from "./fmt";
import { FN_BY_CODE } from "./functions";
import { closeLeaf, findLeaf, layoutRects, leaf, leaves, setRatio, splitLeaf, updateLeaf, type Leaf, type Rect, type WsState } from "./layout";
import { PanelBody, defaultAsOf } from "./panels";

const pct = (v: number) => `${(v * 100).toFixed(4)}%`;

function Glyph({ d }: { d: string }) {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2"><path d={d} /></svg>;
}
const G = {
  splitH: "M1.5 1.5h9v9h-9zM6 1.5v9",
  splitV: "M1.5 1.5h9v9h-9zM1.5 6h9",
  max: "M1.5 1.5h9v9h-9z",
  restore: "M3.5 1.5h7v7M1.5 3.5h7v7h-7z",
  close: "M2.5 2.5l7 7M9.5 2.5l-7 7",
  link: "M5 7l2-2M4.2 5.6 3 6.8a1.6 1.6 0 0 0 2.2 2.2l1.2-1.2M7.8 6.4 9 5.2A1.6 1.6 0 0 0 6.8 3L5.6 4.2",
};

export function Workspace({ ws, setWs, mobile }: { ws: WsState; setWs: (f: (s: WsState) => WsState) => void; mobile: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const all = leaves(ws.tree);
  const { leaves: rects, dividers } = useMemo(() => layoutRects(ws.tree), [ws.tree]);
  const full: Rect = { x: 0, y: 0, w: 1, h: 1 };

  const drag = (id: string, dir: "row" | "col", parent: Rect) => (e: React.PointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = dir === "row"
        ? ((ev.clientX - box.left) / box.width - parent.x) / parent.w
        : ((ev.clientY - box.top) / box.height - parent.y) / parent.h;
      setWs((s) => ({ ...s, tree: setRatio(s.tree, id, r) }));
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const ratioOf = (id: string): number => {
    const walk = (n: WsState["tree"]): number | null => (n.t === "leaf" ? null : n.id === id ? n.ratio : walk(n.a) ?? walk(n.b));
    return walk(ws.tree) ?? 0.5;
  };

  return (
    <div className="term-area" ref={area}>
      {all.map((l) => {
        const hidden = mobile ? l.id !== ws.focus : ws.max ? l.id !== ws.max : false;
        const r = mobile || ws.max ? full : rects.get(l.id) ?? full;
        return (
          <div key={l.id} className="term-slot" hidden={hidden}
            style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}>
            <PanelFrame leaf={l} ws={ws} setWs={setWs} only={all.length === 1} mobile={mobile} />
          </div>
        );
      })}
      {!mobile && !ws.max && dividers.map((d) => {
        const now = ratioOf(d.id);
        const style = d.dir === "row"
          ? { left: pct(d.at.x), top: pct(d.at.y), height: pct(d.at.h) }
          : { left: pct(d.at.x), top: pct(d.at.y), width: pct(d.at.w) };
        return (
          <div key={d.id} className={`term-divider ${d.dir}`} style={style}
            role="separator" aria-orientation={d.dir === "row" ? "vertical" : "horizontal"}
            aria-valuenow={Math.round(now * 100)} aria-valuemin={12} aria-valuemax={88} aria-label="Resize panels" tabIndex={0}
            onPointerDown={drag(d.id, d.dir, d.parent)}
            onDoubleClick={() => setWs((s) => ({ ...s, tree: setRatio(s.tree, d.id, 0.5) }))}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.1 : 0.03;
              const k: Record<string, number> = d.dir === "row" ? { ArrowLeft: -step, ArrowRight: step } : { ArrowUp: -step, ArrowDown: step };
              const delta = k[e.key];
              if (delta) { e.preventDefault(); setWs((s) => ({ ...s, tree: setRatio(s.tree, d.id, now + delta) })); }
            }} />
        );
      })}
    </div>
  );
}

function PanelFrame({ leaf: l, ws, setWs, only, mobile }: { leaf: Leaf; ws: WsState; setWs: (f: (s: WsState) => WsState) => void; only: boolean; mobile: boolean }) {
  const t = useTerm();
  // Kept per function, so a panel that switches function never shows the old one's date.
  const [asOfBy, setAsOfBy] = useState<{ fn: string; v: string | null }>({ fn: "", v: null });
  const [titleBy, setTitleBy] = useState<{ fn: string; v: string | null }>({ fn: "", v: null });
  const asOf = asOfBy.fn === l.fn ? asOfBy.v : null;
  const dynTitle = titleBy.fn === l.fn ? titleBy.v : null;
  const fn = FN_BY_CODE[l.fn];
  const focused = ws.focus === l.id;
  const maxed = ws.max === l.id;
  const follows = l.fn === "DES" || l.fn === "CMP";
  const ctx: PanelCtx = useMemo(() => ({
    leaf: l,
    focused,
    setOpt: (key, value) => setWs((s) => ({ ...s, tree: updateLeaf(s.tree, l.id, { opts: { ...(findLeaf(s.tree, l.id)?.opts ?? {}), [key]: value } }) })),
    setArgs: (args) => setWs((s) => ({ ...s, tree: updateLeaf(s.tree, l.id, { args }) })),
    setAsOf: (v) => setAsOfBy({ fn: l.fn, v }),
    setTitle: (v) => setTitleBy({ fn: l.fn, v }),
  }), [l, focused, setWs]);

  const add = (dir: "row" | "col") => {
    const n = leaf(l.fn === "DES" || l.fn === "CMP" ? l.fn : "MON", l.fn === "DES" || l.fn === "CMP" ? l.args : []);
    setWs((s) => ({ ...s, tree: splitLeaf(s.tree, l.id, dir, n), focus: n.id, max: null }));
  };
  const close = () => setWs((s) => {
    const tree = closeLeaf(s.tree, l.id);
    const ids = leaves(tree).map((x) => x.id);
    return { tree, focus: ids.includes(s.focus) ? s.focus : ids[0], max: s.max === l.id ? null : s.max };
  });
  const shown = asOf ?? defaultAsOf(l.fn, t);
  const title = dynTitle ?? fn?.title ?? l.fn;

  return (
    <section
      className={`term-panel ${focused ? "focused" : ""}`}
      data-panel={l.id}
      aria-label={`${l.fn} ${fn?.title ?? ""}`}
      tabIndex={-1}
      onPointerDownCapture={() => { if (!focused) setWs((s) => ({ ...s, focus: l.id })); }}
      onFocusCapture={() => { if (!focused) setWs((s) => ({ ...s, focus: l.id })); }}>
      <header className="term-ph">
        <span className="term-ph-code">{l.fn}</span>
        {title && <span className="term-ph-title">{title}</span>}
        <span className="term-ph-asof" title="Data as of">{shown ? `as of ${shortDate(shown)}` : ""}</span>
        <span className="term-ph-tools">
          {follows && (
            <PhBtn label={l.follow === false ? "Follow the linked selection" : "Stop following the linked selection"} on={l.follow !== false}
              onClick={() => setWs((s) => ({ ...s, tree: updateLeaf(s.tree, l.id, { follow: l.follow === false }) }))} d={G.link} />
          )}
          {!mobile && <PhBtn label="Split side by side" onClick={() => add("row")} d={G.splitH} />}
          {!mobile && <PhBtn label="Split top and bottom" onClick={() => add("col")} d={G.splitV} />}
          {!mobile && <PhBtn label={maxed ? "Restore" : "Maximise"} onClick={() => setWs((s) => ({ ...s, max: maxed ? null : l.id, focus: l.id }))} d={maxed ? G.restore : G.max} />}
          {!only && <PhBtn label="Close panel" onClick={close} d={G.close} />}
        </span>
      </header>
      <div className="term-pb">
        <PanelContext.Provider value={ctx}>
          <PanelBody key={l.fn} leaf={l} />
        </PanelContext.Provider>
      </div>
    </section>
  );
}

function PhBtn({ label, onClick, d, on }: { label: string; onClick: () => void; d: string; on?: boolean }): ReactNode {
  return (
    <button type="button" className={`term-ph-btn ${on ? "on" : ""}`} onClick={onClick} title={label} aria-label={label} aria-pressed={on}>
      <Glyph d={d} />
    </button>
  );
}
