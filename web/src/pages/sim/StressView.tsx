// Stress test: a simple mix of assets, bought at the start of each past crisis window and
// left alone, played through the crisis, with a table of what every crisis did to it.
import { useMemo, useState } from "react";
import { DataTable, FilterChip, Panel, toast, type Column } from "../../ui";
import type { WorldData } from "../../lib/world";
import { colorAt, CRISES, dayMonthYear, pct, tone, weekly, windowRange, type Crisis } from "./play/data";
import { SeriesRace, type RaceItem } from "./play/SeriesRace";

const DEFAULT: Record<string, number> = { stocks: 60, bonds10: 40 };
const MAX = 6;

interface Result { crisis: Crisis; ret: number | null; worst: number | null; bottom: string | null; worstAsset: string | null; worstAssetRet: number | null; bestAsset: string | null; bestAssetRet: number | null; missing: string[] }

/** The mix bought at frame a and held: each member weighted by its share of the money at the start. */
function mixPath(series: Record<string, (number | null)[]>, weights: Record<string, number>, a: number, b: number, len: number): { values: (number | null)[]; missing: string[] } {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const live = keys.filter((k) => series[k]?.[a] != null || series[k]?.[a + 1] != null);
  const missing = keys.filter((k) => !live.includes(k));
  const total = live.reduce((s, k) => s + weights[k], 0);
  const base = Object.fromEntries(live.map((k) => [k, (series[k][a] ?? series[k][a + 1]) as number]));
  const last: Record<string, number> = { ...base };
  const values: (number | null)[] = new Array(len).fill(null);
  for (let k = a; k <= b; k++) {
    let v = 0;
    for (const key of live) {
      const p = series[key][k];
      if (p != null) last[key] = p;
      v += (weights[key] / total) * (last[key] / base[key]);
    }
    values[k] = total > 0 ? v * 100 : null;
  }
  return { values, missing };
}

export function StressView({ data }: { data: WorldData }) {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT);
  const [id, setId] = useState("gfc");
  const choices = useMemo(() => data.assets.filter((x) => (x.kind !== "level" && x.group !== "factors" && !!data.weekly.series[x.key]) || x.key === "copper"), [data]);
  const label = Object.fromEntries(data.assets.map((x) => [x.key, x.group === "currencies" ? `${x.key} ${x.label}` : x.label]));
  const keys = Object.keys(weights);
  const series = useMemo(() => Object.fromEntries(choices.map((x) => [x.key, weekly(data, x.key)])), [data, choices]);

  const toggle = (k: string) => setWeights((w) => {
    if (k in w) { const next = { ...w }; delete next[k]; return next; }
    if (Object.keys(w).length >= MAX) { toast(`Up to ${MAX} assets in a mix.`); return w; }
    return { ...w, [k]: 10 };
  });

  const results: Result[] = useMemo(() => CRISES.map((c) => {
    const [a, b] = windowRange(data.weekly.dates, c.id);
    const { values, missing } = mixPath(series, weights, a, b, data.weekly.dates.length);
    let peak = -Infinity, worst = 0, bottom: string | null = null;
    for (let k = a; k <= b; k++) {
      const v = values[k];
      if (v == null) continue;
      peak = Math.max(peak, v);
      const dd = v / peak - 1;
      if (dd < worst) { worst = dd; bottom = data.weekly.dates[k]; }
    }
    const member = Object.keys(weights).filter((k) => !missing.includes(k)).map((k) => {
      const s = series[k];
      let first: number | null = null, lastV: number | null = null;
      for (let j = a; j <= b; j++) if (s[j] != null) { first ??= s[j]; lastV = s[j]; }
      return { k, r: first && lastV ? (lastV / first - 1) * 100 : null };
    }).filter((x) => x.r != null) as { k: string; r: number }[];
    member.sort((p, q) => p.r - q.r);
    const end = values[b];
    return { crisis: c, ret: end == null ? null : end - 100, worst: worst * 100, bottom, missing,
      worstAsset: member[0]?.k ?? null, worstAssetRet: member[0]?.r ?? null, bestAsset: member[member.length - 1]?.k ?? null, bestAssetRet: member[member.length - 1]?.r ?? null };
  }), [data, series, weights]);

  const crisis = CRISES.find((c) => c.id === id)!;
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, id), [data, id]);
  const items: RaceItem[] = useMemo(() => {
    const mix = mixPath(series, weights, a, b, data.weekly.dates.length);
    return [
      { key: "mix", label: "Your mix", color: "var(--text)", bench: true, values: mix.values, note: "Bought at the start of the window and left alone" },
      ...keys.map((k, i) => ({ key: k, label: label[k] ?? k, color: colorAt(i) })),
    ];
  }, [series, weights, a, b]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalW = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const cols: Column<Result>[] = [
    { key: "c", header: "Crisis", align: "left", render: (r) => <button className="ui-linkbtn" onClick={() => setId(r.crisis.id)}>{r.crisis.label}</button> },
    { key: "ret", header: "Mix over the window", sort: (r) => r.ret, tone: (r) => r.ret, render: (r) => pct(r.ret) },
    { key: "dd", header: "Worst fall", sort: (r) => r.worst, render: (r) => <span className={tone(r.worst)}>{pct(r.worst)}</span> },
    { key: "bottom", header: "Low point", render: (r) => (r.bottom ? dayMonthYear(r.bottom) : "n/a") },
    { key: "wa", header: "Worst in the mix", align: "left", render: (r) => (r.worstAsset ? <>{label[r.worstAsset]} <span className={tone(r.worstAssetRet)}>{pct(r.worstAssetRet, 0)}</span></> : "n/a") },
    { key: "ba", header: "Best in the mix", align: "left", render: (r) => (r.bestAsset ? <>{label[r.bestAsset]} <span className={tone(r.bestAssetRet)}>{pct(r.bestAssetRet, 0)}</span></> : "n/a") },
  ];
  const groups = [...new Set(choices.map((x) => x.group))];

  return (
    <>
      <div className="sw2-card pb-picker">
        <div className="pb-picker-row">
          <span className="ui-field-label">Your mix (percent of the money)</span>
          <div className="pb-weights">
            {keys.map((k, i) => (
              <label key={k} className="pb-weight">
                <span className="sw-dot" style={{ background: colorAt(i) }} />
                <span className="pb-weight-name">{label[k] ?? k}</span>
                <input className="ui-input" type="number" min={0} max={100} step={5} value={weights[k]} aria-label={`Weight of ${label[k] ?? k}`}
                  onChange={(e) => setWeights((w) => ({ ...w, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
                <span className="muted small">{Math.round((weights[k] / totalW) * 100)}%</span>
                <button className="sw-x" aria-label={`Remove ${label[k] ?? k}`} onClick={() => toggle(k)}>×</button>
              </label>
            ))}
          </div>
        </div>
        <details className="pb-add">
          <summary>Add or remove assets</summary>
          {groups.map((g) => (
            <div key={g} className="chips" style={{ marginBottom: 6 }}>
              {choices.filter((x) => x.group === g).map((x) => <FilterChip key={x.key} label={x.group === "currencies" ? x.key : x.label} active={x.key in weights} onClick={() => toggle(x.key)} />)}
            </div>
          ))}
        </details>
        <div className="pb-picker-row">
          <span className="ui-field-label">Play through</span>
          <div className="chips" style={{ marginBottom: 0 }}>
            {CRISES.map((c) => <FilterChip key={c.id} label={c.short} active={c.id === id} onClick={() => setId(c.id)} />)}
          </div>
        </div>
      </div>

      {keys.length === 0 ? <p className="muted">Add at least one asset to the mix.</p> : (
        <SeriesRace key={`${id}-${keys.join(",")}`} data={data} items={items} a={a} b={b} mode="growth" name="Mix and members"
          valueFmt={(_, __, r) => (r == null ? "n/a" : r.toFixed(1))}
          eyebrow={`Stress test · ${crisis.label} · your mix starts at 100`}
          initialFocus="mix"
          honest={<>History replayed, not a forecast. The mix is bought at the start of each window and left alone, with no trading costs. Currencies are held as their value in US dollars. A mix that came through past crises can still fail in a new one.</>}
          below={() => (
            <Panel title="Every crisis, for this mix">
              <DataTable rows={results} rowKey={(r) => r.crisis.id} columns={cols} caption="What each past crisis did to the mix" initialSort={{ key: "ret", dir: "asc" }} />
              <p className="muted small" style={{ margin: "10px 0 0" }}>
                Worst fall is the biggest drop from a high inside the window. {results.some((r) => r.missing.length) && "Some assets had no prices yet in the older crises, so those rows use the rest of the mix."}
              </p>
            </Panel>
          )}
        />
      )}
    </>
  );
}
