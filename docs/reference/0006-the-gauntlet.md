---
id: REF-0006
title: The gauntlet
type: reference
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [benchmark, kpis, method]
related: [DEC-0006, EXP-0002, REF-0002]
---

# The gauntlet

## In plain words

The gauntlet is a set of 11 tests that every trading idea goes through. Six ask whether it beats the stock market. Five ask whether it is real at all, or just luck. The rules were set before we saw any results, so we cannot bend them.

## Summary

Every strategy runs through the same eleven tests on every research run. The code is `engine/src/parity/gauntlet.py`; it runs automatically as part of `parity run` and the results show on the dashboard's strategy pages. Thresholds below are fixed. Changing one needs a decision doc first, written before looking at the effect of the change.

Two questions, because their answers often differ:

- **A. Does it beat the S&P 500?** All six must pass. This is the bar from [DEC-0006](../decisions/0006-how-we-define-beating-the-sp-500.md).
- **B. Is there anything real here?** A strategy can fail A and still pass B. That means a real effect that is too small to beat stocks alone, which is still useful (for example as part of [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)).

Since [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md), every Sharpe ratio in these tests is measured on returns above the T-bill.

## A. Does it beat the S&P 500?

| Test | Asks, in plain words | Pass bar | Why it is there |
| --- | --- | --- | --- |
| A1 Better return for the risk | Does it earn more per unit of bumpiness than just holding the S&P 500? | Sharpe ratio above SPY's over the same dates | The basic comparison. |
| A2 More money at the same risk | If we turn it up until it is exactly as bumpy as stocks, and pay for any borrowing, does it make more money? | CAGR above the market's, at the market's own volatility over the same dates ([DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)) | A calm strategy can look good on Sharpe and still be useless if scaling it up breaks it. |
| A3 Not just the best of many tries | We tried several ideas. Is this one good even after allowing for luck? | Deflated Sharpe ratio of 0.95 or more | Stops us picking the luckiest of many. |
| A4 Survives double trading costs | If trading costs twice what we guessed, does it still win? | Sharpe above SPY's at 2x costs | Our cost guess could be wrong. |
| A5 Wins in every era | Does it beat the S&P 500 in 2000 to 2008, 2009 to 2019 and 2020 on, separately? | Sharpe above SPY's in every era | A strategy that only worked in one decade may not work in the next. |
| A6 Wins on the most recent years | Does it beat the S&P 500 over the last five years alone? | Sharpe above SPY's over the last 5 years | Published ideas tend to fade. Recent years matter most. |

## B. Is there anything real here?

| Test | Asks, in plain words | Pass bar | How it works |
| --- | --- | --- | --- |
| B1 Clearly above zero | If history had been shuffled a little, would it still make money? | Whole 95% bootstrap range of Sharpe above zero | Moving block bootstrap: 1,000 resamples made of 21-day chunks of real history, keeping calm and stormy stretches together. |
| B2 Timing matters | Same bets on random dates: does it do much worse? | Beats at least 95% of 500 random-date copies | A placebo. Positions are slid to random dates at least a year away. Size and trading stay the same, timing is destroyed. |
| B3 Not one lucky setting | If we nudge its settings, does it still make money? | At least 75% of nearby settings have a positive Sharpe | Uses each strategy's `param_grid`. Every variant counts as an extra trial. |
| B4 Not one lucky year | If we delete its best year, is it still positive? | Sharpe above zero without its best calendar year | Catches results that come from one event. |
| B5 Does not crash with stocks | In the stock market's worst months, does it lose too? | Zero or positive average return in SPY's worst 5% of months | Tells us whether it could protect a stock portfolio. |

## Verdicts

| Result | Verdict shown |
| --- | --- |
| All A pass, 4 or more B pass | Beats the S&P 500 and the effect looks real. Check it again on new data. |
| All A pass, fewer than 4 B pass | Looks like it beats the S&P 500 but fails the reality checks. Probably luck. |
| Some A fail, 4 or more B pass | A real effect, but too small to beat the S&P 500 on its own. |
| Some A fail, 2 or 3 B pass | Some signs of a real effect, not enough to rely on. |
| Some A fail, 0 or 1 B pass | No evidence of a real effect. Most likely noise. |

## Known weaknesses of the tests themselves

- **The placebo is harsh on slow strategies.** Carry holds similar positions for years, so a copy shifted by a year still often holds the right currencies. That makes B2 hard to pass for carry even if the effect is real.
- **The eras overlap with the holdout.** A6 (last five years) sits inside A5's third era. They are not independent checks.
- **Nothing here is truly out of sample.** We designed the strategies knowing roughly how currency markets behaved since 2000. Only data that arrives after 2026-10-20 is genuinely new.
- **Fixed random seed.** Results are reproducible, but a different seed would move B1 and B2 a little. Borderline passes should be read as borderline.

Definitions of every term are in the [glossary](0004-glossary.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0007: Official results come only from pre-registered runs in a tamper-evident ledger](../decisions/0007-official-results-come-only-from-the-ledger.md)
- [DEC-0009: Score on returns above the T-bill, charge for borrowing, and freeze code with each plan](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)
- [DEC-0025: AI assistants get Parity tools through a local MCP server](../decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)
- [DEC-0028: Parity Academy, short courses with moving pictures](../decisions/0028-parity-academy-short-courses-with-moving-pictures.md)
- [HYP-0008: A slower commodity gap works where the weekly one did not](../hypotheses/0008-monthly-commodity-gap.md)
- [EXP-0002: The baseline gauntlet for carry, trend and the commodity gap](../experiments/0002-baseline-gauntlet.md)
- [EXP-0003: Pre-registered test of the monthly commodity gap](../experiments/0003-monthly-commodity-gap.md)
- [EXP-0004: Sixteen strategies against the US stock market, 1999 to 2026](../experiments/0004-all-strategies-1999.md)
- [GDE-0004: The research routine](../guides/0004-the-research-routine.md)
- [REF-0001: Architecture](0001-architecture.md)
- [REF-0007: Ways to build new algorithms, and ways to fool yourself](0007-ways-to-build-new-algorithms.md)
- [REF-0012: Candlesticks and chart patterns](0012-candlesticks-and-chart-patterns.md)
- [REF-0016: Parity Verify MVP spec](0016-parity-verify-mvp-spec.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
