---
id: DEC-0014
title: A strategy factory and an always-on search
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [process]
related: [INT-0002, DEC-0003, DEC-0009, REF-0003]
---

# A strategy factory and an always-on search

## In plain words

The owner wanted far more strategies, thousands of them, and simulations running around the clock ([INT-0002](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)). Two things now do that:

- **The factory.** It turns short recipes into strategies. It took us from 16 named, tested strategies to 102, each with a plain name, a one-line description and a link to its idea in the catalog.
- **The always-on search.** It runs on the owner's machine without stopping. It tries new variations of those ideas at random, about 20,000 an hour, and keeps every result.

Every variation tried is counted. That makes the "could this be luck" check stricter as the search grows, so searching more cannot manufacture a winner.

## Context

Most trading ideas fit one of a few shapes:

- follow each asset's trend;
- rank assets against each other and hold the best;
- step in and out of one market on a rule;
- hold a fixed mix;
- trade the gap between two related prices.

Writing each idea by hand ([DEC-0003](0003-strategies-are-plugins.md)) was slow, and it hid how similar they are. The data was also thin: 9 currencies, US stocks and three commodities.

## Decision

1. **Building blocks.** `engine/src/parity/strategies/_blocks.py` has one class per shape, plus chart indicators (MACD, Bollinger, Ichimoku) and the Turtle breakout. `factory.py` lists 86 recipes covering:
   - currencies;
   - US stock timing;
   - stocks and bonds;
   - the 12 US industries;
   - research factors;
   - oil and gas.

   Each recipe gets the same backtest and gauntlet as a hand-written strategy.
2. **More data, all free and licensed for research** ([REF-0003](../reference/0003-data-sources.md)):
   - 12 more currencies.
   - 2-year and 30-year Treasury yields.
   - Treasury total return indexes rebuilt from yields.
   - Seven stock factors and 12 industry portfolios from Kenneth French's library.
3. **Honest costs and timing,** each found while building this:
   - **Factor trading costs.** Factor returns are paper portfolios, so holding one is charged an estimated yearly trading cost: 0.5% to 1% for slow factors, 3% for momentum and 10% for short-term reversal. These are rough figures in line with Novy-Marx and Velikov (2016).
   - **No borrowing on zero-cost books.** Factors and currencies are zero-cost long-short books, so they are not charged for borrowed money.
   - **Negative prices.** A percent change through a zero or negative price earns nothing. US oil (WTI) closed at -$37 on 20 April 2020, which had produced a 110% loss in a single day.
   - **Monthly averages as a delayed signal only.** Monthly averages are only known after the month ends. Copper is now used from a week after month end. Before this fix, "stocks while copper rises" looked like the best rule found, and the gain disappeared once the delay was added. Copper is also never held, because a monthly average is not a price anyone could trade at.
   - **Delayed trading on Brent against WTI.** The pair trade acts a day late. Brent closes in London hours before WTI closes in New York, and acting the same day turned a 0.5 Sharpe ratio into 1.2.
4. **A look-ahead test for every strategy.** `tests/test_factory.py` cuts the data at several dates and checks that no weight before a cut changes. It fails on a strategy built to peek one day ahead. The search's own tests apply the same check to its random variations.
5. **The search.** `parity search` (`engine/src/parity/search.py`):
   - **Sampling.** It draws a recipe at random from the blocks. A variation that sits in cash at least 95% of the time is rejected, because sitting in cash scores a fake, huge Sharpe ratio.
   - **Storage.** It records every attempt, failed ones included, in `engine/output/search.db`.
   - **Export.** It exports the best 3,000 to `engine/output/search.json`, each with a short name, one line and key numbers.
   - **The luck check.** Deflated Sharpe is recomputed at export using the total number of tries and the real spread of results across them (Bailey and Lopez de Prado, 2014).
6. **Always on.** `scripts/search-service/install.sh` installs it as a launchd agent for the owner's user:
   - It runs at low priority.
   - It restarts every 12 hours to pick up new code.
   - It refreshes data daily.
   - It logs to `~/Library/Logs/parity-search.log`.
   - It opens no network port. Every six hours it sends a compact snapshot to Supabase (a new table that keeps the newest 20). The hourly site deploy copies the newest snapshot into the dashboard's Strategy search page.
7. **Leads, not results.** Nothing in the search counts as a result. A lead becomes one only when it is registered in advance and run officially, as before ([DEC-0009](0009-excess-returns-financed-leverage-frozen-code.md)).

## Alternatives considered

- **Hand-write 1,000 strategies.** Rejected. Most would be the same few shapes with different settings, and hiding that would make the trial count dishonest.
- **Search on a schedule in GitHub Actions.** Rejected. A 13-minute job already uses much of the free monthly minutes, and the owner asked for the box to run it around the clock.
- **Search for the best settings and report only the winner.** Rejected. This is how backtests lie. Every try is kept and counted.

## Consequences

- **The luck bar rises for everyone.** Going from 16 to 102 strategies makes the deflated Sharpe stricter for all of them, which is correct. On the first full run no strategy beat the S&P 500 after costs. The best passed 9 of 11 tests.
- **Rates are not delayed yet.** The monthly interbank rates behind currency carry are monthly averages too, and are still used from the first of the month. Fixing this would change existing results, so it is an open question for the owner.
- **Spot natural gas jumped 85% in a day in January 2024.** Spot gas is not something anyone trades, so gas strategies look riskier than futures would be.
- **"Natural gas into winter" was removed on 2026-10-22.** Holding spot gas through those spikes made it lead the strategy race at +2,632%, an artifact. Gas stays a signal only until we have futures data. The older "Commodity trend" strategy still holds spot gas and shows a -99% worst fall; whether to change it is an open question for the owner.
- **The search fills a local database.** At about 20,000 rows an hour it grows by roughly 100 MB a week. Pruning can come later.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0015: Two sides, a product app and a research app, kept apart](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)
- [EXP-0005: Rerun of all sixteen strategies with corrected scoring](../experiments/0005-rerun-of-all-sixteen-strategies-with-corrected-scoring.md)
- [EXP-0007: Emerging market currencies since 2010](../experiments/0007-emerging-market-currencies-since-2010.md)
- [RES-0015: Combining many strategies, the evidence and the ingredient list](../research/0015-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
- [LOG-0007: Ayan work log, clarity, the strategy factory, the search and two sides](../log/2026-10-22-ayan-work-log-clarity-factory-search-and-two-sides.md)
- [LOG-0010: Lesser-known strategies and published firm research](../log/2026-10-22-lesser-known-strategies-and-published-firm-research.md)
<!-- backlinks:end -->
