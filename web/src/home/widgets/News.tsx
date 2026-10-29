// Market news (DEC-0075): a lead story and a grid of smaller ones from our news feed. Each says
// the market it is about, the region, how big the move was against a usual day, when and who.
// The lead picture is our own chart of the market's path after the headline, drawn by the
// signature chart system from the feed's real prices. We do not show publishers' images: the
// feed stores no image and no source's terms we read cover showing one.
import { useMemo } from "react";
import { loadNews, moveText, zWord, type Article, type Horizon } from "../../lib/news";
import { useResource } from "../../ui/resource";
import { SignatureFrame, type SigVisual } from "../../ui/signature";
import { age, Empty, Src } from "./common";

const HORIZONS: Horizon[] = ["1h", "1d", "1w"];

function lead(a: Article) {
  const imp = a.primary ? a.impacts[a.primary] : Object.values(a.impacts)[0];
  return imp ?? null;
}
const size = (a: Article) => Math.abs(lead(a)?.["1d"]?.z ?? lead(a)?.["1h"]?.z ?? 0);

function Tags({ a }: { a: Article }) {
  const imp = lead(a);
  const z = imp?.["1d"]?.z ?? imp?.["1h"]?.z ?? null;
  return (
    <span className="nw-tags">
      {imp && <span className="tag">{imp.label}</span>}
      {a.regions[0] && <span className="tag">{a.regions[0]}</span>}
      {z != null && <span className={`tag ${Math.abs(z) >= 2 ? "tag-big" : ""}`}>{zWord(z)}</span>}
    </span>
  );
}

function Moves({ a }: { a: Article }) {
  const imp = lead(a);
  if (!imp) return null;
  return (
    <span className="nw-moves">
      {HORIZONS.map((h) => {
        const m = imp[h];
        return m?.move != null ? <span key={h}><span className="wl-sub">{h === "1h" ? "1 hour" : h === "1d" ? "1 day" : "1 week"}</span> <b className={m.move >= 0 ? "good" : "bad"}>{moveText(m.move, imp.unit)}</b></span> : null;
      })}
    </span>
  );
}

export default function News() {
  const doc = useResource("home:news", loadNews, { maxAge: 5 * 60_000 });
  const recent = useMemo(() => [...(doc.data?.articles ?? [])].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 40), [doc.data]);
  const by = (a: Article) => a.publisher || doc.data?.sources.find((x) => x.id === a.source)?.name || a.source;
  // The lead: the biggest move among the 12 newest stories that have a price path.
  const hero = useMemo(() => [...recent.slice(0, 12)].filter((a) => a.path?.length > 2).sort((a, b) => size(b) - size(a))[0] ?? recent[0], [recent]);
  const rest = recent.filter((a) => a !== hero).slice(0, 6);
  const visual = useMemo<SigVisual | null>(() => {
    if (!hero?.path?.length) return null;
    const imp = lead(hero);
    // The path is the change from the last close before the headline, in the impact's unit.
    const pctUnit = !imp || imp.unit === "pct";
    return {
      kind: "equity", alt: `${imp?.label ?? "Market"}, change from the last close before the headline`,
      params: { fmt: pctUnit ? "pctSigned1" : "num2", series: [{ label: imp?.label ?? "Market", values: hero.path.map((p) => (pctUnit ? p[1] / 100 : p[1])) }] },
      steps: [{ caption: "", par: 0 }],
    };
  }, [hero]);
  if (doc.error && !recent.length) return <Empty>News has not been published yet.</Empty>;
  if (!hero) return null;
  return (
    <>
      <div className="nw">
        <article className="nw-hero">
          {visual && (
            <div className="nw-pic" role="img" aria-label={`Chart: ${visual.alt}, from our price data`}>
              <SignatureFrame visual={visual} s={0} size="lesson" />
            </div>
          )}
          <div className="nw-hero-t">
            <Tags a={hero} />
            <a href={hero.url} target="_blank" rel="noopener" className="nw-title">{hero.title}</a>
            {hero.summary && <p className="nw-sum">{hero.summary}</p>}
            <span className="wl-sub">{by(hero)}, {age(hero.published_at)}</span>
            <Moves a={hero} />
          </div>
        </article>
        <ul className="nw-grid">
          {rest.map((a) => (
            <li key={a.id} className="nw-card">
              <Tags a={a} />
              <a href={a.url} target="_blank" rel="noopener" className="nw-card-t">{a.title}</a>
              <span className="wl-sub">{by(a)}, {age(a.published_at)}</span>
              <Moves a={a} />
            </li>
          ))}
        </ul>
      </div>
      <Src>Moves are measured after each headline from our price data, against that market's usual move. <a href="#/news">All news</a></Src>
    </>
  );
}
