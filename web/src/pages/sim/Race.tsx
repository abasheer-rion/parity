// The race: every runner's starting amount grows through time. Play at three speeds,
// step by day, week, month, quarter or year (buttons or arrow keys), jump to a date
// or a market event, pick the runners, and read a close-up of any one of them.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Checkbox, Delta, Dialog, FilterChip, Icon, Money, Segmented, fmt } from "../../ui";
import { ASSET_LABEL, FAMILY_LABEL, insightsFor, nameOf, tagsOf } from "../../lib/strategyMeta";
import type { Comparison, SeriesBlock, StrategyRun } from "../../lib/types";
import { WidgetTray } from "./Widgets";
import { DAY, dayMonthYear, indexAtOrBefore, marketEvents, monthYear, t, thin, usePrefersReducedMotion, useWidth, type MarketEvent } from "./shared";

interface Lane { run: StrategyRun; color: string; values: number[] }

const SPEEDS = ["1x", "4x", "16x"] as const;
type Speed = (typeof SPEEDS)[number];
const WEEKS_PER_SEC: Record<Speed, number> = { "1x": 13, "4x": 52, "16x": 208 };
const STEPS = ["day", "week", "month", "quarter", "year"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = { day: "Day", week: "Week", month: "Month", quarter: "Quarter", year: "Year" };
const ROW = 34;
const OUTLIER_FLOOR = 0.25; // a runner that ever lost three quarters of its money

function shiftDate(iso: string, step: Step, dir: 1 | -1): string {
  const d = new Date(t(iso));
  if (step === "day") d.setUTCDate(d.getUTCDate() + dir);
  else if (step === "week") d.setUTCDate(d.getUTCDate() + 7 * dir);
  else d.setUTCMonth(d.getUTCMonth() + dir * (step === "month" ? 1 : step === "quarter" ? 3 : 12));
  return d.toISOString().slice(0, 10);
}

export function Race({ runs, colors, start, comparison, series }: {
  runs: StrategyRun[]; colors: Record<string, string>; start: number; comparison?: Comparison; series?: Record<string, SeriesBlock>;
}) {
  const reduce = usePrefersReducedMotion();
  const bench = runs.find((r) => r.is_benchmark);
  const events = useMemo(() => marketEvents(comparison?.crises), [comparison]);

  // Who is racing. The market always runs as the reference.
  const [racing, setRacing] = useState<Set<string>>(() => new Set(runs.map((r) => r.strategy)));
  const [picking, setPicking] = useState(false);
  const [hideOutliers, setHideOutliers] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);

  // One shared timeline from the market's dates; every lane is forward-filled onto it.
  const { dates, allLanes } = useMemo(() => {
    const master = bench ?? runs[0];
    const dates = thin(master?.equity ?? []).map((p) => p[0]);
    const allLanes: Lane[] = runs.map((run) => {
      const eq = run.equity;
      const values: number[] = [];
      let j = 0, last = eq[0]?.[1] ?? 1;
      for (const d of dates) {
        while (j < eq.length && eq[j][0] <= d) { last = eq[j][1]; j++; }
        values.push(last);
      }
      const base = values[0] || 1;
      return { run, color: colors[run.strategy], values: values.map((v) => (v / base) * start) };
    });
    return { dates, allLanes };
  }, [runs, bench, colors, start]);

  const outliers = useMemo(() => new Set(allLanes.filter((l) => Math.min(...l.values) < start * OUTLIER_FLOOR).map((l) => l.run.strategy)), [allLanes, start]);
  const lanes = useMemo(() => allLanes.filter((l) => (l.run.is_benchmark || racing.has(l.run.strategy)) && !(hideOutliers && outliers.has(l.run.strategy))),
    [allLanes, racing, hideOutliers, outliers]);
  const hidden = allLanes.filter((l) => racing.has(l.run.strategy) && hideOutliers && outliers.has(l.run.strategy));

  const end = Math.max(0, dates.length - 1);
  const [pos, setPos] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("4x");
  const [step, setStep] = useState<Step>("month");
  const posRef = useRef(pos);
  posRef.current = pos;
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const target = stopAt.current ?? end;
      const next = Math.min(target, posRef.current + dt * WEEKS_PER_SEC[speed]);
      setPos(next);
      if (next >= target) { setPlaying(false); stopAt.current = null; return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, end]);

  const i = Math.min(end, Math.floor(pos));
  const date = dates[i] ?? dates[end] ?? "";

  const play = () => {
    if (playing) { setPlaying(false); return; }
    stopAt.current = null;
    if (reduce) { setPos(end); return; }
    if (posRef.current >= end) setPos(0);
    setPlaying(true);
  };
  const goTo = (k: number) => { setPlaying(false); stopAt.current = null; setPos(Math.max(0, Math.min(end, k))); };
  const stepBy = (dir: 1 | -1, unit: Step = step) => {
    const cur = dates[Math.round(posRef.current)] ?? date;
    const target = shiftDate(cur, unit, dir);
    let k = indexAtOrBefore(dates, target);
    if (dir === 1 && dates[k] !== target) k += 1; // first point on or after the target
    const now = Math.round(posRef.current);
    if (dir === 1 && k <= now) k = now + 1;
    if (dir === -1 && k >= now) k = now - 1;
    goTo(k);
  };
  const jumpToDate = (iso: string) => {
    const k = indexAtOrBefore(dates, iso);
    goTo(dates[k] === iso ? k : k + 1);
  };
  const playEvent = (e: MarketEvent) => {
    const a = Math.max(0, indexAtOrBefore(dates, e.start));
    const b = Math.min(end, indexAtOrBefore(dates, e.end) + 1);
    if (reduce) { goTo(b); return; }
    setPos(a);
    stopAt.current = b;
    setPlaying(true);
  };

  // Arrow keys step, Shift+arrow steps a year, Space plays or pauses, Home and End jump.
  const keys = useRef({ stepBy, play, goTo, end });
  keys.current = { stepBy, play, goTo, end };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) && e.key === " ")) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (document.querySelector(".ui-dialog, .palette")) return;
      const k = keys.current;
      if (e.key === "ArrowRight") { e.preventDefault(); k.stepBy(1, e.shiftKey ? "year" : undefined); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); k.stepBy(-1, e.shiftKey ? "year" : undefined); }
      else if (e.key === " ") { e.preventDefault(); k.play(); }
      else if (e.key === "Home") { e.preventDefault(); k.goTo(0); }
      else if (e.key === "End") { e.preventDefault(); k.goTo(k.end); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const frac = pos - i;
  const valueAt = (l: Lane, k = i, f = frac) => (k >= end ? l.values[end] : l.values[k] + (l.values[k + 1] - l.values[k]) * f);
  const yearAgoIdx = indexAtOrBefore(dates, new Date(t(date) - 365 * DAY).toISOString().slice(0, 10));
  const standings = lanes.map((l) => ({ l, v: valueAt(l) })).sort((a, b) => b.v - a.v);

  // Reorder the board at most every 180ms while playing, so close neighbours swap cleanly.
  const order = useRef<{ at: number; rank: Map<string, number> } | null>(null);
  const now = performance.now();
  if (!order.current || !playing || now - order.current.at > 180 || order.current.rank.size !== lanes.length) {
    order.current = { at: now, rank: new Map(standings.map((s, k) => [s.l.run.strategy, k])) };
  }
  const rank = order.current.rank;
  const leader = standings[0];
  const focused = lanes.find((l) => l.run.strategy === focus) ?? leader?.l;

  // Chart: time on x, money on a log y axis fixed for the race, so lines never rescale.
  const [ref, width] = useWidth<HTMLDivElement>(260);
  const height = Math.min(460, Math.max(240, width * 0.5));
  const pad = { top: 26, right: 14, bottom: 24, left: 52 };
  const w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
  const [lo, hi] = useMemo(() => {
    let mn = start, mx = start;
    for (const l of lanes) for (const v of l.values) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return [Math.log(mn * 0.95), Math.log(mx * 1.05)];
  }, [lanes, start]);
  const x = (k: number) => pad.left + (end ? (k / end) * w : 0);
  const xd = (iso: string) => x(Math.max(0, indexAtOrBefore(dates, iso)));
  const y = (v: number) => pad.top + h - ((Math.log(v) - lo) / (hi - lo || 1)) * h;
  const paths = useMemo(
    () => new Map(lanes.map((l) => [l.run.strategy, l.values.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("")])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lanes, width, height, lo, hi],
  );
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = 1e1; m < 1e9; m *= 10) for (const k of [1, 2, 5]) { const v = m * k; if (Math.log(v) >= lo && Math.log(v) <= hi) out.push(v); }
    return out.length > 6 ? out.filter((_, k) => k % 2 === 0) : out;
  }, [lo, hi]);
  const years = useMemo(() => {
    const out: { k: number; label: string }[] = [];
    let last = "";
    const every = width < 520 ? 10 : 5;
    dates.forEach((d, k) => { const yr = d.slice(0, 4); if (yr !== last && Number(yr) % every === 0) out.push({ k, label: yr }); last = yr; });
    return out;
  }, [dates, width]);

  if (!dates.length) return <p className="muted">No data to replay.</p>;
  const elapsed = (t(date) - t(dates[0])) / (365.25 * DAY);
  const inside = events.find((e) => date >= e.start && date <= e.end);
  const suggested = [...new Set(lanes.flatMap((l) => Object.keys(l.run.exposure)))];

  return (
    <section className="sw-race" aria-label="Race replay">
      <div className="sw-race-top">
        <div>
          <div className="sw-eyebrow">Race replay · every runner starts with <Money value={start} cents={false} /></div>
          <div className="sw-date">{monthYear(date)}</div>
          <div className="sw-date-sub">
            <span>{dayMonthYear(date)}</span>
            <span>· {elapsed < 0.02 ? "the starting line" : `${elapsed.toFixed(1)} years in`}</span>
            {leader && <span>· leading: <span className="sw-dot" style={{ background: leader.l.color }} /> {nameOf(leader.l.run)}</span>}
            {inside && <span className="sw-inside">{inside.name}</span>}
          </div>
        </div>
        <div className="sw-controls">
          <Button variant="primary" icon={playing ? "pause" : pos >= end ? "restart" : "play"} onClick={play}>
            {playing ? "Pause" : pos >= end ? "Replay" : "Play"}
          </Button>
          <Segmented label="Speed" size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => [s, s] as [Speed, string])} />
          <Button variant="secondary" size="sm" icon="filter" onClick={() => setPicking(true)}>Runners {lanes.length - (bench ? 1 : 0)}</Button>
        </div>
      </div>

      <div className="sw-race-body">
        <div className="sw-track" ref={ref}>
          <svg width={width} height={height} role="img" aria-label={`Growth of the starting amount for each runner up to ${monthYear(date)}, log scale`}>
            <defs><clipPath id="sw-clip"><rect x={pad.left} y={0} width={Math.max(0, x(pos) - pad.left + 1)} height={height} /></clipPath></defs>
            {events.map((e) => {
              const a = xd(e.start), b = Math.max(xd(e.end), a + 2);
              return (
                <g key={e.name} className={`sw-band ${inside === e ? "on" : ""}`} onClick={() => playEvent(e)}>
                  <rect x={a} y={pad.top} width={b - a} height={h} />
                  <text x={(a + b) / 2} y={pad.top - 8} textAnchor="middle">{e.short}</text>
                </g>
              );
            })}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} className="sw-grid" />
                <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="sw-axis">{fmt.compact(v)}</text>
              </g>
            ))}
            {years.map((yr) => <text key={yr.k} x={x(yr.k)} y={height - 6} textAnchor="middle" className="sw-axis">{yr.label}</text>)}
            <line x1={pad.left} x2={pad.left + w} y1={y(start)} y2={y(start)} className="sw-start" />
            <g clipPath="url(#sw-clip)">
              {lanes.map((l) => {
                const isFocus = focused?.run.strategy === l.run.strategy;
                return (
                  <path key={l.run.strategy} d={paths.get(l.run.strategy)} fill="none" stroke={l.color}
                    strokeWidth={isFocus ? 2.2 : l.run.is_benchmark ? 1.6 : 1.3} strokeDasharray={l.run.is_benchmark ? "4 3" : undefined}
                    opacity={isFocus || l.run.is_benchmark ? 1 : (rank.get(l.run.strategy) ?? 9) < 3 ? 0.8 : 0.4} />
                );
              })}
            </g>
            <line x1={x(pos)} x2={x(pos)} y1={pad.top} y2={pad.top + h} className="sw-now" />
            {lanes.map((l) => <circle key={l.run.strategy} cx={x(pos)} cy={y(valueAt(l))} r={focused?.run.strategy === l.run.strategy ? 4 : 2.5} fill={l.color} />)}
          </svg>

          <input className="sw-scrub" type="range" min={0} max={end} step={1} value={i} aria-label="Move through time" aria-valuetext={dayMonthYear(date)}
            onChange={(e) => goTo(Number(e.target.value))} style={{ "--p": `${end ? (pos / end) * 100 : 0}%` } as CSSProperties} />
          <div className="sw-scrub-ends"><span>{monthYear(dates[0])}</span><span>Today</span></div>

          <div className="sw-steps">
            <div className="sw-step-group">
              <button className="sw-stepbtn" onClick={() => stepBy(-1)} aria-label={`Back one ${step}`} title={`Back one ${step} (left arrow)`}><Icon name="chevronLeft" size={14} /></button>
              <Segmented label="Step size" size="sm" value={step} onChange={setStep} options={STEPS.map((s) => [s, STEP_LABEL[s]] as [Step, string])} />
              <button className="sw-stepbtn" onClick={() => stepBy(1)} aria-label={`Forward one ${step}`} title={`Forward one ${step} (right arrow)`}><Icon name="chevronRight" size={14} /></button>
            </div>
            <label className="sw-jump">
              <span>Jump to</span>
              <input type="month" min={dates[0].slice(0, 7)} max={dates[end].slice(0, 7)} value={date.slice(0, 7)}
                onChange={(e) => e.target.value && jumpToDate(`${e.target.value}-01`)} />
            </label>
          </div>
          <div className="sw-events" aria-label="Market events">
            <span className="sw-mini-title">Replay an event</span>
            {events.map((e) => <FilterChip key={e.name} label={e.short} active={inside === e} onClick={() => playEvent(e)} />)}
          </div>
          <p className="sw-keys">Arrow keys step, Shift and an arrow steps a year, Space plays or pauses. The report keeps one point a week, so a day step moves to the next point.</p>
        </div>

        <div className="sw-side">
          <div className="sw-board-head">
            <span>Runner</span><span>Value</span><span>Total</span><span title="Change over the past year">1 yr</span>
          </div>
          <ol className="sw-board" style={{ height: lanes.length * ROW }} aria-label="Leaderboard">
            {lanes.map((l) => {
              const r = rank.get(l.run.strategy) ?? 0;
              const v = valueAt(l);
              const ago = yearAgoIdx >= 0 ? l.values[yearAgoIdx] : null;
              const isFocus = focused?.run.strategy === l.run.strategy;
              return (
                <li key={l.run.strategy} className={`sw-row ${l.run.is_benchmark ? "bench" : ""} ${r === 0 ? "first" : ""} ${isFocus ? "focus" : ""}`}
                  style={{ transform: `translateY(${r * ROW}px)` }}>
                  <button className="sw-row-btn" onClick={() => setFocus(l.run.strategy)} aria-pressed={isFocus} title={`Close-up of ${nameOf(l.run)}`}>
                    <span className="sw-rank">{r + 1}</span>
                    <span className="sw-dot" style={{ background: l.color }} />
                    <span className="sw-name">{nameOf(l.run)}</span>
                    <span className="sw-val"><Money value={v} cents={false} /></span>
                    <span className="sw-chg"><Delta value={v / start - 1} digits={0} /></span>
                    <span className="sw-chg">{ago ? <Delta value={v / ago - 1} digits={0} /> : <span className="muted">n/a</span>}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {hidden.length > 0 && (
            <p className="sw-outlier-note">
              Hidden so the chart stays readable: {hidden.map((l) => nameOf(l.run)).join(", ")} (lost more than three quarters at some point).{" "}
              <button className="ui-linkbtn" onClick={() => setHideOutliers(false)}>Show</button>
            </p>
          )}
          {!hideOutliers && outliers.size > 0 && (
            <p className="sw-outlier-note"><button className="ui-linkbtn" onClick={() => setHideOutliers(true)}>Hide outliers</button></p>
          )}
        </div>
      </div>

      {focused && <CloseUp lane={focused} lanes={lanes} k={i} dates={dates} start={start} rank={(rank.get(focused.run.strategy) ?? 0) + 1}
        comparison={comparison} bench={bench} />}

      {series && Object.keys(series).length > 0 && <WidgetTray series={series} date={date} startDate={dates[0]} suggested={suggested} />}

      <Picker open={picking} onClose={() => setPicking(false)} runs={runs} colors={colors} racing={racing} setRacing={setRacing} />
    </section>
  );
}

// ---------- close-up of one runner at the current date ----------

function CloseUp({ lane, lanes, k, dates, start, rank, comparison, bench }: {
  lane: Lane; lanes: Lane[]; k: number; dates: string[]; start: number; rank: number; comparison?: Comparison; bench?: StrategyRun;
}) {
  const v = lane.values[k];
  let peak = 0;
  for (let j = 0; j <= k; j++) if (lane.values[j] > peak) peak = lane.values[j];
  const drawdown = peak ? v / peak - 1 : 0;
  const year = dates[k].slice(0, 4);
  const done = Object.entries(lane.run.yearly).filter(([y]) => y < year).sort((a, b) => b[1] - a[1]);
  const best = done[0], worst = done[done.length - 1];
  const tags = tagsOf(lane.run);
  const insights = useMemo(() => insightsFor(lane.run, comparison, bench), [lane.run, comparison, bench]);
  const strengths = insights.filter((x) => x.kind === "strength");
  const weaknesses = insights.filter((x) => x.kind === "weakness");
  const g = lane.run.gauntlet;

  return (
    <section className="sw-closeup" aria-label={`Close-up of ${nameOf(lane.run)}`}>
      <div className="sw-closeup-id">
        <div className="sw-card-top">
          <span className="sw-dot" style={{ background: lane.color }} />
          <a className="sw-closeup-name" href={`#/strategy/${encodeURIComponent(lane.run.strategy)}`}>{nameOf(lane.run)}</a>
        </div>
        <p className="sw-card-sum">{lane.run.description || lane.run.summary}</p>
        <div className="sw-tags">
          {[FAMILY_LABEL[tags.family] ?? tags.family, ASSET_LABEL[tags.asset] ?? tags.asset, tags.style, tags.horizon].filter(Boolean).map((x) => <span key={x} className="sw-tag">{x}</span>)}
        </div>
        <dl className="sw-closeup-stats">
          <div><dt>On {dayMonthYear(dates[k])}</dt><dd><Money value={v} cents={false} /></dd></div>
          <div><dt>Place</dt><dd>{rank} of {lanes.length}</dd></div>
          <div><dt>Since start</dt><dd><Delta value={v / start - 1} /></dd></div>
          <div><dt>Below its high</dt><dd>{drawdown > -0.0005 ? "at a high" : fmt.pct(drawdown)}</dd></div>
          <div><dt>Best year so far</dt><dd>{best ? <>{best[0]} <Delta value={best[1]} digits={0} /></> : "n/a"}</dd></div>
          <div><dt>Worst year so far</dt><dd>{worst && worst !== best ? <>{worst[0]} <Delta value={worst[1]} digits={0} /></> : "n/a"}</dd></div>
        </dl>
      </div>
      <div className="sw-sw">
        <div>
          <div className="sw-mini-title">Strengths</div>
          <ul>{strengths.length ? strengths.map((x) => <li key={x.text} title={x.detail}>{x.text}</li>) : <li className="muted">Nothing stands out.</li>}</ul>
        </div>
        <div>
          <div className="sw-mini-title">Weaknesses</div>
          <ul>{weaknesses.length ? weaknesses.map((x) => <li key={x.text} title={x.detail}>{x.text}</li>) : <li className="muted">None found.</li>}</ul>
        </div>
        {g && <p className="sw-verdict">Gauntlet: {g.passed} of {g.total} tests passed. {g.verdict}</p>}
      </div>
    </section>
  );
}

// ---------- choosing who races ----------

function Picker({ open, onClose, runs, colors, racing, setRacing }: {
  open: boolean; onClose: () => void; runs: StrategyRun[]; colors: Record<string, string>; racing: Set<string>; setRacing: (s: Set<string>) => void;
}) {
  const [asset, setAsset] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const field = runs.filter((r) => !r.is_benchmark);
  const assets = [...new Set(field.map((r) => tagsOf(r).asset))];
  const families = [...new Set(field.map((r) => tagsOf(r).family))];
  const shown = field.filter((r) => (!asset || tagsOf(r).asset === asset) && (!family || tagsOf(r).family === family));
  const set = (names: string[]) => setRacing(new Set(names));
  const topBySharpe = [...field].sort((a, b) => (b.metrics.sharpe ?? -9) - (a.metrics.sharpe ?? -9)).slice(0, 5).map((r) => r.strategy);

  return (
    <Dialog open={open} onClose={onClose} title="Who is racing" width={640}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="sw-picker-tools">
        {assets.map((a) => <FilterChip key={a} label={ASSET_LABEL[a] ?? a} active={asset === a} onClick={() => setAsset(asset === a ? null : a)} onRemove={() => setAsset(null)} />)}
        <span className="ui-vsep" aria-hidden />
        {families.map((f) => <FilterChip key={f} label={FAMILY_LABEL[f] ?? f} active={family === f} onClick={() => setFamily(family === f ? null : f)} onRemove={() => setFamily(null)} />)}
      </div>
      <div className="sw-picker-tools">
        <button className="ui-linkbtn" onClick={() => set([...new Set([...racing, ...shown.map((r) => r.strategy)])])}>Add all shown</button>
        <button className="ui-linkbtn" onClick={() => set([...racing].filter((n) => !shown.some((r) => r.strategy === n)))}>Remove all shown</button>
        <button className="ui-linkbtn" onClick={() => set(topBySharpe)}>Top 5 by Sharpe</button>
        <button className="ui-linkbtn" onClick={() => set(field.map((r) => r.strategy))}>Everyone</button>
      </div>
      <div className="sw-picker-list">
        {shown.map((r) => {
          const tg = tagsOf(r);
          return (
            <div key={r.strategy} className="sw-picker-row">
              <Checkbox checked={racing.has(r.strategy)} onChange={(on) => {
                const next = new Set(racing);
                if (on) next.add(r.strategy); else next.delete(r.strategy);
                setRacing(next);
              }} label={<><span className="sw-dot" style={{ background: colors[r.strategy] }} /> {nameOf(r)}</>} />
              <span className="sw-tags">
                <span className="sw-tag">{FAMILY_LABEL[tg.family] ?? tg.family}</span>
                <span className="sw-tag">{ASSET_LABEL[tg.asset] ?? tg.asset}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="sw-hint">The US stock market always runs as the reference line.</p>
    </Dialog>
  );
}
