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

export function embedSnippet(id: string, origin: string): string {
  return `<a href="${origin}/v/${id}"><img src="${origin}/badge/${id}.svg" width="320" height="80" alt="Parity Verify badge: see what was checked"></a>`;
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
