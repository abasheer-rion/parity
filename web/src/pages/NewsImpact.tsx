// The News page's Archive and Impact search tabs. Everything here is computed by the
// engine (parity news export) from licensed sources; the page only filters and draws.
// Ranked by evidence (q-values against random days), never by the size of a move.
import { useEffect, useMemo, useState } from "react";
import "./NewsImpact.css";
import { Badge, Card, DataTable, EmptyState, FilterBar, SearchInput, Segmented, Select, type Column } from "../ui";
import { moveText, zText, zWord, type Unit } from "../lib/news";
import {
  evidenceWord, loadArchiveIndex, loadArchiveYear, loadImpact,
  type ArchiveIndex, type ArchiveItem, type Headline, type ImpactDoc, type RankRow, type Study, type StudyEvent, type StudyHorizon,
} from "../lib/newsImpact";

const PAGE = 100;
const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
const num = (v: number | null | undefined, d = 2) => (v == null ? "n/a" : v.toFixed(d));
const day = (iso: string) => iso.slice(0, 10);

function Headlines({ items }: { items: Headline[] }) {
  return (
    <ul className="news-headlines">
      {items.map(([t, u, s]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{t}</a> <span className="muted">({s})</span></li>)}
    </ul>
  );
}

function Warnings({ list }: { list: string[] }) {
  if (!list.length) return null;
  return <ul className="news-warnings" aria-label="Read this before you trust the numbers">{list.map((w) => <li key={w}>{w}</li>)}</ul>;
}

// ------------------------------------------------------------------ archive

export function Archive() {
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [topic, setTopic] = useState("");
  const [asset, setAsset] = useState("");
  const [src, setSrc] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => { loadArchiveIndex().then(setIndex).catch((e: Error) => setError(e.message)); }, []);
  const years = useMemo(() => (index?.years ?? []).map((y) => y.year), [index]);
  useEffect(() => {
    if (!years.length) return;
    const last = years[years.length - 1];
    const lo = from ? Number(from) : last - 2;
    const hi = to ? Number(to) : last;
    const want = years.filter((y) => y >= lo && y <= hi);
    setLoading(true);
    Promise.all(want.map(loadArchiveYear)).then((parts) => { setItems(parts.flat()); setShown(PAGE); })
      .catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [years, from, to]);

  const rows = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((a) => (!topic || a.topics.includes(topic)) && (!asset || a.assets.includes(asset)) &&
      (!src || a.source === src) && words.every((w) => a.title.toLowerCase().includes(w)))
      .sort((a, b) => b.published_at.localeCompare(a.published_at));
  }, [items, q, topic, asset, src]);

  if (error) return <EmptyState title="No archive yet">{error}</EmptyState>;
  if (!index) return <p className="muted">Loading the archive...</p>;
  const topicLabel = (id: string) => index.topics.find((t) => t.id === id)?.label ?? id;
  const srcName = (id: string) => index.sources.find((s) => s.id === id)?.name ?? id;
  const yearOpts: [string, string][] = [["", "Default"], ...years.map((y) => [String(y), String(y)] as [string, string])];
  const assets = [...new Set(items.flatMap((a) => a.assets))].sort();
  const cols: Column<ArchiveItem>[] = [
    { key: "d", header: "Date", sort: (a) => a.published_at, render: (a) => day(a.published_at), width: 104 },
    { key: "t", header: "Headline", render: (a) => <><a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>{a.publisher ? <span className="muted"> ({a.publisher})</span> : null}</> },
    { key: "s", header: "Source", sort: (a) => a.source, render: (a) => srcName(a.source), width: 150 },
    { key: "k", header: "Topics", render: (a) => a.topics.slice(0, 3).map((t) => <Badge key={t}>{topicLabel(t)}</Badge>) },
  ];
  return (
    <>
      <p className="muted">{index.total.toLocaleString()} headlines from {index.years[0]?.year} to {index.years.at(-1)?.year}, kept forever. Only sources whose terms let us show them. Headline and link only for outside outlets.</p>
      <FilterBar count={rows.length} onReset={() => { setQ(""); setFrom(""); setTo(""); setTopic(""); setAsset(""); setSrc(""); }}>
        <SearchInput value={q} onChange={setQ} placeholder="Words in the headline" />
        <Select label="From year" value={from} onChange={setFrom} options={yearOpts.map(([v, l]) => [v, v ? `From ${l}` : "From: 3 years ago"])} />
        <Select label="To year" value={to} onChange={setTo} options={yearOpts.map(([v, l]) => [v, v ? `To ${l}` : "To: latest"])} />
        <Select label="Topic" value={topic} onChange={setTopic} options={[["", "Any topic"], ...index.topics.map((t) => [t.id, t.label] as [string, string])]} />
        <Select label="Asset" value={asset} onChange={setAsset} options={[["", "Any asset"], ...assets.map((a) => [a, a] as [string, string])]} />
        <Select label="Source" value={src} onChange={setSrc} options={[["", "Any source"], ...index.sources.filter((s) => s.display === "yes").map((s) => [s.id, s.name] as [string, string])]} />
      </FilterBar>
      {loading ? <p className="muted">Loading years...</p> : (
        <>
          <DataTable rows={rows.slice(0, shown)} columns={cols} rowKey={(a) => a.id} dense empty="No headlines match. Widen the years or clear a filter." />
          {rows.length > shown ? <button className="ui-btn news-more" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}</button> : null}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ impact search

type Mode = "asset" | "topic";

export function Impact() {
  const [doc, setDoc] = useState<ImpactDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("topic");
  const [asset, setAsset] = useState("eq.US_TOTAL");
  const [topic, setTopic] = useState("opec");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [h, setH] = useState<StudyHorizon>("1d");
  useEffect(() => { loadImpact().then(setDoc).catch((e: Error) => setError(e.message)); }, []);
  if (error) return <EmptyState title="No impact data yet">{error}</EmptyState>;
  if (!doc) return <p className="muted">Loading the impact engine's results...</p>;
  if (!doc.assets.length) return <EmptyState title="No impact data yet">The archive or the prices are empty on this build.</EmptyState>;
  const a = doc.assets.find((x) => x.key === asset) ?? doc.assets[0];
  const assetOpts = doc.assets.map((x) => [x.key, x.label] as [string, string]);
  const topicOpts = doc.topics.map((t) => [t.id, `${t.label} (${t.n_headlines})`] as [string, string]);
  return (
    <>
      <Explainer />
      <FilterBar>
        <Segmented label="What to look up" value={mode} onChange={setMode} options={[["topic", "What follows a kind of news"], ["asset", "News that moved an asset"]]} />
        {mode === "topic" ? <Select label="Topic" value={topic} onChange={setTopic} options={topicOpts} /> : null}
        <Select label="Asset" value={a.key} onChange={setAsset} options={assetOpts} />
      </FilterBar>
      {mode === "topic"
        ? <TopicStudy doc={doc} topic={topic} assetKey={a.key} unit={a.unit} label={a.label} onAsset={setAsset} />
        : <AssetMoves doc={doc} assetKey={a.key} unit={a.unit} label={a.label} from={from} to={to} setFrom={setFrom} setTo={setTo} h={h} setH={setH} onTopic={(t) => { setTopic(t); setMode("topic"); }} />}
    </>
  );
}

function Explainer() {
  return (
    <details className="news-explainer">
      <summary>How to read this, in plain words</summary>
      <ul>
        <li><b>Normal move (z).</b> We divide each move by how much the asset usually moves in a day, using only the year before. z of 1 is an ordinary day, 2 is unusual, 3 or more is rare.</li>
        <li><b>Event study.</b> Every day with a matching headline is one event. We line them up on the day of the news and average what happened next, then do the same for random days. The gap between the two is what the news might add.</li>
        <li><b>N.</b> How many events. Below 20, treat any pattern as a hint at most.</li>
        <li><b>Hit rate.</b> How often the asset was up afterwards, next to how often it is up on random days.</li>
        <li><b>q.</b> How likely a pattern this strong is by chance after correcting for the many topics and assets we tried. Lower is stronger. Above 0.10, assume it is noise.</li>
        <li><b>Overlap.</b> Events less than 20 trading days apart share part of their paths, which makes the band look tighter than it is.</li>
        <li><b>Not a prediction.</b> This is what happened after past headlines. Many things happen on the same day, and headlines are often written to explain a move after it happened.</li>
      </ul>
    </details>
  );
}

function rankCols(kind: "asset" | "topic", onPick: (id: string) => void): Column<RankRow>[] {
  return [
    { key: "l", header: kind === "asset" ? "Asset" : "Topic", render: (r) => <button className="news-linkbtn"onClick={() => onPick((kind === "asset" ? r.asset : r.topic) ?? "")}>{r.label}</button> },
    { key: "e", header: "Evidence", sort: (r) => r.q ?? 9, render: (r) => evidenceWord(r.q, r.n_events) },
    { key: "n", header: "N", align: "right", sort: (r) => r.n_events, render: (r) => r.n_events },
    { key: "z", header: "Avg z, 5 days", align: "right", sort: (r) => r.mean_z ?? 0, tone: (r) => r.mean_z, render: (r) => num(r.mean_z) },
    { key: "hr", header: "Up after (random)", align: "right", render: (r) => `${pct(r.hit_rate)} (${pct(r.random_hit_rate)})` },
    { key: "q", header: "q", align: "right", sort: (r) => r.q ?? 9, render: (r) => num(r.q, 3) },
  ];
}

function TopicStudy({ doc, topic, assetKey, unit, label, onAsset }: { doc: ImpactDoc; topic: string; assetKey: string; unit: Unit; label: string; onAsset: (k: string) => void }) {
  const st: Study | undefined = doc.studies[topic]?.[assetKey];
  const tLabel = doc.topics.find((t) => t.id === topic)?.label ?? topic;
  const rank = doc.by_topic[topic];
  if (!st) return <EmptyState title="No study">Nothing computed for this pair.</EmptyState>;
  return (
    <div className="news-study">
      <Card title={`${label} after "${tLabel}"`} help={`${st.n_headlines} headlines on ${st.n_events} separate days${st.first ? `, ${st.first.slice(0, 4)} to ${st.last?.slice(0, 4)}` : ""}.`}>
        {st.path && st.horizons ? (
          <>
            <PathChart study={st} />
            <HorizonTable study={st} unit={unit} />
          </>
        ) : <p className="muted">Fewer than 5 events, so there is nothing to average. The archive grows every hour.</p>}
        <Warnings list={st.warnings} />
      </Card>
      {st.events?.length ? (
        <Card title="The events with the biggest 5 day moves" help="Each row is one day. Overlap means another event came less than 20 trading days before.">
          <EventTable rows={st.events} unit={unit} h="5d" />
        </Card>
      ) : null}
      {rank ? (
        <Card title={`Which assets react most to "${tLabel}"`} help={`Ranked by evidence. ${rank.tried} comparisons were tried, and q corrects for that.`}>
          <DataTable rows={rank.rows} columns={rankCols("asset", onAsset)} rowKey={(r) => r.asset ?? r.label} dense />
          <Warnings list={rank.warnings} />
        </Card>
      ) : null}
    </div>
  );
}

function HorizonTable({ study, unit }: { study: Study; unit: Unit }) {
  const rows = (["1d", "5d", "20d"] as StudyHorizon[]).map((k) => ({ k, ...study.horizons![k] }));
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "k", header: "After", render: (r) => ({ "1d": "1 day", "5d": "5 days", "20d": "20 days" })[r.k] },
    { key: "n", header: "N", align: "right", render: (r) => r.n },
    { key: "z", header: "Avg z (95% band)", align: "right", tone: (r) => r.mean_z, render: (r) => `${num(r.mean_z)} (${num(r.ci_lo)} to ${num(r.ci_hi)})` },
    { key: "m", header: "Median z", align: "right", render: (r) => num(r.median_z) },
    { key: "mv", header: "Avg move", align: "right", render: (r) => moveText(r.mean_move, unit) },
    { key: "hr", header: "Up after (random)", align: "right", render: (r) => `${pct(r.hit_rate)} (${pct(r.random_hit_rate)})` },
    { key: "no", header: "No-overlap avg z", align: "right", render: (r) => `${num(r.mean_z_non_overlapping)} (N ${r.n_non_overlapping})` },
    { key: "q", header: "Evidence (q)", align: "right", render: (r) => `${evidenceWord(r.q, study.n_events)} (${num(r.q, 3)})` },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(r) => r.k} dense />;
}

function EventTable({ rows, unit, h }: { rows: StudyEvent[]; unit: Unit; h: StudyHorizon }) {
  const z = (e: StudyEvent) => e[`z_${h}` as const];
  const mv = (e: StudyEvent) => e[`move_${h}` as const];
  const cols: Column<StudyEvent>[] = [
    { key: "d", header: "Day", sort: (e) => e.event_date ?? e.base_date, render: (e) => <>{e.event_date ?? e.base_date}{e.overlaps ? <> <Badge>overlap</Badge></> : null}</>, width: 130 },
    { key: "m", header: `Move, ${h}`, align: "right", sort: (e) => mv(e) ?? 0, tone: (e) => mv(e), render: (e) => moveText(mv(e), unit) },
    { key: "z", header: "How unusual", align: "right", sort: (e) => Math.abs(z(e) ?? 0), render: (e) => <span title={zWord(z(e))}>{zText(z(e))}</span> },
    { key: "t", header: "Headlines that day", render: (e) => <><Headlines items={e.items} />{e.n_headlines > e.items.length ? <span className="muted">and {e.n_headlines - e.items.length} more</span> : null}</> },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(e) => e.base_date} dense />;
}

function AssetMoves({ doc, assetKey, unit, label, from, to, setFrom, setTo, h, setH, onTopic }: {
  doc: ImpactDoc; assetKey: string; unit: Unit; label: string; from: string; to: string;
  setFrom: (v: string) => void; setTo: (v: string) => void; h: StudyHorizon; setH: (h: StudyHorizon) => void; onTopic: (t: string) => void;
}) {
  const m = doc.moves[assetKey];
  const years = Object.keys(m?.days_per_year ?? {}).sort();
  const lo = from || years[0] || "";
  const hi = to || years.at(-1) || "";
  const days = (m?.days ?? []).filter((d) => { const y = (d.event_date ?? d.base_date).slice(0, 4); return y >= lo && y <= hi; });
  const z = (e: StudyEvent) => e[`z_${h}` as const];
  const top = [...days].filter((d) => z(d) != null).sort((a, b) => Math.abs(z(b)!) - Math.abs(z(a)!)).slice(0, 25);
  const checked = years.filter((y) => y >= lo && y <= hi).reduce((s, y) => s + (m?.days_per_year[y] ?? 0), 0);
  const chance = m?.share_all_days_z2 != null ? Math.round(checked * m.share_all_days_z2) : null;
  const yearOpts = years.map((y) => [y, y] as [string, string]);
  const rank = doc.by_asset[assetKey];
  return (
    <div className="news-study">
      <FilterBar>
        <Select label="From year" value={lo} onChange={setFrom} options={yearOpts} />
        <Select label="To year" value={hi} onChange={setTo} options={yearOpts} />
        <Segmented label="Window" size="sm" value={h} onChange={setH} options={[["1d", "1 day"], ["5d", "5 days"], ["20d", "20 days"]]} />
      </FilterBar>
      <Card title={`News days followed by the biggest unusual moves in ${label}`} help={`${checked.toLocaleString()} days with news about this asset in ${lo} to ${hi}. Days, not headlines: news on the same day shares one move.`}>
        {chance != null ? <p className="muted">By chance alone, about {chance} of those {checked} days would show a move of 2 normal moves or more, because {pct(m!.share_all_days_z2)} of all days do. The top of this list is partly luck.</p> : null}
        {top.length ? <EventTable rows={top} unit={unit} h={h} /> : <p className="muted">No news days about this asset in these years yet.</p>}
      </Card>
      {rank ? (
        <Card title={`Which kinds of news came before the most unusual moves in ${label}`} help={`Ranked by evidence over 5 days. ${rank.tried} comparisons were tried, and q corrects for that.`}>
          <DataTable rows={rank.rows} columns={rankCols("topic", onTopic)} rowKey={(r) => r.topic ?? r.label} dense />
          <Warnings list={rank.warnings} />
        </Card>
      ) : null}
    </div>
  );
}

// A small chart of the average path in normal moves, days -5 to +20 around the news,
// with its 95% band and the band random days fall in.
function PathChart({ study }: { study: Study }) {
  const p = study.path!;
  const W = 640, H = 220, L = 40, R = 12, T = 12, B = 28;
  const vals = [...p.lo_z, ...p.hi_z, ...p.random_lo_z, ...p.random_hi_z, ...p.mean_z].filter((v): v is number => v != null);
  const lo = Math.min(-1, ...vals), hi = Math.max(1, ...vals);
  const x = (k: number) => L + ((k - p.k[0]) / (p.k.at(-1)! - p.k[0])) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (vs: (number | null)[]) => vs.map((v, i) => (v == null ? "" : `${i && vs[i - 1] != null ? "L" : "M"}${x(p.k[i]).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const band = (a: (number | null)[], b: (number | null)[]) => {
    const idx = p.k.map((_, i) => i).filter((i) => a[i] != null && b[i] != null);
    if (!idx.length) return "";
    return `M${idx.map((i) => `${x(p.k[i]).toFixed(1)},${y(a[i]!).toFixed(1)}`).join("L")}L${[...idx].reverse().map((i) => `${x(p.k[i]).toFixed(1)},${y(b[i]!).toFixed(1)}`).join("L")}Z`;
  };
  const ticks = [lo, 0, hi].map((v) => Math.round(v * 10) / 10);
  return (
    <figure className="news-path">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average path after the news in normal moves, with a 95% band and the range for random days">
        <path d={band(p.random_lo_z, p.random_hi_z)} fill="var(--grid)" opacity={0.9} />
        <path d={band(p.lo_z, p.hi_z)} fill="var(--accent-soft)" />
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
        <line x1={x(0)} x2={x(0)} y1={T} y2={H - B} stroke="var(--axis)" strokeDasharray="3 3" />
        <path d={line(p.median_z)} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={line(p.mean_z)} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {ticks.map((t) => <text key={t} x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.7}>{t}</text>)}
        {[p.k[0], 0, 5, 10, 20].map((k) => <text key={k} x={x(k)} y={H - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>{k === 0 ? "news" : k > 0 ? `+${k}d` : `${k}d`}</text>)}
      </svg>
      <figcaption className="muted">Solid line: average. Dashed: median. Shaded blue: 95% band for the average. Grey: where the average of the same number of random days falls 95% of the time. In normal moves (z), not percent.</figcaption>
    </figure>
  );
}
