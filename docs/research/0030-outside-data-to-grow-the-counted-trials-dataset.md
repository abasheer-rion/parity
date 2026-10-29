---
id: RES-0030
title: Outside data to grow the counted-trials dataset
type: research
status: current
created: 2026-10-29
updated: 2026-10-29
authors: [amanda]
tags: [data, method, open-source]
related: [DEC-0032, DEC-0079, INT-0003, RES-0029, DEC-0014, DEC-0015]
---

# Outside data to grow the counted-trials dataset

## In plain words

Parity's moat is a database of strategies that were tried, with how many tries each took and whether they held up later ([DEC-0079](../decisions/0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md)). Today almost every row comes from our own search. This doc lists outside sources that already hold the same kind of record. Each one shows strategies or signals someone found, how many were tried, and what happened afterwards. Adding them gives the database rows with known outcomes now, instead of waiting a year for our own. It also lets us test whether Verify's "holds up" verdict would have been right.

## Summary

- **The need.** INT-0003 sets a target: of the records we call "Holds up", above 60% should keep a positive Sharpe over the next 6 months. That cannot be measured until 200 records are old enough, about 12 months out. Outside data with known later results lets us estimate it now.
- **The best sources.**
  - **Open Source Asset Pricing:** about 200 published stock signals with their publication years. Its latest data update was 28 October 2026 [@url-28e0e490].
  - **The Jensen, Kelly and Pedersen global factors:** 153 factors in 93 countries, updated in April 2026 through December 2025 [@url-c2280db1]. Its licence bars commercial use.
  - **Quantpedia's own out-of-sample study [@url-583d7f70]:** median Sharpe fell from 1.18 to 0.66 [@url-e6249d93].
- **The count of tries.** Harvey, Liu and Zhu counted 316 published factors; Harvey and Liu's later census counted 382 [@harvey2015; @harvey2019]. Those counts are the "tries" for any factor-like claim a user brings.
- **AI agents.** Barton et al. (2026) publish aggregate data on thousands of real LLM trading agents [@barton2026].
- **Test sets for Verify itself.** The paired flawed-versus-clean backtests in [@ulesov2026], if released, and the 888 Quantopian algorithms in [@wiecki2016], if the data can be had.
- **Rules.**
  - Outside rows are labelled by source and never mixed with opt-in Verify rows.
  - A source whose licence bars commercial use stays research-only and is left out of any paid data licence.
  - Nothing here feeds a registration's "not seen" claim. These are other people's published results, so a registration that uses the same signals must count them in `prior_trials`.

## What a row needs

The dataset in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) holds summary numbers only. For a source to be useful, it needs at least:

| Field | Why |
| --- | --- |
| A stable id and the source | So a row can be traced and removed |
| Asset class and holding period | The dataset's filters |
| The in-sample period and its result | What the finder saw |
| The out-of-sample or post-publication result | What happened next: the label we score against |
| How many tries stood behind it, or a fair proxy | The core of the method |
| Licence | Whether it can go in a paid data licence |

## Sources

### Published signals and factors with known later results

| Source | What it holds | Later result | Tries | Licence and access | Use |
| --- | --- | --- | --- | --- | --- |
| Open Source Asset Pricing (Chen and Zimmermann) [@url-28e0e490; @chen2022] | Signals replicated from the asset pricing literature: 209 from the project plus 3 that need CRSP (price, size, short-term reversal), as packaged on PyPI. Monthly long-short portfolio returns | Returns after each paper's sample ends and after publication, for decay in the style of [@mclean2016]. **Check**: whether the signal documentation gives each paper's sample end and publication year in a column (we believe so; not confirmed today) | The literature's own count; each signal is one published "winner" | No licence stated; the site asks for a citation. CRSP-based signals need WRDS | First choice. One row per signal: in-sample Sharpe, post-publication Sharpe, years since publication |
| Jensen, Kelly and Pedersen global factors [@url-c2280db1; @jensen2023] | 153 factors in 13 themes, 93 countries; long-short and theme returns | Out-of-sample and out-of-country replication | 153, grouped into 13 themes, a cleaner "independent tries" count than 153 | **CC BY-NC 4.0**: no commercial use. Code is MIT | Research rows only. Good for testing whether the luck check's verdict carries across countries |
| Harvey, Liu and Zhu; Harvey and Liu census [@harvey2015; @harvey2019] | A list of published factors: 316, then 382 in the later census | None directly. The paper argues a new factor needs a t-statistic above 3.0 | The headline number: how many things the field has tried | A paper; no maintained dataset found | The `prior_trials` default for any stock-factor claim brought to Verify |
| Quantpedia [@url-e6249d93] | Over 950 strategy entries by end of 2023, over 730 with out-of-sample backtests | Its own study: median Sharpe 1.180 in-sample, 0.662 out-of-sample (-43.9%) [@url-583d7f70] | One entry per published strategy | Paid; prices not public in our search. Licence needed before any row is copied | Use the published decay as a benchmark only; ask for a data licence later |

### Trading algorithms and agents with real out-of-sample results

| Source | What it holds | Later result | Licence and access | Use |
| --- | --- | --- | --- | --- |
| Wiecki, Campbell, Lent and Stauth (2016), "All that glitters is not gold" [@wiecki2016] | 888 US equity algorithms written on Quantopian, backtested 2010 to 2015 | At least 6 months of true out-of-sample trading, June 2015 to February 2016. Backtest Sharpe predicted it poorly (R² below 0.025); more backtests per author meant a bigger gap | The paper had each author's backtest count, the cleanest real "tries" data ever published. **Unverified**: whether the row data was released; Quantopian shut in 2020 | If the data can be had, it is the best calibration set there is. If not, its published results are the target our verdicts should beat |
| Barton et al. (2026), LLM trading agents in production [@barton2026] | 3,505 user-funded vaults (21 days, real ETH) and 500 to 599 agents on Hyperliquid (3 months); 14,596 fills | No directional edge in either fleet | Aggregate data and figures on GitHub (`ProjectDXAI/continuous-record-llm-trading-agents`) and arXiv ancillary files; raw records likely not public | Rows for the AI-agent segment: what a typical agent's record looks like, so Verify's thresholds fit agents, not just humans |
| Public AI trading leaderboards [@url-fa6d5610; @url-f09d16b3] | TradeRank: 69 entrants over 10 seasons, $10,000 simulated each, ranked by return. Oak Research: 90 days of daily decisions | Each new season is out-of-sample for the last one's winner | Public pages; no data licence. Terms not checked | Aggregate study only: does a season's winner stay ahead? Ask Ayan before any public verdict on a named model ([RES-0029](0029-ayan-s-and-abanish-s-plans-compared-and-where-parity-fits.md)) |

### Test sets for Verify's own checks

| Source | What it is | Use |
| --- | --- | --- |
| Ulesov et al. (2026) [@ulesov2026] | 96 paired backtests: each flawed one has a clean twin that differs in one method detail. Scores both recall and false positives on clean controls | If the items are released (not linked on the arXiv page), add them to Verify's acceptance tests next to the 99% bot, the martingale and the peeking backtest from REF-0016, and publish our clean-control false-positive rate |
| `pbo` R package [@url-caa68e18] | An implementation of the probability of backtest overfitting by combinatorially symmetric cross-validation [@bailey2016] | A reference to check our own PBO numbers against on the same inputs |

## Order of work

1. **Open Source Asset Pricing first.** It is free, current, cites cleanly, and gives about 200 rows with in-sample and post-publication results. Record it in `docs/datasets/` first, then load it as labelled research rows.
2. **The factor census counts** go into Verify's defaults for stock-factor claims. That is a method change, so it needs a decision doc.
3. **Barton et al.** aggregate data for the agent segment.
4. **Jensen, Kelly and Pedersen** as research-only rows, flagged non-commercial.
5. **Ask** for the Wiecki et al. data and the Ulesov et al. items, then ask Quantpedia about a licence.

Each source gets a `docs/datasets/` entry with its rights, as the data registry requires ([DEC-0064](../decisions/0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)). Nothing is fetched or loaded by this doc.

## Sources

All fetched or searched on 2026-10-29.

| Source | Link |
| --- | --- |
| Open Source Asset Pricing | <https://www.openassetpricing.com/> |
| Jensen, Kelly and Pedersen global factor data | <https://jkpfactors.com/> |
| Harvey and Liu, A Census of the Factor Zoo | <https://papers.ssrn.com/abstract=3341728> |
| Quantpedia, research in 2023 (database and out-of-sample counts) | <https://quantpedia.com/quantpedias-research-in-2023/> |
| Quantpedia, in-sample against out-of-sample analysis | <https://quantpedia.com/tag/own-research/page/4/> |
| Barton et al. (2026) | <https://arxiv.org/abs/2609.05663> |
| Ulesov et al. (2026) | <https://arxiv.org/abs/2609.28090> |
| TradeRank | <https://www.traderank.ai/ai-trading-leaderboard> |
| Oak Research | <https://oakresearch.io/en/ai/trading-benchmark> |
| `pbo` on CRAN | <https://cran.r-project.org/package=pbo> |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-28e0e490](../REFERENCES.md#url-28e0e490): Chen and Zimmermann (n.d.), Open Source Asset Pricing
- [@url-c2280db1](../REFERENCES.md#url-c2280db1): Jensen et al. (n.d.), Global Factor Data
- [@url-583d7f70](../REFERENCES.md#url-583d7f70): Quantpedia, in-sample against out-of-sample analysis of trading strategies (n.d.)
- [@url-e6249d93](../REFERENCES.md#url-e6249d93): Quantpedia's Research in 2023 (n.d.)
- [@harvey2015](../REFERENCES.md#harvey2015): Harvey et al. (2015), ... and the Cross-Section of Expected Returns
- [@harvey2019](../REFERENCES.md#harvey2019): Harvey and Liu (2019), A Census of the Factor Zoo
- [@barton2026](../REFERENCES.md#barton2026): Barton et al. (2026), What LLM Trading Agents Actually Do in Production: A Six-Month, Population-Scale Record from Two Fleets
- [@ulesov2026](../REFERENCES.md#ulesov2026): Ulesov et al. (2026), Can LLMs Catch a Rigged Backtest? A Clean-Control Calibration Benchmark
- [@wiecki2016](../REFERENCES.md#wiecki2016): Wiecki et al. (2016), All that Glitters Is Not Gold: Comparing Backtest and Out-of-Sample Performance on a Large Cohort of Trading Algorithms
- [@chen2022](../REFERENCES.md#chen2022): Chen and Zimmermann (2022), Open Source Cross-Sectional Asset Pricing
- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?
- [@jensen2023](../REFERENCES.md#jensen2023): Jensen et al. (2023), Is There a Replication Crisis in Finance?
- [@url-fa6d5610](../REFERENCES.md#url-fa6d5610): TradeRank AI trading leaderboard, October 2026 (n.d.)
- [@url-f09d16b3](../REFERENCES.md#url-f09d16b3): AI Trading Benchmark: LLM Leaderboard for Crypto Trading (n.d.)
- [@url-caa68e18](../REFERENCES.md#url-caa68e18): pbo: Probability of Backtest Overfitting (R package) (n.d.)
- [@bailey2016](../REFERENCES.md#bailey2016): Bailey et al. (2016), The probability of backtest overfitting

## Referenced by

- [RES-0029: Ayan's and Abanish's plans compared, and where Parity fits](0029-ayan-s-and-abanish-s-plans-compared-and-where-parity-fits.md)
<!-- backlinks:end -->
