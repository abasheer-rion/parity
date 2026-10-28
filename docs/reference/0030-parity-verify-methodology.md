---
id: REF-0030
title: Parity Verify methodology
type: reference
status: current
created: 2026-10-27
updated: 2026-10-27
authors: [ayan]
tags: [method]
related: [REF-0016, DEC-0036, DEC-0081]
---

# Parity Verify methodology

## In plain words

This is the repository copy of the public page at `/methodology/`, which says how Verify judges a trading record: the order of the five verdicts, every check and its threshold, the luck check, trust levels and what is stored. The public page fills in the method version, its changelog and the main thresholds from the code at build time (`web/plugins/legal.ts`), so it cannot drift; this copy is kept by hand and must change with it. The method version today is `verify-1.0`. Research only. Not investment advice.

## Summary

| Part | Rule |
| --- | --- |
| Verdict order | Not enough data, does not hold up, fragile, could be luck, holds up |
| Luck check | Deflated Sharpe ratio at the stated tries, pass at 0.95, "survives up to N tries" |
| Red flags | More than 20 average wins lost to one loss, martingale or grid, fall over 50% |
| Trust | Self-reported for every upload |
| Stored | Nothing unless a badge is published or the dataset box is ticked |

## Inputs

- **A file**: a trade list or equity curve, CSV or tab separated, up to 5 MB and 50,000 rows, read and checked in the browser and never sent. Before the checks run the person states real money, demo or backtest (default backtest), the starting balance, the number of things tried before this one (default 1) and, optionally, what was claimed.
- **A description of a bot**: a rule-based reader pulls out the claims. Only the claim arithmetic and the settings count can be checked.
- **One of our strategies**: its research equity curve, at the number of tries our research and search have counted.

## From a record to returns

- Trades plus a starting balance become daily returns: every weekday from the first close to the last (weekend days only when a trade closed on them), quiet days as zero, each day's profit divided by the account value the evening before.
- An equity curve: (value minus money paid in) divided by the previous value, minus 1. A return column is used as it is.
- Trades without a balance have no returns: the luck check uses each trade's profit and the largest fall is not measured.
- Daily means at least 180 values a year, weekly 40, monthly 10.

## The verdict

Checked in this order; the first that applies wins.

| Order | Verdict | When |
| --- | --- | --- |
| 1 | Not enough data | Fewer than 30 trades and fewer than 60 daily returns |
| 2 | Does not hold up | A claim the file contradicts by more than 5 percentage points, or expectancy at or below zero after fees |
| 3 | Fragile | Worst loss wipes out more than 20 average wins, a martingale or grid pattern, or a fall of more than 50% from a high |
| 4 | Could be luck | Luck check below 0.95 at the stated tries or not measurable, or any failed check on card 4 or 5 |
| 5 | Holds up | None of the above |

The sentence under the verdict is built from the numbers that decided it. A description is judged on its own: "Does not hold up" when a claim fails on arithmetic, "Fragile" when the loss is not capped or there are too many settings, otherwise "Not enough data".

## Card 1: win rate against expectancy

One result is a trade's profit after fees, or one period's return. Win rate is the share above zero; payoff ratio is average win over average loss; expectancy is win rate times average win minus loss rate times average loss; break-even win rate is average loss over (average win plus average loss), that is 1 / (1 + payoff); profit factor is gross profit over gross loss.

## Card 2: tail risk

Worst trade (in money and as a share of the account before it), worst day, wins wiped out (worst loss over average win), largest fall from a high and longest time under water in calendar days, expected shortfall (mean of the worst 5% of period returns, at least one), and skew of daily returns or trade profits.

Martingale or grid needs sizes on at least 90% of trades and at least 8 sized trades. A losing streak that the record continues after "grew" when every trade after a loss in it is larger than the one before (by more than 0.01%). Found when at least 3 such streaks exist and size grew in at least 3 out of 4, or at least 3 times a same-side position on the same symbol opened at a worse price while an earlier one was open.

Red flag: more than 20 average wins wiped out, a martingale pattern, or a fall over 50%.

## Card 3: the luck check

The deflated Sharpe ratio [@bailey2014a], a line for line port of the engine's function, tested against it to 3 decimal places:

DSR = Φ((SR − SR0) √(T − 1) / √(1 − skew · SR + (kurt − 1)/4 · SR²)), with SR0 = √V ((1 − γ) Φ⁻¹(1 − 1/N) + γ Φ⁻¹(1 − 1/(N e))), SR0 = 0 for one try, and V = (1 + SR²/2)/(T − 1).

- SR is per observation, not annualised; T is at least 30; kurtosis is 3 for a normal distribution; γ = 0.5772; N is the number of tries.
- V is the single-estimate stand-in, because the spread of Sharpe across an uploader's tries is unknown.
- The line is 0.95, as in test A3 of the gauntlet ([REF-0006](0006-the-gauntlet.md)).
- "Survives up to N tries" is the largest whole number of tries still at 0.95 or more, searched up to 1,000,000,000.
- Minimum track record length [@bailey2012]: T* = 1 + ((z D + √(1 + SR²/2) K) / SR)², z = Φ⁻¹(0.95), D the denominator above and K the bracket in SR0, shown as months still needed. Never reached when SR is zero or below.
- Observations are period returns when there are at least 30, otherwise trade profits.

## Card 4: look-ahead and data flags

Each check is passed, failed or "cannot be checked from this input", never hidden.

| Check | Fails when |
| --- | --- |
| Fills outside the day's range | With the day's high and low: a fill more than 0.1% outside them |
| Fills far from the day's price | With one price a day: further from it than 3 times that market's 1-in-100 daily move, at least 1% |
| Perfect timing | With highs and lows and at least 10 dated entries: more than 30% within 0.05% of the day's best price |
| Too smooth | At least 30 returns: lag-one autocorrelation above 0.3, or (daily) no losing month in more than 24 months with under 3% losing days [@getmansky2004] |
| Edited history | At least 10 trades: median gap at most 3 days but gaps over 30 days; for TradingView and plain lists also skipped trade numbers when 90% of steps are 1 |
| Backtest labelled as real | Said real money, file is a TradingView Strategy Tester export |
| Strategy look-ahead test | Our strategies only |

We hold one price a day for major currency pairs, Bitcoin, Ether and the S&P 500, so for these the fill check is "far from the day's price" and perfect timing cannot be checked ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)). Without the price file, both say they cannot be checked.

## Card 5: overfitting flags

Short sample: fewer than 100 trades or less than 12 months. First part against last part: last 30% Sharpe below half of the first 70%'s, when that is positive (at least 30 results). Concentration: best 5 trades over 50% of profit (at least 10 trades). Many settings, few trades: descriptions only, more than one setting per 20 trades. Claim against file: more than 5 points apart on win rate, monthly return or largest fall.

## Claim arithmetic

1. Break-even average loss = take-profit × win rate / (1 − win rate); a wider stop loses before costs.
2. A largest fall smaller than a single loss is impossible.
3. Over 10% a month for more than 12 months is shown compounded to a year, next to about 10% for the S&P 500.
4. Grid or martingale with no stated maximum loss: "loss is not capped".
5. Win rate above 90% with no average loss or stop: "the win rate alone says nothing about profit".

## Imports

Fills are paired first in, first out per symbol into round trips. Each closing fill is one trade, so a partial close is its own trade. Profit is the price difference times quantity and contract size minus the fees of both sides, opening fees shared by quantity. Personal columns, and order ids that identify an account, are removed first. The supported exports and the layouts not yet confirmed against an official export are listed on `/verify/` ([DEC-0081](../decisions/0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md)).

## Trust levels and storage

Every upload is "Self-reported: Parity checked the numbers in the file, not where the file came from." "Broker-connected" needs read-only connections and is not available. The file, its trades and personal columns are never stored. A published badge stores summary numbers, the method version and the file's SHA-256; the dataset opt-in stores no user id and month-rounded dates.

## Method versions

| Version | From | What changed |
| --- | --- | --- |
| verify-1.0 | 2026-10-24 | First version |

## Cite this

Parity Trading, Inc. (2026). Parity Verify methodology, version verify-1.0. paritytrading.app/methodology/

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@bailey2012](../REFERENCES.md#bailey2012): Bailey and López de Prado (2012), The Sharpe ratio efficient frontier
- [@getmansky2004](../REFERENCES.md#getmansky2004): Getmansky et al. (2004), An econometric model of serial correlation and illiquidity in hedge fund returns

## Referenced by

- [DEC-0081: Verify is a public page with broker imports, embeds and a citable method](../decisions/0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md)
<!-- backlinks:end -->
