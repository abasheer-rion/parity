---
id: REF-0004
title: Glossary
type: reference
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [economics, fx, kpis]
related: [REF-0002, RES-0004]
---

# Glossary

## In plain words

Every word in this project that sounds like jargon, explained three ways. **Simple** is how you would explain it to a ten year old. Open **Analogy** for an everyday comparison and **Precise definition** for the version an economist would write. The dashboard's Learn tab shows the same entries.

## Summary

75 terms in 6 groups. This page is generated from `docs/_system/glossary.json`; edit that file, not this one, then run `python3 scripts/docs.py index`.

| Group | Terms |
| --- | --- |
| [Markets and trading](#markets-and-trading) | [S&P 500](#sp-500), [ETF](#etf), [Total return (dividends reinvested)](#total-return-dividends-reinvested), [Long and short](#long-and-short), [Portfolio weight](#portfolio-weight), [Leverage](#leverage), [Rebalancing](#rebalancing), [Turnover](#turnover), [Spread (bid and ask)](#spread-bid-and-ask), [Transaction costs](#transaction-costs), [Basis point (bp)](#basis-point-bp) |
| [Currencies and interest rates](#currencies-and-interest-rates) | [Exchange rate](#exchange-rate), [Currency pair](#currency-pair), [G10 currencies](#g10-currencies), [Spot rate](#spot-rate), [Forward rate](#forward-rate), [Interest rate](#interest-rate), [Central bank](#central-bank), [FOMC](#fomc), [Carry](#carry), [Carry trade](#carry-trade) |
| [Commodities](#commodities) | [Terms of trade](#terms-of-trade), [Commodity](#commodity), [WTI and Brent](#wti-and-brent), [Henry Hub](#henry-hub), [Commodity currency](#commodity-currency) |
| [Economic theory](#economic-theory) | [Covered interest parity](#covered-interest-parity), [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip), [Purchasing power parity (PPP)](#purchasing-power-parity-ppp), [Real exchange rate](#real-exchange-rate), [Random walk](#random-walk), [Efficient market](#efficient-market), [Adaptive markets](#adaptive-markets), [Risk premium](#risk-premium), [Arbitrage](#arbitrage), [Momentum](#momentum), [Mean reversion](#mean-reversion), [Macro surprise](#macro-surprise), [Order flow](#order-flow), [Regime](#regime), [Alpha decay](#alpha-decay) |
| [Measuring results](#measuring-results) | [Benchmark](#benchmark), [Return](#return), [CAGR](#cagr), [Volatility](#volatility), [Volatility targeting](#volatility-targeting), [Sharpe ratio](#sharpe-ratio), [Sortino ratio](#sortino-ratio), [Drawdown](#drawdown), [Calmar ratio](#calmar-ratio), [Hit rate](#hit-rate), [Correlation](#correlation), [Beta](#beta), [Diversification](#diversification), [Excess return](#excess-return), [Information ratio](#information-ratio), [Negative skew](#negative-skew), [Fat tails](#fat-tails), [Break-even cost](#break-even-cost) |
| [Testing and statistics](#testing-and-statistics) | [Signal](#signal), [Information coefficient (IC)](#information-coefficient-ic), [IC decay](#ic-decay), [Backtest](#backtest), [Lookahead bias](#lookahead-bias), [Survivorship bias](#survivorship-bias), [Overfitting](#overfitting), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Out of sample (holdout)](#out-of-sample-holdout), [Deflated Sharpe ratio](#deflated-sharpe-ratio), [Bootstrap](#bootstrap), [Confidence interval](#confidence-interval), [Placebo test](#placebo-test), [p-value](#p-value), [t-statistic](#t-statistic), [Probability of backtest overfitting (PBO)](#probability-of-backtest-overfitting-pbo) |

## Markets and trading

### Basis point (bp)

**Simple:** One hundredth of one percent. 100 basis points is 1%.

<details><summary>Analogy</summary>

If 1% is a dollar, a basis point is one cent.

</details>

<details><summary>Precise definition</summary>

0.01%, or 0.0001 as a fraction. Used for small numbers like costs and interest rate changes.

</details>

Related: [Spread (bid and ask)](#spread-bid-and-ask)

### ETF

**Simple:** A fund you can buy like a single share, which holds lots of things inside it. SPY holds all the S&P 500 companies.

<details><summary>Analogy</summary>

A lunchbox with a bit of everything. You buy the box instead of each item one by one.

</details>

<details><summary>Precise definition</summary>

An exchange-traded fund. SPY is the oldest and largest S&P 500 ETF, trading since 1993.

</details>

Related: [S&P 500](#sp-500)

### Leverage

**Simple:** Using borrowed money to make your bets bigger. Wins get bigger, and so do losses.

<details><summary>Analogy</summary>

Riding a bike downhill. You go faster, and falling hurts more.

</details>

<details><summary>Precise definition</summary>

Gross exposure above 100% of capital. Volatility targeting in our backtester can lever a calm strategy up to 4 times to compare it with stocks at equal risk.

</details>

Related: [Volatility targeting](#volatility-targeting), [Portfolio weight](#portfolio-weight)

### Long and short

**Simple:** Long means you own something and win if its price goes up. Short means you bet against it and win if its price goes down.

<details><summary>Analogy</summary>

Long is buying a toy hoping it becomes rare. Short is borrowing a friend's toy, selling it now, and planning to buy it back cheaper later to give back.

</details>

<details><summary>Precise definition</summary>

A positive weight is a long position, a negative weight a short. In FX every position is long one currency and short another.

</details>

Related: [Portfolio weight](#portfolio-weight), [Currency pair](#currency-pair)

### Portfolio weight

**Simple:** How much of your money is in each thing you hold.

<details><summary>Analogy</summary>

How you split your pocket money between sweets, stickers and saving.

</details>

<details><summary>Precise definition</summary>

The position in an asset as a fraction of capital. Strategies in this repo only output target weights; the backtester turns them into returns.

</details>

Related: [Rebalancing](#rebalancing), [Leverage](#leverage)

### Rebalancing

**Simple:** Changing what you hold back to the plan, every week or month.

<details><summary>Analogy</summary>

Tidying your room on Sundays so it matches how you like it, even if it got messy during the week.

</details>

<details><summary>Precise definition</summary>

Trading to bring actual weights back to target weights on a schedule. More frequent rebalancing follows the signal more closely and costs more.

</details>

Related: [Turnover](#turnover), [Transaction costs](#transaction-costs)

### S&P 500

**Simple:** A list of about 500 of the biggest companies in the US. Its value is the usual way to say how the US stock market is doing.

<details><summary>Analogy</summary>

A giant basket with a slice of 500 big companies in it. If most of them do well, the basket gets heavier.

</details>

<details><summary>Precise definition</summary>

A market-capitalisation weighted US equity index. We use SPY, an ETF that tracks it, with dividends reinvested, as our benchmark.

</details>

Related: [ETF](#etf), [Benchmark](#benchmark), [Total return (dividends reinvested)](#total-return-dividends-reinvested)

### Spread (bid and ask)

**Simple:** The small gap between the price you can buy at and the price you can sell at. That gap is a cost every time you trade.

<details><summary>Analogy</summary>

A currency exchange booth at the airport buys dollars from you a bit cheaper than it sells them. The difference is how it makes money.

</details>

<details><summary>Precise definition</summary>

The difference between the best ask and the best bid. For major G10 pairs it is around 0.5 to 2 basis points for institutions, more for retail.

</details>

Related: [Transaction costs](#transaction-costs), [Basis point (bp)](#basis-point-bp)

### Total return (dividends reinvested)

**Simple:** Counting both the price going up and the extra cash payments companies give you, and pretending you used that cash to buy more.

<details><summary>Analogy</summary>

Your apple tree grows bigger and also drops apples. Total return counts the bigger tree plus planting the dropped apples.

</details>

<details><summary>Precise definition</summary>

Price return plus dividends, compounded. For the S&P 500 dividends add about 1.5 to 2 percent a year, so leaving them out makes the benchmark easier to beat than it really is.

</details>

Related: [S&P 500](#sp-500), [CAGR](#cagr)

### Transaction costs

**Simple:** Everything it costs to make a trade: the spread, fees and moving the price against yourself.

<details><summary>Analogy</summary>

The delivery fee on every online order. One order is fine, a hundred small orders add up.

</details>

<details><summary>Precise definition</summary>

We charge a fixed cost per unit of notional traded (1 basis point by default) and test at double that in the gauntlet. Real costs also include financing markups and slippage.

</details>

Related: [Spread (bid and ask)](#spread-bid-and-ask), [Turnover](#turnover), [Break-even cost](#break-even-cost)

### Turnover

**Simple:** How much buying and selling a strategy does.

<details><summary>Analogy</summary>

How many times you swap your trading cards in a year. Each swap has a small fee.

</details>

<details><summary>Precise definition</summary>

The sum of absolute weight changes. A turnover of 12 a year means trading the whole portfolio about once a month.

</details>

Related: [Transaction costs](#transaction-costs), [Break-even cost](#break-even-cost)

## Currencies and interest rates

### Carry

**Simple:** The interest you earn on the currency you hold minus the interest you pay on the one you borrowed to buy it.

<details><summary>Analogy</summary>

Borrowing money from a friend who charges you 1% and putting it in a bank that pays you 5%. The 4% gap is the carry, as long as nothing else changes.

</details>

<details><summary>Precise definition</summary>

The return a position earns if prices do not move. For a long foreign currency position funded in dollars, carry is roughly the foreign interest rate minus the US rate. Our backtester credits it daily.

</details>

Related: [Carry trade](#carry-trade), [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip), [Interest rate](#interest-rate)

### Carry trade

**Simple:** Borrowing in a currency with a low interest rate and putting the money in a currency with a high interest rate, to pocket the difference.

<details><summary>Analogy</summary>

Picking up coins in front of a steamroller. You collect a little almost every day, and once in a while you get flattened.

</details>

<details><summary>Precise definition</summary>

A long position in high-yield currencies funded by short positions in low-yield ones. It has paid on average but with large losses in risk-off episodes (Brunnermeier, Nagel and Pedersen, 2008). Tested in HYP-0001.

</details>

Related: [Carry](#carry), [Negative skew](#negative-skew), [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip)

### Central bank

**Simple:** The bank in charge of a country's money. It sets the main interest rate, like the Federal Reserve in the US.

<details><summary>Analogy</summary>

The referee who decides how expensive it is to borrow money in that country.

</details>

<details><summary>Precise definition</summary>

The institution that sets monetary policy, mainly through a short-term policy rate. Its decisions move interest rates and therefore exchange rates.

</details>

Related: [Interest rate](#interest-rate), [FOMC](#fomc)

### Currency pair

**Simple:** Two currencies traded against each other, like euros and dollars. Buying one always means selling the other.

<details><summary>Analogy</summary>

A seesaw. If one side goes up, the other side goes down.

</details>

<details><summary>Precise definition</summary>

A quote such as EUR/USD gives the price of the first (base) currency in the second (quote) currency. A long EUR/USD position gains when the euro rises against the dollar.

</details>

Related: [Exchange rate](#exchange-rate), [Long and short](#long-and-short)

### Exchange rate

**Simple:** How much of one country's money you get for another country's money. If 1 euro buys 1.12 US dollars, that is the exchange rate.

<details><summary>Analogy</summary>

Like swapping trading cards with a friend. Some days your card is worth two of theirs, some days only one, depending on how much people want each card.

</details>

<details><summary>Precise definition</summary>

The price of one currency in units of another. We store every rate as US dollars per one unit of the foreign currency, so a rising number means the foreign currency got stronger.

</details>

Related: [Currency pair](#currency-pair), [Spot rate](#spot-rate)

### FOMC

**Simple:** The group at the US central bank that meets eight times a year to decide US interest rates.

<details><summary>Analogy</summary>

A scheduled family meeting where the house rules for the next few months get decided. Everyone waits to hear the result.

</details>

<details><summary>Precise definition</summary>

The Federal Open Market Committee. Its scheduled announcements are among the biggest regular events for the dollar. See HYP-0006.

</details>

Related: [Central bank](#central-bank), [Macro surprise](#macro-surprise)

### Forward rate

**Simple:** An exchange rate agreed today for a swap that happens later.

<details><summary>Analogy</summary>

Booking a holiday now at a fixed price, even though you travel in three months.

</details>

<details><summary>Precise definition</summary>

The rate for delivery at a future date. By covered interest parity it equals the spot rate adjusted by the interest rate gap between the two currencies over that period.

</details>

Related: [Covered interest parity](#covered-interest-parity), [Spot rate](#spot-rate)

### G10 currencies

**Simple:** The ten most traded currencies in the world: US dollar, euro, Japanese yen, British pound, Swiss franc, Canadian dollar, Australian dollar, New Zealand dollar, Norwegian krone and Swedish krona.

<details><summary>Analogy</summary>

The big, busy shops on the main street. Lots of people trade there, so prices are fair and it is cheap to buy and sell.

</details>

<details><summary>Precise definition</summary>

The group of developed-market currencies with the deepest markets and tightest spreads. We use the nine non-dollar G10 currencies against the US dollar.

</details>

Related: [Spread (bid and ask)](#spread-bid-and-ask)

### Interest rate

**Simple:** What a bank pays you for keeping your money there, or what you pay to borrow. Every country's currency has its own interest rate.

<details><summary>Analogy</summary>

Rent for money. If you lend your money out, you get rent. If you borrow, you pay rent.

</details>

<details><summary>Precise definition</summary>

We use the 3-month interbank rate from the OECD for each currency: the rate banks charge each other to borrow for three months. It tracks the central bank's policy rate closely.

</details>

Related: [Carry](#carry), [Central bank](#central-bank)

### Spot rate

**Simple:** The exchange rate for swapping money right now.

<details><summary>Analogy</summary>

The price on the sticker today, as opposed to a price agreed for next month.

</details>

<details><summary>Precise definition</summary>

The rate for immediate delivery, which in FX means settlement two business days later.

</details>

Related: [Forward rate](#forward-rate), [Exchange rate](#exchange-rate)

## Commodities

### Commodity

**Simple:** A raw material that is the same no matter who sells it, like oil, natural gas, copper, wheat or gold.

<details><summary>Analogy</summary>

A barrel of oil is like a plain pencil: one is as good as another, so they all sell for the same price.

</details>

<details><summary>Precise definition</summary>

A standardised, interchangeable good traded on spot and futures markets. We use WTI and Brent crude, Henry Hub gas and copper prices from FRED.

</details>

Related: [WTI and Brent](#wti-and-brent), [Henry Hub](#henry-hub), [Commodity currency](#commodity-currency)

### Commodity currency

**Simple:** Money from a country that sells a lot of one raw material, so the currency goes up and down with that material's price. Canada and Norway with oil, Australia with metals, New Zealand with dairy.

<details><summary>Analogy</summary>

A lemonade stand's pocket money goes up in summer when lemonade sells well. The country's money is the pocket money, and the commodity is the lemonade.

</details>

<details><summary>Precise definition</summary>

A currency whose value is strongly linked to world prices of the issuing country's main exports (Chen and Rogoff, 2003). The link is strongest at short horizons and has changed since 2020 (Rees, 2025).

</details>

Related: [Terms of trade](#terms-of-trade), [Commodity](#commodity)

### Henry Hub

**Simple:** The main price for natural gas in the United States.

<details><summary>Analogy</summary>

The gas price everyone in the US checks, like the price on the big sign at the busiest petrol station.

</details>

<details><summary>Precise definition</summary>

The delivery point in Louisiana whose spot price is the benchmark for US natural gas. Not the European price, which matters more for Norway.

</details>

Related: [Commodity](#commodity)

### Terms of trade

**Simple:** How much a country gets for what it sells to other countries compared with what it pays for what it buys from them.

<details><summary>Analogy</summary>

If you sell lemonade and buy lemons, your terms of trade improve when lemonade prices go up or lemon prices go down.

</details>

<details><summary>Precise definition</summary>

The ratio of export prices to import prices. A rise tends to strengthen the currency, which is the economic basis for HYP-0003.

</details>

Related: [Commodity currency](#commodity-currency), [Commodity](#commodity)

### WTI and Brent

**Simple:** The two most common prices for crude oil. WTI is oil from the United States, Brent is oil from the North Sea near Norway and the UK.

<details><summary>Analogy</summary>

Two well-known brands of the same thing. They usually cost about the same and move together.

</details>

<details><summary>Precise definition</summary>

Benchmark crude grades. WTI (West Texas Intermediate) is priced at Cushing, Oklahoma; Brent is the global seaborne benchmark. WTI settled below zero on 2020-04-20 when storage ran out.

</details>

Related: [Commodity](#commodity), [Commodity currency](#commodity-currency)

## Economic theory

### Adaptive markets

**Simple:** The idea that markets have chances to win now and then, but they shrink once lots of people notice them.

<details><summary>Analogy</summary>

A secret fishing spot. It is great until your friends tell their friends.

</details>

<details><summary>Precise definition</summary>

Profit opportunities exist, attract capital and decay (Neely, Weller and Ulrich, 2009). Consistent with published FX factors losing most of their returns after publication.

</details>

Related: [Efficient market](#efficient-market), [Alpha decay](#alpha-decay)

### Alpha decay

**Simple:** When a way of making money stops working because too many people started doing it.

<details><summary>Analogy</summary>

A shortcut through the park is fast until everyone uses it and it gets crowded.

</details>

<details><summary>Precise definition</summary>

The erosion of a strategy's excess return as capital crowds in. Published equity anomalies lose about 58% after publication (McLean and Pontiff, 2016); published FX factors turned negative (Hutchinson et al., 2022).

</details>

Related: [Adaptive markets](#adaptive-markets)

### Arbitrage

**Simple:** Making money with no risk by buying something cheap in one place and selling it for more somewhere else at the same time.

<details><summary>Analogy</summary>

Buying a sticker for 10 cents at one table and selling it for 20 cents at the next table, right away.

</details>

<details><summary>Precise definition</summary>

A riskless profit from price differences. Real arbitrage opportunities are rare and close fast.

</details>

Related: [Covered interest parity](#covered-interest-parity)

### Covered interest parity

**Simple:** A rule that says you cannot make free money by borrowing in one currency and lending in another if you lock in the future exchange rate today.

<details><summary>Analogy</summary>

If two shops sell the same toy, and one shop also lets you return it later at a fixed price, the prices have to line up or everyone would game it.

</details>

<details><summary>Precise definition</summary>

The forward premium equals the interest rate differential, otherwise there is a riskless arbitrage. It holds closely in normal times, with small, persistent deviations since 2008.

</details>

Related: [Forward rate](#forward-rate), [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip), [Arbitrage](#arbitrage)

### Efficient market

**Simple:** The idea that prices already include everything people know, so you cannot consistently beat the market without taking extra risk.

<details><summary>Analogy</summary>

If a shop had a hidden discount, so many people would find it that it would be gone in minutes.

</details>

<details><summary>Precise definition</summary>

The efficient market hypothesis: prices reflect available information, so predictable excess returns either compensate for risk or do not exist after costs.

</details>

Related: [Adaptive markets](#adaptive-markets), [Risk premium](#risk-premium), [Random walk](#random-walk)

### Macro surprise

**Simple:** When economic news, like how many jobs were created, comes out very different from what experts expected.

<details><summary>Analogy</summary>

Expecting a B on a test and getting an A or a D. The surprise, not the grade, is what changes your mood.

</details>

<details><summary>Precise definition</summary>

The actual value of a data release minus the consensus forecast, usually scaled by its standard deviation. Surprises move currencies within minutes (Andersen, Bollerslev, Diebold and Vega, 2003). See HYP-0004.

</details>

Related: [FOMC](#fomc), [Order flow](#order-flow)

### Mean reversion

**Simple:** When something moves far from normal, it tends to come back toward normal.

<details><summary>Analogy</summary>

A stretched rubber band snaps back.

</details>

<details><summary>Precise definition</summary>

A tendency for deviations from a long-run level to shrink over time. PPP deviations mean revert slowly; our commodity gap strategy bets on a faster kind of catch-up.

</details>

Related: [Momentum](#momentum), [Purchasing power parity (PPP)](#purchasing-power-parity-ppp)

### Momentum

**Simple:** Things that have been going up tend to keep going up for a while, and things going down keep going down.

<details><summary>Analogy</summary>

A ball rolling downhill keeps rolling for a bit before it slows down.

</details>

<details><summary>Precise definition</summary>

Time-series momentum: an asset's own past return predicts its future return (Moskowitz, Ooi and Pedersen, 2012). Cross-sectional momentum: past winners beat past losers. Tested in HYP-0002.

</details>

Related: [Mean reversion](#mean-reversion), [Signal](#signal)

### Order flow

**Simple:** The net amount people are buying or selling. More buyers than sellers pushes the price up.

<details><summary>Analogy</summary>

If everyone at school suddenly wants the same sneakers, their price goes up, whatever the reason.

</details>

<details><summary>Precise definition</summary>

Signed transaction volume. Explains a large share of daily exchange rate moves (Evans and Lyons, 2002). Mostly not available to us for free.

</details>

Related: [Macro surprise](#macro-surprise)

### Purchasing power parity (PPP)

**Simple:** The idea that the same basket of things should cost about the same everywhere once you convert the money. If a burger is much cheaper in one country, its currency is probably too cheap.

<details><summary>Analogy</summary>

If lemonade costs 1 dollar on your street and 3 dollars on the next one, people would walk over and the prices would move closer.

</details>

<details><summary>Precise definition</summary>

Exchange rates converge toward the level that equalises price levels. Deviations are large and halve only every three to five years, so PPP is a weak short-run signal but a basis for currency value strategies.

</details>

Related: [Real exchange rate](#real-exchange-rate), [Mean reversion](#mean-reversion)

### Random walk

**Simple:** Something that moves up or down by chance each day, so yesterday's move tells you nothing about tomorrow's.

<details><summary>Analogy</summary>

Flipping a coin to decide whether to step left or right. Where you go next has nothing to do with where you came from.

</details>

<details><summary>Precise definition</summary>

A process whose changes are unpredictable. Meese and Rogoff (1983) found exchange rates are hard to forecast better than a random walk, which sets the bar for any currency strategy.

</details>

Related: [Efficient market](#efficient-market), [Mean reversion](#mean-reversion)

### Real exchange rate

**Simple:** The exchange rate after accounting for how expensive things are in each country.

<details><summary>Analogy</summary>

Not just how many coins you get, but how much candy those coins actually buy.

</details>

<details><summary>Precise definition</summary>

The nominal rate multiplied by the ratio of price levels. It is the measure PPP says should be stable over the long run.

</details>

Related: [Purchasing power parity (PPP)](#purchasing-power-parity-ppp)

### Regime

**Simple:** A period when markets behave in a particular way, like calm years, crisis years, or years of high interest rates.

<details><summary>Analogy</summary>

Seasons. What works in summer, like shorts, does not work in winter.

</details>

<details><summary>Precise definition</summary>

A stretch of time with distinct statistical behaviour. Strategies that only work in one regime are fragile. The gauntlet's era test checks three regimes separately.

</details>

Related: [Out of sample (holdout)](#out-of-sample-holdout)

### Risk premium

**Simple:** Extra money you get paid for taking a risk most people do not want.

<details><summary>Analogy</summary>

Getting paid more for a job that is sometimes unpleasant. The extra pay is there because someone has to do it.

</details>

<details><summary>Precise definition</summary>

Expected return in excess of the risk-free rate, earned for bearing risk that cannot be diversified away. One explanation for carry returns (Lustig, Roussanov and Verdelhan, 2011).

</details>

Related: [Carry trade](#carry-trade), [Efficient market](#efficient-market)

### Uncovered interest parity (UIP)

**Simple:** A theory that says a currency with a high interest rate should lose value by about as much as the extra interest, so on average you cannot win by chasing high rates. In real data, this mostly does not happen.

<details><summary>Analogy</summary>

A theory that the shop with the bigger discount will always run out of stock, so the discount never really helps you. In practice the discount often does help.

</details>

<details><summary>Precise definition</summary>

The expected change in the spot rate equals the interest differential. Empirically the coefficient is close to zero or negative (Fama, 1984), which is the forward premium puzzle and the reason carry trades have paid.

</details>

Related: [Carry](#carry), [Covered interest parity](#covered-interest-parity), [Risk premium](#risk-premium)

## Measuring results

### Benchmark

**Simple:** The thing you compare against. Ours is the S&P 500: if we cannot beat simply holding it, our strategy is not worth the effort.

<details><summary>Analogy</summary>

The time to beat in a race. Running fast means nothing unless you know what fast is.

</details>

<details><summary>Precise definition</summary>

A passive reference portfolio. Ours is SPY buy-and-hold with dividends and no costs, measured over exactly the same dates as each strategy. Defined in DEC-0006.

</details>

Related: [S&P 500](#sp-500), [Excess return](#excess-return)

### Beta

**Simple:** How much a strategy moves when the stock market moves. A beta of 1 moves just like the market, 0 ignores it.

<details><summary>Analogy</summary>

A small boat tied to a big ship. Beta is how much the small boat rocks when the ship rocks.

</details>

<details><summary>Precise definition</summary>

Covariance with the benchmark divided by the benchmark's variance.

</details>

Related: [Correlation](#correlation)

### Break-even cost

**Simple:** How expensive trading would have to be before the strategy stops making money.

<details><summary>Analogy</summary>

If you earn 5 dollars a week from your lemonade stand, the break-even cost is how high the rent can go before you earn nothing.

</details>

<details><summary>Precise definition</summary>

Average gross daily return divided by average daily turnover, in basis points. It should be several times real trading costs.

</details>

Related: [Transaction costs](#transaction-costs), [Turnover](#turnover)

### CAGR

**Simple:** The average yearly growth, as if your money grew by the same percent every year.

<details><summary>Analogy</summary>

If a plant grew from 10 cm to 40 cm in two years, CAGR says how much it grew each year on average, counting that it got bigger each year.

</details>

<details><summary>Precise definition</summary>

Compound annual growth rate: final value over starting value, to the power one over the number of years, minus one.

</details>

Related: [Return](#return), [Volatility](#volatility)

### Calmar ratio

**Simple:** Yearly growth divided by the worst fall. It asks: how much did you earn for the worst pain you went through?

<details><summary>Analogy</summary>

How good the holiday was compared with the worst day of it.

</details>

<details><summary>Precise definition</summary>

CAGR divided by the absolute maximum drawdown.

</details>

Related: [Drawdown](#drawdown), [CAGR](#cagr)

### Correlation

**Simple:** How much two things move together, from minus 1 (always opposite) through 0 (unrelated) to plus 1 (always together).

<details><summary>Analogy</summary>

Ice cream sales and sunny days have a high correlation. Ice cream sales and your shoe size have none.

</details>

<details><summary>Precise definition</summary>

Pearson correlation of daily returns. A strategy with low or negative correlation with the S&P 500 could improve a stock portfolio even if it earns less.

</details>

Related: [Beta](#beta), [Diversification](#diversification)

### Diversification

**Simple:** Not putting all your eggs in one basket, so one bad thing does not ruin everything.

<details><summary>Analogy</summary>

Bringing an umbrella and sunglasses. Whatever the weather, one of them helps.

</details>

<details><summary>Precise definition</summary>

Combining assets that are not perfectly correlated lowers portfolio volatility for the same expected return. The idea behind HYP-0007.

</details>

Related: [Correlation](#correlation)

### Drawdown

**Simple:** How far you have fallen from your highest point. The max drawdown is the worst fall ever.

<details><summary>Analogy</summary>

Climbing a hill and sliding back down part of it. The drawdown is how far you slid.

</details>

<details><summary>Precise definition</summary>

Equity divided by its running peak, minus one. The S&P 500 fell about 55% from 2007 to 2009.

</details>

Related: [Calmar ratio](#calmar-ratio), [Volatility](#volatility)

### Excess return

**Simple:** How much more (or less) the strategy made than the benchmark.

<details><summary>Analogy</summary>

How many seconds faster than the time to beat.

</details>

<details><summary>Precise definition</summary>

Strategy CAGR minus benchmark CAGR over the same dates. Only meaningful at comparable risk.

</details>

Related: [Benchmark](#benchmark), [Information ratio](#information-ratio)

### Fat tails

**Simple:** Very big moves happen more often than a simple bell curve says they should.

<details><summary>Analogy</summary>

Weather forecasts that say a huge storm happens once in a hundred years, and then two hit in a decade.

</details>

<details><summary>Precise definition</summary>

Excess kurtosis. The deflated Sharpe ratio corrects for it, because fat tails make an observed Sharpe less reliable.

</details>

Related: [Negative skew](#negative-skew), [Deflated Sharpe ratio](#deflated-sharpe-ratio)

### Hit rate

**Simple:** The share of days the strategy made money.

<details><summary>Analogy</summary>

How often you win at a game. You can win rarely and still come out ahead if your wins are big.

</details>

<details><summary>Precise definition</summary>

Fraction of non-zero daily returns that are positive.

</details>

Related: [Return](#return)

### Information ratio

**Simple:** How steadily the strategy beats the benchmark, not just by how much.

<details><summary>Analogy</summary>

A runner who beats the record by a little every single race versus one who wins big once and loses the rest.

</details>

<details><summary>Precise definition</summary>

Mean active return (strategy minus benchmark) divided by its standard deviation (tracking error), annualised.

</details>

Related: [Excess return](#excess-return)

### Negative skew

**Simple:** Lots of small wins and a few huge losses.

<details><summary>Analogy</summary>

Selling lemonade every day and then once a year a storm knocks over the whole stand.

</details>

<details><summary>Precise definition</summary>

A return distribution with a long left tail. Carry trades are negatively skewed (Daniel, Hodrick and Lu, 2017), which a Sharpe ratio alone hides.

</details>

Related: [Fat tails](#fat-tails), [Carry trade](#carry-trade)

### Return

**Simple:** How much money you made or lost, as a percent of what you started with.

<details><summary>Analogy</summary>

If you plant 10 seeds and end up with 11 plants, your return is 10%.

</details>

<details><summary>Precise definition</summary>

The percentage change in value over a period. We work with daily returns net of costs.

</details>

Related: [CAGR](#cagr)

### Sharpe ratio

**Simple:** How much money a strategy makes for each unit of bumpiness. Higher is better. Around 0.5 is what the stock market has done.

<details><summary>Analogy</summary>

Points scored per foul. A player who scores a lot but fouls all the time might not be your best player.

</details>

<details><summary>Precise definition</summary>

Mean return divided by the standard deviation of returns, annualised by the square root of 252. We use a zero risk-free rate for both strategy and benchmark.

</details>

Related: [Volatility](#volatility), [Deflated Sharpe ratio](#deflated-sharpe-ratio), [Sortino ratio](#sortino-ratio)

### Sortino ratio

**Simple:** Like the Sharpe ratio, but it only counts the bad bumps, the days you lose money.

<details><summary>Analogy</summary>

Judging a rollercoaster only by how scary the drops are, not by the climbs.

</details>

<details><summary>Precise definition</summary>

Mean return over downside deviation (root mean square of negative returns), annualised.

</details>

Related: [Sharpe ratio](#sharpe-ratio)

### Volatility

**Simple:** How bumpy the ride is. High volatility means big ups and downs.

<details><summary>Analogy</summary>

A calm lake versus a stormy sea. Both might get you across, one is a lot scarier.

</details>

<details><summary>Precise definition</summary>

The standard deviation of returns, annualised by multiplying daily volatility by the square root of 252. The S&P 500 has run at about 15 to 19% a year.

</details>

Related: [Sharpe ratio](#sharpe-ratio), [Volatility targeting](#volatility-targeting)

### Volatility targeting

**Simple:** Making bets bigger when markets are calm and smaller when they are wild, so the ride stays about equally bumpy.

<details><summary>Analogy</summary>

Driving faster on an empty straight road and slower on a winding one, so the trip feels the same.

</details>

<details><summary>Precise definition</summary>

Scaling positions by target volatility over recent realised volatility, using only past data. Lets us compare a calm currency strategy with stocks at the same risk.

</details>

Related: [Volatility](#volatility), [Leverage](#leverage)

## Testing and statistics

### Backtest

**Simple:** Pretending to run a strategy in the past to see how it would have done.

<details><summary>Analogy</summary>

Replaying an old football match with your new tactics on a video game. Useful, but the real match can go differently.

</details>

<details><summary>Precise definition</summary>

A historical simulation. Ours holds today's decision from tomorrow, charges costs, and credits carry. A backtest is evidence, never proof.

</details>

Related: [Lookahead bias](#lookahead-bias), [Overfitting](#overfitting)

### Bootstrap

**Simple:** Making many slightly jumbled copies of history to see how much a result could change by chance.

<details><summary>Analogy</summary>

Shuffling a deck of cards many times to see how often a good hand turns up.

</details>

<details><summary>Precise definition</summary>

Resampling the data with replacement. We use a moving block bootstrap (21-day blocks, 1,000 resamples) so calm and stormy stretches stay together.

</details>

Related: [Confidence interval](#confidence-interval)

### Confidence interval

**Simple:** A range where the true answer probably is. A 95% range means we would expect the true value inside it 95 times out of 100.

<details><summary>Analogy</summary>

Saying the bus will come between 8:05 and 8:15 instead of exactly 8:10.

</details>

<details><summary>Precise definition</summary>

An interval estimate. The gauntlet asks whether the 95% bootstrap interval for the Sharpe ratio lies entirely above zero.

</details>

Related: [Bootstrap](#bootstrap), [p-value](#p-value)

### Data snooping (multiple testing)

**Simple:** Trying so many ideas that one of them looks great just by luck.

<details><summary>Analogy</summary>

If 100 people each flip a coin 10 times, someone will get 9 heads. That person is not a coin-flipping genius.

</details>

<details><summary>Precise definition</summary>

Inflated significance from testing many hypotheses on the same data. Harvey, Liu and Zhu (2016) argue for a t-statistic hurdle near 3 instead of 2.

</details>

Related: [Overfitting](#overfitting), [Deflated Sharpe ratio](#deflated-sharpe-ratio), [t-statistic](#t-statistic)

### Deflated Sharpe ratio

**Simple:** A Sharpe ratio that is made harder to pass the more ideas we tried. It gives the chance, from 0 to 1, that the strategy is truly better than nothing. We want at least 0.95.

<details><summary>Analogy</summary>

If you take one shot and score, that is impressive. If you take 100 shots and score once, less so. This adjusts for the number of shots.

</details>

<details><summary>Precise definition</summary>

The probability that the true Sharpe exceeds the best Sharpe expected from N unskilled trials, adjusted for skew, kurtosis and sample length (Bailey and Lopez de Prado, 2014).

</details>

Related: [Sharpe ratio](#sharpe-ratio), [Data snooping (multiple testing)](#data-snooping-multiple-testing)

### IC decay

**Simple:** How long a signal's hint stays useful. Some hints are only good for a day, some for months.

<details><summary>Analogy</summary>

A weather forecast for tomorrow is good, one for next month much less so. Some clues fade fast, some slowly.

</details>

<details><summary>Precise definition</summary>

The information coefficient measured at several horizons. Where it peaks suggests how often to trade. Rising IC with horizon means trade slower.

</details>

Related: [Information coefficient (IC)](#information-coefficient-ic), [Rebalancing](#rebalancing)

### Information coefficient (IC)

**Simple:** How good the signal is at guessing what happens next. 0 means useless, 1 means perfect. In currency markets, 0.03 is already decent.

<details><summary>Analogy</summary>

How often the weather forecaster is right, beyond what you would get by guessing.

</details>

<details><summary>Precise definition</summary>

The rank correlation between the signal and the forward return across instruments on each date, averaged over time. We report it at 1, 5, 21 and 63 days ahead (IC decay).

</details>

Related: [Signal](#signal), [IC decay](#ic-decay)

### Lookahead bias

**Simple:** Accidentally using information from the future in a backtest. It makes results look much better than they could ever be.

<details><summary>Analogy</summary>

Betting on a race after you already saw the results.

</details>

<details><summary>Precise definition</summary>

Using data in a decision that was not available at the time, such as same-day closes, revised macro data, or full-sample estimates. Our backtester holds weights from the next day to prevent the most common form.

</details>

Related: [Backtest](#backtest), [Out of sample (holdout)](#out-of-sample-holdout)

### Out of sample (holdout)

**Simple:** Data you did not look at while designing the strategy, kept aside to test it fairly.

<details><summary>Analogy</summary>

A practice test the teacher keeps hidden until the end, so you cannot study the exact questions.

</details>

<details><summary>Precise definition</summary>

Observations excluded from model selection. Our gauntlet treats the last five years as the hardest test and checks three separate eras.

</details>

Related: [Overfitting](#overfitting), [Regime](#regime)

### Overfitting

**Simple:** Tuning a strategy so it fits the past perfectly, including the random parts, so it fails in the future.

<details><summary>Analogy</summary>

Memorising last year's test answers instead of learning the subject. Great score on last year's test, bad score on this year's.

</details>

<details><summary>Precise definition</summary>

Fitting noise rather than signal. The more settings and ideas tried, the more likely the best one is overfit. Countered by deflated statistics, holdout data and sensitivity tests.

</details>

Related: [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Deflated Sharpe ratio](#deflated-sharpe-ratio), [Out of sample (holdout)](#out-of-sample-holdout)

### p-value

**Simple:** The chance of seeing a result this good if the strategy was actually useless. Small is good. Below 0.05 is the usual bar.

<details><summary>Analogy</summary>

How surprised you should be. A friend guessing a coin flip once is not surprising. Ten times in a row is.

</details>

<details><summary>Precise definition</summary>

The probability, under a null hypothesis, of a statistic at least as extreme as the one observed. In the placebo test it is the share of random-date copies that do as well.

</details>

Related: [Placebo test](#placebo-test), [t-statistic](#t-statistic)

### Placebo test

**Simple:** Running a fake version of the strategy that cannot possibly know anything, to check the real one does better.

<details><summary>Analogy</summary>

In medicine, some people get a sugar pill. If they get better as often as people on the real pill, the pill does nothing.

</details>

<details><summary>Precise definition</summary>

We keep the strategy's positions but shift them to random dates 500 times, keeping size and trading but destroying timing. The real strategy should beat at least 95% of these.

</details>

Related: [p-value](#p-value)

### Probability of backtest overfitting (PBO)

**Simple:** An estimate of how likely it is that the best strategy in our tests will do worse than average on new data.

<details><summary>Analogy</summary>

How often the student who topped the practice test ends up below average on the real one.

</details>

<details><summary>Precise definition</summary>

From combinatorially symmetric cross-validation (Bailey, Borwein, Lopez de Prado and Zhu, 2016). On our roadmap.

</details>

Related: [Overfitting](#overfitting), [Deflated Sharpe ratio](#deflated-sharpe-ratio)

### Signal

**Simple:** The number a strategy uses to decide what to buy or sell, like a hint about the future.

<details><summary>Analogy</summary>

Dark clouds are a signal that it might rain. They are not always right, but they help.

</details>

<details><summary>Precise definition</summary>

A forecast score per instrument per day, before it is turned into weights. Strategies here can expose their signal so we can measure its information coefficient.

</details>

Related: [Information coefficient (IC)](#information-coefficient-ic)

### Survivorship bias

**Simple:** Only looking at the winners that are still around and forgetting the ones that disappeared.

<details><summary>Analogy</summary>

Saying all old buildings were built well, because the badly built ones already fell down.

</details>

<details><summary>Precise definition</summary>

Excluding assets that died, were delisted or redenominated. Small for G10 currencies, large for crypto and emerging markets.

</details>

Related: [Backtest](#backtest)

### t-statistic

**Simple:** How many times bigger a result is than the noise around it. Above 2 is the usual bar; finance researchers now ask for 3.

<details><summary>Analogy</summary>

Hearing a friend's voice across a noisy room. The louder their voice compared with the noise, the surer you are it is them.

</details>

<details><summary>Precise definition</summary>

An estimate divided by its standard error. Overlapping return windows make it look bigger than it really is.

</details>

Related: [p-value](#p-value), [Data snooping (multiple testing)](#data-snooping-multiple-testing)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0004: Docs follow strict rules that a script checks on every commit](../decisions/0004-docs-are-checked-by-a-script.md)
- [RES-0004: Exchange rate theory primer](../research/0004-exchange-rate-theory-primer.md)
- [GDE-0003: Writing and filing docs](../guides/0003-writing-docs.md)
- [REF-0006: The gauntlet](0006-the-gauntlet.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
- [ALG-0001: G10 currency carry (sorted on interest rates)](../algorithms/0001-fx-carry-g10.md)
- [ALG-0002: Carry with volatility targeting and crash protection](../algorithms/0002-fx-carry-volatility-timing.md)
- [ALG-0003: Rob Carver trend plus carry futures system (pysystemtrade)](../algorithms/0003-fx-carver-trend-carry.md)
- [ALG-0004: Commodity prices and terms of trade as a currency signal](../algorithms/0004-fx-commodity-terms-of-trade.md)
- [ALG-0005: FX cross-sectional momentum](../algorithms/0005-fx-cross-sectional-momentum.md)
- [ALG-0006: Dollar carry trade](../algorithms/0006-fx-dollar-carry.md)
- [ALG-0007: Economic momentum in currencies (Dahlquist and Hasseltoft 2020)](../algorithms/0007-fx-economic-momentum.md)
- [ALG-0008: Short the dollar on FOMC announcement days](../algorithms/0008-fx-fomc-dollar-announcement.md)
- [ALG-0009: London 4pm fix flow and reversal effects](../algorithms/0009-fx-london-4pm-fix.md)
- [ALG-0010: Trading FX on US macro announcement surprises](../algorithms/0010-fx-macro-news-surprise.md)
- [ALG-0011: Machine learning smart carry (Filippou, Rapach, Taylor, Zhou)](../algorithms/0011-fx-ml-smart-carry.md)
- [ALG-0012: Oil price to Canadian dollar daily link (Ferraro, Rogoff, Rossi)](../algorithms/0012-fx-oil-cad-daily.md)
- [ALG-0013: FX order flow signal](../algorithms/0013-fx-order-flow.md)
- [ALG-0014: FX technical trading rules (moving averages, filters, breakouts)](../algorithms/0014-fx-technical-trading-rules.md)
- [ALG-0015: FX time-series momentum (trend)](../algorithms/0015-fx-time-series-momentum.md)
- [ALG-0016: Fundamentals-adjusted currency value (Menkhoff et al. 2017)](../algorithms/0016-fx-value-adjusted.md)
- [ALG-0017: FX value (5-year real exchange rate reversal / PPP)](../algorithms/0017-fx-value-ppp.md)
- [ALG-0018: FX volatility risk premium sort](../algorithms/0018-fx-volatility-risk-premium.md)
- [ALG-0019: Pre-FOMC announcement drift](../algorithms/0019-pre-fomc-drift.md)
- [ALG-0020: Commodity gap (our own idea)](../algorithms/0020-parity-commodity-gap.md)
- [ALG-0021: Avellaneda-Stoikov market making (Hummingbot)](../algorithms/0021-avellaneda-stoikov-market-making.md)
- [ALG-0022: Crypto cash-and-carry basis trade (dated futures)](../algorithms/0022-crypto-cash-and-carry-basis.md)
- [ALG-0023: Crypto cross-sectional size and momentum factors (C-3 model)](../algorithms/0023-crypto-cross-sectional-factors.md)
- [ALG-0024: Crypto investor attention from Google search volume](../algorithms/0024-crypto-google-search-attention.md)
- [ALG-0025: Grid trading bot](../algorithms/0025-crypto-grid-trading-bot.md)
- [ALG-0026: Crypto perpetual futures funding-rate carry](../algorithms/0026-crypto-perp-funding-carry.md)
- [ALG-0027: Crypto time-series momentum (Liu and Tsyvinski)](../algorithms/0027-crypto-time-series-momentum.md)
- [ALG-0028: Deep reinforcement learning trading agents (FinRL)](../algorithms/0028-deep-rl-trading-finrl.md)
- [ALG-0029: Dollar-cost averaging (baseline)](../algorithms/0029-dollar-cost-averaging-baseline.md)
- [ALG-0030: FinBERT + GDELT news sentiment with XGBoost for FX and bonds](../algorithms/0030-finbert-gdelt-fx-sentiment.md)
- [ALG-0031: Gradient boosting on engineered features (G-Research crypto competition)](../algorithms/0031-gradient-boosting-engineered-features.md)
- [ALG-0032: LLM (ChatGPT) news headline sentiment](../algorithms/0032-llm-headline-sentiment.md)
- [ALG-0033: Deep sequence models (LSTM) for daily return direction](../algorithms/0033-lstm-sequence-models.md)
- [ALG-0034: Regularized ML return forecasts (elastic net, trees, neural nets; Gu Kelly Xiu)](../algorithms/0034-ml-return-prediction-elastic-net.md)
- [ALG-0035: Crowdsourced ML ensemble (Numerai meta model)](../algorithms/0035-numerai-crowdsourced-ensemble.md)
- [ALG-0036: Technical indicator bots (freqtrade, Zenbot sample strategies)](../algorithms/0036-technical-indicator-trading-bots.md)
- [ALG-0037: Betting against beta (low beta / low volatility)](../algorithms/0037-betting-against-beta.md)
- [ALG-0038: Commodity carry (roll yield / basis)](../algorithms/0038-commodity-carry-roll-yield.md)
- [ALG-0039: Commodity time-series momentum](../algorithms/0039-commodity-time-series-momentum.md)
- [ALG-0040: Dual momentum (Antonacci global equities momentum)](../algorithms/0040-dual-momentum.md)
- [ALG-0041: EIA weekly crude inventory surprise trading](../algorithms/0041-eia-oil-inventory-announcement.md)
- [ALG-0042: Cross-sectional equity momentum (winners minus losers)](../algorithms/0042-equity-cross-sectional-momentum.md)
- [ALG-0043: Managed futures trend following (diversified time-series momentum)](../algorithms/0043-managed-futures-trend-following.md)
- [ALG-0044: EIA weekly natural gas storage report trading](../algorithms/0044-natural-gas-storage-report.md)
- [ALG-0045: Pairs trading (distance method)](../algorithms/0045-pairs-trading-distance.md)
- [ALG-0046: Risk parity (inverse volatility asset allocation)](../algorithms/0046-risk-parity.md)
- [ALG-0047: Sell in May (Halloween indicator)](../algorithms/0047-sell-in-may-halloween.md)
- [ALG-0048: 60/40 stock and bond portfolio](../algorithms/0048-sixty-forty-portfolio.md)
- [ALG-0049: S&P 500 buy and hold](../algorithms/0049-sp500-buy-and-hold.md)
- [ALG-0050: Statistical arbitrage on PCA or ETF residuals (Avellaneda-Lee)](../algorithms/0050-stat-arb-pca-residuals.md)
- [ALG-0051: Combined trend and carry portfolio](../algorithms/0051-trend-plus-carry-combined.md)
- [ALG-0052: Turn-of-the-month effect](../algorithms/0052-turn-of-the-month.md)
- [ALG-0053: Value factor (Fama-French HML)](../algorithms/0053-value-hml.md)
- [ALG-0054: Volatility-managed portfolios (volatility targeting)](../algorithms/0054-volatility-managed-portfolios.md)
<!-- backlinks:end -->
