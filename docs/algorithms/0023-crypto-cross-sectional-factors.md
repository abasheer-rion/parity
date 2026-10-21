---
id: ALG-0023
title: Crypto cross-sectional size and momentum factors (C-3 model)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, momentum, open-source, strategy]
related: []
---

# Crypto cross-sectional size and momentum factors (C-3 model)

## In plain words

Every week, sort all coins by size and by how much they rose recently. Small coins and recent winners have tended to do better than big coins and recent losers.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | crypto |
| Horizon | weekly |
| Tags | cross-sectional, factor-model, size, long-short |
| Origin | academic: Liu, Tsyvinski, Wu |
| First published | 2019 (7 years ago) |
| Primary source | [Common Risk Factors in Cryptocurrency (NBER w25882; Journal of Finance 2022)](https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.13119) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Cross-sectional momentum is directly transferable to a basket of currencies, but the crypto size effect is not. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/crypto-cross-sectional-factors.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Every week, sort all coins by size and by how much they rose recently. Small coins and recent winners have tended to do better than big coins and recent losers.

<details><summary>Analogy</summary>

Like picking players for next week's game based on who played well the last two weeks.

</details>

<details><summary>Precise</summary>

Sort coins with market cap above $1 million into quintiles on market cap and on 1 to 4 week past returns, rebalance weekly, and go long quintile 5 and short quintile 1. A three-factor model of crypto market, size (CSMB) and momentum (CMOM) prices nine significant long-short strategies.

</details>

### The rule

Every week, among coins with market cap above $1 million, buy the top quintile by past two-week return and short the bottom quintile (value-weighted); for size, buy the smallest quintile and short the largest. Where shorting is not possible, short BTC instead, as the authors test.

### Data needed

- Daily prices, market caps and volumes for all listed coins (CoinMarketCap, CoinGecko)
- T-bill rate
- Borrow or perpetual funding costs for short legs

### Why it might work

Liu, Tsyvinski and Wu show crypto returns are not explained by stock factors but by crypto market, size and momentum; momentum is linked to investor attention and size to illiquidity premia.

### Why it might fail

The size premium lives in tiny coins that are hard or impossible to short and expensive to trade; the paper excludes costs. Momentum works only among larger coins (4.2 vs 0.6 percent per week). Delistings and dead coins create survivorship risk in free data.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Liu, Tsyvinski, Wu NBER w25882, Table 4](https://www.nber.org/system/files/working_papers/w25882/w25882.pdf) | 2014-01 to 2018-12 | 1,707 coins with market cap above $1 million | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Borri, Liu, Tsyvinski, Wu (2025), Table 2 Panel B](https://arxiv.org/abs/2510.14435) | 2020-01 to 2025-09 | All coins, value-weighted quintiles | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Liu, Tsyvinski, Wu NBER w25882, Table 4:** Long-short excess returns of 2.7 (1-week), 3.3 (2-week), 4.1 (3-week) and 2.5 (4-week momentum) percent per week; small-minus-big size about 3.4 percent per week. No costs or shorting frictions. Weekly figures of this size compound to implausible annual numbers; treat as statistical evidence, not tradable returns.
- **Borri, Liu, Tsyvinski, Wu (2025), Table 2 Panel B:** Post-2020 two-week momentum long-short 0.021 per week (t = 3.70); size long-short -0.009 (t = -1.69), weaker than the full-sample -0.023 (t = -2.66). Weekly means, not annualized.

### After publication

Borri et al. (2025) find momentum still significant post-2020 but smaller, and size much weaker (t = -1.69). They cite Fieberg et al. (2024), who test 20,736 research designs and find size and momentum hold across specifications while other crypto factors do not.

### Implementations

- [https://github.com/freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) (Python, license: GPL-3.0): Multi-pair support; cross-sectional ranking requires custom code (for example an informative pairs list).

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
