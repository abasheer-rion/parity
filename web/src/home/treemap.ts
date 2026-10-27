// Squarified treemap layout (Bruls, Huizing and van Wijk, 2000): boxes whose areas match their
// values, kept as close to square as the space allows. Values must be positive and sorted from
// largest to smallest. Pure arithmetic, unit tested (tests/home.test.ts).

export interface Box<T> { item: T; x: number; y: number; w: number; h: number }

export function squarify<T>(items: T[], value: (t: T) => number, w: number, h: number): Box<T>[] {
  const total = items.reduce((s, t) => s + Math.max(0, value(t)), 0);
  if (!items.length || total <= 0 || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  const areas = items.map((t) => ({ item: t, a: Math.max(0, value(t)) * scale })).filter((x) => x.a > 0);
  const out: Box<T>[] = [];
  let x = 0, y = 0, rw = w, rh = h;
  let row: { item: T; a: number }[] = [];
  const worst = (r: { a: number }[], side: number) => {
    const s = r.reduce((n, v) => n + v.a, 0);
    let max = 0, min = Infinity;
    for (const v of r) { max = Math.max(max, v.a); min = Math.min(min, v.a); }
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const lay = (r: { item: T; a: number }[]) => {
    const s = r.reduce((n, v) => n + v.a, 0);
    if (rw >= rh) { // a column on the left
      const cw = s / rh;
      let cy = y;
      for (const v of r) { const bh = v.a / cw; out.push({ item: v.item, x, y: cy, w: cw, h: bh }); cy += bh; }
      x += cw; rw -= cw;
    } else { // a row on top
      const ch = s / rw;
      let cx = x;
      for (const v of r) { const bw = v.a / ch; out.push({ item: v.item, x: cx, y, w: bw, h: ch }); cx += bw; }
      y += ch; rh -= ch;
    }
  };
  for (const v of areas) {
    const side = Math.min(rw, rh);
    if (!row.length || worst([...row, v], side) <= worst(row, side)) row.push(v);
    else { lay(row); row = [v]; }
  }
  if (row.length) lay(row);
  return out;
}
