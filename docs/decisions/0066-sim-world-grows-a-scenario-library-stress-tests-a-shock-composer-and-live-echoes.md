---
id: DEC-0066
title: Sim World grows a scenario library, stress tests, a shock composer and live echoes
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [data, process, ui]
related: [DEC-0016, DEC-0020, DEC-0024, DEC-0037, DEC-0056, DEC-0063, REF-0011, REF-0017, CMP-0002]
---

# Sim World grows a scenario library, stress tests, a shock composer and live echoes

## In plain words

The owner asked to "keep touching up and adding more to the world sims". This decision covers what Parity Terminal's Sim World gained:

- **A bigger event catalog.** 140 past events instead of 76, with six new kinds: sovereign default, currency crisis, bank run, rate shock, crypto crash and supply chain shock. More regions too: South Asia, Latin America and Africa now have several events each. Every event links the page it was checked against.
- **A scenario library (`LIB`).** For every kind of event, what each market did a day, a week, a month and three months later. Every number says how many past events it rests on, gives a 90% range for the typical move, and says whether the direction held or past cases were mixed.
- **Monte Carlo stress tests (`MC`).** Up to four mixes run through the same 2,000 simulated paths built from 13-week blocks of real weeks since 1986, with a real crash (1987, dot-com, 2008, Covid, 2022) spliced in at the start, after a year or halfway. The panel shows the spread of end values, the worst 5% and 1%, the chance of a loss, the worst falls and how many weeks they took to make back, and replays the paths. The sims service runs six preset mixes on 5,000 paths every cycle, and the panel shows that run beside its own.
- **A shock composer (`MIX`).** Combine moves, such as oil +40% and the 3-month bill +100 bp over 13 weeks, and see every past window since 1986 when they happened together, with what other markets did then and in the 13 weeks after. Research only.
- **Echoes (`ECHO`).** Recent days whose moves pointed the same way as the first day after a past event, with what followed those events. With a live feed, today is checked again as prices move, and a map shows the moves. A strip flags a day that was large and closely alike.
- **The country card on the map** now lists the markets that moved most with that currency in past crises, against calmer weeks, and the past events involving the country with the currency's move a month later.
- **A World workspace** (F7 or Ctrl+6) holds the map, echoes, stress tests, the library and the composer.

Everything is history replayed. Nothing is a forecast, and every panel says so.

## Context

Users of Bloomberg-style terminals praise dense screens they can drive by typing, and trust built on sources ([CMP-0002](../competitors/0002-bloomberg-terminal.md), [CMP-0001](../competitors/0001-ux-patterns-users-praise-most.md)). Our Scenario panel already found past events like a typed one ([REF-0011](../reference/0011-scenario-simulator-method.md)), but the catalog had gaps. It had no bank runs, few currency crises and almost nothing outside the US, Europe and the Middle East. Two example scenarios used kinds the engine did not know, so they matched nothing.

## Decision

1. **Six new kinds of event.** `sovereign_default`, `currency_crisis`, `bank_run` and `rate_shock` join the financial family. `supply_chain_shock` joins the supply family. `crypto_crash` is a family of its own, so a crypto scenario never borrows a war's moves. Seven older events moved to a narrower kind (Black Wednesday, the peso, Asian and yuan crises to currency crisis; the Russian default and Greece's downgrade to sovereign default; SVB to bank run; the UK mini-budget to rate shock). Their family is unchanged, so old scenarios find them as before.
2. **64 new events**, each with a date, the countries involved and a Wikipedia page we read. When news broke after a market close or on a weekend, the event date is the next trading day, so the base close is the last one before the news.
3. **The library is computed by the engine.** `parity scenario export` adds a `library` block to `scenarios.json`. The always-on sims service already runs that export every cycle ([DEC-0037](0037-everything-runs-by-itself-and-the-search-widens-itself.md)), so the library is rebuilt every 20 minutes with no new job. Per kind and per family, per market and horizon:
   - the count, median, middle half and share of events with a rise;
   - a 90% range for the median from the order of the past moves (distribution free, binomial). Below 5 events there is no such range and the panel says "too few";
   - "held up" or "held down" only when the whole range is on one side of zero, otherwise "mixed";
   - a word for the count: solid from 20, fair from 10, thin from 5. The words are a reading aid. The count is always shown next to them.
4. **`LIB` in the Terminal.** A table of kinds, and for the picked kind a table of markets and the list of its events with their sources. "Whole family" widens the pool. "Play as scenario" opens `SCEN` with that kind.
5. **Fixed examples.** "Gulf oil supply shock" and "Terror attack in the US" now use real kinds. Six new examples cover the new kinds. A test checks that every example uses a kind the engine knows. Typed words now map to the new kinds ("bank run", "devalues", "lira plunges", "yields spike", "bitcoin", "canal").

6. **Stress tests use the same method as Paths ([DEC-0016](0016-sim-world-2-a-world-map-scenarios-on-it-and-simulated-paths.md)), on a mix.** Simple weekly returns, the mix rebalanced to its weights every week, no trading costs. Every mix in a comparison uses the same draws, so differences come from the mixes, not luck. A spliced crash replaces the drawn weeks with the real ones, in order. "Weeks to make back" is measured on each path's worst fall, from its peak until that peak is reached again; paths that never make it back are counted separately. `parity world stress` writes `stress.json` (six mixes, four horizons, plain and with each crash, 5,000 paths, about 320 kB). The sims service runs it every cycle and the deploy job builds it. The browser repeats the rules (`web/src/lib/stress.ts`) so any mix can be run; tests in both languages check the same hand-worked cases.
7. **The composer looks for windows, not a model.** A window counts when every chosen market moved at least the chosen share (all, two thirds or half) of its asked size, in the asked direction. Windows do not overlap, so a long episode counts once. Each cell shows the median, how many windows it was up in, and marks a direction only when the 90% range of the median is on one side of zero. "Fed +100 bp" is read from the 3-month Treasury bill, the closest market rate we hold back to 1986. The search is light, so it runs in the browser on the world file.
8. **Echoes compare directions, not sizes.** For each of the last 60 trading days, each market's 1-day move in daily volatilities (over the year before) is compared with each past event's first-day moves by cosine similarity, over the markets both have, at least 6. Matches at 60% or more are kept. The flag needs moves 1.5 volatilities in size on average and 80% alike. `parity scenario export` writes them (`echoes`), so they are rebuilt every sims cycle. Live: our public on-chain EURC price for the euro, and for the team Kraken's EUR, GBP, JPY, CHF, AUD and CAD pairs ([DEC-0056](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md), [DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)), measured against the last close.
9. **Crisis links on the map are computed in the page** from the weekly world file: the correlation of weekly changes over the weeks inside the seven replayed crises, against all other weeks.

## Alternatives considered

- **A bootstrap interval or a t-interval for the median.** Rejected. With 5 to 15 events both lean on assumptions the data cannot check. Order statistics need none, and say plainly when there are too few.
- **Fitting a model per kind of event.** Rejected for now. With a dozen events per kind, a model would mostly fit noise.

- **A fitted model for the composer** (a regression of each market on the shocks). Rejected: it would give a number for any combination, including ones that never happened, and hide how few windows stand behind it.
- **Reading demo account holdings into the stress test.** Not yet. Demo positions are single stocks and coins, and the world file holds index-level prices, so the mapping would be a guess. A custom mix of up to four world assets stands in for now.

## Consequences

- `scenarios.json` grows from about 640 kB to about 1.4 MB before compression, because each event carries three months of daily paths.
- Crypto crashes show what stocks, rates, currencies and oil did. The scenario file holds no crypto prices this far back, and the panel says so.
- A day or an echo is a pattern match on one day. The panel says so, and offers to play the matched event as a scenario rather than drawing a forecast.
- Live echoes need the live feed; with it down, the panel shows the daily days only. The public sees only the euro live, so a live check is thin until more markets stream.
- Engine tests: `test_median_interval_order_statistics`, `test_library_*`, `test_resemblance_*` and `test_echoes_*` in `engine/tests/test_scenarios.py`, and `engine/tests/test_stress.py`. Web tests: `web/tests/simWorld.test.ts`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0037: Everything runs by itself and the search widens itself](0037-everything-runs-by-itself-and-the-search-widens-itself.md)
- [REF-0011: Scenario simulator method](../reference/0011-scenario-simulator-method.md)
<!-- backlinks:end -->
