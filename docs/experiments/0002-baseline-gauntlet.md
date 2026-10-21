---
id: EXP-0002
title: The baseline gauntlet for carry, trend and the commodity gap
type: experiment
status: done
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [benchmark, carry, commodities, method, momentum]
related: [DEC-0006, EXP-0001, HYP-0001, HYP-0002, HYP-0003, REF-0006]
---

# The baseline gauntlet for carry, trend and the commodity gap

## In plain words

We put our three trading ideas through eleven tough tests. None of them beats the stock market, not even close. The interest rate idea (carry) seems to be a small real effect: it makes a little money fairly reliably, but much less than stocks, and it loses money when stocks crash. The trend idea is weaker and mostly worked before 2009. The oil idea, the one we were most excited about, shows no reliable effect in its current form, although one clue suggests trading it more slowly might help. We are writing that clue down as a new idea to test properly, not as a result.

## Abstract

We test three systematic currency strategies on G10 currencies against a buy-and-hold S&P 500 benchmark (SPY with dividends) from January 2000 to October 2026: interest rate carry, 12-month time-series momentum, and a new "commodity gap" signal that bets on the Canadian dollar and Norwegian krone catching up with oil. Each faces a pre-registered battery of eleven tests ([REF-0006](../reference/0006-the-gauntlet.md)): six on whether it beats the benchmark and five on whether its returns are distinguishable from luck. No strategy passes any of the six benchmark tests. Carry passes three of five reality tests (bootstrap Sharpe interval above zero, robust to parameter changes, robust to removing its best year) with a Sharpe of 0.39 against 0.50 for SPY, and fails the placebo test narrowly (p = 0.064). Momentum's returns come almost entirely from 2000 to 2008. The commodity gap has a bootstrap Sharpe interval spanning zero (minus 0.30 to 0.39) and is beaten by a third of random-date placebos. A parameter sweep suggests monthly rebalancing improves it, consistent with its information coefficient peaking at 63 days, but this was found after looking and is recorded as a new hypothesis rather than a finding.

## Question

Before tuning anything, do any of the three starting strategies beat the S&P 500 under strict tests, and if not, is there any real effect worth building on?

## Setup

**Data.** Daily G10 exchange rates against the US dollar (Federal Reserve H.10 via FRED), monthly 3-month interbank rates (OECD via FRED), daily WTI and Brent crude (EIA via FRED), and SPY adjusted for dividends (Yahoo). Fetched 2026-10-20. Details and known gaps in [REF-0003](../reference/0003-data-sources.md).

**Strategies.** Default settings, unchanged since they were first written:

| Strategy | Rule in one line | Hypothesis |
| --- | --- | --- |
| `fx_carry` | Long the 3 highest-rate currencies, short the 3 lowest, monthly | [HYP-0001](../hypotheses/0001-carry-still-pays-after-costs.md) |
| `fx_tsmom` | Long currencies up over 12 months, short those down, equal risk each, monthly | [HYP-0002](../hypotheses/0002-currency-trends-persist.md) |
| `fx_commodity_gap` | Buy CAD or NOK when they lag oil over 20 days, weekly | [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md) |

**Backtest rules.** Positions decided at one day's close are held from the next day. Costs of 1 basis point per unit traded. Interest carry credited daily. No leverage except in test A2, which scales to 15% volatility using only past data.

**Tests.** The eleven gauntlet tests in [REF-0006](../reference/0006-the-gauntlet.md), with thresholds fixed before this run. Random seed 20261020, 1,000 bootstrap resamples in 21-day blocks, 500 placebo shifts.

**Trials counted.** 3 strategies for the deflated Sharpe ratio. On top of that, the gauntlet runs each strategy 9 more times (6 nearby settings, plus the 15% volatility and double-cost versions and the base run), so each strategy has 12 trials behind it. Any future claim about these strategies must count all of them.

**Reproduce.**

```bash
git checkout v0.2.0
make setup && make fetch && make run
```

## Results

### A. Does anything beat the S&P 500?

No. Every strategy fails every test. SPY's numbers differ for the commodity gap because it starts in March 2001 and SPY is measured over the same dates.

| Test | fx_carry | fx_tsmom | fx_commodity_gap |
| --- | --- | --- | --- |
| A1 Sharpe vs SPY | 0.39 vs 0.50, fail | 0.17 vs 0.50, fail | 0.06 vs 0.57, fail |
| A2 CAGR at 15% volatility vs SPY | 4.9% vs 8.0%, fail | 2.9% vs 8.0%, fail | minus 1.4% vs 9.3%, fail |
| A3 Deflated Sharpe | 0.88, fail | 0.52, fail | 0.29, fail |
| A4 Sharpe at 2x costs vs SPY | 0.39 vs 0.50, fail | 0.16 vs 0.50, fail | 0.03 vs 0.57, fail |
| A5 Every era | fail (wins only 2000 to 2008) | fail (wins only 2000 to 2008) | fail (wins no era) |
| A6 Last 5 years | 0.62 vs 0.78, fail | minus 0.01 vs 0.78, fail | minus 0.25 vs 0.78, fail |

Sharpe by era, strategy against SPY:

| Era | fx_carry | fx_tsmom | fx_commodity_gap | SPY |
| --- | --- | --- | --- | --- |
| 2000 to 2008 | 0.34 | 0.67 | 0.00 | minus 0.06 (0.05 from 2001-03) |
| 2009 to 2019 | 0.41 | minus 0.26 | 0.15 | 0.91 |
| 2020 on | 0.45 | 0.07 | minus 0.02 | 0.80 |

### B. Is anything real?

| Test | fx_carry | fx_tsmom | fx_commodity_gap |
| --- | --- | --- | --- |
| B1 Bootstrap 95% range of Sharpe | 0.00 to 0.75, pass (barely) | minus 0.16 to 0.55, fail | minus 0.30 to 0.39, fail |
| B2 Placebo, share of random copies that do as well | 6.4%, fail (bar is under 5%) | 7.8%, fail | 33.4%, fail |
| B3 Nearby settings with positive Sharpe | 6 of 6 (0.25 to 0.40), pass | 6 of 6 (0.02 to 0.21), pass | 6 of 6 (0.03 to 0.28), pass |
| B4 Sharpe without best year | 0.33 without 2009, pass | 0.07 without 2003, pass | minus 0.01 without 2013, fail |
| B5 Average in SPY's worst 5% of months | minus 1.2%, fail | plus 1.3%, pass | minus 0.3%, fail |
| Passed | 3 of 5 | 3 of 5 | 1 of 5 |
| Probability of beating SPY's Sharpe (bootstrap) | 24% | 11% | 1% |

### Carry

> **In plain words:** borrowing where interest is cheap and saving where it is high has made a small, steady profit since 2000. It never came close to the stock market, and it tends to lose money exactly when stocks crash, so it would not protect a stock portfolio.

Carry is the only strategy whose bootstrap Sharpe interval stays above zero, and it does so by a hair. Its result barely changes with the number of currencies held or how often it rebalances. It is consistent across eras (0.34, 0.41, 0.45), which is unusual and worth noting. Its weakness is the one the literature warns about: it loses in stock market crashes (minus 1.2% on average in SPY's worst months), so it adds risk to a stock portfolio rather than reducing it.

### Trend

> **In plain words:** "keep betting on what has been going up" worked well for currencies before 2009 and has barely worked since. Its one good feature is that it tends to make money when stocks crash.

Momentum's Sharpe of 0.67 in 2000 to 2008 drops to minus 0.26 in 2009 to 2019. That matches the decay reported by Hutchinson et al. (2022) and Rob Carver's observation that trend returns roughly halved after 2010 ([RES-0002](../research/0002-open-source-and-public-results.md)). It gains 1.3% on average in SPY's worst months, the only strategy here that does. That makes it the better candidate for [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md) despite the weaker Sharpe.

### Commodity gap

> **In plain words:** as built, our oil idea did not work. Its results look like what you would get by chance. There is one clue: a slower version did better, which matches another measurement we took. But we found that by looking, so we have to test it as a new idea rather than claim it.

The commodity gap fails four of five reality tests, and a third of the random-date placebos do as well as it does. The parameter sweep shows a pattern: every monthly version beats its weekly twin (0.20 vs 0.12, 0.26 vs 0.06, 0.28 vs 0.03). Together with its information coefficient rising to 0.125 at 63 days ([EXP-0001](0001-baseline-backtests.md#results)), this suggests the signal, if real, works over months, not weeks. That was found after looking at results and is exactly the kind of discovery that overfits. We record it as a new hypothesis to test on its own terms, with this sweep counted in its trials.

## Threats to validity

What could make these results wrong, roughly from most to least worrying.

1. **Nothing here is truly out of sample.** We designed the strategies already knowing, broadly, how currencies behaved since 2000. Only data after 2026-10-20 is genuinely new.
2. **Stale interest rates.** Euro area and UK rates stop in January 2026 and monthly rates are forward filled. Carry for EUR and GBP is slightly wrong for 2026, and all carry uses month-old rates.
3. **Interbank rates are not the rates a trader earns.** Real carry comes from forward points or broker swap rates, which include a markup. Our carry is likely a little too generous.
4. **Costs are a guess.** 1 basis point per unit traded suits institutions on major pairs. Retail costs are higher. Doubling costs did not change any verdict, but tripling or adding financing spreads would hurt carry and the commodity gap most.
5. **Noon New York fixing.** H.10 rates are a single daily snapshot. Commodity prices settle at different times of day, so the commodity gap compares prices taken hours apart. This could hide or invent a lead-lag effect.
6. **The benchmark is generous to SPY in one way and harsh in another.** SPY pays no trading costs and includes dividends (fair). It is also the best-performing major stock market of the period (hard to beat by construction).
7. **The placebo is harsh on carry.** Carry holds similar positions for years, so random shifts often still hold the right currencies. Carry's narrow placebo failure (6.4% against a 5% bar) may say more about the test than the strategy.
8. **The two-instrument IC.** The commodity gap's information coefficient pools two currencies by year and uses overlapping returns, so it is weak evidence.
9. **One random seed.** Bootstrap and placebo numbers would move slightly with a different seed. Carry's B1 pass (lower bound 0.00) is borderline and should be read that way.

## What we learned

1. **None of the three textbook strategies beats the S&P 500**, by any of six measures, in any era. This agrees with every source we read ([RES-0001](../research/0001-reading-list.md#summary)).
2. **Carry looks like a small, real risk premium**: consistent across eras and settings, but it crashes with stocks. That fits the theory that carry pays you for taking crash risk ([RES-0004](../research/0004-exchange-rate-theory-primer.md#interest-rate-parity-and-carry)).
3. **Trend has decayed** since 2009, as published work predicted, but is the only strategy that helped in stock market crashes.
4. **The commodity gap does not work as built.** If it works at all, it is slower than we assumed.
5. **The gauntlet does its job.** Without it we might have reported carry's 0.39 Sharpe or the commodity gap's monthly variants as promising.

## Next

- Write a new hypothesis for a monthly commodity gap and test it with the sweep counted as trials, and with the pre-2020 and post-2020 split from [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md#how-we-test-it).
- Test SPY plus trend at equal risk ([HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)), since trend is the only strategy that gained in crashes.
- Check our carry series against the free Lustig, Roussanov and Verdelhan currency portfolios before trusting any carry number ([RES-0002](../research/0002-open-source-and-public-results.md#public-strategies-with-reported-results)).
- Replace interbank rates with forward-implied carry if a free source exists.
- Add the probability of backtest overfitting to the gauntlet once we have more strategies.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [HYP-0001: Currency carry still pays after costs](../hypotheses/0001-carry-still-pays-after-costs.md)
- [HYP-0002: Currency trends persist over months](../hypotheses/0002-currency-trends-persist.md)
- [HYP-0003: Commodity currencies catch up to their commodity](../hypotheses/0003-commodity-currencies-catch-up.md)
- [HYP-0008: A slower commodity gap works where the weekly one did not](../hypotheses/0008-monthly-commodity-gap.md)
- [EXP-0001: Baseline backtests of carry, trend and the commodity gap](0001-baseline-backtests.md)
- [REF-0006: The gauntlet](../reference/0006-the-gauntlet.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
<!-- backlinks:end -->
