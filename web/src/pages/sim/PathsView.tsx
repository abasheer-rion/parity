// Simulated paths: a block bootstrap of real weekly returns for a basket, from all of
// history or only from the weeks after a scenario's past events. Fan charts, a risk
// table and the paths themselves as CSV. The future is assumed to reshuffle the past.
import { useMemo, useState, type ReactNode } from "react";
import { Button, DataTable, FanChart, FilterChip, Grid, Panel, Segmented, Stat, toast, type Column } from "../../ui";
import type { Match, Spec } from "../../lib/scenarios";
import { analogueMask, bands, bootstrap, risk, toCsv, valueOf, weeklyReturns, type Sim } from "../../lib/paths";
import { Board, leaderOf, Stage, type BoardRow } from "./play/Stage";
import { usePlayback } from "./play/usePlayback";
import { tone } from "./play/data";
import { signed, type WorldData } from "../../lib/world";

type Pool = "all" | "analogues";
const MAX_ASSETS = 6;
const GROUP_LABEL: Record<string, string> = { currencies: "Currencies (value in US dollars)", commodities: "Commodities", stocks: "Stocks", bonds: "Bonds", industries: "US industries", factors: "Research factors (long-short)" };

export function PathsView({ data, basket, setBasket, spec, matches, hasScenario, onScenario }: {
  data: WorldData; basket: string[]; setBasket: (b: string[]) => void; spec: Spec; matches: Match[]; hasScenario: boolean; onScenario: () => void;
}) {
  const weeklyKeys = new Set(Object.keys(data.weekly.series));
  const assets = data.assets.filter((a) => weeklyKeys.has(a.key) && a.kind !== "level");
  const label = Object.fromEntries(assets.map((a) => [a.key, a.label]));
  const keys = basket.filter((k) => weeklyKeys.has(k));
  const [weeks, setWeeks] = useState("26");
  const [n, setN] = useState("1000");
  const [block, setBlock] = useState("4");
  const [seed, setSeed] = useState(7);
  const [lossAt, setLossAt] = useState("10");
  const [poolPick, setPool] = useState<Pool>("all");
  const pool: Pool = poolPick === "analogues" && matches.length ? "analogues" : "all";

  const toggle = (k: string) => {
    if (keys.includes(k)) setBasket(keys.filter((x) => x !== k));
    else if (keys.length >= MAX_ASSETS) toast(`Up to ${MAX_ASSETS} assets at a time.`);
    else setBasket([...keys, k]);
  };

  const keysKey = keys.join(",");
  const result = useMemo(() => {
    if (!keysKey) return null;
    const ret = weeklyReturns(data.weekly, keysKey.split(","));
    if (ret.rows.length < 30) return { error: "These assets share fewer than 30 weeks of history, too few to draw from." } as const;
    const mask = pool === "analogues" ? analogueMask(ret.dates, matches.map((m) => m.event.date), data.analogue_weeks) : undefined;
    if (mask && !mask.some(Boolean)) return { error: "None of the past events falls inside these assets' shared history." } as const;
    try {
      const sim = bootstrap(ret, Number(weeks), Number(n), Number(block), seed, mask);
      return { sim, from: ret.dates[0], to: ret.dates[ret.dates.length - 1] } as const;
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  }, [data, keysKey, weeks, n, block, seed, pool, matches]);

  const sim = result && "sim" in result ? result.sim : null;
  const download = () => {
    if (!sim) return;
    const blob = new Blob([toCsv(sim)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parity-paths-${sim.keys.join("-")}-${sim.weeks}w-seed${seed}${pool === "analogues" ? "-analogues" : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Saved ${sim.n} paths of ${sim.weeks} weeks`);
  };

  const groups = [...new Set(assets.map((a) => a.group))];

  return (
    <div className="sw2-paths">
      <div className="sw2-honest-bar" role="note">
        <strong>Simulated from past weeks. Not a forecast.</strong> Each path strings together random runs of {block} real
        weeks{pool === "analogues" ? ` from the ${data.analogue_weeks} weeks after ${matches.length} past events like your scenario` : " from all shared history"}.
        Every asset moves on the same weeks, so the links between them are kept. The range
        cannot include a move that has not happened before.
      </div>

      <Grid cols={2}>
        <Panel title="Basket">
          <div className="sw2-groups">
          {groups.map((g) => (
            <div className="ui-field" key={g}>
              <span className="ui-field-label">{GROUP_LABEL[g] ?? g}</span>
              <div className="chips" style={{ marginBottom: 0 }}>
                {assets.filter((a) => a.group === g).map((a) => (
                  <FilterChip key={a.key} label={a.group === "currencies" ? a.key : a.label} active={keys.includes(a.key)} onClick={() => toggle(a.key)} onRemove={() => toggle(a.key)} />
                ))}
              </div>
            </div>
          ))}
          </div>
          <p className="muted small">Up to {MAX_ASSETS}. Currencies are their value in US dollars; USD is the dollar against nine others. Stocks and bonds are total return, so they include dividends and interest.</p>
        </Panel>
        <Panel title="Settings">
          <div className="sw2-settings">
            <Setting label="How far ahead">
              <Segmented size="sm" label="Weeks ahead" value={weeks} onChange={setWeeks} options={[["13", "3 months"], ["26", "6 months"], ["52", "1 year"], ["104", "2 years"]]} />
            </Setting>
            <Setting label="Draw weeks from">
              <Segmented<Pool> size="sm" label="Draw from" value={pool} onChange={(p) => { if (p === "analogues" && !matches.length) { onScenario(); return; } setPool(p); }}
                options={[["all", "All history"], ["analogues", hasScenario && matches.length ? `After ${matches.length} past events` : "After past events (set a scenario)"]]} />
            </Setting>
            <Setting label="Weeks per block">
              <Segmented size="sm" label="Block length" value={block} onChange={setBlock} options={[["1", "1"], ["4", "4"], ["8", "8"], ["13", "13"]]} />
            </Setting>
            <Setting label="Number of paths">
              <Segmented size="sm" label="Paths" value={n} onChange={setN} options={[["500", "500"], ["1000", "1,000"], ["2000", "2,000"], ["5000", "5,000"]]} />
            </Setting>
            <Setting label="Count losses over">
              <Segmented size="sm" label="Loss threshold" value={lossAt} onChange={setLossAt} options={[["5", "5%"], ["10", "10%"], ["20", "20%"], ["30", "30%"]]} />
            </Setting>
            <Setting label="Seed">
              <span className="sw2-seed">
                <input className="ui-input" type="number" value={seed} min={0} aria-label="Random seed" onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                <Button size="sm" variant="tertiary" icon="restart" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>New draw</Button>
              </span>
            </Setting>
          </div>
          <p className="muted small">Longer blocks keep more of each period's character (a crash stays a crash) but repeat history more. The same seed gives the same paths in this browser.</p>
        </Panel>
      </Grid>

      {!keys.length && <p className="muted">Pick at least one asset.</p>}
      {result && "error" in result && <p className="warning">{result.error}</p>}
      {sim && result && "sim" in result && (
        <>
          <div className="sw2-stats"><Grid cols={4}>
            <Stat label="Paths" value={sim.n.toLocaleString("en-US")} sub={`${sim.weeks} weeks each`} />
            <Stat label="Weeks drawn from" value={sim.poolWeeks.toLocaleString("en-US")} sub={pool === "analogues" ? "after past events" : `${result.from?.slice(0, 4)} to ${result.to?.slice(0, 4)}`} />
            <Stat label="Block" value={`${sim.block} week${sim.block === 1 ? "" : "s"}`} sub={sim.block < Number(block) ? "shortened to fit the windows" : undefined} />
            <Stat label="Seed" value={seed} />
          </Grid></div>
          {pool === "analogues" && sim.poolWeeks < 60 && (
            <p className="warning">Only {sim.poolWeeks} weeks to draw from, so the paths repeat the same few stretches of history.</p>
          )}
          <PathsStage sim={sim} label={label} lossAt={Number(lossAt)} download={download} resetKey={`${keysKey}-${weeks}-${n}-${block}-${seed}-${pool}`}
            eyebrow={`Simulated paths · ${sim.n.toLocaleString("en-US")} paths of ${sim.weeks} weeks${pool === "analogues" && spec.title ? ` · after events like "${spec.title}"` : ""}`} />
        </>
      )}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const MARKERS = ([[4, "1m"], [13, "3m"], [26, "6m"], [52, "1y"], [104, "2y"]] as [number, string][]);
const RATES = { "1x": 4, "4x": 12, "16x": 48 };

/** The paths drawing in week by week, like the race, with the risk table following along. */
function PathsStage({ sim, label, lossAt, download, resetKey, eyebrow }: {
  sim: Sim; label: Record<string, string>; lossAt: number; download: () => void; resetKey: string; eyebrow: string;
}) {
  const pb = usePlayback(sim.weeks + 1, RATES, resetKey);
  const t = pb.i;
  const lanes = [...sim.keys.map((k, a) => ({ key: k, a, name: label[k] ?? k })), ...(sim.keys.length > 1 ? [{ key: "basket", a: -1, name: "Equal mix of all" }] : [])];
  const [focus, setFocus] = useState<string>(lanes.length > 1 ? "basket" : lanes[0].key);
  const fanBands = useMemo(() => Object.fromEntries(lanes.map((l) => [l.key, bands(sim, l.a)])), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const samples = useMemo(() => Object.fromEntries(lanes.map((l) => [l.key, Array.from({ length: Math.min(8, sim.n) }, (_, p) => ({ name: `path ${p + 1}`, values: Array.from({ length: sim.weeks + 1 }, (_, w) => valueOf(sim, p, w, l.a) - 100) }))])), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const risks = lanes.map((l, i) => ({ ...l, color: l.a < 0 ? "var(--text)" : `var(--series-${(i % 8) + 1})`, r: risk(sim, l.a, lossAt, Math.max(1, t)) }));
  const rows: BoardRow[] = risks.map((x) => ({
    key: x.key, label: x.name, color: x.color, bench: x.a < 0, sort: t === 0 ? null : x.r.median,
    cells: [<span className={tone(x.r.median)}>{t === 0 ? "0%" : signed(x.r.median)}</span>, <span className={tone(x.r.worst5)}>{t === 0 ? "0%" : signed(x.r.worst5, 0)}</span>, t === 0 ? "n/a" : pct(x.r.pLoss)],
  }));
  const markers = MARKERS.filter(([w]) => w <= sim.weeks).map(([day, l]) => ({ day, label: l }));
  const cols: Column<(typeof risks)[number]>[] = [
    { key: "name", header: "Asset", align: "left", render: (r) => r.a < 0 ? <strong>{r.name}</strong> : r.name },
    { key: "median", header: "Middle outcome", sort: (r) => r.r.median, tone: (r) => r.r.median, render: (r) => signed(r.r.median) },
    { key: "mid", header: "Middle half", render: (r) => <span className="nowrap">{signed(r.r.q25)} to {signed(r.r.q75)}</span> },
    { key: "worst5", header: "Worst 5%", sort: (r) => r.r.worst5, tone: (r) => r.r.worst5, render: (r) => signed(r.r.worst5) },
    { key: "tail5", header: "Average of worst 5%", sort: (r) => r.r.tail5, render: (r) => signed(r.r.tail5) },
    { key: "ploss", header: "Chance of a loss", sort: (r) => r.r.pLoss, render: (r) => pct(r.r.pLoss) },
    { key: "pgt", header: `Chance of losing over ${lossAt}%`, sort: (r) => r.r.pLossGt, render: (r) => pct(r.r.pLossGt) },
  ];
  const f = lanes.find((l) => l.key === focus) ?? lanes[0];
  const fi = lanes.indexOf(f);
  const weekWords = t === 0 ? "the start: every path at 100" : t < 9 ? `${t} week${t === 1 ? "" : "s"} ahead` : `about ${Math.round(t / 4.35)} months ahead`;

  return (
    <Stage pb={pb} label="Simulated paths replay" eyebrow={eyebrow} big={`Week ${t}`} sub={[weekWords]}
      leading={leaderOf(rows)} bands={markers.map((m) => ({ label: m.label, a: m.day, b: m.day }))} startLabel="Week 0" endLabel={`Week ${sim.weeks}`}
      valueText={(i) => `Week ${i}`}
      controls={<Button size="sm" icon="download" onClick={download}>Export CSV</Button>}
      honest={<>Each path is real past weeks in a random order, so it cannot contain a move that never happened.</>}
      visual={
        <div className="pb-fan">
          <div className="pb-curve-head"><span>{f.name}: simulated range, week by week</span></div>
          <FanChart label={`${f.name}, simulated paths`} bands={fanBands[f.key]} paths={samples[f.key]} color={f.a < 0 ? "var(--series-1)" : `var(--series-${(fi % 8) + 1})`}
            unit="week" countLabel="simulated path" outerLabel="90 in 100 paths" markers={markers} upTo={t}
            format={(v) => signed(v)} tickFormat={(v) => signed(v, 0)} height={300} />
        </div>
      }
      board={<Board rows={rows} name="Asset" headers={["Median", "Worst 5%", "Loss"]} picked={focus} onPick={setFocus} playing={pb.playing}
        caption="At the week shown: the middle path, the 1-in-20 bad case and the chance of being below the start. Click a row to chart it." />}
      below={
        <div className="pb-below">
          <Panel title={`Risk at week ${Math.max(1, t)}`} actions={<Button size="sm" icon="download" onClick={download}>Export paths as CSV</Button>}>
            <DataTable rows={risks} rowKey={(r) => r.key} columns={cols} caption={`Risk after ${Math.max(1, t)} weeks, ${sim.n} simulated paths`} initialSort={{ key: "name", dir: "asc" }} pin={(r) => r.a < 0} />
            <p className="muted small" style={{ margin: "10px 0 0" }}>
              Change from today's level. Worst 5% means 1 path in 20 did this badly or worse; the average of the worst 5% is how
              bad those paths were on average. The CSV has one row per path and week, starting at 100, the same layout as <code>parity world paths</code>.
            </p>
          </Panel>
          <Grid cols={2}>
            {lanes.map((l, i) => (
              <Panel key={l.key} title={l.name}>
                <FanChart label={`${l.name}, simulated paths`} bands={fanBands[l.key]} paths={samples[l.key]} color={`var(--series-${(i % 8) + 1})`} unit="week"
                  countLabel="simulated path" outerLabel="90 in 100 paths" markers={markers} upTo={t} format={(v) => signed(v)} tickFormat={(v) => signed(v, 0)} height={200} />
              </Panel>
            ))}
          </Grid>
        </div>
      }
    />
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
    </div>
  );
}


