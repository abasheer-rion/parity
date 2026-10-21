---
id: ALG-0054
title: Volatility-managed portfolios (volatility targeting)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Volatility-managed portfolios (volatility targeting)

## In plain words

When markets have been shaky, hold less; when they have been calm, hold more.

## Summary

| | |
| --- | --- |
| Family | volatility |
| Markets | equities, fx, multi-asset |
| Horizon | monthly |
| Tags | volatility-targeting, risk-management, overlay, leverage |
| Origin | academic: Moreira, Muir |
| First published | 2016 (10 years ago) |
| Primary source | [Volatility-Managed Portfolios (NBER WP 22208, 2016; Journal of Finance 2017)](https://doi.org/10.1111/jofi.12513) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: A cheap overlay that Moreira and Muir show helps the currency carry trade, so it is a natural add-on for any parity FX strategy. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/volatility-managed-portfolios.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** When markets have been shaky, hold less; when they have been calm, hold more.

<details><summary>Analogy</summary>

Like driving slower in fog and faster on a clear road, so the danger stays about the same.

</details>

<details><summary>Precise</summary>

Scale exposure each month by c divided by last month's realized variance, with c chosen so the managed portfolio has the same unconditional volatility as the original. Because volatility is persistent but does not predict returns proportionally, this raises Sharpe ratios; Moreira and Muir show it for equity factors and the currency carry trade.

</details>

### The rule

At each month end, compute realized variance RV from daily returns of the past month; next month hold weight w = c / RV in the factor or index (cap the weight, for example at 2, in practice); c is set so long-run volatility matches buy and hold.

### Data needed

- Daily returns of the asset or factor
- Monthly returns
- Financing rate for leverage

### Why it might work

Changes in volatility are not offset by proportional changes in expected returns, so cutting risk when volatility is high improves the risk-return trade-off (Moreira and Muir 2017).

### Why it might fail

Cederburg et al. (2020) find that across 103 equity strategies, real-time versions generally do not beat the unmanaged portfolios out of sample, and uncapped weights imply large leverage (up to about 15x in the catalog's test).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Moreira and Muir, NBER WP 22208](https://www.nber.org/system/files/working_papers/w22208/w22208.pdf) | 1926-2015 | US equity market | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1926-07 to 2015-12 | US stocks (CRSP) | 0.51 | 9.5% | 18.6% | -62.3% | backtest | no | no |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 2016-01 to 2026-08 | US stocks (CRSP) | 0.61 | 9.5% | 15.6% | -37.2% | backtest | no | no |

Notes on these numbers:

- **Moreira and Muir, NBER WP 22208:** Volatility-managed market has an annualized alpha of 4.86% and beta of 0.6 versus the market, appraisal ratio 0.33, and about a 25% increase in the buy-and-hold Sharpe ratio. The paper also reports alphas after assumed transaction costs (Table 4, not quoted here).
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Weight = c / previous month realized variance, uncapped, c fitted in sample to match market volatility. Unmanaged market Sharpe 0.42, max drawdown -84.7%. Maximum weight about 15.2.
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the working paper. Unmanaged market over the same span: Sharpe 0.88, max drawdown -25.2%. c fitted within this window.

### After publication

Cederburg, O'Doherty, Wang and Yan (2020, https://doi.org/10.1016/j.jfineco.2020.04.015) find out-of-sample volatility-managed versions generally earn lower Sharpe ratios than the unmanaged portfolios (abstract read via Semantic Scholar). DeMiguel, Martin-Utrera and Uppal (2024, https://doi.org/10.1111/jofi.13395) note Barroso and Detzel find they do not survive costs, but propose a conditional multifactor version that works out of sample net of costs. In the catalog's computation the managed US market underperformed buy and hold from 2016 to 2026 (Sharpe 0.61 vs 0.88).

### Implementations

None found.

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
