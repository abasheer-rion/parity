// Shareable badges (REF-0016): what a published badge stores, what the opt-in dataset
// row holds, the badge image, the embed snippet and the line for social posts. Pure
// functions with no browser or React imports, so the Cloudflare function that serves
// /badge/<id>.svg can use them too.
import { RAW } from "../../ui/tokens.gen";

export type VerdictKey = "holds_up" | "could_be_luck" | "fragile" | "does_not_hold_up" | "not_enough_data";

export const VERDICT_WORDS: Record<VerdictKey, string> = {
  holds_up: "Holds up", could_be_luck: "Could be luck", fragile: "Fragile", does_not_hold_up: "Does not hold up", not_enough_data: "Not enough data",
};
export const VERDICT_COLOR: Record<VerdictKey, string> = {
  holds_up: RAW["color-positive"], could_be_luck: RAW["color-warning"], fragile: RAW["color-warning"], does_not_hold_up: RAW["color-negative"], not_enough_data: RAW["color-text-muted"],
};

/** The words every MVP badge carries about trust (REF-0016). */
export const TRUST_LINE = "Self-reported: Parity checked the numbers in the file, not where the file came from.";
export const NOT_ADVICE = "Verification is not a recommendation.";

export const KIND_WORDS = { real: "Self-reported real money", demo: "Self-reported demo account", backtest: "Self-reported backtest" } as const;

/** A badge as the public page and the image read it (the verify_badges_public view). */
export interface PublicBadge {
  id: string;
  created_at: string;
  withdrawn_at: string | null;
  name: string | null;
  input_kind: "real" | "demo" | "backtest" | null;
  stated_tries: number | null;
  date_from: string | null;
  date_to: string | null;
  trade_count: number | null;
  verdict: VerdictKey | null;
  survives_tries: number | null;
  cards: Record<string, unknown> | null;
  method_version: string | null;
  file_sha256: string | null;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A random 12-character id (about 71 bits), never sequential. Rejection sampling keeps every letter equally likely. */
export function newBadgeId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < 12) {
    for (const b of random(24)) {
      if (b < 248 && out.length < 12) out += ALPHABET[b % 62];
    }
  }
  return out;
}

export const isBadgeId = (s: string) => /^[A-Za-z0-9]{12}$/.test(s);

export function survivesWords(n: number | null): string {
  if (n == null) return "Luck check not measured";
  if (n === 0) return "Survives no tries";
  if (n >= 1_000_000_000) return "Survives more than 1 billion tries";
  return `Survives up to ${n.toLocaleString("en-US")} ${n === 1 ? "try" : "tries"}`;
}

/** "Parity Verify: Could be luck. Survives up to 4 tries. Self-reported backtest, 212 trades. paritytrading.app/v/<id>" */
export function socialLine(b: Pick<PublicBadge, "id" | "verdict" | "survives_tries" | "input_kind" | "trade_count">, host: string): string {
  const parts = [`Parity Verify: ${b.verdict ? VERDICT_WORDS[b.verdict] : "Withdrawn"}.`, `${survivesWords(b.survives_tries)}.`];
  const kind = b.input_kind ? KIND_WORDS[b.input_kind] : "Self-reported record";
  parts.push(`${kind}${b.trade_count != null ? `, ${b.trade_count.toLocaleString("en-US")} trades` : ""}.`);
  parts.push(`${host}/v/${b.id}`);
  return parts.join(" ");
}

/** The badge's words for a screen reader, e.g. "Parity Verify: Could be luck. Survives up to 4 tries. Self-reported record." */
export function badgeAlt(b: Pick<PublicBadge, "verdict" | "survives_tries" | "withdrawn_at"> | null): string {
  if (!b || !b.verdict || b.withdrawn_at) return "Parity Verify badge: see what was checked";
  return `Parity Verify: ${VERDICT_WORDS[b.verdict]}. ${survivesWords(b.survives_tries)}. Self-reported record.`;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML for a website: the badge image inside a link to its public page. */
export function embedSnippet(id: string, origin: string, alt = badgeAlt(null)): string {
  return `<a href="${origin}/v/${id}"><img src="${origin}/badge/${id}.svg" width="320" height="80" alt="${attr(alt)}"></a>`;
}

/** The same for Markdown (GitHub READMEs, forums). */
export function markdownSnippet(id: string, origin: string, alt = badgeAlt(null)): string {
  return `[![${alt.replace(/[[\]]/g, "")}](${origin}/badge/${id}.svg)](${origin}/v/${id})`;
}

/** A small card in a frame: verdict, tries survived, trades and the trust line, linking to the record. */
export function cardSnippet(id: string, origin: string): string {
  return `<iframe src="${origin}/badge/${id}/card" width="360" height="190" title="Parity Verify record" loading="lazy" style="border:0;max-width:100%"></iframe>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The badge image, 320 by 80. A withdrawn badge says so; it never shows the old verdict. */
export function badgeSvg(b: PublicBadge | null): string {
  const live = !!b && !b.withdrawn_at && !!b.verdict;
  const verdict = !b ? "No such badge" : live ? VERDICT_WORDS[b.verdict!] : "Withdrawn by its owner";
  const color = live ? VERDICT_COLOR[b!.verdict!] : RAW["color-text-muted"];
  const line2 = !b ? "Check the link" : live
    ? `${survivesWords(b.survives_tries)}${b.trade_count != null ? ` · ${b.trade_count.toLocaleString("en-US")} trades` : ""}`
    : `on ${b.withdrawn_at!.slice(0, 10)}`;
  const label = `Parity Verify: ${verdict}. ${line2}. ${live ? TRUST_LINE : ""}`.trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80" role="img" aria-label="${esc(label)}">
<rect width="320" height="80" rx="10" fill="${RAW["color-surface-raised"]}"/>
<rect x="0.5" y="0.5" width="319" height="79" rx="9.5" fill="none" stroke="${RAW["palette-line-2"]}"/>
<rect x="0" y="10" width="4" height="60" rx="2" fill="${color}"/>
<g font-family="Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
<text x="16" y="17" font-size="8.5" letter-spacing="1.2" fill="${RAW["color-text-muted"]}">PARITY VERIFY</text>
<text x="16" y="36" font-size="16" font-weight="600" fill="${color}">${esc(verdict)}</text>
<text x="16" y="51" font-size="10" fill="${RAW["color-text"]}">${esc(line2)}</text>
${live ? `<text x="16" y="64" font-size="7.4" fill="${RAW["color-text-muted"]}">Self-reported: Parity checked the numbers in the file,</text>
<text x="16" y="73" font-size="7.4" fill="${RAW["color-text-muted"]}">not where the file came from. Not a recommendation.</text>` : ""}
</g>
</svg>`;
}

/**
 * The small embeddable card, /badge/<id>/card: a page of plain HTML with no script, made to
 * sit in another site's frame. It shows the verdict, the tries survived, the trade count,
 * the trust line and a link to the full record. A withdrawn badge says so and nothing else.
 */
export function badgeCardHtml(b: PublicBadge | null, id: string, origin: string): string {
  const live = !!b && !b.withdrawn_at && !!b.verdict;
  const verdict = !b ? "No such record" : live ? VERDICT_WORDS[b.verdict!] : "Withdrawn by its owner";
  const color = live ? VERDICT_COLOR[b!.verdict!] : RAW["color-text-muted"];
  const lines = !b ? ["Check the link."] : live
    ? [`${survivesWords(b.survives_tries)}.`, [b.trade_count != null ? `${b.trade_count.toLocaleString("en-US")} trades` : "", b.input_kind ? KIND_WORDS[b.input_kind] : ""].filter(Boolean).join(", ") + "."]
    : [`On ${b.withdrawn_at!.slice(0, 10)}.`];
  const link = `${origin}/v/${esc(id)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Parity Verify: ${esc(verdict)}</title>
<style>
html,body{margin:0;background:${RAW["color-canvas"]};color:${RAW["color-text"]};font:14px/1.45 Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
a{color:inherit;text-decoration:none;display:block;height:100vh;box-sizing:border-box;padding:16px 18px;border:1px solid ${RAW["palette-line-2"]};border-radius:14px;background:${RAW["color-surface-raised"]}}
a:focus-visible{outline:2px solid ${RAW["color-accent-text"]};outline-offset:-4px}
.k{font-size:12px;color:${RAW["color-text-muted"]};margin:0}
.v{font-size:22px;font-weight:600;margin:4px 0 6px;color:${color}}
p{margin:0}
.t{font-size:12px;color:${RAW["color-text-muted"]};margin-top:8px}
.m{font-size:12px;color:${RAW["color-accent-text"]};margin-top:6px}
</style></head><body><a href="${link}" target="_blank" rel="noopener">
<p class="k">Parity Verify</p>
<p class="v">${esc(verdict)}</p>
${lines.map((l) => `<p>${esc(l)}</p>`).join("\n")}
${live ? `<p class="t">${esc(TRUST_LINE)} ${esc(NOT_ADVICE)}</p>` : ""}
<p class="m">See what was checked</p>
</a></body></html>`;
}
