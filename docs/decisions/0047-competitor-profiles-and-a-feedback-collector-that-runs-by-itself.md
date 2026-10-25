---
id: DEC-0047
title: Competitor profiles and a feedback collector that runs by itself
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, infra, ui]
related: [DEC-0037, CMP-0001, RES-0020, RES-0021]
---

# Competitor profiles and a feedback collector that runs by itself

## In plain words

The owner asked us to write down everything about the trading apps we are studying: what each one is, what people like most, what they complain about, and how the screens work. We now have one page per product, 22 in all, and a summary that ranks what users praise most. A small program reads public comments about these products once a day from places that allow it, sorts each comment into praise or complaint and into a topic such as "charts" or "fees", and counts them. The research site shows the counts per product, how they change month by month, and what Parity should copy, avoid or beat.

## Context

- We build five apps (Trade, Terminal, Verify, Workbench, Academy) against products people already use. [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md) covered workspace layout and [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md) covered Verify's market. Neither said what users of each product think.
- A separate piece of work covers how these platforms are built and how fast they are (branch `docs/trading-architecture`). This decision covers product, UX and user sentiment only.
- The owner wants everything to run by itself ([DEC-0037](0037-everything-runs-by-itself-and-the-search-widens-itself.md)), and wants feedback read only where the source's terms allow automated access.

## Decision

1. **A new doc type, `competitor` (CMP), in `docs/competitors/`.** One profile per product with the same sections: summary, strengths and weaknesses, what users say, UX notes, and what Parity should copy, avoid or beat. CMP-0001 is the comparison. A separate type keeps the profiles together and gives them their own numbers, so they never collide with research or reference numbers used by parallel work. `docs.py` indexes it like any other type; the rule lives in `docs/_system/schema.json`.
2. **One registry, `docs/_system/competitors.json`.** Each product's doc id, group, search phrases, App Store ids, GitHub repos, status page and feeds. The engine and the research page both read it.
3. **The collector, `parity profiles collect`** (`engine/src/parity/profiles/`).
   - Every request goes through one session that names this project in its user agent, waits at least 1.5 seconds between requests to a host (longer when robots.txt asks), and reads robots.txt first, matching wildcards the way the big crawlers do.
   - Sources, each with its terms note (`parity profiles sources`):

     | Source | Status | Why |
     | --- | --- | --- |
     | Hacker News (Algolia API) | on | Public API, no key |
     | Stack Exchange API (money, quant) | on | Official API, 300 requests a day without a key |
     | GitHub issues and releases (REST API) | on | Official API, 60 requests an hour without a token |
     | Status pages (Statuspage history feed) | on | Public feeds; their robots.txt blocks only `/api/` |
     | Product changelog feeds | on | Feeds the products publish, each checked against robots.txt |
     | App Store ratings (iTunes Lookup API) | on | Average stars and counts, one request a day |
     | App Store review text (RSS) | skipped | `itunes.apple.com/robots.txt` disallows `/*/rss/*` |
     | Google Play | off | No API for other apps' reviews; scraping is against its terms |
     | Reddit (Data API, OAuth) | needs key | Runs when the vault holds `parity-reddit-client-id` and `parity-reddit-client-secret` |

   - Never: logging in to a product, getting past a bot check or paywall, or reading G2, Trustpilot or Capterra pages.
4. **Signals are rules, not a model.** Our own word lists score each item as praise, complaint or neither, with a simple negation rule; a star rating decides when there is one. Fixed keyword lists put items into 18 themes. Every label can be traced to the words that produced it, nothing needs downloading, and no paid API is used. Labels are recomputed each pass, so a change to the lists reaches old rows.
5. **Storage and retention.** Rows live in `engine/output/profiles.db` (SQLite, not in git), deduplicated by a hash of the source and the item's own id. Text is cut to 1,500 characters and blanked after 400 days; rows go after five years. Author names are never stored.
6. **Publishing counts only.** `profile_snapshots` (new migration) takes the summary: counts by theme, monthly trends, ratings, release and incident counts. Only the writer may add rows, nobody else may read them, and the newest 20 are kept. The deploy job copies the newest to `data/profiles.json`.
7. **It runs in the sims service.** Each sims cycle ends with the collector, which runs a pass only when the last one is at least 20 hours old, so each source sees about one visit a day. The health line and the sims heartbeat now carry the item count and the time of the last pass. The step is nice'd with the rest of the cycle.
8. **A research page, `#/competitors`.** Each product's plain-words summary and copy, avoid or beat list come from its CMP doc; the counts, themes and 12-month trend come from the collector.

## Alternatives considered

- **A small local sentiment model.** Rejected for now. It would need a download on the always-on box, its labels could not be explained word by word, and on short technical comments it is not clearly better than rules.
- **Reading App Store reviews through the RSS URL without a country code**, which the robots.txt rule does not literally match. Rejected: the rule's intent is clear, and getting around it would break the owner's rule.
- **Profiles as reference docs.** Rejected because 22 reference numbers would collide with other work in flight and scatter the profiles among unrelated references.

## Consequences

- Most feedback comes from Hacker News and Stack Exchange, which lean technical. Retail apps such as Robinhood and Webull are under-represented until Reddit is keyed, and the four smaller Verify competitors have almost no public feedback at all. The page says when a product has fewer than 20 items.
- Themes are broad and keyword based. "Market data and quotes" catches any mention of data, so its counts run high. The counts show where people talk, not a survey.
- The profiles' prices and features are a snapshot from 24 October 2026; the counts update daily.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](../competitors/0001-ux-patterns-users-praise-most.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
<!-- backlinks:end -->
