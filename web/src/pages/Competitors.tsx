// Competitor profiles on the research side (DEC-0047, CMP docs): for each trading product
// we study, what public feedback praises and complains about, by theme, with a monthly
// trend, and what Parity takes from it. The words come from the CMP docs; the counts come
// from the feedback collector the sims service runs once a day.
import { useEffect, useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { Html } from "../ui";
import { plainWords, sectionHtml, useDocs, type DocEntry } from "../lib/docs";
import { GROUPS, loadProfiles, praiseShare, PRODUCTS, SOURCE_LABELS, type ProductSignals, type ProfilesDoc, type TrendPoint } from "../lib/profiles";
import { Banner } from "./markets/shared";
import "./markets/markets.css";
import "./Competitors.css";

const COMPARISON = "CMP-0001";
/** Below this many items a product is too thin to rank (the CMP docs use the same line). */
const MIN_RANK = 20;

export function Competitors({ focus }: { focus?: string }) {
  const [doc, setDoc] = useState<ProfilesDoc | null | undefined>(undefined);
  const docs = useDocs();
  const [group, setGroup] = useState<string>("all");
  useEffect(() => { loadProfiles().then(setDoc); }, []);
  const selected = PRODUCTS.find((p) => p.id === focus) ?? null;
  const rows = PRODUCTS.filter((p) => group === "all" || p.group === group);
  const comparison = docs?.byId[COMPARISON];

  return (
    <div className="mk cmp">
      <div className="page-head mk-head">
        <Title label="Competitors">Competitors</Title>
        <p>{PRODUCTS.length} trading products we study. For each: what public posts praise and complain about, counted by theme, and what we take from it for Trade, Terminal, Verify, Workbench and Academy.</p>
        <p className="small">
          {doc ? <>{doc.items.toLocaleString()} public items, last collected {ago(doc.last_pass_at)}. </> : null}
          Method and sources: <a href={`#/doc/${COMPARISON}`}>{COMPARISON}</a>. Each product has a full profile.
        </p>
      </div>
      {doc === null && <Banner><strong>No feedback counts yet.</strong> The collector runs once a day in the sims service, or by hand with <code>parity profiles collect</code>.</Banner>}
      {doc && <Patterns doc={doc} />}
      {selected && <Detail id={selected.id} docEntry={docs?.byId[selected.doc]} sig={doc?.products[selected.id]} />}
      <section className="mk-card">
        <div className="mk-card-head">
          <h2>Products</h2>
          <div className="cmp-chips" role="group" aria-label="Filter by kind">
            {["all", ...Object.keys(GROUPS)].map((g) => (
              <button key={g} type="button" className={`chip ${group === g ? "on" : ""}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g === "all" ? "All" : GROUPS[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="mk-table-scroll">
          <table className="mtable dense">
            <thead>
              <tr><th scope="col">Product</th><th scope="col" className="num">Items</th><th scope="col" className="num">Praise share</th><th scope="col">Most praised</th><th scope="col">Most complained about</th><th scope="col">12 months</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const s = doc?.products[p.id];
                const share = s && s.feedback >= MIN_RANK ? praiseShare(s) : null;
                return (
                  <tr key={p.id} className={selected?.id === p.id ? "on" : undefined}>
                    <th scope="row"><a className="comp-name" href={`#/competitors/${p.id}`}>{p.name}</a> <span className="muted small">{GROUPS[p.group]}</span></th>
                    <td className="num">{s ? s.feedback.toLocaleString() : "n/a"}</td>
                    <td className="num">{share == null ? "n/a" : `${Math.round(share * 100)}%`}</td>
                    <td>{s && s.feedback >= MIN_RANK && s.praised[0] ? `${s.praised[0].label} (${s.praised[0].count})` : "n/a"}</td>
                    <td>{s && s.feedback >= MIN_RANK && s.complaints[0] ? `${s.complaints[0].label} (${s.complaints[0].count})` : "n/a"}</td>
                    <td>{s ? <Spark trend={s.trend} /> : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">Praise share: posts scored as praise out of posts scored as praise or complaint. Products with fewer than 20 items are too thin to rank.</p>
      </section>
      {comparison && <Takeaways entry={comparison} />}
      {doc && (
        <p className="small muted cmp-method">
          {doc.method} Sources: {Object.entries(doc.sources ?? {}).map(([k, v]) => `${SOURCE_LABELS[k] ?? k} ${v.status === "ok" || v.status === "partial" ? `(${v.items.toLocaleString()})` : `(${v.status})`}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

function Patterns({ doc }: { doc: ProfilesDoc }) {
  const top = doc.patterns.filter((p) => p.praise > 0).slice(0, 10);
  const max = Math.max(1, ...top.map((p) => p.praise + p.complaints));
  return (
    <section className="mk-card">
      <h2>What users praise most, across every product</h2>
      <p className="small">Themes ranked by how many public posts praise them. Complaints are shown beside each. "Products" counts the products where the theme is among the five most praised.</p>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead><tr><th scope="col">Theme</th><th scope="col" className="num">Praise</th><th scope="col" className="num">Complaints</th><th scope="col" className="num">Products</th><th scope="col">Split</th></tr></thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.theme}>
                <th scope="row">{p.label}</th>
                <td className="num">{p.praise}</td>
                <td className="num">{p.complaints}</td>
                <td className="num">{p.products_praised}</td>
                <td><span className="cmp-split" aria-hidden="true"><span className="good" style={{ width: `${(p.praise / max) * 100}%` }} /><span className="bad" style={{ width: `${(p.complaints / max) * 100}%` }} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Detail({ id, docEntry, sig }: { id: string; docEntry?: DocEntry; sig?: ProductSignals }) {
  const p = PRODUCTS.find((x) => x.id === id)!;
  const copy = useMemo(() => (docEntry ? sectionHtml(docEntry, "what-parity-should-copy-avoid-or-beat") : null), [docEntry]);
  const plain = useMemo(() => (docEntry ? plainWords(docEntry) : ""), [docEntry]);
  const share = sig ? praiseShare(sig) : null;
  return (
    <section className="mk-card cmp-detail" aria-label={p.name}>
      <div className="mk-card-head">
        <h2>{p.name}</h2>
        <a href={`#/doc/${p.doc}`}>Full profile, {p.doc}</a>
      </div>
      {plain && <Html className="cmp-plain" html={plain} />}
      {sig && (
        <>
          <p className="small">
            {sig.feedback.toLocaleString()} items: {sig.positive} praise, {sig.negative} complaints, {sig.neutral} neither
            {share != null && <>. Praise share {Math.round(share * 100)}%</>}
            {sig.net_30d != null && <>. Mood score last 30 days {sig.net_30d.toFixed(2)}{sig.net_prev_30d != null && <>, the 30 before {sig.net_prev_30d.toFixed(2)}</>}</>}.
            {" "}By source: {Object.entries(sig.by_source).map(([k, n]) => `${SOURCE_LABELS[k] ?? k} ${n}`).join(", ") || "none"}.
          </p>
          <div className="cmp-two">
            <ThemeList title="Most praised" rows={sig.praised} tone="good" />
            <ThemeList title="Most complained about" rows={sig.complaints} tone="bad" />
          </div>
          <div className="cmp-trend">
            <h3>Items a month, praise above and complaints below</h3>
            <Bars trend={sig.trend} />
          </div>
          <p className="small">
            {sig.apps.length > 0 && <>App Store: {sig.apps.map((a) => `${a.rating?.toFixed(2) ?? "n/a"} stars from ${a.count?.toLocaleString() ?? "n/a"} ratings`).join("; ")}. </>}
            Releases in the last 90 days: {sig.releases_90d}. Status page incidents: {sig.incidents_90d}
            {sig.last_incident && <>, newest {sig.last_incident.at.slice(0, 10)}: {sig.last_incident.title}</>}.
          </p>
        </>
      )}
      {copy && <Html className="cmp-copy" html={copy.replace(/^<h2[^>]*>[\s\S]*?<\/h2>/, "<h3>What Parity should copy, avoid or beat</h3>")} />}
    </section>
  );
}

function ThemeList({ title, rows, tone }: { title: string; rows: { theme: string; label: string; count: number }[]; tone: "good" | "bad" }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="small muted">n/a</p> : (
        <ul className="cmp-themes">
          {rows.map((r) => (
            <li key={r.theme}><span>{r.label}</span><span className="num">{r.count}</span><span className={`cmp-bar ${tone}`} style={{ width: `${(r.count / max) * 100}%` }} aria-hidden="true" /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spark({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.map((t) => t.items));
  const total = trend.reduce((a, t) => a + t.items, 0);
  return (
    <svg className="cmp-spark" viewBox={`0 0 ${trend.length * 6} 20`} role="img" aria-label={`${total} items in the last ${trend.length} months`}>
      {trend.map((t, i) => {
        const h = (t.items / max) * 18;
        const net = t.positive - t.negative;
        return <rect key={t.month} x={i * 6} y={20 - h} width={4} height={Math.max(h, t.items ? 1 : 0)} className={net > 0 ? "good" : net < 0 ? "bad" : "flat"} />;
      })}
    </svg>
  );
}

function Bars({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(1, ...trend.flatMap((t) => [t.positive, t.negative]));
  return (
    <div className="cmp-bars" role="img" aria-label={trend.map((t) => `${t.month}: ${t.positive} praise, ${t.negative} complaints`).join("; ")}>
      {trend.map((t) => (
        <div key={t.month} className="cmp-col" title={`${t.month}: ${t.items} items, ${t.positive} praise, ${t.negative} complaints`}>
          <span className="up"><i className="good" style={{ height: `${(t.positive / max) * 100}%` }} /></span>
          <span className="down"><i className="bad" style={{ height: `${(t.negative / max) * 100}%` }} /></span>
          <span className="lbl">{t.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function Takeaways({ entry }: { entry: DocEntry }) {
  const html = sectionHtml(entry, "what-parity-should-copy-avoid-or-beat");
  if (!html) return null;
  return (
    <section className="mk-card">
      <Html className="cmp-copy" html={html.replace(/^<h2[^>]*>[\s\S]*?<\/h2>/, "<h2>What Parity takes from all 22</h2>")} />
    </section>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 120) return `${Math.max(0, Math.round(mins))} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} hours ago`;
  return `${Math.round(mins / 1440)} days ago`;
}
