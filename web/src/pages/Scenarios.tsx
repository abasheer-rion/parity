// Scenario simulator: type a made-up event, see what markets did after past events
// that look like it. Historical analogues only; it does not predict anything.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Title } from "../components/Shell";
import {
  Badge, Button, ButtonGroup, DataTable, EmptyState, FanChart, FilterChip, Grid, PageSkeleton, Panel, Segmented, Select, Stat, fmt, toast,
  type Column,
} from "../ui";
import { useDocs } from "../lib/docs";
import {
  aggregate, assetColors, DEFAULT_ASSETS, EMPTY_SPEC, fmtChange, humanize, loadScenarios, pathBands, PRESETS, readSaved,
  selectAnalogues, specFromQuery, specToQuery, writeSaved,
  type Agg, type HorizonKey, type Loaded, type Match, type Saved, type ScenarioAsset, type ScenarioData, type Spec,
} from "../lib/scenarios";

export function Scenarios() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => { loadScenarios().then(setLoaded); }, []);

  return (
    <>
      <div className="page-head">
        <Title>Scenarios</Title>
        <p>
          This does not predict the future. It shows what markets did after past events that look like your scenario.
          Describe an event, and the page finds similar ones from history and lines up how oil, currencies, stocks, fear
          and interest rates moved in the days and months after each.
        </p>
      </div>
      {!loaded && <PageSkeleton parts={["chart", "table"]} label="Loading past events" />}
      {loaded?.status === "missing" && (
        <EmptyState title="No scenario data yet" icon="database">
          The list of past events and market reactions has not been built. {loaded.message}
        </EmptyState>
      )}
      {loaded?.status === "error" && <div className="error">{loaded.message}</div>}
      {loaded?.status === "ok" && <Simulator data={loaded.data} />}
    </>
  );
}

function initialSpec(data: ScenarioData): Spec {
  const q = window.location.hash.split("?")[1] ?? "";
  const s = specFromQuery(q) ?? EMPTY_SPEC;
  return clean(s, data);
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
  const [spec, setSpec] = useState<Spec>(() => initialSpec(data));
  const set = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));

  // Keep the scenario in the address, so a link or a bookmark reopens it. replaceState
  // does not fire hashchange, so the page does not reload or jump.
  useEffect(() => {
    const q = specToQuery(spec);
    const next = `#/scenarios${q ? `?${q}` : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [spec]);

  const matches = useMemo(() => selectAnalogues(data, spec), [data, spec]);
  const assets = spec.assets.map((k) => data.assets.find((a) => a.key === k)).filter((a): a is ScenarioAsset => !!a);
  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;

  return (
    <>
      <Builder data={data} spec={spec} set={set} setSpec={setSpec} />
      {empty ? (
        <EmptyState title="Describe a scenario to start" icon="compass">
          Pick a kind of event, where it happens or who is involved, or start from one of the examples above.
        </EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState title="No past events look like this" icon="search">
          Try fewer details, a lower match threshold, or a broader region.
        </EmptyState>
      ) : (
        <Results data={data} spec={spec} matches={matches} assets={assets} />
      )}
    </>
  );
}

// --- The scenario builder ----------------------------------------------------------

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="ui-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span className="ui-field-label">{label}</span>
      <div className="chips" style={{ marginBottom: 0, alignItems: "center" }}>{children}</div>
    </div>
  );
}

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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

  const applyPreset = (p: Partial<Spec>) => setSpec(clean({ ...EMPTY_SPEC, assets: spec.assets, ...p }, data));

  const save = () => {
    const title = spec.title.trim() || "Untitled scenario";
    const next = [{ id: String(Date.now()), savedAt: new Date().toISOString(), spec: { ...spec, title } }, ...saved.filter((s) => s.spec.title !== title)].slice(0, 30);
    setSaved(next);
    if (writeSaved(next)) toast(`Saved "${title}" in this browser`);
    else toast("This browser blocks storage, so the scenario was not saved. The link in the address bar still reopens it.");
  };
  const remove = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    writeSaved(next);
  };

  return (
    <Panel title="Your scenario" actions={<ButtonGroup>
      <Button size="sm" icon="bookmark" onClick={save}>Save</Button>
      <Button size="sm" variant="tertiary" onClick={() => setSpec({ ...EMPTY_SPEC, assets: spec.assets })}>Clear</Button>
    </ButtonGroup>}>
      <div className="ui-field" style={{ marginBottom: 14 }}>
        <span className="ui-field-label">Examples</span>
        <div className="chips" style={{ marginBottom: 0 }}>
          {PRESETS.map((p) => <FilterChip key={p.label} label={p.label} icon="sparkle" onClick={() => applyPreset(p.spec)} />)}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <label className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span className="ui-field-label">Name it (only for you; the match uses the choices below)</span>
          <input className="ui-input" value={spec.title} placeholder="Iran bombs China" onChange={(e) => set({ title: e.target.value })} />
        </label>

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

        <Field label="Where" wide>
          {v.regions.map((r) => (
            <FilterChip key={r} label={humanize(r)} active={spec.regions.includes(r)}
              onClick={() => set({ regions: toggleIn(spec.regions, r) })} onRemove={() => set({ regions: toggleIn(spec.regions, r) })} />
          ))}
        </Field>

        <Field label="Who is involved" wide>
          {spec.actors.map((a) => (
            <FilterChip key={a} label={humanize(a)} active onClick={() => set({ actors: toggleIn(spec.actors, a) })} onRemove={() => set({ actors: toggleIn(spec.actors, a) })} />
          ))}
          <input className="ui-input" style={{ width: 200 }} list="scenario-actors" value={actorDraft} placeholder="Add a country or group"
            aria-label="Add a country or group" onChange={(e) => setActorDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addActor(); } }} />
          <datalist id="scenario-actors">{v.actors.filter((a) => !spec.actors.includes(a)).map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</datalist>
          <Button size="sm" icon="plus" onClick={addActor} disabled={!actorDraft.trim()}>Add</Button>
        </Field>

        <Field label="Commodities at risk" wide>
          {v.commodities.map((c) => (
            <FilterChip key={c} label={humanize(c)} active={spec.commodities.includes(c)}
              onClick={() => set({ commodities: toggleIn(spec.commodities, c) })} onRemove={() => set({ commodities: toggleIn(spec.commodities, c) })} />
          ))}
        </Field>

        <Field label="Markets to show" wide>
          {data.assets.map((a) => (
            <FilterChip key={a.key} active={spec.assets.includes(a.key)}
              label={<>{colors[a.key] && <span className="swatch" style={{ background: colors[a.key] }} />}{a.label}</>}
              onClick={() => set({ assets: toggleIn(spec.assets, a.key) })} onRemove={() => set({ assets: toggleIn(spec.assets, a.key) })} />
          ))}
        </Field>

        <div className="ui-field">
          <span className="ui-field-label">How close a match to keep</span>
          <Select label="Minimum match" value={String(spec.minScore ?? m.min_score)} onChange={(s) => set({ minScore: Number(s) === m.min_score ? null : Number(s) })}
            options={uniq([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, m.min_score]).map((x) => [String(x), `At least ${Math.round(x * 100)}% alike${x === m.min_score ? " (default)" : ""}`] as [string, string])} />
        </div>
        <div className="ui-field">
          <span className="ui-field-label">Most past events to use</span>
          <Select label="Most past events" value={String(spec.maxCount ?? m.max_analogues)} onChange={(s) => set({ maxCount: Number(s) === m.max_analogues ? null : Number(s) })}
            options={uniq([5, 10, 15, 20, 30, 50, m.max_analogues]).map((x) => [String(x), `${x}${x === m.max_analogues ? " (default)" : ""}`] as [string, string])} />
        </div>
      </div>

      {saved.length > 0 && (
        <div className="ui-field" style={{ marginTop: 16 }}>
          <span className="ui-field-label">Saved in this browser</span>
          <div className="chips" style={{ marginBottom: 0 }}>
            {saved.map((s) => (
              <FilterChip key={s.id} label={s.spec.title} icon="bookmark" active onClick={() => setSpec(clean(s.spec, data))} onRemove={() => remove(s.id)} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

// --- Results -------------------------------------------------------------------------

const HORIZON_WORDS: Record<HorizonKey, string> = { "1d": "one day later", "1w": "one week later", "1m": "one month later", "3m": "three months later" };

function upWord(a: ScenarioAsset): string {
  return a.group === "currencies" && a.key !== "usd" ? "stronger against the dollar" : "higher";
}

function Results({ data, spec, matches, assets }: { data: ScenarioData; spec: Spec; matches: Match[]; assets: ScenarioAsset[] }) {
  const n = matches.length;
  const dates = matches.map((x) => x.event.date).sort();
  const horizons = data.horizons;
  const docs = useDocs();
  const methodDoc = docs?.docs.find((d) => /scenario-simulator-method/.test(d.path) || /scenario simulator/i.test(d.title));
  const methodHref = methodDoc ? `#/doc/${methodDoc.id}` : "#/docs/type/reference";
  const markers = horizons.filter((h) => h.days > 1).map((h) => ({ day: h.days, label: h.key }));
  const colors = assetColors(data, spec.assets);
  const [detail, setDetail] = useState<"full" | "median">("full");
  const main: HorizonKey = horizons.some((h) => h.key === "1m") ? "1m" : horizons[0]?.key ?? "1m";

  return (
    <>
      <div style={{ margin: "24px 0 8px" }}>
        <h2 style={{ margin: 0 }}>{spec.title.trim() || "Your scenario"}</h2>
        <p className="muted small" style={{ margin: "4px 0 0" }}>
          {[spec.type && humanize(spec.type), spec.regions.map(humanize).join(", "), spec.actors.map(humanize).join(", "), spec.severity ? `size ${spec.severity} of 5` : "", spec.commodities.length ? `${spec.commodities.map(humanize).join(", ")} at risk` : ""].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}><Grid cols={4}>
        <Stat label="Past events that match" value={n} sub={n < 5 ? "Too few to lean on" : undefined} />
        <Stat label="Earliest" value={fmt.date(dates[0])} />
        <Stat label="Latest" value={fmt.date(dates[dates.length - 1])} />
        <Stat label="Market data up to" value={data.data_through ? fmt.date(data.data_through) : "n/a"} />
      </Grid></div>

      {n < 5 && (
        <p className="warning" style={{ margin: "16px 0" }}>
          Only {n} past event{n === 1 ? "" : "s"} matched. With so few, one unusual event can swing every number below. Treat
          this as a few stories, not a pattern.
        </p>
      )}

      <div style={{ marginBottom: 20 }}><Grid cols={2}>
        <Panel title="What history suggests">
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {assets.map((a) => <li key={a.key}>{sentence(a, aggregate(matches, a.key, main), main)}</li>)}
          </ul>
        </Panel>
        <Panel title="What it cannot tell you" footer={<a href={methodHref} data-doc={methodDoc?.id}>How the matching works</a>}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li><strong>Small samples.</strong> These numbers come from {n} event{n === 1 ? "" : "s"}. A different handful could tell a different story.</li>
            <li><strong>Every event is different.</strong> Two strikes in the same region can have nothing else in common.</li>
            <li><strong>Markets often move first.</strong> When an event was expected, prices had already moved before the day we start counting from.</li>
            <li><strong>The world changes.</strong> Oil and the dollar behaved differently in 1990 than in 2024.</li>
            <li><strong>Only remembered events.</strong> The list holds events people wrote about. Scares that came to nothing are mostly missing.</li>
            <li><strong>No cause and effect.</strong> Other news happened in the same weeks. This shows what followed, not what the event caused.</li>
          </ul>
        </Panel>
      </Grid></div>

      <Panel title="What markets did next" actions={<Segmented size="sm" label="Detail" value={detail} onChange={setDetail} options={[["full", "With spread"], ["median", "Middle only"]]} />}>
        <ReactionTable data={data} matches={matches} assets={assets} colors={colors} view={detail} />
        <p className="muted small" style={{ margin: "12px 0 0" }}>
          Each cell: the middle outcome (median), the middle half of outcomes, how often it went up, and the median size of the
          move compared with a normal move for that market over the same length of time (1 is a typical move, 2 is unusually big).
          Currencies are their value in US dollars, so up means that currency got stronger against the dollar. Gold is not in our
          data, so it is not shown.
        </p>
      </Panel>

      <h2 style={{ margin: "28px 0 4px" }}>Day by day after each event</h2>
      <p className="muted small" style={{ margin: "0 0 12px" }}>
        Day 0 is the last close before the event. Faint lines are single events; the dark band holds the middle half, the light
        band the full range, and the bold line the middle outcome.
      </p>
      <div style={{ marginBottom: 20 }}><Grid cols={2}>
        {assets.map((a) => {
          const color = colors[a.key];
          const bands = pathBands(matches, a.key);
          const paths = matches.filter((x) => x.event.paths[a.key]?.length).map((x) => ({ name: x.event.id, values: x.event.paths[a.key] }));
          return (
            <Panel key={a.key} title={<><span className="swatch" style={{ background: color }} />{a.label}</>}
              footer={<span className="muted small">{a.note}{a.note && !a.note.endsWith(".") ? "." : ""}{a.first ? ` Data from ${fmt.date(a.first)}.` : ""}</span>}>
              <FanChart label={`${a.label} after past events like this`} bands={bands} paths={paths} color={color} markers={markers}
                format={(val) => fmtChange(val, a.measure)} tickFormat={(val) => fmtChange(val, a.measure, 0)} />
            </Panel>
          );
        })}
      </Grid></div>

      <Panel title={`The ${n} past event${n === 1 ? "" : "s"}`}>
        <ol className="scenario-events" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 18 }}>
          {matches.map(({ event: e, score: s }) => (
            <li key={e.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                <strong>{e.name}</strong>
                <span className="muted small">{fmt.date(e.date)}</span>
                <Badge>{humanize(e.type)}</Badge>
                <Badge>Size {e.severity} of 5</Badge>
                <Badge tone="accent">{Math.round(s * 100)}% alike</Badge>
              </div>
              <p style={{ margin: "6px 0", color: "var(--text-2)" }}>{e.description}</p>
              <div className="chips" style={{ marginBottom: 4 }}>
                {assets.map((a) => {
                  const c = e.reactions[a.key]?.[main]?.change;
                  return (
                    <span key={a.key} className="tag">
                      <span className="swatch" style={{ background: colors[a.key] }} />{a.label} {main}: <span className="ui-tab">{fmtChange(c, a.measure)}</span>
                    </span>
                  );
                })}
              </div>
              {e.sources.length > 0 && (
                <div className="small muted">
                  Sources: {e.sources.map((src, i) => (
                    <span key={src.url}>{i > 0 && " · "}<a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>{src.publisher && ` (${src.publisher})`}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

function sentence(a: ScenarioAsset, g: Agg | null, h: HorizonKey): ReactNode {
  if (!g) return <>No {a.label} data for these events.</>;
  const range = `${fmtChange(g.min, a.measure, 0)} to ${fmtChange(g.max, a.measure, 0)}`;
  return (
    <>
      In {g.n} past event{g.n === 1 ? "" : "s"} like this, <strong>{a.label}</strong> was {upWord(a)} {HORIZON_WORDS[h]} in {g.up} of {g.n}.
      The middle outcome was <span className="ui-tab">{fmtChange(g.median, a.measure)}</span>
      {g.n > 1 ? <>, but the range ran from <span className="ui-tab">{range}</span>.</> : "."}
    </>
  );
}

interface Row { asset: ScenarioAsset; cells: Record<string, Agg | null> }

function ReactionTable({ data, matches, assets, colors, view }: { data: ScenarioData; matches: Match[]; assets: ScenarioAsset[]; colors: Record<string, string>; view: "full" | "median" }) {
  const rows: Row[] = assets.map((asset) => ({ asset, cells: Object.fromEntries(data.horizons.map((h) => [h.key, aggregate(matches, asset.key, h.key)])) }));
  const columns: Column<Row>[] = [
    {
      key: "asset", header: "Market", align: "left", sort: (r) => r.asset.label,
      render: (r) => <><span className="swatch" style={{ background: colors[r.asset.key] }} />{r.asset.label}</>,
    },
    ...data.horizons.map((h): Column<Row> => ({
      key: h.key, header: h.label, sort: (r) => r.cells[h.key]?.median, tone: (r) => r.cells[h.key]?.median,
      render: (r) => {
        const g = r.cells[h.key];
        if (!g) return <span className="muted">n/a</span>;
        return (
          <div className="ui-tab" style={{ lineHeight: 1.35 }}>
            <div style={{ fontWeight: 600 }}>{fmtChange(g.median, r.asset.measure)}</div>
            {view === "full" && (
              <div className="small muted" style={{ whiteSpace: "nowrap" }}>
                <div>{fmtChange(g.q25, r.asset.measure)} to {fmtChange(g.q75, r.asset.measure)}</div>
                <div>up in {g.up} of {g.n}{g.medianZ != null ? ` · ${Math.abs(g.medianZ).toFixed(1)}x normal` : ""}</div>
              </div>
            )}
          </div>
        );
      },
    })),
  ];
  return (
    <DataTable rows={rows} rowKey={(r) => r.asset.key} columns={columns} initialSort={{ key: "asset", dir: "asc" }} caption="What markets did after past events like this" />
  );
}
