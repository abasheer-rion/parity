// Where a broker-connected result came from (DEC-0091): the venue, a one-way code for the
// account, when Parity fetched it, and the trades file Parity read, which anyone can upload
// to Verify again and whose fingerprint is on the badge. Shown above the result.
import { useEffect, useState } from "react";
import { shortDate } from "../../lib/verify/parse";
import type { FetchAnswer } from "../../lib/verify/connect";
import { Icon } from "../../ui";

export const fetchedWhen = (iso: string) => `${shortDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;

export function ConnectedSource({ answer }: { answer: FetchAnswer }) {
  const s = answer.source;
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([answer.record.csv], { type: "text/csv" }));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [answer.record.csv]);
  const file = `parity-${s.venue}-${s.from}-to-${s.to}.csv`;
  return (
    <section className="mcard vc-source" aria-labelledby="vc-source-h" data-testid="connected-source">
      <div className="mcard-head"><h2 id="vc-source-h">Broker-connected</h2></div>
      <div className="vf-panel">
        <p>
          Parity read these trades from {s.name} itself, on {fetchedWhen(s.fetchedAt)}, through a read-only link.
          {" "}{s.env === "paper" ? `It is ${s.name}'s paper account, so this is practice money.` : "It is a live account, so this is real money, as the broker reports it."}
        </p>
        <dl className="vc-facts">
          <div><dt>Account</dt><dd><code>{s.account}</code> <span className="vf-help">a one-way code, not the account number</span></dd></div>
          <div><dt>Dates read</dt><dd>{shortDate(s.from)} to {shortDate(s.to)}</dd></div>
          <div><dt>Credential</dt><dd>{answer.connection ? "Kept sealed for later reads. Revoke it in Settings, Broker connections." : "Used for this read and dropped."}</dd></div>
        </dl>
        {answer.notes.length > 0 && <ul className="vc-notes">{answer.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        <div className="vf-row">
          {href && <a className="ui-btn ui-btn-secondary ui-btn-sm" href={href} download={file}><Icon name="download" size={13} /><span>Download the trades Parity read</span></a>}
          <span className="vf-help">A CSV you can upload to Verify yourself. Its fingerprint goes on the badge.</span>
        </div>
      </div>
    </section>
  );
}
