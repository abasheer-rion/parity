---
id: LOG-0017
title: Ayan work log, competitor profiles, feedback collector and architecture
type: log
status: final
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, process]
related: [LOG-0016, DEC-0047, CMP-0001, DEC-0037, RES-0021, RES-0022, REF-0019, DEC-0046]
---

# Ayan work log, competitor profiles, feedback collector and architecture

## In plain words

24 October 2026, evening, following [LOG-0016](2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md). The owner asked us to study the trading apps people already use: what each is, what users like and dislike, and how its screens work, with programs that keep collecting this by themselves. We wrote 22 product profiles and a summary, built a collector that reads public comments once a day from places that allow it, and added a page to the research site. In parallel, another helper wrote up how these platforms are built and how fast they are, now merged.

## What happened

| # | The owner asked (paraphrased) | What came of it |
| --- | --- | --- |
| 1 | Log and document every platform we study: profiles, strengths, what people like most, UX | 22 profiles in a new doc type, CMP-0002 to CMP-0023, from the Bloomberg Terminal to QuantConnect, plus a comparison, [CMP-0001](../competitors/0001-ux-patterns-users-praise-most.md) ([DEC-0047](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)) |
| 2 | Run scrapers of each, and have everything run by itself | `parity profiles collect` reads Hacker News, Stack Exchange, GitHub, status pages, changelogs and App Store ratings, obeying robots.txt and each source's terms. It runs once a day inside the sims service ([DEC-0037](../decisions/0037-everything-runs-by-itself-and-the-search-widens-itself.md)) |
| 3 | Know what people like most and what they complain about | Rule-based praise or complaint, and 18 themes, counted per product with a 12-month trend; the comparison ranks themes across all 22 |
| 4 | Take note of UX | Each profile has UX notes on layout, onboarding, navigation, density, charting, order entry, shortcuts, mobile, speed and trust, and a copy, avoid or beat list for Trade, Terminal, Verify, Workbench and Academy |
| 5 | A page for it | `/research/#/competitors`: patterns, a product table with trend lines, and a detail card per product |
| 6 | Architecture and latency (separate helper) | Merged as pull request 81: [RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md) on how trading and market data platforms are built, [REF-0019](../reference/0019-latency-budget-and-target-architecture.md) on a latency budget and target architecture, and [DEC-0046](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md) on payments through Stripe and real trading only through a regulated broker. Latency tracking (a migration and its decision) is still being drafted on `feat/latency` |

## Sources the collector uses and skips

- **On:** Hacker News (Algolia API), Stack Exchange (money, quant), GitHub issues and releases, Statuspage history feeds (Coinbase, Kraken, eToro, Robinhood, QuantConnect), changelog feeds (MetaTrader 5, Coinbase developer platform, Kraken blog, LMAX), App Store ratings.
- **Skipped:** App Store review text, because Apple's robots.txt disallows the review feeds. Google Play, because there is no allowed route.
- **Needs a key:** Reddit, through its official API only.
- **Never:** G2, Trustpilot or Capterra pages, anything behind a login or bot check.

## Decisions

- A new doc type, `competitor` (CMP), in `docs/competitors/`, so the profiles have their own numbers and do not collide with research or reference numbers used by parallel work ([DEC-0047](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)).
- Sentiment and themes by fixed rules, not a model: traceable, nothing to download, no paid API.
- robots.txt is obeyed with wildcard matching, which is what makes Apple's review feeds off limits. We did not use the URL form that the rule does not literally match.
- Only counts leave the machine: a new `profile_snapshots` table, newest 20 kept, copied to `data/profiles.json` at deploy. Review text stays in the local SQLite file and is blanked after 400 days.
- The decision is numbered DEC-0047 because DEC-0045 is named by the latency work and DEC-0046 is taken by the architecture branch.

## Open questions

- **Reddit key (owner step).** Create a Reddit "script" app for read-only research, then store `parity-reddit-client-id` and `parity-reddit-client-secret` in the vault with rows in `~/.claude/CREDENTIALS.md`. The sims service picks them up at its next restart.
- Retail apps are under-counted until Reddit is keyed, and the Verify competitors have almost no public feedback.
- The word lists are first drafts. A sample of 100 labelled items would tell us how often they are wrong.
- The profiles could link the per-platform rows of RES-0022 directly; not done yet.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
