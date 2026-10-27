// Market heatmap (DEC-0075): the S&P 500 or the Nasdaq-100, one box per company, sized by its
// public float as filed with the SEC. Daily moves colour the boxes only where we may show them:
// no free source allows single-stock prices on a public site (REF-0014), so the public map is
// sized but not coloured, and team members see live colours from the team-only stock feeds
// (DEC-0056). A box opens the company in Trade.
import { useEffect, useMemo, useRef, useState } from "react";
import { loadHeatmap } from "../../lib/markets";
import { useResource } from "../../ui/resource";
import { subscribeBoard } from "../../lib/live/client";
import { useTeam } from "../../lib/live/team";
import { tradeUrl } from "../../lib/space";
import { squarify } from "../treemap";
import { Empty, Src } from "./common";

type Ix = "sp500" | "ndx";
const STOCK_FEEDS = ["alpaca", "finnhub"];

const bn = (v: number) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)} trillion` : `$${(v / 1e9).toFixed(0)} billion`);

/** Colour step for a daily move in percent: -3 or worse to +3 or better, in seven steps. */
export function heatStep(chg: number | null | undefined): number | null {
  if (chg == null || !Number.isFinite(chg)) return null;
  const c = Math.max(-3, Math.min(3, chg));
  return Math.round(c);
}

export default function Heatmap() {
  const doc = useResource("home:heatmap", loadHeatmap, { maxAge: 30 * 60_000 });
  const [ix, setIx] = useState<Ix>("sp500");
  const team = useTeam();
  const [moves, setMoves] = useState<Record<string, number>>({});
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const feeds = team?.team ? STOCK_FEEDS.filter((f) => team.sources.includes(f)) : [];
  useEffect(() => {
    if (!feeds.length) return;
    const offs = feeds.map((src) => subscribeBoard(src, (rows) => {
      setMoves((old) => { const n = { ...old }; for (const [sym, , chg] of rows) if (chg != null) n[sym] = chg; return n; });
    }));
    return () => offs.forEach((f) => f());
  }, [feeds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = doc.data?.indexes[ix]?.rows ?? [];
  const boxes = useMemo(() => squarify(rows, (r) => r[3], size.w, size.h), [rows, size.w, size.h]);
  const coloured = Object.keys(moves).length > 0;

  return (
    <div className="hm">
      <div className="hm-top">
        <div className="seg-mini" role="group" aria-label="Index">
          {(["sp500", "ndx"] as Ix[]).map((k) => (
            <button key={k} type="button" aria-pressed={ix === k} className={ix === k ? "on" : ""} onClick={() => setIx(k)}>{k === "sp500" ? "S&P 500" : "Nasdaq-100"}</button>
          ))}
        </div>
        {coloured ? (
          <span className="hm-key" aria-hidden><i className="h-3n" />-3%<i className="h-0" />0<i className="h-3p" />+3%</span>
        ) : (
          <span className="muted small">Box size only. Daily colours need a stock feed we may show; team members see them live.</span>
        )}
      </div>
      <div className="hm-map" ref={box} role="list" aria-label={`${ix === "sp500" ? "S&P 500" : "Nasdaq-100"} companies by size`}>
        {doc.error && !rows.length && <Empty>The heatmap data has not been published yet.</Empty>}
        {boxes.map(({ item: [t, name, sector, cap], x, y, w, h }, i) => {
          const chg = moves[t];
          const step = heatStep(chg);
          const label = `${t}, ${name}, ${sector}, public float ${bn(cap)}${chg != null ? `, ${chg >= 0 ? "up" : "down"} ${Math.abs(chg).toFixed(2)}% today` : ""}`;
          return (
            <a key={t} role="listitem" href={tradeUrl(`chart?s=${encodeURIComponent(t)}`)} target="_blank" rel="noopener"
              className={`hm-box ${step == null ? "h-none" : step < 0 ? `h-${-step}n` : step > 0 ? `h-${step}p` : "h-0"}`}
              tabIndex={i < 25 ? 0 : -1} aria-label={label} title={label}
              style={{ left: x, top: y, width: Math.max(0, w - 2), height: Math.max(0, h - 2) }}>
              {w > t.length * 8 + 10 && h > 20 && <span className="hm-t">{t}</span>}
              {w > 64 && h > 36 && <span className="hm-c">{chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` : sector}</span>}
            </a>
          );
        })}
      </div>
      <Src>
        Size: public float from each company's latest annual report, <a href="https://www.sec.gov/edgar" target="_blank" rel="noopener">SEC EDGAR</a>.
        Members: <a href="https://en.wikipedia.org/wiki/List_of_S%26P_500_companies" target="_blank" rel="noopener">Wikipedia</a>, CC BY-SA 4.0.
        {coloured ? " Colours: live, team only." : ""} The 25 largest boxes take keyboard focus; open Trade for the rest.
      </Src>
    </div>
  );
}
