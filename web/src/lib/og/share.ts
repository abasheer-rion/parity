// What a shared link to a Verify badge or a strategy says in a chat or a post (DEC-0038):
// the page title and description the functions put in the HTML, and the words on the
// share image. Pure, so the functions and the tests can both use it.
import { abs, OG_CARDS, ogImage, PRIVATE, type PageMeta } from "../meta";
import { ASSET_LABEL, FAMILY_LABEL, nameById, tagsById } from "../strategyMeta";
import { tagline } from "../strategyNames";
import { KIND_WORDS, survivesWords, TRUST_LINE, VERDICT_COLOR, VERDICT_WORDS, type PublicBadge } from "../verify/badge";
import type { BadgeCard } from "./card";
import { RAW } from "../../ui/tokens.gen";

export const isStrategyId = (s: string) => /^[a-z0-9_]{1,64}$/.test(s);

/** The share card for a badge. A missing or withdrawn badge never shows an old verdict. */
export function badgeCard(b: PublicBadge | null, id: string): BadgeCard {
  const grey = RAW["color-text-muted"];
  if (!b) return { id, verdict: "No such record", color: grey, survives: "Check the link", detail: "This Verify link does not match a record." };
  if (b.withdrawn_at || !b.verdict) {
    return { id, verdict: "Withdrawn", color: grey, survives: "Withdrawn by its owner", detail: `on ${b.withdrawn_at?.slice(0, 10) ?? "an earlier date"}` };
  }
  const kind = b.input_kind ? KIND_WORDS[b.input_kind] : "Self-reported record";
  const parts = [kind];
  if (b.trade_count != null) parts.push(`${b.trade_count.toLocaleString("en-US")} trades`);
  if (b.date_from && b.date_to) parts.push(`${b.date_from.slice(0, 10)} to ${b.date_to.slice(0, 10)}`);
  return { id, verdict: VERDICT_WORDS[b.verdict], color: VERDICT_COLOR[b.verdict], survives: survivesWords(b.survives_tries), detail: parts.join(" · "), note: TRUST_LINE };
}

/** The head tags for /v/<id>. */
export function badgeMeta(b: PublicBadge | null, id: string): PageMeta {
  const c = badgeCard(b, id);
  const live = !!c.note;
  const title = live ? `${c.verdict}: ${c.survives.toLowerCase()} · Parity Verify` : `${c.verdict} · Parity Verify`;
  const description = live ? `${c.detail}. ${TRUST_LINE}` : OG_CARDS.badge.sub;
  return {
    title, description, path: `/v/${id}`, image: abs(`/og/badge/${id}.png`), robots: PRIVATE,
    imageAlt: live ? `Parity Verify: ${c.verdict}. ${c.survives}.` : `Parity Verify: ${c.verdict}.`,
  };
}

/** The share card's words for a strategy: its name and kind, never its results (those stay behind sign-in). */
export function strategyCard(id: string) {
  const tags = tagsById(id);
  const kind = tags ? [FAMILY_LABEL[tags.family], ASSET_LABEL[tags.asset], tags.horizon].filter(Boolean).join(" · ") : "";
  return {
    kicker: kind ? `Parity strategy · ${kind}` : "Parity strategy",
    title: nameById(id),
    tagline: tagline(id),
    sub: "Tested against the S&P 500: how it did, where it fails and whether the result could be luck.",
  };
}

/** The head tags for the /s/<id> share page. */
export function strategyMeta(id: string): PageMeta {
  const c = strategyCard(id);
  return {
    title: `${c.title} · Parity`, description: c.tagline ? `${c.tagline} ${c.sub}` : c.sub, path: `/s/${id}`,
    image: isStrategyId(id) ? abs(`/og/strategy/${id}.png`) : ogImage("strategy"), robots: PRIVATE,
  };
}
