// The latency badge (DEC-0052): on every live chart and quote, a tiny line saying how
// fresh the price is. Feed type (real-time, delayed 15 min, end of day), source, the whole
// trip from the exchange to this screen in ms, and the data's age; green, amber when late,
// red when stale or the line is down. Click it for every hop: exchange time, our receive
// time, our send time and your screen time. It redraws at most twice a second, not per tick.
import { useEffect, useRef, useState } from "react";
import { Popover } from "../ui";
import { subscribeStatus, type FeedStatus } from "../lib/live/client";
import { freshness, msText, type Freshness } from "../lib/live/latency";
import { feedLabel, feedShort, type FeedType } from "../lib/live/protocol";
import { sourceById } from "../lib/live/sources";
import "./liveBadge.css";

const time = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(11, 23) : "n/a");

/** A badge for a live source: reads the shared line's status twice a second. */
export function LiveBadge({ src, compact = false }: { src: string; compact?: boolean }) {
  const ref = useRef<FeedStatus | null>(null);
  const [, tick] = useState(0);
  useEffect(() => subscribeStatus(src, (s) => { ref.current = s; }), [src]);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 500); return () => window.clearInterval(t); }, []);
  const s = ref.current;
  const meta = sourceById(src);
  const feed: FeedType = s?.feed ?? meta?.feed ?? "rt";
  const delay = s?.delay ?? meta?.delayMin;
  const now = Date.now() + (s?.offset ?? 0);
  const age = s?.lastTe ? Math.max(0, now - s.lastTe) : null;
  const up = !!s && s.line === "open" && s.upstream === "up";
  const fresh: Freshness = s?.lastTe ? freshness(feed, age, s.last?.e2e ?? null, up, delay) : up ? "late" : "stale";
  const label = `${feedLabel(feed, delay)}, ${meta?.name ?? src}. ${s?.last ? `Exchange to screen ${msText(s.last.e2e)}.` : ""} Data age ${msText(age)}.${up ? "" : " Line not connected."}`;
  return (
    <Popover label="Latency" width={300} placement="bottom-end" trigger={() => (
      <button type="button" className={`lvb lvb-${fresh}`} aria-label={label}>
        <i className="lvb-dot" aria-hidden />
        <span>{feedShort(feed, delay)}</span>
        {!compact && <span className="lvb-src">{meta?.short ?? src}</span>}
        <span className="tabular">{s?.last ? msText(s.last.e2e) : up ? "waiting" : s?.line === "open" && s.upstream === "down" ? "source down" : s?.line === "connecting" || s?.upstream === "connecting" ? "connecting" : "offline"}</span>
        {!compact && age != null && <span className="tabular lvb-age">{msText(age)} old</span>}
      </button>
    )}>
      <dl className="lvb-card">
        <div><dt>Feed</dt><dd>{feedLabel(feed, delay)}</dd></div>
        <div><dt>Source</dt><dd>{meta ? <a href={meta.terms} target="_blank" rel="noreferrer">{meta.name}</a> : src}</dd></div>
        <div><dt>Exchange time</dt><dd className="tabular">{time(s?.lastTe)}</dd></div>
        <div><dt>Our edge got it</dt><dd className="tabular">+{msText(s?.last?.feed)}</dd></div>
        <div><dt>Our edge sent it</dt><dd className="tabular">+{msText(s?.last?.edge)}</dd></div>
        <div><dt>Your browser got it</dt><dd className="tabular">+{msText(s?.last?.net)}</dd></div>
        <div><dt>On your screen</dt><dd className="tabular">+{msText(s?.last?.screen)}</dd></div>
        <div><dt>Whole trip</dt><dd className="tabular">{msText(s?.last?.e2e)}</dd></div>
        <div><dt>Data age</dt><dd className="tabular">{msText(age)}</dd></div>
        <div><dt>Clock check</dt><dd className="tabular">{s && Number.isFinite(s.rtt) ? `±${msText(s.rtt / 2)}` : "n/a"}</dd></div>
        <div><dt>Line</dt><dd>{s ? `${s.line === "open" ? "Connected" : s.line === "connecting" ? "Connecting" : "Closed"}, source ${s.upstream}${s.why ? ` (${s.why})` : ""}` : "n/a"}</dd></div>
        {!!s?.gaps && <div><dt>Lost updates</dt><dd className="tabular">{s.gaps}</dd></div>}
      </dl>
    </Popover>
  );
}

/** A badge for data that is not streamed: delayed or end of day, judged on its own time. */
export function StaticBadge({ feed, source, asOf, compact = false, terms, delayMin }: { feed: FeedType; source: string; asOf: string | number | null; compact?: boolean; terms?: string; delayMin?: number }) {
  const t = typeof asOf === "number" ? asOf : asOf ? Date.parse(asOf.length === 10 ? `${asOf}T21:00:00Z` : asOf) : NaN;
  const age = Number.isFinite(t) ? Math.max(0, Date.now() - t) : null;
  const fresh = freshness(feed, age, null, age != null, delayMin);
  const label = `${feedLabel(feed, delayMin)}, ${source}. Data age ${msText(age)}.`;
  return (
    <Popover label="Data age" width={260} placement="bottom-end" trigger={() => (
      <button type="button" className={`lvb lvb-${fresh}`} aria-label={label}>
        <i className="lvb-dot" aria-hidden />
        <span>{feedShort(feed, delayMin)}</span>
        {!compact && <span className="lvb-src">{source}</span>}
        <span className="tabular lvb-age">{msText(age)} old</span>
      </button>
    )}>
      <dl className="lvb-card">
        <div><dt>Feed</dt><dd>{feedLabel(feed, delayMin)}</dd></div>
        <div><dt>Source</dt><dd>{terms ? <a href={terms} target="_blank" rel="noreferrer">{source}</a> : source}</dd></div>
        <div><dt>Last value</dt><dd className="tabular">{Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16).replace("T", " ") : "n/a"}</dd></div>
        <div><dt>Data age</dt><dd className="tabular">{msText(age)}</dd></div>
        <div><dt>Not live</dt><dd>{feed === "eod" ? "One price a day, after the close." : `Shown about ${delayMin ?? 15} minutes late.`}</dd></div>
      </dl>
    </Popover>
  );
}
