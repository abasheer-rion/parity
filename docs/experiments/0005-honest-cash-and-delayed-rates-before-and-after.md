---
id: EXP-0005
title: Honest cash and delayed rates, before and after
type: experiment
status: done
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, strategy]
related: [DEC-0014, DEC-0027, DEC-0009, REF-0003]
---

# Honest cash and delayed rates, before and after

## In plain words

We fixed three ways the backtests were a little too kind, then ran every strategy again.

- **Cash now earns the T-bill**, the same rate every strategy is scored against. Before, older strategies' cash earned a slightly higher bank rate, a free 0.26% a year.
- **Monthly interest rates are used only once they are published**, a week after the month ends. Before, a strategy could see a month's average rate on the first day of that month.
- **"Commodity trend" now trades Brent and WTI oil only.** It used to hold spot natural gas, which can jump 85% in a day and cannot be traded.

Only one strategy moved by more than 0.05 Sharpe. **"Rising rates" fell from 0.26 to -0.03.** Its whole edge came from seeing interest rates before they were published. Everything else moved by 0.04 or less.

**Official results are unaffected.** Each official run pins the exact code version it ran with ([DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)), and nothing in `ledger/` or `registrations/` was changed. These are exploratory numbers.

## Question

How much did the three known flaws flatter the exploratory results? The owner approved fixing them even though they change existing numbers.

## Setup

- Full gauntlet, `parity run`, on the same data snapshot, 1999-01-04 to 2026-10-22, 1 basis point costs, 118 strategies and the benchmark.
- **Before:** `main` at `d960185`. **After:** this change.
- **Cash.** `cash.USD` earns the 3-month T-bill. The US interbank rate fills in only on days the T-bill is missing. The risk-free rate uses exactly the same series, so a day in cash scores zero excess return for every strategy, old or new. The per-strategy choice of cash rate is gone.
- **Rate delay.** The ten OECD 3-month interbank rates (`rate.<CCY>`) are monthly averages dated the 1st. They now reach signals 5 business days after the month ends, the same rule as copper. A test checks that a rate change dated 1 June does not move the currency carry signal before July.
- **Carry accrual keeps the realised rate.** A currency position held in March earns March's interest gap, because forward prices move with rates as they happen. The monthly average is only a summary published later. So the money a position earns uses the undelayed rate, while every signal sees the delayed one. The data store keeps the undelayed copy beside the delayed column for this purpose only. Using the delayed rate for accrual would book last month's gap, which is less correct, not more honest.
- **Commodity trend.** Instruments changed from Brent and Henry Hub spot gas to Brent and WTI. Name and settings kept. WTI's negative close in April 2020 earns nothing that day, and the trend signal skips it.

## Results

Every strategy whose Sharpe moved by more than 0.05:

| Strategy | Sharpe before | Sharpe after | CAGR before | CAGR after | Worst fall before | Worst fall after | Gauntlet before | Gauntlet after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rising rates | 0.26 | -0.03 | 2.9% | 1.9% | -13.2% | -13.4% | 3/11 | 0/11 |

The next largest moves, and the strategy whose holdings changed, for context:

| Strategy | Sharpe before | Sharpe after | CAGR before | CAGR after | Worst fall before | Worst fall after | Gauntlet before | Gauntlet after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stock RSI(2) dip buying | 0.55 | 0.51 | 5.4% | 5.2% | -15.7% | -15.7% | 9/11 | 8/11 |
| Currency carry, two pairs | 0.41 | 0.37 | 4.0% | 3.9% | -18.5% | -19.2% | 5/11 | 3/11 |
| Stock turn of the month | 0.35 | 0.33 | 4.6% | 4.4% | -17.2% | -17.3% | 3/11 | 3/11 |
| Currency carry | 0.41 | 0.40 | 3.6% | 3.6% | -14.5% | -15.4% | 5/11 | 4/11 |
| Currency carry, calm markets only | 0.48 | 0.49 | 3.5% | 3.5% | -11.4% | -11.3% | 8/11 | 7/11 |
| Commodity trend | -0.12 | -0.11 | -13.6% | -8.8% | -99.3% | -98.0% | 1/11 | 1/11 |

- No strategy beat the S&P 500 before or after.
- Stock timing strategies that sit in cash lost 0.01 to 0.04 Sharpe from the cash fix.
- The best gauntlet score is now "Brent against WTI" at 9 of 11. "Stock RSI(2) dip buying" dropped from 9 to 8.

## Threats to validity

- **5 business days is a judgement.** The inputs are market rates seen daily, so the average is known at month end by anyone who tracks them. The OECD release itself comes later. A longer delay would hurt rate-change signals a little more.
- **Policy rates (`policy.<CCY>`) were not touched.** They are daily BIS series, but central banks announce changes on known dates, so they are a smaller risk.
- **The search database and the Edge Lab** were filled with the old rules. Their rows are exploratory and will drift as the search keeps running.

## What we learned

- **"Rising rates" was a timing artifact.** Seeing a month's average rate on the 1st meant seeing a central bank move up to a month early.
- **Currency carry was not.** It slipped only from 0.41 to 0.40. [DEC-0027](../decisions/0027-new-edge-families-from-the-wider-data.md) wondered whether the gap between interbank carry (0.41) and policy rate carry (0.34) was a timing advantage. Almost none of it was.
- **Gas was not why Commodity trend lost 99%.** With oil only it still falls 98%. The damage is spot oil itself: spot Brent moved 47% and 51% on two days in April 2020 while the monthly trend rule was short, and the 2026 oil spike caught it again. Spot oil is not tradable in those weeks either. Futures data would be the real fix.

## Next

- Register an official rerun so the ledger carries these rules.
- Replace spot oil and gas with futures prices when we have a free source.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0014: A strategy factory and an always-on search](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)
- [DEC-0027: New edge families from the wider data](../decisions/0027-new-edge-families-from-the-wider-data.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
<!-- backlinks:end -->
