// The scenario tab: type or pick an event, click the countries involved, then play what
// followed similar past events from day 0 to three months after. The map and the fan
// charts fill in day by day and the leaderboard ranks each market's middle outcome.
// Historical analogues only (REF-0011): history, not a forecast.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, FanChart, FilterChip, Grid, Panel, Segmented, Select, fmt } from "../../ui";
import {
  EMPTY_SPEC, fmtChange, humanize, pathBands, PRESETS,
  type Band as FanBand, type Match, type ScenarioAsset, type ScenarioData, type Spec,
} from "../../lib/scenarios";
import { parseEvent } from "../../lib/eventText";
import { actorOf, currencyOf, divergingFill, regionsOf, signed, type WorldData } from "../../lib/world";
import { colorAt, tone } from "./play/data";
import { Board, leaderOf, Stage, type BoardRow } from "./play/Stage";
import { usePlayback } from "./play/usePlayback";
import { worldBands } from "./impact";
import { countryNames, MapLegend, WorldMap } from "./WorldMap";

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const STANDARD = ["oil", "gas", "sp500", "vix", "ust10y", "usd"];
const RANKED = ["oil", "brent", "gas", "sp500", "usd"];
const DAYS = 63;
const RATES = { "1x": 6, "4x": 16, "16x": 64 };
const MARKS = [{ label: "1d", a: 1, b: 1 }, { label: "1w", a: 5, b: 5 }, { label: "1m", a: 21, b: 21 }, { label: "3m", a: 63, b: 63 }];

const bandAt = (bands: FanBand[], d: number): FanBand | null => {
  let best: FanBand | null = null;
  for (const b of bands) if (b.day <= d) best = b;
  return best;
};

function dayWords(d: number): string {
  if (d === 0) return "the last close before the event";
  if (d < 5) return `${d} trading day${d === 1 ? "" : "s"} after`;
  if (d < 21) return `about ${Math.round(d / 5)} week${Math.round(d / 5) === 1 ? "" : "s"} after`;
  return `about ${Math.round(d / 21)} month${Math.round(d / 21) === 1 ? "" : "s"} after`;
}

export function ScenarioView({ data, scen, spec, setSpec, matches, onPaths }: {
  data: WorldData; scen: ScenarioData; spec: Spec; setSpec: (f: (s: Spec) => Spec) => void; matches: Match[]; onPaths: () => void;
}) {
  const set = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));
  const [text, setText] = useState(spec.title);
  const [focus, setFocus] = useState<string | null>(null);
  const v = scen.vocab;
  const n = matches.length;
  const pb = usePlayback(DAYS + 1, RATES, matches.map((m) => m.event.id).join(","));
  const d = pb.i;

  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => { countryNames().then(setNames).catch(() => setNames({})); }, []);
  const outlined = useMemo(() => {
    const out = new Set<string>();
    for (const [id, name] of Object.entries(names)) if (spec.actors.includes(actorOf(id, name))) out.add(id);
    return out;
  }, [names, spec.actors]);

  // Every currency's fan from the world file (every 3rd trading day), and the scenario
  // file's daily fans for oil, gas, stocks, the VIX, yields and the dollar.
  const codes = useMemo(() => data.assets.filter((x) => x.group === "currencies" && x.key !== "USD").map((x) => x.key), [data]);
  const fx = useMemo(() => Object.fromEntries(codes.map((c) => [c, worldBands(data, matches, c)])), [data, matches, codes]);
  const daily = useMemo(() => Object.fromEntries(scen.assets.map((x) => [x.key, pathBands(matches, x.key)])), [scen, matches]);

  const describe = () => {
    const p = parseEvent(text);
    setSpec((s) => ({ ...s, title: text.trim(), type: v.types.includes(p.type) ? p.type : "", actors: p.actors,
      regions: p.regions.filter((r) => v.regions.includes(r)), commodities: p.commodities.filter((c) => v.commodities.includes(c)), severity: p.severity }));
  };
  const clickCountry = (id: string, name: string) => {
    const actor = actorOf(id, name);
    setSpec((s) => {
      const on = s.actors.includes(actor);
      const region = regionsOf(id)[0];
      return { ...s, actors: on ? s.actors.filter((a) => a !== actor) : [...s.actors, actor], regions: !on && region && !s.regions.includes(region) ? [...s.regions, region] : s.regions };
    });
  };

  const label = Object.fromEntries(data.assets.map((a) => [a.key, a.label]));
  const regionCodes = [...new Set([...outlined].map((id) => currencyOf(id)).filter((c): c is string => !!c && c !== "USD"))];
  const fxShown = [...new Set([...regionCodes, "JPY", "CHF", "EUR", "AUD"])].filter((c) => fx[c]).slice(0, 6);
  const ranked = scen.assets.filter((x) => RANKED.includes(x.key));
  const rows: BoardRow[] = [
    ...ranked.map((x, i) => ({ key: x.key, label: x.label, color: colorAt(i), bands: daily[x.key] ?? [] })),
    ...fxShown.map((c, i) => ({ key: c, label: `${c} ${label[c] ?? ""}`, color: colorAt(i + ranked.length), bands: fx[c]?.bands ?? [] })),
  ].map((r) => {
    const b = n ? bandAt(r.bands, d) : null;
    const ups = n && d > 0 ? matches.filter((m) => {
      const p = m.event.paths[r.key] ?? data.events.find((e) => e.id === m.event.id)?.paths[r.key];
      if (!p?.length) return false;
      const step = m.event.paths[r.key] ? 1 : data.event_path_step;
      const val = p[Math.min(p.length - 1, Math.floor(d / step))];
      return val != null && val > 0;
    }).length : null;
    return {
      key: r.key, label: r.label, color: r.color, sort: b?.median ?? null,
      cells: [<span className={tone(b?.median)}>{b ? signed(b.median) : "n/a"}</span>, b ? `${ups}/${b.count}` : "n/a", b ? (b.q75 - b.q25).toFixed(1) : "n/a"] as [ReactNode, ReactNode, ReactNode],
    };
  });

  const scale = Math.max(1.5, Math.min(8, 1.5 + d / 9));
  const fill = (id: string) => {
    const c = currencyOf(id);
    if (!c || !n) return "var(--map-none)";
    const b = c === "USD" ? bandAt(daily.usd ?? [], d) : bandAt(fx[c]?.bands ?? [], d);
    return divergingFill(b?.median ?? null, scale);
  };
  const card = (id: string, name: string) => {
    const c = currencyOf(id);
    const b = c ? (c === "USD" ? bandAt(daily.usd ?? [], d) : bandAt(fx[c]?.bands ?? [], d)) : null;
    return (
      <>
        <div className="wm-card-title">{name}</div>
        {c ? (b ? (
          <dl className="wm-card-rows">
            <div><dt>Middle outcome, day {d}</dt><dd className={tone(b.median)}>{signed(b.median)}</dd></div>
            <div><dt>Middle half</dt><dd>{signed(b.q25)} to {signed(b.q75)}</dd></div>
            <div><dt>Past events</dt><dd>{b.count}</dd></div>
          </dl>
        ) : <div className="wm-card-sub muted">{n ? "No past event here has data for this currency." : `${c}: build a scenario to colour the map.`}</div>)
          : <div className="wm-card-sub muted">No currency data in Parity yet.</div>}
        <div className="wm-card-foot">Click to {spec.actors.includes(actorOf(id, name)) ? "remove it from" : "add it to"} the scenario</div>
      </>
    );
  };

  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;
  const assets = STANDARD.map((k) => scen.assets.find((a) => a.key === k)).filter((a): a is ScenarioAsset => !!a);
  const markers = scen.horizons.filter((h) => h.days > 1).map((h) => ({ day: h.days, label: h.key }));
  const dates = matches.map((m) => m.event.date).sort();

  return (
    <>
      <div className="sw2-card pb-builder">
        <div className="pb-builder-grid">
          <div className="pb-builder-text">
            <label className="ui-field">
              <span className="ui-field-label">Describe an event</span>
              <textarea className="ui-input" rows={2} value={text} placeholder="Iran bombs a Chinese port" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); describe(); } }} />
            </label>
            <div className="sw2-links">
              <Button size="sm" variant="primary" icon="sparkle" onClick={describe} disabled={!text.trim()}>Read it</Button>
              <Button size="sm" variant="tertiary" onClick={() => { setText(""); setSpec((s) => ({ ...EMPTY_SPEC, assets: s.assets })); }}>Clear</Button>
            </div>
            <p className="muted small">Words become the choices on the right by simple keyword matching. Check them, and click countries on the map to add or remove them.</p>
            <Field label="Or start from an example">
              {PRESETS.map((p) => <FilterChip key={p.label} label={p.label} onClick={() => { setText(p.spec.title ?? p.label); setSpec((s) => ({ ...EMPTY_SPEC, assets: s.assets, ...p.spec })); }} />)}
            </Field>
          </div>
          <div className="pb-builder-fields">
            <div className="pb-builder-row">
              <div className="ui-field">
                <span className="ui-field-label">Kind of event</span>
                <Select label="Kind of event" value={spec.type} onChange={(t) => set({ type: t })} options={[["", "Any kind"], ...v.types.map((t) => [t, humanize(t)] as [string, string])]} />
              </div>
              <div className="ui-field">
                <span className="ui-field-label">How big (1 minor, 5 extreme)</span>
                <Segmented label="Severity" size="sm" value={String(spec.severity)} onChange={(s) => set({ severity: Number(s) })} options={[["0", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]} />
              </div>
            </div>
            <Field label="Where">
              {v.regions.map((r) => <FilterChip key={r} label={humanize(r)} active={spec.regions.includes(r)} onClick={() => set({ regions: toggleIn(spec.regions, r) })} onRemove={() => set({ regions: toggleIn(spec.regions, r) })} />)}
            </Field>
            <Field label="Who is involved">
              {spec.actors.length === 0 && <span className="muted small">Click countries on the map</span>}
              {spec.actors.map((a) => <FilterChip key={a} label={humanize(a)} active onClick={() => set({ actors: toggleIn(spec.actors, a) })} onRemove={() => set({ actors: toggleIn(spec.actors, a) })} />)}
            </Field>
            <Field label="Commodities at risk">
              {v.commodities.map((c) => <FilterChip key={c} label={humanize(c)} active={spec.commodities.includes(c)} onClick={() => set({ commodities: toggleIn(spec.commodities, c) })} onRemove={() => set({ commodities: toggleIn(spec.commodities, c) })} />)}
            </Field>
          </div>
        </div>
      </div>

      <Stage pb={pb} label="Scenario replay"
        eyebrow={`${spec.title.trim() || "Your scenario"} · ${n} past event${n === 1 ? "" : "s"}${n ? `, ${dates[0].slice(0, 4)} to ${dates[dates.length - 1].slice(0, 4)}` : ""}`}
        big={`Day ${d}`} sub={[dayWords(d)]}
        leading={n ? leaderOf(rows) : null}
        bands={MARKS} startLabel="Day 0" endLabel={`Day ${DAYS}`} valueText={(i) => `Day ${i}, ${dayWords(i)}`}
        honest={<>{empty ? "Describe an event or click a country to begin."
          : n === 0 ? "No past event in the catalog looks like this. Try fewer details or a broader region."
          : <>These ranges come from {n} past event{n === 1 ? "" : "s"} that look like your scenario{n < 5 ? ", which is too few to rely on" : ""}. Other events could give different ranges, and other news in the same weeks also moved prices.</>}</>}
        visual={
          <WorldMap label={`Middle outcome of each currency ${d} trading days after past events like the scenario`} outlined={outlined}
            fill={fill} card={card} onSelect={clickCountry}
            legend={<MapLegend title={`Middle outcome against the dollar, day ${d}`} low={signed(-scale, 0)} high={signed(scale, 0)} />} />
        }
        board={<Board rows={rows} name="Market" headers={["Median", "Up in", "Spread"]} picked={focus} onPick={(k) => setFocus(focus === k ? null : k)} playing={pb.playing}
          caption={<>Median: the middle outcome so far. Up in: past events where it was higher (currencies: stronger against the dollar). Spread: width of the middle half, in the market's own units.</>} />}
        below={n > 0 ? (
          <div className="pb-below">
            <Grid cols={2}>
              {assets.map((a, i) => (
                <Panel key={a.key} title={a.label}>
                  <FanChart label={`${a.label} after past events like this`} bands={daily[a.key] ?? []} color={colorAt(i)} markers={markers} upTo={d}
                    paths={matches.filter((x) => x.event.paths[a.key]?.length).map((x) => ({ name: x.event.id, values: x.event.paths[a.key] }))}
                    format={(val) => fmtChange(val, a.measure)} tickFormat={(val) => fmtChange(val, a.measure, 0)} height={190} />
                </Panel>
              ))}
              {fxShown.map((c, i) => (
                <Panel key={c} title={`${label[c] ?? c} (${c})`}>
                  <FanChart label={`${c} after past events like this`} bands={fx[c].bands} paths={fx[c].paths} step={data.event_path_step} upTo={d}
                    color={colorAt(i + assets.length)} markers={markers} format={(val) => signed(val)} tickFormat={(val) => signed(val, 0)} height={190} />
                </Panel>
              ))}
            </Grid>
            <div className="sw2-links" style={{ margin: "16px 0" }}>
              <Button icon="graph" onClick={onPaths}>Simulate paths from these events</Button>
              <Button variant="tertiary" href="#/doc/REF-0011">How the matching works</Button>
            </div>
            <Panel title={`The ${n} past event${n === 1 ? "" : "s"}`}>
              <ol className="sw2-events">
                {matches.map(({ event: e, score }) => (
                  <li key={e.id}>
                    <div className="sw2-ev-head"><strong>{e.name}</strong><span className="muted small">{fmt.date(e.date)}</span><Badge>{humanize(e.type)}</Badge><Badge tone="accent">{Math.round(score * 100)}% alike</Badge></div>
                    <p className="small" style={{ margin: "4px 0 0", color: "var(--text-2)" }}>{e.description}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        ) : null}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      <div className="chips" style={{ marginBottom: 0, alignItems: "center" }}>{children}</div>
    </div>
  );
}
