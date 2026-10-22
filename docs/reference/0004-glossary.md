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

292 terms in 14 groups. This page is generated from `docs/_system/glossary.json`; edit that file, not this one, then run `python3 scripts/docs.py index`.

| Group | Terms |
| --- | --- |
| [Markets and trading](#markets-and-trading) | [S&P 500](#sp-500), [ETF](#etf), [Total return (dividends reinvested)](#total-return-dividends-reinvested), [Long and short](#long-and-short), [Portfolio weight](#portfolio-weight), [Leverage](#leverage), [Rebalancing](#rebalancing), [Turnover](#turnover), [Spread (bid and ask)](#spread-bid-and-ask), [Transaction costs](#transaction-costs), [Basis point (bp)](#basis-point-bp) |
| [Currencies and interest rates](#currencies-and-interest-rates) | [Exchange rate](#exchange-rate), [Currency pair](#currency-pair), [G10 currencies](#g10-currencies), [Spot rate](#spot-rate), [Forward rate](#forward-rate), [Interest rate](#interest-rate), [Central bank](#central-bank), [FOMC](#fomc), [Carry](#carry), [Carry trade](#carry-trade) |
| [Commodities](#commodities) | [Terms of trade](#terms-of-trade), [Commodity](#commodity), [WTI and Brent](#wti-and-brent), [Henry Hub](#henry-hub), [Commodity currency](#commodity-currency) |
| [Economic theory](#economic-theory) | [Covered interest parity](#covered-interest-parity), [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip), [Purchasing power parity (PPP)](#purchasing-power-parity-ppp), [Real exchange rate](#real-exchange-rate), [Random walk](#random-walk), [Efficient market](#efficient-market), [Adaptive markets](#adaptive-markets), [Risk premium](#risk-premium), [Arbitrage](#arbitrage), [Momentum](#momentum), [Mean reversion](#mean-reversion), [Macro surprise](#macro-surprise), [Order flow](#order-flow), [Regime](#regime), [Alpha decay](#alpha-decay) |
| [Measuring results](#measuring-results) | [Benchmark](#benchmark), [Return](#return), [CAGR](#cagr), [Volatility](#volatility), [Volatility targeting](#volatility-targeting), [Sharpe ratio](#sharpe-ratio), [Sortino ratio](#sortino-ratio), [Drawdown](#drawdown), [Calmar ratio](#calmar-ratio), [Hit rate](#hit-rate), [Correlation](#correlation), [Beta](#beta), [Diversification](#diversification), [Excess return](#excess-return), [Information ratio](#information-ratio), [Negative skew](#negative-skew), [Fat tails](#fat-tails), [Break-even cost](#break-even-cost) |
| [Testing and statistics](#testing-and-statistics) | [Signal](#signal), [Information coefficient (IC)](#information-coefficient-ic), [IC decay](#ic-decay), [Backtest](#backtest), [Lookahead bias](#lookahead-bias), [Survivorship bias](#survivorship-bias), [Overfitting](#overfitting), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Out of sample (holdout)](#out-of-sample-holdout), [Deflated Sharpe ratio](#deflated-sharpe-ratio), [Bootstrap](#bootstrap), [Confidence interval](#confidence-interval), [Placebo test](#placebo-test), [p-value](#p-value), [t-statistic](#t-statistic), [Probability of backtest overfitting (PBO)](#probability-of-backtest-overfitting-pbo) |
| [Candlesticks and chart patterns](#candlesticks-and-chart-patterns) | [Technical analysis](#technical-analysis), [Candlestick](#candlestick), [OHLC bar](#ohlc-bar), [Candle body](#candle-body), [Candle wick](#candle-wick), [Bullish and bearish candles](#bullish-and-bearish-candles), [Doji](#doji), [Spinning top](#spinning-top), [Marubozu](#marubozu), [Hammer](#hammer), [Hanging man](#hanging-man), [Shooting star](#shooting-star), [Inverted hammer](#inverted-hammer), [Engulfing pattern](#engulfing-pattern), [Harami](#harami), [Morning star](#morning-star), [Evening star](#evening-star), [Three white soldiers](#three-white-soldiers), [Three black crows](#three-black-crows), [Head and shoulders](#head-and-shoulders), [Double top and double bottom](#double-top-and-double-bottom), [Support and resistance](#support-and-resistance), [Trendline](#trendline), [Breakout](#breakout), [False breakout](#false-breakout), [Chart gap](#chart-gap), [Fibonacci retracement](#fibonacci-retracement), [Moving average](#moving-average), [Moving average crossover](#moving-average-crossover), [Relative strength index (RSI)](#relative-strength-index-rsi), [MACD](#macd), [Bollinger Bands](#bollinger-bands), [Price action](#price-action), [Round number clustering](#round-number-clustering) |
| [Biases and behaviour](#biases-and-behaviour) | [Cognitive bias](#cognitive-bias), [Overconfidence](#overconfidence), [Loss aversion](#loss-aversion), [Prospect theory](#prospect-theory), [Disposition effect](#disposition-effect), [Recency bias](#recency-bias), [Extrapolation](#extrapolation), [Confirmation bias](#confirmation-bias), [Hindsight bias](#hindsight-bias), [Gambler's fallacy](#gamblers-fallacy), [Hot hand](#hot-hand), [Law of small numbers](#law-of-small-numbers), [Anchoring](#anchoring), [Availability heuristic](#availability-heuristic), [Representativeness](#representativeness), [Illusion of control](#illusion-of-control), [Sunk cost fallacy](#sunk-cost-fallacy), [Escalation of commitment](#escalation-of-commitment), [Herding](#herding), [Fear of missing out (FOMO)](#fear-of-missing-out-fomo), [Revenge trading](#revenge-trading), [Tilt](#tilt), [House money effect](#house-money-effect), [Mental accounting](#mental-accounting), [Framing effect](#framing-effect), [Myopic loss aversion](#myopic-loss-aversion), [Endowment effect](#endowment-effect), [Status quo bias](#status-quo-bias), [Narrative fallacy](#narrative-fallacy), [Outcome bias](#outcome-bias), [Overtrading](#overtrading) |
| [Risk and position sizing](#risk-and-position-sizing) | [Position sizing](#position-sizing), [Risk per trade](#risk-per-trade), [Fixed fractional sizing](#fixed-fractional-sizing), [Kelly criterion](#kelly-criterion), [Fractional Kelly](#fractional-kelly), [Value at risk (VaR)](#value-at-risk-var), [Expected shortfall](#expected-shortfall), [Risk of ruin](#risk-of-ruin), [Gambler's ruin](#gamblers-ruin), [Drawdown duration](#drawdown-duration), [Margin](#margin), [Margin call](#margin-call), [Stop-out](#stop-out), [Negative balance protection](#negative-balance-protection), [Stop loss](#stop-loss), [Take profit](#take-profit), [Trailing stop](#trailing-stop), [Slippage](#slippage), [Gap risk](#gap-risk), [Average true range (ATR)](#average-true-range-atr), [Volatility position sizing](#volatility-position-sizing), [Risk-reward ratio](#risk-reward-ratio), [Expectancy](#expectancy), [Tail risk](#tail-risk), [Martingale betting](#martingale-betting), [Averaging down](#averaging-down), [Pyramiding](#pyramiding), [Correlation risk](#correlation-risk), [Stress test](#stress-test) |
| [Capital and returns](#capital-and-returns) | [Compounding](#compounding), [Arithmetic mean return](#arithmetic-mean-return), [Geometric mean return](#geometric-mean-return), [Volatility drag](#volatility-drag), [Nominal return](#nominal-return), [Real return](#real-return), [Inflation](#inflation), [Annualised return](#annualised-return), [Annualised volatility](#annualised-volatility), [Log return](#log-return), [Simple return](#simple-return), [Recovery math](#recovery-math), [Rule of 72](#rule-of-72), [Risk-free rate](#risk-free-rate), [Opportunity cost](#opportunity-cost), [Management fee](#management-fee), [Performance fee](#performance-fee), [High-water mark](#high-water-mark), [Net and gross return](#net-and-gross-return), [Arithmetic of active management](#arithmetic-of-active-management), [Time-weighted return](#time-weighted-return), [Money-weighted return](#money-weighted-return), [Ergodicity](#ergodicity), [Few big winners](#few-big-winners) |
| [FX market structure](#fx-market-structure) | [Pip](#pip), [Pipette](#pipette), [Lot](#lot), [Base and quote currency](#base-and-quote-currency), [Bid and ask](#bid-and-ask), [Majors, crosses and exotics](#majors-crosses-and-exotics), [Spot settlement (T+2)](#spot-settlement-t2), [Value date](#value-date), [Rollover (swap)](#rollover-swap), [Forward points](#forward-points), [FX swap](#fx-swap), [Outright forward](#outright-forward), [Non-deliverable forward (NDF)](#non-deliverable-forward-ndf), [Fixing](#fixing), [London 4 pm fix](#london-4-pm-fix), [Over-the-counter market](#over-the-counter-market), [Interdealer market](#interdealer-market), [ECN](#ecn), [Market maker](#market-maker), [A-book and B-book](#a-book-and-b-book), [Last look](#last-look), [Liquidity](#liquidity), [Market depth](#market-depth), [Trading sessions](#trading-sessions), [London and New York overlap](#london-and-new-york-overlap), [Weekend gap](#weekend-gap), [BIS Triennial Survey](#bis-triennial-survey), [US dollar dominance](#us-dollar-dominance), [Contract for difference (CFD)](#contract-for-difference-cfd), [Notional exposure](#notional-exposure), [Safe-haven currency](#safe-haven-currency), [Funding currency](#funding-currency), [Central bank intervention](#central-bank-intervention), [Currency peg](#currency-peg), [Stop hunting](#stop-hunting) |
| [Myths and false notions](#myths-and-false-notions) | [Myth: if you stick with it, you will eventually make money](#myth-if-you-stick-with-it-you-will-eventually-make-money), [Myth: candlestick patterns reliably predict the next move](#myth-candlestick-patterns-reliably-predict-the-next-move), [Myth: more leverage means more profit](#myth-more-leverage-means-more-profit), [Myth: a high win rate means a good strategy](#myth-a-high-win-rate-means-a-good-strategy), [Myth: it is not a loss until you sell](#myth-it-is-not-a-loss-until-you-sell), [Myth: after a losing streak, a win is due](#myth-after-a-losing-streak-a-win-is-due), [Myth: a great backtest proves a strategy works](#myth-a-great-backtest-proves-a-strategy-works), [Myth: once an edge is found, it keeps working](#myth-once-an-edge-is-found-it-keeps-working), [Myth: high-interest currencies fall by exactly the rate gap](#myth-high-interest-currencies-fall-by-exactly-the-rate-gap), [Myth: the carry trade is free money](#myth-the-carry-trade-is-free-money), [Myth: economic models predict short-term exchange rates](#myth-economic-models-predict-short-term-exchange-rates), [Myth: trading more often makes more money](#myth-trading-more-often-makes-more-money), [Myth: experts and gurus can forecast the market](#myth-experts-and-gurus-can-forecast-the-market), [Myth: a stop loss caps your loss exactly](#myth-a-stop-loss-caps-your-loss-exactly), [Myth: support and resistance are pure superstition](#myth-support-and-resistance-are-pure-superstition), [Myth: huge moves are too rare to worry about](#myth-huge-moves-are-too-rare-to-worry-about), [Myth: you can trade the news before the market reacts](#myth-you-can-trade-the-news-before-the-market-reacts), [Myth: trading many currency pairs spreads your risk](#myth-trading-many-currency-pairs-spreads-your-risk), [Myth: strong feelings give you conviction and help you trade](#myth-strong-feelings-give-you-conviction-and-help-you-trade), [Myth: the right indicator settings will make a strategy work](#myth-the-right-indicator-settings-will-make-a-strategy-work), [Myth: markets go up, so buying any single stock works out](#myth-markets-go-up-so-buying-any-single-stock-works-out), [Myth: last year's best fund or trader will be next year's best](#myth-last-years-best-fund-or-trader-will-be-next-years-best) |
| [Conviction and decision making](#conviction-and-decision-making) | [Conviction](#conviction), [Conviction weighting](#conviction-weighting), [Calibration](#calibration), [Brier score](#brier-score), [Probabilistic forecast](#probabilistic-forecast), [Base rate](#base-rate), [Base rate neglect](#base-rate-neglect), [Outside view](#outside-view), [Expected value](#expected-value), [Edge](#edge), [Process and outcome](#process-and-outcome), [Decision journal](#decision-journal), [Pre-mortem](#pre-mortem), [Kill criteria](#kill-criteria), [Precommitment](#precommitment), [Trading plan](#trading-plan), [Checklist](#checklist), [Bayesian updating](#bayesian-updating), [Sample size](#sample-size), [Regret aversion](#regret-aversion), [Superforecasting](#superforecasting) |
| [New products and hype terms](#new-products-and-hype-terms) | [Perpetual future (perp)](#perpetual-future-perp), [Funding rate](#funding-rate), [Open interest](#open-interest), [Liquidation](#liquidation), [Memecoin](#memecoin), [Airdrop](#airdrop), [Staking](#staking), [Restaking](#restaking), [Stablecoin](#stablecoin), [RWA tokenisation](#rwa-tokenisation), [Spot bitcoin ETF](#spot-bitcoin-etf), [Covered call ETF](#covered-call-etf), [0DTE options](#0dte-options), [Leveraged ETF decay](#leveraged-etf-decay), [Buffer ETF](#buffer-etf), [Prediction market](#prediction-market), [Thematic ETF](#thematic-etf), [Expense ratio](#expense-ratio), [Premium or discount to NAV](#premium-or-discount-to-nav), [Crypto carry](#crypto-carry), [Crypto volatility](#crypto-volatility) |

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

**What can go wrong:** An ETF is only as good as what it holds and what it charges. Narrow, new or leveraged ETFs can behave very differently from a broad index fund.

Related: [S&P 500](#sp-500)

### Leverage

**Simple:** Using borrowed money to make your bets bigger. Wins get bigger, and so do losses.

<details><summary>Analogy</summary>

Riding a bike downhill. You go faster, and falling hurts more.

</details>

<details><summary>Precise definition</summary>

Gross exposure above 100% of capital. Volatility targeting in our backtester can lever a calm strategy up to 4 times to compare it with stocks at equal risk.

</details>

**What can go wrong:** Losses grow as fast as gains, and borrowed money must be repaid even if the trade fails. Past a point, more leverage lowers long-run growth and can end in a margin call or liquidation.

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

## Candlesticks and chart patterns

### Bollinger Bands

**Simple:** Lines drawn above and below a moving average at a distance that grows when the price is jumpy and shrinks when it is calm.

<details><summary>Analogy</summary>

Like the lane lines on a road that get wider when the traffic is swerving more.

</details>

<details><summary>Precise definition</summary>

A moving average plus and minus a multiple (often 2) of the rolling standard deviation. Touching a band is used by some as a reversal signal and by others as a breakout signal, which shows the rule does not by itself say which.

</details>

Related: [Volatility](#volatility), [Mean reversion](#mean-reversion), [Breakout](#breakout)

### Breakout

**Simple:** When the price moves past a level it had stopped at before, like support or resistance.

<details><summary>Analogy</summary>

Like water finally spilling over the top of a dam.

</details>

<details><summary>Precise definition</summary>

A move through a prior high, low or range boundary. Channel breakout rules are one of the simple trend-following rules that made money in FX before the 1990s [@neely2009]. Osler (2003) found that trends tend to speed up after rates cross round numbers, consistent with stop-loss orders being triggered [@osler2003].

</details>

Related: [False breakout](#false-breakout), [Support and resistance](#support-and-resistance), [Momentum](#momentum)

### Bullish and bearish candles

**Simple:** A bullish candle closed higher than it opened. A bearish candle closed lower than it opened.

<details><summary>Analogy</summary>

Like a day that ended better than it began, or worse than it began.

</details>

<details><summary>Precise definition</summary>

Bullish: close above open. Bearish: close below open. The words describe what already happened in that period, not what will happen next.

</details>

Related: [Candle body](#candle-body), [Candlestick](#candlestick)

### Candle body

**Simple:** The thick box part of a candlestick. It shows how far the price moved from start to finish.

<details><summary>Analogy</summary>

Like the distance between where you started your walk and where you ended up, ignoring the detours.

</details>

<details><summary>Precise definition</summary>

The span between open and close. It is usually filled or coloured red when the close is below the open (a bearish candle) and hollow or green when the close is above the open (a bullish candle).

</details>

Related: [Candlestick](#candlestick), [Bullish and bearish candles](#bullish-and-bearish-candles), [Candle wick](#candle-wick)

### Candle wick

**Simple:** The thin lines sticking out of the top and bottom of a candle. They show the highest and lowest prices that were reached.

<details><summary>Analogy</summary>

Like the farthest you wandered off the path during a walk, even if you came back.

</details>

<details><summary>Precise definition</summary>

Also called shadows. The upper wick runs from the top of the body to the high, the lower wick from the bottom of the body to the low. Long wicks mean the price visited a level and then moved away from it within the period.

</details>

Related: [Candlestick](#candlestick), [Candle body](#candle-body), [Hammer](#hammer), [Shooting star](#shooting-star)

### Candlestick

**Simple:** A little drawing that shows four prices for one stretch of time: where the price started, where it ended, the highest it went and the lowest it went.

<details><summary>Analogy</summary>

Like a thermometer with a mark for the morning temperature, the evening temperature, and the hottest and coldest moments of the day.

</details>

<details><summary>Precise definition</summary>

A chart mark for one period showing open, high, low and close. The box (body) spans open to close and the lines (wicks) reach the high and low. Popularised in the West by Nison (1991) [@nison1991]. A candle is just a picture of four numbers; it holds no information that the four numbers do not.

</details>

Related: [OHLC bar](#ohlc-bar), [Candle body](#candle-body), [Candle wick](#candle-wick), [Technical analysis](#technical-analysis)

### Chart gap

**Simple:** An empty space on a chart where the price jumped from one level to another without trading in between.

<details><summary>Analogy</summary>

Like skipping several stairs in one jump.

</details>

<details><summary>Precise definition</summary>

A period whose range does not overlap the previous period's range. FX trades around the clock on weekdays, so gaps appear mostly over weekends or after sudden news. A gap means a stop order can fill far from its level.

</details>

Related: [Weekend gap](#weekend-gap), [Gap risk](#gap-risk)

### Doji

**Simple:** A candle where the price ended almost exactly where it started, so the body is a thin line.

<details><summary>Analogy</summary>

Like a tug of war that ends with the rope in the same place it started.

</details>

<details><summary>Precise definition</summary>

A candle whose open and close are nearly equal, read by chartists as indecision. There is no agreed threshold for 'nearly equal'. A test of candlestick rules on Dow Jones stocks from 1992 to 2002 found no value [@marshall2005].

</details>

Related: [Candlestick](#candlestick), [Spinning top](#spinning-top)

### Double top and double bottom

**Simple:** A double top is when the price climbs to the same high twice and fails both times. A double bottom is the same at a low.

<details><summary>Analogy</summary>

Like a ball that hits the same ceiling twice before you give up throwing it.

</details>

<details><summary>Precise definition</summary>

Two peaks (or troughs) at a similar level separated by a pullback. Chartists read it as a reversal once price breaks the level between them. Algorithmic tests find these shapes have at most a small amount of information [@lo2000].

</details>

Related: [Head and shoulders](#head-and-shoulders), [Support and resistance](#support-and-resistance)

### Engulfing pattern

**Simple:** Two candles where the second one's body is bigger than the first and points the other way, like it swallowed the first one.

<details><summary>Analogy</summary>

Like a big wave that washes over the sandcastle the small wave built.

</details>

<details><summary>Precise definition</summary>

A two-candle pattern: a bullish engulfing is a bearish candle followed by a bullish candle whose body covers the first body; bearish engulfing is the reverse. Results are mixed: a test on Dow Jones stocks found no value [@marshall2005], while a study of Taiwan stocks found three bullish two-day patterns profitable [@lu2012].

</details>

Related: [Harami](#harami), [Candle body](#candle-body)

### Evening star

**Simple:** The upside-down version of a morning star: a big up candle, a small candle, then a big down candle. Chartists say it signals a top.

<details><summary>Analogy</summary>

Like the evening star that shows up as the day ends.

</details>

<details><summary>Precise definition</summary>

A long bullish candle, a small-bodied candle, then a long bearish candle closing well into the first body. Same evidence as the morning star: support in one sample [@caginalp1998a], none in another [@marshall2005].

</details>

Related: [Morning star](#morning-star)

### False breakout

**Simple:** When the price pokes past a level but then quickly comes back.

<details><summary>Analogy</summary>

Like someone stepping out the door, feeling the rain and stepping back inside.

</details>

<details><summary>Precise definition</summary>

A break of a level that reverses within a short time. Osler (2003) found that rates tend to reverse at round numbers, where take-profit orders cluster, so not every break of a level should be expected to continue [@osler2003].

</details>

Related: [Breakout](#breakout), [Stop hunting](#stop-hunting)

### Fibonacci retracement

**Simple:** Lines drawn at certain fractions (like 38.2%, 50% and 61.8%) of a past move, where some traders expect the price to pause.

<details><summary>Analogy</summary>

Like believing a bouncing ball will always stop at the same fraction of its last bounce because of a famous number.

</details>

<details><summary>Precise definition</summary>

Levels at Fibonacci ratios of a prior swing. We found no peer-reviewed large-sample study showing these levels predict turning points better than other levels; they may matter a little only because many people watch them. The general technical analysis literature is cautious [@park2007].

</details>

Related: [Support and resistance](#support-and-resistance), [Technical analysis](#technical-analysis)

### Hammer

**Simple:** A candle with a small body at the top and a long wick below it, appearing after the price has been falling.

<details><summary>Analogy</summary>

Like a ball that is thrown hard at the floor and bounces most of the way back up.

</details>

<details><summary>Precise definition</summary>

Small body near the high, lower wick at least about twice the body, little or no upper wick, after a decline. Chartists read it as a possible turn up. A test of candlestick strategies on Dow Jones stocks from 1992 to 2002 found no value [@marshall2005].

</details>

Related: [Hanging man](#hanging-man), [Inverted hammer](#inverted-hammer), [Candle wick](#candle-wick)

### Hanging man

**Simple:** The same shape as a hammer, but it shows up after the price has been rising.

<details><summary>Analogy</summary>

The same shape can mean different things depending on where you see it, like a raised hand in class or at a bus stop.

</details>

<details><summary>Precise definition</summary>

Small body near the high with a long lower wick, after an advance. Chartists read it as a possible turn down. That one shape gets opposite names by context is a warning sign about how flexible these rules are; the Dow Jones test found candlestick strategies had no value [@marshall2005].

</details>

Related: [Hammer](#hammer), [Shooting star](#shooting-star)

### Harami

**Simple:** Two candles where the second one is small and fits inside the body of the first one.

<details><summary>Analogy</summary>

Like a baby tucked inside its mother. Harami is Japanese for pregnant.

</details>

<details><summary>Precise definition</summary>

A large body followed by a small body contained within it, read by chartists as a possible pause or turn. The evidence is the same as for other candle patterns: no value in the Dow Jones test [@marshall2005].

</details>

Related: [Engulfing pattern](#engulfing-pattern), [Doji](#doji)

### Head and shoulders

**Simple:** A chart shape with three peaks where the middle one is the tallest, like a head between two shoulders. Chartists say it means the price will fall.

<details><summary>Analogy</summary>

Like seeing a face in the clouds: you can usually find one if you look for it.

</details>

<details><summary>Precise definition</summary>

A pattern of three peaks with the middle highest, and a 'neckline' through the troughs. On daily dollar exchange rates from 1973 to 1994, Chang and Osler (1999) found the rule was profitable but beaten by simpler trading rules [@chang1999]. Lo, Mamaysky and Wang (2000) found such patterns carry a little information in US stocks [@lo2000].

</details>

Related: [Double top and double bottom](#double-top-and-double-bottom), [Technical analysis](#technical-analysis)

### Inverted hammer

**Simple:** The same shape as a shooting star, but it shows up after the price has been falling.

<details><summary>Analogy</summary>

An upside down hammer.

</details>

<details><summary>Precise definition</summary>

Small body near the low and a long upper wick, after a decline. Read by chartists as a possible turn up. No large test we know of supports it as a reliable signal.

</details>

Related: [Shooting star](#shooting-star), [Hammer](#hammer)

### MACD

**Simple:** A tool that subtracts a slow moving average from a fast one to show whether a trend is speeding up or slowing down.

<details><summary>Analogy</summary>

Like comparing how fast you walked in the last minute with how fast you walked over the last ten.

</details>

<details><summary>Precise definition</summary>

Moving average convergence divergence: the 12-period exponential average minus the 26-period one, with a 9-period average of that difference as a signal line. It is a trend rule built from moving averages, with the same lag and the same mixed evidence.

</details>

Related: [Moving average crossover](#moving-average-crossover), [Relative strength index (RSI)](#relative-strength-index-rsi)

### Marubozu

**Simple:** A candle with a big body and almost no wicks: the price moved one way the whole time.

<details><summary>Analogy</summary>

Like a runner who sprints in a straight line from start to finish without slowing or turning.

</details>

<details><summary>Precise definition</summary>

A candle whose open is at or near one extreme and close at or near the other. Chartists read it as strong pressure in one direction. A test on Dow Jones stocks from 1992 to 2002 found candlestick strategies had no value [@marshall2005].

</details>

Related: [Candle body](#candle-body), [Candlestick](#candlestick)

### Morning star

**Simple:** A three-candle pattern: a big down candle, a small candle, then a big up candle. Chartists say it signals a bottom.

<details><summary>Analogy</summary>

Like the morning star that appears just before sunrise, after the dark night.

</details>

<details><summary>Precise definition</summary>

A long bearish candle, a small-bodied candle that gaps or sits lower, then a long bullish candle closing well into the first body. Caginalp and Laurent (1998) found three-day candlestick patterns had predictive power in S&P 500 stocks from 1992 to 1996 [@caginalp1998a]; a test on Dow Jones stocks from 1992 to 2002 found no value [@marshall2005].

</details>

Related: [Evening star](#evening-star), [Doji](#doji)

### Moving average

**Simple:** The average price over the last few days, recalculated each day, so it smooths out the wiggles.

<details><summary>Analogy</summary>

Like your average score over your last ten games, updated after every game.

</details>

<details><summary>Precise definition</summary>

The mean of the last N prices, either equally weighted (simple) or with more weight on recent prices (exponential). It always lags the price, because it is built from the past.

</details>

Related: [Moving average crossover](#moving-average-crossover), [Momentum](#momentum)

### Moving average crossover

**Simple:** A rule to buy when a short average climbs above a long average, and sell when it drops below.

<details><summary>Analogy</summary>

Like deciding a hill is going up once your last few steps are higher than your last fifty steps.

</details>

<details><summary>Precise definition</summary>

A trend rule comparing a short and a long moving average. In FX such rules earned excess returns in the 1970s and 1980s that faded after the early 1990s [@neely2009]. On the Dow Jones, the best rule from Brock, Lakonishok and LeBaron's (1992) sample did not keep working from 1987 to 1996 [@brock1992; @sullivan1999].

</details>

Related: [Moving average](#moving-average), [Momentum](#momentum), [Data snooping (multiple testing)](#data-snooping-multiple-testing)

### OHLC bar

**Simple:** The four prices for a time period: open, high, low and close.

<details><summary>Analogy</summary>

Like a short diary of a day: how it started, the best moment, the worst moment and how it ended.

</details>

<details><summary>Precise definition</summary>

Open, high, low and close for one period (a minute, an hour, a day). Bar charts and candlestick charts draw the same four numbers in different shapes. Note that FX has no single official open or close, so different data vendors give slightly different daily bars.

</details>

Related: [Candlestick](#candlestick), [Trading sessions](#trading-sessions)

### Price action

**Simple:** Trading by reading the shapes the price makes on a chart, usually without other indicators.

<details><summary>Analogy</summary>

Like reading someone's mood from their face instead of asking them.

</details>

<details><summary>Precise definition</summary>

A discretionary style built on candles, levels and patterns. Because rules are rarely written down, it is hard to test, and we found no large-sample evidence for it as a whole. When written as rules, tests fall under the technical analysis literature [@park2007].

</details>

Related: [Technical analysis](#technical-analysis), [Candlestick](#candlestick)

### Relative strength index (RSI)

**Simple:** A number from 0 to 100 that compares recent up moves to recent down moves. High is said to mean 'overbought', low 'oversold'.

<details><summary>Analogy</summary>

Like a speedometer that shows how fast the price has been climbing compared with falling.

</details>

<details><summary>Precise definition</summary>

An oscillator, usually over 14 periods: 100 minus 100 divided by (1 plus average gain over average loss). Readings above 70 or below 30 are common thresholds. 'Overbought' does not mean due to fall; in trending markets RSI can stay high for a long time. Evidence for RSI rules is part of the mixed technical analysis literature [@park2007].

</details>

Related: [Mean reversion](#mean-reversion), [MACD](#macd), [Technical analysis](#technical-analysis)

### Round number clustering

**Simple:** Many traders put their orders at tidy prices like 1.1000 instead of 1.1037, so lots of orders pile up there.

<details><summary>Analogy</summary>

Like how prices in shops end in .99 or .00 more than any other number.

</details>

<details><summary>Precise definition</summary>

In customer order books at a large FX dealer, take-profit orders clustered at round numbers and stop-loss orders just beyond them, which helps explain why trends often reverse at round numbers and speed up after crossing them [@osler2003].

</details>

Related: [Support and resistance](#support-and-resistance), [Stop loss](#stop-loss)

### Shooting star

**Simple:** A candle with a small body at the bottom and a long wick above it, after the price has been rising.

<details><summary>Analogy</summary>

Like a rocket that shoots up and then falls back down to where it started.

</details>

<details><summary>Precise definition</summary>

Small body near the low, long upper wick, after an advance. Chartists read it as a possible turn down. As with other candles, the Dow Jones test found no value [@marshall2005].

</details>

Related: [Inverted hammer](#inverted-hammer), [Hanging man](#hanging-man), [Candle wick](#candle-wick)

### Spinning top

**Simple:** A candle with a small body and long wicks on both sides.

<details><summary>Analogy</summary>

Like a spinning top that wobbles a lot but stays in about the same place.

</details>

<details><summary>Precise definition</summary>

Small body, upper and lower wicks both longer than the body. Chartists read it as indecision, like a doji with a slightly larger body. We know of no large test that finds it predicts direction.

</details>

Related: [Doji](#doji), [Candle wick](#candle-wick)

### Support and resistance

**Simple:** Price levels where people believe a falling price tends to stop (support) or a rising price tends to stop (resistance).

<details><summary>Analogy</summary>

Like a floor and a ceiling in a room: the ball bounces off them, until one day it breaks through.

</details>

<details><summary>Precise definition</summary>

Levels where buying or selling interest is thought to gather. In FX there is some real support: levels published by six firms helped predict intraday trend stops from 1996 to 1998 [@osler2000], and customer stop-loss and take-profit orders cluster at round numbers, which can explain why such levels matter [@osler2003].

</details>

Related: [Round number clustering](#round-number-clustering), [Breakout](#breakout), [Stop loss](#stop-loss)

### Technical analysis

**Simple:** Trying to guess where a price goes next by looking only at its past prices and trading volume on a chart.

<details><summary>Analogy</summary>

Like guessing tomorrow's weather only from the last few days of weather, without looking at the clouds or the season.

</details>

<details><summary>Precise definition</summary>

Forecasting from past prices and volume alone. A review of 95 modern studies found 56 reported profits, but many had problems with data snooping, rules picked after the fact and cost estimates [@park2007]. In currencies, simple rules made money in the 1970s and 1980s and much less after the early 1990s [@neely2009]. It is widespread among FX professionals [@menkhoff2007].

</details>

Related: [Candlestick](#candlestick), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Moving average crossover](#moving-average-crossover), [Support and resistance](#support-and-resistance)

### Three black crows

**Simple:** Three down candles in a row, each closing lower than the one before.

<details><summary>Analogy</summary>

Like three steps down a staircase.

</details>

<details><summary>Precise definition</summary>

The bearish mirror of three white soldiers. The same caution applies: streaks are common in random data [@tversky1971].

</details>

Related: [Three white soldiers](#three-white-soldiers), [Law of small numbers](#law-of-small-numbers)

### Three white soldiers

**Simple:** Three up candles in a row, each closing higher than the one before.

<details><summary>Analogy</summary>

Like three steps up a staircase.

</details>

<details><summary>Precise definition</summary>

Three consecutive long bullish candles, each opening within the prior body and closing near its high. Chartists read it as strong buying. Three up periods in a row also happen often by chance in a random walk; a rule needs testing against that baseline.

</details>

Related: [Three black crows](#three-black-crows), [Random walk](#random-walk)

### Trendline

**Simple:** A straight line drawn along the lows (or highs) of a chart to show which way the price has been heading.

<details><summary>Analogy</summary>

Like drawing a line along the edge of a hill to see how steep it is.

</details>

<details><summary>Precise definition</summary>

A line through two or more swing lows or highs. Which points to use is a choice, so two people can draw different trendlines on the same chart. This freedom makes trendline rules hard to test fairly.

</details>

Related: [Support and resistance](#support-and-resistance), [Breakout](#breakout)

## Biases and behaviour

### Anchoring

**Simple:** Getting stuck on the first number you hear, even if it has nothing to do with the question.

<details><summary>Analogy</summary>

Like a shop showing a huge 'original price' so the sale price feels cheap.

</details>

<details><summary>Precise definition</summary>

Estimates are pulled toward an initial value, even an arbitrary one [@tversky1974]. Traders often anchor on their entry price, which has no effect on where the market goes next.

</details>

Related: [Disposition effect](#disposition-effect), [Cognitive bias](#cognitive-bias)

### Availability heuristic

**Simple:** Judging how likely something is by how easily examples come to mind.

<details><summary>Analogy</summary>

Like being scared of sharks after a shark film, though you are far more likely to be hurt driving to the beach.

</details>

<details><summary>Precise definition</summary>

Frequency or probability is judged by ease of recall [@tversky1974]. Vivid stories of big trading wins are easy to recall; quiet account closures are not.

</details>

Related: [Survivorship bias](#survivorship-bias), [Recency bias](#recency-bias)

### Cognitive bias

**Simple:** A shortcut in how our brains think that makes us get the same kind of thing wrong again and again.

<details><summary>Analogy</summary>

Like a bathroom scale that always reads two kilos light. It is not random; it is wrong in the same direction every time.

</details>

<details><summary>Precise definition</summary>

A systematic departure from what probability or logic would say. Tversky and Kahneman (1974) showed that rules of thumb for judging chances, such as representativeness, availability and anchoring, lead to predictable errors [@tversky1974]. Behavioural finance studies how these errors show up in prices and trading [@barberis2003].

</details>

Related: [Overconfidence](#overconfidence), [Anchoring](#anchoring), [Availability heuristic](#availability-heuristic), [Representativeness](#representativeness)

### Confirmation bias

**Simple:** Noticing and believing things that agree with what you already think, and ignoring things that do not.

<details><summary>Analogy</summary>

Like only reading reviews that praise the film you already decided to see.

</details>

<details><summary>Precise definition</summary>

The tendency to seek, interpret and remember evidence in ways that favour existing beliefs [@nickerson1998]. For traders it shows up as reading news that supports an open position and dismissing news against it.

</details>

Related: [Hindsight bias](#hindsight-bias), [Narrative fallacy](#narrative-fallacy), [Pre-mortem](#pre-mortem)

### Disposition effect

**Simple:** The habit of selling winning trades too early and holding losing trades too long, hoping they come back.

<details><summary>Analogy</summary>

Like leaving a party you are enjoying, but staying at one you hate because you already paid for the ticket.

</details>

<details><summary>Precise definition</summary>

The tendency to realise gains more readily than losses [@shefrin1985]. In 10,000 US brokerage accounts, Odean (1998) found a strong preference for realising winners rather than losers, and later returns did not justify it [@odean1998]. Among retail traders, access to a social trading network nearly doubled the effect [@heimer2016].

</details>

Related: [Loss aversion](#loss-aversion), [Sunk cost fallacy](#sunk-cost-fallacy), [Myth: it is not a loss until you sell](#myth-it-is-not-a-loss-until-you-sell)

### Endowment effect

**Simple:** Valuing something more just because you own it.

<details><summary>Analogy</summary>

Like refusing to sell your old bike for a price you would never pay to buy it.

</details>

<details><summary>Precise definition</summary>

Kahneman, Knetsch and Thaler (1990) found that what owners ask to give up an object such as a mug greatly exceeds what buyers will pay, even in markets [@kahneman1990]. An open position can feel worth more than it is because it is ours.

</details>

Related: [Status quo bias](#status-quo-bias), [Disposition effect](#disposition-effect)

### Escalation of commitment

**Simple:** Putting more and more into a losing plan because you do not want to admit it was wrong.

<details><summary>Analogy</summary>

Like digging a hole deeper to get out of it.

</details>

<details><summary>Precise definition</summary>

Staw (1976) found people who were responsible for a failing decision put more resources into it than people who were not [@staw1976]. In trading this looks like adding to a losing position without a rule that says to.

</details>

Related: [Sunk cost fallacy](#sunk-cost-fallacy), [Averaging down](#averaging-down)

### Extrapolation

**Simple:** Expecting what has been happening to keep happening.

<details><summary>Analogy</summary>

Like expecting a growing puppy to become the size of a horse because it doubled in size this year.

</details>

<details><summary>Precise definition</summary>

Forming expectations by projecting recent trends forward. Greenwood and Shleifer (2014) found investor return expectations move with past returns but are strongly negatively related to model-based expected returns [@greenwood2014]. De Bondt and Thaler (1985) found past extreme losers later beat past extreme winners in US stocks, consistent with overreaction [@debondt1985].

</details>

Related: [Recency bias](#recency-bias), [Momentum](#momentum), [Mean reversion](#mean-reversion)

### Fear of missing out (FOMO)

**Simple:** Jumping into a trade because everyone seems to be making money and you feel left behind.

<details><summary>Analogy</summary>

Like buying a toy only because all your friends have it.

</details>

<details><summary>Precise definition</summary>

A popular term, not an academic one. The nearest evidence: individual investors are net buyers of stocks that grab attention, such as those in the news or with extreme one-day moves [@barber2008].

</details>

Related: [Herding](#herding), [Recency bias](#recency-bias)

### Framing effect

**Simple:** Making a different choice depending on how the same thing is described.

<details><summary>Analogy</summary>

Like a yoghurt that is '90% fat free' sounding better than one with '10% fat'.

</details>

<details><summary>Precise definition</summary>

Tversky and Kahneman (1981) showed choices reverse when the same outcomes are described as gains or as losses [@tversky1981]. A '60% win rate' and 'loses 4 times in 10' are the same fact.

</details>

Related: [Prospect theory](#prospect-theory), [Loss aversion](#loss-aversion)

### Gambler's fallacy

**Simple:** Thinking that after many reds on a roulette wheel, black is 'due'. It is not; the wheel does not remember.

<details><summary>Analogy</summary>

Like thinking a coin feels guilty after five heads and will try to land tails.

</details>

<details><summary>Precise definition</summary>

Believing independent events self-correct in the short run, a form of the 'law of small numbers' [@tversky1971; @tversky1974]. For trading: after a run of losses, the next trade of an independent strategy is not more likely to win.

</details>

Related: [Law of small numbers](#law-of-small-numbers), [Hot hand](#hot-hand), [Myth: after a losing streak, a win is due](#myth-after-a-losing-streak-a-win-is-due)

### Herding

**Simple:** Doing what everyone else is doing because they are doing it.

<details><summary>Analogy</summary>

Like choosing the busy restaurant over the empty one without looking at the menu.

</details>

<details><summary>Precise definition</summary>

Banerjee (1992) showed it can be rational for each person to copy others, yet the group as a whole can end up wrong [@banerjee1992]. Crowded trades can unwind suddenly when many leave at once [@brunnermeier2008].

</details>

Related: [Fear of missing out (FOMO)](#fear-of-missing-out-fomo), [Carry trade](#carry-trade)

### Hindsight bias

**Simple:** After something happens, feeling like you knew it would happen all along.

<details><summary>Analogy</summary>

Like saying 'I knew that team would win' only after the match is over.

</details>

<details><summary>Precise definition</summary>

Knowing an outcome makes people judge it as more predictable than it was [@fischhoff1975]. Charts make this worse: every past turning point looks obvious afterwards.

</details>

Related: [Outcome bias](#outcome-bias), [Decision journal](#decision-journal), [Lookahead bias](#lookahead-bias)

### Hot hand

**Simple:** Believing someone who has just had several wins in a row is more likely to win again.

<details><summary>Analogy</summary>

Like a basketball fan who wants the ball passed to whoever just scored three in a row.

</details>

<details><summary>Precise definition</summary>

Gilovich, Vallone and Tversky (1985) argued the hot hand in basketball was a misperception of random streaks [@gilovich1985]. Miller and Sanjurjo (2018) showed that study's measure was biased, and that once corrected its conclusion reverses [@miller2018]. The lesson for us: judging streaks is hard, and short track records say little.

</details>

Related: [Gambler's fallacy](#gamblers-fallacy), [Law of small numbers](#law-of-small-numbers)

### House money effect

**Simple:** Taking bigger risks with money you just won, as if it is not really yours.

<details><summary>Analogy</summary>

Like spending birthday money more freely than money you earned.

</details>

<details><summary>Precise definition</summary>

Thaler and Johnson (1990) found that after a gain people are more willing to take risks, treating winnings as 'house money' [@thaler1990]. Money is money: a profit already in the account is as real as the deposit.

</details>

Related: [Mental accounting](#mental-accounting), [Revenge trading](#revenge-trading)

### Illusion of control

**Simple:** Believing you can influence things that are really down to chance.

<details><summary>Analogy</summary>

Like people throwing dice harder when they want a high number.

</details>

<details><summary>Precise definition</summary>

Langer (1975) showed people act as if they have more control over chance outcomes when chance tasks include features of skill tasks, such as competition, choice, familiarity or involvement [@langer1975]. Watching screens and drawing lines can feel like control over prices that we do not have.

</details>

Related: [Overconfidence](#overconfidence), [Overtrading](#overtrading)

### Law of small numbers

**Simple:** The mistake of thinking a few results tell you the whole story.

<details><summary>Analogy</summary>

Like tasting one grape and deciding the whole vineyard is sour.

</details>

<details><summary>Precise definition</summary>

Tversky and Kahneman (1971): people expect small samples to look like the population they come from, so they read too much into short runs of data [@tversky1971]. A month of trading results is a small sample.

</details>

Related: [Gambler's fallacy](#gamblers-fallacy), [Sample size](#sample-size), [Hot hand](#hot-hand)

### Loss aversion

**Simple:** Losing something hurts more than winning the same thing feels good.

<details><summary>Analogy</summary>

Losing a ten pound note hurts more than finding one cheers you up.

</details>

<details><summary>Precise definition</summary>

Kahneman and Tversky (1979) found the value function is generally steeper for losses than for gains [@kahneman1979]. Later work put a number on how much steeper; we have not yet checked those estimates.

</details>

Related: [Prospect theory](#prospect-theory), [Disposition effect](#disposition-effect), [Myopic loss aversion](#myopic-loss-aversion)

### Mental accounting

**Simple:** Putting money into separate boxes in your head and treating each box differently, even though money is all the same.

<details><summary>Analogy</summary>

Like refusing to touch your 'holiday jar' while paying interest on a credit card.

</details>

<details><summary>Precise definition</summary>

Thaler (1985): people code, categorise and evaluate outcomes in separate mental accounts rather than by total wealth [@thaler1985]. Judging each trade alone, instead of the whole account, is one form.

</details>

Related: [House money effect](#house-money-effect), [Disposition effect](#disposition-effect)

### Myopic loss aversion

**Simple:** Checking your results too often makes losses feel more frequent, so you get scared out of good long-term choices.

<details><summary>Analogy</summary>

Like weighing yourself every hour on a diet and panicking at every glass of water.

</details>

<details><summary>Precise definition</summary>

Benartzi and Thaler (1995): loss aversion plus frequent evaluation makes risky assets look worse, which can help explain the equity premium [@benartzi1995]. The more often a volatile strategy is checked, the more often it shows a loss.

</details>

Related: [Loss aversion](#loss-aversion), [Volatility](#volatility)

### Narrative fallacy

**Simple:** Making up a neat story to explain random events, and then believing the story.

<details><summary>Analogy</summary>

Like deciding your team lost because you wore the wrong socks.

</details>

<details><summary>Precise definition</summary>

Taleb's term for our need to fit a cause-and-effect story to sequences of facts, which makes the world seem more predictable than it is [@taleb2007]. Daily market commentary often explains moves after they happen.

</details>

Related: [Hindsight bias](#hindsight-bias), [Confirmation bias](#confirmation-bias)

### Outcome bias

**Simple:** Judging a decision only by how it turned out, instead of by whether it was a good choice at the time.

<details><summary>Analogy</summary>

Like praising someone for driving home drunk because they did not crash.

</details>

<details><summary>Precise definition</summary>

Baron and Hershey (1988) found people rated the same decision as better when it had a good outcome [@baron1988]. One trade's result says very little about the quality of the decision.

</details>

Related: [Process and outcome](#process-and-outcome), [Hindsight bias](#hindsight-bias)

### Overconfidence

**Simple:** Thinking you know more, or are better at something, than you really are.

<details><summary>Analogy</summary>

Like most drivers saying they are better than the average driver, which cannot be true for most of them.

</details>

<details><summary>Precise definition</summary>

Overestimating the precision of one's information or one's skill. Barber and Odean (2001) found men traded 45% more than women and cut their net returns by 2.65 percentage points a year against 1.72 for women, consistent with overconfidence [@barber2001].

</details>

Related: [Overtrading](#overtrading), [Calibration](#calibration), [Illusion of control](#illusion-of-control)

### Overtrading

**Simple:** Trading too often, so costs and mistakes eat your money.

<details><summary>Analogy</summary>

Like checking the oven every minute: the cake does not bake faster and you let the heat out.

</details>

<details><summary>Precise definition</summary>

Barber and Odean (2000) found the US households that traded most earned 11.4% a year against 17.9% for the market, mostly because of costs [@barber2000].

</details>

Related: [Overconfidence](#overconfidence), [Transaction costs](#transaction-costs), [Turnover](#turnover)

### Prospect theory

**Simple:** A theory that says people judge choices by gains and losses from where they are now, and hate losses more than they like gains.

<details><summary>Analogy</summary>

Like judging a test score by whether it beat your last one, not by the score itself.

</details>

<details><summary>Precise definition</summary>

Kahneman and Tversky (1979): outcomes are valued relative to a reference point, with a value function concave for gains, convex for losses and steeper for losses, and with decision weights in place of probabilities [@kahneman1979].

</details>

Related: [Loss aversion](#loss-aversion), [Framing effect](#framing-effect), [Disposition effect](#disposition-effect)

### Recency bias

**Simple:** Giving too much weight to what just happened and too little to everything before.

<details><summary>Analogy</summary>

Like thinking summer will never end after three hot days, even though you remember last winter.

</details>

<details><summary>Precise definition</summary>

Overweighting recent observations when forming expectations. Investor surveys show expected returns track recent past returns, while being strongly negatively related to model-based expected returns [@greenwood2014].

</details>

Related: [Extrapolation](#extrapolation), [Availability heuristic](#availability-heuristic)

### Representativeness

**Simple:** Judging something by how much it looks like a typical example, and forgetting how common it actually is.

<details><summary>Analogy</summary>

Like assuming a quiet person who loves books must be a librarian, though there are far more quiet salespeople than librarians.

</details>

<details><summary>Precise definition</summary>

Judging probability by similarity to a stereotype while neglecting base rates and sample size [@tversky1974]. A chart that 'looks like' a famous pattern is judged likely to behave like it.

</details>

Related: [Base rate neglect](#base-rate-neglect), [Law of small numbers](#law-of-small-numbers)

### Revenge trading

**Simple:** Trading bigger or more often right after a loss to try to win the money back fast.

<details><summary>Analogy</summary>

Like a player who loses a game and immediately bets double to 'get even'.

</details>

<details><summary>Precise definition</summary>

A trader's term, not an academic one. The closest studied effect is the break-even effect: after a loss, people take more risk when it offers a chance to get back to even [@thaler1990].

</details>

Related: [House money effect](#house-money-effect), [Tilt](#tilt), [Overtrading](#overtrading)

### Status quo bias

**Simple:** Preferring to keep things as they are, even when a change would be better.

<details><summary>Analogy</summary>

Like always ordering the same meal because changing feels risky.

</details>

<details><summary>Precise definition</summary>

Samuelson and Zeckhauser (1988) found people choose the current option far more often than they would if it were not the default [@samuelson1988].

</details>

Related: [Endowment effect](#endowment-effect), [Sunk cost fallacy](#sunk-cost-fallacy)

### Sunk cost fallacy

**Simple:** Sticking with something because you already put time or money into it, even when stopping is the better choice.

<details><summary>Analogy</summary>

Like finishing a terrible meal because you paid for it, so you lose your money and your evening.

</details>

<details><summary>Precise definition</summary>

Letting unrecoverable past costs affect present choices [@arkes1985]. The money already lost on a trade is gone either way; only the expected value from here matters.

</details>

Related: [Escalation of commitment](#escalation-of-commitment), [Disposition effect](#disposition-effect)

### Tilt

**Simple:** When strong feelings after wins or losses make you trade badly.

<details><summary>Analogy</summary>

Like a pinball machine that stops working properly when shaken.

</details>

<details><summary>Precise definition</summary>

Poker slang for emotional decision making. In a small study of day traders, those with stronger emotional reactions to gains and losses had worse results [@lo2005].

</details>

Related: [Revenge trading](#revenge-trading), [Myth: strong feelings give you conviction and help you trade](#myth-strong-feelings-give-you-conviction-and-help-you-trade)

## Risk and position sizing

### Average true range (ATR)

**Simple:** A measure of how much the price usually moves in one period.

<details><summary>Analogy</summary>

Like knowing a river usually rises and falls about half a metre a day.

</details>

<details><summary>Precise definition</summary>

The average over N periods of the true range: the largest of high minus low, high minus previous close, and previous close minus low. Used to set stops and position sizes in units of typical movement.

</details>

Related: [Volatility](#volatility), [Volatility position sizing](#volatility-position-sizing)

### Averaging down

**Simple:** Buying more of something after its price falls, to lower your average price.

<details><summary>Analogy</summary>

Like ordering more of a meal you did not like because the second plate is cheaper.

</details>

<details><summary>Precise definition</summary>

Adding to a losing position. It lowers the average entry price but raises exposure to a trade that is going wrong. Without a rule set in advance, it is a form of escalation of commitment [@staw1976].

</details>

Related: [Martingale betting](#martingale-betting), [Escalation of commitment](#escalation-of-commitment), [Pyramiding](#pyramiding)

### Correlation risk

**Simple:** The danger that trades you thought were separate all go wrong together.

<details><summary>Analogy</summary>

Like carrying eggs in five baskets that are all tied to the same rope.

</details>

<details><summary>Precise definition</summary>

Risk that positions move together more than expected, especially in stress. Most FX trades share the US dollar on one side (89.2% in April 2025 [@bis2025]), and a common dollar factor explains much of the movement of currencies [@lustig2011].

</details>

Related: [Correlation](#correlation), [Diversification](#diversification), [Myth: trading many currency pairs spreads your risk](#myth-trading-many-currency-pairs-spreads-your-risk)

### Drawdown duration

**Simple:** How long it takes to climb back to your old best after a fall.

<details><summary>Analogy</summary>

Like how long it takes to get back to the top of the hill after sliding down.

</details>

<details><summary>Precise definition</summary>

The time from a peak in equity to the point where that peak is regained. For a random walk with positive drift, the expected maximum drawdown keeps growing with the time horizon, roughly like its logarithm; with zero drift it grows like the square root [@magdonismail2004]. Long stretches below a past peak are normal.

</details>

Related: [Drawdown](#drawdown), [Recovery math](#recovery-math), [Sharpe ratio](#sharpe-ratio)

### Expectancy

**Simple:** The average amount you expect to win or lose per trade over many trades.

<details><summary>Analogy</summary>

Like working out that a game where you win 1 pound half the time and lose 2 pounds the other half costs you 50p a go.

</details>

<details><summary>Precise definition</summary>

Win rate times average win minus loss rate times average loss, after costs. A strategy can win most trades and still have negative expectancy, or win few and be positive.

</details>

Related: [Expected value](#expected-value), [Hit rate](#hit-rate), [Risk-reward ratio](#risk-reward-ratio)

### Expected shortfall

**Simple:** The average loss on the really bad days, the ones past the VaR line.

<details><summary>Analogy</summary>

If VaR says how deep the water usually gets, expected shortfall says how deep it is on average when it floods.

</details>

<details><summary>Precise definition</summary>

The expected loss given that the loss exceeds the VaR level, also called conditional VaR. It is a coherent risk measure [@acerbi2002; @artzner1999]. Bank market risk rules moved from VaR to expected shortfall in the Basel framework [@bcbs2019].

</details>

Related: [Value at risk (VaR)](#value-at-risk-var), [Tail risk](#tail-risk)

### Fixed fractional sizing

**Simple:** Risking the same small percentage of whatever your account is worth now on every trade.

<details><summary>Analogy</summary>

Like always eating a quarter of whatever cake is left: you never run out, though the slices get smaller.

</details>

<details><summary>Precise definition</summary>

Each position risks a fixed fraction f of current equity, so size shrinks after losses and grows after gains. In theory this avoids total ruin, though costs, minimum trade sizes and gaps still allow it in practice. The Kelly criterion is the growth-optimal choice of f for a known edge [@thorp2008].

</details>

Related: [Kelly criterion](#kelly-criterion), [Risk of ruin](#risk-of-ruin)

### Fractional Kelly

**Simple:** Betting only a part, like half, of what the Kelly formula says, to be safer.

<details><summary>Analogy</summary>

Like driving a bit under the speed limit because you are not sure how icy the road is.

</details>

<details><summary>Precise definition</summary>

Betting a fraction c of the Kelly amount. With a known edge, growth at c times Kelly is proportional to c times (2 minus c), so half Kelly keeps three quarters of the maximum growth, and twice Kelly gives zero growth. Betting below Kelly is much less harmful if the edge was overestimated [@maclean2011].

</details>

Related: [Kelly criterion](#kelly-criterion), [Overconfidence](#overconfidence)

### Gambler's ruin

**Simple:** The math showing that a player with less money, betting against a richer opponent in a fair or unfair game, will usually go broke eventually.

<details><summary>Analogy</summary>

Like playing tug of war against a team that never gets tired.

</details>

<details><summary>Precise definition</summary>

Results for a random walk with absorbing barriers: a player with finite capital in a game with zero or negative edge is ruined with probability 1 against an opponent with unlimited capital [@feller1968]. Martingale betting systems run into this.

</details>

Related: [Risk of ruin](#risk-of-ruin), [Martingale betting](#martingale-betting)

### Gap risk

**Simple:** The danger that the price jumps past your stop loss, so you lose more than you planned.

<details><summary>Analogy</summary>

Like planning to step off a moving walkway at a certain spot, but the floor drops away first.

</details>

<details><summary>Precise definition</summary>

Loss from discontinuous price moves. On 15 January 2015 the Swiss National Bank removed its 1.20 franc per euro floor [@snb2015], and the franc moved so far so fast that many stops filled far from their levels.

</details>

Related: [Chart gap](#chart-gap), [Stop loss](#stop-loss), [Weekend gap](#weekend-gap), [Fat tails](#fat-tails)

### Kelly criterion

**Simple:** A formula that tells you what share of your money to bet so it grows fastest over many bets, if you know your real chances.

<details><summary>Analogy</summary>

Like knowing exactly how hard to pedal uphill: too little and you crawl, too much and you burn out.

</details>

<details><summary>Precise definition</summary>

The fraction that maximises expected log wealth. For a bet paying b to 1 with win probability p, f = p minus (1 minus p) divided by b. For a continuous asset it is roughly expected excess return divided by variance. Derived by Kelly (1956) [@url-efa4ec7e]; its use in betting and markets is reviewed by Thorp [@thorp2008; @maclean2011]. It assumes the edge is known exactly, which it never is.

</details>

Related: [Fractional Kelly](#fractional-kelly), [Position sizing](#position-sizing), [Risk of ruin](#risk-of-ruin)

### Margin

**Simple:** Money you must keep with your broker as a deposit when you trade with borrowed money.

<details><summary>Analogy</summary>

Like the deposit you pay to rent a bike: you get it back if you return the bike, and you lose it if you break it.

</details>

<details><summary>Precise definition</summary>

Collateral posted against a leveraged position. In the EU, retail CFD rules require initial margin of at least 3.33% for major currency pairs (30 to 1 leverage) [@url-46fb23ac]. In the US, the CFTC's 2010 rule has the National Futures Association set retail forex security deposits within limits the CFTC provides [@cftc2010].

</details>

Related: [Leverage](#leverage), [Margin call](#margin-call), [Stop-out](#stop-out)

### Margin call

**Simple:** A warning from your broker that you have lost so much that your deposit is too small, so you must add money or close trades.

<details><summary>Analogy</summary>

Like the bike shop calling to say the deposit no longer covers the damage.

</details>

<details><summary>Precise definition</summary>

A demand to restore margin above the maintenance level. Retail FX and CFD brokers often skip the call and close positions automatically at a stop-out level.

</details>

Related: [Margin](#margin), [Stop-out](#stop-out)

### Martingale betting

**Simple:** Doubling your bet after every loss so that one win gets everything back.

<details><summary>Analogy</summary>

Like chasing a runaway ball downhill faster and faster: it works until you trip.

</details>

<details><summary>Precise definition</summary>

A system that doubles stake after each loss. It turns many small wins into rare total losses, because capital or limits run out before the streak ends [@feller1968]. It does not change the expected value of the game.

</details>

Related: [Gambler's ruin](#gamblers-ruin), [Averaging down](#averaging-down), [Gambler's fallacy](#gamblers-fallacy)

### Negative balance protection

**Simple:** A rule that you cannot lose more than the money in your account.

<details><summary>Analogy</summary>

Like a safety net under a trampoline: you can fall, but not below the net.

</details>

<details><summary>Precise definition</summary>

A requirement that retail clients' losses are capped at the funds in their account, part of ESMA's 2018 CFD measures [@url-46fb23ac]. It does not exist everywhere; after the Swiss franc floor was removed in January 2015, some clients ended with negative balances [@snb2015].

</details>

Related: [Stop-out](#stop-out), [Gap risk](#gap-risk), [Leverage](#leverage)

### Position sizing

**Simple:** Deciding how much money to put into each trade.

<details><summary>Analogy</summary>

Like deciding how big a slice of cake to take, knowing you might drop it.

</details>

<details><summary>Precise definition</summary>

Choosing trade size given the account size, the expected edge and the risk of the trade. It often matters more for survival than the entry rule. Common methods: fixed fraction of equity at risk, volatility scaling and fractions of Kelly [@carver2015; @thorp2008].

</details>

Related: [Risk per trade](#risk-per-trade), [Kelly criterion](#kelly-criterion), [Volatility position sizing](#volatility-position-sizing)

### Pyramiding

**Simple:** Adding to a trade that is already making money.

<details><summary>Analogy</summary>

Like adding more bricks to a wall only after the first layer has set.

</details>

<details><summary>Precise definition</summary>

Increasing a winning position in steps. It is the opposite of averaging down and is common in trend following. It still raises total exposure, so total risk must be capped.

</details>

Related: [Averaging down](#averaging-down), [Momentum](#momentum)

### Risk of ruin

**Simple:** The chance of losing so much that you cannot keep trading.

<details><summary>Analogy</summary>

Like the chance a gambler runs out of chips before the night ends.

</details>

<details><summary>Precise definition</summary>

The probability that equity falls to a level where trading must stop. Classic gambler's ruin results show that with a fixed bet size even a favourable game has a positive ruin probability, and an unfavourable game ends in ruin with certainty given enough time [@feller1968]. Larger bets relative to capital raise it sharply.

</details>

Related: [Gambler's ruin](#gamblers-ruin), [Fixed fractional sizing](#fixed-fractional-sizing), [Leverage](#leverage)

### Risk per trade

**Simple:** The most money you agree to lose on one trade if it goes wrong, often a small share of your account.

<details><summary>Analogy</summary>

Like only betting pocket money you can afford to lose, never your bus fare home.

</details>

<details><summary>Precise definition</summary>

The loss if the stop is hit, as a share of equity. The common '1 to 2 percent' rule has little direct large-sample evidence (see RES-0006), but the arithmetic is sound: small fixed fractions make a long losing streak survivable. Gaps can make the real loss larger than planned.

</details>

Related: [Fixed fractional sizing](#fixed-fractional-sizing), [Stop loss](#stop-loss), [Gap risk](#gap-risk)

### Risk-reward ratio

**Simple:** How much you could win on a trade compared with how much you could lose.

<details><summary>Analogy</summary>

Like a bet where you risk 1 sweet to win 3.

</details>

<details><summary>Precise definition</summary>

Distance to target divided by distance to stop. A high ratio is not good by itself: with a low enough chance of reaching the target the expected value is still negative. Only ratio and win rate together give expectancy.

</details>

Related: [Expectancy](#expectancy), [Hit rate](#hit-rate), [Myth: a high win rate means a good strategy](#myth-a-high-win-rate-means-a-good-strategy)

### Slippage

**Simple:** The difference between the price you expected and the price you actually got.

<details><summary>Analogy</summary>

Like ordering a 2 pound sandwich and being charged 2.10 because the price changed while you queued.

</details>

<details><summary>Precise definition</summary>

Execution price minus the reference price at the time of the decision. It rises with order size, volatility and thin markets, and is part of total transaction costs.

</details>

Related: [Transaction costs](#transaction-costs), [Spread (bid and ask)](#spread-bid-and-ask), [Liquidity](#liquidity)

### Stop loss

**Simple:** An order that closes your trade automatically if the price moves against you by a set amount.

<details><summary>Analogy</summary>

Like a smoke alarm that goes off before the whole house burns.

</details>

<details><summary>Precise definition</summary>

An order to exit once a price is reached. It becomes a market order, so in a gap it fills at the next available price, which may be much worse. FX stop orders cluster just beyond round numbers [@osler2003].

</details>

Related: [Gap risk](#gap-risk), [Take profit](#take-profit), [Trailing stop](#trailing-stop), [Myth: a stop loss caps your loss exactly](#myth-a-stop-loss-caps-your-loss-exactly)

### Stop-out

**Simple:** When the broker closes your trades for you because your account fell too low.

<details><summary>Analogy</summary>

Like a referee stopping a boxing match before someone gets badly hurt.

</details>

<details><summary>Precise definition</summary>

Automatic liquidation at a set margin level. ESMA's retail CFD rules require brokers to close positions once account equity falls to 50% of the required margin [@url-46fb23ac]. The fill can still be far from that level in a fast market.

</details>

Related: [Margin call](#margin-call), [Negative balance protection](#negative-balance-protection), [Gap risk](#gap-risk)

### Stress test

**Simple:** Checking what would happen to your money in a really bad scenario.

<details><summary>Analogy</summary>

Like a fire drill: practise the disaster before it happens.

</details>

<details><summary>Precise definition</summary>

Revaluing a portfolio under extreme but plausible moves, either historical (for example January 2015 in the franc, 2008 in carry trades) or made up. It complements VaR, which says little about extremes [@jorion2006].

</details>

Related: [Value at risk (VaR)](#value-at-risk-var), [Tail risk](#tail-risk)

### Tail risk

**Simple:** The risk of very rare but very big moves.

<details><summary>Analogy</summary>

Like the chance of a hundred-year flood: rare, but it can wipe out everything at once.

</details>

<details><summary>Precise definition</summary>

Risk from extreme outcomes far from the average. Mandelbrot (1963) proposed replacing the normal distribution of price changes with fatter-tailed stable laws [@mandelbrot1963]. Carry trades are a known example of strategies with crash risk [@brunnermeier2008].

</details>

Related: [Fat tails](#fat-tails), [Negative skew](#negative-skew), [Expected shortfall](#expected-shortfall)

### Take profit

**Simple:** An order that closes your trade automatically once it has made a set amount.

<details><summary>Analogy</summary>

Like deciding before a game that you will leave the arcade once you win ten tickets.

</details>

<details><summary>Precise definition</summary>

A limit order to exit at a target price. In FX these cluster at round numbers, which may be one reason trends often pause there [@osler2003].

</details>

Related: [Stop loss](#stop-loss), [Round number clustering](#round-number-clustering)

### Trailing stop

**Simple:** A stop loss that moves up as the price moves in your favour, but never moves back down.

<details><summary>Analogy</summary>

Like a climber's rope clipped higher as they climb, so a fall is never all the way to the bottom.

</details>

<details><summary>Precise definition</summary>

A stop set a fixed distance or volatility multiple behind the best price since entry. It turns any trade into a simple trend rule on exit.

</details>

Related: [Stop loss](#stop-loss), [Average true range (ATR)](#average-true-range-atr)

### Value at risk (VaR)

**Simple:** A number that says 'on most days, we should not lose more than this much'.

<details><summary>Analogy</summary>

Like a weather report saying 'there is only a 1 in 20 chance of more than 10 mm of rain', which tells you nothing about how bad that 1 day might be.

</details>

<details><summary>Precise definition</summary>

The loss level not exceeded with a given probability over a given horizon, for example 99% one-day VaR. It says nothing about how large losses are beyond that level and is not always subadditive, so combining positions can appear to raise it [@jorion2006; @artzner1999].

</details>

Related: [Expected shortfall](#expected-shortfall), [Fat tails](#fat-tails), [Tail risk](#tail-risk)

### Volatility position sizing

**Simple:** Making trades smaller when the price is jumpy and bigger when it is calm, so each trade carries about the same risk.

<details><summary>Analogy</summary>

Like walking more carefully on ice and striding out on dry pavement.

</details>

<details><summary>Precise definition</summary>

Size each position inversely to its forecast volatility. Moreira and Muir (2017) found scaling exposure by inverse variance raised Sharpe ratios for several factors [@moreira2017]. It is the core of Carver's sizing method [@carver2015].

</details>

Related: [Volatility targeting](#volatility-targeting), [Average true range (ATR)](#average-true-range-atr), [Position sizing](#position-sizing)

## Capital and returns

### Annualised return

**Simple:** A return turned into a 'per year' number so that different time periods can be compared.

<details><summary>Analogy</summary>

Like saying a runner's pace in kilometres per hour even if they only ran for ten minutes.

</details>

<details><summary>Precise definition</summary>

For compounding: (1 plus total return) to the power (1 divided by years) minus 1. Annualising a short, lucky period gives huge and misleading numbers.

</details>

Related: [CAGR](#cagr), [Annualised volatility](#annualised-volatility)

### Annualised volatility

**Simple:** How jumpy returns are, scaled to a one-year number.

<details><summary>Analogy</summary>

Like converting a daily wobble into a yearly wobble so you can compare a boat and a ship.

</details>

<details><summary>Precise definition</summary>

Standard deviation of period returns times the square root of periods per year (about 252 trading days or 52 weeks), assuming returns are independent. Volatility grows with the square root of time, not with time.

</details>

Related: [Volatility](#volatility), [Annualised return](#annualised-return), [Sharpe ratio](#sharpe-ratio)

### Arithmetic mean return

**Simple:** The plain average of returns: add them up and divide by how many there are.

<details><summary>Analogy</summary>

Like averaging your test scores. It can look better than how much you actually learned over the year.

</details>

<details><summary>Precise definition</summary>

The simple average of period returns. It overstates what an investor actually earns over time when returns vary: +50% then -50% averages 0% but leaves you 25% down.

</details>

Related: [Geometric mean return](#geometric-mean-return), [Volatility drag](#volatility-drag), [CAGR](#cagr)

### Arithmetic of active management

**Simple:** Before costs, all the people trying to beat the market together just get the market return. After costs, they get less.

<details><summary>Analogy</summary>

If everyone at a poker table pays the house a fee, the table as a whole must lose.

</details>

<details><summary>Precise definition</summary>

Sharpe (1991): the average actively managed dollar must earn the market return before costs and less after costs [@sharpe1991]. Trading is zero-sum before costs relative to the market, and negative-sum after.

</details>

Related: [Management fee](#management-fee), [Benchmark](#benchmark), [Efficient market](#efficient-market)

### Compounding

**Simple:** Earning returns on your earlier returns, so money grows faster and faster over time.

<details><summary>Analogy</summary>

Like a snowball rolling downhill, picking up more snow the bigger it gets.

</details>

<details><summary>Precise definition</summary>

Growth where each period's return applies to the accumulated value: final value equals start times the product of (1 plus r) over all periods. It works the same way on losses, which is why big losses are so costly.

</details>

Related: [CAGR](#cagr), [Recovery math](#recovery-math), [Rule of 72](#rule-of-72)

### Ergodicity

**Simple:** Whether the average over many people is the same as what happens to one person over time. In money, it often is not.

<details><summary>Analogy</summary>

A hundred people each playing Russian roulette once is not the same as one person playing it a hundred times.

</details>

<details><summary>Precise definition</summary>

A process is ergodic if time averages equal ensemble averages. Multiplicative wealth processes are not: an expected-value-positive bet can still make almost every individual poorer over time, which is why growth rates (log returns) matter [@peters2019]. This is the idea behind the Kelly criterion.

</details>

Related: [Kelly criterion](#kelly-criterion), [Volatility drag](#volatility-drag), [Geometric mean return](#geometric-mean-return)

### Few big winners

**Simple:** In stock markets, most of the gains came from a small number of companies. Most single stocks did worse than cash.

<details><summary>Analogy</summary>

Like a lottery: a few huge prizes make the average look good, while most tickets lose.

</details>

<details><summary>Precise definition</summary>

Bessembinder (2018) found that most US common stocks since 1926 had lifetime buy-and-hold returns below one-month Treasury bills, and about 4% of companies accounted for the net wealth created by the market [@bessembinder2018].

</details>

Related: [Negative skew](#negative-skew), [Diversification](#diversification), [Survivorship bias](#survivorship-bias)

### Geometric mean return

**Simple:** The steady yearly growth rate that would turn your starting money into your ending money.

<details><summary>Analogy</summary>

Like working out the one constant speed that would get you to the finish in the same time as your stop-start drive.

</details>

<details><summary>Precise definition</summary>

The nth root of the product of (1 plus r) minus 1. It is always at or below the arithmetic mean, and roughly equal to the arithmetic mean minus half the variance [@messmore1995]. Over years it is the same as CAGR.

</details>

Related: [Arithmetic mean return](#arithmetic-mean-return), [Volatility drag](#volatility-drag), [CAGR](#cagr)

### High-water mark

**Simple:** The highest value an account or fund has reached. Performance fees are usually only paid on gains above it.

<details><summary>Analogy</summary>

Like the line a flood leaves on a wall: the water has to rise above it to count as a new record.

</details>

<details><summary>Precise definition</summary>

The peak net asset value used to compute performance fees and drawdowns. A fund below its high-water mark is in drawdown.

</details>

Related: [Performance fee](#performance-fee), [Drawdown](#drawdown)

### Inflation

**Simple:** When prices of things in shops go up over time, so the same money buys less.

<details><summary>Analogy</summary>

Like a bag of crisps that costs a bit more every year.

</details>

<details><summary>Precise definition</summary>

The rate of change of a price index such as the consumer price index. Differences in inflation between countries are the base of purchasing power parity.

</details>

Related: [Real return](#real-return), [Purchasing power parity (PPP)](#purchasing-power-parity-ppp), [Real exchange rate](#real-exchange-rate)

### Log return

**Simple:** A way of measuring returns that lets you just add them up over time.

<details><summary>Analogy</summary>

Like measuring a journey in steps you can add, instead of percentages of the distance left.

</details>

<details><summary>Precise definition</summary>

The natural log of (end price divided by start price). Log returns add across time, and a +x and -x log return cancel exactly, unlike simple returns.

</details>

Related: [Simple return](#simple-return), [Compounding](#compounding)

### Management fee

**Simple:** A fee charged every year as a percent of the money a fund manages, whether it makes money or not.

<details><summary>Analogy</summary>

Like paying a gardener a fixed amount each month, even in months nothing grows.

</details>

<details><summary>Precise definition</summary>

An annual charge on assets under management. French (2008) estimated US investors spent about 0.67% of the total market value each year trying to beat the market, and that a typical investor would have done better in a passive fund [@french2008].

</details>

Related: [Performance fee](#performance-fee), [Net and gross return](#net-and-gross-return), [Arithmetic of active management](#arithmetic-of-active-management)

### Money-weighted return

**Simple:** A return that counts when you put money in and took it out, so it shows how you did, not just the strategy.

<details><summary>Analogy</summary>

Like a race where your score depends on how fast you ran while carrying the most weight.

</details>

<details><summary>Precise definition</summary>

The internal rate of return on all cash flows. If investors add money after good years and pull it after bad years, their money-weighted return can be well below the fund's time-weighted return.

</details>

Related: [Time-weighted return](#time-weighted-return), [Recency bias](#recency-bias)

### Net and gross return

**Simple:** Gross return is before costs and fees. Net return is what you actually keep.

<details><summary>Analogy</summary>

Like the price on a payslip before tax, and what lands in your bank.

</details>

<details><summary>Precise definition</summary>

Gross minus trading costs, fees, financing and taxes equals net. Barber and Odean (2000) found frequent traders' gross returns were close to the market but net returns far below it [@barber2000].

</details>

Related: [Transaction costs](#transaction-costs), [Management fee](#management-fee), [Overtrading](#overtrading)

### Nominal return

**Simple:** How much your money grew in plain numbers, without thinking about prices going up.

<details><summary>Analogy</summary>

Like getting a bigger allowance without noticing sweets got more expensive too.

</details>

<details><summary>Precise definition</summary>

Return measured in currency units, before adjusting for inflation.

</details>

Related: [Real return](#real-return), [Inflation](#inflation)

### Opportunity cost

**Simple:** What you give up by choosing one thing instead of another.

<details><summary>Analogy</summary>

If you spend Saturday at the cinema, you cannot also spend it at the beach.

</details>

<details><summary>Precise definition</summary>

The value of the best foregone alternative. For a trading strategy, the alternatives are cash at the risk-free rate and a cheap index fund; our S&P 500 benchmark is the second.

</details>

Related: [Risk-free rate](#risk-free-rate), [Benchmark](#benchmark)

### Performance fee

**Simple:** A fee taken as a share of the profits a fund makes.

<details><summary>Analogy</summary>

Like a coach who takes a cut of your prize money.

</details>

<details><summary>Precise definition</summary>

A share of returns above a hurdle, often 20%, usually charged only above a high-water mark. It is asymmetric: the manager shares gains but not losses, which can encourage risk taking.

</details>

Related: [High-water mark](#high-water-mark), [Management fee](#management-fee)

### Real return

**Simple:** How much more stuff your money can buy after accounting for rising prices.

<details><summary>Analogy</summary>

Like checking how many more sweets your bigger allowance actually buys.

</details>

<details><summary>Precise definition</summary>

Nominal return adjusted for inflation: (1 plus nominal) divided by (1 plus inflation) minus 1, roughly nominal minus inflation. Long-run studies of world markets report real returns because nominal figures mislead across eras [@dimson2002].

</details>

Related: [Nominal return](#nominal-return), [Inflation](#inflation)

### Recovery math

**Simple:** After you lose some money, you need a bigger percent gain to get back to where you started.

<details><summary>Analogy</summary>

Like a ball dropped from a height: losing half needs doubling to get back up.

</details>

<details><summary>Precise definition</summary>

To recover from a loss L you need a gain of L divided by (1 minus L): 10% needs 11.1%, 25% needs 33.3%, 50% needs 100% and 90% needs 900%.

</details>

Related: [Drawdown](#drawdown), [Compounding](#compounding), [Drawdown duration](#drawdown-duration)

### Risk-free rate

**Simple:** The return you could get with almost no risk, like a short loan to the government.

<details><summary>Analogy</summary>

Like the interest from keeping money in the safest piggy bank there is.

</details>

<details><summary>Precise definition</summary>

Usually the yield on short-dated government bills in the relevant currency. Excess returns and the Sharpe ratio are measured over it. A strategy that does not beat it has earned nothing for the risk taken.

</details>

Related: [Excess return](#excess-return), [Sharpe ratio](#sharpe-ratio), [Opportunity cost](#opportunity-cost)

### Rule of 72

**Simple:** A shortcut: divide 72 by the yearly percent return to guess how many years it takes to double your money.

<details><summary>Analogy</summary>

At 8% a year, 72 divided by 8 is 9, so about 9 years to double.

</details>

<details><summary>Precise definition</summary>

An approximation to ln(2) divided by ln(1 plus r), accurate for rates around 6% to 10%. It also gives how fast inflation halves purchasing power.

</details>

Related: [Compounding](#compounding), [CAGR](#cagr)

### Simple return

**Simple:** How much the price changed as a percent: end minus start, divided by start.

<details><summary>Analogy</summary>

Like saying your height went from 100 cm to 110 cm, a 10% gain.

</details>

<details><summary>Precise definition</summary>

(P1 minus P0) divided by P0. Simple returns add across assets in a portfolio but not across time; log returns add across time but not across assets.

</details>

Related: [Log return](#log-return), [Return](#return)

### Time-weighted return

**Simple:** A return that measures how well the strategy did, ignoring when money was added or taken out.

<details><summary>Analogy</summary>

Like timing a runner's laps, no matter how many people joined the race halfway.

</details>

<details><summary>Precise definition</summary>

Chain-linked returns between cash flows. It measures the manager or strategy, not the investor's timing, and is the standard for comparing funds.

</details>

Related: [Money-weighted return](#money-weighted-return), [CAGR](#cagr)

### Volatility drag

**Simple:** Big ups and downs make your money grow slower than the average return suggests.

<details><summary>Analogy</summary>

Like a car that speeds up and brakes a lot: it uses more fuel and gets there later than one that drives steadily.

</details>

<details><summary>Precise definition</summary>

The gap between arithmetic and geometric mean returns, about half the variance per period (also called variance drain) [@messmore1995]. A strategy with 10% average return and 30% volatility compounds at roughly 10% minus 4.5%, or 5.5%, a year.

</details>

Related: [Geometric mean return](#geometric-mean-return), [Volatility](#volatility), [Leverage](#leverage)

## FX market structure

### A-book and B-book

**Simple:** Two ways a broker can handle your trade: pass it on to the market (A-book) or keep the other side itself (B-book).

<details><summary>Analogy</summary>

A-book is a travel agent booking your flight with an airline; B-book is a bookmaker taking your bet.

</details>

<details><summary>Precise definition</summary>

In a B-book model the broker is the counterparty, so client losses are broker revenue, which is a conflict of interest that must be managed. Many brokers use a mix, sending profitable clients' flow to the market. Broker practices are not standardised, so this is a description of common usage rather than a rule.

</details>

Related: [Market maker](#market-maker), [ECN](#ecn), [Contract for difference (CFD)](#contract-for-difference-cfd)

### Base and quote currency

**Simple:** In a pair like EUR/USD, the euro is the base (the thing being priced) and the dollar is the quote (the money used to price it).

<details><summary>Analogy</summary>

Like the price tag on an apple: the apple is the base, the coins are the quote.

</details>

<details><summary>Precise definition</summary>

A quote of 1.10 for EUR/USD means 1 euro costs 1.10 dollars. Buying the pair means buying the base and selling the quote. Market conventions decide which currency is the base.

</details>

Related: [Currency pair](#currency-pair), [Exchange rate](#exchange-rate)

### Bid and ask

**Simple:** The bid is the price someone will pay you to buy from you. The ask is the price you pay to buy. The ask is always a little higher.

<details><summary>Analogy</summary>

Like a currency booth at the airport that buys your euros cheap and sells them to you dear.

</details>

<details><summary>Precise definition</summary>

Best price to sell at (bid) and to buy at (ask or offer). The difference is the spread, which a trader pays by crossing it.

</details>

Related: [Spread (bid and ask)](#spread-bid-and-ask), [Liquidity](#liquidity), [Transaction costs](#transaction-costs)

### BIS Triennial Survey

**Simple:** A survey done every three years by central banks that counts how much currency trading happens around the world.

<details><summary>Analogy</summary>

Like a national census, but for currency trading.

</details>

<details><summary>Precise definition</summary>

The Bank for International Settlements' survey of FX turnover. April 2025: 9.6 trillion US dollars a day, up 28% from 2022; spot was 3 trillion (31%); the dollar was on one side of 89.2% of trades [@bis2025].

</details>

Related: [Over-the-counter market](#over-the-counter-market), [US dollar dominance](#us-dollar-dominance), [FX swap](#fx-swap)

### Central bank intervention

**Simple:** When a central bank buys or sells its own currency to push the exchange rate.

<details><summary>Analogy</summary>

Like a referee stepping into a game to stop it getting out of hand.

</details>

<details><summary>Precise definition</summary>

Official purchases or sales of foreign exchange. Some regimes defend a floor or peg; when one is abandoned the move can be sudden, as when the Swiss National Bank ended its 1.20 floor on 15 January 2015 [@snb2015].

</details>

Related: [Central bank](#central-bank), [Gap risk](#gap-risk), [Currency peg](#currency-peg)

### Contract for difference (CFD)

**Simple:** A bet with a broker on whether a price goes up or down, where you never own the real thing.

<details><summary>Analogy</summary>

Like betting with a friend on a race instead of owning a horse.

</details>

<details><summary>Precise definition</summary>

A contract paying the change in an underlying price, usually on margin. ESMA found 74 to 89% of retail CFD accounts typically lost money and in 2018 restricted leverage, added margin close-out and negative balance protection, and required risk warnings [@url-46fb23ac].

</details>

Related: [Leverage](#leverage), [Margin](#margin), [A-book and B-book](#a-book-and-b-book), [Myth: if you stick with it, you will eventually make money](#myth-if-you-stick-with-it-you-will-eventually-make-money)

### Currency peg

**Simple:** When a country fixes its currency to another currency, like the US dollar, at a set rate.

<details><summary>Analogy</summary>

Like tying a small boat to a big ship so they move together.

</details>

<details><summary>Precise definition</summary>

A fixed or tightly managed exchange rate kept by central bank policy. Pegs look calm until they break, which makes past volatility a poor guide to risk.

</details>

Related: [Central bank intervention](#central-bank-intervention), [Tail risk](#tail-risk)

### ECN

**Simple:** An electronic marketplace where many buyers and sellers post prices and trade with each other directly.

<details><summary>Analogy</summary>

Like an online auction site where everyone can see and accept offers.

</details>

<details><summary>Precise definition</summary>

Electronic communication network: a venue matching orders from many participants. Retail 'ECN' accounts usually route to liquidity providers and charge a commission plus a raw spread; how close this is to a true multilateral venue varies by broker.

</details>

Related: [Over-the-counter market](#over-the-counter-market), [A-book and B-book](#a-book-and-b-book), [Last look](#last-look)

### Fixing

**Simple:** An official exchange rate taken at a set time each day, used by many funds and firms to value or trade.

<details><summary>Analogy</summary>

Like the official time on a station clock that everyone sets their watch by.

</details>

<details><summary>Precise definition</summary>

A benchmark rate computed from trades around a set time. The most used is the WM/Reuters 4 pm London fix. After manipulation cases, the Financial Stability Board recommended changes to how such benchmarks are set and traded around [@fsb2014].

</details>

Related: [London 4 pm fix](#london-4-pm-fix), [Non-deliverable forward (NDF)](#non-deliverable-forward-ndf)

### Forward points

**Simple:** The small number added to or taken from today's rate to get a future rate. It comes from the interest rate difference between the two currencies.

<details><summary>Analogy</summary>

Like the extra charged to hold an item at a shop until next month, depending on what the shop could have earned on the money.

</details>

<details><summary>Precise definition</summary>

Forward rate minus spot rate, quoted in pips. By covered interest parity they reflect the interest differential; since 2008 measurable deviations from this have persisted [@du2018].

</details>

Related: [Forward rate](#forward-rate), [Covered interest parity](#covered-interest-parity), [FX swap](#fx-swap)

### Funding currency

**Simple:** The low-interest currency people borrow to buy a higher-interest currency in a carry trade.

<details><summary>Analogy</summary>

Like borrowing cheaply from one bank to put money in another bank that pays more.

</details>

<details><summary>Precise definition</summary>

The short leg of a carry trade, such as the yen or Swiss franc at times of very low rates. When carry trades unwind in a crisis, funding currencies tend to jump [@brunnermeier2008].

</details>

Related: [Carry trade](#carry-trade), [Safe-haven currency](#safe-haven-currency)

### FX swap

**Simple:** A deal to swap currencies now and swap them back later at a set rate. It is mostly used to borrow one currency using another.

<details><summary>Analogy</summary>

Like lending a friend your bike for their skateboard, and agreeing to swap back next week.

</details>

<details><summary>Precise definition</summary>

A spot (or near) leg and an opposite forward leg in one trade. FX swaps are the most traded FX instrument: about 4 trillion US dollars a day in April 2025, 42% of turnover [@bis2025].

</details>

Related: [Forward points](#forward-points), [Rollover (swap)](#rollover-swap), [BIS Triennial Survey](#bis-triennial-survey)

### Interdealer market

**Simple:** Where the big banks trade currencies with each other.

<details><summary>Analogy</summary>

Like the wholesale market where shops buy their stock before selling it to you.

</details>

<details><summary>Precise definition</summary>

The segment where dealers trade among themselves, mostly on EBS and Refinitiv Matching for spot. Its share has fallen as dealers internalise client flow and non-bank market makers have grown [@king2012].

</details>

Related: [Over-the-counter market](#over-the-counter-market), [ECN](#ecn), [Market maker](#market-maker)

### Last look

**Simple:** A short pause that lets a price-giver decide whether to accept a trade at the price they showed.

<details><summary>Analogy</summary>

Like a shopkeeper who can still say 'sorry, the price changed' after you hand over your money.

</details>

<details><summary>Precise definition</summary>

A window in which a liquidity provider can reject or re-price a trade request against its quote. The FX Global Code sets good-practice principles for the wholesale FX market [@gfxc2024]. Oomen (2017) models how last look trades off tighter quotes against rejection risk [@oomen2017].

</details>

Related: [ECN](#ecn), [Slippage](#slippage), [Market maker](#market-maker)

### Liquidity

**Simple:** How easily you can buy or sell a lot of something quickly without moving the price much.

<details><summary>Analogy</summary>

Like how easily you can sell bread in a busy town versus a tiny village.

</details>

<details><summary>Precise definition</summary>

The ability to trade size quickly at low cost. In FX it is deepest in major pairs during the London and New York overlap and thinnest around the weekend open, holidays and the late New York afternoon.

</details>

Related: [Market depth](#market-depth), [Spread (bid and ask)](#spread-bid-and-ask), [Trading sessions](#trading-sessions)

### London 4 pm fix

**Simple:** The most widely used daily exchange rate snapshot, taken around 4 pm in London.

<details><summary>Analogy</summary>

Like a class photo at a set time: everyone wants to look right at that moment.

</details>

<details><summary>Precise definition</summary>

The WM/Reuters (now WM/Refinitiv) closing spot rate, used to value many index funds. Large orders done 'at the fix' create predictable flows around it, studied in our algorithm ALG-0009. Reforms followed the 2014 FSB report [@fsb2014].

</details>

Related: [Fixing](#fixing), [Order flow](#order-flow)

### London and New York overlap

**Simple:** The few hours each day when both London and New York are open, which is the busiest time for currency trading.

<details><summary>Analogy</summary>

Like rush hour, when two shifts of workers are on the road at once.

</details>

<details><summary>Precise definition</summary>

Roughly 8 am to noon New York time. Major US data releases and the 4 pm London fix fall in or near this window, so spreads are tight and moves can be large.

</details>

Related: [Trading sessions](#trading-sessions), [London 4 pm fix](#london-4-pm-fix), [Macro surprise](#macro-surprise)

### Lot

**Simple:** A standard bundle size for a trade.

<details><summary>Analogy</summary>

Like eggs sold by the dozen or half dozen.

</details>

<details><summary>Precise definition</summary>

In retail FX a standard lot is 100,000 units of the base currency, a mini lot 10,000 and a micro lot 1,000. In the interbank market, trades are quoted in millions.

</details>

Related: [Pip](#pip), [Notional exposure](#notional-exposure)

### Majors, crosses and exotics

**Simple:** Majors are the most traded pairs with the US dollar, like EUR/USD. Crosses do not include the dollar, like EUR/GBP. Exotics include a less traded currency, like USD/TRY.

<details><summary>Analogy</summary>

Like main roads, side roads and dirt tracks: the dirt tracks cost more to drive and can be bumpy.

</details>

<details><summary>Precise definition</summary>

Common usage: majors are the dollar against EUR, JPY, GBP, CHF, CAD, AUD and NZD; crosses pair two non-dollar currencies; exotics involve emerging-market currencies with wider spreads and more gap risk. EU leverage limits are 30 to 1 on majors and 20 to 1 on the rest [@url-46fb23ac].

</details>

Related: [G10 currencies](#g10-currencies), [Currency pair](#currency-pair), [Spread (bid and ask)](#spread-bid-and-ask)

### Market depth

**Simple:** How much people are willing to buy or sell at each price near the current price.

<details><summary>Analogy</summary>

Like how many people are queuing to buy and sell at each stall in a market.

</details>

<details><summary>Precise definition</summary>

Quantity available at each price level of the order book. Shallow depth means larger orders move the price and cause slippage.

</details>

Related: [Liquidity](#liquidity), [Slippage](#slippage), [Order flow](#order-flow)

### Market maker

**Simple:** A firm that always offers to both buy and sell, and earns the small gap between the two prices.

<details><summary>Analogy</summary>

Like the airport currency booth, which makes money from the gap between its buy and sell rates.

</details>

<details><summary>Precise definition</summary>

A dealer quoting two-way prices and managing the resulting inventory. In FX these are large banks and, increasingly, non-bank electronic firms [@king2012]. Models such as Avellaneda and Stoikov describe how quotes shift with inventory (ALG-0021).

</details>

Related: [Bid and ask](#bid-and-ask), [Spread (bid and ask)](#spread-bid-and-ask), [A-book and B-book](#a-book-and-b-book)

### Non-deliverable forward (NDF)

**Simple:** A forward deal for a currency that cannot be freely moved, where only the profit or loss is paid in dollars instead of swapping the currencies.

<details><summary>Analogy</summary>

Like betting on the price of a house you are not allowed to buy, and just settling the difference in cash.

</details>

<details><summary>Precise definition</summary>

A cash-settled forward, typically in US dollars, against an official fixing. Used for currencies with capital controls, such as the Indian rupee or Korean won. The BIS has tracked how this market has grown [@mccauley2014].

</details>

Related: [Outright forward](#outright-forward), [Fixing](#fixing)

### Notional exposure

**Simple:** The full size of the trade, not just the deposit you put down.

<details><summary>Analogy</summary>

Like the full price of a house, not just the deposit you paid.

</details>

<details><summary>Precise definition</summary>

Position size times price in account currency. Effective leverage is total notional divided by account equity; it, not the broker's maximum, sets how much a 1% move changes the account.

</details>

Related: [Leverage](#leverage), [Lot](#lot), [Margin](#margin)

### Outright forward

**Simple:** An agreement to exchange currencies on a future date at a price fixed today.

<details><summary>Analogy</summary>

Like booking a hotel room now at today's price for a trip next summer.

</details>

<details><summary>Precise definition</summary>

A single FX transaction settling after spot, at the spot rate plus forward points. Used by firms to hedge known future payments.

</details>

Related: [Forward rate](#forward-rate), [Forward points](#forward-points), [Non-deliverable forward (NDF)](#non-deliverable-forward-ndf)

### Over-the-counter market

**Simple:** A market with no single central exchange, where banks and traders deal directly with each other.

<details><summary>Analogy</summary>

Like a busy street market with many stalls instead of one big supermarket checkout.

</details>

<details><summary>Precise definition</summary>

Spot FX trades over the counter between dealers and clients and on several electronic venues, so there is no single official price or volume [@king2012]. Volume data come mainly from the BIS triennial survey [@bis2025].

</details>

Related: [Interdealer market](#interdealer-market), [ECN](#ecn), [BIS Triennial Survey](#bis-triennial-survey)

### Pip

**Simple:** The smallest usual step a currency price moves by. For most pairs it is the fourth decimal place, 0.0001.

<details><summary>Analogy</summary>

Like a single cent on a price tag.

</details>

<details><summary>Precise definition</summary>

One unit of the fourth decimal for most pairs (0.0001) and of the second decimal for yen pairs (0.01). Pip value in money depends on trade size and the quote currency: 1 pip on 100,000 EUR/USD is 10 US dollars.

</details>

Related: [Pipette](#pipette), [Lot](#lot), [Spread (bid and ask)](#spread-bid-and-ask)

### Pipette

**Simple:** A tenth of a pip. Many platforms show prices with one extra decimal.

<details><summary>Analogy</summary>

Like a tenth of a cent.

</details>

<details><summary>Precise definition</summary>

The fifth decimal (or third for yen pairs). Quoting in pipettes lets spreads be shown more finely, such as 0.8 pips.

</details>

Related: [Pip](#pip)

### Rollover (swap)

**Simple:** A small daily payment or charge for keeping a currency trade open overnight, based on the difference in interest rates.

<details><summary>Analogy</summary>

Like getting paid rent for lending out a room, while paying rent for the room you borrowed.

</details>

<details><summary>Precise definition</summary>

Retail positions held past the daily cut-off (usually 5 pm New York) are rolled to the next value date, with a credit or debit based on the interest rate differential (from tom-next swap points) minus a broker markup. It is how carry is paid or charged in retail FX.

</details>

Related: [Carry](#carry), [Forward points](#forward-points), [FX swap](#fx-swap)

### Safe-haven currency

**Simple:** A currency people buy when they are scared, like the Swiss franc or the Japanese yen.

<details><summary>Analogy</summary>

Like running indoors when it starts to rain.

</details>

<details><summary>Precise definition</summary>

A currency that tends to gain when global risk rises. Ranaldo and Soderlind (2010) found the Swiss franc and Japanese yen gained against the US dollar when US stocks fell and bond prices and FX volatility rose [@ranaldo2010].

</details>

Related: [Funding currency](#funding-currency), [Carry trade](#carry-trade)

### Spot settlement (T+2)

**Simple:** When you trade currencies 'spot', the money actually changes hands two working days later for most pairs.

<details><summary>Analogy</summary>

Like buying a concert ticket today that gets delivered in two days.

</details>

<details><summary>Precise definition</summary>

Spot FX usually settles two business days after the trade date (T+2); USD/CAD and a few others settle T+1. The settlement day is the value date. Retail platforms roll positions each day so they never settle.

</details>

Related: [Value date](#value-date), [Rollover (swap)](#rollover-swap), [Spot rate](#spot-rate)

### Stop hunting

**Simple:** The idea that big traders push the price to where many stop losses sit, to trigger them.

<details><summary>Analogy</summary>

Like someone knocking over the first domino because they know a long row is lined up behind it.

</details>

<details><summary>Precise definition</summary>

Moves that trigger clustered stop orders can feed on themselves: Osler (2003) found trends speed up after rates cross round numbers, where stop-loss orders cluster [@osler2003]. Deliberate targeting by a specific party is hard to prove from public data; we found no large-sample evidence on intent.

</details>

Related: [Round number clustering](#round-number-clustering), [Stop loss](#stop-loss), [False breakout](#false-breakout)

### Trading sessions

**Simple:** Currencies trade almost 24 hours on weekdays, passing from Asia to Europe to America as the day moves round the world.

<details><summary>Analogy</summary>

Like a relay race where the baton passes from Tokyo to London to New York.

</details>

<details><summary>Precise definition</summary>

FX trades from about Sunday evening to Friday 5 pm New York time. The UK has the largest share of trading at about 38%, then the US at about 19%, Singapore at 11.8% and Hong Kong at 7.0% (April 2025) [@bis2025].

</details>

Related: [Liquidity](#liquidity), [London and New York overlap](#london-and-new-york-overlap), [Weekend gap](#weekend-gap)

### US dollar dominance

**Simple:** Almost every currency trade involves the US dollar on one side.

<details><summary>Analogy</summary>

Like a train network where nearly every route goes through the same main station.

</details>

<details><summary>Precise definition</summary>

The dollar was on one side of 89.2% of all FX trades in April 2025 [@bis2025]. A common dollar factor explains much of the variation in currency returns [@lustig2011].

</details>

Related: [BIS Triennial Survey](#bis-triennial-survey), [Correlation risk](#correlation-risk)

### Value date

**Simple:** The day the two currencies in a trade are actually paid.

<details><summary>Analogy</summary>

Like the day a cheque actually clears.

</details>

<details><summary>Precise definition</summary>

The settlement date of an FX transaction. It must be a business day in both currencies' countries.

</details>

Related: [Spot settlement (T+2)](#spot-settlement-t2), [Forward points](#forward-points)

### Weekend gap

**Simple:** A jump in price between Friday's close and Sunday's open, because the market was shut while news kept happening.

<details><summary>Analogy</summary>

Like coming back from holiday to find the shop prices all changed.

</details>

<details><summary>Precise definition</summary>

Retail FX venues close from about Friday 5 pm to Sunday 5 pm New York time. Stops cannot fill in between, so positions held over the weekend carry gap risk.

</details>

Related: [Gap risk](#gap-risk), [Chart gap](#chart-gap), [Trading sessions](#trading-sessions)

## Myths and false notions

### Myth: a great backtest proves a strategy works

**Simple:** If a strategy made lots of money on past data, people assume it will keep doing so. Usually it was just fitted to the past.

<details><summary>Analogy</summary>

Like a key cut to fit one lock perfectly: it does not open any other door.

</details>

<details><summary>Precise definition</summary>

Testing many variations makes some look good by chance. Harvey, Liu and Zhu (2015) argued new factors need a t-statistic above about 3 [@harvey2015]; Bailey and coauthors showed how to estimate the probability that a selected backtest is overfit [@bailey2016].

</details>

Related: [Overfitting](#overfitting), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Probability of backtest overfitting (PBO)](#probability-of-backtest-overfitting-pbo), [Deflated Sharpe ratio](#deflated-sharpe-ratio)

### Myth: a high win rate means a good strategy

**Simple:** People like strategies that win most of the time. But a strategy can win nine times out of ten and still lose money if the one loss is huge.

<details><summary>Analogy</summary>

Like picking up coins in front of a steamroller: you win often, until you do not.

</details>

<details><summary>Precise definition</summary>

Expectancy depends on win rate and the sizes of wins and losses together. Strategies that sell insurance, such as carry, often have high win rates with rare large losses (negative skew) [@brunnermeier2008]. The disposition effect, selling winners early, also pushes win rates up without improving results [@odean1998].

</details>

Related: [Expectancy](#expectancy), [Negative skew](#negative-skew), [Hit rate](#hit-rate)

### Myth: a stop loss caps your loss exactly

**Simple:** A stop loss feels like a guarantee. In a sudden jump, it fills at the next price, which can be far worse.

<details><summary>Analogy</summary>

Like an emergency brake that works on a normal road but not on ice.

</details>

<details><summary>Precise definition</summary>

Stops become market orders. When the Swiss National Bank removed the 1.20 franc floor on 15 January 2015, prices jumped past many stop levels at once [@snb2015]. Weekend gaps and news do the same on a smaller scale.

</details>

Related: [Stop loss](#stop-loss), [Gap risk](#gap-risk), [Negative balance protection](#negative-balance-protection)

### Myth: after a losing streak, a win is due

**Simple:** After many losses in a row, it feels like the next trade must win. The market does not know or care about your streak.

<details><summary>Analogy</summary>

Like a coin that has landed heads five times: it is still 50 50 next time.

</details>

<details><summary>Precise definition</summary>

For independent trades the probability is unchanged by the past streak; expecting a reversal is the gambler's fallacy [@tversky1971; @tversky1974]. Losing streaks are common even for strategies with an edge, so they say little either way.

</details>

Related: [Gambler's fallacy](#gamblers-fallacy), [Law of small numbers](#law-of-small-numbers), [Martingale betting](#martingale-betting)

### Myth: candlestick patterns reliably predict the next move

**Simple:** Books and videos say shapes like hammers and engulfing candles tell you where price goes next. Large tests mostly find they do not, after costs.

<details><summary>Analogy</summary>

Like reading tea leaves: the shapes are real, and whether they mean anything is still unproven.

</details>

<details><summary>Precise definition</summary>

Evidence is mixed. A test on Dow Jones stocks from 1992 to 2002 found no value [@marshall2005]. Other studies found patterns that worked in S&P 500 stocks (1992 to 1996) and Taiwan stocks [@caginalp1998a; @lu2012]. Many patterns are tested, so some will look good by chance [@sullivan1999].

</details>

Related: [Candlestick](#candlestick), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Technical analysis](#technical-analysis)

### Myth: economic models predict short-term exchange rates

**Simple:** It seems like knowing a country's economy should tell you where its currency goes next month. Mostly it does not.

<details><summary>Analogy</summary>

Like knowing a lot about a dog's breed but still not knowing which way it will run next.

</details>

<details><summary>Precise definition</summary>

Meese and Rogoff (1983) found structural exchange rate models did no better than a random walk at forecasting 1 to 12 months ahead out of sample [@meese1983]. This result has been hard to overturn at short horizons.

</details>

Related: [Random walk](#random-walk), [Purchasing power parity (PPP)](#purchasing-power-parity-ppp)

### Myth: experts and gurus can forecast the market

**Simple:** People trust confident experts on TV and social media. Studies of forecasts find most do little better than chance or simple rules.

<details><summary>Analogy</summary>

Like a weather presenter who only tells you about the days they got right.

</details>

<details><summary>Precise definition</summary>

Persistence in mutual fund returns is almost fully explained by common factors and costs, and the results do not support skilled managers [@carhart1997]. Classic studies of forecasters reach similar conclusions [@cowles1933; @tetlock2005], though we have not yet checked their full texts.

</details>

Related: [Calibration](#calibration), [Overconfidence](#overconfidence), [Survivorship bias](#survivorship-bias)

### Myth: high-interest currencies fall by exactly the rate gap

**Simple:** Textbook theory says a currency paying higher interest should lose value to cancel out the extra interest. In practice it often did not, at least for a while.

<details><summary>Analogy</summary>

Like a theory that says a shop with higher wages must charge exactly that much more, when in fact it often does not.

</details>

<details><summary>Precise definition</summary>

Uncovered interest parity fails in the data: over many periods high-interest currencies tended to hold or gain value, the forward premium puzzle [@fama1984]. This is why carry has paid on average, with occasional crashes [@brunnermeier2008].

</details>

Related: [Uncovered interest parity (UIP)](#uncovered-interest-parity-uip), [Carry trade](#carry-trade), [Myth: the carry trade is free money](#myth-the-carry-trade-is-free-money)

### Myth: huge moves are too rare to worry about

**Simple:** Big crashes feel like once-in-a-lifetime events. In markets they happen far more often than a bell curve says.

<details><summary>Analogy</summary>

Like a town that builds for the 'hundred-year flood' and gets three in twenty years.

</details>

<details><summary>Precise definition</summary>

Mandelbrot (1963) argued price changes follow fatter-tailed laws than the normal distribution [@mandelbrot1963]. Risk measures based on normal assumptions understate extreme losses, which is why expected shortfall and stress tests are used [@acerbi2002].

</details>

Related: [Fat tails](#fat-tails), [Tail risk](#tail-risk), [Expected shortfall](#expected-shortfall)

### Myth: if you stick with it, you will eventually make money

**Simple:** Many people believe practice makes a profitable trader. The numbers say most people who keep day trading keep losing.

<details><summary>Analogy</summary>

Like believing that if you buy enough lottery tickets you are bound to come out ahead.

</details>

<details><summary>Precise definition</summary>

Among Brazilians who day traded futures on more than 300 days, 97% lost money and about 1% earned more than the minimum wage [@url-9d8bddf7]. In Taiwan, fewer than 1% of day traders were predictably profitable after fees [@url-1f7e3d9c]. ESMA found 74 to 89% of retail CFD accounts typically lose money [@url-46fb23ac].

</details>

Related: [Contract for difference (CFD)](#contract-for-difference-cfd), [Overconfidence](#overconfidence), [Survivorship bias](#survivorship-bias)

### Myth: it is not a loss until you sell

**Simple:** Many people hold a losing trade hoping it comes back, because selling would make the loss 'real'. The loss is real either way.

<details><summary>Analogy</summary>

Like not opening a bill so you do not have to know how much you owe.

</details>

<details><summary>Precise definition</summary>

The account's value already reflects the loss. Odean (1998) found investors strongly preferred to realise winners rather than losers, and that this was not justified by how the holdings did afterwards [@odean1998; @shefrin1985].

</details>

Related: [Disposition effect](#disposition-effect), [Sunk cost fallacy](#sunk-cost-fallacy), [Mental accounting](#mental-accounting)

### Myth: last year's best fund or trader will be next year's best

**Simple:** People pick whoever did best recently. Past winners mostly do not stay on top.

<details><summary>Analogy</summary>

Like betting on the team that won last season, though the players and luck have changed.

</details>

<details><summary>Precise definition</summary>

Carhart (1997) found persistence in mutual fund returns was mostly explained by common factors and costs; only the worst funds persistently stayed bad [@carhart1997]. Selection on recent results is also hit by survivorship bias.

</details>

Related: [Recency bias](#recency-bias), [Survivorship bias](#survivorship-bias), [Myth: experts and gurus can forecast the market](#myth-experts-and-gurus-can-forecast-the-market)

### Myth: markets go up, so buying any single stock works out

**Simple:** Because the stock market rises over time, people assume any stock will. Most single stocks did worse than cash.

<details><summary>Analogy</summary>

Like assuming every ticket in a lottery is a winner because the total prize pool is large.

</details>

<details><summary>Precise definition</summary>

Bessembinder (2018) found most US stocks since 1926 had lifetime returns below Treasury bills, and about 4% of firms produced all the net gain [@bessembinder2018]. The index rises because of a few large winners.

</details>

Related: [Few big winners](#few-big-winners), [Diversification](#diversification), [Benchmark](#benchmark)

### Myth: more leverage means more profit

**Simple:** Borrowing more makes wins bigger, so it must be good. But it makes losses bigger too, and big losses can end your trading for good.

<details><summary>Analogy</summary>

Like driving faster to get home sooner: true until the first sharp bend.

</details>

<details><summary>Precise definition</summary>

Leverage scales both mean and volatility, and growth is roughly mean minus half variance, so past a point more leverage lowers long-run growth and raises risk of ruin [@thorp2008; @messmore1995]. Regulators cap retail leverage, for example 30 to 1 on major currency pairs in the EU [@url-46fb23ac]; in the US a security deposit is required [@cftc2010].

</details>

Related: [Leverage](#leverage), [Volatility drag](#volatility-drag), [Kelly criterion](#kelly-criterion), [Risk of ruin](#risk-of-ruin)

### Myth: once an edge is found, it keeps working

**Simple:** People think a strategy that worked will always work. Many stop working once others find out about them.

<details><summary>Analogy</summary>

Like a secret fishing spot: once everyone knows, the fish are gone.

</details>

<details><summary>Precise definition</summary>

McLean and Pontiff (2016) found US stock return predictors earned 26% less out of sample and 58% less after publication [@mclean2016]. Simple FX trend rules faded after the early 1990s [@neely2009].

</details>

Related: [Alpha decay](#alpha-decay), [Adaptive markets](#adaptive-markets), [Out of sample (holdout)](#out-of-sample-holdout)

### Myth: strong feelings give you conviction and help you trade

**Simple:** Some say you need passion and gut feeling to win. In a study of day traders, the most emotional ones did worse.

<details><summary>Analogy</summary>

Like a driver who gets angrier in traffic: it does not get them home faster.

</details>

<details><summary>Precise definition</summary>

Lo, Repin and Steenbarger (2005) found day traders with more intense emotional reactions to gains and losses had worse trading results [@lo2005]. The sample was small, so this is suggestive rather than settled.

</details>

Related: [Tilt](#tilt), [Conviction](#conviction), [Revenge trading](#revenge-trading)

### Myth: support and resistance are pure superstition

**Simple:** Some say lines on charts mean nothing. In currencies there is evidence that some levels do matter, because real orders sit there.

<details><summary>Analogy</summary>

Like a crowd that stops at a painted line on the floor because everyone was told to wait there.

</details>

<details><summary>Precise definition</summary>

Published support and resistance levels predicted intraday trend interruptions in FX better than random levels [@osler2000], and order clustering at round numbers gives a reason [@osler2003]. The effect is small and short-lived, so this is not evidence that such levels are a profitable strategy after costs.

</details>

Related: [Support and resistance](#support-and-resistance), [Round number clustering](#round-number-clustering)

### Myth: the carry trade is free money

**Simple:** Earning the interest gap every day looks like free money. It is paid for by rare, sharp losses.

<details><summary>Analogy</summary>

Like collecting small fees for house insurance until the year a house burns down.

</details>

<details><summary>Precise definition</summary>

Carry returns are negatively skewed: positions unwind together in crises, and funding currencies jump [@brunnermeier2008]. The return is better seen as payment for crash risk than as a free lunch.

</details>

Related: [Carry trade](#carry-trade), [Negative skew](#negative-skew), [Funding currency](#funding-currency)

### Myth: the right indicator settings will make a strategy work

**Simple:** People try many settings for an indicator until one looks great. That usually finds luck, not a better rule.

<details><summary>Analogy</summary>

Like trying every key on a giant key ring on one lock and then thinking the one that worked is special.

</details>

<details><summary>Precise definition</summary>

Picking the best of many parameter sets inflates backtest results; Sullivan, Timmermann and White (1999) showed the apparent success of popular trading rules shrinks once the search is accounted for [@sullivan1999; @bailey2016].

</details>

Related: [Overfitting](#overfitting), [Data snooping (multiple testing)](#data-snooping-multiple-testing), [Myth: a great backtest proves a strategy works](#myth-a-great-backtest-proves-a-strategy-works)

### Myth: trading many currency pairs spreads your risk

**Simple:** Holding EUR/USD, GBP/USD and AUD/USD feels like three different bets. Often it is one bet on the US dollar.

<details><summary>Analogy</summary>

Like owning three umbrellas that all break in the same storm.

</details>

<details><summary>Precise definition</summary>

The dollar is on one side of 89.2% of FX trades [@bis2025], and a common dollar factor drives much of currency returns [@lustig2011]. Real diversification needs positions whose returns are not driven by the same factor.

</details>

Related: [Correlation risk](#correlation-risk), [US dollar dominance](#us-dollar-dominance), [Diversification](#diversification)

### Myth: trading more often makes more money

**Simple:** Being active feels productive. For most people, more trades mean more costs and lower returns.

<details><summary>Analogy</summary>

Like changing lanes all the time in traffic: you rarely arrive sooner and you burn more fuel.

</details>

<details><summary>Precise definition</summary>

Barber and Odean (2000) found the most active US households earned 11.4% a year against 17.9% for the market [@barber2000]. Costs grow with turnover, while edge usually does not.

</details>

Related: [Overtrading](#overtrading), [Turnover](#turnover), [Transaction costs](#transaction-costs)

### Myth: you can trade the news before the market reacts

**Simple:** It seems that reading the news fast lets you trade before prices move. Prices jump at the moment of release.

<details><summary>Analogy</summary>

Like trying to catch a train that left as soon as you heard the whistle.

</details>

<details><summary>Precise definition</summary>

Andersen, Bollerslev, Diebold and Vega (2003) found announcement surprises make exchange rates jump at release time [@andersen2003]. Professional systems read releases faster than any person can.

</details>

Related: [Macro surprise](#macro-surprise), [Efficient market](#efficient-market)

## Conviction and decision making

### Base rate

**Simple:** How often something happens in general, before you look at the details of one case.

<details><summary>Analogy</summary>

Before guessing whether a new restaurant will survive, remember that many new restaurants close in the first few years.

</details>

<details><summary>Precise definition</summary>

The prior frequency of an outcome in the reference class. For retail traders, the base rate of long-run profitability is low [@url-9d8bddf7; @url-46fb23ac], which any personal estimate should start from.

</details>

Related: [Base rate neglect](#base-rate-neglect), [Outside view](#outside-view), [Bayesian updating](#bayesian-updating)

### Base rate neglect

**Simple:** Ignoring how common something usually is because the story in front of you is convincing.

<details><summary>Analogy</summary>

Like believing a test that says you have a very rare illness without asking how often the test is wrong.

</details>

<details><summary>Precise definition</summary>

Underweighting prior frequencies in favour of case-specific information, a consequence of judging by representativeness [@tversky1974; @kahneman2011].

</details>

Related: [Base rate](#base-rate), [Representativeness](#representativeness)

### Bayesian updating

**Simple:** Changing how sure you are a little at a time as new evidence comes in, starting from what you knew before.

<details><summary>Analogy</summary>

Like a detective who gets more sure of a suspect with each new clue, but not all at once.

</details>

<details><summary>Precise definition</summary>

Revising a prior probability to a posterior using Bayes' rule: posterior is proportional to prior times likelihood. Strong priors (like a low base rate of trading success) need strong evidence to move.

</details>

Related: [Base rate](#base-rate), [Probabilistic forecast](#probabilistic-forecast)

### Brier score

**Simple:** A way to score predictions given as percentages. Lower is better; 0 is perfect.

<details><summary>Analogy</summary>

Like golf: the fewer points, the better your forecasts were.

</details>

<details><summary>Precise definition</summary>

The mean squared difference between forecast probabilities and outcomes (0 or 1) [@brier1950]. Always saying 50% scores 0.25 on yes or no questions, which gives a baseline to beat.

</details>

Related: [Calibration](#calibration), [Probabilistic forecast](#probabilistic-forecast)

### Calibration

**Simple:** Being right as often as you say you will be. If you say '80% sure' many times, you should be right about 8 times in 10.

<details><summary>Analogy</summary>

Like a weather forecaster whose '30% chance of rain' days really do get rain about 3 times in 10.

</details>

<details><summary>Precise definition</summary>

Agreement between stated probabilities and observed frequencies. Measured with proper scoring rules such as the Brier score [@brier1950]. Tetlock (2005) studies expert calibration at length [@tetlock2005].

</details>

Related: [Brier score](#brier-score), [Overconfidence](#overconfidence), [Conviction](#conviction)

### Checklist

**Simple:** A short list of things to check every time, so you do not forget the basics under pressure.

<details><summary>Analogy</summary>

Like a pilot's pre-flight checklist.

</details>

<details><summary>Precise definition</summary>

A fixed list of steps run before acting. Gawande (2009) describes checklists cutting errors in surgery and aviation [@gawande2009]. For us: costs included, no lookahead, out-of-sample result, sizing set.

</details>

Related: [Trading plan](#trading-plan), [Lookahead bias](#lookahead-bias)

### Conviction

**Simple:** How sure you feel that a trade or idea is right.

<details><summary>Analogy</summary>

Like how firmly you hold a ladder: useful, but holding tighter does not make the ladder longer.

</details>

<details><summary>Precise definition</summary>

The degree of belief behind a position. Feeling sure is not evidence; conviction is only useful if it is calibrated, meaning that ideas held with 70% confidence come true about 70% of the time [@tetlock2015]. Sizing positions by conviction only makes sense if conviction is measured and tracked.

</details>

Related: [Calibration](#calibration), [Overconfidence](#overconfidence), [Conviction weighting](#conviction-weighting)

### Conviction weighting

**Simple:** Putting more money into ideas you feel surer about.

<details><summary>Analogy</summary>

Like betting more on the horse you feel best about, which only helps if your feelings about horses are any good.

</details>

<details><summary>Precise definition</summary>

Sizing by confidence in the signal. In systematic terms it means scaling position by forecast strength, as in Carver's forecast scaling [@carver2015]. It helps only when signal strength has been shown to predict returns out of sample.

</details>

Related: [Conviction](#conviction), [Position sizing](#position-sizing), [Signal](#signal)

### Decision journal

**Simple:** Writing down why you made a trade, how sure you were and what you expected, before you know how it turns out.

<details><summary>Analogy</summary>

Like writing your guess for a match score before kick-off, so you cannot pretend later.

</details>

<details><summary>Precise definition</summary>

A record made at decision time of reasons, expected outcome and confidence. It counters hindsight bias, which rewrites what we remember believing [@fischhoff1975], and makes calibration measurable. Large-sample evidence that journaling raises returns is lacking (see RES-0006).

</details>

Related: [Hindsight bias](#hindsight-bias), [Calibration](#calibration), [Process and outcome](#process-and-outcome)

### Edge

**Simple:** A real, repeatable reason why a trading idea should make money on average after costs.

<details><summary>Analogy</summary>

Like a casino's small built-in advantage on every game.

</details>

<details><summary>Precise definition</summary>

Positive expected return after costs that persists out of sample, ideally with an economic reason for why someone pays it. Without a measured edge, sizing rules only change how fast an account loses.

</details>

Related: [Expectancy](#expectancy), [Out of sample (holdout)](#out-of-sample-holdout), [Risk premium](#risk-premium)

### Expected value

**Simple:** The average result you would get if you could repeat a choice many, many times.

<details><summary>Analogy</summary>

Like working out that a game costing 1 pound, with a 1 in 10 chance to win 8 pounds, loses you 20p a go on average.

</details>

<details><summary>Precise definition</summary>

The probability-weighted mean of outcomes. A positive expected value is needed but not enough: with large bets relative to capital, a positive-expected-value bet can still lead to ruin, so growth rate and sizing matter too [@peters2019; @thorp2008].

</details>

Related: [Expectancy](#expectancy), [Kelly criterion](#kelly-criterion), [Ergodicity](#ergodicity)

### Kill criteria

**Simple:** Rules written in advance that say when you will stop a strategy or close a trade.

<details><summary>Analogy</summary>

Like agreeing before a hike that you will turn back at 3 pm, wherever you are.

</details>

<details><summary>Precise definition</summary>

Pre-set conditions, such as a drawdown level or a failed out-of-sample test, that end a strategy. Setting them before results arrive guards against escalation of commitment [@staw1976] and the sunk cost fallacy [@arkes1985].

</details>

Related: [Precommitment](#precommitment), [Escalation of commitment](#escalation-of-commitment), [Drawdown](#drawdown)

### Outside view

**Simple:** Asking 'how did things go for others who tried something like this?' instead of only thinking about your own plan.

<details><summary>Analogy</summary>

Like checking how long kitchen renovations usually take before trusting your builder's 'two weeks'.

</details>

<details><summary>Precise definition</summary>

Forecasting from a reference class of similar cases rather than from the details of the case at hand (the inside view). Kahneman and Lovallo (1993) argue the inside view breeds bold forecasts and the outside view corrects them [@kahneman1993].

</details>

Related: [Base rate](#base-rate), [Overconfidence](#overconfidence), [Pre-mortem](#pre-mortem)

### Pre-mortem

**Simple:** Before starting, imagine the plan has already failed and list all the reasons why.

<details><summary>Analogy</summary>

Like a football team imagining they lost the final and asking what went wrong, before the match.

</details>

<details><summary>Precise definition</summary>

Klein (2007): assume failure and generate explanations, which makes it easier to voice doubts [@klein2007]. A counter to overconfidence and confirmation bias.

</details>

Related: [Confirmation bias](#confirmation-bias), [Outside view](#outside-view), [Kill criteria](#kill-criteria)

### Precommitment

**Simple:** Binding yourself to a choice ahead of time so your future self cannot easily change it in the heat of the moment.

<details><summary>Analogy</summary>

Like Ulysses asking to be tied to the mast so he could hear the sirens without steering onto the rocks.

</details>

<details><summary>Precise definition</summary>

Thaler and Shefrin (1981) model self-control as a planner restricting a short-sighted doer [@thaler1981]. In trading: automated orders, fixed sizing rules and pre-registered tests.

</details>

Related: [Kill criteria](#kill-criteria), [Trading plan](#trading-plan)

### Probabilistic forecast

**Simple:** Saying how likely something is, like '60% chance the euro rises this week', instead of just 'the euro will rise'.

<details><summary>Analogy</summary>

Like a weather forecast that gives a chance of rain instead of a promise.

</details>

<details><summary>Precise definition</summary>

A forecast stated as a probability or distribution, which can be scored and calibrated. Point forecasts without a probability cannot be checked for overconfidence [@tetlock2015].

</details>

Related: [Calibration](#calibration), [Brier score](#brier-score), [Expected value](#expected-value)

### Process and outcome

**Simple:** A good decision can turn out badly and a bad decision can turn out well, because of luck. Judge the decision, not just the result.

<details><summary>Analogy</summary>

Like wearing a seatbelt on a trip with no crash: it was still the right choice.

</details>

<details><summary>Precise definition</summary>

Separating decision quality from outcome quality avoids outcome bias [@baron1988]. With noisy returns, many trades are needed before results say much about the process.

</details>

Related: [Outcome bias](#outcome-bias), [Decision journal](#decision-journal), [Sample size](#sample-size)

### Regret aversion

**Simple:** Avoiding choices because of how bad you would feel if they turned out wrong.

<details><summary>Analogy</summary>

Like never changing your answer on a test because it would hurt more to change from right to wrong.

</details>

<details><summary>Precise definition</summary>

Anticipated regret shapes choices; Shefrin and Statman (1985) use regret to help explain why investors hold losers and sell winners [@shefrin1985].

</details>

Related: [Disposition effect](#disposition-effect), [Status quo bias](#status-quo-bias)

### Sample size

**Simple:** How many examples you have. Small samples can easily mislead you.

<details><summary>Analogy</summary>

Like judging a restaurant from one meal.

</details>

<details><summary>Precise definition</summary>

The number of independent observations. For a strategy with a Sharpe ratio of 0.5, telling it apart from zero at the usual 5% level takes roughly 16 years of data, because the t-statistic is about Sharpe times the square root of years.

</details>

Related: [Law of small numbers](#law-of-small-numbers), [t-statistic](#t-statistic), [Sharpe ratio](#sharpe-ratio)

### Superforecasting

**Simple:** Some ordinary people turn out to be unusually good at predicting events, mostly by thinking in probabilities and updating often.

<details><summary>Analogy</summary>

Like a quiz player who keeps a careful score of how often their guesses are right and adjusts.

</details>

<details><summary>Precise definition</summary>

From a long forecasting tournament, Tetlock and Gardner (2015) report that the best forecasters broke problems into parts, started from base rates, updated in small steps and kept score [@tetlock2015].

</details>

Related: [Calibration](#calibration), [Outside view](#outside-view), [Bayesian updating](#bayesian-updating)

### Trading plan

**Simple:** A written set of rules for what you trade, when you enter, when you exit and how much you risk.

<details><summary>Analogy</summary>

Like a recipe: you know the steps before you start cooking.

</details>

<details><summary>Precise definition</summary>

A specification of universe, signals, sizing, exits and limits. Writing it down makes it testable and makes deviations visible. We know of no large study showing that having a plan by itself improves returns; its value is that it can be tested and followed.

</details>

Related: [Precommitment](#precommitment), [Checklist](#checklist), [Position sizing](#position-sizing)

## New products and hype terms

### 0DTE options

**Simple:** Options that expire at the end of the same day they are traded, so a bet can double or vanish in hours.

<details><summary>Analogy</summary>

Like a lottery ticket for this afternoon's weather.

</details>

<details><summary>Precise definition</summary>

Zero days to expiry options expire at the close of the current trading day. Cboe reports that about 59% of S&P 500 index (SPX) option volume trades with zero days left [@url-d02d51d7].

</details>

**What can go wrong:** Prices swing wildly in the last hours, small moves decide everything, and buyers often lose the whole premium. Sellers can face losses far larger than the premium they collected.

Related: [Covered call ETF](#covered-call-etf), [Leverage](#leverage)

### Airdrop

**Simple:** Free crypto tokens sent to people's wallets, often as a reward for using a new app early.

<details><summary>Analogy</summary>

Like free samples handed out at a shop opening. Nice to get, but meant to make you a customer.

</details>

<details><summary>Precise definition</summary>

A distribution of new tokens to many wallet addresses at once, usually to build a user base or reward early use. In the US the IRS treats tokens received in an airdrop after a hard fork as ordinary income once you control them (Revenue Ruling 2019-24) [@url-d70bc25d].

</details>

**What can go wrong:** Free tokens can be taxable when received even if their price later collapses. Fake airdrops are a common scam: a link asks you to connect your wallet and drains it.

Related: [Memecoin](#memecoin), [Staking](#staking)

### Buffer ETF

**Simple:** A fund that promises to absorb the first part of a loss over a year, in exchange for capping how much you can gain.

<details><summary>Analogy</summary>

Like insurance with a deductible paid for by giving up any win above a set amount.

</details>

<details><summary>Precise definition</summary>

A defined outcome fund uses options to buffer the first 9%, 15% or 30% of losses on a reference index over an outcome period of about a year, up to a preset cap on gains. The issuer that pioneered them warns that investors who buy after the period starts may get very different results, and may not get the buffer at all [@url-872a8986].

</details>

**What can go wrong:** Buy mid-period and the buffer or the cap may already be used up. Returns exclude dividends of the index, fees are higher than plain index funds, and losses beyond the buffer are yours.

Related: [ETF](#etf), [Covered call ETF](#covered-call-etf)

### Covered call ETF

**Simple:** A fund that owns stocks and sells other people the right to buy them at a higher price, collecting a fee that it pays out as a big income.

<details><summary>Analogy</summary>

Like renting out your house's upside. You get rent every month, but if prices soar, the gain goes to your tenant.

</details>

<details><summary>Precise definition</summary>

A fund that holds an index or stocks and writes call options on them, turning option premium into distributions. Israelov and Nielsen show a covered call is a mix of the stock, a short volatility position and a dynamic equity timing bet, and that the timing part adds risk without return [@israelov2015].

</details>

**What can go wrong:** A high payout is not the same as a high return. The fund gives up most of a strong rally, still takes most of a crash, and part of the payout can be your own money handed back.

Related: [ETF](#etf), [Total return (dividends reinvested)](#total-return-dividends-reinvested), [0DTE options](#0dte-options)

### Crypto carry

**Simple:** Holding a coin and betting against it with a perp or future at the same time, to collect the fee that eager buyers pay.

<details><summary>Analogy</summary>

Like owning an umbrella and renting it out on rainy days. You earn the rent whether the umbrella price goes up or down.

</details>

<details><summary>Precise definition</summary>

Long spot and short futures or perps on the same coin earns the futures premium or funding. The BIS documents that crypto carry has been large and very volatile, rising when retail demand for leveraged long positions is high, and that sharp drops in carry come with crashes and liquidations [@franz2022].

</details>

**What can go wrong:** The trade can lose on fees, exchange failure, a frozen withdrawal, or funding turning negative. It looks safe until the exchange holding half of it fails.

Related: [Funding rate](#funding-rate), [Perpetual future (perp)](#perpetual-future-perp), [Carry trade](#carry-trade)

### Crypto volatility

**Simple:** Crypto prices swing much more than stocks. A 10% day is normal, and falls of 70% or more have happened many times.

<details><summary>Analogy</summary>

Like sailing a small boat instead of a ferry. Same sea, much bigger waves.

</details>

<details><summary>Precise definition</summary>

Liu and Tsyvinski find bitcoin's daily returns far more volatile than stocks, with returns explained mostly by crypto-specific factors such as momentum and investor attention rather than stock market or macro factors [@liu2018].

</details>

**What can go wrong:** Big swings punish leverage and emotional selling. Diversifying across many coins helps little, because they tend to fall together.

Related: [Volatility](#volatility), [Drawdown](#drawdown), [Fat tails](#fat-tails)

### Expense ratio

**Simple:** The yearly fee a fund takes, as a percentage of your money.

<details><summary>Analogy</summary>

Like a small slice taken from your pizza every year, whether the pizza grows or shrinks.

</details>

<details><summary>Precise definition</summary>

A fund's total annual operating expenses as a percentage of its average net assets [@url-160f511d]. It is taken out of the fund's value daily, so you never see a bill.

</details>

**What can go wrong:** Small differences compound. A 1% fee instead of 0.05% costs roughly a fifth of the ending value over 25 years at the same gross return.

Related: [ETF](#etf), [Management fee](#management-fee), [Net and gross return](#net-and-gross-return)

### Funding rate

**Simple:** The fee that people betting one way on a perp pay to people betting the other way, every hour or every eight hours. When most people bet up, the up side pays.

<details><summary>Analogy</summary>

Like a toll on a busy one way bridge. The busier your direction, the higher the toll you pay to the people going the other way.

</details>

<details><summary>Precise definition</summary>

A periodic payment between longs and shorts proportional to position size, set from the gap between the perp's price and the spot index plus an interest component. On Hyperliquid it is paid every hour, includes a fixed interest part of 0.01% per eight hours and is capped at 4% an hour [@url-3a272a6d]. Multiply an hourly rate by 8,760 to see it as a yearly cost of holding. Funding is why perps track spot, and it is the return behind crypto carry trades [@he2022].

</details>

**What can go wrong:** A rate that looks tiny per hour can be tens of percent a year. It changes every hour, so today's rate says little about next month's cost.

Related: [Perpetual future (perp)](#perpetual-future-perp), [Carry](#carry), [Crypto carry](#crypto-carry)

### Leveraged ETF decay

**Simple:** Funds that promise two or three times a day's move can lose money over months even when the market ends up flat.

<details><summary>Analogy</summary>

Like going up 10% and then down 10%: you do not end where you started, you end 1% lower. With triple leverage the gap grows much bigger.

</details>

<details><summary>Precise definition</summary>

Most leveraged and inverse ETFs reset their exposure daily, so over periods longer than a day their return can differ a lot from the multiple of the index return, especially when markets swing. FINRA warned firms in 2009 that these funds are unsuitable for most retail investors who plan to hold them for more than one trading session [@url-5ea2b559].

</details>

**What can go wrong:** In a choppy market the fund can lose money while the index goes nowhere. Holding for weeks or months is a different bet from the one on the label.

Related: [Leverage](#leverage), [Volatility drag](#volatility-drag), [ETF](#etf)

### Liquidation

**Simple:** When a leveraged bet loses so much that the exchange closes it for you, and you lose the money you put up.

<details><summary>Analogy</summary>

Like a pawnshop selling the watch you left as a deposit the moment it stops covering your loan.

</details>

<details><summary>Precise definition</summary>

Forced closing of a leveraged position when account equity falls below the maintenance margin. On Hyperliquid maintenance margin is 1.25% to 16.7% of position value depending on the asset's maximum leverage; if the book cannot absorb the position, a backstop liquidation keeps the maintenance margin [@url-5d1b2a46].

</details>

**What can go wrong:** Prices can jump straight through your liquidation price, especially on weekends and in thin markets. With 20 times leverage a 5% move against you is enough to lose the whole deposit.

Related: [Leverage](#leverage), [Margin call](#margin-call), [Stop-out](#stop-out), [Perpetual future (perp)](#perpetual-future-perp)

### Memecoin

**Simple:** A crypto coin made for fun or hype, often named after a joke, an animal or a celebrity. It usually does nothing except get traded.

<details><summary>Analogy</summary>

Like a trading card that is popular only because people are talking about it this week.

</details>

<details><summary>Precise definition</summary>

The SEC staff describe a meme coin as a crypto asset inspired by internet memes, characters, current events or trends, whose promoter seeks an enthusiastic online community to buy and trade it. They note meme coins tend to have significant price volatility and little use beyond entertainment, and the staff view is that typical meme coins are not securities, so securities law protections do not apply [@url-9f635241].

</details>

**What can go wrong:** Prices are driven by attention, which fades. Insiders often hold a large share and can sell into the hype. Many memecoins fall close to zero, and there is usually no regulator to complain to.

Related: [Herding](#herding), [Fear of missing out (FOMO)](#fear-of-missing-out-fomo), [Liquidity](#liquidity)

### Open interest

**Simple:** How many futures or perp contracts are still open right now. It counts bets that have not been closed, not how much was traded today.

<details><summary>Analogy</summary>

Like counting the people still inside a cinema, not how many tickets were sold today.

</details>

<details><summary>Precise definition</summary>

The total number of futures or option contracts that have not yet been offset or fulfilled by delivery [@url-7f3d77da]. For perps it is usually shown in coins or in US dollars at the mark price.

</details>

**What can go wrong:** High open interest with high leverage means many positions can be liquidated at once, which can turn a small move into a cascade.

Related: [Perpetual future (perp)](#perpetual-future-perp), [Liquidation](#liquidation)

### Perpetual future (perp)

**Simple:** A bet on a coin's price that never expires. You can bet it goes up or down, usually with borrowed money, and keep the bet open as long as you pay or receive a small fee every few hours.

<details><summary>Analogy</summary>

Like renting a seat on a roller coaster that never stops. You can stay on as long as you like, but you pay rent while you ride, and the ride can throw you off.

</details>

<details><summary>Precise definition</summary>

A futures contract with no expiry date. To keep its price close to the spot price, longs and shorts swap a periodic funding payment instead of the contract converging at expiry. The idea goes back to Shiller (1993) and was popularised by crypto exchanges from 2016 [@he2022].

</details>

**What can go wrong:** Most perps are traded with leverage, so a small price move can wipe out your margin and close the position for you (liquidation). Funding can also cost far more than you expect when everyone is betting the same way.

Related: [Funding rate](#funding-rate), [Liquidation](#liquidation), [Leverage](#leverage), [Open interest](#open-interest)

### Prediction market

**Simple:** A market where people bet on whether something will happen, like an election or a rate cut. The price shows the crowd's odds.

<details><summary>Analogy</summary>

Like a betting shop where the odds on the board move with every bet.

</details>

<details><summary>Precise definition</summary>

An exchange for contracts that pay out if an event happens. Prices can be read as probabilities and have often forecast well [@wolfers2004]. In the US, event contracts are regulated by the CFTC, which in 2024 proposed barring contracts on elections, awards and sports as contrary to the public interest [@url-2af24e32].

</details>

**What can go wrong:** Each contract pays all or nothing, so you can lose the whole stake. Small markets can be moved by one large trader, and rules differ by country and change quickly.

Related: [Probabilistic forecast](#probabilistic-forecast), [Calibration](#calibration)

### Premium or discount to NAV

**Simple:** When a fund's share price on the market is higher or lower than the value of what it actually holds.

<details><summary>Analogy</summary>

Like paying more than face value for a gift card because everyone wants that shop.

</details>

<details><summary>Precise definition</summary>

NAV, net asset value, is the value of a fund's assets minus its liabilities, per share [@url-b9f70980]. An ETF's market price can trade above (premium) or below (discount) its NAV, usually by little for large funds, and by more for thinly traded funds or in stressed markets.

</details>

**What can go wrong:** Buy at a premium and sell at a discount and you lose money even if the holdings did not move. New and small funds show the widest gaps.

Related: [ETF](#etf), [Liquidity](#liquidity), [Spread (bid and ask)](#spread-bid-and-ask)

### Restaking

**Simple:** Using coins that are already staked to secure more services at the same time, to earn more rewards.

<details><summary>Analogy</summary>

Like using the same house as collateral for three loans. More income, but one problem can cost you the house.

</details>

<details><summary>Precise definition</summary>

EigenLayer, the best known example, describes restaking as a way for services built on Ethereum to borrow staked ETH as security, with penalty and reward commitments such as slashing on the staked assets [@url-7a0fda7c].

</details>

**What can go wrong:** Each extra service adds another way to be slashed, so losses can stack. Liquid restaking tokens can trade below the value of what they hold when many people try to exit.

Related: [Staking](#staking)

### RWA tokenisation

**Simple:** Turning ordinary assets like government bonds, funds or buildings into crypto tokens that can be traded on a blockchain.

<details><summary>Analogy</summary>

Like turning a paper share certificate into a digital ticket you can pass around instantly.

</details>

<details><summary>Precise definition</summary>

RWA stands for real-world assets. Tokenisation records a claim on an off-chain asset as a token on a programmable ledger. The BIS sees promise in settling tokenised government bonds and money on one shared ledger, which could make payment and transfer of ownership happen in one step [@url-b1e6b3cc].

</details>

**What can go wrong:** The token is a promise. You rely on the issuer, the custodian and the legal wrapper to actually hand over the asset, and many tokens trade rarely.

Related: [Stablecoin](#stablecoin)

### Spot bitcoin ETF

**Simple:** A fund on the stock market that holds real bitcoin, so you can own its price through a normal brokerage account.

<details><summary>Analogy</summary>

Like buying a share in a vault full of gold instead of keeping gold bars at home.

</details>

<details><summary>Precise definition</summary>

An exchange-traded product that holds bitcoin directly rather than futures. The SEC approved the first US listings on 10 January 2024; the Chair's statement called bitcoin primarily a speculative, volatile asset and said the approval did not endorse it [@url-4c39b66e].

</details>

**What can go wrong:** The fund rises and falls with bitcoin, which has lost more than 70% several times. It adds a yearly fee, and it trades only in stock market hours while bitcoin trades all week.

Related: [ETF](#etf), [Expense ratio](#expense-ratio)

### Stablecoin

**Simple:** A crypto coin built to stay worth one dollar, usually backed by cash and short-term government bonds.

<details><summary>Analogy</summary>

Like a casino chip worth one dollar. Fine while the casino can always swap it back for cash.

</details>

<details><summary>Precise definition</summary>

A token that aims to hold a fixed value, usually one US dollar, through reserves held by an issuer. The BIS argues stablecoins do poorly on three tests of sound money: they do not always trade at par (singleness), cannot expand on demand (elasticity) and are open to illicit use (integrity) [@url-b1e6b3cc].

</details>

**What can go wrong:** A stablecoin is only as good as its reserves and its issuer. Several have broken their peg, and some fell to near zero.

Related: [RWA tokenisation](#rwa-tokenisation)

### Staking

**Simple:** Locking up coins to help run a crypto network, and getting paid new coins for it.

<details><summary>Analogy</summary>

Like putting down a deposit to work as a referee. You earn a fee for honest work and lose part of the deposit if you cheat.

</details>

<details><summary>Precise definition</summary>

On proof-of-stake networks such as Ethereum, validators lock coins (32 ETH for a full validator) and earn rewards for proposing and attesting blocks. Misbehaving validators are slashed: part of the stake is burned, and in rare mass events the whole stake can be lost [@url-0225a9e2]. SEC staff said in May 2025 that protocol staking itself is not a securities offering [@url-894d16a5].

</details>

**What can go wrong:** Rewards are paid in the same coin, so a falling price can swamp the yield. Coins can be locked when you want to sell, and a staking provider can lose or misuse them.

Related: [Restaking](#restaking), [Airdrop](#airdrop)

### Thematic ETF

**Simple:** A fund built around a hot story, like AI, robots, clean energy or cannabis.

<details><summary>Analogy</summary>

Like a restaurant that opens selling the food everyone is talking about this year.

</details>

<details><summary>Precise definition</summary>

A specialised ETF that holds companies linked to a theme. Ben-David, Franzoni, Kim and Moussawi find specialised ETFs tend to launch after their stocks have already risen and attracted attention, and then underperform: about 6% a year on average in the five years after launch [@bendavid2022].

</details>

**What can go wrong:** By the time a fund exists, the good news is often in the price. Themes are concentrated in a few stocks, fees are higher, and many such funds close.

Related: [ETF](#etf), [Herding](#herding), [Recency bias](#recency-bias), [Expense ratio](#expense-ratio)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@neely2009](../REFERENCES.md#neely2009): Neely et al. (2009), https://s3.amazonaws.com/real.stlouisfed.org/wp/2006/2006-046.pdf
- [@osler2003](../REFERENCES.md#osler2003): Osler (2003), Currency Orders and Exchange Rate Dynamics: An Explanation for the Predictive Success of Technical Analysis
- [@nison1991](../REFERENCES.md#nison1991): Nison (1991), Japanese Candlestick Charting Techniques
- [@marshall2005](../REFERENCES.md#marshall2005): Marshall (2005), Candlestick technical trading strategies: can they create value for investors? (PhD thesis)
- [@lo2000](../REFERENCES.md#lo2000): Lo et al. (2000), Foundations of Technical Analysis: Computational Algorithms, Statistical Inference, and Empirical Implementation
- [@lu2012](../REFERENCES.md#lu2012): Lu et al. (2012), Profitable candlestick trading strategies: The evidence from a new perspective
- [@caginalp1998a](../REFERENCES.md#caginalp1998a): Caginalp and Laurent (1998), The predictive power of price patterns
- [@park2007](../REFERENCES.md#park2007): Park and Irwin (2007), What Do We Know About the Profitability of Technical Analysis?
- [@chang1999](../REFERENCES.md#chang1999): Chang and Osler (1999), Methodical Madness: Technical Analysis and the Irrationality of Exchange-Rate Forecasts
- [@brock1992](../REFERENCES.md#brock1992): Brock et al. (1992), Simple Technical Trading Rules and the Stochastic Properties of Stock Returns
- [@sullivan1999](../REFERENCES.md#sullivan1999): Sullivan et al. (1999), Data-Snooping, Technical Trading Rule Performance, and the Bootstrap
- [@osler2000](../REFERENCES.md#osler2000): Osler (2000), https://www.newyorkfed.org/medialibrary/media/research/epr/00v06n2/0007osle.pdf
- [@menkhoff2007](../REFERENCES.md#menkhoff2007): Menkhoff and Taylor (2007), The Obstinate Passion of Foreign Exchange Professionals: Technical Analysis
- [@tversky1971](../REFERENCES.md#tversky1971): Tversky and Kahneman (1971), Belief in the law of small numbers
- [@tversky1974](../REFERENCES.md#tversky1974): Tversky and Kahneman (1974), Judgment under Uncertainty: Heuristics and Biases
- [@barberis2003](../REFERENCES.md#barberis2003): Barberis and Thaler (2003), A survey of behavioral finance
- [@nickerson1998](../REFERENCES.md#nickerson1998): Nickerson (1998), Confirmation Bias: A Ubiquitous Phenomenon in Many Guises
- [@shefrin1985](../REFERENCES.md#shefrin1985): Shefrin and Statman (1985), The Disposition to Sell Winners Too Early and Ride Losers Too Long: Theory and Evidence
- [@odean1998](../REFERENCES.md#odean1998): Odean (1998), Are Investors Reluctant to Realize Their Losses?
- [@heimer2016](../REFERENCES.md#heimer2016): Heimer (2016), Peer Pressure: Social Interaction and the Disposition Effect
- [@kahneman1990](../REFERENCES.md#kahneman1990): Kahneman et al. (1990), Experimental Tests of the Endowment Effect and the Coase Theorem
- [@staw1976](../REFERENCES.md#staw1976): Staw (1976), Knee-deep in the big muddy: a study of escalating commitment to a chosen course of action
- [@greenwood2014](../REFERENCES.md#greenwood2014): Greenwood and Shleifer (2014), Expectations of Returns and Expected Returns
- [@debondt1985](../REFERENCES.md#debondt1985): De Bondt and Thaler (1985), Does the Stock Market Overreact?
- [@barber2008](../REFERENCES.md#barber2008): Barber and Odean (2008), All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors
- [@tversky1981](../REFERENCES.md#tversky1981): Tversky and Kahneman (1981), The Framing of Decisions and the Psychology of Choice
- [@banerjee1992](../REFERENCES.md#banerjee1992): Banerjee (1992), A Simple Model of Herd Behavior
- [@brunnermeier2008](../REFERENCES.md#brunnermeier2008): Brunnermeier et al. (2008), Carry Trades and Currency Crashes
- [@fischhoff1975](../REFERENCES.md#fischhoff1975): Fischhoff (1975), Hindsight is not equal to foresight: The effect of outcome knowledge on judgment under uncertainty
- [@gilovich1985](../REFERENCES.md#gilovich1985): Gilovich et al. (1985), The hot hand in basketball: On the misperception of random sequences
- [@miller2018](../REFERENCES.md#miller2018): Miller and Sanjurjo (2018), Surprised by the Hot Hand Fallacy? A Truth in the Law of Small Numbers
- [@thaler1990](../REFERENCES.md#thaler1990): Thaler and Johnson (1990), Gambling with the House Money and Trying to Break Even: The Effects of Prior Outcomes on Risky Choice
- [@langer1975](../REFERENCES.md#langer1975): Langer (1975), The illusion of control
- [@kahneman1979](../REFERENCES.md#kahneman1979): Kahneman and Tversky (1979), Prospect Theory: An Analysis of Decision under Risk
- [@thaler1985](../REFERENCES.md#thaler1985): Thaler (1985), Mental Accounting and Consumer Choice
- [@benartzi1995](../REFERENCES.md#benartzi1995): Benartzi and Thaler (1995), Myopic Loss Aversion and the Equity Premium Puzzle
- [@taleb2007](../REFERENCES.md#taleb2007): Taleb (2007), The Black Swan: The Impact of the Highly Improbable
- [@baron1988](../REFERENCES.md#baron1988): Baron and Hershey (1988), Outcome bias in decision evaluation
- [@barber2001](../REFERENCES.md#barber2001): Barber and Odean (2001), Boys Will Be Boys: Gender, Overconfidence, and Common Stock Investment
- [@barber2000](../REFERENCES.md#barber2000): Barber and Odean (2000), Trading Is Hazardous to Your Wealth: The Common Stock Investment Performance of Individual Investors
- [@samuelson1988](../REFERENCES.md#samuelson1988): Samuelson and Zeckhauser (1988), Status quo bias in decision making
- [@arkes1985](../REFERENCES.md#arkes1985): Arkes and Blumer (1985), The psychology of sunk cost
- [@lo2005](../REFERENCES.md#lo2005): Lo et al. (2005), Fear and Greed in Financial Markets: A Clinical Study of Day-Traders
- [@bis2025](../REFERENCES.md#bis2025): Bank for International Settlements (2025), OTC foreign exchange turnover in April 2025, Triennial Central Bank Survey
- [@lustig2011](../REFERENCES.md#lustig2011): Lustig et al. (2011), Common Risk Factors in Currency Markets
- [@magdonismail2004](../REFERENCES.md#magdonismail2004): Magdon-Ismail et al. (2004), On the maximum drawdown of a Brownian motion
- [@acerbi2002](../REFERENCES.md#acerbi2002): Acerbi and Tasche (2002), On the coherence of expected shortfall
- [@artzner1999](../REFERENCES.md#artzner1999): Artzner et al. (1999), Coherent Measures of Risk
- [@bcbs2019](../REFERENCES.md#bcbs2019): Basel Committee on Banking Supervision (2019), Minimum capital requirements for market risk
- [@thorp2008](../REFERENCES.md#thorp2008): Thorp (2008), The Kelly criterion in blackjack, sports betting and the stock market
- [@maclean2011](../REFERENCES.md#maclean2011): MacLean et al. (2011), The Kelly Capital Growth Investment Criterion: Theory and Practice
- [@feller1968](../REFERENCES.md#feller1968): Feller (1968), An Introduction to Probability Theory and Its Applications, Volume 1, 3rd edition
- [@snb2015](../REFERENCES.md#snb2015): Swiss National Bank (2015), Swiss National Bank discontinues minimum exchange rate and lowers interest rate to -0.75%
- [@url-efa4ec7e](../REFERENCES.md#url-efa4ec7e): Kelly, 1956 (n.d.)
- [@url-46fb23ac](../REFERENCES.md#url-46fb23ac): ESMA agrees to prohibit binary options and restrict CFDs to protect retail investors (n.d.)
- [@cftc2010](../REFERENCES.md#cftc2010): Commodity Futures Trading Commission (2010), CFTC Releases Final Rules Regarding Retail Forex Transactions
- [@carver2015](../REFERENCES.md#carver2015): Carver (2015), Systematic Trading: A Unique New Method for Designing Trading and Investing Systems
- [@jorion2006](../REFERENCES.md#jorion2006): Jorion (2006), Value at Risk: The New Benchmark for Managing Financial Risk, 3rd edition
- [@mandelbrot1963](../REFERENCES.md#mandelbrot1963): Mandelbrot (1963), The Variation of Certain Speculative Prices
- [@moreira2017](../REFERENCES.md#moreira2017): Moreira and Muir (2017), Volatility-Managed Portfolios
- [@sharpe1991](../REFERENCES.md#sharpe1991): Sharpe (1991), The Arithmetic of Active Management
- [@peters2019](../REFERENCES.md#peters2019): Peters (2019), The ergodicity problem in economics
- [@bessembinder2018](../REFERENCES.md#bessembinder2018): Bessembinder (2018), Do stocks outperform Treasury bills?
- [@messmore1995](../REFERENCES.md#messmore1995): Messmore (1995), Variance Drain
- [@french2008](../REFERENCES.md#french2008): French (2008), Presidential Address: The Cost of Active Investing
- [@dimson2002](../REFERENCES.md#dimson2002): Dimson et al. (2002), Triumph of the Optimists: 101 Years of Global Investment Returns
- [@fsb2014](../REFERENCES.md#fsb2014): Financial Stability Board (2014), Foreign Exchange Benchmarks: Final Report
- [@du2018](../REFERENCES.md#du2018): Du et al. (2018), Deviations from Covered Interest Rate Parity
- [@king2012](../REFERENCES.md#king2012): King et al. (2012), Foreign Exchange Market Structure, Players, and Evolution
- [@gfxc2024](../REFERENCES.md#gfxc2024): Global Foreign Exchange Committee (2024), FX Global Code
- [@oomen2017](../REFERENCES.md#oomen2017): Oomen (2017), Last look
- [@mccauley2014](../REFERENCES.md#mccauley2014): McCauley et al. (2014), Non-deliverable forwards: 2013 and beyond
- [@ranaldo2010](../REFERENCES.md#ranaldo2010): Ranaldo and Söderlind (2010), Safe Haven Currencies
- [@harvey2015](../REFERENCES.md#harvey2015): Harvey et al. (2015), ... and the Cross-Section of Expected Returns
- [@bailey2016](../REFERENCES.md#bailey2016): Bailey et al. (2016), The probability of backtest overfitting
- [@meese1983](../REFERENCES.md#meese1983): Meese and Rogoff (1983), Empirical exchange rate models of the seventies
- [@carhart1997](../REFERENCES.md#carhart1997): Carhart (1997), On Persistence in Mutual Fund Performance
- [@cowles1933](../REFERENCES.md#cowles1933): Cowles (1933), Can Stock Market Forecasters Forecast?
- [@tetlock2005](../REFERENCES.md#tetlock2005): Tetlock (2005), Expert Political Judgment: How Good Is It? How Can We Know?
- [@fama1984](../REFERENCES.md#fama1984): Fama (1984), Forward and spot exchange rates
- [@url-9d8bddf7](../REFERENCES.md#url-9d8bddf7): Chague, De-Losso and Giovannetti, 2020, SSRN 3423101 (n.d.)
- [@url-1f7e3d9c](../REFERENCES.md#url-1f7e3d9c): Barber, Lee, Liu, Odean and Zhang (2017 version), Do day traders rationally learn about their ability? (n.d.)
- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?
- [@andersen2003](../REFERENCES.md#andersen2003): Andersen et al. (2003), Micro Effects of Macro Announcements: Real-Time Price Discovery in Foreign Exchange
- [@kahneman2011](../REFERENCES.md#kahneman2011): Kahneman (2011), Thinking, Fast and Slow
- [@brier1950](../REFERENCES.md#brier1950): Brier (1950), Verification of forecasts expressed in terms of probability
- [@gawande2009](../REFERENCES.md#gawande2009): Gawande (2009), The Checklist Manifesto: How to Get Things Right
- [@tetlock2015](../REFERENCES.md#tetlock2015): Tetlock and Gardner (2015), Superforecasting: The Art and Science of Prediction
- [@kahneman1993](../REFERENCES.md#kahneman1993): Kahneman and Lovallo (1993), Timid Choices and Bold Forecasts: A Cognitive Perspective on Risk Taking
- [@klein2007](../REFERENCES.md#klein2007): Klein (2007), Performing a Project Premortem
- [@thaler1981](../REFERENCES.md#thaler1981): Thaler and Shefrin (1981), An Economic Theory of Self-Control
- [@url-d02d51d7](../REFERENCES.md#url-d02d51d7): 0DTE options (n.d.)
- [@url-d70bc25d](../REFERENCES.md#url-d70bc25d): Revenue Ruling 2019-24 (2019)
- [@url-872a8986](../REFERENCES.md#url-872a8986): Defined Outcome ETFs (n.d.)
- [@israelov2015](../REFERENCES.md#israelov2015): Israelov and Nielsen (2015), Covered Calls Uncovered
- [@franz2022](../REFERENCES.md#franz2022): Franz and Schmeling (2022), Crypto Carry
- [@liu2018](../REFERENCES.md#liu2018): Liu and Tsyvinski (2018), Risks and Returns of Cryptocurrency
- [@url-160f511d](../REFERENCES.md#url-160f511d): Expense ratio (glossary) (n.d.)
- [@url-3a272a6d](../REFERENCES.md#url-3a272a6d): Funding (n.d.)
- [@he2022](../REFERENCES.md#he2022): He et al. (2022), Fundamentals of Perpetual Futures
- [@url-5ea2b559](../REFERENCES.md#url-5ea2b559): Regulatory Notice 09-31: non-traditional ETFs (2009)
- [@url-5d1b2a46](../REFERENCES.md#url-5d1b2a46): Liquidations (n.d.)
- [@url-9f635241](../REFERENCES.md#url-9f635241): Staff statement on meme coins (2025)
- [@url-7f3d77da](../REFERENCES.md#url-7f3d77da): CFTC glossary (n.d.)
- [@wolfers2004](../REFERENCES.md#wolfers2004): Wolfers and Zitzewitz (2004), Prediction Markets
- [@url-2af24e32](../REFERENCES.md#url-2af24e32): CFTC issues proposal on event contracts (2024)
- [@url-b9f70980](../REFERENCES.md#url-b9f70980): Net asset value (glossary) (n.d.)
- [@url-7a0fda7c](../REFERENCES.md#url-7a0fda7c): Layr-Labs/eigenlayer-contracts (n.d.)
- [@url-b1e6b3cc](../REFERENCES.md#url-b1e6b3cc): The next-generation monetary and financial system (2025)
- [@url-4c39b66e](../REFERENCES.md#url-4c39b66e): Statement on the approval of spot bitcoin exchange-traded products (2024)
- [@url-0225a9e2](../REFERENCES.md#url-0225a9e2): Proof-of-stake rewards and penalties (n.d.)
- [@url-894d16a5](../REFERENCES.md#url-894d16a5): Statement on certain protocol staking activities (2025)
- [@bendavid2022](../REFERENCES.md#bendavid2022): Ben-David et al. (2022), Competition for Attention in the ETF Space

## Referenced by

- [DEC-0004: Docs follow strict rules that a script checks on every commit](../decisions/0004-docs-are-checked-by-a-script.md)
- [DEC-0011: Read the docs inside the dashboard, with stacked previews](../decisions/0011-read-the-docs-inside-the-dashboard-with-stacked-previews.md)
- [RES-0004: Exchange rate theory primer](../research/0004-exchange-rate-theory-primer.md)
- [RES-0009: Trading myths and what the evidence says](../research/0009-trading-myths-and-what-the-evidence-says.md)
- [GDE-0003: Writing and filing docs](../guides/0003-writing-docs.md)
- [REF-0006: The gauntlet](0006-the-gauntlet.md)
- [REF-0012: Candlesticks and chart patterns](0012-candlesticks-and-chart-patterns.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
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
- [ALG-0055: Bollinger band reversion and squeeze breakout](../algorithms/0055-bollinger-band-reversion-breakout.md)
- [ALG-0056: Candlestick price action (pin bars, engulfing, doji)](../algorithms/0056-candlestick-price-action-patterns.md)
- [ALG-0057: Copy trading and paid signal services](../algorithms/0057-copy-trading-signal-services.md)
- [ALG-0058: Elliott wave counting](../algorithms/0058-elliott-wave.md)
- [ALG-0059: Fibonacci retracement entries (38.2, 50, 61.8 percent)](../algorithms/0059-fibonacci-retracements.md)
- [ALG-0060: Martingale and averaging-down systems on FX](../algorithms/0060-fx-martingale-averaging.md)
- [ALG-0061: Golden cross / death cross (50 and 200 day moving averages)](../algorithms/0061-golden-cross-50-200.md)
- [ALG-0062: Ichimoku cloud (kumo breakout and TK cross)](../algorithms/0062-ichimoku-cloud.md)
- [ALG-0063: ICT / smart money concepts (order blocks, fair value gaps, liquidity sweeps)](../algorithms/0063-ict-smart-money-concepts.md)
- [ALG-0064: London open / Asian range breakout](../algorithms/0064-london-open-asian-range-breakout.md)
- [ALG-0065: MACD signal-line crossover](../algorithms/0065-macd-crossover.md)
- [ALG-0066: News straddle (pending orders around NFP and rate decisions)](../algorithms/0066-news-straddle-trading.md)
- [ALG-0067: Scalping on 1-minute charts](../algorithms/0067-one-minute-scalping.md)
- [ALG-0068: Prop firm challenge style trading](../algorithms/0068-prop-firm-challenge-trading.md)
- [ALG-0069: Carry trade as taught to retail (hold a positive-swap pair)](../algorithms/0069-retail-swap-carry.md)
- [ALG-0070: RSI overbought / oversold reversal (30 / 70)](../algorithms/0070-rsi-overbought-oversold.md)
- [ALG-0071: Support and resistance / supply and demand zones](../algorithms/0071-support-resistance-supply-demand-zones.md)
- [ALG-0072: Donchian channel / Turtle Traders breakout](../algorithms/0072-turtle-donchian-breakout.md)
- [ALG-0073: Static carry: hold the currencies that usually pay high interest](../algorithms/0073-fx-static-carry.md)
- [ALG-0074: Output gap currency strategy](../algorithms/0074-fx-output-gap-business-cycle.md)
- [ALG-0075: Global imbalances currency strategy](../algorithms/0075-fx-global-imbalances.md)
- [ALG-0076: Commodity exporters minus finished-goods exporters (IMX)](../algorithms/0076-fx-commodity-trade-imx.md)
- [ALG-0077: Good carry: G10 carry without the worst currencies](../algorithms/0077-fx-good-carry-g10.md)
- [ALG-0078: Option-hedged carry trade](../algorithms/0078-fx-option-hedged-carry.md)
- [ALG-0079: Currencies weaken in their own trading hours](../algorithms/0079-fx-local-hours-time-of-day.md)
- [ALG-0080: Low-volume reversal in currency pairs](../algorithms/0080-fx-low-volume-reversal.md)
- [ALG-0081: Asymmetric information risk (price impact) currency strategy](../algorithms/0081-fx-asymmetric-information-risk.md)
- [ALG-0082: Complex ridge market timing (virtue of complexity)](../algorithms/0082-complex-ml-market-timing.md)
- [ALG-0083: Emerging market currency carry, cost aware](../algorithms/0083-em-fx-carry.md)
- [ALG-0084: Passive emerging market currency basket](../algorithms/0084-em-fx-passive-basket.md)
- [ALG-0085: Emerging market currency momentum](../algorithms/0085-em-fx-momentum.md)
- [ALG-0086: Selling commodity volatility (variance risk premium)](../algorithms/0086-commodity-variance-risk-premium.md)
- [ALG-0087: Commodity currencies predict commodity prices](../algorithms/0087-commodity-currencies-predict-commodities.md)
- [ALG-0088: Commodity basis-momentum](../algorithms/0088-commodity-basis-momentum.md)
- [ALG-0089: Commodity value (5-year price reversal)](../algorithms/0089-commodity-value-reversal.md)
- [ALG-0090: Commodity skewness factor](../algorithms/0090-commodity-skewness.md)
- [ALG-0091: Commodity hedging pressure (CFTC positions)](../algorithms/0091-commodity-hedging-pressure.md)
- [ALG-0092: Commodity open interest growth](../algorithms/0092-commodity-open-interest-growth.md)
- [ALG-0093: Commodity same-calendar-month seasonality](../algorithms/0093-commodity-same-month-seasonality.md)
- [ALG-0094: Front-running commodity index rolls (the Goldman roll)](../algorithms/0094-commodity-index-roll-front-running.md)
- [ALG-0095: Currencies sorted on sovereign credit risk](../algorithms/0095-fx-sovereign-credit-risk.md)
- [ALG-0096: Commodity inventory level](../algorithms/0096-commodity-inventory-level.md)
- [ALG-0097: Developed-market rate gap times the EM currency basket](../algorithms/0097-fx-developed-rate-gap-times-em-basket.md)
- [ALG-0098: Equal-weight combination of styles](../algorithms/0098-equal-weight-style-combination.md)
<!-- backlinks:end -->
