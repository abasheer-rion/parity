---
id: DEC-0029
title: Private markets, free proxies, an unsmoothing study and plain pages
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, private-markets, ui]
related: [DEC-0015, DEC-0018, DEC-0019, DEC-0023, REF-0015, RES-0012]
---

# Private markets, free proxies, an unsmoothing study and plain pages

## In plain words

The owner asked for private markets, with the research "fully decked out" and the result usable. Real private fund returns are sold by a few data firms under licences we cannot show, so we built around what is free and honest:

- **A sourced research note** on private equity, venture, private credit, property, infrastructure, secondaries and the funds sold to individuals ([RES-0012](../research/0012-private-markets-how-they-are-measured-and-how-individuals-get-in.md)).
- **Free public data:** counts of private offerings filed with the SEC (Form D), the marks of seven large listed lenders to private companies (BDCs), and nine Federal Reserve series on property prices and bank lending.
- **An unsmoothing study** that shows how much calmer property indexes look than they are. The appraisal-era commercial property index swings about 3 times less than its unsmoothed version.
- **A Private markets page** on the product side (`/app/#/markets/private`) that explains each kind in plain words, how to read IRR, TVPI, DPI and PME with a calculator, the ways in for individuals with "what to check" lists, and the public data. It never says "buy".
- **A research page** (`/research/#/private`) with the numbers, and a **public guide** at `/learn/private-markets/` plus 21 new glossary terms.

## Context

Private markets are a growing part of what is sold to individuals, through interval funds, non-traded BDCs and REITs, evergreen funds and tokens. They are also where reported numbers are easiest to misread: values are estimates, returns are timed by managers, and smoothing hides risk. That makes them a good fit for Parity's habit of explaining evidence and refusing hype ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).

Fund cash flows and benchmarks come from Burgiss (MSCI), Preqin, PitchBook and Cambridge Associates. NCREIF's appraisal index is for members. None of these can be shown on our site without a licence ([REF-0015](../reference/0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md) has the general rule; RES-0012 has the provider list).

## Decision

1. **Data, all optional, all free and licence-clean.**
   - **SEC Form D data sets** (`sec-formd`): the SEC's quarterly files, 12 quarters on the first fetch, then only new quarters. We keep only counts and dollar totals by quarter, kind of issuer, size sold and exemption. Names, addresses and people in the filings are never stored. New notices only: amendments are not counted again.
   - **BDC net asset values** (`sec-bdc`): NAV per share from the XBRL facts in 10-Q and 10-K filings of seven listed BDCs. A non-listed fund was tried, but it reports NAV by share class, which the SEC's company concept API does not return.
   - Both need `PARITY_CONTACT` in the user agent, as the SEC asks, and skip cleanly without it. The hourly job already passes the repository variable; it is not set yet.
   - **Nine FRED series** under `pm.*`: commercial property prices (Fed Z.1 and BIS), FHFA house prices, bank loans to property, to businesses and to nonbank lenders (which include private credit funds and BDCs), two loan officer surveys and property loan delinquencies. Each waits for its release delay in the panel; quarterly values now wait for the quarter's end plus a lag.
   - **Left out:** NCREIF and Case-Shiller (not free or not reusable), ICE and S&P indices, and any listed price from Yahoo or similar. No free source lets us show prices of listed private equity, BDCs or REITs, so we show none.
2. **The Fed's commercial property index stays off the site as a chart.** Since 1996 the Fed chains it to CoStar's repeat-sale index. FRED tags it public domain, but the underlying data is CoStar's, so we treat it like EIA's Refinitiv-sourced prices: numbers only, no chart (`site=False`).
3. **The unsmoothing study** (`engine/src/parity/unsmooth.py`): quarterly returns, Geltner's first-order fix, a Getmansky, Lo and Makarov moving-average fit with its fit error, and same-quarter against summed stock betas. Three indexes: the Fed's commercial property index in its appraisal era (1960 to 1995) and its repeat-sale era (1996 on), and FHFA's all-transactions house price index, which mixes refinance appraisals and is deseasonalised first.
4. **One data file, two pages.** `parity markets export` writes `markets/private.json`. The product page explains; the research page shows the tables. The words live in `docs/_system/private-markets.json`, read by both pages and by the public guide, so they never disagree. Lists are ordered by name, date or size, never by return.
5. **No advice.** The access routes (interval funds, tender offer funds, listed BDCs, non-traded BDCs and REITs, listed private equity, tokenised private credit, accredited-only funds) each list what can go wrong and what to check. Real trading stays a future decision ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)).

## Results

Fetched on 2026-10-23. Volatility is annualised from quarterly returns.

| Index | Years | Autocorrelation | Reported volatility | Unsmoothed (Geltner) | US stocks, same years |
|---|---|---|---|---|---|
| Commercial property, appraisal era | 1960 to 1995 | 0.80 | 2.9% | 8.9% | 16.7% |
| Commercial property, repeat-sale era | 1996 to 2026 | 0.23 | 7.4% | 9.4% | 17.3% |
| House prices, all transactions (FHFA) | 1975 to 2026 | 0.62 | 2.7% | 5.6% | 16.7% |

- **Appraisals hide about two thirds of the swings.** The appraisal-era index has an autocorrelation of 0.80, and unsmoothing triples its volatility. The moving-average fit cannot reach an autocorrelation that high, so its figure (5.1%) is only a lower bound.
- **Real deals smooth less.** After 1996 the index is built from sales, and the gap shrinks to about a quarter.
- **Smoothing hides stock market exposure.** In the repeat-sale era the same-quarter stock beta is about zero (-0.03), but adding the two previous quarters gives 0.12.
- **Private fundraising is busy.** 10,291 new Form D notices in 2026 Q3, against 7,714 in 2023 Q4. Venture funds filed 2,464 and private equity funds 1,730.
- **BDC marks move slowly too.** Quarterly NAV changes of six of the seven BDCs have positive autocorrelation (0.19 to 0.65), the same sign of smoothing as the property indexes. With only 15 to 20 consecutive quarters each, it is a hint, not a test.

## Alternatives considered

- **Buy a private fund data licence.** Out of budget, and display rights would still be limited. A later decision if the product needs fund-level numbers.
- **Use listed proxies for returns** (listed private equity, BDC and REIT prices). Rejected for now: no free price source allows display. BDC NAVs from filings are the licence-clean substitute.
- **Unsmooth BDC NAVs.** Too few quarterly points in XBRL before about 2021 for most funds.

## Consequences

- The owner should set the `PARITY_CONTACT` repository variable (an email the SEC can reach). Until then the deployed pages show the FRED proxies and the study, and explain that the SEC data is waiting.
- The trial count does not change: nothing here is a strategy.
- `pm.*` series are revised (Z.1 and FHFA restate history), so any future strategy on them needs vintage data (ALFRED).
- The FHFA index is not seasonally adjusted; the study removes the calendar pattern, but anyone charting the raw series should know.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0012: Private markets, how they are measured and how individuals get in](../research/0012-private-markets-how-they-are-measured-and-how-individuals-get-in.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
<!-- backlinks:end -->
