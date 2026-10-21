---
id: ALG-0030
title: FinBERT + GDELT news sentiment with XGBoost for FX and bonds
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, news, open-source, strategy]
related: []
---

# FinBERT + GDELT news sentiment with XGBoost for FX and bonds

## In plain words

A finance-trained language model reads world news every day and scores how positive or negative it is. A second model uses those scores to guess whether the euro or yen will go up or down tomorrow.

## Summary

| | |
| --- | --- |
| Family | sentiment-alternative-data |
| Markets | fx, rates |
| Horizon | daily |
| Tags | finbert, gdelt, xgboost, lookahead-risk, suspicious-sharpe |
| Origin | academic: Yuke Zhang |
| First published | 2025 (1 years ago) |
| Primary source | [Interpretable Machine Learning for Macro Alpha: A News Sentiment Case Study (arXiv 2505.16136)](https://arxiv.org/abs/2505.16136) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Directly targets FX with free data and is easy to replicate, which makes it a good leakage test case even if the headline numbers are not believable. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/finbert-gdelt-fx-sentiment.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** A finance-trained language model reads world news every day and scores how positive or negative it is. A second model uses those scores to guess whether the euro or yen will go up or down tomorrow.

<details><summary>Analogy</summary>

Like guessing tomorrow's mood in a classroom by reading today's school newsletter.

</details>

<details><summary>Precise</summary>

Score GDELT articles with FinBERT, aggregate into daily indices of mean tone, dispersion and event impact, add lags (1 to 3 days) and 5 and 20 day moving averages plus technical features, and train an XGBoost classifier for next-day direction of EUR/USD, USD/JPY and 10-year Treasury futures with expanding-window cross-validation.

</details>

### The rule

At each day t close, build sentiment features from articles available up to t, predict P(up) for day t+1 with XGBoost, go long if P(up) > 0.5 and short otherwise, paying 0.02 percent per round trip on FX.

### Data needed

- GDELT event and article tone data (free, 15-minute updates)
- FinBERT model weights (free)
- Daily EUR/USD, USD/JPY closes
- 10-year Treasury futures prices

### Why it might work

News tone and disagreement may carry macro information that FX prices absorb slowly, per the author.

### Why it might fail

A daily FX Sharpe near 6 would beat every known macro fund by a wide margin, which points to leakage or overfitting. GDELT timestamps are UTC while FX closes at 5pm New York, so articles after the close can enter day t features. Logistic regression on the same features gives Sharpe 0.66 to 0.83, so most of the result comes from the flexible model.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Zhang (2025), arXiv 2505.16136, Table 1](https://arxiv.org/abs/2505.16136) | about 2017-01 to 2025-04 (out-of-sample folds) | EUR/USD | 5.87 | 55.4% | n/a | -15.6% | backtest | yes | yes |
| [Zhang (2025), logistic regression baseline](https://arxiv.org/abs/2505.16136) | about 2017-01 to 2025-04 | EUR/USD | 0.83 | 6.6% | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Zhang (2025), arXiv 2505.16136, Table 1:** Read on the arXiv HTML page. Win rate 72.7 percent. USD/JPY Sharpe 4.65, CAGR 53.2 percent, max drawdown -22.9 percent; ZN Sharpe 4.65, CAGR 22.1 percent. Very likely too good to be true: single author, no independent replication, hyperparameters tuned within the cross-validation scheme, and a possible close-time mismatch. The linked code repository returned 404 when checked.
- **Zhang (2025), logistic regression baseline:** USD/JPY logistic Sharpe 0.66, CAGR 6.2 percent; ZN -0.15. The more plausible range for a daily news signal.

### After publication

No independent replication or live results found. The code link in the paper (github.com/yukepenn/macro-news-sentiment-trading) returned 404 on 2026-10-20.

### Implementations

- [https://github.com/ProsusAI/finBERT](https://github.com/ProsusAI/finBERT) (Python, license: Apache-2.0): FinBERT model used for sentiment scoring.

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
