---
id: RES-0019
title: Trading the energy strategies, costs, contracts and data after April 2024
type: research
status: draft
created: 2026-10-23
updated: 2026-10-23
authors: [amanda]
tags: [commodities, method]
related: [RES-0014, RES-0017, HYP-0012, HYP-0013, HYP-0014, HYP-0015, HYP-0016, ALG-0041, ALG-0044, ALG-0094]
---

# Trading the energy strategies, costs, contracts and data after April 2024

## In plain words

We have five energy strategies registered and none run yet. This note asks a practical question: if one passes, could we actually trade it? It covers what each one would hold, what trading would cost compared with what the backtests charge, how big an account it needs, which energy ideas only work faster than our daily data can see, and where prices after April 2024 could come from for a forward test. It reports no strategy results.

## Summary

1. **Our cost assumption is about right for crude oil and thin for natural gas at low prices.** The backtests charge 3 bp per unit traded plus 2 bp per roll. A one-tick spread is 1 cent a barrel on crude oil and 0.1 cent per MMBtu on gas. At $70 crude, crossing half a one-tick spread costs about 0.7 bp; at $3 gas it costs about 1.7 bp, and at $2 gas 2.5 bp. These are our own arithmetic from tick sizes, assuming a one-tick spread; we found no published effective spreads for NYMEX energy in basis points.
2. **The books are too lumpy for standard contracts below several hundred thousand dollars.** One standard contract of each of the four is roughly $300,000 of exposure at recent prices (see the table). Inverse-volatility weights need fractions of a contract. Micro WTI (100 barrels, one tenth of the standard contract) helps for crude only [CME](https://www.cmegroup.com/education/courses/basic-principles-of-micro-wti-crude-oil-futures/micro-wti-crude-oil-futures-overview.html).
3. **Inventory news moves prices for less than a day, so our daily strategies cannot trade it.** Surprises in the weekly EIA crude inventory report move futures on the announcement day, the market starts moving the day before, and there is no persistence beyond the announcement day ([Miao, Ramchander, Wang and Yang, 2018](https://doi.org/10.1002/fut.21850)). ALG-0041 and ALG-0044 need intraday prices, which we do not have.
4. **Our roll dates miss the crowded index roll.** Our indices roll when contract 2 becomes the front contract, near expiry. The S&P GSCI rolls on the 5th to 9th business day of each month ([ALG-0094](../algorithms/0094-commodity-index-roll-front-running.md)), earlier in the month, so our rolls do not trade in that window.
5. **There is no free source of daily energy futures history after 5 April 2024.** The EIA stopped publishing then ([EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm)). CME's free daily settlement files cover the latest day only; history is sold through DataMine ([CME settlements FAQ](https://cmegroupclientsite.atlassian.net/wiki/x/GavEAg)). A forward test therefore needs either a paid history or our own daily archive started now, after checking CME's data terms, which we have not read.
6. **One new energy idea is testable on the data we have: crack spread mean reversion.** We hold crude, heating oil and gasoline, so the refining margin (3:2:1 crack) can be built from the same EIA curves. The evidence is that the spread mean-reverts because the three prices are tied together ([IAEE proceedings](https://www.iaee.org/en/publications/proceedingsabstractpdf.aspx?id=16517)), but we found no out-of-sample backtest net of costs. It is a candidate, not a recommendation.

## What each registered strategy would hold

| Strategy | Registration | Holds | Trades | Hard part in practice |
| --- | --- | --- | --- | --- |
| `energy_tsmom` | REG-0007 | Long or short each of CL, HO, RB, NG on its 12-month trend | Monthly, plus rolls | Four highly correlated contracts: close to one bet on oil |
| `energy_carry` | REG-0007 | Long the backwardated half, short the contango half | Monthly, plus rolls | Natural gas carry swings with the seasons |
| `oil_variance_short` | REG-0008 | Short a 30-day crude variance swap | Monthly | Variance swaps are dealer products; a retail version would be a strip of short options, with large costs our index leaves out |
| `commodity_fx_leads_energy` | REG-0008 | All four long or all short, from commodity currencies | Monthly, plus rolls | Effectively a directional oil bet |
| `energy_book` | REG-0009 | Each contract in proportion to its average score | Monthly, plus rolls | Fractional positions, see below |

All of them hold contract 2, never the expiring month, so none would have held the front WTI contract on 20 April 2020, when it settled below zero.

## Contract sizes and account size

| Contract | Size | Tick | Exposure at an example price |
| --- | --- | --- | --- |
| WTI crude (CL) | 1,000 barrels | $0.01 = $10 | $70,000 at $70 |
| Micro WTI (MCL) | 100 barrels | $0.01 = $1 | $7,000 at $70 |
| NY Harbor ULSD, heating oil (HO) | 42,000 gallons | $0.0001 = $4.20 | $105,000 at $2.50 |
| RBOB gasoline (RB) | 42,000 gallons | $0.0001 = $4.20 | $92,400 at $2.20 |
| Henry Hub natural gas (NG) | 10,000 MMBtu | $0.001 = $10 | $30,000 at $3 |

Example prices are round numbers for scale, not quotes. Margins move with volatility. One broker quoted an initial margin of $11,664 for one standard WTI contract in March 2025 ([Schwab](https://international.schwab.com/story/micro-crude-futures-offer-lower-cost-oil-trading)). With inverse-volatility weights, natural gas (the most volatile) gets the smallest weight but has the smallest contract, so rounding errors are worst for heating oil and gasoline. Below roughly $300,000 of gross exposure, a live book would differ a lot from the backtest. Micro contracts for crude fix only part of this.

## Costs against what the backtests charge

Half a one-tick spread, in basis points of the contract's value:

| Contract | Tick in price | Price | Half a tick |
| --- | --- | --- | --- |
| CL | $0.01 | $70 | 0.7 bp |
| HO | $0.0001 | $2.50 | 0.2 bp |
| RB | $0.0001 | $2.20 | 0.2 bp |
| NG | $0.001 | $3.00 | 1.7 bp |
| NG | $0.001 | $2.00 | 2.5 bp |

Commissions add a fixed amount per contract, which is smaller in basis points for the bigger contracts. The 3 bp we charge covers these in normal markets with room to spare, except for gas at low prices. Spreads widen in fast markets (one study of LIFFE futures, by Bryant and Haigh, found spreads widen in volatile periods; we read only its abstract), so crisis months will cost more than 3 bp. The gauntlet's double-cost test (6 bp) is a fair check.

## Energy ideas our daily data cannot test

- **Weekly inventory reports (ALG-0041, crude, Wednesday; ALG-0044, gas storage, Thursday).** The move happens within the announcement day, and a day before ([Miao et al., 2018](https://doi.org/10.1002/fut.21850)). A strategy that trades at the close after the report is too late.
- **Front-running index rolls (ALG-0094).** Already catalogued as a cautionary example: large reported profits up to 2010 that later work says disappear after costs.

## Data for a forward test

| Option | What it gives | Cost | Problem |
| --- | --- | --- | --- |
| EIA | Contracts 1 to 4, daily, 1983 to 2024-04-05 | Free | Stopped |
| CME daily settlement file | Every contract, latest day only | Free | No history; would need our own daily archive from now; data terms unread |
| CME DataMine history | Every contract, full history | Paid | Price not checked |
| Monthly natural gas settlement tables from energy retailers | One price a month | Free | Monthly only, gas only, and two such tables disagree for January 2024 |

**Recommendation:** start a daily job that saves CME's settlement prices for contracts 1 to 3 of CL, HO, RB and NG, only after someone reads CME's data terms and confirms that this is allowed. A year of archive would allow a first forward check of the registered energy strategies. Until then, every energy result stops on 5 April 2024.

## What this means for us

1. Keep 3 bp for crude and the products. Expect natural gas to cost more than we charge when its price is low.
2. Treat any passing energy result as needing at least $300,000 of exposure to trade as tested, or a micro-contract version, registered separately.
3. Do not build daily-close versions of the inventory report ideas.
4. Consider crack spread mean reversion as a next idea, registered before it is run, on 2005-10 onwards (when gasoline starts).
5. Decide whether to buy CME history or start our own archive (owner decision, after reading CME's terms).

## What we could not verify

- **Effective spreads in basis points** for NYMEX energy futures: no published figures found. The table uses a one-tick assumption.
- **CME's data terms of use**: not read. Whether a daily archive of settlement prices is allowed is open.
- **Margins today**: the figure above is from March 2025 and changes often.
- **Crack spread trading returns**: only model-based or in-sample studies found.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [HYP-0017: The crack spread mean-reverts after costs](../hypotheses/0017-the-crack-spread-mean-reverts-after-costs.md)
<!-- backlinks:end -->
