---
id: ALG-0050
title: Statistical arbitrage on PCA or ETF residuals (Avellaneda-Lee)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [open-source, strategy]
related: []
---

# Statistical arbitrage on PCA or ETF residuals (Avellaneda-Lee)

## In plain words

Work out how much of each stock's move is just the whole market or its industry moving. Bet that the leftover, stock-only part shrinks back to normal.

## Summary

| | |
| --- | --- |
| Family | statistical-arbitrage |
| Markets | equities |
| Horizon | daily |
| Tags | mean-reversion, pca, market-neutral, ornstein-uhlenbeck |
| Origin | academic: Avellaneda, Lee |
| First published | 2008 (18 years ago) |
| Primary source | [Statistical Arbitrage in the U.S. Equities Market (Quantitative Finance 2010; draft 2008)](https://doi.org/10.1080/14697680903124632) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: An equity method; the residual idea could be applied to a currency cross-section after removing a dollar factor, but it is not central to parity. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/stat-arb-pca-residuals.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Work out how much of each stock's move is just the whole market or its industry moving. Bet that the leftover, stock-only part shrinks back to normal.

<details><summary>Analogy</summary>

Like a teacher who knows how a class usually scores; when one student is far off the class pattern, she expects them to drift back.

</details>

<details><summary>Precise</summary>

Each stock's daily returns are regressed on principal-component factors or a sector ETF over a 60-day window; the cumulative residual is modeled as an Ornstein-Uhlenbeck process and standardized into an s-score. The strategy trades the residual contrarian, hedging the factor exposure, across hundreds of stocks.

</details>

### The rule

Daily: regress each stock on 15 PCA factors (or its sector ETF) over the past 60 days; fit an OU process to the residual; s = standardized deviation. Open long if s < -1.25, open short if s > 1.25; close long when s > -0.50, close short when s < 0.75; hedge factor exposure; assume 5 bp cost per trade.

### Data needed

- Daily returns for a large stock universe
- Sector ETF returns
- Daily volume (optional, for trading-time signals)

### Why it might work

Short-term liquidity shocks push stocks away from their factor-implied values and arbitrageurs are paid for providing liquidity (Avellaneda and Lee 2010, citing Khandani and Lo 2007).

### Why it might fail

Returns are crowded and fragile: the paper itself shows much weaker results after 2002 and documents the August 2007 quant fund drawdown when similar books unwound together.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Avellaneda and Lee (June 2009 version), abstract](https://math.nyu.edu/~avellane/AvellanedaLeeStatArb20090616.pdf) | 1997-2007 | US equities, PCA-based | 1.44 | n/a | n/a | n/a | backtest | yes | yes |
| [Avellaneda and Lee (June 2009 version), abstract](https://math.nyu.edu/~avellane/AvellanedaLeeStatArb20090616.pdf) | 2003-2007 | US equities, PCA-based | 0.9 | n/a | n/a | n/a | backtest | yes | yes |
| [Avellaneda and Lee (June 2009 version), abstract](https://math.nyu.edu/~avellane/AvellanedaLeeStatArb20090616.pdf) | 1997-2007 | US equities, sector ETF-based | 1.1 | n/a | n/a | n/a | backtest | yes | yes |
| [Avellaneda and Lee (June 2009 version), abstract](https://math.nyu.edu/~avellane/AvellanedaLeeStatArb20090616.pdf) | 2003-2007 | US equities, ETF-based with volume (trading time) signals | 1.51 | n/a | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Avellaneda and Lee (June 2009 version), abstract:** After 5 bp per trade (10 bp round trip). Much stronger before 2003.
- **Avellaneda and Lee (June 2009 version), abstract:** Average Sharpe ratio of PCA strategies in the later sub-period.
- **Avellaneda and Lee (June 2009 version), abstract:** Similar degradation after 2002.
- **Avellaneda and Lee (June 2009 version), abstract:** Volume adjustment improved ETF signals.

### After publication

Within the paper, Sharpe ratios fell from 1.44 (1997 to 2007) to about 0.9 for 2003 to 2007 for PCA strategies, and the August 2007 unwind hit similar strategies. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/hudson-and-thames/arbitragelab](https://github.com/hudson-and-thames/arbitragelab) (Python, license: BSD-3-Clause): other_approaches/pca_approach.py implements a PCA residual approach in this spirit.
- [https://github.com/Go1vf/Statistical-Arbitrage-Strategy](https://github.com/Go1vf/Statistical-Arbitrage-Strategy) (Python, license: MIT): Applies Avellaneda and Lee to 40 crypto tokens.

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
