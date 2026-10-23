---
id: DEC-0027
title: New edge families from the wider data
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, strategy]
related: [DEC-0014, DEC-0009, RES-0011, REF-0003]
---

# New edge families from the wider data

## In plain words

The owner asked us to look for edges in the market, and for ways to help others find their own. Three things came out of it:

- **A research note** on where documented edges come from and which survive costs and publication ([RES-0011](../research/0011-where-market-edges-come-from-and-which-survive.md)).
- **17 new strategies and 2 new search shapes** that use the data added in PR #30: speculators' futures positions, the full yield curve, central bank policy rates for 27 currencies, stress indexes, jobless claims and the Fed's meeting calendar.
- **An Edge Lab** on the research side (`/research/#/edges`) and a public page (`/learn/edge-lab/`). It holds plain lessons on how not to fool yourself, a checklist tool, and our own real mistakes as examples.

The honest result: none of the 17 beats the S&P 500 on every test. The best is carry on central bank policy rates across 27 currencies. It passed 9 of 11 tests, including the "not just luck" test, but it fell with stocks and did not win in every era.

## Context

[DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md) built the factory and the always-on search, but most of their ideas used prices only. PR #30 added official data the strategies did not read yet. Each source has its own release delay, and using a number before it was public is the most common way a backtest lies. We found that twice already: copper, and Brent against WTI.

## Decision

1. **New families, one recipe each** (`engine/src/parity/strategies/edges.py`, shared signals in `_signals.py`):
   - **Positioning (CFTC).** Currencies against the crowd, currencies at positioning extremes, stocks unless speculators crowd in, long bonds unless speculators crowd in.
   - **Yield curve.** Long bonds when the curve is steeper than usual, a duration-neutral Treasury butterfly, and the euro on the gap between euro and US 2-year yields.
   - **Policy rates (BIS).** G10 carry on policy rates, wide carry on 27 currencies, hiking central banks, and wide carry switched off in financial stress.
   - **Regimes.** Stocks while the St. Louis Fed stress index is low, while Chicago Fed financial conditions ease, and unless jobless claims climb.
   - **Calendar.** Stocks before Fed announcements (pre-FOMC drift), stocks in even weeks of the Fed cycle, and stocks over the turn of the year. Turn of the month already existed.
2. **Two new search shapes and five new timing rules** in `engine/src/parity/search.py`: CFTC positioning (against or with the crowd, ranked or at extremes), and policy-rate ranking on 9 or 27 currencies. The new timing rules cover stress, financial conditions, claims, crowded S&P futures and the Fed cycle week, with odd weeks as a built-in placebo. The search skips any series this machine has not fetched yet, so the box keeps running until its daily refresh builds them. The MCP tools (DEC-0025) know the new shapes and rules too, so an assistant can try them and draft recipes for them.
3. **Release delays, checked by tests** (`engine/tests/test_edges.py`):
   - CFTC positions are dated Tuesday and released Friday at 15:30 New York time. The catalog moves them to Friday, and the signal acts on Monday, because our dollar prices are noon fixings.
   - The ECB publishes the euro yield curve at noon the next day, so it now carries a one-day delay in the catalog. No existing strategy read it, so no result changes.
   - Stress indexes and claims already had their release delays (three or four business days).
   - Policy rates need no delay: a central bank announces on or before the day a new rate takes effect.
   - The FOMC dates are a fixed schedule the Fed publishes a year ahead (`engine/src/parity/data/fomc.py`, 271 scheduled days from 1994 to 2027, read from the Fed's calendars). Unscheduled meetings and calls are left out, and so is the cancelled March 2020 meeting.
4. **Currencies priced from ECB reference rates** (`xfx.<CCY>`, built locally from `ecb.*`). Each one is crossed to the dollar through the euro and earns the BIS policy-rate gap as its carry. Only currencies with both an ECB rate and a BIS policy rate are included.
5. **Two backtester options, built for the new strategies:**
   - **T-bill cash.** A day in cash scores exactly zero excess return. All the new timing strategies used this from the start, and since 2026-10-23 every strategy does (see Consequences).
   - **A cost floor.** A strategy can set a minimum trading cost. The wide currency books pay at least 5 basis points a trade, against 1 basis point for G10. The gauntlet doubles the floor in its double-cost test.
6. **Small grids.** Every recipe has at most 4 combinations of settings.

## Results

`parity run` with the gauntlet, 1999 to 2026-10-22, at the default 1 basis point a trade (5 for the wide books). The benchmark, US stocks, has a Sharpe ratio of 0.43. "Luck" is the deflated Sharpe ratio, and it must reach 0.95 to pass.

| Strategy | Sharpe | Luck | Tests passed | Verdict |
|---|---|---|---|---|
| Wide carry on policy rates | 0.75 | 0.98 | 9/11 | Real, falls with stocks, not every era |
| Wide carry, off in financial stress | 0.61 | 0.91 | 8/11 | Real, too small alone |
| Stocks while financial conditions ease | 0.57 | 0.89 | 7/11 | Real, too small alone |
| Stocks unless speculators crowd in | 0.44 | 0.69 | 7/11 | Some signs |
| Hiking central banks | 0.38 | 0.58 | 6/11 | Real, too small alone |
| Stocks while stress is low | 0.47 | 0.74 | 6/11 | Some signs |
| Stocks unless layoffs climb | 0.47 | 0.74 | 6/11 | Some signs |
| Stocks in even FOMC weeks | 0.53 | 0.84 | 6/11 | Some signs |
| Stocks before Fed announcements | 0.45 | 0.73 | 5/11 | Real, too small alone |
| Treasury butterfly | 0.28 | 0.37 | 4/11 | Real, too small alone |
| Euro on the euro against US 2-year gap | 0.11 | 0.09 | 4/11 | Some signs |
| G10 carry on policy rates | 0.34 | 0.49 | 3/11 | Some signs |
| Long bonds unless speculators crowd in | 0.17 | 0.18 | 3/11 | Some signs |
| Long bonds when the curve is steeper than usual | 0.23 | 0.26 | 3/11 | Some signs |
| Stocks over the turn of the year | 0.16 | 0.15 | 3/11 | Some signs |
| Currencies at positioning extremes | -0.04 | 0.02 | 1/11 | Noise |
| Currencies against the crowd | 0.02 | 0.04 | 0/11 | Noise |

What this says:

- **Carry is the one edge that keeps showing up.** Policy-rate carry on 27 currencies held up across settings in the search too (Sharpe 0.70 to 0.77 for 3, 5 or 7 currencies a side). It is the classic crash-prone risk premium the literature describes, so failing "does not crash with stocks" is expected.
- **G10 carry on policy rates (0.34) is a little weaker than the existing G10 carry on interbank rates (0.41).** The interbank rates are monthly averages still used from the first of the month (DEC-0014), so part of that gap may be the timing advantage. This is a hint, not a proof. Since 2026-10-23 the rates are delayed until published and G10 carry scores 0.40, so timing explains almost none of the gap.
- **Contrarian positioning in currencies is noise.** That fits the hedging-pressure papers, where speculators earn a premium on average rather than lose one.
- **The pre-FOMC drift is real but small.** It is invested only 8 days a year and fails "wins on the most recent years", in line with reports that it faded after publication.
- Nothing here counts as a result. A lead becomes one only after it is registered and run officially ([DEC-0009](0009-excess-returns-financed-leverage-frozen-code.md)).

## Alternatives considered

- **Trade the wider currencies on Fed H.10 rates with no carry.** Rejected. Carry is most of the return of a carry book, and leaving it out would make carry look like a loser.
- **Use 3-month money market rates for carry on the wider set.** We have none for most of these currencies. Policy rates are a proxy. It is weakest where capital controls separate onshore and offshore rates (CNY, INR, BRL, KRW, IDR, MYR) and in Turkey's unorthodox years.
- **Switch every existing strategy to T-bill cash now.** Rejected for this change, because it would move existing results. The owner later approved it and it was done on 2026-10-23 (see Consequences).

## Consequences

- **The trial count went up by 17 strategies and two search shapes.** The luck bar rises for everyone, as it should.
- **Stress indexes are revised.** The St. Louis Fed and Chicago Fed indexes we download are today's estimates of the past, not what was known at the time. Their tests are kinder than real trading would have been. Fixing this needs vintage data (ALFRED). Jobless claims are revised too, but only slightly.
- **Wide currency costs are a guess.** 5 basis points a trade is rough. Some of these currencies cost far more in a crisis, and some cannot be held offshore at all.
- **The FOMC file needs a yearly update** when the Fed publishes the next schedule.
- **Every strategy's cash earns the T-bill since 2026-10-23.** Older strategies' cash used to earn the 3-month interbank rate while being measured against the T-bill, about 0.26% a year of free return since 1999 (1.28 points in 2008). The owner approved the fix. Cash now earns the T-bill, with the interbank rate only on days the T-bill is missing, and the per-strategy cash setting is gone. Stock timing strategies lost 0.01 to 0.04 Sharpe. See [EXP-0005](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md).
- **The carry comparison above is now settled.** With interbank rates delayed until published, G10 carry moved only from 0.41 to 0.40, so the timing advantage explains almost none of its lead over policy-rate carry ([EXP-0005](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md)).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0028: Parity Academy, short courses with moving pictures](0028-parity-academy-short-courses-with-moving-pictures.md)
- [HYP-0009: Emerging market carry pays after costs](../hypotheses/0009-emerging-market-carry-pays-after-costs.md)
- [EXP-0005: Honest cash and delayed rates, before and after](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md)
- [EXP-0008: Emerging market currencies since 2010](../experiments/0008-emerging-market-currencies-since-2010.md)
- [RES-0011: Where market edges come from and which survive](../research/0011-where-market-edges-come-from-and-which-survive.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
<!-- backlinks:end -->
