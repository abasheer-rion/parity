---
id: LOG-0011
title: Emerging markets, energy futures and the next official runs
type: log
status: final
created: 2026-10-22
updated: 2026-10-22
authors: [amanda]
tags: [carry, commodities, fx]
related: [LOG-0005, LOG-0006, LOG-0007, RES-0013, RES-0014, RES-0015, EXP-0006, EXP-0008, EXP-0009, EXP-0010]
---

# Emerging markets, energy futures and the next official runs

## In plain words

Amanda asked for the next steps from the last session plus much more research: emerging market currencies, whether more volatile commodities could beat the S&P 500, and what famous currency and commodity traders did. We read the papers, wrote three research notes, built seven new strategies on new free data, and wrote down exactly how each will be tested before running any of them. Nothing has been run officially yet.

## What happened

| # | Asked (paraphrased) | What came of it |
| --- | --- | --- |
| 1 | Summarise the research in the repo | Read results, audit, paper library and logs; the main points went into the chat |
| 2 | Do the next steps | Registered the rerun under corrected scoring (`REG-0004`, [EXP-0006](../experiments/0006-rerun-of-all-sixteen-strategies-with-corrected-scoring.md)) and the overlay on its own (`REG-0005`, [EXP-0007](../experiments/0007-stocks-plus-currency-trend-on-its-own.md)). The forward test is not registered; see open questions |
| 3 | Research emerging market currencies | [RES-0013](../research/0013-emerging-market-currencies.md), eight papers read in full; three strategies and [EXP-0008](../experiments/0008-emerging-market-currencies-since-2010.md) |
| 4 | More volatile commodities to beat the S&P 500 | [RES-0014](../research/0014-commodity-futures-carry-trend-and-volatility.md): on our risk-matched tests more volatility does not help, a better Sharpe ratio does. Four strategies on rolled energy futures and oil volatility; [EXP-0009](../experiments/0009-energy-futures-trend-and-carry.md), [EXP-0010](../experiments/0010-oil-volatility-and-commodity-currency-signals.md) |
| 5 | Study famous currency and commodity traders | [RES-0015](../research/0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md): 17 records graded by evidence quality, and the rules they suggest |

Engineering notes, in the order found:

- FRED was down for maintenance all session, so nothing using FRED was fetched locally. Tests use synthetic data; the new non-FRED series were fetched and checked.
- The EIA stopped publishing NYMEX futures prices after 5 April 2024. Energy tests end there.
- Roll days: a price-based roll finder picked the right day only 71% of the time on synthetic data, because a normal day's move is often as big as the gap between contracts. Replaced by the exchange's expiry rules counted on the data's own trading days (blank on holidays), checked against real expiries including Good Friday 2016, Thanksgiving 2019 and April 2020. On real data the rule day fits the prices better than any day around it for all four contracts.
- Gas contracts before 1996 expired three trading days earlier than today's rule, and 1996 to 1997 fits neither, so the gas index starts in 1998.
- Heating oil contract 1 has gaps; 75 heating oil rolls (and 32 others) fell on days without both prices and were being skipped, which would have booked the contract spread as a return. Fixed and tested.
- Mutation testing on the new code: 30 deliberate bugs, all caught by `tests/test_em_energy.py` after two rounds of strengthening the tests.
- `scripts/references.py`, rerun in full, drops hand-made verification fields from hundreds of records, so new sources were appended instead.
- Exploratory trials: none. Only data checks were run (coverage, roll days, largest daily moves of the instruments); no strategy return or Sharpe ratio was computed, so every new registration says "not seen".

## Decisions

- New strategies are judged on the reality tests (at least 4 of 5), the same bar as `REG-0002`, and costs are set per registration: 10 bp for EM currencies, 3 bp plus 2 bp per roll for energy futures.
- EM tests start in February 2010, after every published sample ended. The commodity currency test starts in April 2008, after its paper's sample.
- Trials are counted across all families, as before. This is the practice the audit's H2 questions.

## Open questions

- The audit's H1 and H2 (test power, and counting trials per family) were meant to be settled before new results. Settle them before starting these runs, or accept that these runs use the current rules.
- Forward tests: a registration freezes the engine code, so any later code change blocks a forward test registered today. Running a forward test from the commit that registered it would solve this, but it needs a workflow change. Not done.
- Futures prices after April 2024 need a free source whose terms allow scripts before any energy forward test.
- Official runs need these registrations merged to `main` first, then started from GitHub Actions in numeric order.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [LOG-0012: Lesser-known strategies and published firm research](2026-10-22-lesser-known-strategies-and-published-firm-research.md)
<!-- backlinks:end -->
