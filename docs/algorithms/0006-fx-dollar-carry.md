---
id: ALG-0006
title: Dollar carry trade
type: algorithm
status: hypothesis
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [carry, fx, open-source, strategy]
related: [HYP-0005]
---

# Dollar carry trade

## In plain words

Look at whether US interest rates are higher or lower than the average of other rich countries. If other countries pay more, buy a basket of their currencies against the dollar; if the US pays more, hold the dollar against them.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | fx |
| Horizon | monthly |
| Tags | time-series, risk-premium, usd, business-cycle, basket |
| Origin | academic: Lustig, Roussanov, Verdelhan |
| First published | 2010 (16 years ago) |
| Primary source | [Countercyclical currency risk premia (NBER WP 16427; Journal of Financial Economics 111(3), 2014)](http://web.mit.edu/adrienv/www/LRV_JFE_2014.pdf) |
| Research stage | 3 of 9: hypothesis |
| Relevance to us | 4 of 5: One signal, one basket, monthly, and the source paper benchmarks it directly against the US stock market, which is exactly the parity comparison. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-dollar-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Look at whether US interest rates are higher or lower than the average of other rich countries. If other countries pay more, buy a basket of their currencies against the dollar; if the US pays more, hold the dollar against them.

<details><summary>Analogy</summary>

Like choosing whether to keep your savings at home or abroad by checking just one thing each month: which side pays more interest on average.

</details>

<details><summary>Precise</summary>

The strategy goes long an equal-weighted basket of foreign currency forwards when the average foreign forward discount versus USD is positive and short the basket otherwise. Lustig, Roussanov and Verdelhan (2014) show the average forward discount predicts the dollar basket's excess return, and the premium is countercyclical: investors are long foreign currency mostly in US recessions, when US rates are cut.

</details>

### The rule

At each month end, compute the average 1-month forward discount (foreign minus US short rate) across developed currencies. If it is positive, go long an equal-weighted basket of all foreign currencies versus USD for one month; if negative, go short the basket.

### Data needed

- Developed-market spot rates vs USD, month end
- 1-month forward rates or 1-month interest rates for the US and each foreign country

### Why it might work

Lustig, Roussanov and Verdelhan (2014) argue the returns compensate US investors for shorting the dollar in US recessions and for being long the dollar in bad global times, so the premium is a reward for business-cycle risk rather than a free lunch.

### Why it might fail

The whole portfolio rides on one decision per month, so long stretches of wrong-way dollar moves hurt. When US rates sit above foreign rates for years (as after 2016 and in 2022-2024) the trade is a simple long-dollar bet that depends on dollar strength continuing. Chernov, Dahlquist and Lochstoer (2024) show a lower G10 Sharpe of 0.55 over 1985-2023 than the 0.66 in the original sample.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Lustig, Roussanov, Verdelhan (2014), JFE, Table 1, Panel A (USD strategy)](http://web.mit.edu/adrienv/www/LRV_JFE_2014.pdf) | 1983-11 to 2010-06 | Developed currencies basket vs USD | 0.66 | 5.6% | 8.5% | n/a | backtest | yes | yes |
| [Lustig, Roussanov, Verdelhan (2014), JFE, Table 1, Panel B (USD strategy)](http://web.mit.edu/adrienv/www/LRV_JFE_2014.pdf) | 1983-11 to 2010-06 | All currencies including emerging, basket vs USD | 0.56 | 4.3% | 7.6% | n/a | backtest | yes | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (Dollar Carry, G10, no costs)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies | 0.55 | 4.3% | 8.0% | n/a | backtest | no | yes |

Notes on these numbers:

- **Lustig, Roussanov, Verdelhan (2014), JFE, Table 1, Panel A (USD strategy):** Bid-ask spreads on forwards and spot included. Same table reports the US equity market (CRSP, no costs) at 6.26 percent mean, 15.49 percent volatility, Sharpe 0.40, and the HML carry trade at Sharpe 0.31 for developed currencies.
- **Lustig, Roussanov, Verdelhan (2014), JFE, Table 1, Panel B (USD strategy):** Signal still uses the developed-country average forward discount.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (Dollar Carry, G10, no costs):** Independent replication that extends 13 years past the original sample. With costs at 100 percent of the quoted spread: 3.40 percent mean, Sharpe 0.43.

### After publication

Chernov, Dahlquist and Lochstoer (2024) report G10 dollar carry Sharpe ratios of 0.55 before costs and 0.43 after full quoted costs over 1985-2023, so the strategy held up better than cross-sectional G10 carry in their data, though they do not split the sample at publication. Hutchinson et al. (2022) find the broader set of published currency carry, momentum and value strategies lost their performance after publication (https://doi.org/10.1016/j.irfa.2022.102245).

### Implementations

- [https://web.mit.edu/adrienv/www/Data.html](https://web.mit.edu/adrienv/www/Data.html) (Excel data, license: unspecified): Verdelhan's page offers free monthly dollar carry excess returns (1983-12 to 2010-06) and currency portfolio returns for replication. Not code.
- [https://github.com/romashencia/Internation-Finance-Dollar-Carry-trade](https://github.com/romashencia/Internation-Finance-Dollar-Carry-trade) (Jupyter Notebook, license: none): Student project adapting dollar carry to a RUB base; no license file, not reviewed in depth.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | not yet |
| 5. registered | not yet |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0005](../hypotheses/0005-dollar-carry-beats-pair-carry.md)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
