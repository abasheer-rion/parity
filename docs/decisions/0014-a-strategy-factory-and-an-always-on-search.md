---
id: DEC-0014
title: A strategy factory and an always-on search
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-23
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
- **Rates are delayed since 2026-10-23.** The monthly interbank rates behind currency carry are monthly averages too. Signals now see them a week after the month ends, like copper, while carry on positions still accrues at the month's own rate. "Rising rates" fell from 0.26 to -0.03 Sharpe; currency carry barely moved. See [EXP-0005](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md).
- **Spot natural gas jumped 85% in a day in January 2024.** Spot gas is not something anyone trades, so gas strategies look riskier than futures would be.
- **"Natural gas into winter" was removed on 2026-10-22.** Holding spot gas through those spikes made it lead the strategy race at +2,632%, an artifact. Gas stays a signal only until we have futures data. The older "Commodity trend" strategy held spot gas too. Since 2026-10-23 it trades Brent and WTI only, with the owner's approval. Its worst fall is still -98%, so gas was not the cause: spot oil itself moved 51% in a day in April 2020 ([EXP-0005](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md)).
- **The search fills a local database.** At about 20,000 rows an hour it grows by roughly 100 MB a week. Pruning can come later.
- **The search was widened on 2026-10-23.** After about 94,000 tries it was drawing mostly repeats: about 8 new variations in each batch of 50. Now:
  - **More to hold.** New universes: G10 and 27 currencies priced from ECB rates, Treasuries at 2, 5 and 10 years, Brent and WTI, seven stock factors, and a stocks, bonds and oil mix. Only daily prices are ever held. Monthly averages, spot gas and copper stay signals only, and a test checks this on every sampled variation.
  - **A second signal.** Any strategy can trade only while a regime filter is on. The filter reads almost any series in the catalog (rates, curves, policy rates, positioning, inflation, the dollar, stress and jobs gauges, bank lending to private credit) on the day it is published, plus one more day.
  - **Three more combinators.** A steady risk target on any strategy, rebalancing a few days after the usual day, and equal blends of two or three strategies already tried.
  - **Smarter drawing.** Each kind of variation is drawn less as its draws turn into repeats. Repeats are thrown out before any backtest and are not counted as tries. Every backtest is still counted, failed ones included, and old variations keep their ids.
  - **Result.** A 200-try run on a copy of the database found 200 new variations in 244 draws, so each batch of 50 is now 50 new, up from about 8. The number of ways to combine filters, risk targets and blends runs into the billions, so this should last for months.
  - **Blends start from earlier winners.** Blends and wrapped strategies are mostly drawn from tries that already made money. That favours good-looking pieces, so a blend's Sharpe is a lead to check, not evidence. Every blend still counts as a try in the luck check.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0003: Parity Verify, the lie detector for trading strategies and bots](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)
- [DEC-0015: Two sides, a product app and a research app, kept apart](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)
- [DEC-0025: AI assistants get Parity tools through a local MCP server](0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)
- [DEC-0027: New edge families from the wider data](0027-new-edge-families-from-the-wider-data.md)
- [DEC-0032: Parity Verify as a data and API business, with a free retail tier](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- [DEC-0035: Bot Battle and shareable clips: win rate is not profit](0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)
- [DEC-0036: Verify runs its checks in the browser and holds daily prices only](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)
- [DEC-0037: Everything runs by itself and the search widens itself](0037-everything-runs-by-itself-and-the-search-widens-itself.md)
- [EXP-0005: Honest cash and delayed rates, before and after](../experiments/0005-honest-cash-and-delayed-rates-before-and-after.md)
- [RES-0011: Where market edges come from and which survive](../research/0011-where-market-edges-come-from-and-which-survive.md)
- [GDE-0006: Connecting AI tools to Parity with MCP](../guides/0006-connecting-ai-tools-to-parity-with-mcp.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
- [LOG-0007: Ayan work log, clarity, the strategy factory, the search and two sides](../log/2026-10-22-ayan-work-log-clarity-factory-search-and-two-sides.md)
- [LOG-0014: Everything runs by itself](../log/2026-10-24-ayan-work-log-everything-runs-by-itself.md)
<!-- backlinks:end -->
