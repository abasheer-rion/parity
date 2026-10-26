// What if (DEC-0043): describe an event, see the past events that look like it and what
// markets did in the days and months after each. Historical analogues only; nothing is
// predicted. The scenario lives in the address (#/whatif?type=war&r=middle_east), so a
// link reopens it; saved scenarios stay in this browser.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDocs } from "../lib/docs";
import {
  aggregate, assetColors, DEFAULT_ASSETS, EMPTY_SPEC, fmtChange, humanize, loadScenarios, pathBands, PRESETS, readSaved,
  selectAnalogues, specFromQuery, specToQuery, writeSaved,
  type Agg, type HorizonKey, type Loaded, type Match, type Saved, type ScenarioAsset, type ScenarioData, type Spec,
} from "../lib/scenarios";
import { researchUrl } from "../lib/space";
import { Badge, DataTable, FanChart, FilterChip, Icon, Popover, Segmented, Select, Tooltip, fmt, toast, useResource, type Column, Button } from "../ui";

export function WhatIfView() {
  const loaded = useResource<Loaded | null>("scenarios", loadScenarios).data ?? null;
  if (!loaded) return <div className="lb-msg lb-loading" aria-busy="true">Loading past events</div>;
  if (loaded.status === "missing") return <div className="lb-msg">No scenario data yet. {loaded.message}</div>;
  if (loaded.status === "error") return <div className="lb-msg">{loaded.message}</div>;
  return <Simulator data={loaded.data} />;
}

/** Keep only values the file knows about (actors may be new, so they stay). */
function clean(s: Spec, data: ScenarioData): Spec {
  const v = data.vocab;
  const keys = data.assets.map((a) => a.key);
  const assets = s.assets.filter((a) => keys.includes(a));
  return {
    ...s,
    type: v.types.includes(s.type) ? s.type : "",
    regions: s.regions.filter((r) => v.regions.includes(r)),
    commodities: s.commodities.filter((c) => v.commodities.includes(c)),
    actors: [...new Set(s.actors.map((a) => a.trim().toLowerCase()).filter(Boolean))],
    assets: assets.length ? assets : DEFAULT_ASSETS.filter((a) => keys.includes(a)),
  };
}

function Simulator({ data }: { data: ScenarioData }) {
  const [spec, setSpec] = useState<Spec>(() => clean(specFromQuery(window.location.hash.split("?")[1] ?? "") ?? EMPTY_SPEC, data));
  const set = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));

  // replaceState does not fire hashchange, so the page does not reload or jump.
  useEffect(() => {
    const q = specToQuery(spec);
    const next = `#/whatif${q ? `?${q}` : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
  }, [spec]);

  const matches = useMemo(() => selectAnalogues(data, spec), [data, spec]);
  const assets = spec.assets.map((k) => data.assets.find((a) => a.key === k)).filter((a): a is ScenarioAsset => !!a);
  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;

  return (
    <div className="lb-split">
      <Builder data={data} spec={spec} set={set} setSpec={setSpec} />
      <section className="lb-pane" aria-label="Past events like this">
        {empty ? <div className="lb-msg">Pick a kind of event, a region or who is involved, or start from an example.</div>
          : matches.length === 0 ? <div className="lb-msg">No past events look like this. Try fewer details or a lower match threshold.</div>
          : <Results data={data} spec={spec} matches={matches} assets={assets} />}
      </section>
    </div>
  );
}

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div className="lb-group"><span className="lb-sub">{label}</span><div className="lb-chips">{children}</div></div>;
}

function Builder({ data, spec, set, setSpec }: { data: ScenarioData; spec: Spec; set: (p: Partial<Spec>) => void; setSpec: (s: Spec) => void }) {
  const [actorDraft, setActorDraft] = useState("");
  const [saved, setSaved] = useState<Saved[]>(() => readSaved());
  const v = data.vocab;
  const m = data.matcher;
  const colors = assetColors(data, spec.assets);

  const addActor = () => {
    const a = actorDraft.trim().toLowerCase().replace(/\s+/g, "_");
    if (a && !spec.actors.includes(a)) set({ actors: [...spec.actors, a] });
    setActorDraft("");
  };
  const save = () => {
    const title = spec.title.trim() || "Untitled scenario";
    const next = [{ id: String(Date.now()), savedAt: new Date().toISOString(), spec: { ...spec, title } }, ...saved.filter((s) => s.spec.title !== title)].slice(0, 30);
    setSaved(next);
    if (writeSaved(next)) toast(`Saved "${title}" in this browser`);
    else toast("This browser blocks storage. Copy link still reopens the scenario.");
  };
  const remove = (id: string) => { const next = saved.filter((s) => s.id !== id); setSaved(next); writeSaved(next); };

  return (
    <aside className="lb-side lb-form" aria-label="Scenario">
      <div className="lb-row">
        <Button size="xs" icon="bookmark" onClick={save}>Save</Button>
        <Button size="xs" variant="ghost" onClick={() => setSpec({ ...EMPTY_SPEC, assets: spec.assets })}>Clear</Button>
      </div>
      <Group label="Examples">
        {PRESETS.map((p) => <FilterChip key={p.label} label={p.label} onClick={() => setSpec(clean({ ...EMPTY_SPEC, assets: spec.assets, ...p.spec }, data))} />)}
      </Group>
      <label className="lb-field">
        <span>Name (only for you)</span>
        <input className="lb-input" value={spec.title} placeholder="Iran bombs China"  onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="lb-field">
        <span>Kind of event</span>
        <Select label="Kind of event" value={spec.type} onChange={(t) => set({ type: t })} options={[["", "Any kind"], ...v.types.map((t) => [t, humanize(t)] as [string, string])]} />
      </div>
      <div className="lb-field">
        <span>Size, 1 minor to 5 extreme</span>
        <Segmented label="Size" size="sm" value={String(spec.severity)} onChange={(s) => set({ severity: Number(s) })}
          options={[["0", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]} />
      </div>
      <Group label="Where">
        {v.regions.map((r) => <FilterChip key={r} label={humanize(r)} active={spec.regions.includes(r)} onClick={() => set({ regions: toggleIn(spec.regions, r) })} />)}
      </Group>
      <Group label="Who is involved">
        {spec.actors.map((a) => <FilterChip key={a} label={humanize(a)} active onClick={() => set({ actors: toggleIn(spec.actors, a) })} onRemove={() => set({ actors: toggleIn(spec.actors, a) })} />)}
        <span className="lb-addrow">
          <input className="lb-input" list="lab-actors" value={actorDraft} placeholder="Add a country or group" aria-label="Add a country or group"
            onChange={(e) => setActorDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addActor(); } }} />
          <datalist id="lab-actors">{v.actors.filter((a) => !spec.actors.includes(a)).map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</datalist>
          <Button size="xs" onClick={addActor} disabled={!actorDraft.trim()}>Add</Button>
        </span>
      </Group>
      <Group label="Commodities at risk">
        {v.commodities.map((c) => <FilterChip key={c} label={humanize(c)} active={spec.commodities.includes(c)} onClick={() => set({ commodities: toggleIn(spec.commodities, c) })} />)}
      </Group>
      <Group label="Markets to show">
        {data.assets.map((a) => (
          <FilterChip key={a.key} active={spec.assets.includes(a.key)}
            label={<>{colors[a.key] && <span className="swatch" style={{ background: colors[a.key] }} />}{a.label}</>}
            onClick={() => set({ assets: toggleIn(spec.assets, a.key) })} />
        ))}
      </Group>
      <div className="lb-field">
        <span>Closest match to keep</span>
        <Select label="Minimum match" value={String(spec.minScore ?? m.min_score)} onChange={(s) => set({ minScore: Number(s) === m.min_score ? null : Number(s) })}
          options={uniq([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, m.min_score]).map((x) => [String(x), `${Math.round(x * 100)}% alike or more${x === m.min_score ? " (default)" : ""}`] as [string, string])} />
      </div>
      <div className="lb-field">
        <span>Most past events</span>
        <Select label="Most past events" value={String(spec.maxCount ?? m.max_analogues)} onChange={(s) => set({ maxCount: Number(s) === m.max_analogues ? null : Number(s) })}
          options={uniq([5, 10, 15, 20, 30, 50, m.max_analogues]).map((x) => [String(x), `${x}${x === m.max_analogues ? " (default)" : ""}`] as [string, string])} />
      </div>
      {saved.length > 0 && (
        <Group label="Saved in this browser">
          {saved.map((s) => <FilterChip key={s.id} label={s.spec.title} icon="bookmark" active onClick={() => setSpec(clean(s.spec, data))} onRemove={() => remove(s.id)} />)}
        </Group>
      )}
    </aside>
  );
}

const HORIZON_WORDS: Record<HorizonKey, string> = { "1d": "one day later", "1w": "one week later", "1m": "one month later", "3m": "three months later" };
const upWord = (a: ScenarioAsset) => (a.group === "currencies" && a.key !== "usd" ? "stronger against the dollar" : "higher");

const LIMITS: [string, string][] = [
  ["Small samples.", "A different set of events could give different numbers."],
  ["Every event is different.", "Two strikes in the same region can have nothing else in common."],
  ["Markets often move first.", "When an event was expected, prices had moved before day 0."],
  ["The world changes.", "Oil and the dollar behaved differently in 1990 than in 2024."],
  ["Only remembered events.", "Scares that came to nothing are mostly missing."],
  ["No cause and effect.", "Other news happened in the same weeks. This shows what followed, not what the event caused."],
];

function Results({ data, spec, matches, assets }: { data: ScenarioData; spec: Spec; matches: Match[]; assets: ScenarioAsset[] }) {
  const n = matches.length;
  const dates = matches.map((x) => x.event.date).sort();
  const horizons = data.horizons;
  const docs = useDocs();
  const methodDoc = docs?.docs.find((d) => /scenario-simulator-method/.test(d.path) || /scenario simulator/i.test(d.title));
  const markers = horizons.filter((h) => h.days > 1).map((h) => ({ day: h.days, label: h.key }));
  const colors = assetColors(data, spec.assets);
  const [detail, setDetail] = useState<"full" | "median">("full");
  const main: HorizonKey = horizons.some((h) => h.key === "1m") ? "1m" : horizons[0]?.key ?? "1m";
  const what = [spec.type && humanize(spec.type), spec.regions.map(humanize).join(", "), spec.actors.map(humanize).join(", "), spec.severity ? `size ${spec.severity} of 5` : "", spec.commodities.length ? `${spec.commodities.map(humanize).join(", ")} at risk` : ""].filter(Boolean).join(" · ");

  return (
    <>
      <div className="lb-bar">
        <strong className="lb-title">{spec.title.trim() || "Your scenario"}</strong>
        <span className="lb-dim">{what}</span>
        <span className="lb-gap" />
        <Popover label="Limits" width={360} placement="bottom-end" trigger={() => <Button size="xs" icon="info">Limits</Button>}>
          <div className="lb-pop">
            <ul>{LIMITS.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}</ul>
            {methodDoc && <a href={researchUrl(`#/doc/${methodDoc.id}`)} target="_blank" rel="noopener">How the matching works<Icon name="arrowUpRight" size={12} /></a>}
          </div>
        </Popover>
      </div>
      <dl className="lb-stats">
        <div><dt>Past events that match</dt><dd className={n < 5 ? "bad" : ""}>{n}</dd><dd className="lb-dim">{n < 5 ? "too few to rely on" : " "}</dd></div>
        <div><dt>Earliest</dt><dd>{fmt.date(dates[0])}</dd></div>
        <div><dt>Latest</dt><dd>{fmt.date(dates[dates.length - 1])}</dd></div>
        <div><dt>Market data up to</dt><dd>{data.data_through ? fmt.date(data.data_through) : "n/a"}</dd></div>
      </dl>

      <div className="lb-box">
        <div className="lb-box-h"><span>What followed, {HORIZON_WORDS[main]}</span></div>
        <ul className="lb-sentences">{assets.map((a) => <li key={a.key}>{sentence(a, aggregate(matches, a.key, main), main)}</li>)}</ul>
      </div>

      <div className="lb-box lb-flush">
        <div className="lb-box-h">
          <span>What markets did next <Tooltip text="Each cell: the middle outcome, the middle half of outcomes, how often it went up, and the move against a normal move for that market over the same time (1x is typical). Currencies are priced in US dollars, so up means stronger against the dollar."><span className="lb-tip-i" tabIndex={0} role="img" aria-label="What the cells show"><Icon name="info" size={12} /></span></Tooltip></span>
          <Segmented size="sm" label="Detail" value={detail} onChange={setDetail} options={[["full", "With spread"], ["median", "Middle only"]]} />
        </div>
        <ReactionTable data={data} matches={matches} assets={assets} colors={colors} view={detail} />
      </div>

      <div className="lb-fans">
        {assets.map((a) => {
          const bands = pathBands(matches, a.key);
          const paths = matches.filter((x) => x.event.paths[a.key]?.length).map((x) => ({ name: x.event.id, values: x.event.paths[a.key] }));
          return (
            <div key={a.key} className="lb-box">
              <div className="lb-box-h"><span><span className="swatch" style={{ background: colors[a.key] }} />{a.label}</span><span className="lb-dim">day 0 = last close before</span></div>
              <FanChart label={`${a.label} after past events like this`} bands={bands} paths={paths} color={colors[a.key]} markers={markers} height={200}
                format={(val) => fmtChange(val, a.measure)} tickFormat={(val) => fmtChange(val, a.measure, 0)} />
            </div>
          );
        })}
      </div>

      <div className="lb-box lb-flush">
        <div className="lb-box-h"><span>The {n} past event{n === 1 ? "" : "s"}</span></div>
        <ol className="lb-events">
          {matches.map(({ event: e, score: s }) => (
            <li key={e.id}>
              <div className="lb-ev-h">
                <strong>{e.name}</strong>
                <span className="lb-dim">{fmt.date(e.date)}</span>
                <Badge>{humanize(e.type)}</Badge>
                <Badge>Size {e.severity} of 5</Badge>
                <Badge tone="accent">{Math.round(s * 100)}% alike</Badge>
              </div>
              <p className="lb-dim">{e.description}</p>
              <div className="lb-chips">
                {assets.map((a) => (
                  <span key={a.key} className="lb-tag"><span className="swatch" style={{ background: colors[a.key] }} />{a.label} {main} <span className="tabular">{fmtChange(e.reactions[a.key]?.[main]?.change, a.measure)}</span></span>
                ))}
              </div>
              {e.sources.length > 0 && (
                <p className="lb-dim lb-src">Sources: {e.sources.map((src, i) => (
                  <span key={src.url}>{i > 0 && " · "}<a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>{src.publisher && ` (${src.publisher})`}</span>
                ))}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function sentence(a: ScenarioAsset, g: Agg | null, h: HorizonKey): ReactNode {
  if (!g) return <>No {a.label} data for these events.</>;
  const range = `${fmtChange(g.min, a.measure, 0)} to ${fmtChange(g.max, a.measure, 0)}`;
  return (
    <>
      <strong>{a.label}</strong> was {upWord(a)} {HORIZON_WORDS[h]} in {g.up} of {g.n}. Middle outcome <span className="tabular">{fmtChange(g.median, a.measure)}</span>
      {g.n > 1 ? <>, range <span className="tabular">{range}</span>.</> : "."}
    </>
  );
}

interface Row { asset: ScenarioAsset; cells: Record<string, Agg | null> }

function ReactionTable({ data, matches, assets, colors, view }: { data: ScenarioData; matches: Match[]; assets: ScenarioAsset[]; colors: Record<string, string>; view: "full" | "median" }) {
  const rows: Row[] = assets.map((asset) => ({ asset, cells: Object.fromEntries(data.horizons.map((h) => [h.key, aggregate(matches, asset.key, h.key)])) }));
  const columns: Column<Row>[] = [
    { key: "asset", header: "Market", align: "left", sort: (r) => r.asset.label, render: (r) => <><span className="swatch" style={{ background: colors[r.asset.key] }} />{r.asset.label}</> },
    ...data.horizons.map((h): Column<Row> => ({
      key: h.key, header: h.label, sort: (r) => r.cells[h.key]?.median, tone: (r) => r.cells[h.key]?.median,
      render: (r) => {
        const g = r.cells[h.key];
        if (!g) return <span className="lb-dim">n/a</span>;
        return (
          <div className="tabular lb-cellstack">
            <div className="lb-strong">{fmtChange(g.median, r.asset.measure)}</div>
            {view === "full" && (
              <div className="lb-dim">
                <div>{fmtChange(g.q25, r.asset.measure)} to {fmtChange(g.q75, r.asset.measure)}</div>
                <div>up {g.up} of {g.n}{g.medianZ != null ? ` · ${Math.abs(g.medianZ).toFixed(1)}x normal` : ""}</div>
              </div>
            )}
          </div>
        );
      },
    })),
  ];
  return <DataTable rows={rows} rowKey={(r) => r.asset.key} columns={columns} initialSort={{ key: "asset", dir: "asc" }} caption="What markets did after past events like this" dense />;
}
