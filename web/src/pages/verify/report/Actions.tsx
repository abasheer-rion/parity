// What a person can do with a report (DEC-0089): copy a link that holds the whole report,
// save it as a PDF, download an image card for a post, or put it next to another record.
// The link's report lives after the "#", which browsers never send, so nothing is stored.
import { useEffect, useState } from "react";
import { encodeReport } from "../../../lib/verify/report/link";
import type { ReportData } from "../../../lib/verify/report/model";
import { Button, toast } from "../../../ui";
import { track } from "../../../lib/analytics";

/** "live": a check just run. "shared": opened from a link. "badge": a published badge's page, whose own address is the link. */
export function ReportActions({ data, print, mode = "live" }: { data: ReportData; print: () => void; mode?: "live" | "shared" | "badge" }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"card" | null>(null);
  // The link is made as soon as the report shows, so copying and opening stay inside the
  // click (browsers allow the clipboard and new tabs only then).
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void encodeReport(data).then((c) => { if (live) setCode(c); });
    return () => { live = false; };
  }, [data]);

  const makeLink = () => {
    if (!code) return;
    const url = `${window.location.origin}/verify/report/#r=${code}`;
    setLink(url);
    navigator.clipboard?.writeText(url).then(() => toast("Link copied. It holds the whole report: Parity keeps no copy."), () => toast("Copy the link from the box below."));
    track("verify_share", { what: "link" });
  };

  const card = async () => {
    setBusy("card");
    try {
      const { cardPng, cardFileName } = await import("./image");
      const blob = await cardPng(data);
      const name = cardFileName(data);
      const file = new File([blob], name, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (window.matchMedia?.("(pointer: coarse)").matches && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${data.verdict.label} · Parity Verify` }).catch(() => undefined);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      track("verify_share", { what: "card" });
    } catch {
      toast("The image could not be made in this browser.", { tone: "bad" });
    } finally { setBusy(null); }
  };


  return (
    <div className="rp-actions" role="group" aria-label="Share or save this report">
      <div className="rp-actions-row">
        {mode === "live" && <Button variant="primary" icon="link" onClick={makeLink} disabled={!code}>Copy a link to this report</Button>}
        {mode === "shared" && <Button variant="primary" icon="link" onClick={() => { void navigator.clipboard?.writeText(window.location.href).then(() => toast("Link copied.")).catch(() => toast("Copy the address from the address bar.")); }}>Copy this link</Button>}
        <Button icon="download" onClick={print}>Save as PDF</Button>
        <Button icon="sparkle" onClick={() => void card()} loading={busy === "card"}>Image for a post</Button>
      </div>
      {link && (
        <div className="rp-link">
          <label className="ui-field">
            <span className="ui-field-label">Link to this report</span>
            <input className="ui-input rp-link-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="report-link" />
          </label>
          <p className="vf-small">The report is inside the link itself, after the "#". Browsers never send that part to a server, so Parity keeps no copy and cannot change or vouch for it. Anyone with the link can read it.</p>
        </div>
      )}
    </div>
  );
}
