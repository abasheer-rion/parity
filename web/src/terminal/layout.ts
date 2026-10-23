// The tiling layout: a tree of splits (a row or a column, with the share the first side
// takes) whose leaves are panels. Workspaces are presets of this tree; changes are saved
// per workspace in the browser.

export interface Leaf { t: "leaf"; id: string; fn: string; args: string[]; opts?: Record<string, string>; follow?: boolean }
export interface Split { t: "split"; id: string; dir: "row" | "col"; ratio: number; a: Node; b: Node }
export type Node = Leaf | Split;

export interface WsState { tree: Node; focus: string; max: string | null }

let n = 0;
export const newId = () => `p${Date.now().toString(36)}${(n++).toString(36)}`;

export const leaf = (fn: string, args: string[] = [], opts?: Record<string, string>): Leaf => ({ t: "leaf", id: newId(), fn, args, opts });
const split = (dir: "row" | "col", ratio: number, a: Node, b: Node): Split => ({ t: "split", id: newId(), dir, ratio, a, b });
export const row = (ratio: number, a: Node, b: Node) => split("row", ratio, a, b);
export const col = (ratio: number, a: Node, b: Node) => split("col", ratio, a, b);

export function leaves(node: Node): Leaf[] {
  return node.t === "leaf" ? [node] : [...leaves(node.a), ...leaves(node.b)];
}

export function findLeaf(node: Node, id: string): Leaf | null {
  return leaves(node).find((l) => l.id === id) ?? null;
}

function map(node: Node, f: (n: Node) => Node): Node {
  const m = f(node);
  if (m !== node || m.t === "leaf") return m;
  const a = map(m.a, f), b = map(m.b, f);
  return a === m.a && b === m.b ? m : { ...m, a, b };
}

export function updateLeaf(tree: Node, id: string, patch: Partial<Leaf>): Node {
  return map(tree, (x) => (x.t === "leaf" && x.id === id ? { ...x, ...patch } : x));
}

export function splitLeaf(tree: Node, id: string, dir: "row" | "col", add: Leaf): Node {
  return map(tree, (x) => (x.t === "leaf" && x.id === id ? split(dir, 0.5, x, add) : x));
}

/** Remove a panel; its sibling takes the space. The last panel cannot be closed. */
export function closeLeaf(tree: Node, id: string): Node {
  if (tree.t === "leaf") return tree;
  const walk = (x: Node): Node => {
    if (x.t === "leaf") return x;
    if (x.a.t === "leaf" && x.a.id === id) return x.b;
    if (x.b.t === "leaf" && x.b.id === id) return x.a;
    const a = walk(x.a), b = walk(x.b);
    return a === x.a && b === x.b ? x : { ...x, a, b };
  };
  return walk(tree);
}

export function setRatio(tree: Node, splitId: string, ratio: number): Node {
  const r = Math.min(0.88, Math.max(0.12, ratio));
  return map(tree, (x) => (x.t === "split" && x.id === splitId ? { ...x, ratio: r } : x));
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Divider { id: string; dir: "row" | "col"; at: Rect; parent: Rect }

/** Where each panel and divider goes, in fractions of the workspace. */
export function layoutRects(node: Node, r: Rect = { x: 0, y: 0, w: 1, h: 1 }, out: { leaves: Map<string, Rect>; dividers: Divider[] } = { leaves: new Map(), dividers: [] }) {
  if (node.t === "leaf") { out.leaves.set(node.id, r); return out; }
  if (node.dir === "row") {
    const wa = r.w * node.ratio;
    layoutRects(node.a, { ...r, w: wa }, out);
    layoutRects(node.b, { ...r, x: r.x + wa, w: r.w - wa }, out);
    out.dividers.push({ id: node.id, dir: "row", at: { x: r.x + wa, y: r.y, w: 0, h: r.h }, parent: r });
  } else {
    const ha = r.h * node.ratio;
    layoutRects(node.a, { ...r, h: ha }, out);
    layoutRects(node.b, { ...r, y: r.y + ha, h: r.h - ha }, out);
    out.dividers.push({ id: node.id, dir: "col", at: { x: r.x, y: r.y + ha, w: r.w, h: 0 }, parent: r });
  }
  return out;
}

// ---------- Workspaces ----------

export interface WsDef { id: string; label: string; key: string; make: () => Node }

export const WORKSPACES: WsDef[] = [
  { id: "overview", label: "Overview", key: "1", make: () => row(0.56,
    col(0.62, leaf("MON"), row(0.5, leaf("MOV"), leaf("NEWS"))),
    col(0.55, leaf("DES", ["EUR"]), leaf("HEAT"))) },
  { id: "macro", label: "Macro", key: "2", make: () => row(0.52,
    col(0.55, leaf("ECO"), leaf("CRV")),
    col(0.5, leaf("DES", ["UST10Y"]), row(0.5, leaf("COT"), leaf("KPI")))) },
  { id: "fx", label: "FX", key: "3", make: () => row(0.55,
    col(0.58, leaf("WMAP"), leaf("MON", [], { group: "class:fx" })),
    col(0.5, leaf("DES", ["EUR"]), leaf("CMP", ["EUR", "JPY"]))) },
  { id: "commodities", label: "Commodities", key: "4", make: () => row(0.52,
    col(0.5, leaf("MON", [], { group: "class:commodities" }), leaf("COT")),
    col(0.5, leaf("DES", ["BRENT"]), leaf("CMP", ["BRENT", "WTI"]))) },
  { id: "simlab", label: "Sim lab", key: "5", make: () => row(0.6,
    leaf("CRIS"),
    col(0.5, leaf("SCEN"), leaf("STRS"))) },
];

export const WS_BY_ID: Record<string, WsDef> = Object.fromEntries(WORKSPACES.map((w) => [w.id, w]));

const KEY = (id: string) => `parity.term.v1.ws.${id}`;

export function freshWs(id: string): WsState {
  const tree = (WS_BY_ID[id] ?? WORKSPACES[0]).make();
  return { tree, focus: leaves(tree)[0].id, max: null };
}

function valid(x: unknown): x is Node {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.t === "leaf") return typeof o.id === "string" && typeof o.fn === "string" && Array.isArray(o.args);
  return o.t === "split" && (o.dir === "row" || o.dir === "col") && typeof o.ratio === "number" && valid(o.a) && valid(o.b);
}

export function readWs(id: string): WsState {
  try {
    const raw = window.localStorage.getItem(KEY(id));
    if (raw) {
      const s = JSON.parse(raw) as WsState;
      if (valid(s.tree)) {
        const ids = leaves(s.tree).map((l) => l.id);
        return { tree: s.tree, focus: ids.includes(s.focus) ? s.focus : ids[0], max: s.max && ids.includes(s.max) ? s.max : null };
      }
    }
  } catch { /* storage blocked or bad JSON: use the preset */ }
  return freshWs(id);
}

export function writeWs(id: string, s: WsState) {
  try { window.localStorage.setItem(KEY(id), JSON.stringify(s)); } catch { /* storage blocked */ }
}

export function clearWs(id: string) {
  try { window.localStorage.removeItem(KEY(id)); } catch { /* storage blocked */ }
}
