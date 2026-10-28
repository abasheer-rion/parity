---
id: INT-0003
title: Parity Verify, the lie detector for trading strategies and bots
type: intent
status: current
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [intent, method, strategy]
related: [INT-0001, INT-0002, DEC-0032, RES-0020, REF-0016, DEC-0014, DEC-0025]
---

# Parity Verify, the lie detector for trading strategies and bots

## In plain words

Lots of people sell trading bots, signals and strategies with big win rates and smooth profit charts. Most of those numbers are not lies on purpose, but they hide something: the losses that are rare but huge, the hundred other bots that were tried and quietly thrown away, or a test that accidentally used tomorrow's prices. We already built tools that catch these tricks in our own research. Parity Verify points the same tools at anyone's strategy or bot and says, in plain words, whether its record holds up. The research carries on as before ([INT-0001](0001-initial-intent.md)); this is what the product becomes.

## Summary

On 23 October 2026 the owner set a new direction for the product side (paraphrased): make the product the lie detector for trading strategies and bots, keep pursuing the research, and make the product something a startup can be built on, with a niche, a real problem, a growing market, traction, a way to reach customers and a moat. The owner pointed at data as a service (DaaS) as the newer and stronger model.

This intent narrows [INT-0002](0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md). The public app stops trying to be a general strategy builder like QuantPad. It becomes **Parity Verify**: one job, done better than anyone, which is telling people whether a trading record can be trusted.

| | |
| --- | --- |
| Product | Parity Verify: upload a trade log, describe a bot, or pick a strategy, and get a verdict, five checks and a shareable badge ([REF-0016](../reference/0016-parity-verify-mvp-spec.md)) |
| Business | A free retail tier as the way in, a paid tier for serious traders and sellers, and a "Parity Score" API and dataset sold to platforms and data buyers ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)) |
| Market and competitors | [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md) |
| What we already have | The gauntlet, the luck check that counts every try, look-ahead tests, the factory and the always-on search ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)), the MCP tools for AI assistants ([DEC-0025](../decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)) and the bot battle clips |

## What we want

### The problem we solve

Trading claims are easy to make and hard to check. Five kinds come up again and again:

1. **Fake or misleading win rates.** A bot that wins 99% of trades can still lose money if the 1% of losses are big enough. Win rate is the number sellers show; expectancy, the average profit per trade, is the number that matters. Our bot battle shows this in a few seconds of video.
2. **Curve-fit bots.** Tune enough settings on past data and something will look great. Without counting the tries, nobody can tell skill from luck. Our own search had tried about 94,000 variations by 24 October 2026 and counts every one ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)).
3. **Copy trading and signal sellers.** Leaderboards show the survivors. Accounts that blew up are closed and vanish. Platforms earn on volume and subscriptions, so they have little reason to show the graveyard. eToro's own annual report says some of its copied traders "fraudulently" copied each other to raise their fees, though it says this was infrequent [@url-9a1baa9c].
4. **Prop firm and influencer claims.** Prop firms sell evaluations to millions of customers [@url-849471fb] and influencers post screenshots of their best days. Regulators have fined firms for advertising hypothetical results they could not back up [@url-c53f97a6; @url-be81eda4].
5. **AI-generated strategies.** AI assistants write a working backtest in minutes and keep tuning until it looks good, which is overfitting at machine speed. US regulators already warn about AI trading bot scams promising "100 percent 'win' rates" [@url-a1682719] and have charged firms for claiming AI they did not use [@url-6c190e5d].

### Who pays

| Who | What they need | What they pay for |
| --- | --- | --- |
| Retail traders (prosumer) | "Is this bot or signal I am about to buy real?" and "Is my own strategy luck?" | Free checks; a small monthly plan for unlimited and private reports |
| Serious discretionary and systematic traders | A record they can show to investors, prop firms or followers that is checked by someone else | A verified badge and a public record page |
| Bot marketplaces and copy-trading platforms | A trust signal that sorts real traders from lucky ones, and protection from regulators and fraud | API calls per verified strategy, a score on every listing |
| Prop firms | Spotting gamblers and copy-traders among challenge takers before funding them | API calls per funded trader, a risk flag feed |
| Brokers and fintech apps | Showing customers honest strategy statistics instead of win rates | API and white-label widgets |
| AI-agent builders | A guard that stops an agent from shipping an overfit strategy | MCP and API calls, priced per check |
| Data buyers (quant funds, researchers) | A dataset of what was tried, what failed and why, with trial counts | Annual data licences |

### What makes it ours

- **We count tries.** Nobody else in this market adjusts a record for how many strategies were tried before it. Our luck check does it, and the "survives up to N tries" number turns it into something anyone can understand.
- **We publish failures.** Every result, good or bad, goes in the record. That is how the research already works, and it is the opposite of a leaderboard.
- **We sit on the research.** The product shows what the research measured and never ranks by return ([DEC-0015](../decisions/0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).

## What we do not want

- **No advice.** Verify says whether a record holds up. It never says buy, sell, copy or subscribe. A badge is verification, not endorsement, and it says so on its face.
- **No trading for users.** Real trading stays a separate, future decision ([DEC-0019](../decisions/0019-real-trading-later-what-it-would-legally-take.md)).
- **No claims we cannot back.** A verdict on a self-uploaded file says "self-reported". We do not call anything "verified by broker" until we read it from the broker.
- **No public verdicts on people who did not ask.** We verify what owners upload, and what platforms send us under contract. We do not scrape and grade strangers.
- **No selling personal data.** The dataset holds summary numbers from people who opted in, without names.
- **No bending the research.** Verify data never feeds a research test. The wall in DEC-0015 still holds.

## How we will know

| Measure | Target | By |
| --- | --- | --- |
| MVP live in the product app, all acceptance tests in REF-0016 passing | Done | 30 days |
| Records checked | 500 in 30 days, 5,000 in 90 days, 25,000 in 180 days | 180 days |
| Share rate: checks that end in a published badge | At least 10% | 90 days |
| Opt-in rows in the research dataset | 1,000 by 90 days, 10,000 by 180 days | 180 days |
| Paying retail users | 100 by 90 days; $5,000 a month by 180 days | 180 days |
| Platforms (copy trading, bot marketplace or prop firm) | 3 design partners talking by 30 days, 2 signed pilots by 90 days, 1 paying by 180 days | 180 days |
| Accuracy: the 99% bot, the martingale and the peeking backtest fixtures are caught | 100% | Every release |
| Accuracy: share of strategies we called "Holds up" that keep a positive Sharpe on the next 6 months of data we did not see | Tracked from launch; target above 60% once 200 are old enough | 12 months |
| Complaints that a verdict was wrong and we agreed | Below 2% of published badges, each fixed in the method and logged | Ongoing |

If the 90-day numbers miss by more than half, we stop and rethink, as set out in the kill criteria in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-9a1baa9c](../REFERENCES.md#url-9a1baa9c): eToro Group Ltd., annual report on Form 20-F for 2025 (n.d.)
- [@url-849471fb](../REFERENCES.md#url-849471fb): The Modern Prop Trading Firm since 2015 | FTMO (n.d.)
- [@url-c53f97a6](../REFERENCES.md#url-c53f97a6): SEC charges nine investment advisers in ongoing sweep into marketing rule violations (n.d.)
- [@url-be81eda4](../REFERENCES.md#url-be81eda4): SEC charges five investment advisers for marketing rule violations (n.d.)
- [@url-a1682719](../REFERENCES.md#url-a1682719): Customer Advisory: AI Won't Turn Trading Bots into Money Machines | CFTC (n.d.)
- [@url-6c190e5d](../REFERENCES.md#url-6c190e5d): SEC charges two investment advisers with making false and misleading statements about their use of artificial intelligence (n.d.)

## Referenced by

- [DEC-0032: Parity Verify as a data and API business, with a free retail tier](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- [DEC-0036: Verify runs its checks in the browser and holds daily prices only](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)
- [DEC-0039: A front page for Verify, dark glass and scroll scenes](../decisions/0039-a-front-page-for-verify-dark-glass-and-scroll-scenes.md)
- [DEC-0079: Parity is an AI-native verification platform for retail traders of all sizes](../decisions/0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md)
- [RES-0020: Verifying trading claims, market size and competitors](../research/0020-verifying-trading-claims-market-size-and-competitors.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
<!-- backlinks:end -->
