// LIB, the scenario library (DEC-0066): every kind of past event in the catalog and what
// markets did after it, from the engine's event study (`parity scenario export`, the
// `library` block). Each cell says how many events it rests on, a 90% range for the
// median, and whether the direction held across past cases. History, not a forecast.
import { useMemo } from "react";
import { fmtChange, humanize, type HorizonKey, type LibraryCell, type LibraryEntry, type ScenarioData } from "../../lib/scenarios";
import { useAsOf, useLoad, useOpt, useTerm } from "../context";
import { getScen } from "../data";
import { shortDate, tone } from "../fmt";
import { Empty, Loading, Seg, TTable, type TCol } from "../tui";

const HORIZONS: [HorizonKey, string][] = [["1d", "1D"], ["1w", "1W"], ["1m", "1M"], ["3m", "3M"]];
const HEADLINE = "sp500";

export function LibraryPanel() {
  const scen = useLoad(getScen);
  useAsOf(scen.status === "ok" ? scen.data.data_through : null);
  if (scen.status === "loading") return <Loading what="Loading past events" />;
  if (scen.status !== "ok") return <Empty title={scen.status === "missing" ? "No scenario data yet" : "Could not load past events"}>{scen.message}</Empty>;
  if (!scen.data.library) return <Empty title="No library in this file yet">The scenario file predates the library. It appears after the next `parity scenario export`.</Empty>;
  return <Library data={scen.data} />;
}

interface KindRow { key: string; entry: LibraryEntry; family: string }

function Library({ data }: { data: ScenarioData }) {
  const t = useTerm();
  const lib = data.library!;
  const [kind, setKind] = useOpt("kind", Object.keys(lib.types)[0] ?? "");
  const [h, setH] = useOpt("h", "1m");
  const [scope, setScope] = useOpt("scope", "type");
  const horizon = h as HorizonKey;
  const fam = data.matcher.families;

  const kinds: KindRow[] = useMemo(() => Object.entries(lib.types).map(([key, entry]) => ({ key, entry, family: fam[key] ?? "" })), [lib, fam]);
  const sel = kinds.find((k) => k.key === kind) ?? kinds[0];
  const entry = sel ? (scope === "family" ? lib.families[sel.family] ?? sel.entry : sel.entry) : null;
  const byId = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data]);

  const kindCols: TCol<KindRow>[] = [
    { key: "k", label: "Kind", align: "left", sort: (r) => humanize(r.key), render: (r) => <span className="term-sym">{humanize(r.key)}</span> },
    { key: "n", label: "Events", sort: (r) => r.entry.count, render: (r) => r.entry.count },
    { key: "span", label: "Years", render: (r) => `${r.entry.first?.slice(0, 4) ?? "n/a"} to ${r.entry.last?.slice(0, 4) ?? "n/a"}`, className: "c-label" },
    {
      key: "s", label: `Stocks ${horizon.toUpperCase()}`, title: "Median move of US stocks after these events",
      sort: (r) => r.entry.assets[HEADLINE]?.[horizon]?.median, render: (r) => <Median c={r.entry.assets[HEADLINE]?.[horizon]} measure="pct" />,
    },
    { key: "c", label: "Rests on", sort: (r) => r.entry.assets[HEADLINE]?.[horizon]?.n, render: (r) => <Conf c={r.entry.assets[HEADLINE]?.[horizon]} />, className: "c-m1" },
  ];

  interface AssetRow { key: string; label: string; measure: "pct" | "points" | "bp"; c: LibraryCell | undefined }
  const assetRows: AssetRow[] = entry ? data.assets.map((a) => ({ key: a.key, label: a.label, measure: a.measure, c: entry.assets[a.key]?.[horizon] })).filter((r) => r.c) : [];
  const assetCols: TCol<AssetRow>[] = [
    { key: "m", label: "Market", align: "left", sort: (r) => r.label, render: (r) => <span className="term-name strong">{r.label}</span> },
    { key: "med", label: "Median", sort: (r) => r.c?.median, render: (r) => <Median c={r.c} measure={r.measure} /> },
    { key: "iqr", label: "Middle half", render: (r) => (r.c ? `${fmtChange(r.c.q25, r.measure)} to ${fmtChange(r.c.q75, r.measure)}` : "n/a"), className: "c-ytd" },
    { key: "up", label: "Up in", title: "Events after which it was higher (currencies: stronger against the dollar)", sort: (r) => r.c?.up, render: (r) => (r.c ? `${Math.round(r.c.up * r.c.n)} of ${r.c.n}` : "n/a") },
    {
      key: "ci", label: "90% range of median", title: "A range that holds the typical move with 90% confidence, from the order of the past moves; needs at least 5 events",
      render: (r) => (r.c?.ci ? `${fmtChange(r.c.ci[0], r.measure)} to ${fmtChange(r.c.ci[1], r.measure)}` : "too few"), className: "c-vol",
    },
    { key: "held", label: "Direction", sort: (r) => r.c?.held ?? "", render: (r) => <Held c={r.c} /> },
    { key: "conf", label: "Rests on", sort: (r) => r.c?.n, render: (r) => <Conf c={r.c} />, className: "c-pct" },
  ];

  const evs = entry ? entry.events.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e).reverse() : [];
  const regions = entry ? Object.entries(entry.regions).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, n]) => `${humanize(r)} ${n}`).join(", ") : "";

  return (
    <div className="term-col term-lib">
      <div className="term-bar">
        <Seg label="Horizon" value={horizon} onChange={(v) => setH(v)} options={HORIZONS} />
        <Seg label="Scope" value={scope as "type" | "family"} onChange={setScope} options={[["type", "This kind"], ["family", "Whole family"]]} />
        <span className="term-bar-note">{kinds.length} kinds, {data.events.length} events · history, not a forecast</span>
      </div>
      <div className="term-lib-grid">
        <div className="term-lib-kinds">
          <TTable rows={kinds} cols={kindCols} rowKey={(r) => r.key} onPick={(r) => setKind(r.key)} picked={sel?.key} caption="Kinds of past event" initial={{ key: "n", dir: "desc" }} />
        </div>
        <div className="term-lib-detail term-scroll">
          {sel && entry && (
            <>
              <div className="term-lib-head">
                <span className="term-sym big">{scope === "family" ? `${humanize(sel.family)} family` : humanize(sel.key)}</span>
                <span className="term-bar-note">{entry.count} events, {entry.first?.slice(0, 4)} to {entry.last?.slice(0, 4)}{regions ? ` · ${regions}` : ""}</span>
                <span className="term-bar-fill" />
                <button type="button" className="term-mini" onClick={() => { t.setSpec((s) => ({ ...s, title: humanize(sel.key), type: sel.key, regions: [], actors: [], severity: 0, commodities: [] })); t.open("SCEN"); }}>
                  Play as scenario
                </button>
              </div>
              <TTable rows={assetRows} cols={assetCols} rowKey={(r) => r.key} caption={`What markets did ${HORIZONS.find((x) => x[0] === horizon)?.[1]} after ${humanize(sel.key)} events`} />
              <p className="term-lib-note">
                Moves run from the last close before each event. Direction says up or down only when the whole 90% range is on one side of zero.
                Rests on: {lib.confidence.map((c) => `${c.word} ${c.min ? `from ${c.min}` : "below 5"}`).join(", ")} events.
                {sel.key === "crypto_crash" ? " We hold no crypto prices this far back, so this shows what other markets did." : ""}
              </p>
              <ol className="term-lib-events" aria-label="The past events">
                {evs.map((e) => (
                  <li key={e.id}>
                    <span className="term-lib-date">{shortDate(e.date)}</span>
                    <span className="term-lib-name">{e.name}{scope === "family" && e.type !== sel.key ? <span className="term-tag">{humanize(e.type)}</span> : null}</span>
                    <span className="term-lib-desc">{e.description}</span>
                    {e.sources[0] && <a className="term-lib-src" href={e.sources[0].url} target="_blank" rel="noopener noreferrer">{e.sources[0].publisher}</a>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Median({ c, measure }: { c: LibraryCell | undefined; measure: "pct" | "points" | "bp" }) {
  if (!c) return <span className="muted">n/a</span>;
  return <span className={tone(c.median)}>{fmtChange(c.median, measure)}</span>;
}

function Conf({ c }: { c: LibraryCell | undefined }) {
  if (!c) return <span className="muted">n/a</span>;
  return <span className={`term-conf ${c.confidence.replace(" ", "-")}`}>{c.n} · {c.confidence}</span>;
}

function Held({ c }: { c: LibraryCell | undefined }) {
  if (!c || !c.held) return <span className="muted">too few</span>;
  return <span className={c.held === "up" ? "up" : c.held === "down" ? "down" : "muted"}>{c.held === "mixed" ? "mixed" : `held ${c.held}`}</span>;
}
