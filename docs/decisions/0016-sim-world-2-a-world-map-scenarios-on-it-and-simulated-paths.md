---
id: DEC-0016
title: Sim World 2, a world map, scenarios on it and simulated paths
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [process, ui]
related: [INT-0002, DEC-0015, REF-0011]
---

# Sim World 2, a world map, scenarios on it and simulated paths

## In plain words

Sim World is now a small world simulator on the research side, at `#/sim`. It has four tabs:

- **World map.** Each country is coloured by how its currency moved against the US dollar, by its interest rate gap with the dollar, or by a scenario. A slider and a play button step through history by day, week or month.
- **Scenario.** Type an event or click the countries involved. The page finds similar past events and shows the range of what markets did next.
- **Paths.** Pick a basket and simulate many futures by reshuffling real weeks from the past. See the chance of a loss and the worst cases, and download the paths as a file.
- **Strategy race.** The old Sim World, unchanged.

Everything is history replayed or reshuffled. None of it is a forecast, and every tab says so. The owner asked for "a fully fleshed out sim world and interactive map" ([INT-0002](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md), goal 4).

## Context

INT-0002 asks for a world simulator where people and AI models play out events, see ranges of outcomes and their risks, and export simulated paths. The parts already existed in pieces:

- the scenario simulator, which lines up what followed similar past events ([REF-0011](../reference/0011-scenario-simulator-method.md));
- daily prices for 21 currencies, oil, gas, copper, US stocks and Treasuries;
- the strategy race, which was all Sim World did.

## Decision

1. **One data file from the engine.** `parity world export` writes `world.json`:
   - every currency's value in US dollars, daily from 2020 and weekly from 1986;
   - the US dollar as an equal weight index against nine currencies, the same one the scenario simulator uses;
   - 3-month interest rates for the ten currencies that have them, for carry;
   - oil, gas and copper prices, US stocks and Treasury total return indexes;
   - how each currency moved after each catalog event, measured with the scenario simulator's own event study, so the map and the Scenarios page agree.

   The deploy job builds it next to `scenarios.json`. It is about 420 kB compressed.
2. **The map is drawn in the page.** Country shapes come from `world-atlas` (Natural Earth, public domain, ISC licence) and are drawn as SVG with `d3-geo` and `topojson-client`. There is no tile server and no outside request. Singapore and Hong Kong are too small at this scale, so they are dots.
3. **Which country uses which currency** lives in `web/src/lib/world.ts`. Euro area members, including Bulgaria from 2026, use the euro. Ecuador, El Salvador and Panama use the dollar. Countries whose currency we do not hold are grey and say so.
4. **Producer marks** show big exporters of oil, gas and copper, from EIA, IEA and USGS lists. They are for orientation only.
5. **The scenario tab reuses the scenario simulator.** Typed words become its choices by plain keyword matching, which the page shows so people can correct it. The map is coloured by each currency's median move after the matched events. Fan charts show the median, the middle half and the full range, and the page always shows how many past events it rests on.
6. **Simulated paths run in the browser.** They use a block bootstrap: each path strings together random runs of real, back to back weeks. All assets share the same weeks, so their links to each other survive. The pool is either all shared history or only the 13 weeks after each matched past event. Even the largest setting, 5,000 paths of two years, stays quick enough without a web worker.
   - The risk table shows the median, the middle half, the worst 5%, the average of the worst 5%, the chance of any loss and the chance of a loss bigger than a chosen size.
   - The CSV has one row per path and week, every asset starting at 100.
   - `parity world paths` runs the same method in the engine and writes the same CSV, for AI models and scripts. The two use different random numbers, so their draws differ while following the same rules.
7. **The strategy race is a tab**, `#/sim/race`, so nothing from the old Sim World is lost.

## Alternatives considered

- **A tile map such as Mapbox or OpenStreetMap tiles.** Rejected. It needs an outside server and a key, and a choropleth of 180 countries does not need tiles.
- **Paths precomputed by the engine.** Rejected for the page, because a basket is chosen on the spot and the browser is fast enough. The engine command exists for scripts.
- **A fitted model, such as a GARCH or a factor model, for the paths.** Not now. A bootstrap makes the fewest assumptions and is easy to explain. Its limit is that it cannot produce anything that has not happened before, and the page says so.

## Consequences

- The scenario state lives in the address, so a link reopens the same scenario on any tab.
- A daily step only reaches back to 2020, to keep the file small. Weekly and monthly steps reach back to 1986.
- Carry needs an interest rate. Only nine currencies besides the dollar have one in our data, so the other twelve show "no rate data".
- With few matched events, analogue paths repeat the same few stretches of history. The page warns when fewer than 60 weeks are available.
- Engine tests cover the export and the bootstrap (`engine/tests/test_world.py`). Backtest results do not change.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
