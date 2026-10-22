// The scenario builder on the map: type or pick an event, click the countries involved,
// and see what markets did after similar past events, as fan charts and as a map
// coloured by each currency's median move. Historical analogues only (REF-0011).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, FanChart, FilterChip, Grid, Panel, Segmented, Select, Stat, fmt } from "../../ui";
import {
  aggregate, EMPTY_SPEC, fmtChange, humanize, pathBands, PRESETS,
  type HorizonKey, type Match, type ScenarioAsset, type ScenarioData, type Spec,
} from "../../lib/scenarios";
import { parseEvent } from "../../lib/eventText";
import {
  actorOf, currencyOf, divergingFill, regionsOf, signed, type Horizon, type WorldData,
} from "../../lib/world";
import { IMPACT_SCALE } from "./MapView";
import { medianImpact, worldBands } from "./impact";
import { countryNames, MapLegend, WorldMap } from "./WorldMap";

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const STANDARD = ["oil", "gas", "sp500", "vix", "ust10y", "usd"];
const HORIZON_WORDS: Record<HorizonKey, string> = { "1d": "a day later", "1w": "a week later", "1m": "a month later", "3m": "three months later" };

export function ScenarioView({ data, scen, spec, setSpec, matches, onPaths }: {
  data: WorldData; scen: ScenarioData; spec: Spec; setSpec: (f: (s: Spec) => Spec) => void; matches: Match[]; onPaths: () => void;
}) {
  const set = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));
  const [text, setText] = useState(spec.title);
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const v = scen.vocab;

  // Countries named as involved are outlined on the map.
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => { countryNames().then(setNames).catch(() => setNames({})); }, []);
  const impact = useMemo(() => medianImpact(data, matches, horizon), [data, matches, horizon]);
  const outlined = useMemo(() => {
    const out = new Set<string>();
    for (const [id, name] of Object.entries(names)) if (spec.actors.includes(actorOf(id, name))) out.add(id);
    return out;
  }, [names, spec.actors]);

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
      return {
        ...s,
        actors: on ? s.actors.filter((a) => a !== actor) : [...s.actors, actor],
        regions: !on && region && !s.regions.includes(region) ? [...s.regions, region] : s.regions,
      };
    });
  };

  const card = (id: string, name: string) => {
    const code = currencyOf(id);
    const im = code ? impact[code] : null;
    return (
      <>
        <div className="wm-card-title">{name}</div>
        {code ? (
          <>
            <div className="wm-card-sub">{code}{code === "USD" ? ", the dollar against nine currencies" : ", value in US dollars"}</div>
            {im ? (
              <dl className="wm-card-rows">
                <div><dt>Median {horizon} after</dt><dd className={im.median > 0 ? "up" : im.median < 0 ? "down" : ""}>{signed(im.median)}</dd></div>
                <div><dt>Middle half</dt><dd>{signed(im.q25)} to {signed(im.q75)}</dd></div>
                <div><dt>Rose in</dt><dd>{im.up} of {im.n}</dd></div>
              </dl>
            ) : <div className="wm-card-sub muted">No past event here has data for this currency.</div>}
          </>
        ) : <div className="wm-card-sub muted">No currency data in Parity yet.</div>}
        <div className="wm-card-foot">Click to {spec.actors.includes(actorOf(id, name)) ? "remove it from" : "add it to"} the scenario</div>
      </>
    );
  };

  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;
  const n = matches.length;
  const assets = STANDARD.map((k) => scen.assets.find((a) => a.key === k)).filter((a): a is ScenarioAsset => !!a);
  // Currencies of the countries in the scenario (and the euro and yen as havens), from the world file.
  const regionCodes = [...new Set([...outlined].map((id) => currencyOf(id)).filter((c): c is string => !!c && c !== "USD"))];
  const fxCodes = [...new Set([...regionCodes, "JPY", "CHF", "EUR"])].slice(0, 6);
  const label = Object.fromEntries(data.assets.map((a) => [a.key, a.label]));
  const markers = scen.horizons.filter((h) => h.days > 1).map((h) => ({ day: h.days, label: h.key }));

  return (
    <div className="sw2-layout scen">
      <aside className="sw2-side left" aria-label="Your scenario">
        <div className="sw2-card">
          <h2>Your scenario</h2>
          <label className="ui-field">
            <span className="ui-field-label">Describe an event</span>
            <textarea className="ui-input" rows={2} value={text} placeholder="Iran bombs a Chinese port" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); describe(); } }} />
          </label>
          <div className="sw2-links" style={{ marginTop: 8 }}>
            <Button size="sm" variant="primary" icon="sparkle" onClick={describe} disabled={!text.trim()}>Read it</Button>
            <Button size="sm" variant="tertiary" onClick={() => { setText(""); setSpec((s) => ({ ...EMPTY_SPEC, assets: s.assets })); }}>Clear</Button>
          </div>
          <p className="muted small">Words are turned into the choices below by simple keyword matching. Check them, then click countries on the map to add or remove them.</p>

          <Field label="Or start from an example">
            {PRESETS.map((p) => <FilterChip key={p.label} label={p.label} onClick={() => { setText(p.spec.title ?? p.label); setSpec((s) => ({ ...EMPTY_SPEC, assets: s.assets, ...p.spec })); }} />)}
          </Field>

          <div className="ui-field">
            <span className="ui-field-label">Kind of event</span>
            <Select label="Kind of event" value={spec.type} onChange={(t) => set({ type: t })}
              options={[["", "Any kind"], ...v.types.map((t) => [t, humanize(t)] as [string, string])]} />
          </div>
          <div className="ui-field">
            <span className="ui-field-label">How big (1 minor, 5 extreme)</span>
            <Segmented label="Severity" size="sm" value={String(spec.severity)} onChange={(s) => set({ severity: Number(s) })}
              options={[["0", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]} />
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
      </aside>

      <div className="sw2-main">
        <div className="sw2-bar">
          <span className="small muted">Colour: median move of each currency</span>
          <Segmented<Horizon> label="Horizon" size="sm" value={horizon} onChange={setHorizon} options={[["1d", "1 day"], ["1w", "1 week"], ["1m", "1 month"], ["3m", "3 months"]]} />
        </div>
        <WorldMap label={`Median currency move ${horizon} after past events like the scenario`} outlined={outlined}
          fill={(id) => { const c = currencyOf(id); return divergingFill(c && n ? impact[c]?.median ?? null : null, IMPACT_SCALE[horizon]); }}
          card={card} onSelect={clickCountry}
          legend={<MapLegend title={`Median move against the dollar, ${horizon} after`} low={signed(-IMPACT_SCALE[horizon], 0)} high={signed(IMPACT_SCALE[horizon], 0)} />} />

        <div className="sw2-honest-bar" role="note">
          <strong>History, not a forecast.</strong>{" "}
          {empty ? "Describe an event or click a country to begin."
            : n === 0 ? "No past event in the catalog looks like this. Try fewer details or a broader region."
            : <>These ranges come from {n} past event{n === 1 ? "" : "s"} that look like your scenario{n < 5 ? ", which is too few to lean on" : ""}. Another handful could tell a different story, and the events did not cause everything that followed.</>}
        </div>

        {n > 0 && (
          <>
            <div className="sw2-stats"><Grid cols={4}>
              <Stat label="Past events that match" value={n} sub={n < 5 ? "Too few to lean on" : undefined} />
              <Stat label="Earliest" value={fmt.date([...matches].sort((a, b) => a.event.date.localeCompare(b.event.date))[0].event.date)} />
              <Stat label="Latest" value={fmt.date([...matches].sort((a, b) => b.event.date.localeCompare(a.event.date))[0].event.date)} />
              <Stat label="Prices up to" value={data.data_through ? fmt.date(data.data_through) : "n/a"} />
            </Grid></div>

            <h2 className="sw2-h2">Range of outcomes, day by day</h2>
            <p className="muted small">Day 0 is the last close before each event. The bold line is the middle outcome, the dark band the middle half, the light band the full range, and faint lines single events.</p>
            <Grid cols={2}>
              {assets.map((a, i) => {
                const g = aggregate(matches, a.key, "1m");
                return (
                  <Panel key={a.key} title={a.label} footer={<span className="muted small">{a.note}. {g ? sentence(a.label, g.up, g.n, fmtChange(g.median, a.measure), "1m") : "No data for these events."}</span>}>
                    <FanChart label={`${a.label} after past events like this`} bands={pathBands(matches, a.key)} color={`var(--series-${(i % 8) + 1})`} markers={markers}
                      paths={matches.filter((x) => x.event.paths[a.key]?.length).map((x) => ({ name: x.event.id, values: x.event.paths[a.key] }))}
                      format={(val) => fmtChange(val, a.measure)} tickFormat={(val) => fmtChange(val, a.measure, 0)} height={200} />
                  </Panel>
                );
              })}
              {fxCodes.map((code, i) => {
                const { bands, paths } = worldBands(data, matches, code);
                const im = medianImpact(data, matches, "1m")[code];
                return (
                  <Panel key={code} title={`${label[code] ?? code} (${code})`} footer={<span className="muted small">Value in US dollars, every 3rd trading day. {im ? sentence(label[code] ?? code, im.up, im.n, signed(im.median), "1m", true) : ""}</span>}>
                    <FanChart label={`${code} after past events like this`} bands={bands} paths={paths} step={data.event_path_step} color={`var(--series-${((i + assets.length) % 8) + 1})`}
                      markers={markers} format={(val) => signed(val)} tickFormat={(val) => signed(val, 0)} height={200} />
                  </Panel>
                );
              })}
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
          </>
        )}
      </div>
    </div>
  );
}

function sentence(name: string, up: number, n: number, median: string, h: HorizonKey, fx = false): ReactNode {
  return <>{name} was {fx ? "stronger against the dollar" : "higher"} {HORIZON_WORDS[h]} in {up} of {n}; the middle outcome was {median}.</>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      <div className="chips" style={{ marginBottom: 0, alignItems: "center" }}>{children}</div>
    </div>
  );
}
