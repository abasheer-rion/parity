// The world map tab: every currency we hold, on a map that plays through time like the
// strategy race. Countries are coloured by the move since the start of the window, the
// move this step, or carry; the leaderboard ranks the currencies as time plays, and
// clicking a row lights up that currency's countries.
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Delta, KeyValues, LineChart, Segmented, fmt } from "../../ui";
import type { Spec } from "../../lib/scenarios";
import { humanize } from "../../lib/scenarios";
import type { Point } from "../../lib/types";
import {
  actorOf, carryAt, changeBetween, COMMODITY_LABEL, currencyNote, currencyOf, divergingFill, indexAtOrBefore, lastAt, producerOf, regionsOf,
  signed, stepsFor, weeklyCorrelation, type Commodity, type Horizon, type StepSize, type WorldData,
} from "../../lib/world";
import { WindowSelect } from "./play/Controls";
import { colorAt, crisisBands, dayMonthYear, monthYear, pct, tone, windowRange } from "./play/data";
import { Board, leaderOf, Stage, type BoardRow } from "./play/Stage";
import { ratesForGap, usePlayback } from "./play/usePlayback";
import { countryNames, MapLegend, WorldMap } from "./WorldMap";

type Measure = "since" | "step" | "carry";

const STEP_WORD: Record<StepSize, string> = { day: "day", week: "week", month: "month" };
const STEP_DAYS: Record<StepSize, number> = { day: 1.4, week: 7, month: 30.4 };
export const IMPACT_SCALE: Record<Horizon, number> = { "1d": 1.5, "1w": 3, "1m": 5, "3m": 8 };

export function MapView({ data, win, setWin, onScenario, onPaths }: {
  data: WorldData; win: string; setWin: (w: string) => void;
  onScenario: (patch: Partial<Spec>) => void; onPaths: (keys: string[]) => void;
}) {
  const [step, setStep] = useState<StepSize>("week");
  const [measure, setMeasure] = useState<Measure>("since");
  const [layers, setLayers] = useState<Commodity[]>(["oil"]);
  const [picked, setPicked] = useState<{ code: string; id?: string; name?: string } | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => { countryNames().then(setNames).catch(() => setNames({})); }, []);

  const { grid, idx } = useMemo(() => stepsFor(data, step), [data, step]);
  const frames = useMemo(() => {
    const dates = idx.map((i) => grid.dates[i]);
    const [a, b] = windowRange(dates, win);
    return idx.slice(a, b + 1);
  }, [grid, idx, win]);
  const pb = usePlayback(frames.length, ratesForGap(STEP_DAYS[step]), `${step}-${win}-${frames.length}`);
  const k = frames[pb.i] ?? 0, start = frames[0] ?? 0, prev = frames[Math.max(0, pb.i - 1)] ?? 0;
  const date = grid.dates[k] ?? "";
  const dates = useMemo(() => frames.map((i) => grid.dates[i]), [frames, grid]);

  const codes = useMemo(() => data.assets.filter((x) => x.group === "currencies").map((x) => x.key), [data]);
  const label = useMemo(() => Object.fromEntries(data.assets.map((x) => [x.key, x.label])), [data]);
  const since = Object.fromEntries(codes.map((c) => [c, k === start ? 0 : changeBetween(grid, c, start, k)]));
  const moves = Object.fromEntries(codes.map((c) => [c, pb.i === 0 ? null : changeBetween(grid, c, prev, k)]));
  const carry = Object.fromEntries(codes.map((c) => [c, carryAt(data, c, date)]));
  const valueOf = (code: string | null): number | null => {
    if (!code) return null;
    if (measure === "since") return since[code] ?? null;
    if (measure === "step") return moves[code] ?? null;
    return code === "USD" ? null : carry[code] ?? null;
  };
  const years = (Date.parse(date) - Date.parse(dates[0] ?? date)) / (365.25 * 86_400_000);
  const scale = measure === "since" ? Math.max(4, Math.min(30, 6 * Math.sqrt(Math.max(years, 0.08)))) : measure === "step" ? { day: 1.5, week: 3, month: 6 }[step] : 8;
  const unit = measure === "carry" ? " pts" : "%";

  // 1-year change: the close a year before the date shown.
  const agoK = indexAtOrBefore(grid.dates, new Date(Date.parse(date) - 365 * 86_400_000).toISOString().slice(0, 10));
  const rows: BoardRow[] = codes.map((c, n) => {
    const last = lastAt(grid, c, k);
    const yr = agoK >= 0 ? changeBetween(grid, c, agoK, k) : null;
    const s = since[c] ?? null;
    return {
      key: c, label: `${c} ${label[c] ?? ""}`, color: colorAt(n), bench: c === "USD",
      title: c === "USD" ? "The dollar against nine other currencies" : `${label[c]}, value in US dollars`,
      sort: measure === "carry" ? (c === "USD" ? null : carry[c] ?? null) : measure === "step" ? moves[c] ?? null : s,
      cells: [
        last ? (measure === "carry" ? (c === "USD" ? "n/a" : carry[c] == null ? "no rate" : signed(carry[c], 1, " pts")) : last.v >= 0.1 ? last.v.toFixed(3) : last.v.toPrecision(3)) : <span className="muted">n/a</span>,
        <span className={tone(s)}>{pct(s)}</span>,
        <span className={tone(yr)}>{pct(yr, 0)}</span>,
      ],
    };
  });

  const outlined = useMemo(() => {
    const out = new Set<string>();
    if (picked) for (const id of Object.keys(names)) if (currencyOf(id) === picked.code) out.add(id);
    return out;
  }, [picked, names]);

  const oilMove = pb.i === 0 ? null : changeBetween(grid, "oil", prev, k);
  const card = (id: string, name: string) => {
    const code = currencyOf(id);
    const prod = producerOf(id);
    return (
      <>
        <div className="wm-card-title">{name}</div>
        {code ? (
          <>
            <div className="wm-card-sub">{label[code]} ({code}){code === "USD" ? ", against nine currencies" : ""}</div>
            <dl className="wm-card-rows">
              <div><dt>Since {monthYear(dates[0] ?? "")}</dt><dd className={tone(since[code])}>{pct(since[code])}</dd></div>
              <div><dt>This {STEP_WORD[step]}</dt><dd className={tone(moves[code])}>{pct(moves[code], step === "day" ? 2 : 1)}</dd></div>
              {code !== "USD" && <div><dt>Carry vs dollar</dt><dd>{carry[code] == null ? "no rate data" : signed(carry[code], 1, " pts")}</dd></div>}
            </dl>
          </>
        ) : <div className="wm-card-sub muted">No currency data in Parity for this country yet.</div>}
        {prod.length > 0 && (
          <div className="wm-card-foot">
            {prod.map((p) => COMMODITY_LABEL[p]).join(", ")} producer
            {prod.includes("oil") && oilMove != null && <> · oil {signed(oilMove)} this {STEP_WORD[step]}</>}
          </div>
        )}
      </>
    );
  };

  const pick = (code: string) => setPicked((p) => (p?.code === code && !p.id ? null : { code }));
  const repId = picked?.id ?? (picked ? Object.keys(names).find((id) => currencyOf(id) === picked.code && (picked.code !== "USD" || id === "840")) : undefined);
  const bands = useMemo(() => crisisBands(dates), [dates]);

  return (
    <Stage pb={pb} label="World map replay"
      eyebrow={measure === "since" ? `World map · currencies against the dollar since ${monthYear(dates[0] ?? "")}` : measure === "step" ? `World map · change each ${STEP_WORD[step]}` : "World map · interest rate gap with the dollar"}
      big={step === "day" ? dayMonthYear(date) : monthYear(date)} sub={[dayMonthYear(date), pb.i === 0 ? "the starting line" : years < 2 ? `${Math.round(years * 52)} weeks in` : `${years.toFixed(1)} years in`]}
      leading={leaderOf(rows)}
      controls={<>
        <Segmented<StepSize> label="Step" size="sm" value={step} onChange={setStep} options={[["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]]} />
        <WindowSelect value={win} onChange={setWin} />
      </>}
      bands={bands} startLabel={dayMonthYear(dates[0] ?? "")} endLabel={dayMonthYear(dates[dates.length - 1] ?? "")} valueText={(i) => dayMonthYear(dates[i] ?? "")}
      honest={<>History replayed, not a forecast. Colours show what happened; a past link between a currency and oil can break. Countries in grey have no currency data in Parity.{step === "day" ? " Daily steps start in 2020, to keep the file small." : ""}</>}
      visual={
        <div className="pb-mapwrap">
          <div className="sw2-bar">
            <Segmented<Measure> label="Colour countries by" size="sm" value={measure} onChange={setMeasure}
              options={[["since", "Since start"], ["step", `This ${STEP_WORD[step]}`], ["carry", "Carry"]]} />
            <div className="sw2-layers" role="group" aria-label="Producer marks">
              {(["oil", "gas", "copper"] as Commodity[]).map((c) => (
                <Checkbox key={c} label={COMMODITY_LABEL[c]} checked={layers.includes(c)} onChange={(on) => setLayers((l) => on ? [...l, c] : l.filter((x) => x !== c))} />
              ))}
            </div>
          </div>
          <WorldMap label={`World map, ${fmt.date(date)}`} fill={(id) => divergingFill(valueOf(currencyOf(id)), scale)} card={card}
            selected={picked?.id} outlined={outlined} producers={layers}
            legend={<MapLegend title={measure === "since" ? "Change against the dollar since the start" : measure === "step" ? `Change against the dollar this ${STEP_WORD[step]}` : "Interest rate gap with the dollar"} low={signed(-scale, 0, unit)} high={signed(scale, 0, unit)} />}
            onSelect={(id, name) => { const code = currencyOf(id); setPicked((p) => (p?.id === id ? null : code ? { code, id, name } : null)); }} />
        </div>
      }
      board={<Board rows={rows} name="Currency" headers={[measure === "carry" ? "Carry" : "Value", "Since start", "1 yr"]} picked={picked?.code} onPick={pick} playing={pb.playing}
        caption={<>Value: in US dollars (USD is an index). {measure === "carry" ? "Ranked by carry; only nine currencies have a rate." : measure === "step" ? `Ranked by this ${STEP_WORD[step]}'s move.` : "Ranked by the move since the start."} Click a row to light up its countries.</>} />}
      below={picked && repId ? (
        <CountryPanel data={data} id={repId} name={picked.name ?? (picked.code === "EUR" ? "Euro area" : names[repId] ?? picked.code)} date={date} onClose={() => setPicked(null)}
          onScenario={() => {
            const regions = regionsOf(repId);
            onScenario({ regions: regions.slice(0, 1), actors: [actorOf(repId, names[repId] ?? "")] });
          }}
          onPaths={(code) => onPaths([code, "oil", "stocks"])} />
      ) : null}
    />
  );
}

function CountryPanel({ data, id, name, date, onClose, onScenario, onPaths }: {
  data: WorldData; id: string; name: string; date: string; onClose: () => void; onScenario: () => void; onPaths: (code: string) => void;
}) {
  const code = currencyOf(id);
  const [years, setYears] = useState<"1" | "5" | "all">("5");
  const g = data.weekly;
  const k = Math.max(0, indexAtOrBefore(g.dates, date));
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
    <div className="sw2-card pb-country">
      <div className="sw2-card-head">
        <h2>{name}</h2>
        <button className="sw-x" aria-label="Unpin" onClick={onClose}>×</button>
      </div>
      {code ? (
        <div className="pb-country-grid">
          <div>
            <p className="muted small">{data.assets.find((a) => a.key === code)?.label} ({code}){code === "USD" ? ": an equal weight index against nine other currencies, so up means a stronger dollar." : ": value in US dollars, so up means it gained on the dollar."}{note ? ` ${note}` : ""}</p>
            <Segmented<"1" | "5" | "all"> label="Chart length" size="sm" value={years} onChange={setYears} options={[["1", "1y"], ["5", "5y"], ["all", "All"]]} />
            <LineChart label={`${code} through ${fmt.date(date)}`} height={180} format={(v) => (v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(3) : v.toPrecision(3))}
              series={[{ name: code, color: "var(--series-1)", points, emphasis: true }]} />
          </div>
          <div>
            <KeyValues cols={2} items={[
              ["Close", last ? (last.v >= 0.1 ? last.v.toFixed(4) : last.v.toPrecision(4)) : "n/a"],
              ["Past year", <Delta value={yearAgo == null ? null : yearAgo / 100} />],
              ["Carry vs USD", code === "USD" ? "n/a" : carry == null ? "no rate data" : signed(carry, 1, " pts")],
              ["Moves with oil", corrOil == null ? "n/a" : corrOil.toFixed(2)],
              ["Moves with US stocks", corrStocks == null ? "n/a" : corrStocks.toFixed(2)],
              ["Data from", fmt.date(data.assets.find((a) => a.key === code)?.first ?? date)],
            ]} />
            <p className="muted small">"Moves with" is the correlation of weekly changes over the 3 years to this date: 1 together, 0 unrelated, below 0 opposite.</p>
            {prod.length > 0 && <p className="small">Big {prod.map((p) => COMMODITY_LABEL[p].toLowerCase()).join(" and ")} producer, so those prices can matter for its economy and currency.</p>}
            {regions.length > 0 && <p className="muted small">Region in the scenario list: {regions.map(humanize).join(", ")}.</p>}
            <div className="sw2-links">
              <Button size="sm" icon="sparkle" onClick={onScenario}>Scenario here</Button>
              <Button size="sm" icon="graph" onClick={() => onPaths(code)}>Simulate {code}</Button>
            </div>
          </div>
        </div>
      ) : <p className="muted small">No currency data in Parity for {name} yet.</p>}
    </div>
  );
}
