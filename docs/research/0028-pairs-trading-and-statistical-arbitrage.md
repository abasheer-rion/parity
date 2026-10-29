---
id: RES-0028
title: Pairs trading and statistical arbitrage, what the research says
type: research
status: current
created: 2026-10-26
updated: 2026-10-27
authors: [ayan]
tags: [data, method, strategy]
related: [DEC-0014, DEC-0015, DEC-0070, REF-0006]
---

# Pairs trading and statistical arbitrage, what the research says

## In plain words

Pairs trading bets on two prices that usually move together, such as Coca-Cola and PepsiCo. When one runs ahead of the other, you sell the leader and buy the laggard, and wait for the gap to close. Statistical arbitrage is the same idea spread over many stocks at once. It worked well in the 1960s to 1990s. Since then the profits have shrunk, mostly because many funds now do it and trading costs eat what is left. The biggest dangers are fooling yourself: picking pairs with hindsight, testing only companies that survived, and ignoring the cost of borrowing the stock you sell.

## Summary

- The distance method of Gatev, Goetzmann and Rouwenhorst pairs stocks whose normalised prices stayed closest over a year, then trades two standard deviation gaps for six months. On US stocks from 1962 to 1997 they report annual excess returns of up to 12% for portfolios of top pairs, partly from bid-ask bounce [@gatev1999; @gatev2006].
- Profits fell over time. Do and Faff find the simple rule much weaker after the late 1980s [@do2010]. After commissions, market impact and short-selling fees, they find about 30 basis points a month left for well matched pairs within refined industries, from 1963 to 2009 [@do2012].
- Cointegration asks a sharper question than closeness: does a fixed mix of the two prices stay put? Engle and Granger test the leftover of a regression for a unit root [@engle1987]; Johansen tests both prices at once [@johansen1991]. Critical values come from MacKinnon [@url-3465fab3; @mackinnon1999]. Vidyamurthy wrote the practitioner's guide [@url-12fa0e62], and Elliott, van der Hoek and Malcolm model the spread as a mean-reverting process [@elliott2005].
- The Ornstein-Uhlenbeck half-life (how many days a gap takes to halve, from an AR(1) fit of the spread) filters out pairs that revert too slowly to pay their costs.
- A Kalman filter lets the hedge ratio drift instead of fixing it at formation [@chan2013].
- Avellaneda and Lee trade each stock against the main principal components (or sector ETFs), fitting the leftover as an Ornstein-Uhlenbeck process and trading its s-score: open beyond 1.25, close near 0.5 to 0.75, skip stocks that revert slower than about 30 days. They report weaker results in the later years of their sample [@avellaneda2010].
- Krauss reviews the whole field: distance, cointegration, time series, stochastic control and machine learning approaches [@krauss2016].

## Pitfalls

| Pitfall | What goes wrong | What we do |
| --- | --- | --- |
| Selection look-ahead | Choosing pairs with data from the period you then trade | Pairs are chosen at each formation date from the past year only; a truncation test proves weights never change when later data is removed |
| Survivorship | Testing only today's listed companies, which flatters results | The industry portfolios include every listed firm each year; the stock lists are today's names and are labelled as such |
| Structural breaks | Mergers, spin-offs, bankruptcy or a new business model end a pair for good | A stop-out at four standard deviations and a time stop at three half-lives; a stopped pair is not reopened in that window |
| Borrow costs and recalls | Shorting costs a fee, more for hard-to-borrow names, and the lender can recall the stock [@davolio2002; @engelberg2018] | Every short leg pays a yearly borrow fee; cost sensitivity runs up to 200 basis points a year |
| Daily closes | The gap measured at the close may not be tradable at that price | Trades happen the day after the signal, at the next close, with a trading cost on every change |
| Crowding | In August 2007 many quant funds lost at once as one large fund unwound similar positions [@khandani2011] | Results are split by year and by market mood so crowded crashes show |
| Many tries | Testing many pairs and settings finds some that worked by luck | Every variation is counted in the deflated Sharpe [@bailey2014a] |

## What this means for Parity

We test four methods: distance, rolling cointegration with a half-life filter, Kalman hedge ratios and PCA residuals. Each picks its pairs at a formation date from past data only, trades for a fixed window, and pays trading costs and a borrow fee on short legs. Every variation, in the recipes and in the always-on search, counts toward the luck check. Results are in [DEC-0070](../decisions/0070-pairs-and-stat-arb-on-industries-with-stocks-research-only.md).

Our long history is French's 49 US industry portfolios, which have a public licence. Industry pairs are a coarser test than stock pairs: an industry average has less of the company-specific noise that pairs trading feeds on. Single stocks need a market data licence; ours (Alpaca) allows research use only, so pages show statistics derived from them, never prices.

### Single stocks, first run (27 October 2026)

The owner allowed the team's Alpaca key for research on 27 October. All 87 stock and ETF series were fetched (daily, adjusted, June 2016 to October 2026) and the five stock recipes and 24 named stock pairs went through the 11 tests and the luck check, counted with every other pairs variation (502 in all, 458 of them from the always-on search).

- Nothing passes the luck check. Every recipe's deflated Sharpe is 0.00.
- Best recipe: named stock pairs with a moving hedge (Kalman), Sharpe 0.39 after costs and borrow, 5 of 11 tests. Labelled "real but small": too small to rely on.
- The other four stock recipes lose money after costs (closest prices -0.91, all-sector cointegration -0.12, named pairs cointegrated -0.09, PCA leftovers -0.36).
- Named pairs on their own, cointegration rules: 10 of 24 made money. The best were XLY and Home Depot (0.89, 6 trades), Visa and Mastercard (0.74, 8 trades) and GM and Ford (0.73, 3 trades). Samples this small are luck until shown otherwise.
- Coca-Cola and PepsiCo, and UPS and FedEx, never traded: their gap never passed the cointegration test with a fast enough half-life.
- The two share-class pairs are the textbook "always cointegrated" cases (BRK.A and BRK.B p-value 0.001, half-life under a day; GOOGL and GOOG 0.03) and barely pay: BRK Sharpe 0.05, GOOGL and GOOG -0.98. Costs take the gap.

Survivorship applies: both stock lists are today's names. To rerun, put the Keychain keys `parity-alpaca-key-id` and `parity-alpaca-secret` into `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` for one process, run `parity fetch` on the `stk.*` keys, then `parity pairs report` and copy `engine/output/pairs.json` to `web/public/data/pairs.json`.

Sources: Engle and Granger [link](https://doi.org/10.2307/1913236); Johansen [link](https://doi.org/10.2307/2938278); MacKinnon critical values [link](https://www.econ.queensu.ca/sites/econ.queensu.ca/files/wpaper/qed_wp_1227.pdf); MacKinnon, Haug and Michelis [link](https://doi.org/10.1002/(SICI)1099-1255(199909/10)14:5%3C563::AID-JAE530%3E3.0.CO;2-R); Krauss [link](https://doi.org/10.1111/joes.12153); Elliott, van der Hoek and Malcolm [link](https://doi.org/10.1080/14697680500149370); D'Avolio [link](https://doi.org/10.1016/S0304-405X(02)00206-4); Engelberg, Reed and Ringgenberg [link](https://doi.org/10.1111/jofi.12601); Do and Faff 2012 [link](https://doi.org/10.1111/j.1475-6803.2012.01317.x); Vidyamurthy [link](https://www.wiley.com/en-us/Pairs+Trading%3A+Quantitative+Methods+and+Analysis-p-9780471460671).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@gatev1999](../REFERENCES.md#gatev1999): Gatev et al. (1999), Pairs Trading: Performance of a Relative Value Arbitrage Rule
- [@gatev2006](../REFERENCES.md#gatev2006): Gatev et al. (2006), Pairs Trading: Performance of a Relative-Value Arbitrage Rule
- [@do2010](../REFERENCES.md#do2010): Do and Faff (2010), Does Simple Pairs Trading Still Work?
- [@do2012](../REFERENCES.md#do2012): Do and Faff (2012), ARE PAIRS TRADING PROFITS ROBUST TO TRADING COSTS?
- [@engle1987](../REFERENCES.md#engle1987): Engle and Granger (1987), Co-Integration and Error Correction: Representation, Estimation, and Testing
- [@johansen1991](../REFERENCES.md#johansen1991): Johansen (1991), Estimation and Hypothesis Testing of Cointegration Vectors in Gaussian Vector Autoregressive Models
- [@url-3465fab3](../REFERENCES.md#url-3465fab3): MacKinnon (2010), Critical Values for Cointegration Tests
- [@mackinnon1999](../REFERENCES.md#mackinnon1999): MacKinnon et al. (1999), Numerical distribution functions of likelihood ratio tests for cointegration
- [@url-12fa0e62](../REFERENCES.md#url-12fa0e62): Vidyamurthy (2004), Pairs Trading: Quantitative Methods and Analysis
- [@elliott2005](../REFERENCES.md#elliott2005): Elliott et al. (2005), Pairs trading
- [@chan2013](../REFERENCES.md#chan2013): Chan (2013), Algorithmic Trading: Winning Strategies and Their Rationale
- [@avellaneda2010](../REFERENCES.md#avellaneda2010): Avellaneda and Lee (2010), Statistical arbitrage in the US equities market
- [@krauss2016](../REFERENCES.md#krauss2016): Krauss (2016), STATISTICAL ARBITRAGE PAIRS TRADING STRATEGIES: REVIEW AND OUTLOOK
- [@davolio2002](../REFERENCES.md#davolio2002): D'Avolio (2002), The market for borrowing stock
- [@engelberg2018](../REFERENCES.md#engelberg2018): Engelberg et al. (2018), Short-Selling Risk
- [@khandani2011](../REFERENCES.md#khandani2011): Khandani and Lo (2011), What happened to the quants in August 2007? Evidence from factors and transactions data
- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality

## Referenced by

- [DEC-0070: Pairs and stat arb on 49 industries, with single stocks research only](../decisions/0070-pairs-and-stat-arb-on-industries-with-stocks-research-only.md)
<!-- backlinks:end -->
