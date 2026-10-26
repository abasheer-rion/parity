// MON, HEAT and MOV: the market monitor, the heat map and the top movers, all read from
// the index (no per-series file needed).
import { useMemo } from "react";
import { useAsOf, useOpt, usePanel, useTerm } from "../context";
import type { TermIndex, TermSeries, Win } from "../data";
import { fmtChg, fmtLast, fmtNum, normMove, tone, WIN_LABEL } from "../fmt";
import { PctBar, Seg, Spark, TTable, type TCol } from "../tui";
import { applyFilter, filterOptions, groupLabel, ordered, Select, usePick, WithIndex } from "./common";

const chgCell = (w: Win) => (s: TermSeries) => <span className={tone(s.chg?.[w])}>{fmtChg(s.chg?.[w], s.kind)}</span>;

export function MonitorPanel() {
  return <WithIndex>{(ix) => <Monitor ix={ix} />}</WithIndex>;
}

function Monitor({ ix }: { ix: TermIndex }) {
  const t = useTerm();
  const pick = usePick();
  // MON FX, MON COMMODITIES, MON fx_g10: a class or a group typed after the code.
  const arg = usePanel().leaf.args.join(" ").toLowerCase();
  const fromArg = !arg ? "all"
    : ix.series.some((s) => s.class === arg) ? `class:${arg}`
    : ix.groups.find((g) => g.id.toLowerCase() === arg || g.label.toLowerCase().includes(arg)) ? `group:${ix.groups.find((g) => g.id.toLowerCase() === arg || g.label.toLowerCase().includes(arg))!.id}`
    : "all";
  const [filter, setFilter] = useOpt("group", fromArg);
  useAsOf(ix.data_through);
  const rows = useMemo(() => applyFilter(ordered(ix), filter), [ix, filter]);
  const gl = useMemo(() => groupLabel(ix), [ix]);
  const cols: TCol<TermSeries>[] = [
    { key: "short", label: "Ticker", align: "left", sort: (s) => s.short, render: (s) => <span className="term-sym">{s.short}</span>, className: "c-sym" },
    { key: "label", label: "Name", align: "left", sort: (s) => s.label, render: (s) => <span className="term-name" title={`${s.label} · ${s.unit}`}>{s.label}</span>, className: "c-label" },
    { key: "last", label: "Last", sort: (s) => s.last, render: (s) => fmtLast(s.last), className: "c-last" },
    { key: "d1", label: "1D", sort: (s) => s.chg?.d1, render: chgCell("d1"), title: "Change over a day: percent for prices, a difference for levels" },
    { key: "w1", label: "1W", sort: (s) => s.chg?.w1, render: chgCell("w1"), className: "c-w1" },
    { key: "m1", label: "1M", sort: (s) => s.chg?.m1, render: chgCell("m1"), className: "c-m1" },
    { key: "ytd", label: "YTD", sort: (s) => s.chg?.ytd, render: chgCell("ytd"), className: "c-ytd" },
    { key: "vol", label: "Vol", sort: (s) => s.vol, render: (s) => (s.vol == null ? <span className="muted">n/a</span> : `${s.vol.toFixed(1)}`), title: "Yearly volatility, percent (prices only)", className: "c-vol" },
    { key: "z", label: "Z", sort: (s) => (s.z == null ? null : Math.abs(s.z)), render: (s) => <span className={`term-z ${Math.abs(s.z ?? 0) >= 2 ? "hot" : ""} ${tone(s.z)}`}>{fmtNum(s.z, 1, true)}</span>, title: "This week's change in standard deviations of weekly changes (3 years)" },
    { key: "pct", label: "1Y %ile", sort: (s) => s.pct1y, render: (s) => <PctBar value={s.pct1y} />, title: "Where the last value sits in the past year's range", className: "c-pct" },
    { key: "spark", label: "1Y", render: (s) => <Spark values={s.spark} />, className: "c-spark" },
  ];
  return (
    <div className="term-col">
      <div className="term-bar">
        <Select label="Group" value={filter} onChange={setFilter} options={filterOptions(ix)} />
        <span className="term-bar-note">{rows.length} series · click a row to link it</span>
      </div>
      <TTable rows={rows} cols={cols} rowKey={(s) => s.key} onPick={pick} picked={t.link.series} caption="Market monitor"
        groupOf={(s) => s.group} groupLabel={gl} />
    </div>
  );
}

// ---------- HEAT ----------

/** A colour for a normalised move: green up, red down, stronger as it gets more unusual. */
function heatStyle(z: number | null): React.CSSProperties {
  if (z == null) return { background: "var(--t-none)" };
  const a = Math.min(1, Math.abs(z) / 3);
  const c = z >= 0 ? "var(--t-up)" : "var(--t-down)";
  // On the strongest tiles the colour is bright enough that light text fails contrast, so it turns dark.
  return { background: `color-mix(in srgb, ${c} ${Math.round(14 + a * 66)}%, var(--t-panel))`, ...(a > 0.6 ? { color: "var(--color-canvas)" } : {}) };
}

export function HeatPanel() {
  return <WithIndex>{(ix) => <Heat ix={ix} />}</WithIndex>;
}

function Heat({ ix }: { ix: TermIndex }) {
  const t = useTerm();
  const pick = usePick();
  const [win, setWin] = useOpt("win", "w1");
  const [filter, setFilter] = useOpt("group", "all");
  useAsOf(ix.data_through);
  const w = win as Win;
  const groups = useMemo(() => {
    const list = applyFilter(ordered(ix), filter);
    const out: { id: string; label: string; items: TermSeries[] }[] = [];
    const gl = groupLabel(ix);
    for (const s of list) {
      let g = out.find((x) => x.id === s.group);
      if (!g) { g = { id: s.group, label: gl(s.group), items: [] }; out.push(g); }
      g.items.push(s);
    }
    return out;
  }, [ix, filter]);
  return (
    <div className="term-col">
      <div className="term-bar">
        <Seg label="Window" value={w} onChange={setWin} options={(["d1", "w1", "m1", "ytd"] as Win[]).map((x) => [x, WIN_LABEL[x]])} />
        <Select label="Group" value={filter} onChange={setFilter} options={filterOptions(ix)} />
        <span className="term-bar-note">colour = move ÷ its usual size</span>
      </div>
      <div className="term-scroll">
        {groups.map((g) => (
          <section key={g.id} className="term-heat-group" aria-label={g.label}>
            <h3>{g.label}</h3>
            <div className="term-heat">
              {g.items.map((s) => {
                const z = normMove(s, w);
                return (
                  <button key={s.key} type="button" className={`term-tile ${t.link.series === s.key ? "picked" : ""}`} style={heatStyle(z)}
                    onClick={() => pick(s)} title={`${s.label}: ${fmtChg(s.chg?.[w], s.kind)} over ${WIN_LABEL[w]}${z == null ? "" : `, ${fmtNum(z, 1, true)} usual moves`}`}>
                    <b>{s.short}</b>
                    <span>{fmtChg(s.chg?.[w], s.kind, s.kind === "price" ? 1 : undefined)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------- MOV ----------

export function MoversPanel() {
  return <WithIndex>{(ix) => <Movers ix={ix} />}</WithIndex>;
}

function Movers({ ix }: { ix: TermIndex }) {
  const t = useTerm();
  const pick = usePick();
  const [win, setWin] = useOpt("win", "w1");
  const [by, setBy] = useOpt("by", "z");
  const [filter, setFilter] = useOpt("group", "all");
  useAsOf(ix.data_through);
  const w = win as Win;
  const { up, down } = useMemo(() => {
    const list = applyFilter(ix.series, filter)
      .filter((s) => (by === "pct" ? s.kind === "price" : true))
      .map((s) => ({ s, v: by === "pct" ? s.chg?.[w] ?? null : normMove(s, w) }))
      .filter((x): x is { s: TermSeries; v: number } => x.v != null && Number.isFinite(x.v));
    const sorted = [...list].sort((a, b) => b.v - a.v);
    return { up: sorted.filter((x) => x.v > 0).slice(0, 10), down: sorted.filter((x) => x.v < 0).reverse().slice(0, 10) };
  }, [ix, w, by, filter]);
  const side = (title: string, rows: { s: TermSeries; v: number }[]) => (
    <section className="term-mov-side" aria-label={title}>
      <h3>{title}</h3>
      {rows.length ? (
        <ol className="term-mov">
          {rows.map(({ s, v }) => (
            <li key={s.key}>
              <button type="button" className={t.link.series === s.key ? "picked" : ""} onClick={() => pick(s)} title={s.label}>
                <span className="term-sym">{s.short}</span>
                <span className="term-name">{s.label}</span>
                <span className={tone(s.chg?.[w])}>{fmtChg(s.chg?.[w], s.kind)}</span>
                <span className={`term-z ${tone(v)}`}>{by === "pct" ? fmtLast(s.last) : `z ${fmtNum(v, 1, true)}`}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="muted term-pad">None</p>}
    </section>
  );
  return (
    <div className="term-col">
      <div className="term-bar">
        <Seg label="Window" value={w} onChange={setWin} options={(["d1", "w1", "m1", "ytd"] as Win[]).map((x) => [x, WIN_LABEL[x]])} />
        <Seg label="Rank by" value={by} onChange={setBy} options={[["z", "Z"], ["pct", "%"]]} />
        <Select label="Group" value={filter} onChange={setFilter} options={filterOptions(ix)} />
      </div>
      <div className="term-mov-wrap term-scroll">
        {side("Risers", up)}
        {side("Fallers", down)}
      </div>
    </div>
  );
}
