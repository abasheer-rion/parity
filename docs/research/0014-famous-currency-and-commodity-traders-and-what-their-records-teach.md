---
id: RES-0014
title: Famous currency and commodity traders and what their records teach
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [amanda]
tags: [commodities, fx, method]
related: [RES-0006, RES-0009, RES-0012, RES-0013]
---

# Famous currency and commodity traders and what their records teach

## In plain words

We looked at the traders people tell stories about: the ones who made a billion in a day betting against a currency, and the ones who lost billions on gas or copper. Most of the winning stories are hard to check, and we only hear them because these people won; thousands who tried the same thing and lost are never written about. Still, a few patterns repeat in both the wins and the losses, and some of them can be turned into rules our program can test.

## Summary

We collected 17 well-known records from currency and commodity trading: 10 wins and 7 losses or collapses. For each we note how good the evidence is. The patterns that repeat:

1. **The biggest currency wins were bets against a fixed exchange rate under pressure** (Soros and Druckenmiller against the pound in 1992; Krieger against the New Zealand dollar in 1987). A peg can only break one way, so the loss if it holds is small and the gain if it breaks is large. These events are rare, so they cannot be tested statistically, but they can be watched for.
2. **The biggest losses came from leverage combined with selling insurance or holding positions too large to exit** (Amaranth in natural gas, Niederhoffer selling options, the Hunt brothers in silver, Sumitomo in copper, retail clients short the Swiss franc in 2015). The trades looked like steady income until the day they did not.
3. **Trend followers with strict loss limits survive; their returns are bumpy.** The Turtle rules, Dunn Capital and Paul Tudor Jones's stated rules all cut losing positions quickly. Dunn's record shows roughly 12% a year with about 31% volatility and a 60% drawdown, a Sharpe ratio near 0.4 to 0.5.
4. **Concentrated discretionary bets produce the widest outcomes.** Andurand's oil fund reportedly made 154%, 87% and 59% in 2020 to 2022, then lost 55% in 2023. Andy Hall was paid $100 million for one year's oil trading in 2008 and closed his fund after a 30% loss in 2017.
5. **Specialists with physical market knowledge** (Arnold from Enron, Hall from Phibro, Andurand from Goldman and Vitol) had information we cannot get from free data.
6. **The base rate is brutal.** 74% to 89% of retail CFD accounts lose money, 97% of persistent Brazilian day traders lost, and fewer than 1% of Taiwanese day traders were predictably profitable ([RES-0006](0006-courses-and-trader-beliefs.md), [RES-0009](0009-trading-myths-and-what-the-evidence-says.md)). Among professionals, currency managers earned about -1.1% a year once standard currency factors are accounted for [@pojarliev2008].
7. **Survivors are what we see.** Malkiel and Saha found hedge fund returns added to databases after the fact ("backfilled") averaged over 5 percentage points a year more than returns reported live, because funds join a database after good years ([Princeton working paper](https://swh.princeton.edu/~ceps/workingpapers/104malkiel.pdf)) [@malkiel2004].

The lessons that become testable rules for Parity are at the end, in [what this means for us](#what-this-means-for-us).

## How we graded the evidence

| Grade | What it means |
| --- | --- |
| A | Regulator, court, government report, company disclosure or peer-reviewed paper |
| B | Major press, an encyclopedia entry citing press, or a book interview |
| C | Trading blogs, fund aggregators, promotional pages; numbers often conflict |

Most famous-trader numbers are grade B or C. None of the private fund returns below is audited in anything we read.

## Wins

| Who | What | Result | Grade | Source |
| --- | --- | --- | --- | --- |
| George Soros and Stanley Druckenmiller, Quantum Fund | Short sterling before the UK left the ERM, 16 September 1992 | "Over 1 billion pounds in profit"; reported position about $10 billion. The UK Treasury later put its own cost at 3.3 billion pounds | B | [Wikipedia, Black Wednesday](https://en.wikipedia.org/wiki/Black_Wednesday) |
| Stanley Druckenmiller, Duquesne Capital | Macro, concentrated, 1986 to 2010 | "Average annual return of 30 percent without any money-losing year"; left Soros in 2000 after large tech stock losses | B | [Wikipedia, Stanley Druckenmiller](https://en.wikipedia.org/wiki/Stanley_Druckenmiller) |
| Andrew Krieger, Bankers Trust | Short the New Zealand dollar after the 1987 crash, partly through options | Reported profit of about $300 million for the bank; the kiwi fell several percent | C | [Techround](https://techround.co.uk/other/most-famous-currency-trades-all-time/) |
| Bill Lipschutz, Salomon Brothers | Currency options and spot, 1980s | Called Salomon's largest and most successful currency trader for eight years; earlier lost his whole first account through overleverage | B | Schwager, *The New Market Wizards* (1992), via [summary](https://www.turtletrader.com/bill-lipschultz) |
| Paul Tudor Jones, Tudor | Short stocks into the October 1987 crash | Fund "returned 125.9 percent after fees" in 1987 | B | [Wikipedia, Paul Tudor Jones](https://en.wikipedia.org/wiki/Paul_Tudor_Jones) |
| Bruce Kovner, Caxton | Macro, currencies and commodity futures | Reported 21% a year net over decades; first trade in soybeans nearly wiped him out | C | [Benzinga](https://www.benzinga.com/general/24/03/37833005/back-to-the-futures-how-bruce-kovner-used-currencies-and-commodities-to-build-his-hedge-fund) |
| Richard Dennis's Turtles | Trained novices to follow breakout and position-sizing rules, 1984 to 1988 | Group results reported between $100 million and $175 million; rules published by a participant | C | [TurtleTrader](https://www.turtletrader.com/winners-losers/); rules in catalog [ALG-0072](../algorithms/0072-turtle-donchian-breakout.md) |
| Dunn Capital, WMA program | Long-term systematic trend following since November 1984 | Compound return about 12% a year, volatility about 31%, worst drawdown -60% (2003 to 2007 or later; sources differ) | C | [Autumn Gold profile](https://autumngold.com/Advisor/cta_profile.php?id=393) (pro forma, includes notional funds) |
| John Arnold, Centaurus Energy | Natural gas, often on the other side of Amaranth in 2006 | Large 2006 gains; figures circulating (for example 317%) are unsourced | C | [Next Finance](https://www.next-finance.net/John-Arnold-The-natural-gas-guru) |
| Pierre Andurand, Andurand Capital | Concentrated oil bets "with no set risk limits" | Reported +154% (2020), +87% (2021), +59% (2022), then -55% (2023) | B | [Hedgeweek](https://www.hedgeweek.com/andurands-riskiest-hedge-fund-up-20-after-record-loss-in-2023/), [Quantum Commodity Intelligence](https://qcintel.com/article/andurand-hedge-fund-slumps-55-in-2023-on-lower-oil-prices-20946.html) |

## Losses and collapses

| Who | What | Result | Grade | Source |
| --- | --- | --- | --- | --- |
| Amaranth Advisors (Brian Hunter) | Very large natural gas futures positions; press reports describe the biggest as a bet on the gap between March and April 2007 contracts | Lost "in excess of $6 billion" in September 2006 from $9.2 billion of assets; the US Senate investigations subcommittee called it "excessive speculation" (June 2007) | A/B | [Wikipedia, Amaranth Advisors](https://en.wikipedia.org/wiki/Amaranth_Advisors) |
| Sumitomo Corporation (Yasuo Hamanaka) | Ten years of unauthorized copper trading; controlled 93% of LME copper warrants in November 1995 | $2.6 billion of losses; eight years in prison | A/B | [Wikipedia, Sumitomo copper affair](https://en.wikipedia.org/wiki/Sumitomo_copper_affair) |
| Hunt brothers | Leveraged attempt to corner silver, 1979 to 1980 | Silver peaked at $48.70 in January 1980 and roughly halved on 27 March 1980 when they missed margin calls; a later court ordered over $130 million in damages | B | [Britannica](https://www.britannica.com/print/article/2090145), [APMEX](https://learn.apmex.com/learning-guide/history/silver-thursday-the-hunt-brothers-scheme/) |
| Victor Niederhoffer | Concentrated Thai bank stocks, then selling S&P 500 put options, 1997; again in 2007 | Fund wiped out in October 1997; flagship fund closed in 2007 | B | [Euromoney](https://www.euromoney.com/article/b1320fcs67s11y/a-speculators-latest-lesson) |
| Retail clients and FX brokers, Swiss franc, 15 January 2015 | Short franc positions at high leverage against the Swiss central bank's 1.20 floor | The franc rose more than 30% at one point; FXCM had a client shortfall above $225 million and needed a $300 million rescue loan; Alpari UK filed for insolvency | A | [Congressional Research Service](https://www.everycrsreport.com/files/20150211_IN10230_fbd6178a37df59924423af5f8ec3545533730cb8.html) |
| FX Concepts (John Taylor) | World's largest currency hedge fund, systematic and discretionary | About $14 billion at its 2007 peak, closed in 2013; Reuters, citing BIS data, put quant currency fund assets at about $35 billion in 2008 and $6 billion in 2013 | B | [CNBC](https://www.cnbc.com/2013/10/07/this-once-14b-hedge-funds-future-is-in-doubt.html), [Euromoney](https://www.euromoney.com/?p=66955) |
| Andy Hall, Astenbeck Capital | Long-term bullish oil view; formerly Phibro, where Citigroup disclosed his $100 million pay for 2008 | Main fund lost almost 30% in the first half of 2017 and closed | B | [Wikipedia, Andrew Hall](https://en.wikipedia.org/wiki/Andrew_Hall_(hedge_fund_manager)), [Institutional Investor](https://www.institutionalinvestor.com/article/2bsvvqs6ph9xpipkxoef4/portfolio/the-morning-brief-hall-reportedly-shutting-his-commodities-fund) |

## Patterns

### 1. Pegs and policy breaks

The two biggest single currency wins (1992 sterling, 1987 kiwi) and one of the biggest retail disasters (2015 franc) all came from a central bank defending a price. The winners were on the side the peg would break toward. The losers were on the side that collected small, steady gains while it held. The pattern repeats in the EM crisis list in [RES-0012](0012-emerging-market-currencies.md#what-happened-after-the-papers).

Testable? Barely. There are maybe 20 such breaks in our data period, too few for statistics. What we can do is make sure our strategies are not on the "steady small gains" side of a peg without knowing it. Carry trades into pegged currencies are exactly that.

### 2. Selling insurance and holding what you cannot exit

Amaranth, Niederhoffer, the Hunts, Sumitomo and the franc shorts were all in positions that earned steadily or looked safe until the market moved further than they could absorb, at a size the market could not take back. Two things made each loss fatal: leverage and illiquidity.

This is the warning label on two ideas in [RES-0013](0013-commodity-futures-carry-trend-and-volatility.md): selling commodity volatility and EM carry. Both earn a premium for taking this risk. Our tests must show the worst month, not only the average.

### 3. Trend following with hard loss limits

The traders who lasted longest in commodities followed trends and cut losses: the Turtles' rules size every position so that a typical day's move costs about 1% of the account, and exit on a fixed breakout. Dunn shows what that looks like over 40 years: about a 12% yearly return, about 31% volatility, and a 60% drawdown along the way. That is the "more volatility" route made real, and its Sharpe ratio (about 0.4 to 0.5) is no better than the stock market's.

### 4. Size and concentration

Druckenmiller has said, in many retellings, that Soros taught him to bet big when sure. Andurand's reported record (+154%, +87%, +59%, -55%) shows the other half of that lesson. Big sizing makes a skilled trader rich faster and a wrong one poor faster. For a backtest it means nothing on its own: our A2 test already sizes everything to the same risk.

### 5. Information we do not have

Arnold, Hall and Andurand came from Enron, Phibro and Vitol, firms that move physical oil and gas. They saw storage, shipping and customer flows before the public did. We cannot copy that with free data. The closest free signals are the weekly EIA storage and inventory reports, which the catalog already lists ([ALG-0041](../algorithms/0041-eia-oil-inventory-announcement.md), [ALG-0044](../algorithms/0044-natural-gas-storage-report.md)).

### 6. Survivorship

Every winner above was chosen because they won. FX Concepts and Astenbeck were famous winners for years before they closed. Malkiel and Saha's finding that backfilled hedge fund returns beat live ones by over 5 points a year is the same effect in numbers. Copying a famous trader's style is copying a sample of one, picked after the fact.

## What this means for us

1. **Report the worst month and the worst week for every strategy, next to its average.** Most of the disasters above looked fine on averages.
2. **Charge realistic costs and cap position size for thin markets.** For EM currencies and natural gas, our flat 1 basis point is too generous.
3. **Close positions at a penalty when a market stops trading** (RUB 2022) instead of freezing them at the last price.
4. **Treat selling volatility and carry as insurance businesses.** Test them, but judge them on how they do in the stock market's worst months (test B5), not only on Sharpe.
5. **Trend following with volatility-based position sizing is the one trader method with both a public rule set and decades of independent evidence.** We already test it on currencies; the energy futures version is next ([RES-0013](0013-commodity-futures-carry-trend-and-volatility.md#what-this-means-for-us)).
6. **Do not add "copy a legend" strategies to the catalog.** None of these records is a rule anyone could have followed in advance.

## What we could not verify

- Every private fund return above is unaudited. Andurand's and Arnold's numbers come from anonymous sources quoted in the press.
- The Krieger and Turtle profit figures disagree across sources by large amounts.
- We did not read the June 2007 Senate report on Amaranth itself, only references to it.
- Quotes attributed to Druckenmiller, Jones and Kovner on trading rules come from interviews retold by others; we have not traced them to the original interviews.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@pojarliev2008](../REFERENCES.md#pojarliev2008): Pojarliev and Levich (2008), Do Professional Currency Managers Beat the Benchmark?
- [@malkiel2004](../REFERENCES.md#malkiel2004): Malkiel and Saha (2004), Hedge Funds: Risk and Return

## Referenced by

- [HYP-0014: Selling oil volatility pays a premium](../hypotheses/0014-selling-oil-volatility-pays-a-premium.md)
- [EXP-0009: Oil volatility and commodity currency signals](../experiments/0009-oil-volatility-and-commodity-currency-signals.md)
- [RES-0013: Commodity futures, carry, trend and volatility](0013-commodity-futures-carry-trend-and-volatility.md)
- [RES-0015: Lesser-known strategies and what firms have published](0015-lesser-known-strategies-and-what-firms-have-published.md)
- [LOG-0009: Emerging markets, energy futures and the next official runs](../log/2026-10-22-emerging-markets-energy-futures-and-the-next-official-runs.md)
<!-- backlinks:end -->
