---
id: RES-0029
title: Ayan's and Abanish's plans compared, and where Parity fits
type: research
status: current
created: 2026-10-29
updated: 2026-10-29
authors: [amanda]
tags: [competitors, method, news, strategy]
related: [INT-0003, DEC-0032, DEC-0079, RES-0020, RES-0025, RES-0030]
---

# Ayan's and Abanish's plans compared, and where Parity fits

## In plain words

Parity has two written plans for what it sells. Ayan's plan is **Verify**: check whether a trading record is real skill or luck, counting every try. Abanish's plan is an **explainer**: show why a piece of news moved a stock, what else it moves, and keep a public record of every call. We put the two side by side, looked again at the market for anything new since 23 October, and asked which plan fits the market best. Verify fits better today, and the owner already chose it on 27 October. Abanish's work is still useful inside Verify: its public record of calls is exactly the kind of record Verify is built to check, so it can be Verify's first real customer and its best demo.

## Summary

- **Two plans, one shared idea.** Both plans sell honesty: a public record that keeps the misses. Ayan's applies it to other people's trading records ([INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md), [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md), [DEC-0079](../decisions/0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md)). Abanish's applies it to news calls ([RES-0025](0025-market-research-retail-trading-and-investing-leaders-weaknesses-and-gaps.md)).
- **What changed since 23 October.**
  - **AI trading leaderboards have arrived, and they rank by raw return.** TradeRank ranks 22 models by return on $10,000 of simulated money, with no luck adjustment. Only 43.1% of its model-seasons since January 2026 ended in profit [@url-fa6d5610].
  - **Asking an AI to audit a backtest goes badly.** One AI auditor flagged 93.8% of clean backtests as broken [@ulesov2026].
  - **A six-month study of real AI trading agents found no edge.** It covered 3,505 user-funded vaults and up to 599 agents [@barton2026].
  - All three make Verify's problem bigger and more urgent.
- **Fit.** Verify scores higher on the parts that make a startup work: who pays, how the product reaches them, how hard it is to copy, and how much of it is already built. The explainer faces large, well-funded players: Schwab, Robinhood, Finviz and WhyStockMove already answer "why did it move" [RES-0025](0025-market-research-retail-trading-and-investing-leaders-weaknesses-and-gaps.md#who-does-something-similar).
- **Recommendation.**
  - Keep Verify as the product.
  - Turn the event graph into Verify's first public record: badge Abanish's Fed record (61 right, 51 wrong, [#170](https://github.com/abasheer-rion/parity/pull/170)).
  - Use the AI leaderboards as content and as sales leads.
  - Grow the dataset with outside data that already has known outcomes ([RES-0030](0030-outside-data-to-grow-the-counted-trials-dataset.md)).

## The two plans side by side

| | Ayan: Parity Verify | Abanish: news explainer and event graph |
| --- | --- | --- |
| One-line pitch | "AI-native verification platform for retail traders of all sizes" | "A checkable explanation of how a piece of news reaches other companies, for a retail price" |
| Problem | Records hide luck: rare big losses, hundreds of discarded tries, look-ahead | Retail gets ratings, not reasons; supply-chain research costs $12K to $32K a seat |
| First customer | A retail trader about to buy a bot or signal; a trader showing a record to a prop firm | A retail investor who wants to know why a holding moved and what else it hits |
| Who pays most | Prop firms, copy-trading platforms, bot marketplaces, brokers through the API; data licences | Retail subscriptions at $10 to $80 a month |
| Product today | Live: `/verify/`, the API, MCP tools, imports from 11 brokers, badges, `/methodology/` (#180 to #183) | Built in `event-graph/`: 40 Fed cases, a GDELT bridge and live calls (#141, #143, #169, #170, #184). No retail product page yet |
| Moat claimed | The counted-trials dataset (246,869 tries by 27 October), the open method, the badge network, platform switching costs | A public record of every call; knock-on effects and small caps; reasons as data for AI agents |
| Biggest competitor | QuantPad's A-to-F "Verdict" (no trial counting) | Schwab Portfolio Insights, Robinhood's and Public's assistants, WhyStockMove, Finviz |
| Track record so far | The research side: every official run so far failed the gauntlet, and it was published | Fed cases: 61 right, 51 wrong; Warsh era 6 right, 15 wrong |
| Status | Owner decision, accepted (DEC-0079) | Market research (RES-0025); the engine runs off CI |

The two plans agree on more than they differ. Both:

- refuse to take payment for order flow;
- publish their failures;
- count tries;
- serve AI agents through MCP.

RES-0025 lists "every attempt counted" and "strategies that show their failures" among Parity's openings, which is Verify.

## What is new in the market since RES-0020

RES-0020 was gathered on 23 October. These items came after it, or were not in it.

| Finding | Evidence | Why it matters for Verify |
| --- | --- | --- |
| Public AI trading leaderboards rank by raw return | TradeRank: 22 models in Season 10, 69 distinct entrants across 10 seasons, each with $10,000 of simulated money, "ranked by return", no luck or significance adjustment on the page. 43.1% of model-seasons since January 2026 ended in profit [@url-fa6d5610] | A leaderboard of 69 entrants guarantees a lucky winner. "Which of these survive luck?" is a ready-made content series and a test case for the trial count |
| A second leaderboard, a different winner | Oak Research ran a 90-day crypto perpetuals test from 18 July to 16 October 2026, one decision a day, $10,000 each. GLM-5.3 led at +29.4% against buy-and-hold BTC at +23.3% [@url-f09d16b3] | Two leaderboards over overlapping periods crown different models. That is the instability a luck check measures |
| AI auditors flag clean backtests | A paired set of 48 flawed and 48 clean backtests. One model found every flaw but flagged 93.8% of the clean controls under open prompts; a warning about clean controls cut false positives from 20.8% to 0% [@ulesov2026] | An LLM is a poor auditor unless it is checked against clean controls. Verify's checks are deterministic. We should publish our own false-positive rate on clean records, which almost nobody reports |
| Real LLM agents show no edge | 3,505 user-funded vaults trading real ETH for 21 days, and 500 to 599 agents on Hyperliquid for three months. Neither fleet showed a directional edge. The DXAP fleet won 41% of round trips against a matched retail benchmark's 50%. Frontier models were statistically indistinguishable on 416 replayed scenarios [@barton2026] | People are already handing real money to agents. That is the "AI-agent builders" row in INT-0003, with evidence now behind it |
| Prop-firm pass rates | Widely repeated: 14% pass, about 7% ever paid, from FPFX Tech data on over 300,000 accounts, reported by Finance Magnates in September 2024 [@url-82637c93]. **Unverified**: we could not open the original article | If true, a prop firm pays out to about 1 in 14 buyers. A pre-funding luck check saves it money, which is the pitch in DEC-0032 |
| Copy-trading rules | No new 2026 ESMA or FCA rule found. ESMA's supervisory briefing of 30 March 2023 is still the reference [@url-f3b04298] | A score is not yet required by law. Platforms buy it for trust and fraud control, not compliance. The DEC-0032 pitch order (prop firms first) holds |

We found no new direct competitor that counts tries. A search for an independent registry of verified live track records came back empty.

## Fit: how each plan scores

We scored each plan from 1 (weak) to 5 (strong) on what [INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md) asks a startup to have. The scores are **our judgement**; the column after each gives the reason, so they can be argued with.

| Test | Verify | Why | Explainer | Why |
| --- | --- | --- | --- | --- |
| Real, painful problem | 5 | Regulators fine people for unbacked claims; scams promise 100% win rates; 69-entrant AI leaderboards | 3 | Real, but answered "well enough" by free broker tools for most people |
| Someone pays | 4 | Prop firms and platforms lose money to gamblers and fraud; API pricing in DEC-0032 | 2 | Retail research subscriptions work (Koyfin, Seeking Alpha) but are crowded; the institutional version is Bloomberg's |
| Reachable cheaply | 4 | The badge spreads itself; the MCP tools put it inside the AI apps people already use | 3 | SEO and news posts work (#184), but compete with every finance site |
| Hard to copy | 4 | The dataset of counted tries grows with use; nobody else records failures | 3 | A public record of calls is hard to fake, but slow to build; the link data can be bought |
| Already built | 5 | Live on the site, API and MCP | 2 | The engine and cases exist; no product surface |
| Competition | 4 | QuantPad is closest and does not count tries | 2 | Schwab, Robinhood, Public, Finviz, WhyStockMove, Toggle |
| Legal risk | 3 | Scores near "advice"; needs counsel before charging (DEC-0032) | 3 | News calls near "advice" too; defamation risk on named companies is low |
| **Total (of 35)** | **29** | | **18** | |

The gap is mostly "already built" and "competition". On the core problem, the explainer is a fair idea; it is just in a crowded room.

## Where Abanish's work fits inside Verify

The event graph does not have to compete with Verify. It can feed it in three ways:

1. **Verify's first public record.** The Fed case library is a dated, pre-registered record of calls, misses included. That is exactly what Verify checks. Running it through Verify and publishing the badge shows the product on our own work first. It also tests the "claim" check on something that is not a trade list.
2. **A demo that teaches the trial count.** 40 Fed cases, with many exposures per case, is a set of tries. "61 right out of 112 calls; is that skill?" is the question Verify answers. The honest answer, whatever it is, makes a better clip than a winning chart.
3. **Research, kept apart.** The engine stays on the research side ([DEC-0015](../decisions/0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)). Verify data never flows into it.

## Risks to the Verify fit

| Risk | Signal to watch | Source |
| --- | --- | --- |
| Retail checks without sharing | INT-0003's 30-day target is 500 checks and 50 shared badges by about 22 November | INT-0003 |
| Platforms prefer flattering leaderboards | No design-partner conversation by 30 days | DEC-0032 kill criteria |
| AI auditors get "good enough" | A model that matches our flags with a low false-positive rate on clean controls | [@ulesov2026] |
| QuantPad adds trial counting | Its public page; not checked again today (our search found nothing new) | RES-0020 |
| No interviews yet | Every number here is desk research. Nobody has talked to a prop firm or a copy-trading platform on record | This doc |

## What we suggest next

1. Badge the Fed case record through Verify and publish it as the first worked example. This needs Abanish and Ayan to agree.
2. Write a "Which AI trader survives luck?" post on the public leaderboards. Use aggregate numbers only, since INT-0003 bars public verdicts on people who did not ask, and ask Ayan whether models count as "people" here.
3. Measure our false-positive rate on clean records, in the style of [@ulesov2026], and publish it on `/methodology/`.
4. Seed the dataset with outside rows that have known outcomes ([RES-0030](0030-outside-data-to-grow-the-counted-trials-dataset.md)). Then the "holds up" accuracy target in INT-0003 can be estimated now, not in 12 months.
5. Hold five customer interviews: two prop firms, two copy-trading or bot platforms, and one journal company. Log them as research.

## Sources

All fetched on 2026-10-29. Company figures are self-reported.

| Source | Link |
| --- | --- |
| TradeRank AI trading leaderboard | <https://www.traderank.ai/ai-trading-leaderboard> |
| Oak Research AI trading benchmark | <https://oakresearch.io/en/ai/trading-benchmark> |
| Ulesov, Smirnov, Ibrahim and Bobovnikov (2026), Can LLMs Catch a Rigged Backtest? | <https://arxiv.org/abs/2609.28090> |
| Barton et al. (2026), What LLM Trading Agents Actually Do in Production | <https://arxiv.org/abs/2609.05663> |
| Track360, prop trading statistics 2026 (secondary source for the FPFX figures) | <https://track360.io/blog/prop-trading-industry-statistics-2026> |
| PwC Legal, ESMA supervisory expectations on copy trading | <https://legal.pwc.de/en/news/articles/esma-communicates-supervisory-expectations-on-copy-trading-services> |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-fa6d5610](../REFERENCES.md#url-fa6d5610): TradeRank AI trading leaderboard, October 2026 (n.d.)
- [@ulesov2026](../REFERENCES.md#ulesov2026): Ulesov et al. (2026), Can LLMs Catch a Rigged Backtest? A Clean-Control Calibration Benchmark
- [@barton2026](../REFERENCES.md#barton2026): Barton et al. (2026), What LLM Trading Agents Actually Do in Production: A Six-Month, Population-Scale Record from Two Fleets
- [@url-f09d16b3](../REFERENCES.md#url-f09d16b3): AI Trading Benchmark: LLM Leaderboard for Crypto Trading (n.d.)
- [@url-82637c93](../REFERENCES.md#url-82637c93): Prop Trading Statistics 2026: Pass Rates and Market Data (n.d.)
- [@url-f3b04298](../REFERENCES.md#url-f3b04298): ESMA communicates supervisory expectations on copy trading services (n.d.)

## Referenced by

- [RES-0030: Outside data to grow the counted-trials dataset](0030-outside-data-to-grow-the-counted-trials-dataset.md)
<!-- backlinks:end -->
