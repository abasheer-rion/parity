// MC, Monte Carlo stress test (DEC-0066): up to four mixes run through the same simulated
// paths built from 13-week blocks of real weekly returns, with a real crash spliced in when
// asked. Shows the spread of end values, the worst falls and how long they took to make
// back, side by side, and replays the paths race-style. Preset mixes also show the sims
// service's own run on 5,000 paths (stress.json). Reshuffled history, not a forecast.
import { useEffect, useMemo, useState } from "react";
import { recordRun } from "../../lib/activity";
import { simUrl } from "../../lib/space";
import { CRASHES, loadStress, PRESET_MIXES, simulate, summarise, weeklySimple, type StressDoc, type StressRun } from "../../lib/stress";
import type { WorldData } from "../../lib/world";
import { colorAt } from "../../pages/sim/play/data";
import { SPEEDS, usePlayback, type Speed } from "../../pages/sim/play/usePlayback";
import { useAsOf, useLoad, useOpt } from "../context";
import { getWorld, type Loadable } from "../data";
import { fmtPct, tone } from "../fmt";
import { Empty, Loading, Seg, useBox } from "../tui";
import { Select } from "./common";

const HORIZONS: [string, string][] = [["52", "1Y"], ["156", "3Y"], ["260", "5Y"], ["520", "10Y"]];
const AT: [string, string][] = [["start", "At once"], ["year", "After a year"], ["middle", "Halfway"]];
const MAX_MIXES = 4;
const getStress = (() => { let p: Promise<Loadable<StressDoc>> | null = null; return () => (p ??= loadStress()); })();

export function StressPanel() {
  const w = useLoad(getWorld);
  useAsOf(w.status === "ok" ? w.data.data_through : null);
  if (w.status === "loading") return <Loading what="Loading weekly prices" />;
  if (w.status !== "ok") return <Empty title={w.status === "missing" ? "No world data yet" : "Could not load the world data"}>{w.message}</Empty>;
  return <Stress data={w.data} />;
}

interface Mix { id: string; label: string; weights: Record<string, number> }

function Stress({ data }: { data: WorldData }) {
  const service = useLoad(getStress);
  const [picked, setPicked] = useOpt("mixes", "sixty_forty,all_stocks,bonds_heavy");
  const [h, setH] = useOpt("h", "260");
  const [crash, setCrash] = useOpt("crash", "none");
  const [at, setAt] = useOpt("at", "start");
  const [custom, setCustom] = useOpt("custom", "stocks:40,bonds10:40,oil:20");
  const [seed, setSeed] = useState(7);
  const weeks = Number(h);
  const label = useMemo(() => Object.fromEntries(data.assets.map((a) => [a.key, a.group === "currencies" ? a.key : a.label])), [data]);
  const choices = useMemo(() => data.assets.filter((a) => a.kind !== "level" && a.group !== "factors" && data.weekly.series[a.key]), [data]);

  const customMix: Mix | null = useMemo(() => {
    const weights: Record<string, number> = {};
    for (const part of custom.split(",")) {
      const [k, v] = part.split(":");
      if (k && label[k] && Number(v) > 0) weights[k] = Number(v);
    }
    return Object.keys(weights).length ? { id: "custom", label: "Your mix", weights } : null;
  }, [custom, label]);
  const all: Mix[] = [...PRESET_MIXES, ...(customMix ? [customMix] : [])];
  const ids = picked.split(",").filter((id) => all.some((m) => m.id === id));
  const mixes = ids.map((id) => all.find((m) => m.id === id)!);
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_MIXES ? ids : [...ids, id];
    if (next.length) setPicked(next.join(","));
  };

  const crashDef = CRASHES.find((c) => c.id === crash) ?? null;
  const crashAt = at === "year" ? Math.min(52, weeks - 1) : at === "middle" ? Math.floor(weeks / 2) : 0;
  type Result = { runs: StressRun[]; from: string; to: string; hist: number[][] } | { error: string } | null;
  const result: Result = useMemo((): Result => {
    const keys = [...new Set(mixes.flatMap((m) => Object.keys(m.weights)))];
    if (!keys.length) return null;
    try {
      const w = weeklySimple(data.weekly, keys);
      const sims = simulate(w, mixes.map((m) => m.weights), weeks, 2000, seed, crashDef, crashAt);
      return { runs: sims.map(summarise), from: w.dates[0], to: w.dates[w.dates.length - 1], hist: sims.map((s) => s.map((v) => v[weeks])) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [data, mixes.map((m) => JSON.stringify(m.weights)).join("|"), weeks, seed, crashDef, crashAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = result && "runs" in result ? result : null;
  // List the run on the product home under "Sims running now" (DEC-0075).
  const runKey = ok ? `${mixes.map((m) => m.label).join(", ")}|${weeks}|${crash}|${at}` : "";
  useEffect(() => {
    if (!runKey) return;
    recordRun({ id: "stress", kind: "stress", label: "Stress test", detail: `${mixes.map((m) => m.label).join(", ")}: 2,000 paths over ${Math.round(weeks / 52)} years`, href: simUrl("world") });
  }, [runKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const runs: StressRun[] = ok ? ok.runs : [];
  const frames = runs[0]?.bands.weeks ?? [0];
  const pb = usePlayback(frames.length, { "1x": 8, "4x": 24, "16x": 90 }, `${weeks}-${crash}-${at}-${ids.join()}-${seed}`);
  const k = frames[pb.i] ?? 0;
  const svc = (m: Mix): StressRun | null => (service.status === "ok" && crashAt === 0 ? service.data.mixes.find((x) => x.id === m.id)?.runs[h]?.[crash] ?? null : null);

  return (
    <div className="term-col term-mc">
      <div className="term-bar">
        <Seg label="Horizon" value={h} onChange={setH} options={HORIZONS} />
        <Select label="Crash to splice in" value={crash} onChange={setCrash} options={[["none", "No crash added"], ...CRASHES.map((c): [string, string] => [c.id, `Add ${c.label}`])]} />
        {crash !== "none" && <Seg label="When the crash starts" value={at} onChange={setAt} options={AT} />}
        <button type="button" className="term-mini" onClick={() => setSeed((s) => s + 1)}>New draw</button>
        <span className="term-bar-note">2,000 paths each from 13-week blocks of real weeks{ok ? `, ${ok.from.slice(0, 4)} to ${ok.to.slice(0, 4)}` : ""}, rebalanced weekly, no costs</span>
      </div>
      <div className="term-bar term-mc-mixes" role="group" aria-label="Mixes to compare">
        {all.map((m) => {
          const on = ids.includes(m.id);
          return (
            <button key={m.id} type="button" className={`term-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(m.id)}
              title={Object.entries(m.weights).map(([k2, v]) => `${label[k2] ?? k2} ${v}`).join(", ")}>
              {on && <span className="term-dot" style={{ background: colorAt(ids.indexOf(m.id)) }} />}{m.label}
            </button>
          );
        })}
        <CustomMix value={custom} onChange={setCustom} choices={choices.map((a) => [a.key, label[a.key]])} />
      </div>
      {result && "error" in result ? <Empty title="Could not run these paths">{result.error}</Empty> : !runs.length ? <Empty title="Pick a mix" /> : (
        <div className="term-scroll term-mc-body">
          <div className="term-mc-stage">
            <div className="term-mc-head">
              <span className="term-mc-big">Week {k}</span>
              <span className="term-bar-note">{(k / 52).toFixed(1)} years in{crashDef ? ` · ${crashDef.label} spliced in ${at === "start" ? "at the start" : `from week ${crashAt}`}` : ""}</span>
              <span className="term-bar-fill" />
              <button type="button" className="term-mini" onClick={pb.play}>{pb.playing ? "Pause" : pb.pos >= pb.end ? "Replay" : "Play"}</button>
              <Seg label="Speed" value={pb.speed} onChange={(s) => pb.setSpeed(s as Speed)} options={SPEEDS.map((s) => [s, s])} />
            </div>
            <Fan runs={runs} upTo={pb.i} names={mixes.map((m) => m.label)} />
            <input className="sw-scrub term-mc-scrub" type="range" min={0} max={pb.end} value={pb.i} aria-label="Move through the simulated weeks"
              aria-valuetext={`Week ${k}`} onChange={(e) => pb.goTo(Number(e.target.value))} />
          </div>
          <table className="term-table term-mc-table">
            <caption className="sr-only">Stress test results, mixes side by side</caption>
            <thead><tr><th className="l">After {HORIZONS.find((x) => x[0] === h)?.[1]}</th>{mixes.map((m, i) => <th key={m.id}><span className="term-dot" style={{ background: colorAt(i) }} />{m.label}</th>)}</tr></thead>
            <tbody>
              <Row name="Middle end value" title="Half the paths ended above, half below; the start is 100" runs={runs} f={(r) => num(r.final[2])} />
              <Row name="Middle half of end values" runs={runs} f={(r) => `${num(r.final[1])} to ${num(r.final[3])}`} />
              <Row name="Worst 5% ended below" runs={runs} f={(r) => num(r.final[0])} />
              <Row name="Worst 1% ended below" runs={runs} f={(r) => num(r.worst1)} />
              <Row name="Chance of a loss" runs={runs} f={(r) => fmtPct(r.p_loss, 1)} />
              <Row name="Typical worst fall" title="The median of each path's biggest drop from a high" runs={runs} f={(r) => <span className={tone(r.max_dd[1])}>{fmtPct(r.max_dd[1], 1, true)}</span>} />
              <Row name="Bad-case worst fall" title="5% of paths fell further than this" runs={runs} f={(r) => <span className={tone(r.max_dd[0])}>{fmtPct(r.max_dd[0], 1, true)}</span>} />
              <Row name="Weeks to make back the worst fall" title="Middle and slow (90th percentile) case, among paths that made it back" runs={runs} f={(r) => (r.recover_weeks ? `${r.recover_weeks[0]} / ${r.recover_weeks[1]}` : "n/a")} />
              <Row name="Worst fall not made back by the end" runs={runs} f={(r) => fmtPct(r.unrecovered, 0)} />
              <tr className="term-mc-svc">
                <td className="l" title="The sims service runs the preset mixes on 5,000 paths every cycle, with the crash at the start">Service run, middle and worst 5%</td>
                {mixes.map((m) => { const s = svc(m); return <td key={m.id}>{s ? `${num(s.final[2])} / ${num(s.final[0])} (${s.n.toLocaleString("en-US")})` : <span className="muted">{m.id === "custom" ? "your mix: page only" : service.status === "ok" ? "crash later: page only" : "not published yet"}</span>}</td>; })}
              </tr>
            </tbody>
          </table>
          <Histogram hist={ok ? ok.hist : []} names={mixes.map((m) => m.label)} />
          <p className="term-lib-note">
            Each path strings together random 13-week runs of real weeks, the same draws for every mix, so the comparison is like for like.
            A path cannot hold a move that has not happened in the weeks it draws from. Values start at 100.
          </p>
        </div>
      )}
    </div>
  );
}

const num = (v: number) => (v * 100).toFixed(0);

function Row({ name, title, runs, f }: { name: string; title?: string; runs: StressRun[]; f: (r: StressRun) => React.ReactNode }) {
  return <tr><td className="l" title={title}>{name}</td>{runs.map((r, i) => <td key={i}>{f(r)}</td>)}</tr>;
}

function CustomMix({ value, onChange, choices }: { value: string; onChange: (v: string) => void; choices: [string, string][] }) {
  const parts = value.split(",").map((p) => p.split(":")).filter((p) => p[0]);
  const rows = [...parts, ...Array.from({ length: Math.max(0, 4 - parts.length) }, () => ["", "0"])].slice(0, 4);
  const set = (i: number, key: string, w: string) => {
    const next = rows.map((r, j) => (j === i ? [key, w] : r)).filter((r) => r[0] && Number(r[1]) > 0);
    onChange(next.map((r) => r.join(":")).join(","));
  };
  return (
    <details className="term-mc-custom">
      <summary>Edit your mix</summary>
      {rows.map(([k, v], i) => (
        <span key={i} className="term-mc-crow">
          <Select label={`Asset ${i + 1}`} value={k} onChange={(x) => set(i, x, v === "0" ? "25" : v)} options={[["", "None"], ...choices]} />
          <input className="term-input term-mc-w" type="number" min={0} max={100} step={5} value={v} aria-label={`Weight ${i + 1}`} onChange={(e) => set(i, k, e.target.value)} />
        </span>
      ))}
    </details>
  );
}

function Fan({ runs, upTo, names }: { runs: StressRun[]; upTo: number; names: string[] }) {
  const [ref, w, hBox] = useBox<HTMLDivElement>();
  const h = Math.max(180, Math.min(320, hBox || 240));
  const pad = { l: 8, r: 44, t: 10, b: 18 };
  const weeks = runs[0].bands.weeks;
  let lo = Infinity, hi = -Infinity;
  for (const r of runs) for (const row of [r.bands.q[0], r.bands.q[4]]) for (const v of row) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  lo = Math.log(Math.max(0.05, lo)); hi = Math.log(hi);
  const iw = Math.max(10, w - pad.l - pad.r), ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / Math.max(1, weeks.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - ((Math.log(v) - lo) / (hi - lo || 1)) * ih;
  const line = (row: number[]) => row.slice(0, upTo + 1).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6].filter((v) => Math.log(v) >= lo && Math.log(v) <= hi);
  return (
    <div className="term-mc-fan" ref={ref} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={`Middle path and 5 to 95% range of ${names.join(", ")}`}>
          {ticks.map((v) => <g key={v}><line className="term-gl" x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} /><text className="term-tick" x={pad.l + iw + 6} y={y(v)} dy="0.32em">{Math.round(v * 100)}</text></g>)}
          {runs.map((r, m) => {
            const top = r.bands.q[4].slice(0, upTo + 1), bot = r.bands.q[0].slice(0, upTo + 1);
            const area = [...top.map((v, i) => `${x(i)},${y(v)}`), ...bot.map((v, i) => `${x(i)},${y(v)}`).reverse()].join(" ");
            return (
              <g key={m}>
                <polygon points={area} style={{ fill: colorAt(m), opacity: 0.1 }} />
                <polyline points={line(r.bands.q[2])} fill="none" stroke={colorAt(m)} strokeWidth={1.6} />
                <polyline points={line(r.bands.q[0])} fill="none" stroke={colorAt(m)} strokeWidth={0.8} strokeDasharray="3 3" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function Histogram({ hist, names }: { hist: number[][]; names: string[] }) {
  const [ref, w] = useBox<HTMLDivElement>();
  const h = 120, bins = 40;
  if (!hist.length) return null;
  const all = hist.flat().map((v) => Math.log(v));
  const s = [...all].sort((a, b) => a - b);
  const lo = s[Math.floor(s.length * 0.005)], hi = s[Math.ceil(s.length * 0.995) - 1];
  const counts = hist.map((list) => {
    const c = new Array(bins).fill(0);
    for (const v of list) c[Math.max(0, Math.min(bins - 1, Math.floor(((Math.log(v) - lo) / (hi - lo || 1)) * bins)))]++;
    return c;
  });
  const top = Math.max(...counts.flat());
  const iw = Math.max(10, w - 16);
  const x = (b: number) => 8 + (b / bins) * iw;
  const at = (v: number) => 8 + ((Math.log(v) - lo) / (hi - lo || 1)) * iw;
  return (
    <div className="term-mc-hist" ref={ref}>
      <div className="term-bar-note">Where the paths ended (start = 100)</div>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={`Spread of end values for ${names.join(", ")}`}>
          {Math.log(1) > lo && Math.log(1) < hi && <line className="term-zero" x1={at(1)} x2={at(1)} y1={4} y2={h - 16} />}
          {counts.map((c, m) => (
            <polyline key={m} fill="none" stroke={colorAt(m)} strokeWidth={1.4}
              points={c.map((n, b) => `${x(b)},${h - 16 - (n / top) * (h - 24)} ${x(b + 1)},${h - 16 - (n / top) * (h - 24)}`).join(" ")} />
          ))}
          {[Math.exp(lo), 1, Math.exp(hi)].filter((v, i) => i !== 1 || (Math.log(v) > lo && Math.log(v) < hi)).map((v) => (
            <text key={v} className="term-tick" x={at(v)} y={h - 3} textAnchor="middle">{Math.round(v * 100)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}
