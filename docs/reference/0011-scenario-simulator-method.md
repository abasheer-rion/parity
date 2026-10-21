---
id: REF-0011
title: Scenario simulator method
type: reference
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [commodities, fx, method, news, ui]
related: [HYP-0004]
---

# Scenario simulator method

## In plain words

You can type a made-up event, like "Iran bombs a Chinese port", and the Scenarios page shows what markets did after real events that look like it. It does not predict the future. It is a history lesson with numbers: how often oil went up afterwards, by how much in a typical case, and how wide the range was. If only three past events match, the answer is mostly noise, and the page says so.

## Summary

The simulator is a classic event study [@fama1969; @brown1985] run over a hand built list of past shocks in `catalog/events/`, one JSON file per event with its date, kind, regions, countries involved, a severity from 1 to 5 and the pages we checked it against. For a scenario, a matcher picks the most similar past events and the page shows the spread of what followed. The code is `engine/src/parity/scenarios.py`, the command is `parity scenario`, and the page is `#/scenarios`.

## What it measures

For each event and each market series we take:

| Step | What we do | Why |
| --- | --- | --- |
| Base | The last close strictly before the event date | News that broke during a trading day is not half counted in the base |
| Reaction | Change from the base to the 1st, 5th, 21st and 63rd close after it (1 day, 1 week, 1 month, 3 months) | Counted on the series' own trading days, so a market shut after 9/11 is measured from its next real close |
| Units | Percent for prices and currencies, index points for the VIX, basis points for yields | A yield change in percent of the yield means little |
| Size against normal | The reaction divided by the daily volatility over the year before, times the square root of the days | A 3% oil move in a calm year is bigger news than in a wild one |
| Path | Every close for 63 trading days after the base | Draws the fan chart |

The markets covered are the ones in our data store: WTI and Brent oil, US natural gas, US stocks (total return), the VIX, the US 10 year and 3 month yields, an equal weight US dollar index against nine currencies, and the yen, franc, euro, pound, Canadian and Australian dollars and krone. Currencies are shown as their value in US dollars, so up means the currency gained. We have no free daily gold series, so gold is missing. Each series starts at a different date (oil 1986, VIX 1990, currencies 1971), so older events have fewer markets; events from the 1970s are listed for context only.

## How analogues are chosen

Each catalog event gets a similarity score between 0 and 1 against the scenario:

| Part | Points | Rule |
| --- | --- | --- |
| Kind | 3 | Same kind of event; 1.5 for the same family (war, strike and terror attack are one family; oil shock, sanctions and trade war another) |
| Region | 2 | Any shared region; 0.5 if either side is "global" |
| Countries | up to 2 | 1 per shared country |
| Severity | 1 | Falls by a quarter per step of difference |
| Commodities | 1 | Any shared exposure, such as oil |

Only parts the scenario fills in count, and the score is points over the maximum possible. Events from another family are left out entirely. By default the page keeps events scoring 0.35 or more, at most 12, closest first. For each market and horizon it then reports the median, the middle half (25th to 75th percentile), the full range, the share of events where the market rose, the median size against normal, and the count. The weights are a judgement call, not fitted, and they live in the exported JSON so the page and the command line agree.

## The economics behind it

The page's plain words lean on a few well studied channels:

- **Oil supply.** Wars and strikes near oil producers raise prices when supply is actually at risk. Kilian shows that supply shocks, demand shocks and fear about future supply move oil differently [@kilian2009]. Many strikes in the list moved oil for a day and then faded once barrels kept flowing.
- **Safe havens.** In stress, money tends to move into the yen, the Swiss franc, US Treasuries and often the dollar [@ranaldo2010]. That is why yields often fall and the VIX rises after a shock.
- **Stocks and rare disasters.** Stock prices fall when the risk of a rare disaster rises, and international crises measurably raise that risk [@berkman2011]. Geopolitical risk as measured from newspapers predicts lower investment and a higher chance of bad outcomes [@caldara2022].

## What it cannot tell you

- **Small samples.** A typical scenario matches 5 to 12 events. With 8 events, a "6 out of 8 up" result is consistent with a coin flip. The page warns when fewer than 5 events match.
- **Every event is different.** "A strike in the Middle East" covers Abqaiq in 2019, which knocked out half of Saudi output for weeks, and the 2020 Soleimani strike, which removed no oil at all.
- **Prices move before the event.** Markets often price a war in the weeks before it starts (Iraq 2003, Ukraine 2022), so the reaction after the date can be small or even reversed. A clean event date only exists for surprises.
- **Regimes change.** Oil mattered more to the US economy in 1990 than after the shale boom. Central bank behaviour, the dollar's role and market structure all shift over decades.
- **We pick events after the fact.** The list holds events people remember, which tends to mean the ones that moved markets. Scares that came to nothing are under counted, so the typical reaction is likely overstated.
- **Other news.** A one month window after an event also contains everything else that happened that month. We do not subtract a market model; with 63 day windows, that noise is large.
- **No cause.** The page shows what followed, not what was caused.

## Further reading

- Fama, Fisher, Jensen and Roll (1969), the first event study: [The Adjustment of Stock Prices to New Information](https://doi.org/10.2307/2525569).
- Brown and Warner (1985), event studies with daily data: [Using daily stock returns](https://doi.org/10.1016/0304-405X(85)90042-X).
- Ranaldo and Soderlind (2010): [Safe Haven Currencies](https://doi.org/10.1093/rof/rfq007).
- Berkman, Jacobsen and Lee (2011): [Time-varying rare disaster risk and stock returns](https://doi.org/10.1016/j.jfineco.2011.02.019).
- Caldara and Iacoviello (2022): [Measuring Geopolitical Risk](https://doi.org/10.1257/aer.20191823).

## Adding an event

Add a file to `catalog/events/` with the same keys as the others, using only the kinds, regions and commodities listed in `engine/src/parity/scenarios.py`, and at least one source you have read. Run `python3 scripts/references.py`, `python3 scripts/docs.py index` and `parity scenario export`. The test `test_catalog_events_are_valid` checks every file.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@fama1969](../REFERENCES.md#fama1969): Fama et al. (1969), The Adjustment of Stock Prices to New Information
- [@brown1985](../REFERENCES.md#brown1985): Brown and Warner (1985), Using daily stock returns
- [@kilian2009](../REFERENCES.md#kilian2009): Kilian (2009), Not All Oil Price Shocks Are Alike: Disentangling Demand and Supply Shocks in the Crude Oil Market
- [@ranaldo2010](../REFERENCES.md#ranaldo2010): Ranaldo and Söderlind (2010), Safe Haven Currencies
- [@berkman2011](../REFERENCES.md#berkman2011): Berkman et al. (2011), Time-varying rare disaster risk and stock returns
- [@caldara2022](../REFERENCES.md#caldara2022): Caldara and Iacoviello (2022), Measuring Geopolitical Risk

## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
