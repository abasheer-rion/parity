---
id: ALG-0053
title: Value factor (Fama-French HML)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [open-source, strategy]
related: []
---

# Value factor (Fama-French HML)

## In plain words

Buy companies that look cheap compared with what their accounts say they own, and sell ones that look expensive.

## Summary

| | |
| --- | --- |
| Family | value-mean-reversion |
| Markets | equities |
| Horizon | monthly |
| Tags | factor, book-to-market, long-short, anomaly |
| Origin | academic: Fama, French |
| First published | 1992 (34 years ago) |
| Primary source | [The Cross-Section of Expected Stock Returns](https://doi.org/10.1111/j.1540-6261.1992.tb04398.x) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: An equity factor; useful mainly as a decay benchmark and because currency value (PPP) is its FX cousin. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/value-hml.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Buy companies that look cheap compared with what their accounts say they own, and sell ones that look expensive.

<details><summary>Analogy</summary>

Like shopping the clearance rack: unloved items are cheap, and on average some of that discount comes back.

</details>

<details><summary>Precise</summary>

HML is long high book-to-market stocks and short low book-to-market stocks, built from six size and value portfolios. Fama and French (1992) find size and book-to-market capture the cross-section of average returns while market beta does not. Whether the premium is risk or mispricing is debated.

</details>

### The rule

Each June, sort stocks into two size groups and three book-to-market groups (30/40/30 NYSE breakpoints); HML = average of the two high B/M portfolios minus the average of the two low B/M portfolios, value-weighted, held July to June.

### Data needed

- Monthly stock returns
- Book equity and market equity
- Or the free HML series from the Kenneth French library

### Why it might work

Fama and French interpret it as compensation for distress risk; behavioral accounts say investors overextrapolate past growth (Fama and French 1992, 1993).

### Why it might fail

Value had a long drought: French HML averaged about -1.3% a year from 2007 to mid 2026, with a -58% drawdown, and intangible assets make book value a weaker measure.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from Kenneth French data library, HML](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 1926-07 to 2026-08 | US stocks | 0.34 | 4.2% | 12.3% | -57.8% | backtest | no | no |
| [Our calculation from Kenneth French data library, HML](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 1963-07 to 1990-12 | US stocks | 0.58 | 5.1% | 8.9% | -28.0% | backtest | no | no |
| [Our calculation from Kenneth French data library, HML](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 1992-07 to 2026-08 | US stocks | 0.18 | 2.1% | 11.3% | -57.8% | backtest | no | no |
| [Our calculation from Kenneth French data library, HML](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 2007-01 to 2026-08 | US stocks | -0.11 | -1.3% | 11.5% | -57.8% | backtest | no | no |

Notes on these numbers:

- **Our calculation from Kenneth French data library, HML:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Long-short factor, gross of costs.
- **Our calculation from Kenneth French data library, HML:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Close to the Fama and French (1992) sample window.
- **Our calculation from Kenneth French data library, HML:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After publication.
- **Our calculation from Kenneth French data library, HML:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. The value drought.

### After publication

In the catalog's computation from French data, HML's Sharpe ratio fell from about 0.58 (1963 to 1990) to about 0.18 after mid 1992, and it was negative from 2007 to 2026. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/pydata/pandas-datareader](https://github.com/pydata/pandas-datareader) (Python, license: NOASSERTION (per GitHub API)): Has a Fama-French data reader for downloading HML and other factors.

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
