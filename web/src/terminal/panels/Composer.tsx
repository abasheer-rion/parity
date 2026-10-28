// MIX, the shock composer (DEC-0066): combine moves ("oil +40% and the 3-month bill +100
// bp over 13 weeks") and see every past window since 1986 in which they all happened
// together, with what the other markets did in those windows and in the 13 weeks after.
// Each number says how many windows it rests on. Research only: past co-moves, not cause
// and effect, and not a forecast.
import { useMemo } from "react";
import { confidenceWord, findEpisodes, medianInterval, moveAt, quantile, type Shock } from "../../lib/stress";
import type { WorldData } from "../../lib/world";
import { useAsOf, useLoad, useOpt } from "../context";
import { getWorld } from "../data";
import { shortDate, tone } from "../fmt";
import { Empty, Loading, Seg, TTable, type TCol } from "../tui";

type Unit = "pct" | "bp" | "pts";
const MARKETS: { key: string; label: string; unit: Unit; shock?: boolean }[] = [
  { key: "oil", label: "Oil (WTI)", unit: "pct", shock: true },
  { key: "rate.TBILL3M", label: "US 3-month bill (Fed path)", unit: "bp", shock: true },
  { key: "bond.UST10Y", label: "US 10-year yield", unit: "bp", shock: true },
  { key: "stocks", label: "US stocks", unit: "pct", shock: true },
  { key: "USD", label: "US dollar", unit: "pct", shock: true },
  { key: "risk.VIX", label: "VIX", unit: "pts", shock: true },
  { key: "gas", label: "US natural gas", unit: "pct", shock: true },
  { key: "brent", label: "Oil (Brent)", unit: "pct" },
  { key: "bonds10", label: "US 10-year Treasuries", unit: "pct" },
  { key: "ind.Enrgy", label: "US energy shares", unit: "pct" },
  { key: "ind.Money", label: "US finance shares", unit: "pct" },
  { key: "JPY", label: "Japanese yen", unit: "pct" },
  { key: "CHF", label: "Swiss franc", unit: "pct" },
  { key: "EUR", label: "Euro", unit: "pct" },
  { key: "CAD", label: "Canadian dollar", unit: "pct" },
  { key: "NOK", label: "Norwegian krone", unit: "pct" },
  { key: "MXN", label: "Mexican peso", unit: "pct" },
];
const UNITS = Object.fromEntries(MARKETS.map((m) => [m.key, m.unit])) as Record<string, Unit>;
const AFTER = 13;
const MINUS = "−";

export function fmtMove(v: number | null | undefined, unit: Unit, d?: number): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const digits = d ?? (unit === "bp" ? 0 : 1);
  const a = Math.abs(v).toFixed(digits);
  const s = Number(a) === 0 ? "" : v > 0 ? "+" : MINUS;
  return unit === "pct" ? `${s}${a}%` : unit === "bp" ? `${s}${a} bp` : `${s}${a} pts`;
}

export function ComposerPanel() {
  const w = useLoad(getWorld);
  useAsOf(w.status === "ok" ? w.data.data_through : null);
  if (w.status === "loading") return <Loading what="Loading weekly prices" />;
  if (w.status !== "ok") return <Empty title={w.status === "missing" ? "No world data yet" : "Could not load the world data"}>{w.message}</Empty>;
  return <Composer data={w.data} />;
}

interface Row { key: string; label: string; unit: Unit; during: number[]; after: number[] }

function Composer({ data }: { data: WorldData }) {
  const [shockText, setShockText] = useOpt("shocks", "oil:40,rate.TBILL3M:100");
  const [weeksS, setWeeks] = useOpt("weeks", "13");
  const [shareS, setShare] = useOpt("share", "0.5");
  const weeks = Number(weeksS), share = Number(shareS);
  const g = data.weekly;
  const shocks: Shock[] = shockText.split(",").map((p) => p.split(":")).filter(([k, v]) => UNITS[k] && Number.isFinite(Number(v)) && Number(v) !== 0).map(([k, v]) => ({ key: k, size: Number(v) }));
  const setShock = (key: string, v: string) => {
    const rest = shocks.filter((s) => s.key !== key).map((s) => `${s.key}:${s.size}`);
    setShockText([...rest, ...(v && Number(v) !== 0 && Number.isFinite(Number(v)) ? [`${key}:${Number(v)}`] : [])].join(","));
  };
  const episodes = useMemo(() => (shocks.length ? findEpisodes(g, shocks, UNITS, weeks, share) : []), [g, shockText, weeks, share]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = MARKETS.filter((m) => g.series[m.key]).map((m) => ({
    key: m.key, label: m.label, unit: m.unit,
    during: episodes.map((e) => moveAt(g, m.key, m.unit, e.start, weeks)).filter((v): v is number => v != null),
    after: episodes.map((e) => moveAt(g, m.key, m.unit, e.end, AFTER)).filter((v): v is number => v != null),
  }));
  const med = (xs: number[]) => (xs.length ? quantile([...xs].sort((a, b) => a - b), 0.5) : null);
  const cell = (xs: number[], unit: Unit) => {
    const ci = medianInterval(xs);
    return (
      <span title={ci ? `90% range of the median: ${fmtMove(ci[0], unit)} to ${fmtMove(ci[1], unit)}` : "Too few windows for a 90% range"}>
        <span className={tone(med(xs))}>{fmtMove(med(xs), unit)}</span>
        <span className="term-faint term-mix-up"> {xs.filter((v) => v > 0).length}/{xs.length} up</span>
        {ci && (ci[0] > 0 || ci[1] < 0) ? <span className={ci[0] > 0 ? "up" : "down"}> ●</span> : null}
      </span>
    );
  };
  const cols: TCol<Row>[] = [
    { key: "m", label: "Market", align: "left", sort: (r) => r.label, render: (r) => <><span className="term-name strong">{r.label}</span>{shocks.some((s) => s.key === r.key) ? <span className="term-tag">shock</span> : null}</> },
    { key: "d", label: `During (${weeks}w)`, sort: (r) => med(r.during), render: (r) => cell(r.during, r.unit) },
    { key: "a", label: `Next ${AFTER}w`, sort: (r) => med(r.after), render: (r) => cell(r.after, r.unit) },
    { key: "c", label: "Rests on", sort: (r) => r.after.length, render: (r) => `${r.after.length} · ${confidenceWord(r.after.length)}`, className: "c-m1" },
  ];

  return (
    <div className="term-col term-mix">
      <div className="term-honest-strip">Research only. Past windows when these moves happened together; not cause and effect, not a forecast.</div>
      <div className="term-bar">
        <span className="term-bar-note">Shocks over</span>
        <Seg label="Window" value={weeksS} onChange={setWeeks} options={[["4", "4w"], ["13", "13w"], ["26", "26w"]]} />
        <span className="term-bar-note">count a window when each move reaches</span>
        <Seg label="How much of the asked size" value={shareS} onChange={setShare} options={[["1", "all"], ["0.67", "two thirds"], ["0.5", "half"]]} />
        <span className="term-bar-note">of its size, in its direction</span>
      </div>
      <div className="term-bar term-mix-shocks" role="group" aria-label="Shocks">
        {MARKETS.filter((m) => m.shock && g.series[m.key]).map((m) => (
          <label key={m.key} className="term-mix-shock">
            <span>{m.label}</span>
            <input className="term-input" type="number" step={m.unit === "bp" ? 25 : 5} placeholder="off" aria-label={`${m.label} shock, ${m.unit === "pct" ? "percent" : m.unit === "bp" ? "basis points" : "points"}`}
              defaultValue={shocks.find((s) => s.key === m.key)?.size ?? ""}
              onChange={(e) => { const v = e.target.value; if (v === "" || Number.isFinite(Number(v))) setShock(m.key, v); }} />
            <span className="term-faint">{m.unit === "pct" ? "%" : m.unit}</span>
          </label>
        ))}
      </div>
      <div className="term-scroll term-pad">
        {!shocks.length ? <Empty title="Add a shock">Type a size next to one or more markets, for example oil 40 and the 3-month bill 100.</Empty> : (
          <>
            <div className="term-lib-head">
              <span className="term-sym big">{episodes.length} past window{episodes.length === 1 ? "" : "s"}</span>
              <span className="term-bar-note">
                {shocks.map((s) => `${MARKETS.find((m) => m.key === s.key)?.label} ${fmtMove(s.size, UNITS[s.key], 0)}`).join(" and ")} within {weeks} weeks, since {g.dates[0].slice(0, 4)}
                {episodes.length < 5 ? " · too few to rely on: try a longer window or count half the size" : ` · ${confidenceWord(episodes.length)}`}
              </span>
            </div>
            {episodes.length > 0 && <TTable rows={rows} cols={cols} rowKey={(r) => r.key} caption="What other markets did in those windows and after" />}
            {episodes.length > 0 && (
              <ol className="term-lib-events" aria-label="The past windows">
                {episodes.map((e) => (
                  <li key={e.start}>
                    <span className="term-lib-date">{shortDate(g.dates[e.start])}</span>
                    <span className="term-lib-name">to {shortDate(g.dates[e.end])}</span>
                    <span className="term-lib-desc">{shocks.map((s) => `${MARKETS.find((m) => m.key === s.key)?.label} ${fmtMove(moveAt(g, s.key, UNITS[s.key], e.start, weeks), UNITS[s.key])}`).join(", ")}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="term-lib-note">Windows do not overlap: a long episode counts once, from its first week. A dot marks a direction that held, when the whole 90% range of the median sits on one side of zero. Weekly closes from the world file; yields and the VIX are changes in level.</p>
          </>
        )}
      </div>
    </div>
  );
}
