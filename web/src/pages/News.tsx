// News: newest headlines from sources whose terms let us show them, how markets moved
// afterwards, and the biggest market days since 1999 with the news for each.
import { useEffect, useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { Badge, Card, DataTable, Drawer, EmptyState, FilterBar, Icon, LineChart, SearchInput, Segmented, Select, Tabs, type Column } from "../ui";
import { loadNews, loadRecords, moveText, zText, zWord, type Article, type Horizon, type Impact, type NewsDoc, type RecordDay, type RecordsDoc } from "../lib/news";

type View = "latest" | "history";
type SortKey = "newest" | "oldest" | "biggest";

const CATEGORY_LABEL: Record<string, string> = {
  "central-bank": "Central banks", "macro-data": "Economic data", energy: "Energy", markets: "Markets",
  regulation: "Regulation", geopolitics: "Geopolitics", earnings: "Earnings",
};

export function News({ view: initial }: { view?: string }) {
  const [view, setView] = useState<View>(initial === "history" ? "history" : "latest");
  useEffect(() => { setView(initial === "history" ? "history" : "latest"); }, [initial]);
  const go = (v: View) => { window.location.hash = v === "history" ? "#/news/history" : "#/news"; };
  return (
    <>
      <div className="page-head">
        <Title label="News">News and market moves</Title>
        <p>The newest headlines from central banks, government statistics offices and an open news index, and how markets
          moved afterwards compared with a normal day. A big move after a headline does not prove the headline caused it.</p>
      </div>
      <Tabs label="News view" value={view} onChange={go} tabs={[["latest", "Latest"], ["history", "Biggest days in history"]]} />
      <div style={{ height: 16 }} />
      {view === "latest" ? <Latest /> : <History />}
    </>
  );
}

// ------------------------------------------------------------------ latest

function Latest() {
  const [doc, setDoc] = useState<NewsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [ccy, setCcy] = useState("");
  const [cmd, setCmd] = useState("");
  const [region, setRegion] = useState("");
  const [src, setSrc] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [horizon, setHorizon] = useState<Horizon>("1d");
  const [open, setOpen] = useState<Article | null>(null);

  useEffect(() => { loadNews().then(setDoc).catch((e: Error) => setError(e.message)); }, []);

  const arts = doc?.articles ?? [];
  const opts = (vals: string[], all: string, label = (v: string) => v): [string, string][] =>
    [["", all], ...[...new Set(vals)].sort().map((v) => [v, label(v)] as [string, string])];
  const srcName = (id: string) => doc?.sources.find((s) => s.id === id)?.name ?? id;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = arts.filter((a) =>
      (!ccy || a.currencies.includes(ccy)) && (!cmd || a.commodities.includes(cmd)) &&
      (!region || a.regions.includes(region)) && (!src || a.source === src) && (!cat || a.category === cat) &&
      (!t || `${a.title} ${a.summary} ${a.publisher}`.toLowerCase().includes(t)));
    const size = (a: Article) => Math.abs(primaryMove(a, horizon)?.z ?? -1);
    return [...rows].sort((a, b) => sort === "biggest" ? size(b) - size(a) :
      sort === "oldest" ? a.published_at.localeCompare(b.published_at) : b.published_at.localeCompare(a.published_at));
  }, [arts, q, ccy, cmd, region, src, cat, sort, horizon]);

  if (error) return <EmptyState title="No news yet">{error}</EmptyState>;
  if (!doc) return <p className="muted">Loading news</p>;
  const count = [ccy, cmd, region, src, cat, q].filter(Boolean).length;
  const reset = () => { setCcy(""); setCmd(""); setRegion(""); setSrc(""); setCat(""); setQ(""); };

  return (
    <>
      <FilterBar count={count} onReset={reset} right={<SearchInput value={q} onChange={setQ} placeholder="Search headlines" />}>
        <Select label="Currency" value={ccy} onChange={setCcy} options={opts(arts.flatMap((a) => a.currencies), "All currencies")} />
        <Select label="Commodity" value={cmd} onChange={setCmd} options={opts(arts.flatMap((a) => a.commodities), "All commodities")} />
        <Select label="Region" value={region} onChange={setRegion} options={opts(arts.flatMap((a) => a.regions), "All regions")} />
        <Select label="Source" value={src} onChange={setSrc} options={opts(arts.map((a) => a.source), "All sources", srcName)} />
        <Select label="Category" value={cat} onChange={setCat} options={opts(arts.map((a) => a.category), "All categories", (c) => CATEGORY_LABEL[c] ?? c)} />
        <Select<SortKey> label="Sort" value={sort} onChange={setSort} options={[["newest", "Newest first"], ["oldest", "Oldest first"], ["biggest", "Most unusual move"]]} />
      </FilterBar>
      <div className="news-meta">
        <span className="muted small">{shown.length} of {arts.length} headlines · prices through {doc.prices_through ?? "n/a"} · updated {when(doc.generated_at)}</span>
        <Segmented<Horizon> label="Move measured over" size="sm" value={horizon} onChange={setHorizon}
          options={[["1d", "1 day"], ["1w", "1 week"], ["1m", "1 month"]]} />
      </div>
      {shown.length === 0 ? <EmptyState title="Nothing matches">Try removing a filter.</EmptyState> : (
        <ul className="news-list">
          {shown.map((a) => (
            <li key={a.id} className="news-item">
              <div className="news-main">
                <button className="news-title" onClick={() => setOpen(a)}>{a.title}</button>
                <div className="news-sub muted small">
                  <span>{srcName(a.source)}</span>
                  {a.publisher && <span>{a.publisher}</span>}
                  <time dateTime={a.published_at} title={a.published_at}>{when(a.published_at)}</time>
                </div>
                <div className="news-tags">
                  <Badge>{CATEGORY_LABEL[a.category] ?? a.category}</Badge>
                  {[...a.currencies, ...a.commodities].map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
                  {a.regions.slice(0, 2).map((r) => <Badge key={r}>{r}</Badge>)}
                </div>
              </div>
              <ImpactChip impact={a.primary ? a.impacts[a.primary] : undefined} horizon={horizon} />
            </li>
          ))}
        </ul>
      )}
      <Sources doc={doc} />
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Headline and market moves" width={600}>
        {open && <ArticleDetail a={open} doc={doc} />}
      </Drawer>
    </>
  );
}

function primaryMove(a: Article, h: Horizon) {
  return a.primary ? a.impacts[a.primary]?.[h] ?? null : null;
}

/** Signed move and z-score, with an arrow and a word, so it never relies on colour alone. */
function ImpactChip({ impact, horizon }: { impact?: Impact; horizon: Horizon }) {
  const m = impact?.[horizon];
  if (!impact || !m || m.move == null) {
    return <span className="impact-chip none" title="Not measured yet: the period has not finished, or we have no price series for this item.">{impact ? `${impact.label}: waiting for data` : "No matching series"}</span>;
  }
  const up = m.move > 0;
  const tone = Math.abs(m.z ?? 0) >= 2 ? (up ? "good" : "bad") : "flat";
  return (
    <span className={`impact-chip ${tone}`} title={`${impact.label} moved ${moveText(m.move, impact.unit)} over ${horizon} after the last close before this was published. ${zText(m.z)}: ${zWord(m.z)} compared with the year before.`}>
      <Icon name={up ? "arrowUpRight" : "arrowDownRight"} size={12} />
      <span className="impact-label">{impact.label}</span>
      <strong>{moveText(m.move, impact.unit)}</strong>
      <span>{zText(m.z)}</span>
      <span className="impact-word">{zWord(m.z)}</span>
    </span>
  );
}

function ArticleDetail({ a, doc }: { a: Article; doc: NewsDoc }) {
  const src = doc.sources.find((s) => s.id === a.source);
  const primary = a.primary ? a.impacts[a.primary] : undefined;
  const rows = Object.entries(a.impacts);
  return (
    <div className="news-detail">
      <h3>{a.title}</h3>
      <p className="muted small">{src?.name ?? a.source}{a.publisher ? ` · ${a.publisher}` : ""} · <time dateTime={a.published_at}>{new Date(a.published_at).toUTCString()}</time></p>
      {a.summary && <p>{a.summary}</p>}
      <p><a href={a.url} target="_blank" rel="noreferrer">Read it at the source <Icon name="external" size={12} /></a></p>
      {primary && a.path.length > 1 ? (
        <>
          <h4>{primary.label} around the headline</h4>
          <p className="muted small">Change from the close on {primary.base_date}, the last close before publication. Ten trading days before, up to a month after.</p>
          <LineChart label={`${primary.label} around the headline`} height={220} format={(v) => moveText(v, primary.unit, 1)}
            series={[{ name: primary.label, color: "var(--series-1)", points: a.path, emphasis: true }]} />
        </>
      ) : <p className="muted">No price path for this item yet.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="mtable dense">
            <thead><tr><th className="left">Series</th><th>1 hour</th><th>1 day</th><th>1 week</th><th>1 month</th></tr></thead>
            <tbody>
              {rows.map(([k, imp]) => (
                <tr key={k}>
                  <td className="left">{imp.label}</td>
                  {(["1h", "1d", "1w", "1m"] as Horizon[]).map((h) => {
                    const m = imp[h];
                    return <td key={h}>{m && m.move != null ? <>{moveText(m.move, imp.unit)}<br /><span className="muted small">{zText(m.z)}</span></> : <span className="muted">n/a</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">One hour moves need intraday prices, which we do not have yet. z is the move divided by the normal move
        over the same length of time in the year before, so 1 is ordinary and 3 is rare. Other news on the same day may explain the move.</p>
      {src && <p className="muted small">Licence: {src.licence}. <a href={src.terms_url} target="_blank" rel="noreferrer">Terms</a>.{!src.summary_stored && " We keep only the headline and link."}</p>}
    </div>
  );
}

function Sources({ doc }: { doc: NewsDoc }) {
  return (
    <Card title="Where the headlines come from" help="Only sources whose terms allow it. Sites that forbid automated collection, such as Robinhood and the Wall Street Journal, are not used.">
      <ul className="news-sources small">
        {doc.sources.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>: {s.licence}.{" "}
            {s.display === "yes" ? "Shown here." : s.display === "no" ? "Free plan is personal use only, so not shown on this shared site." : "Not shown until we confirm the terms allow it."}
            {s.key_env && ` Needs ${s.key_env}.`}{s.needs_contact && " Needs a contact address in our user agent."}{" "}
            <a href={s.terms_url} target="_blank" rel="noreferrer">Terms</a>
          </li>
        ))}
      </ul>
      <p className="muted small">GDELT headlines belong to each outlet; we show the headline and a link, never the article.</p>
    </Card>
  );
}

// ------------------------------------------------------------------ history

function History() {
  const [doc, setDoc] = useState<RecordsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState("eq.US_TOTAL");
  useEffect(() => { loadRecords().then(setDoc).catch((e: Error) => setError(e.message)); }, []);
  if (error) return <EmptyState title="No records yet">{error}</EmptyState>;
  if (!doc) return <p className="muted">Loading records</p>;
  const meta = doc.series.find((s) => s.key === series) ?? doc.series[0];
  const rows = doc.records.filter((r) => r.series === meta?.key);
  const columns: Column<RecordDay>[] = [
    { key: "rank", header: "#", sort: (r) => -r.rank, render: (r) => r.rank, align: "left", width: 40 },
    { key: "date", header: "Day", sort: (r) => r.date, render: (r) => r.date, align: "left", width: 110 },
    { key: "move", header: "Move", sort: (r) => Math.abs(r.move ?? 0), align: "right", width: 130,
      render: (r) => <span className={`impact-inline ${(r.move ?? 0) >= 0 ? "good" : "bad"}`}><Icon name={(r.move ?? 0) >= 0 ? "arrowUpRight" : "arrowDownRight"} size={12} />{moveText(r.move, r.unit)}</span> },
    { key: "z", header: "How unusual", sort: (r) => Math.abs(r.z ?? 0), align: "right", width: 150, render: (r) => <>{zText(r.z)} <span className="muted small">{zWord(r.z)}</span></> },
    { key: "news", header: "News that day", align: "left", render: (r) => r.news.length ? (
      <ul className="record-news">{r.news.slice(0, 3).map((n) => <li key={n.url}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> <span className="muted small">{n.publisher || n.source}</span></li>)}</ul>
    ) : <span className="muted small">{r.note}</span> },
  ];
  return (
    <>
      <FilterBar right={<span className="muted small">Prices through {doc.prices_through ?? "n/a"}</span>}>
        <Select label="Market" value={meta?.key ?? ""} onChange={setSeries} options={doc.series.map((s) => [s.key, s.label] as [string, string])} />
      </FilterBar>
      <p className="muted small">The 25 biggest one day moves since 1999, largest first. z compares each move with the year before it.
        Headlines come from sources we are allowed to show; GDELT's search starts in 2017, so older days have none yet.</p>
      <DataTable rows={rows} columns={columns} rowKey={(r) => `${r.series}-${r.date}`} initialSort={{ key: "rank", dir: "desc" }} caption={`Biggest days for ${meta?.label}`} />
    </>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins >= 0 && mins < 60) return `${mins} min ago`;
  if (mins >= 0 && mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
