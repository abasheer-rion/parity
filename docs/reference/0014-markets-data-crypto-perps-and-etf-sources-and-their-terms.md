---
id: REF-0014
title: Markets data, crypto, perps and ETF sources and their terms
type: reference
status: current
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [crypto, data]
related: [DEC-0018, DEC-0019, REF-0003, DEC-0015]
---

# Markets data, crypto, perps and ETF sources and their terms

## In plain words

The product's Markets pages show crypto prices, perpetual futures, US ETFs and what is newly filed or trending. This page says where each number comes from, what the provider's terms let us do with it, and which sources we turned down. We read every provider's terms on 22 October 2026. Most exchanges forbid showing their data on someone else's site, so the choice was narrow.

## Summary

| What | Source | Key | Display on our site | Stored how |
| --- | --- | --- | --- | --- |
| Crypto prices, 100 largest coins | CoinGecko public API | None | Yes, with "Data provided by CoinGecko" linked next to the data | Replaced on every fetch, at least every 24 hours |
| One year of daily prices, 12 major coins | CoinGecko `market_chart` | None | Yes, same attribution | Replaced on every fetch |
| Trending coins | CoinGecko `search/trending` | None | Yes, same attribution | Replaced on every fetch |
| Perp funding, open interest, leverage | Hyperliquid public info API | None | Undecided ("ask"), see below | Snapshots kept 90 days, funding 1 year |
| US ETF universe | SEC series and class list, SEC company tickers | None, contact in user agent | Yes, public information | Replaced, each ticker keeps the date we first saw it |
| New fund filings (N-1A, 485APOS, S-1) | SEC EDGAR full-text search | None, contact in user agent | Yes, public information | Kept 1 year |

Commands: `parity markets fetch` (skips sources fetched recently), `parity markets status`, `parity markets export DIR`. Code: `engine/src/parity/markets/`. Tests use saved responses in `engine/tests/fixtures/markets/` and never touch the network.

## CoinGecko

- Endpoints: `/api/v3/coins/markets`, `/coins/{id}/market_chart?days=365&interval=daily`, `/search/trending`. All work without a key.
- Without a key, history stops at 365 days. A request for 400 days returns 401 with "Public API users are limited to querying historical data within the past 365 days".
- New listings (`/coins/list/new`) are for paid plans only, so "new coins" on our page means trending coins, not new listings.
- Terms (https://www.coingecko.com/en/api_terms, updated 5 September 2025): display is allowed with attribution such as "Data provided by CoinGecko" linked to coingecko.com, near the data. Reselling or redistributing API access is not allowed. The terms discourage caching and storing data and ask that caches are refreshed at least every 24 hours. That is why we overwrite CoinGecko tables instead of building an archive.
- Pricing: https://www.coingecko.com/en/api/pricing.

## Hyperliquid

- Endpoint: `POST https://api.hyperliquid.xyz/info` with `{"type": "metaAndAssetCtxs"}` for every perp, and `{"type": "fundingHistory"}` for hourly funding. About 1,200 request weight a minute per address.
- Funding is paid every hour and capped at 4% an hour; a fixed interest part of 0.01% per eight hours means a quiet market shows about 10.95% a year (https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding).
- Liquidation happens when account equity falls below maintenance margin, 1.25% to 16.7% of position value by asset (https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations).
- Terms (https://app.hyperliquid.xyz/terms, 15 June 2026) have no clause about reusing data. They close the app to "Restricted Persons", which includes US residents. Whether that covers reading the public API is unclear. The export marks the source "ask", and `parity markets export --no-ask` leaves it out. DEC-0018 asks the owner to decide.

## SEC EDGAR

- The yearly investment company series and class list (https://www.sec.gov/files/investment/data/other/investment-company-series-class-information/investment-company-series-class-2026.csv) gives every fund share class with a ticker. We keep a class when its series, class or company name says ETF, plus a few sponsors whose ETFs do not (ProShares, Invesco QQQ, SPDR). This is a name rule, not an official ETF flag.
- Exchange-listed trusts such as spot bitcoin ETFs and gold trusts are not 1940 Act funds, so they come from https://www.sec.gov/files/company_tickers_exchange.json, kept when the name says ETF, bitcoin, ether and similar, and not Inc or Corp.
- New filings come from EDGAR full-text search (`https://efts.sec.gov/LATEST/search-index?forms=N-1A`), for forms N-1A (a new fund company), 485APOS (a new fund or a big change at an existing company) and S-1 (a trust registering shares, the route for spot crypto ETFs). S-1 is also how companies go public, so S-1 filers named Inc, Corp or Co are dropped.
- Rules: at most 10 requests a second and a user agent that names a contact (https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data). The engine adds `PARITY_CONTACT` to its user agent and skips SEC sources when it is not set. A generic project URL was refused with 403 in testing; an email address worked.
- Information on sec.gov is public and may be copied or distributed; the SEC asks to be cited (https://www.sec.gov/privacy).

## Turned down

| Source | Why |
| --- | --- |
| Coinbase Exchange market data | Its market data terms forbid apps for other users and any display to third parties (https://www.coinbase.com/legal/market_data). |
| Kraken public OHLC | Its terms forbid making content available to third parties or building apps on it without consent (https://www.kraken.com/legal/global-terms). Also only about two years of daily candles. |
| Deribit | Market data is for personal use only; publishing is not allowed. |
| OKX | API agreement reported as personal, non-commercial use only. Wording not confirmed, so treated as forbidden. |
| Bybit | Blocks US addresses (HTTP 403). |
| Binance | The live API blocks US addresses (HTTP 451). The bulk files are licensed for non-commercial use. |
| Nasdaq Trader symbol directory | Has an ETF flag, but its terms allow one personal, non-commercial copy only. |

## Keys the owner might want

None are needed today. We did not sign up for anything.

| Key | Plan | Cost | What it adds |
| --- | --- | --- | --- |
| CoinGecko Demo key | Free Demo plan | Free | A stable 100 calls a minute and 10,000 a month instead of the shared keyless limit. Same one year of history. |
| CoinGecko paid plan | Any paid plan | Monthly fee, see the pricing page | Longer history, new listings, commercial terms in writing. |
| An ETF price feed | To be chosen | Unknown | ETF prices for practice positions. Today the user types the price because no free feed we checked allows display. |

## Glossary sources

The "New products and hype terms" entries in the glossary cite these:

- He, Manela, Ross and von Wachter, Fundamentals of Perpetual Futures, https://arxiv.org/abs/2212.06888
- CFTC glossary, open interest, https://www.cftc.gov/LearnAndProtect/EducationCenter/CFTCGlossary/index.htm
- SEC staff statement on meme coins, 27 February 2025, https://www.sec.gov/newsroom/speeches-statements/staff-statement-meme-coins
- IRS Revenue Ruling 2019-24 on airdrops after a hard fork, https://www.irs.gov/pub/irs-drop/rr-19-24.pdf
- Ethereum proof-of-stake rewards and penalties, https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/
- SEC statement on certain protocol staking activities, 29 May 2025, https://www.sec.gov/newsroom/speeches-statements/statement-certain-protocol-staking-activities-052925
- EigenLayer contracts and restaking overview, https://github.com/Layr-Labs/eigenlayer-contracts
- BIS Annual Economic Report 2025, chapter III, on stablecoins and tokenisation, https://www.bis.org/publ/arpdf/ar2025e3.htm
- SEC Chair statement on spot bitcoin exchange-traded products, 10 January 2024, https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023
- Israelov and Nielsen, Covered Calls Uncovered, https://doi.org/10.2469/faj.v71.n6.1
- Cboe on 0DTE options, https://www.cboe.com/tradable-products/0dte
- FINRA Regulatory Notice 09-31 on leveraged and inverse ETFs, https://www.finra.org/rules-guidance/notices/09-31
- Innovator on defined outcome ETFs, https://www.innovatoretfs.com/define/
- Wolfers and Zitzewitz, Prediction Markets, https://doi.org/10.1257/0895330041371321
- CFTC proposal on event contracts, 10 May 2024, https://www.cftc.gov/PressRoom/PressReleases/8907-24
- Ben-David, Franzoni, Kim and Moussawi, Competition for Attention in the ETF Space, https://doi.org/10.1093/rfs/hhac048
- Investor.gov glossary, expense ratio, https://www.investor.gov/introduction-investing/investing-basics/glossary/expense-ratio
- Investor.gov glossary, net asset value, https://www.investor.gov/introduction-investing/investing-basics/glossary/net-asset-value

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0018: Markets on the product side, crypto, perps, ETFs and what is new](../decisions/0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md)
- [REF-0003: Data sources](0003-data-sources.md)
<!-- backlinks:end -->
