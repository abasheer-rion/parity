// The ways to show a published badge elsewhere (DEC-0081): the image, HTML, Markdown and a
// small card in a frame. Each is a read-only box with a Copy button. Used by the Share step
// and by the public record page (/v/<id>).
import { badgeAlt, cardSnippet, embedSnippet, markdownSnippet, socialLine, type PublicBadge } from "../../lib/verify/badge";
import { Button, toast } from "../../ui";

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Select the text and copy it"); }
}

export function Embeds({ badge, origin, host }: { badge: PublicBadge; origin: string; host: string }) {
  const alt = badgeAlt(badge);
  const rows: { key: string; label: string; help: string; value: string; rows: number }[] = [
    { key: "image", label: "Image", help: "The badge as an SVG image, 320 by 80. It updates if the record is withdrawn.", value: `${origin}/badge/${badge.id}.svg`, rows: 1 },
    { key: "html", label: "HTML", help: "For a website: the image, linking to this record, with alt text for screen readers.", value: embedSnippet(badge.id, origin, alt), rows: 3 },
    { key: "markdown", label: "Markdown", help: "For a README or a forum post.", value: markdownSnippet(badge.id, origin, alt), rows: 2 },
    { key: "card", label: "Card", help: "A small card in a frame, 360 by 190: the verdict, tries survived, trades and the trust line.", value: cardSnippet(badge.id, origin), rows: 2 },
    { key: "post", label: "Text for a social post", help: "One line with the verdict and the link.", value: socialLine(badge, host), rows: 2 },
  ];
  return (
    <div className="vf-embeds">
      {rows.map((r) => (
        <div key={r.key} className="vf-embed">
          <label className="ui-field">
            <span className="ui-field-label">{r.label}</span>
            <textarea className={`ui-input vf-textarea ${r.key === "post" ? "" : "vf-code"}`} readOnly rows={r.rows} value={r.value} />
          </label>
          <div className="vf-embed-foot">
            <span className="vf-help">{r.help}</span>
            <Button size="sm" onClick={() => void copy(r.value)} aria-label={`Copy the ${r.label.toLowerCase()}`}>Copy</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
