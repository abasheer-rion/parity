---
id: ALG-0026
title: Crypto perpetual futures funding-rate carry
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [carry, crypto, open-source, strategy]
related: []
---

# Crypto perpetual futures funding-rate carry

## In plain words

You buy a coin and at the same time bet against it with the same amount, so price moves cancel out. People who want to bet on the coin going up pay you a small fee every few hours to keep their bet open.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | crypto |
| Horizon | daily |
| Tags | delta-neutral, funding-rate, perpetual-futures, risk-premium |
| Origin | academic: Schmeling, Schrimpf, Todorov; updated by Borri, Liu, Tsyvinski, Wu |
| First published | 2022 (4 years ago) |
| Primary source | [Cryptocurrency as an Investable Asset Class: Coming of Age (arXiv 2510.14435), building on Crypto carry (BIS WP 996/1087)](https://arxiv.org/abs/2510.14435) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Same carry logic as FX carry with free 8-hourly data, useful as a contrast case showing how a carry premium can be crowded out within a few years. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/crypto-perp-funding-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** You buy a coin and at the same time bet against it with the same amount, so price moves cancel out. People who want to bet on the coin going up pay you a small fee every few hours to keep their bet open.

<details><summary>Analogy</summary>

It is like owning a house and renting it to someone who pays you rent, while an insurance deal protects you if the house price falls.

</details>

<details><summary>Precise</summary>

Hold spot BTC (or ETH) and short an equal notional of the perpetual future. The position is close to delta neutral and earns the funding rate paid by longs to shorts every 8 hours when perpetuals trade above spot. Returns are mostly the funding stream minus fees, with basis mark-to-market noise and exchange counterparty risk.

</details>

### The rule

Each 8-hour funding interval, if the trailing funding rate is positive, hold 1 unit of spot and short 1 unit notional of the same coin's perpetual future; otherwise stay flat (or keep the hedge and accept negative funding, as in the always-on version). Rebalance the hedge when the notional drift exceeds a threshold.

### Data needed

- Perpetual futures funding rates, 8-hourly (Binance, Bybit, OKX public APIs)
- Spot and perpetual prices, hourly or 8-hourly
- Exchange fee schedule
- Stablecoin or USD risk-free rate for excess returns

### Why it might work

Retail demand for margined long exposure in boom periods and scarce arbitrage capital keep perpetuals above spot, so longs pay shorts a convenience yield (Schmeling, Schrimpf and Todorov, BIS). He, Manela, Ross and von Wachter show deviations from no-arbitrage perpetual prices are larger than in FX and shrink over time.

### Why it might fail

Borri et al. (2025) report the carry Sharpe fell from 6.45 over 2020-2025 to 4.06 from 2024 and turned negative in 2025 as capital flowed in (for example delta-neutral stablecoin products). Exchange failure (FTX 2022), exchange-forced position cuts, and negative funding in bear markets are tail risks that a smooth backtest does not show.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Borri, Liu, Tsyvinski, Wu (2025), stylized fact 6](https://arxiv.org/abs/2510.14435) | 2020-08 to 2025-05 | BTC spot vs Binance BTC perpetual | 6.45 | n/a | n/a | n/a | backtest | unclear | yes |
| [He, Manela, Ross, von Wachter, Fundamentals of Perpetual Futures, Table 7 'Carry' column](https://arxiv.org/abs/2212.06888) | 2020-01-08 to 2024-03-11 | BTC, Binance perpetual vs spot, hourly | 2.24 | 10.2% | 4.5% | -5.3% | backtest | no | yes |

Notes on these numbers:

- **Borri, Liu, Tsyvinski, Wu (2025), stylized fact 6:** Read in the arXiv PDF (v4). Sharpe falls to 4.06 from 2024 and turns negative in 2025. The funding leg alone averaged about 8 percent a year with about 0.8 percent volatility. A Sharpe above 3 should be read as a sign of unpriced tail risk (exchange default, liquidation) rather than free money.
- **He, Manela, Ross, von Wachter, Fundamentals of Perpetual Futures, Table 7 'Carry' column:** Read in the arXiv PDF (v7). This is the always-on carry strategy of Christin et al. (2022) used as a comparison; ETH carry Sharpe 2.66, BNB carry Sharpe -0.66 with -33.61 percent drawdown. Table 7 appears to be the zero-fee case. Their threshold arbitrage strategy reports BTC Sharpe 3.35 at retail fees and 11.65 at zero fees, which is not achievable for most traders.

### After publication

Borri et al. (arXiv 2510.14435 v4, 2026) find carry profitability compressed sharply from 2024 and turned negative in 2025, which they link to funding-harvesting products such as Ethena (about $14 billion stablecoin by September 2025). He et al. also report that deviations from no-arbitrage prices diminish over time.

### Implementations

- [https://github.com/hummingbot/hummingbot](https://github.com/hummingbot/hummingbot) (Python, license: Apache-2.0): Includes arbitrage strategy templates; check current docs for a funding-rate example before relying on it.
- [https://github.com/freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) (Python, license: GPL-3.0): Supports futures and funding data download; a carry strategy must be written by the user.

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
