---
id: ALG-0041
title: EIA weekly crude inventory surprise trading
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, news, strategy]
related: []
---

# EIA weekly crude inventory surprise trading

## In plain words

Every Wednesday the US government says how much oil is in storage. If there is much less than people guessed, oil prices tend to jump up within minutes; if there is much more, they drop.

## Summary

| | |
| --- | --- |
| Family | event-news |
| Markets | commodities, fx, equities |
| Horizon | intraday |
| Tags | macro-announcement, surprise, oil, event-study |
| Origin | academic: Alquist, Ellwanger, Jin |
| First published | 2020 (6 years ago) |
| Primary source | [The Effect of Oil Price Shocks on Asset Markets: Evidence from Oil Inventory News (Bank of Canada SWP 2020-8; Journal of Futures Markets 2020)](https://doi.org/10.1002/fut.22096) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: A clean, scheduled commodity news event that the paper links directly to US dollar moves, which fits parity's commodity and macro news angle. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/eia-oil-inventory-announcement.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Every Wednesday the US government says how much oil is in storage. If there is much less than people guessed, oil prices tend to jump up within minutes; if there is much more, they drop.

<details><summary>Analogy</summary>

Like a shop announcing its stock count: if shelves are emptier than expected, buyers rush and prices rise.

</details>

<details><summary>Precise</summary>

The surprise is the reported change in commercial crude, gasoline and distillate inventories minus the Bloomberg survey median, standardized. Crude futures move against the surprise inside a 15-minute window, and Alquist, Ellwanger and Jin use this as an instrument to show oil shocks move the US dollar and equities. A trading rule must act within seconds to minutes.

</details>

### The rule

At the Wednesday 10:30 ET Weekly Petroleum Status Report, compute surprise = actual crude inventory change minus consensus median; if the standardized surprise is below -1 go long front WTI futures, if above +1 go short; exit after 15 to 30 minutes. A slower variant trades oil-linked currencies (for example USD/CAD) in the same direction as the implied oil move.

### Data needed

- EIA Weekly Petroleum Status Report history (free)
- Consensus forecasts of inventory changes (Bloomberg or similar, paid)
- Intraday WTI futures and FX prices

### Why it might work

Inventory surprises change the perceived supply and demand balance, so prices react (Alquist, Ellwanger and Jin 2020; Miao et al. 2017); higher oil prices from this news depreciate the US dollar against a broad range of currencies.

### Why it might fail

The reaction is nearly instant, prices move in anticipation of the surprise (Miao et al. 2017), and the effect on crude roughly halved after 2008 in Alquist, Ellwanger and Jin's estimates; the edge needs paid consensus data and fast execution.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Alquist, Ellwanger and Jin (2020), Bank of Canada SWP 2020-8, first-stage results](https://www.bankofcanada.ca/wp-content/uploads/2020/03/swp2020-8.pdf) | 2003-10 to 2008-08 | WTI crude futures, 15-minute window around release | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Alquist, Ellwanger and Jin (2020), Bank of Canada SWP 2020-8, first-stage results](https://www.bankofcanada.ca/wp-content/uploads/2020/03/swp2020-8.pdf) | 2008-09 to 2017-10 | WTI crude futures, 15-minute window around release | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Miao, Ramchander, Wang and Yang (2017), Journal of Futures Markets abstract](https://doi.org/10.1002/fut.21850) | not stated in abstract | Crude oil futures and options | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Alquist, Ellwanger and Jin (2020), Bank of Canada SWP 2020-8, first-stage results:** Event study, not a trading backtest. A one standard deviation positive crude inventory surprise lowered crude prices by about 0.57%; gasoline and distillate surprises by about 0.30% and 0.38%.
- **Alquist, Ellwanger and Jin (2020), Bank of Canada SWP 2020-8, first-stage results:** After 2008 the effect of a one standard deviation crude surprise fell to about 0.32%. The inventory news explains about 33% of oil price variation in the announcement window across the full sample.
- **Miao, Ramchander, Wang and Yang (2017), Journal of Futures Markets abstract:** Futures returns fall with positive surprises and rise with negative ones, with no asymmetry; prices move in anticipation. Abstract read via the OpenAlex record; no numbers given there.

### After publication

Alquist, Ellwanger and Jin report the price response to crude inventory news shrank after 2008 (about 0.57% to about 0.32% per standard deviation). No out-of-sample trading results were found.

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
