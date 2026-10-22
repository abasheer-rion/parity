// The world map: countries drawn as inline SVG from world-atlas (Natural Earth, public
// domain) with d3-geo. No tile server and no network call beyond our own bundle.
import { geoCentroid, geoEqualEarth, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Icon } from "../../ui";
import { COMMODITY_LABEL, DOTS, PRODUCERS, type Commodity } from "../../lib/world";

type Country = { id: string; name: string; d: string; c: [number, number] };

const W = 960;
const H = 500;

// Where to put a producer badge when the shape's centre would be odd (Alaska, Svalbard).
const BADGE_AT: Record<string, [number, number]> = {
  "840": [-99, 39], "124": [-106, 57], "643": [95, 62], "578": [9, 61], "152": [-70.5, -27],
  "250": [2.5, 46.5], "036": [134, -25], "360": [114, -1], "458": [102, 4.5], "484": [-102, 23.5],
};

let topoPromise: Promise<Country[]> | null = null;

function loadCountries(): Promise<Country[]> {
  topoPromise ??= import("world-atlas/countries-110m.json").then((m) => {
    const topo = (m.default ?? m) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
    const features = fc.features.filter((f) => f.id !== "010"); // no Antarctica
    const projection = geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: "FeatureCollection", features } as FeatureCollection);
    const path = geoPath(projection);
    return features.map((f: Feature<Geometry, { name: string }>, i) => {
      const id = f.id != null ? String(f.id) : `x${i}`;
      const at = BADGE_AT[id] ?? geoCentroid(f);
      return { id, name: f.properties.name, d: path(f) ?? "", c: (projection(at) ?? [0, 0]) as [number, number] };
    }).concat(DOTS.map((dot) => {
      const p = (projection([dot.lon, dot.lat]) ?? [0, 0]) as [number, number];
      return { id: dot.id, name: dot.name, d: "", c: p };
    }));
  });
  return topoPromise;
}

export interface MapProps {
  label: string;
  /** Fill for a country id. */
  fill: (id: string) => string;
  /** A small card shown while hovering a country. */
  card: (id: string, name: string) => ReactNode;
  onSelect: (id: string, name: string) => void;
  selected?: string | null;
  /** Countries to outline (a chosen region). */
  outlined?: Set<string>;
  producers?: Commodity[];
  /** Shown over the map, bottom left: the legend. */
  legend?: ReactNode;
}

const COMMODITY_COLOR: Record<Commodity, string> = { oil: "var(--series-2)", gas: "var(--series-1)", copper: "var(--series-4)" };
const COMMODITY_LETTER: Record<Commodity, string> = { oil: "O", gas: "G", copper: "C" };

export function WorldMap({ label, fill, card, onSelect, selected, outlined, producers = [], legend }: MapProps) {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadCountries().then(setCountries).catch((e: Error) => setError(e.message)); }, []);

  const [hover, setHover] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const byId = useMemo(() => new Map((countries ?? []).map((c) => [c.id, c])), [countries]);

  const zoom = (f: number) => setView((v) => {
    const k = Math.max(1, Math.min(8, v.k * f));
    // keep the centre of the view where it is
    const cx = (W / 2 - v.x) / v.k, cy = (H / 2 - v.y) / v.k;
    return k === 1 ? { k: 1, x: 0, y: 0 } : { k, x: W / 2 - cx * k, y: H / 2 - cy * k };
  });

  const toSvg = (dx: number, dy: number) => {
    const r = box.current?.getBoundingClientRect();
    return r ? [(dx / r.width) * W, (dy / r.height) * H] : [dx, dy];
  };

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && view.k > 1) {
      const [dx, dy] = toSvg(e.clientX - d.x, e.clientY - d.y);
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) {
        const maxX = 0, minX = W - W * view.k, maxY = 0, minY = H - H * view.k;
        setView((v) => ({ ...v, x: Math.min(maxX, Math.max(minX, d.vx + dx)), y: Math.min(maxY, Math.max(minY, d.vy + dy)) }));
      }
    }
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };

  const enter = (c: Country) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = box.current!.getBoundingClientRect();
    setHover({ id: c.id, name: c.name, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const click = (c: Country) => () => { if (!drag.current?.moved) onSelect(c.id, c.name); };

  if (error) return <div className="error">Could not draw the map: {error}</div>;

  const r = box.current?.getBoundingClientRect();
  const cardStyle = hover && r ? {
    left: Math.min(Math.max(8, hover.x + 14), r.width - 248),
    ...(hover.y > r.height / 2 ? { bottom: r.height - hover.y + 14 } : { top: hover.y + 14 }),
  } : undefined;
  const sel = selected ? byId.get(selected) : null;
  const badges = producers.flatMap((p) => PRODUCERS[p].map((id) => ({ id, p })));
  const badgeOffset = (id: string, p: Commodity) => {
    const list = producers.filter((x) => PRODUCERS[x].includes(id));
    return (list.indexOf(p) - (list.length - 1) / 2) * 11;
  };

  return (
    <div className={`wm ${view.k > 1 ? "zoomed" : ""}`} ref={box}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { onUp(); setHover(null); }}>
      {!countries && <div className="wm-loading muted small">Drawing the map</div>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {countries?.filter((c) => c.d).map((c) => (
            <path key={c.id} d={c.d} className={`wm-c ${outlined?.has(c.id) ? "out" : ""} ${hover?.id === c.id ? "hov" : ""}`}
              style={{ fill: fill(c.id), strokeWidth: (outlined?.has(c.id) ? 1.4 : 0.5) / view.k }}
              onPointerEnter={enter(c)} onPointerMove={enter(c)} onPointerLeave={() => setHover(null)} onClick={click(c)} />
          ))}
          {countries?.filter((c) => !c.d).map((c) => (
            <circle key={c.id} cx={c.c[0]} cy={c.c[1]} r={4 / Math.sqrt(view.k)} className={`wm-c wm-dot ${outlined?.has(c.id) ? "out" : ""}`}
              style={{ fill: fill(c.id), strokeWidth: 1 / view.k }}
              onPointerEnter={enter(c)} onPointerMove={enter(c)} onPointerLeave={() => setHover(null)} onClick={click(c)} />
          ))}
          {sel?.d && <path d={sel.d} className="wm-sel" style={{ strokeWidth: 2 / view.k }} />}
          {sel && !sel.d && <circle cx={sel.c[0]} cy={sel.c[1]} r={6 / Math.sqrt(view.k)} className="wm-sel" style={{ strokeWidth: 2 / view.k }} />}
          {badges.map(({ id, p }) => {
            const c = byId.get(id);
            if (!c) return null;
            const s = 1 / Math.sqrt(view.k);
            return (
              <g key={`${p}-${id}`} className="wm-badge" transform={`translate(${c.c[0] + badgeOffset(id, p) * s},${c.c[1]}) scale(${s})`} aria-hidden>
                <circle r={5.5} style={{ fill: COMMODITY_COLOR[p] }} />
                <text dy="0.35em" textAnchor="middle">{COMMODITY_LETTER[p]}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="wm-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1.6)}><Icon name="plus" size={14} /></button>
        <button aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / 1.6)} disabled={view.k === 1}><span aria-hidden className="wm-minus" /></button>
        <button aria-label="Reset the view" title="Reset the view" onClick={() => setView({ k: 1, x: 0, y: 0 })} disabled={view.k === 1}><Icon name="restart" size={13} /></button>
      </div>
      {legend && <div className="wm-legend">{legend}</div>}
      {producers.length > 0 && (
        <div className="wm-key" aria-label="Producer marks">
          {producers.map((p) => <span key={p}><span className="wm-key-dot" style={{ background: COMMODITY_COLOR[p] }}>{COMMODITY_LETTER[p]}</span>{COMMODITY_LABEL[p]} producer</span>)}
        </div>
      )}
      {hover && cardStyle && <div className="wm-card" style={cardStyle} role="status">{card(hover.id, hover.name)}</div>}
    </div>
  );
}

/** Every country's name by id, once the map file has loaded. */
export function countryNames(): Promise<Record<string, string>> {
  return loadCountries().then((list) => Object.fromEntries(list.map((c) => [c.id, c.name])));
}

/** A horizontal colour key for a diverging scale. */
export function MapLegend({ title, low, high, none = "No data" }: { title: string; low: string; high: string; none?: string }) {
  return (
    <div className="wm-scale">
      <span className="wm-scale-title">{title}</span>
      <span className="wm-scale-row">
        <span>{low}</span>
        <span className="wm-scale-bar" aria-hidden />
        <span>{high}</span>
        <span className="wm-scale-none" aria-hidden />
        <span>{none}</span>
      </span>
    </div>
  );
}
