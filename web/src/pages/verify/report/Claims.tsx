// What the seller claims, set against the record (DEC-0088): each claim with the words it
// came from (and a link that opens the seller's page at them), what the record shows and
// whether the two agree. Without a record, each says what would check it, with a way to
// attach one. Claims a person's own AI model added are marked as such.
import { useMemo, useState } from "react";
import { againstSummary, claimsAgainst, type AgainstRow } from "../../../lib/verify/claims/against";
import { textFragmentUrl } from "../../../lib/verify/claims/extract";
import type { Result } from "../../../lib/verify/checks";
import { hostOf, type ReportData } from "../../../lib/verify/report/model";
import { Badge, Button } from "../../../ui";
import { Num } from "../Num";

const STATUS: Record<AgainstRow["status"], { text: string; tone: "good" | "bad" | "neutral" | "accent" }> = {
  agrees: { text: "Agrees", tone: "good" },
  differs: { text: "Differs", tone: "bad" },
  cannot: { text: "Cannot check", tone: "neutral" },
  needs_record: { text: "Needs the record", tone: "accent" },
  not_compared: { text: "Not compared", tone: "neutral" },
};

/** The quote with the claimed value picked out. */
function Quote({ f }: { f: Pick<AgainstRow, "quote" | "shown"> }) {
  const i = f.quote.indexOf(f.shown);
  if (i < 0 || !f.shown) return <q>{f.quote}</q>;
  return <q>{f.quote.slice(0, i)}<mark>{f.shown}</mark>{f.quote.slice(i + f.shown.length)}</q>;
}

export interface ClaimsLive {
  /** Attach a trade file to check these claims against. */
  onAttach?: () => void;
  /** Ask the person's own model for more claims (only when they have connected one). */
  onModel?: () => Promise<{ added: number; dropped: number }>;
  modelName?: string | null;
}

export function ClaimsSection({ data, result, live }: { data: ReportData; result?: Result | null; live?: ClaimsLive }) {
  const src = data.claims!;
  const rows = useMemo(() => claimsAgainst(src.found, result ?? asResult(data)), [src.found, result, data]);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const isRecord = data.source !== "description";
  const where = src.url ? hostOf(src.url) : "the words you pasted";
  const extra = src.found.length - rows.length;
  const ask = async () => {
    if (!live?.onModel) return;
    setAsking(true);
    try {
      const r = await live.onModel();
      setModelNote(r.added ? `Your model found ${r.added} more claim${r.added === 1 ? "" : "s"}.${r.dropped ? ` ${r.dropped} more ${r.dropped === 1 ? "was" : "were"} left out because the words it quoted are not on the page.` : ""}` : `Your model found nothing the patterns missed.${r.dropped ? ` ${r.dropped} of its claims quoted words that are not on the page, so they were left out.` : ""}`);
    } catch (e) {
      setModelNote(e instanceof Error ? e.message : "Your model could not be reached.");
    } finally { setAsking(false); }
  };
  return (
    <section className="rp-section rp-card rp-claims" aria-labelledby="rp-claims-h">
      <h2 id="rp-claims-h" className="rp-h2">What the seller claims</h2>
      <p className="rp-lead">
        {src.found.length ? `${rows.length} claim${rows.length === 1 ? "" : "s"} read from ${where}${src.readAt ? ` on ${src.readAt.slice(0, 10)}` : ""}. ` : `No claims were found in ${where}. `}
        {rows.length ? againstSummary(rows) : "Paste the numbers from the page instead, or upload the account's trade history."}
      </p>
      {src.url && <p className="vf-small">From <a href={src.url} rel="noopener nofollow ugc" target="_blank">{src.title ? `${src.title} (${hostOf(src.url)})` : src.url}</a>. Read once by our server, under the site's robots.txt, with no login. We keep no copy of the page.</p>}
      {rows.length > 0 && (
        <ul className="rp-claim-list">
          {rows.map((r) => (
            <li key={r.field} className={`rp-claim rp-claim-${r.status}`}>
              <div className="rp-claim-head">
                <span className="rp-claim-label">{r.label}</span>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
              </div>
              <div className="rp-claim-values">
                <div><span className="rp-claim-k">{src.url ? "The page says" : "The words say"}</span><Num id="claimed">{r.shown}</Num></div>
                {(r.status === "agrees" || r.status === "differs") && r.record && <div><span className="rp-claim-k">The record shows</span><Num id="recordShows">{r.record}</Num></div>}
              </div>
              <p className="rp-claim-quote"><Quote f={r} />{src.url && r.how === "pattern" && <> <a className="rp-claim-open" href={textFragmentUrl(src.url, r)} target="_blank" rel="noopener nofollow ugc">Open on the page</a></>}</p>
              <p className="rp-claim-why">{r.why}{r.decides && r.status === "differs" ? " This changes the verdict." : ""}</p>
              <p className="rp-claim-how">{r.how === "model" ? "Read by your own AI model. The words it quoted are on the page." : r.rule}.</p>
            </li>
          ))}
        </ul>
      )}
      {extra > 0 && <p className="vf-small">{extra} more mention{extra === 1 ? "" : "s"} of the same numbers {extra === 1 ? "was" : "were"} found; the list shows the one the checks use: a labelled value first, and of several drawdowns the largest.</p>}
      {(live?.onAttach && !isRecord) || live?.onModel ? (
        <div className="vf-row rp-claim-actions">
          {live?.onAttach && !isRecord && <Button variant="primary" icon="upload" onClick={live.onAttach}>Check them against a trade file</Button>}
          {live?.onModel && <Button onClick={() => void ask()} loading={asking}>Ask {live.modelName ? `my ${live.modelName} model` : "my AI model"} for more</Button>}
        </div>
      ) : null}
      {live?.onModel && <p className="vf-small">Your model is called from this browser with your own key. Parity never sees the key and never pays for the call.</p>}
      {modelNote && <p className="vf-small" role="status">{modelNote}</p>}
    </section>
  );
}

/** Enough of a Result for the claim comparison, from a report read from a link. */
function asResult(d: ReportData): Result {
  return {
    source: d.source, kind: d.kind, tries: d.tries, triesDefaulted: d.triesDefaulted, methodVersion: d.method, what: d.what,
    dateFrom: d.dateFrom, dateTo: d.dateTo, trades: d.trades, dailyReturns: d.dailyReturns, balance: d.balance, assets: [],
    card1: d.c1, card2: d.c2, card3: d.c3, card4: d.c4, card5: d.c5, claims: d.arithmetic, verdict: d.verdict, notes: d.notes,
    facts: d.facts ?? undefined,
  };
}
