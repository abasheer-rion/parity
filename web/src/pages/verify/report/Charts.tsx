// The report's pictures (DEC-0067, DEC-0089): each in its own card with a sentence from its
// numbers, played once as it scrolls into view (or still frames, by the Motion setting).
// A missing picture says why in its place. While printing, each draws its last step as a
// still on a light page.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pictureGaps, type ReportData } from "../../../lib/verify/report/model";
import { reportPictures } from "../../../lib/verify/report/visuals";
import { SignatureFrame, SignaturePlayer, type SigVisual } from "../../../ui/signature";
import { usePrintingNow } from "./print";

/** True once the box is within a screen or so of the viewport (always, where there is no IntersectionObserver). */
function useNear(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

/** A picture, drawn only when it comes near the screen, so a long report opens fast on a phone. */
function Pic({ visual }: { visual: SigVisual }) {
  const printing = usePrintingNow();
  const [ref, near] = useNear();
  if (!printing && !near) return <div ref={ref} className="rp-pic-wait sg-player" role="img" aria-label={visual.alt}><div className="sg-stage" /></div>;
  if (printing) {
    return (
      <figure className="rp-still" role="img" aria-label={visual.alt}>
        <SignatureFrame visual={visual} s={visual.steps.length - 1} size="lesson" theme="light" />
        <figcaption>{visual.steps[visual.steps.length - 1]?.caption}</figcaption>
      </figure>
    );
  }
  return <SignaturePlayer visual={visual} startAtEnd />;
}

function ChartCard({ id, title, lead, visual, gap, wide, children }: { id: string; title: string; lead: ReactNode; visual: SigVisual | null; gap: string | null; wide?: boolean; children?: ReactNode }) {
  return (
    <section className={`rp-card rp-chart${wide ? " rp-wide" : ""}`} aria-labelledby={`rp-${id}-h`} data-chart={id}>
      <h3 id={`rp-${id}-h`}>{title}</h3>
      {visual ? <><p className="rp-lead">{lead}</p><Pic visual={visual} /></> : <p className="rp-gap">{gap ?? "Not drawn for this record."}</p>}
      {children}
    </section>
  );
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export function ReportCharts({ data, signedOut }: { data: ReportData; signedOut: boolean }) {
  const pics = useMemo(() => reportPictures(data), [data]);
  const gaps = useMemo(() => pictureGaps(data, signedOut), [data, signedOut]);
  if (data.source === "description") return null;
  if (data.kept === "summary") {
    return (
      <section className="rp-section" aria-labelledby="rp-charts-h">
        <h2 id="rp-charts-h" className="rp-h2">How the record behaves</h2>
        <p className="rp-card rp-gap">A published badge keeps the summary numbers below, not the record itself, so its pictures are not drawn here. The owner's own report, made when they checked the record, has them.</p>
      </section>
    );
  }
  const c = data.curve, c3 = data.c3, sp = data.spread;
  const end = c?.values[c.values.length - 1];
  const bEnd = c?.bench ? [...c.bench].reverse().find((v) => v != null) ?? null : null;
  const growthLead = !c ? "" : c.unit === "growth"
    ? `1 dollar became ${end!.toFixed(2)} dollars${bEnd != null ? `, against ${bEnd.toFixed(2)} in the ${c.benchName}` : ""}, from ${c.dates[0]} to ${c.dates[c.dates.length - 1]}.`
    : `Profit so far after each closing day. Without a starting balance the record has no returns, so this is in the account's money.`;
  const luckLead = c3?.moments
    ? `The chance the result is more than luck, for any number of tries. The more things are tried, the higher the bar. ${c3.dsr == null ? "" : `At the ${c3.tries.toLocaleString("en-US")} ${c3.tries === 1 ? "try" : "tries"} counted it is ${pct(c3.dsr, 0)}; 95% is the line.`}`
    : "";
  const spreadLead = !sp ? "" : sp.what === "sharpe"
    ? `The record's days shuffled ${sp.n.toLocaleString("en-US")} times in one-month blocks: how much the Sharpe ratio could move by chance alone.${sp.above != null ? ` ${pct(sp.above, 0)} of reshuffles are above zero.` : ""}`
    : `The trades drawn again at random ${sp.n.toLocaleString("en-US")} times: how much the profit per trade could move by chance alone.${sp.above != null ? ` ${pct(sp.above, 0)} of draws make money.` : ""}`;
  const fams = data.groups?.families ?? [];
  const groupsLead = fams.length ? `${fams.map((f) => f.title.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1").replace(/^./, (x) => x.toUpperCase())}.${fams.some((f) => f.items.some((i) => i.bench != null)) ? " Ticks show the S&P 500 over the same days." : ""}` : "";
  return (
    <section className="rp-section" aria-labelledby="rp-charts-h">
      <h2 id="rp-charts-h" className="rp-h2">How the record behaves</h2>
      <div className="rp-grid">
        <ChartCard id="growth" title={c?.unit === "money" ? "Profit over time" : data.benchmark ? `Growth against the ${data.benchmark}` : "Growth over time"} lead={growthLead || gaps.curve} visual={pics.growth} gap={gaps.curve} wide>
          {gaps.bench && <p className="rp-gap rp-gap-inline">{gaps.bench}</p>}
        </ChartCard>
        <ChartCard id="luck" title="Could it be luck, after every try?" lead={luckLead || gaps.luck} visual={pics.luck} gap={gaps.luck} />
        <ChartCard id="spread" title="How sure is the result?" lead={spreadLead || gaps.spread} visual={pics.spread} gap={gaps.spread} />
        <ChartCard id="underwater" title="Falls from a high" lead={pics.underwater ? `How far it stood below its last high on each day.${data.c2?.maxDrawdown != null ? ` The deepest fall was ${pct(data.c2.maxDrawdown)}.` : ""}` : (c?.unit === "money" ? "Falls are measured as a share of the account, so they need a starting balance." : gaps.underwater ?? "")} visual={pics.underwater} gap={c?.unit === "money" ? "Not drawn: enter the starting balance to see falls as a share of the account." : gaps.underwater} />
        {pics.groups.length ? pics.groups.map((v, i) => (
          <ChartCard key={i} id={`groups-${i}`} title={i === 0 ? "Where it wins and where it loses" : "By year, market and side, in money"} lead={i === 0 ? groupsLead : "Profit in the account's money, so nothing depends on the starting balance."} visual={v} gap={null} />
        )) : <ChartCard id="groups" title="Where it wins and where it loses" lead={gaps.groups ?? ""} visual={null} gap={gaps.groups} />}
      </div>
    </section>
  );
}
