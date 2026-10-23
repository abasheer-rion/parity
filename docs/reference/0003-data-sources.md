---
id: REF-0003
title: Data sources
type: reference
status: current
created: 2026-10-20
updated: 2026-10-22
authors: [ayan]
tags: [commodities, data, fx]
related: [EXP-0001, REF-0001, REF-0015]
---

# Data sources

## In plain words

Where our data comes from. All of it is free: the US central bank's data website (FRED) for currencies, interest rates and oil, the European Central Bank, the US Treasury, the Bank for International Settlements and the US futures regulator. Yahoo is only a cross-check. [REF-0015](0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md) compares all this with what a Bloomberg terminal gives.

## Summary

Everything the engine uses is free. The list of series is in `engine/src/parity/data/catalog.py`, and this page explains where each comes from and what to watch out for. `parity fetch` downloads all of them in about two minutes. `parity data sources` shows every provider, whether it is on and whether it needs a key; `parity data series` lists every series.

## In use

| Key | Source | Code | Frequency | Since | Notes |
| --- | --- | --- | --- | --- | --- |
| `fx.EUR` to `fx.SEK` (9 G10 currencies) | FRED, Federal Reserve H.10 | `DEXUSEU`, `DEXJPUS`, and so on | Daily | 1971 (EUR 1999) | Noon New York buying rates. Stored as USD per unit of foreign currency. |
| `rate.<CCY>` (10 currencies) | FRED, OECD | `IR3TIB01<CC>M156N` | Monthly | Varies | 3-month interbank rate. Euro area and UK stop at 2026-01 at the time of writing. |
| `cmd.WTI`, `cmd.BRENT` | FRED, EIA | `DCOILWTICO`, `DCOILBRENTEU` | Daily | 1986, 1987 | WTI was negative on 2020-04-20. |
| `cmd.HH_GAS` | FRED, EIA | `DHHNGSP` | Daily | 1997 | Henry Hub natural gas. |
| `cmd.COPPER` | FRED, IMF | `PCOPPUSDM` | Monthly | 1992 | Too slow for daily signals. |
| `eq.US_MKT` | Kenneth French data library | `F-F_Research_Data_Factors_daily` | Daily | 1926 | US market total return, about two months behind. |
| `eq.US_TOTAL` | Built from the two rows above and below | | Daily | 1926 | Our benchmark ([DEC-0008](../decisions/0008-benchmark-data-without-yahoo.md)). |
| `eq.SPY` | Yahoo chart endpoint | `SPY` | Daily | 1993 | Cross-check only, never used in results. |
| `reer.<CCY>` (10) | FRED, BIS | `RB<CC>BIS` | Monthly | 1994 | Real effective exchange rates, for currency value. Used two months late to match publication. |
| `bond.UST10Y`, `rate.TBILL3M` | FRED | `DGS10`, `DTB3` | Daily | 1962, 1954 | US Treasury yields. |
| `eq.SPX` | FRED | `SP500` | Daily | Last 10 years only | Price only, no dividends. Kept as a cross-check. |
| `risk.VIX` | FRED, CBOE | `VIXCLS` | Daily | 1990 | For splitting results by market stress. |
| `fx.MXN` and 11 more (emerging and other currencies) | FRED, Federal Reserve H.10 | `DEXMXUS`, `DEXBZUS`, and so on | Daily | 1971 to 1995 | Optional. No matching interest rates, so no carry is booked on them ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)). |
| `bond.UST2Y`, `bond.UST30Y` | FRED | `DGS2`, `DGS30` | Daily | 1976, 1977 | Optional. The 30-year has a gap from 2002 to 2006. |
| `bond.TR10`, `bond.TR2` | Built from the yields | | Daily | 1962, 1976 | Treasury total return approximated from the yield with a fixed duration (8 and 1.9). 2022 comes out at -15%, close to real 7 to 10 year funds. |
| `factor.SMB`, `HML`, `MOM`, `RMW`, `CMA`, `STREV`, `LTREV` | Kenneth French data library | `<file>#<column>` | Daily | 1926 or 1963 | Optional. Paper long-short factor returns; the backtester charges an estimated yearly trading cost for holding each ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)). |
| `ind.<name>` (12 US industries) | Kenneth French data library | `12_Industry_Portfolios_daily#<name>` | Daily | 1926 | Optional. Value-weighted total return per industry. |
| `ecb.<CCY>` (29 currencies) | ECB Data Portal | `EXR/D.<CCY>.EUR.SP00.A` | Daily | 1999 | Optional. Units of the currency per euro, ECB reference rate. Reuse with the ECB named. |
| `curve.EA_AAA_3M` to `_30Y` (6) | ECB Data Portal | `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_<T>` | Daily | 2004 | Optional. Euro area AAA government spot yields. |
| `money.ESTR` | ECB Data Portal | `EST/B.EU000A2X2A25.WT` | Daily | 2019 | Optional. Euro overnight rate, used one business day late. |
| `curve.UST_1M` to `_30Y` (13) | US Treasury par yield curve | column name, such as `10 Yr` | Daily | 1990 | Optional. One request per year. Public domain. |
| `policy.<CCY>` (32 currencies) | BIS data portal | `WS_CBPOL/D.<area>` | Daily | 1946 to 2000 | Optional. Central bank policy rates. Reuse with the BIS named. |
| `cot.<NAME>` and `cot.<NAME>_PCT` (23 futures) | CFTC Commitments of Traders | contract code, such as `099741` | Weekly | 1986 | Optional. Speculators' net position in contracts and as a percent of open interest. Dated Tuesday, used 3 business days later. |
| `xfx.<CCY>` (27 currencies) | Built from ECB reference rates | `ecb.USD/ecb.<CCY>` | Daily | 1999 | Optional. USD per unit, crossed through the euro, for currencies that also have a BIS policy rate. Carry is the policy-rate gap ([DEC-0026](../decisions/0026-new-edge-families-from-the-wider-data.md)). |
| `bond.TR5` | Built from the Treasury par curve | `curve.UST_5Y` | Daily | 1990 | Optional. 5-year Treasury total return index, modified duration 4.5. |
| FOMC calendar | Federal Reserve meeting calendars | `engine/src/parity/data/fomc.py` | 8 a year | 1994 | Scheduled announcement days only, updated by hand each year. |
| `eia.<NAME>` (8) | EIA API v2 | old series ID, such as `PET.WCESTUS1.W` | Weekly | 1982 | Optional. Oil and gas stocks. Needs `EIA_API_KEY`; skipped without it. |
| `spread.*`, `infl.*`, `bond.TIPS*`, `usd.*`, `money.EFFR`, `money.CP3M_*` | FRED (Treasury, Federal Reserve) | `T10Y2Y`, `T5YIE`, `DFII10`, `DTWEXBGS`, `DFF`, `DCPF3M`, and so on | Daily | 1954 to 2006 | Optional. Each is tagged public domain or citation required on FRED. |
| `credit.HQM10Y` | FRED, Treasury HQM curve | `HQMCB10YR` | Monthly | 1984 | Optional. Licence-clean corporate yield, used a month late. |
| `risk.NFCI`, `risk.STLFSI`, `macro.CLAIMS`, `macro.WEI` | FRED (Chicago Fed, St. Louis Fed, Labor Department, NY Fed) | `NFCI`, `STLFSI4`, `ICSA`, `WEI` | Weekly | 1967 to 2008 | Optional. Moved to their release day. |
| `cmd.ALUMINIUM`, `NICKEL`, `IRON_ORE`, `WHEAT`, `CORN`, `SOYBEANS` | FRED, IMF | `PALUMUSDM` and so on | Monthly | 1992 | Optional. Used a week after the month ends, like copper. Not shown on the site, because the IMF asks for permission before commercial reuse. |

## FRED

We use the public CSV download link, which needs no key. It stalls for Python HTTP clients, so the engine calls the `curl` program to fetch it. Setting `FRED_API_KEY` switches to the official API, which is the better long-term route. A key is free at https://fred.stlouisfed.org/docs/api/api_key.html.

## Yahoo

The chart endpoint is unofficial and its terms forbid automated collection, so since [DEC-0008](../decisions/0008-benchmark-data-without-yahoo.md) it is only a cross-check. The Data health page compares it with our benchmark on every run.

## Tried and not used

| Source | Why not |
| --- | --- |
| Stooq | Now behind a browser check that blocks scripts. We do not work around it. |
| ICE BofA spreads and Moody's yields on FRED | Their owners forbid redistribution ([REF-0015](0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md)). |
| EIA refined product spot prices | EIA sources them from Refinitiv. |

## Candidates

| Source | What it would add | Cost |
| --- | --- | --- |
| Dukascopy and HistData | Tick and minute FX history, for intraday work. | Free downloads. Quality varies. |
| GDELT | Global news events and tone, for news signals. | Free. |
| OANDA practice API | Paper trading with real quotes. | Free practice account. |
| Kenneth French data library | Equity factor returns for cross-checks. | Free. |

## Markets data for the product

Crypto prices, perpetual futures, US ETFs and new fund filings for the product's Markets pages are kept apart from the research panel above. They live under `engine/src/parity/markets/` and `parity markets fetch`. Sources are CoinGecko, Hyperliquid's public API and SEC EDGAR, all free and optional. Their terms, and the exchanges we turned down, are in [REF-0014](0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md) and [DEC-0018](../decisions/0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md).

Add a source by adding a line to the catalog, a downloader if needed, a test for its parser, and a row here.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0001: Initial intent](../intent/0001-initial-intent.md)
- [DEC-0008: Measure the benchmark with Fama and French and FRED, not Yahoo](../decisions/0008-benchmark-data-without-yahoo.md)
- [DEC-0014: A strategy factory and an always-on search](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)
- [DEC-0018: Markets on the product side, crypto, perps, ETFs and what is new](../decisions/0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md)
- [DEC-0026: New edge families from the wider data](../decisions/0026-new-edge-families-from-the-wider-data.md)
- [EXP-0001: Baseline backtests of carry, trend and the commodity gap](../experiments/0001-baseline-backtests.md)
- [EXP-0002: The baseline gauntlet for carry, trend and the commodity gap](../experiments/0002-baseline-gauntlet.md)
- [RES-0005: Zenbot, similar apps and free data APIs](../research/0005-zen-apps-and-free-apis.md)
- [RES-0011: Where market edges come from and which survive](../research/0011-where-market-edges-come-from-and-which-survive.md)
- [REF-0001: Architecture](0001-architecture.md)
- [REF-0010: FX data sources, licences and resolution](0010-fx-data-sources-licences-and-resolution.md)
- [REF-0013: News sources and market impact](0013-news-sources-and-market-impact.md)
- [REF-0014: Markets data, crypto, perps and ETF sources and their terms](0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)
- [REF-0015: Getting close to Bloomberg data: sources, costs and licences](0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
<!-- backlinks:end -->
