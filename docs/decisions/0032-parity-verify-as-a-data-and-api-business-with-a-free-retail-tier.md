---
id: DEC-0032
title: Parity Verify as a data and API business, with a free retail tier
type: decision
status: proposed
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, process]
related: [INT-0003, RES-0020, REF-0016, DEC-0015, DEC-0019, DEC-0025]
---

# Parity Verify as a data and API business, with a free retail tier

## In plain words

We give the checker away to traders for free, because every check teaches us something and every shared badge brings in more people. We charge serious traders and sellers a small monthly fee. The real business is selling two things to companies: a score that says how trustworthy a trading record is, delivered by API to copy-trading sites, bot marketplaces, prop firms and brokers, and a dataset of tested strategies, how many tries each took and why the failures failed. Nobody else has that dataset, and it grows every time someone uses the free checker. This is proposed for the owner to accept.

## Context

The owner wants a startup, not only a tool, and pointed at data as a service as the stronger model ([INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)). The market research in [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md) found:

- Retail is where the people are: about 5 to 10 million active bot, copy, prop and systematic traders (our estimate), but each pays little.
- Platforms pay more each, and a neutral, cross-platform, luck-adjusted check does not exist. Every "verified" badge today is issued by a platform that profits from the trader.
- Strategy-quality data is an open slot. Crypto and market data vendors sell prices and analytics, not "which strategies were tried and failed".
- The closest competitor, QuantPad, grades strategies but shows no trial counting or shareable badge.

Software tools for traders are crowded and cheap: journals sell at $15 to $99 a month and backtesters give a lot away free. A data asset that only we hold is harder to copy than a feature.

## Decision

Proposed. Nothing is charged until the owner accepts this and the legal check below is done.

### 1. What we sell

- **Parity Score.** A 0 to 100 rating of a trading record's robustness, with its parts always shown:
  - expectancy after costs;
  - the luck check at the known or stated number of tries, and "survives up to N tries";
  - tail risk;
  - look-ahead and overfitting flags;
  - record length;
  - the trust level of the data (self-reported, broker-connected, or platform-supplied).

  The formula is versioned and published. A score never says buy, sell or copy.
- **The dataset.** Opt-in rows from Verify plus every strategy our own research and search have tested:
  - summary numbers;
  - trial counts;
  - asset classes and holding periods;
  - the failure reason (negative expectancy, luck, tail risk, look-ahead, overfit, decayed out of sample);
  - for records old enough, what happened over the next 6 and 12 months.

  No names and no trades. The research side's own trials are already counted ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)), so the dataset starts with about 94,000 rows on day one (the search count on 24 October 2026), labelled as research rows.
- **The API.** Score a record, fetch a badge, query the dataset in aggregate, and receive webhooks when a scored record decays.

### 2. Pricing tiers

Starting points to test, not commitments. The retail prices sit at or below the journal tools listed in RES-0020.

| Tier | Who | Price | What is included |
| --- | --- | --- | --- |
| Free | Anyone | $0 | 5 checks a month, all five cards, public self-reported badges |
| Pro | Retail traders | $15 a month or $144 a year | Unlimited checks, private reports, PDF export, claim checker for sellers' pages, history of past checks |
| Seller | Signal sellers, bot builders, traders raising money | $49 a month | A public profile of every badge (withdrawn ones stay listed as withdrawn), embeds, monthly re-check reminders, broker-connected badges when built |
| API Starter | Small platforms, AI-agent builders | $500 a month | 2,000 scored records a month, then $0.25 each |
| Platform | Copy-trading sites, bot marketplaces, prop firms, brokers | $2,000 to $10,000 a month | 25,000 or more scored records a month, white-label badges, webhooks, support, then $0.10 each |
| Data licence | Quant funds, researchers, platforms | $25,000 to $100,000 a year | The aggregate dataset with a method note, refreshed monthly. Free for academic use with attribution |

The local MCP server stays free ([DEC-0025](0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)). The hosted MCP planned there uses the API tiers and their keys.

### 3. Go to market

The free checker is the wedge. Five channels feed it, in this order of cost:

1. **The content engine.** Bot battle clips (99% win rate against 56%, very different profit) in 9:16, square and GIF, posted by the owner, each ending on "check your bot free at Parity Verify". Labelled hypothetical and educational, as already decided for the clips.
2. **The free verifier and its badges.** Every shared badge is a link back. The "survives up to N tries" number is built to be quoted.
3. **SEO.** Public pages that answer what people search before buying a bot: "is this trading bot legit", "what is a good win rate", "how to read a Myfxbook", "how to spot a fake track record". The pipeline from [DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md) builds them. Academy lessons link to Verify.
4. **Partnerships.** Copy-trading platforms and prop firms first, because the problem costs them money directly (fraud, gamblers, regulator attention). Offer a free pilot that scores their top 500 leaders or last month's funded traders and shows what the score would have caught. Journals (TradeZella, Tradervue, Edgewonk, FX Replay) as a second ring: their users already hold clean trade logs.
5. **AI builders through MCP.** A `verify_record` tool in the MCP server, so any agent that writes a strategy can check it before a person sees it. "Your agent tried 40 strategies; this one survives up to 12 tries" is the message.

### 4. The moat

In order of how hard each is to copy:

1. **The dataset of tested and failed strategies with counted trials.** No backtester records failures, and no track-record site records tries. Ours grows with every free check, every platform pilot and every hour of the always-on search. Outcomes over the following 6 and 12 months make it more valuable as it ages.
2. **The network effect of the badge.** Once buyers of bots and signals expect a Parity badge, sellers need one, and a seller without one, or with a withdrawn one, stands out. Withdrawals stay visible, so the badge cannot be gamed by deleting losers.
3. **Switching costs through the API.** Platforms that put the score on every listing, and build rules on it (fees, funding, leaderboards), keep it.
4. **The method.** The luck check, look-ahead detection, publication lags and release delays we already apply ([DEC-0027](0027-new-edge-families-from-the-wider-data.md)). The ideas are public papers, so the method alone is not a moat. The care in applying them, and the record of our own mistakes, builds trust that a new entrant lacks.

### 5. Traction milestones

| By | Product | Users and data | Revenue and partners |
| --- | --- | --- | --- |
| 30 days | Verify MVP live per [REF-0016](../reference/0016-parity-verify-mvp-spec.md); 10 bot battle clips posted; 5 SEO pages | 500 checks, 50 shared badges | 3 platform conversations (at least one prop firm and one copy-trading site) |
| 90 days | Pro tier on; MCP `verify_record` tool; first broker-connected source scoped | 5,000 checks, 10% share rate, 1,000 opt-in dataset rows | 100 paying Pro users; 2 signed free pilots |
| 180 days | API v1 with keys and limits; Parity Score v1 published | 25,000 checks, 10,000 opt-in rows | $5,000 a month total; 1 paying platform; 1 data licence conversation with a fund or researcher |

### 6. Regulatory notes

This is a summary for planning, not legal advice. A securities lawyer checks it before any paid tier launches.

- **No advice.** Verify judges a record, never a person's choice. No "buy", "copy" or "subscribe". No ranking of records by return.
- **Verification is not endorsement.** Badges say so in words, and say "self-reported" until data comes from a broker or platform.
- **Hypothetical performance.** Many records are backtests. If an adviser uses our badge in marketing, the SEC Marketing Rule's hypothetical performance conditions apply to them, and NFA Rule 2-29 applies to futures promoters ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md#where-verification-is-missing-and-why)). Our terms must say that using a badge does not satisfy those rules for them.
- **Ratings questions for the lawyer.** Whether publishing scores of strategies that others sell to the public could make us an investment adviser, and whether the publisher's exclusion covers us (**unverified**, needs counsel). Whether negative public verdicts create defamation risk; the MVP avoids this by scoring only what owners upload.
- **Data protection.** Opt-in only, no names, summary numbers only, a privacy policy section before launch ([REF-0016](../reference/0016-parity-verify-mvp-spec.md#data-handling-and-privacy)).
- **Real trading stays out** ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)).

### 7. Risks and kill criteria

| Risk | What we do about it |
| --- | --- |
| Platforms do not want honest scores, because lucky leaders drive volume | Lead with prop firms, whose own money is at risk when they fund a gambler; offer the score privately first |
| Faked CSV files | Badges say "self-reported"; broker-connected badges come next; the dataset weights rows by trust level |
| Retail will not pay for a narrow tool | Retail is the wedge, not the revenue; judge it on shares and opt-in rows |
| QuantPad or a journal adds trial counting | Move fast on the badge and dataset, which they cannot copy quickly |
| A wrong verdict harms someone | Every card shows its inputs; a correction process; complaints tracked against the 2% target in INT-0003 |
| Legal cost or a regulator's view | Lawyer check before charging; no advice language anywhere |

**Kill or rethink if any of these is true:**

- At 90 days, fewer than 2,500 checks, half the target.
- At 90 days, a share rate below 3%.
- At 180 days, no platform has agreed even to a free pilot.
- At 180 days, fewer than 1% of signed-in users pay.
- A lawyer finds the score itself needs a licence we cannot get at our size.

Rethinking means narrowing to the segment that did respond (for example, prop-firm screening only), not quietly carrying on.

## Alternatives considered

- **Keep building a general strategy app like QuantPad.** Rejected. It is crowded, and QuantPad already has data licences and a head start. A general app also has no data moat.
- **Pure retail SaaS.** Rejected as the main model. Retail tool prices are low and churn is high, and it builds no asset beyond the code.
- **Sell only to platforms from day one.** Rejected. Platforms buy what their users already ask for. The free checker and badges create that demand, and the dataset needs volume that only free retail use gives.
- **A signal or copy-trading marketplace of our own.** Rejected. It would put us on the side we are meant to check.

## Consequences

- The product app gets one main job, Verify ([REF-0016](../reference/0016-parity-verify-mvp-spec.md)). Other product pages stay but stop growing unless they feed Verify.
- The wall in [DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md) needs one note: research rows can flow into the dataset as labelled rows, but Verify data never flows into research.
- We need a lawyer before charging, a Stripe account for the Pro tier, and API keys with limits and a log, on their own subdomain, before the API launches.
- The owner posts the clips; we have no social accounts.
- Market numbers in RES-0020 are partly our estimates. They should be revisited at 90 days with real conversion data.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0003: Parity Verify, the lie detector for trading strategies and bots](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)
- [RES-0020: Verifying trading claims, market size and competitors](../research/0020-verifying-trading-claims-market-size-and-competitors.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
<!-- backlinks:end -->
