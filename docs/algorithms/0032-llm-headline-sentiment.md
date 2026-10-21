---
id: ALG-0032
title: LLM (ChatGPT) news headline sentiment
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [news, open-source, strategy]
related: []
---

# LLM (ChatGPT) news headline sentiment

## In plain words

You ask a chatbot whether each news headline is good or bad for the company. Then you buy companies with good news and sell those with bad news for a day.

## Summary

| | |
| --- | --- |
| Family | event-news |
| Markets | equities |
| Horizon | daily |
| Tags | llm, news, lookahead-risk, decay |
| Origin | academic: Lopez-Lira, Tang |
| First published | 2023 (3 years ago) |
| Primary source | [Can ChatGPT Forecast Stock Price Movements? Return Predictability and Large Language Models (arXiv 2304.07619)](https://arxiv.org/abs/2304.07619) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: The same headline-scoring approach could be applied to macro and central bank news for FX, if the model's knowledge cutoff predates the test window. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/llm-headline-sentiment.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** You ask a chatbot whether each news headline is good or bad for the company. Then you buy companies with good news and sell those with bad news for a day.

<details><summary>Analogy</summary>

Like having a fast reader scan the morning paper and tell you which shops just got good or bad reviews.

</details>

<details><summary>Precise</summary>

Prompt GPT-4 with each firm headline to score it as good, bad or unknown for the stock; form an equal-weighted daily long-short portfolio from positive and negative scores. Most of the measured skill is the non-tradable initial reaction; the tradable part is the next-day drift.

</details>

### The rule

For headlines released after the close (or overnight), score each with the LLM; at the next open buy all firms scored positive and short all scored negative, equal weighted, and close at the next close. Require at least two firms per leg.

### Data needed

- Timestamped firm-level news headlines (RavenPack or Dow Jones, typically paid)
- Daily open and close prices
- LLM API access with a knowledge cutoff before the test period

### Why it might work

Investors underreact to news, especially for small caps and negative news, and limits to arbitrage slow the correction (Lopez-Lira and Tang).

### Why it might fail

Lopez-Lira and Tang report the Sharpe fell from 6.54 in 2021Q4 to 1.22 in early 2024 as LLM use spread, and 20 bps round-trip costs make it unprofitable. Glasserman and Lin (2023) show in-sample LLM backtests mix lookahead bias with a distraction effect from company names.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Lopez-Lira and Tang, arXiv 2304.07619 v6](https://arxiv.org/abs/2304.07619) | 2021-10 to 2024-05 | US stocks with news, 4,123 firms | 2.97 | n/a | n/a | n/a | backtest | no | yes |
| [Glasserman and Lin (2023), arXiv 2309.17322](https://arxiv.org/abs/2309.17322) | 2015-01 to 2021-09 in-sample; 2021-10 to 2022-12 out-of-sample | S&P 500 stocks, GPT-3.5 headline sentiment | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Lopez-Lira and Tang, arXiv 2304.07619 v6:** Read in the arXiv PDF. GPT-4 (gpt-4-0314, training data to September 2021) overnight-news drift strategy, 34 bps per day before costs. At 10 bps round trip the Sharpe falls to 1.29; 20 bps makes it unprofitable. Turnover about 190 percent per day. Yearly Sharpe: 6.54 (2021Q4), 3.68 (2022), 2.33 (2023), 1.22 (Jan-May 2024).
- **Glasserman and Lin (2023), arXiv 2309.17322:** Anonymized headlines outperform original headlines in-sample, so the distraction effect outweighs lookahead bias; out-of-sample lookahead is not a concern but distraction remains. Recommends stripping company names from prompts.

### After publication

The authors' own updated sample shows steady decay (Sharpe 6.54 to 1.22 by mid-2024). Any backtest using a model whose training data overlaps the test window is contaminated; Glasserman and Lin propose anonymizing entities.

### Implementations

- [https://github.com/AI4Finance-Foundation/FinGPT](https://github.com/AI4Finance-Foundation/FinGPT) (Python, license: MIT): Open LLM sentiment pipelines; not the authors' code.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | not yet |
| 4. implemented | not yet |
| 5. registered | not yet |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
