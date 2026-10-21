---
id: ALG-0022
title: Crypto cash-and-carry basis trade (dated futures)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [carry, crypto, open-source, strategy]
related: []
---

# Crypto cash-and-carry basis trade (dated futures)

## In plain words

A bitcoin promised for next quarter often costs more than a bitcoin today. You buy one today, sell the promise, and keep the price gap when the date arrives.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | crypto |
| Horizon | monthly |
| Tags | basis, futures, delta-neutral, convenience-yield |
| Origin | academic: Schmeling, Schrimpf, Todorov |
| First published | 2022 (4 years ago) |
| Primary source | [Crypto carry (BIS Working Paper 1087; forthcoming Management Science)](https://www.bis.org/publ/work1087.htm) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Mirrors covered interest parity and FX forward points, but returns now sit near the cash rate so it is unlikely to beat the S&P 500. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/crypto-cash-and-carry-basis.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** A bitcoin promised for next quarter often costs more than a bitcoin today. You buy one today, sell the promise, and keep the price gap when the date arrives.

<details><summary>Analogy</summary>

Like buying concert tickets at face value and selling them in advance to a fan who will pay extra to lock in a seat.

</details>

<details><summary>Precise</summary>

Long spot (or a spot ETF) and short a dated future of the same maturity; hold to expiry so the basis converges. The annualized basis is (F/S - 1) x 365/days to expiry. Profit is the locked-in basis minus funding cost of the spot leg, fees and margin costs.

</details>

### The rule

At each quarterly roll, compute the annualized basis on the next CME or exchange-listed quarterly future; if it exceeds the cash rate plus a cost hurdle (for example 3 percentage points), buy spot and short the future in equal notional and hold to expiry, otherwise hold cash.

### Data needed

- Quarterly futures prices (CME, Deribit, Binance, OKX)
- Spot or ETF prices
- T-bill or stablecoin lending rate
- Margin and fee schedule

### Why it might work

BIS working paper 1087 finds crypto carry averages above 10 percent a year and reaches up to 60 percent, driven by a volatile convenience yield from trend-chasing small investors and scarce arbitrage capital.

### Why it might fail

The same paper finds high carry predicts crashes. After US spot ETFs launched, CoinDesk (10 Aug 2026) reported the three-month CME basis near 3 percent, below the roughly 3.8 percent two-year Treasury yield, and hedge funds flipping net long, meaning the trade no longer paid for its capital.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Schmeling, Schrimpf, Todorov, BIS WP 1087 abstract page](https://www.bis.org/publ/work1087.htm) | not stated on the abstract page | BTC and ETH futures across crypto and traditional exchanges | n/a | n/a | n/a | n/a | backtest | unclear | yes |
| [CoinDesk, A rare CME shift: hedge funds abandon structural shorts](https://www.coindesk.com/markets/2026/08/10/a-rare-cme-shift-hedge-funds-abandon-structural-shorts-to-bet-on-a-bitcoin-rally) | August 2026 | CME bitcoin futures, three-month basis | n/a | 3.0% | n/a | n/a | live | no | yes |

Notes on these numbers:

- **Schmeling, Schrimpf, Todorov, BIS WP 1087 abstract page:** The page says average carry exceeds 10 percent per year and can reach 60 percent per year. These are basis levels, not strategy returns. The full PDF could not be fetched (bot block), so no strategy Sharpe is recorded here.
- **CoinDesk, A rare CME shift: hedge funds abandon structural shorts:** Annual_return here is the quoted annualized gross basis (about 3 percent), not a realized track record. It compares with about 3.8 percent on two-year Treasuries.

### After publication

After spot ETF approval the basis trade became a crowded institutional trade; by August 2026 the CME three-month basis was about 3 percent, below Treasury yields, and hedge funds on CME turned net long (CoinDesk, 10 Aug 2026).

### Implementations

- [https://github.com/hummingbot/hummingbot](https://github.com/hummingbot/hummingbot) (Python, license: Apache-2.0): Spot-perpetual and cross-exchange arbitrage connectors can be adapted; dated futures need user code.

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
