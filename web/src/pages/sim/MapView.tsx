// The world map tab: every currency we hold, coloured by how it moved against the US
// dollar over the chosen step, by carry, or by a scenario's median impact. A slider and
// a play button walk through history a day, a week or a month at a time.
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Delta, KeyValues, LineChart, Segmented, Select, fmt } from "../../ui";
import type { Match, Spec } from "../../lib/scenarios";
import { humanize } from "../../lib/scenarios";
import type { Point } from "../../lib/types";
import {
  actorOf, carryAt, changeBetween, COMMODITY_LABEL, currencyNote, currencyOf, divergingFill, lastAt, producerOf, regionsOf,
  signed, stepsFor, weeklyCorrelation, type Commodity, type Horizon, type StepSize, type WorldData,
} from "../../lib/world";
import { MapLegend, WorldMap } from "./WorldMap";
import { medianImpact } from "./impact";

type Measure = "move" | "carry" | "impact";
type Speed = "1x" | "2x" | "4x";

const STEP_SCALE: Record<StepSize, number> = { day: 1.5, week: 3, month: 6 };
const STEP_WORD: Record<StepSize, string> = { day: "day", week: "week", month: "month" };
const SPEED_MS: Record<Speed, number> = { "1x": 700, "2x": 350, "4x": 160 };
export const IMPACT_SCALE: Record<Horizon, number> = { "1d": 1.5, "1w": 3, "1m": 5, "3m": 8 };

export function MapView({ data, spec, matches, onScenario, onPaths }: {
  data: WorldData; spec: Spec; matches: Match[];
  onScenario: (patch: Partial<Spec>) => void; onPaths: (keys: string[]) => void;
}) {
  const [step, setStep] = useState<StepSize>("week");
  const { grid, idx } = useMemo(() => stepsFor(data, step), [data, step]);
  const end = idx.length - 1;
  const [pos, setPos] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("2x");
  const [measure, setMeasure] = useState<Measure>("move");
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const [layers, setLayers] = useState<Commodity[]>(["oil"]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const at = Math.min(pos, end);
  const cur = idx[at];
  const prev = idx[Math.max(0, at - 1)];
  const date = grid.dates[cur] ?? "";
  // Keep the same date when the step size changes (or the nearest one before it).
  const changeStep = (s: StepSize) => {
    const next = stepsFor(data, s);
    let k = next.idx.length - 1;
    while (k > 0 && next.grid.dates[next.idx[k]] > date) k--;
    setPlaying(false);
    setStep(s);
    setPos(k);
  };

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setPos((p) => {
      if (p >= end) { setPlaying(false); return p; }
      return p + 1;
    }), SPEED_MS[speed]);
    return () => window.clearInterval(t);
  }, [playing, speed, end]);

  const play = () => {
    if (playing) { setPlaying(false); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPos(end); return; }
    if (at >= end) setPos(Math.max(0, end - 52));
    setPlaying(true);
  };

  const codes = useMemo(() => data.assets.filter((a) => a.group === "currencies").map((a) => a.key), [data]);
  const label = useMemo(() => Object.fromEntries(data.assets.map((a) => [a.key, a.label])), [data]);
  const moves = useMemo(() => Object.fromEntries(codes.map((c) => [c, at === 0 ? null : changeBetween(grid, c, prev, cur)])), [codes, grid, prev, cur, at]);
  const carry = useMemo(() => Object.fromEntries(codes.map((c) => [c, carryAt(data, c, date)])), [codes, data, date]);
  const hasScenario = matches.length > 0;
  const impact = useMemo(() => (hasScenario ? medianImpact(data, matches, horizon) : {}), [data, matches, horizon, hasScenario]);
  const m: Measure = measure === "impact" && !hasScenario ? "move" : measure;

  const valueOf = (code: string | null): number | null => {
    if (!code) return null;
    if (m === "move") return moves[code] ?? null;
    if (m === "carry") return code === "USD" ? null : carry[code] ?? null;
    return impact[code]?.median ?? null;
  };
  const scale = m === "move" ? STEP_SCALE[step] : m === "carry" ? 8 : IMPACT_SCALE[horizon];
  const fill = (id: string) => divergingFill(valueOf(currencyOf(id)), scale);
  const unit = m === "carry" ? " pts" : "%";

  const oilMove = at === 0 ? null : changeBetween(grid, "oil", prev, cur);
  const weeklyAt = (d: string) => {
    const w = data.weekly.dates;
    let k = w.length - 1;
    while (k > 0 && w[k] > d) k--;
    return k;
  };

  const card = (id: string, name: string) => {
    const code = currencyOf(id);
    const prod = producerOf(id);
    const corr = code && code !== "USD" ? weeklyCorrelation(data, code, "oil", weeklyAt(date)) : null;
    return (
      <>
        <div className="wm-card-title">{name}</div>
        {code ? (
          <>
            <div className="wm-card-sub">{label[code]} ({code}){code === "USD" ? ", against a basket of nine currencies" : ""}</div>
            <dl className="wm-card-rows">
              <div><dt>{m === "impact" ? `Median after past events, ${horizon}` : `This ${STEP_WORD[step]} vs USD`}</dt>
                <dd className={tone(m === "impact" ? impact[code]?.median : moves[code])}>{signed(m === "impact" ? impact[code]?.median : moves[code], step === "day" ? 2 : 1)}</dd></div>
              {code !== "USD" && <div><dt>Carry vs dollar</dt><dd>{carry[code] == null ? "no rate data" : signed(carry[code], 1, " pts")}</dd></div>}
              {m === "impact" && impact[code] && <div><dt>Past events counted</dt><dd>{impact[code].n}</dd></div>}
            </dl>
          </>
        ) : <div className="wm-card-sub muted">No currency data in Parity for this country yet.</div>}
        {prod.length > 0 && (
          <div className="wm-card-foot">
            {prod.map((p) => COMMODITY_LABEL[p]).join(", ")} producer
            {prod.includes("oil") && oilMove != null && <> · oil {signed(oilMove)} this {STEP_WORD[step]}</>}
            {corr != null && <> · moves with oil: {corr.toFixed(2)}</>}
          </div>
        )}
        {!prod.length && corr != null && Math.abs(corr) >= 0.3 && <div className="wm-card-foot">Moves with oil: {corr.toFixed(2)} (weekly, 3 years)</div>}
      </>
    );
  };

  const ranked = codes.map((c) => ({ c, v: valueOf(c) })).filter((x) => x.v != null && x.c !== (m === "carry" ? "USD" : "")) as { c: string; v: number }[];
  ranked.sort((a, b) => b.v - a.v);

  const legend = (
    <MapLegend title={m === "move" ? `Change against the US dollar this ${STEP_WORD[step]}` : m === "carry" ? "Interest rate gap against the dollar" : `Median move after past events like the scenario, ${horizon}`}
      low={signed(-scale, 0, unit)} high={signed(scale, 0, unit)} />
  );

  return (
    <div className="sw2-layout">
      <div className="sw2-main">
        <div className="sw2-bar">
          <Segmented<Measure> label="Colour countries by" size="sm" value={m} onChange={setMeasure}
            options={[["move", "Currency move"], ["carry", "Carry"], ["impact", hasScenario ? "Scenario impact" : "Scenario impact (set one)"]]} />
          {m === "impact" && <Segmented<Horizon> label="Horizon" size="sm" value={horizon} onChange={setHorizon} options={[["1d", "1d"], ["1w", "1w"], ["1m", "1m"], ["3m", "3m"]]} />}
          <div className="sw2-layers" role="group" aria-label="Producer marks">
            {(["oil", "gas", "copper"] as Commodity[]).map((c) => (
              <Checkbox key={c} label={COMMODITY_LABEL[c]} checked={layers.includes(c)} onChange={(on) => setLayers((l) => on ? [...l, c] : l.filter((x) => x !== c))} />
            ))}
          </div>
        </div>
        {measure === "impact" && !hasScenario && (
          <p className="sw2-note">No scenario yet. <a href="#/sim/scenario">Build one</a> and the map shows the median move that followed similar past events.</p>
        )}
        <WorldMap label={`World map coloured by ${m === "move" ? "currency move" : m === "carry" ? "carry" : "scenario impact"}, ${fmt.date(date)}`}
          fill={fill} card={card} selected={picked?.id} producers={layers} legend={legend}
          onSelect={(id, name) => setPicked((p) => (p?.id === id ? null : { id, name }))} />

        <div className="sw2-time">
          <div className="sw2-time-row">
            <Button variant="primary" size="sm" icon={playing ? "pause" : at >= end ? "restart" : "play"} onClick={play} disabled={m === "impact"}>
              {playing ? "Pause" : at >= end ? "Replay last year" : "Play"}
            </Button>
            <Button variant="tertiary" size="sm" icon="chevronLeft" onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} aria-label="Step back" disabled={at === 0}>{""}</Button>
            <Button variant="tertiary" size="sm" icon="chevronRight" onClick={() => { setPlaying(false); setPos((p) => Math.min(end, p + 1)); }} aria-label="Step forward" disabled={at >= end}>{""}</Button>
            <div className="sw2-date">
              <span className="sw2-date-big">{fmt.date(date)}</span>
              <span className="muted small">{m === "impact" ? "The scenario view ignores the date" : at === 0 ? "first point" : `${STEP_WORD[step]} to this date`}</span>
            </div>
            <Segmented<StepSize> label="Step" size="sm" value={step} onChange={changeStep} options={[["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]]} />
            <Select<Speed> label="Speed" value={speed} onChange={setSpeed} options={[["1x", "Slow"], ["2x", "Normal"], ["4x", "Fast"]]} />
          </div>
          <input className="sw-scrub" type="range" min={0} max={end} value={at} aria-label="Move through time" aria-valuetext={fmt.date(date)}
            style={{ ["--p" as string]: `${end ? (at / end) * 100 : 100}%` }}
            onChange={(e) => { setPlaying(false); setPos(Number(e.target.value)); }} />
          <div className="sw-scrub-ends"><span>{fmt.date(grid.dates[idx[0]])}</span><span>{fmt.date(grid.dates[idx[end]])}</span></div>
          {step === "day" && <p className="muted small">Daily steps cover {grid.dates[0]?.slice(0, 4)} on, to keep the file small. Weekly and monthly go back to 1986.</p>}
        </div>
      </div>

      <aside className="sw2-side" aria-label="Details">
        {picked ? (
          <CountryPanel data={data} id={picked.id} name={picked.name} date={date} onClose={() => setPicked(null)}
            onScenario={() => {
              const regions = regionsOf(picked.id);
              const actor = actorOf(picked.id, picked.name);
              onScenario({ regions: [...new Set([...spec.regions, ...regions.slice(0, 1)])], actors: [...new Set([...spec.actors, actor])] });
            }}
            onPaths={(code) => onPaths([code, "oil", "stocks"])} />
        ) : (
          <div className="sw2-card">
            <h2>{m === "carry" ? "Highest and lowest carry" : m === "impact" ? "After past events like this" : `Biggest moves this ${STEP_WORD[step]}`}</h2>
            <p className="muted small">{m === "carry" ? "3-month interest rate minus the US rate, monthly (OECD). Only ten currencies have a rate in our data." : m === "impact" ? `${matches.length} past events matched. The median move of each currency ${horizon} after them.` : "Value of each currency in US dollars. Up means it gained on the dollar."}</p>
            <Movers rows={ranked.slice(0, 5)} label={label} unit={unit} />
            {ranked.length > 5 && <><div className="sw2-sep" /><Movers rows={ranked.slice(-5)} label={label} unit={unit} /></>}
            <p className="muted small" style={{ marginTop: 12 }}>Click a country to pin its details. Hover for a quick look.</p>
          </div>
        )}
        <div className="sw2-card sw2-honest">
          <strong>History, not a forecast.</strong> The map replays real prices. Colours show what happened, and a past link between
          a currency and oil can break. Countries in grey have no currency data in Parity yet.
        </div>
      </aside>
    </div>
  );
}

const tone = (v: number | null | undefined) => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");

function Movers({ rows, label, unit }: { rows: { c: string; v: number }[]; label: Record<string, string>; unit: string }) {
  return (
    <ol className="sw2-movers">
      {rows.map((r) => (
        <li key={r.c}><span className="sw2-code">{r.c}</span><span className="sw2-name">{label[r.c]}</span><span className={`sw2-val ${tone(r.v)}`}>{signed(r.v, unit === "%" ? 2 : 1, unit)}</span></li>
      ))}
    </ol>
  );
}

function CountryPanel({ data, id, name, date, onClose, onScenario, onPaths }: {
  data: WorldData; id: string; name: string; date: string; onClose: () => void; onScenario: () => void; onPaths: (code: string) => void;
}) {
  const code = currencyOf(id);
  const [years, setYears] = useState<"1" | "5" | "all">("5");
  const g = data.weekly;
  const k = (() => { let i = g.dates.length - 1; while (i > 0 && g.dates[i] > date) i--; return i; })();
  const points: Point[] = useMemo(() => {
    if (!code) return [];
    const s = g.series[code] ?? [];
    const from = years === "all" ? "0000" : `${Number(date.slice(0, 4)) - Number(years)}${date.slice(4)}`;
    const out: Point[] = [];
    for (let i = 0; i <= k; i++) if (s[i] != null && g.dates[i] >= from) out.push([g.dates[i], s[i] as number]);
    return out;
  }, [code, g, k, years, date]);
  const yearAgo = code ? changeBetween(g, code, Math.max(0, k - 52), k) : null;
  const carry = code ? carryAt(data, code, date) : null;
  const corrOil = code && code !== "USD" ? weeklyCorrelation(data, code, "oil", k) : null;
  const corrStocks = code ? weeklyCorrelation(data, code, "stocks", k) : null;
  const last = code ? lastAt(g, code, k) : null;
  const prod = producerOf(id);
  const note = code ? currencyNote(id, code) : null;
  const regions = regionsOf(id);

  return (
    <div className="sw2-card">
      <div className="sw2-card-head">
        <h2>{name}</h2>
        <button className="sw-x" aria-label="Unpin" onClick={onClose}>×</button>
      </div>
      {code ? (
        <>
          <p className="muted small">{data.assets.find((a) => a.key === code)?.label} ({code}){code === "USD" ? ": an equal weight index against nine other currencies, so up means a stronger dollar." : ": value in US dollars, so up means it gained on the dollar."}{note ? ` ${note}` : ""}</p>
          <Segmented<"1" | "5" | "all"> label="Chart length" size="sm" value={years} onChange={setYears} options={[["1", "1y"], ["5", "5y"], ["all", "All"]]} />
          <LineChart label={`${code} through ${fmt.date(date)}`} height={180} format={(v) => (v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(3) : v.toPrecision(3))}
            series={[{ name: code, color: "var(--series-1)", points, emphasis: true }]} />
          <KeyValues cols={2} items={[
            ["Last close", last ? (last.v >= 0.1 ? last.v.toFixed(4) : last.v.toPrecision(4)) : "n/a"],
            ["Past year", <Delta value={yearAgo == null ? null : yearAgo / 100} />],
            ["Carry vs USD", code === "USD" ? "n/a" : carry == null ? "no rate data" : signed(carry, 1, " pts")],
            ["Moves with oil", corrOil == null ? "n/a" : corrOil.toFixed(2)],
            ["Moves with US stocks", corrStocks == null ? "n/a" : corrStocks.toFixed(2)],
            ["Data from", fmt.date(data.assets.find((a) => a.key === code)?.first ?? date)],
          ]} />
          <p className="muted small">"Moves with" is the correlation of weekly changes over the 3 years to this date: 1 moves together, 0 unrelated, below 0 opposite.</p>
        </>
      ) : <p className="muted small">No currency data in Parity for {name} yet.</p>}
      {prod.length > 0 && <p className="small">Big {prod.map((p) => COMMODITY_LABEL[p].toLowerCase()).join(" and ")} producer, so those prices can matter for its economy and currency.</p>}
      {regions.length > 0 && <p className="muted small">Region in the scenario list: {regions.map(humanize).join(", ")}.</p>}
      <div className="sw2-links">
        <Button size="sm" icon="sparkle" onClick={onScenario}>Scenario here</Button>
        {code && <Button size="sm" icon="graph" onClick={() => onPaths(code)}>Simulate {code}</Button>}
        {code && code !== "USD" && <Button size="sm" variant="tertiary" href="#/explore">Raw prices</Button>}
      </div>
    </div>
  );
}
