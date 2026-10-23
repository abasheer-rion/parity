---
id: RES-0012
title: Private markets, how they are measured and how individuals get in
type: research
status: current
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, private-markets]
related: [DEC-0015, DEC-0019, REF-0015, RES-0011]
---

# Private markets, how they are measured and how individuals get in

## In plain words

Private markets are investments that do not trade on an exchange: stakes in private companies, loans made straight to companies, buildings, toll roads and the funds that hold them. Nobody quotes a price every second, so their reported values come from appraisals and manager estimates. That makes them look calmer than they are. Their headline returns are also hard to compare with a stock index, because money goes in and out at different times and fees are high and complex. This page explains how returns are measured, why reported risk is too low, what the research finds about returns after fees, how individuals can get in and what can go wrong, and who sells the data.

## Summary

Gathered 2026-10-23, for the owner's request to "fully deck out research" on private markets. Every paper was checked against its Crossref record. Where we read only the registry record and not the abstract, we say so in [Papers and pages used](#papers-and-pages-used).

- **Measure against the market, not alone.** A fund's IRR and its multiple of money (TVPI) say nothing about whether a cheap index fund did better over the same dates. The public market equivalent (PME) answers that question, and it is the measure most research relies on [@kaplan2005; @sorensen2015].
- **Average results depend on the data and the years.** Using Burgiss cash flows, US buyout funds beat the S&P 500 by 20% to 27% over a fund's life, more than 3% a year; venture beat it in the 1990s and lagged in the 2000s [@harris2014]. Other studies find average net returns close to public equity since about 2006 [@phalippou2020], or below the S&P 500 once inflated interim values are removed [@phalippou2008]. Against small value stocks with leverage, the edge shrinks or disappears [@stafford2021; @ilmanen2019].
- **Reported risk is too low.** Appraisals and manager marks move slowly. Reported returns are smoother than true returns, which understates volatility and raises the Sharpe ratio [@getmansky2004; @geltner1993]. Once unsmoothed, buyout funds have a market beta near 1.0 and venture near 1.4 [@brown2022].
- **Fees are large.** Phalippou and Gottschalg estimate fees at about 6% a year [@phalippou2008]. About two thirds of a manager's expected revenue is fixed and does not depend on performance [@metrick2010]. Different investors in the same fund often pay different fees [@begenau2024].
- **The illiquidity premium is real but may not be paid to you.** Private equity carries a liquidity risk premium of about 3% a year [@franzoni2012]. After fees, risk and illiquidity, investors may only break even on average [@sorensen2014]. Some investors may accept a lower return in exchange for smooth reported values [@ilmanen2020].
- **Individuals mostly get in through wrappers with exit limits.** Interval funds must offer to buy back 5% to 25% of shares every 3, 6 or 12 months [@url-a4070279]. Non-traded REITs and BDCs cap redemptions; in November 2022 one large non-traded REIT got more requests than its 2% monthly and 5% quarterly limits [@url-7414523f].
- **Good data is mostly paid.** Burgiss (now part of MSCI), Preqin (now part of BlackRock) and PitchBook sell fund-level data. Cambridge Associates and NCREIF publish free summaries. The free, public data we can use are the SEC's Form D filings, Federal Reserve series on FRED, BDC filings on EDGAR, and listed proxies.

## The asset classes in plain words

| Asset class | What you own | How it earns | Typical vehicle |
| --- | --- | --- | --- |
| Buyout (private equity) | Control of a mature private company, bought largely with debt | Better operations, debt paydown, selling later at a higher price | 10 to 12 year closed-end fund |
| Venture capital | Small minority stakes in young companies | A few big winners pay for many failures | 10 year closed-end fund |
| Private credit (direct lending) | Loans made straight to mid-sized companies, often owned by buyout funds | Floating interest, fees, covenants | Closed-end fund, BDC, interval fund |
| Real estate | Buildings: core (stable, low debt), value-add (fix up), opportunistic (build or rescue) | Rent and price change | Open-end fund, non-traded REIT, closed-end fund |
| Infrastructure | Toll roads, pipelines, power, airports, data centres | Long contracted or regulated cash flows | Closed-end or open-end fund |
| Secondaries | Existing stakes in private funds bought from investors who want out | Buying below reported value | Closed-end or evergreen fund |
| Evergreen, interval and tender-offer funds | A fund with no end date that keeps taking money | Whatever it holds, minus fees | Registered fund with limited exits |

A **closed-end fund** in private markets means a limited partnership. Investors commit money, the manager calls it over a few years, invests it and pays it back as holdings are sold. An **evergreen** fund has no end date. New money comes in and some investors may leave at set times, at a value set by the manager.

## How returns are measured

### IRR

The internal rate of return is the single interest rate that makes the present value of all cash paid in equal to all cash paid out, plus today's reported value. It is the industry's headline number. Its problems:

- **Timing drives it.** An early sale or an early distribution raises the IRR even when the money made is small. A fund that returns 1.3 times your money in two years has a higher IRR than one that returns 2.5 times over ten years.
- **It is not a time-weighted return.** Comparing an IRR with an index's yearly return mixes two different measures [@ilmanen2019].
- **Borrowing at the fund raises it.** Many funds borrow against investors' commitments (subscription lines) and call cash later. This shortens the time your money is at work and lifts the IRR without making more money. Albertus and Denes study this fund-level debt [@albertus2026]; we read only the registry record, so we do not quote their numbers.
- **It assumes reinvestment at the same rate**, in the sense that one rate is applied to every cash flow. A very high IRR from an early win cannot be earned again on the money paid back.
- **It can have no answer or several** when cash flows change sign more than once. The PME always exists and is unique [@sorensen2015].

### Multiples: TVPI, DPI, RVPI

- **DPI** (distributed to paid-in): cash actually returned, divided by cash paid in. This is the only part you have in hand.
- **RVPI** (residual value to paid-in): the manager's reported value of what is left, divided by cash paid in.
- **TVPI** (total value to paid-in) = DPI + RVPI. Early in a fund's life, TVPI is mostly the manager's own estimate.

Multiples ignore time. A TVPI of 1.6 over 4 years and over 12 years look the same. Read them with the fund's age.

### PME and its cousins

- **Kaplan and Schoar PME.** Discount every cash flow by the return of a public index over the same dates. Divide the discounted distributions by the discounted contributions. Above 1 means the fund beat the index after fees [@kaplan2005]. Sorensen and Jagannathan show it equals valuing the cash flows with a dynamic CAPM, it needs no beta estimate, and a fund cannot raise it just by adding leverage. The index should be one that matches the investor's overall wealth [@sorensen2015].
- **Long-Nickels index comparison method (ICM, also called PME).** Invests each contribution in the index and withdraws each distribution, then compares IRRs. It can give a negative ending value when the fund does well. We did not find a peer-reviewed source we could check for the original 1996 note, so this description is from common practice (unverified).
- **Direct alpha.** Gredil, Griffiths and Stucke turn lifetime cash flows into an annual excess return over the index, and argue that older PME methods are either rough rules or carry large approximation errors [@gredil2023].
- **Risk-adjusted versions.** Korteweg and Nagel generalise the PME with a stochastic discount factor. Venture funds' abnormal returns come out close to zero, while start-up investments themselves earn large ones [@korteweg2016]. Gupta and Van Nieuwerburgh build a replicating portfolio of listed assets; after adjusting for horizon risk and many factors, average risk-adjusted profits are negative [@gupta2021]. Ang, Chen, Goetzmann and Phalippou estimate a time series of private equity returns from cash flows alone [@ang2018].

What to check on any track record: the benchmark index, the fund ages, how much of the TVPI is DPI, whether a subscription line was used, and whether the numbers are net of all fees and carry.

## Smoothing and stale prices

Private assets are valued by appraisal or by the manager, usually quarterly. Appraisers anchor on the last value and update slowly. Reported returns then lag and smooth the true ones.

- **Real estate.** Geltner showed how appraisal smoothing biases returns and how to recover market values from appraised values without assuming an efficient market. He applied it to the Russell-NCREIF index [@geltner1991; @geltner1993]. Fisher, Geltner and Webb compare ways of building commercial property value indexes [@fisher1994]. After adjusting for property mix, leverage and appraisal smoothing, private and public real estate returns are not statistically different over the long run [@pagliari2005]. REITs and appraisal-based indexes share a common real estate factor once put on a comparable basis [@ang2013].
- **The simple fix: AR(1) unsmoothing.** If the reported return r\_t mixes today's true return R\_t with last period's reported return, r\_t = (1 - a) R\_t + a r\_(t-1), then R\_t = (r\_t - a r\_(t-1)) / (1 - a). Here a is the first-order autocorrelation of reported returns. This is the Geltner approach in its simplest form. The unsmoothed series has the same average and a higher volatility.
- **Getmansky, Lo and Makarov.** Reported returns are a weighted average of true returns this period and the last few, with weights that sum to one. They estimate the weights by maximum likelihood, show that smoothing understates volatility and inflates the Sharpe ratio, and offer a smoothing-adjusted Sharpe ratio [@getmansky2004].
- **Stale prices hide market exposure.** Regressing hedge fund index returns on the S&P 500 with lagged terms shows much more market exposure than a plain regression, and no value added over 1994 to 2000 [@asness2001]. The same lagged-beta test applies to private funds.
- **A common smoothing source.** Couts, Gonçalves and Rossi find that funds holding similar assets share smoothing that standard unsmoothing misses. Their method lowers the average illiquid fund's alpha [@couts2024].
- **Nowcasting.** Brown, Ghysels and Gredil estimate weekly unsmoothed values for each fund. Buyout funds have a market beta near 1.0 and total risk of 33% a year; venture near 1.4 and 40% [@brown2022].
- **Marks around fundraising.** Barber and Yasuda study interim fund performance when managers raise their next fund [@barber2017]; we read only the record. Listed fund-of-fund prices predict later changes in reported private equity values, so the market moves first [@jegadeesh2015].

The phrase "volatility laundering" is used by practitioners for this effect. We did not find a peer-reviewed paper with that title, so we use the papers above instead.

## Fees

- Fees on private equity were estimated at about 6% a year, and average net performance at 3% a year below the S&P 500, or 6% after a risk adjustment [@phalippou2008].
- About two thirds of a manager's expected revenue comes from fixed parts such as management fees, not from performance. Buyout managers grow fund size faster than venture managers [@metrick2010].
- Robinson and Sensoy relate managers' pay and ownership to cash flow performance [@robinson2013]; record only.
- Most funds have two tiers of fees, and some investors consistently pay less than others in the same fund [@begenau2024].
- Side vehicles such as co-investments made up 32% of investments in one custodial sample, and on average lagged the managers' main funds [@lerner2022].
- Large pension funds received net multiples of 1.51 to 1.54, about 11% a year, which matches public equity indexes since about 2006, while carry paid to managers is estimated at 230 billion USD [@phalippou2020].

Retail wrappers add their own layer: a management fee on the wrapper, often an incentive fee, distribution or servicing fees by share class, and fund expenses. Read the fee table in the prospectus.

## What the performance evidence says

- **Buyout.** Strong in Burgiss data against the S&P 500 [@harris2014; @kaplan2015]. Weaker or neutral against small value and leverage [@stafford2021], or using market-price based estimates: listed fund-of-fund prices imply about 1% a year abnormal return for unlisted funds and zero or slightly negative for listed ones [@jegadeesh2015].
- **Venture.** Highly skewed. Correcting for the fact that only successful companies go public cuts the mean log return from about 100% to about 7% [@cochrane2005a]. Fund-level abnormal returns are close to zero [@korteweg2016].
- **Persistence.** It used to be strong for both buyout and venture. Using only what an investor knew at fundraising, there is little or no persistence for post-2000 buyout funds, while venture persistence remains [@harris2020; @kaplan2015]. Korteweg and Sorensen separate skill from luck [@korteweg2017]; record only.
- **Funds of funds.** After fees they match or beat public indexes, but buyout funds of funds lag direct fund investing [@harris2017].
- **Data matters.** Venture Economics data showed lower performance; Cambridge Associates and Preqin are qualitatively similar to Burgiss [@harris2014].

## The illiquidity premium

- Private equity loads on the same liquidity risk factor as public equity, with a premium of about 3% a year; adding it reduces alpha to zero [@franzoni2012]. The liquidity factor itself comes from public stocks: stocks more sensitive to market liquidity earned 7.5% a year more from 1966 to 1999 [@pastor2003].
- A model of an investor who cannot sell finds that fees, carry and illiquidity are costly, and investors may just break even [@sorensen2014].
- Expected return edges over cheaper public equity appear to be shrinking, perhaps because investors value smooth returns [@ilmanen2019; @ilmanen2020].
- Selling early costs money: most secondary sales happen below reported value, and buyers beat sellers by about five percentage points a year on a market-adjusted basis [@nadauld2019].

## Private credit, real estate and infrastructure

- **Private credit.** About a third of middle-market loans in one hand-collected sample came directly from nonbanks. Bank rules push riskier borrowers there, and they pay higher rates [@chernenko2022]. Direct lenders say they lend to companies and at leverage banks would not fund, and they use less fund leverage than banks or CLOs [@block2024]. In Burgiss data private credit funds did about as well as or better than leveraged loan, high-yield and BDC indexes, and direct lending had low beta [@munday2018]. With both equity and debt benchmarks, a typical private debt fund earns an insignificant abnormal return after fees [@erel2024].
- **Real estate.** See the smoothing section. Appraisal indexes look calm because of how they are built, not because buildings are safe [@geltner1993; @pagliari2005].
- **Infrastructure.** Closed-end infrastructure funds have cash flows as volatile and cyclical as other private equity, and weak risk-adjusted performance; public institutions did worse than private ones [@andonov2021].

## Access for individuals, and the risks

None of this is a recommendation. Each route has a "what to check" list on the product page.

- **Accredited investors only, for most private funds.** An individual qualifies with income over 200,000 USD (300,000 USD with a spouse or partner) in each of the last two years, or net worth over 1 million USD excluding the main home, or certain securities licences [@url-57a0d836].
- **Form D is a notice, not an approval.** Companies selling securities privately under Regulation D file a Form D within 15 days of the first sale. It is a notice of an exempt offering, not a registration [@url-98351ef7]. A filing tells you an offering exists. It says nothing about quality.
- **Interval funds.** Registered closed-end funds that must offer to repurchase between 5% and 25% of shares at set intervals of 3, 6 or 12 months, with a repurchase fee of at most 2% [@url-a4070279]. If more people want out than the offer allows, each gets a share of what they asked for.
- **Tender-offer funds.** Similar, but the board decides whether and when to offer repurchases. There may be none in a bad year.
- **BDCs.** Companies that must hold at least 70% of assets in eligible investments, mostly private companies [@url-52604426]. Their borrowing must keep asset coverage at 200%, so debt can equal equity, or at 150% if shareholders approve, so debt can reach twice equity [@url-f388c471]. Listed BDCs trade daily and can sit at a discount or premium to their reported net asset value. Non-traded BDCs offer limited repurchases.
- **Non-traded REITs.** Priced at a manager-set NAV, with monthly and quarterly redemption caps. In November 2022 Blackstone Real Estate Income Trust received repurchase requests above its 2% monthly and 5% quarterly limits and paid out only up to the 2% monthly limit [@url-7414523f].
- **Listed private equity.** Shares of listed managers, listed fund-of-funds and listed investment companies trade daily. They behave much like small-cap stocks [@jegadeesh2015], and listed vehicles can trade far from reported value. The common index families for them are licensed, so we do not use them.
- **Evergreen funds from large managers.** Several managers now sell evergreen private markets funds to wealthy individuals, for example Hamilton Lane's private wealth funds [@url-7be4cd1d]. Exits are limited and values are set by the manager.
- **Tokenised private credit.** Loans recorded as tokens on a blockchain. The FSB found adoption very low, and warned about liquidity and maturity mismatch, complexity and opacity [@url-1b07e2c5]. The token does not change the borrower. If the borrower defaults, the token loses value, and legal claims may be unclear.

Risks common to all of them: you may not get your money back when you want it; the reported value is an estimate; fees are layered; the manager decides values and exits; and past top-quartile results do not reliably repeat for buyouts [@harris2020].

## Who sells the data

| Provider | What it has | Cost to us |
| --- | --- | --- |
| Burgiss (MSCI) | Fund cash flows sourced from over 200 institutional investors (as of the 2014 study) [@harris2014] | Paid; MSCI page not opened (unverified) |
| Preqin (BlackRock) | Fund, deal and performance data, benchmarks | Mostly paid; free account and free benchmarks offered [@url-7ac3dc51] |
| PitchBook | Deals, valuations, fund returns | Paid; site refused our request (unverified) [@url-6ec5737a] |
| Cambridge Associates | Quarterly IRR and multiple benchmarks by strategy and vintage | Selected statistics free; full reports sold through S&P Dow Jones Indices [@url-1094f4ac] |
| NCREIF | NCREIF Property Index (NPI) and ODCE fund index, quarterly | Headline quarterly returns free; detail for members [@url-8648340c] |
| Cliffwater | Cliffwater Direct Lending Index | Page did not load readably (unverified) [@url-6601c4f7] |
| SEC | Form D data sets, quarterly, from 2008 Q1 [@url-5e096a75]; BDC and fund filings on EDGAR | Free, public |
| Federal Reserve on FRED | Commercial real estate prices, bank lending, lending standards | Free; each series has its own reuse tag |

Commercial benchmarks forbid redistribution without a licence, so Parity shows none of their numbers.

## What Parity can measure with free data

Built alongside this page; the numbers live on the research page `/research/#/private` and the product page `/app/#/markets/private`, not here.

- **SEC Form D counts** by industry and offering size, from the SEC's quarterly Form D data sets. They count private offerings filed, not money raised or returns.
- **FRED series** on commercial real estate prices, bank lending to businesses and on property, and banks' lending standards. These are proxies for the credit and property cycle that private funds live in.
- **BDC net asset values** from SEC EDGAR filings: a public, quarterly window on private loan marks.
- **An unsmoothing demo** on an appraisal-based real estate index: the Geltner AR(1) fix and a Getmansky, Lo and Makarov MA(2) fit, showing how much the reported volatility rises.

None of these is a return series for private funds. They show the cycle, the flow of new offerings and how smoothing changes the picture.

First results, fetched 2026-10-23 ([DEC-0029](../decisions/0029-private-markets-free-proxies-an-unsmoothing-study-and-plain-pages.md) has the full table):

- The Fed's commercial property index in its appraisal era (1960 to 1995) has a first-order autocorrelation of 0.80. Geltner unsmoothing lifts its yearly volatility from 2.9% to 8.9%, against 16.7% for US stocks over the same years. The MA(2) fit cannot reach that autocorrelation, so its 5.1% is a lower bound.
- After 1996, when the index follows repeat sales, the autocorrelation falls to 0.23 and unsmoothing lifts volatility from 7.4% to 9.4%. The same-quarter stock beta is about zero, but the summed beta over three quarters is 0.12.
- FHFA's all-transactions house price index, deseasonalised, goes from 2.7% to 5.6%.
- New Form D notices rose from 7,714 in 2023 Q4 to 10,291 in 2026 Q3.
- Quarterly NAV changes of six of seven large listed BDCs are positively autocorrelated, a hint of smoothed loan marks.

## What we could not check

- Long and Nickels (1996), the original ICM note: no record we could verify.
- Albertus and Denes (2026), Barber and Yasuda (2017), Korteweg and Sorensen (2017), Robinson and Sensoy (2013), Geltner (1991) and Fisher, Geltner and Webb (1994): Crossref records only. We state only what their titles and records support.
- Harris, Jenkinson, Kaplan and Stucke on persistence and on funds of funds, and Erel, Flanagan and Weisbach: NBER working papers. We did not confirm a journal version.
- MSCI's Burgiss page, PitchBook and the Cliffwater index page did not open for us. SSRN pages were blocked.
- Investor.gov and FINRA bulletins on interval funds, BDCs and non-traded REITs did not load, so we cite the rule and statute text instead.
- Specific tokenised private credit defaults are widely reported, but we found no regulator or peer-reviewed source we could open, so we name none.

## Papers and pages used

Every paper below was checked against its Crossref record on 2026-10-23 (authors, year, title, journal, volume, pages and DOI). "Abstract read" means we read the abstract on Crossref, OpenAlex or NBER. "Record only" means we saw the registry record but not the abstract, so this page states only what the title and record support.

Measuring returns:

- Kaplan and Schoar (2005), Private equity performance: returns, persistence, and capital flows, *Journal of Finance* 60(4), 1791-1823. Abstract read (NBER version). <https://doi.org/10.1111/j.1540-6261.2005.00780.x>
- Sorensen and Jagannathan (2015), The public market equivalent and private equity performance, *Financial Analysts Journal* 71(4), 43-50. Abstract read. <https://doi.org/10.2469/faj.v71.n4.4>
- Gredil, Griffiths and Stucke (2023), Benchmarking private equity: the direct alpha method, *Journal of Corporate Finance* 81, 102360. Abstract read. <https://doi.org/10.1016/j.jcorpfin.2023.102360>
- Korteweg and Nagel (2016), Risk-adjusting the returns to venture capital, *Journal of Finance* 71(3), 1437-1470. Abstract read (NBER version). <https://doi.org/10.1111/jofi.12390>
- Albertus and Denes (2026), Private equity fund debt: agency costs and cash flow management, *Journal of Financial and Quantitative Analysis*, 1-64. Record only. <https://doi.org/10.1017/s0022109026102890>

Performance evidence:

- Harris, Jenkinson and Kaplan (2014), Private equity performance: what do we know?, *Journal of Finance* 69(5), 1851-1882. Abstract read. <https://doi.org/10.1111/jofi.12154>
- Kaplan and Sensoy (2015), Private equity performance: a survey, *Annual Review of Financial Economics* 7, 597-614. Abstract read. <https://doi.org/10.1146/annurev-financial-111914-041858>
- Phalippou and Gottschalg (2009), The performance of private equity funds, *Review of Financial Studies* 22(4), 1747-1776. Abstract read. <https://doi.org/10.1093/rfs/hhn014>
- Phalippou (2020), An inconvenient fact: private equity returns and the billionaire factory, *Journal of Investing* 30(1), 11-39. Abstract read. <https://doi.org/10.3905/joi.2020.1.153>
- Harris, Jenkinson, Kaplan and Stucke (2020), Has persistence persisted in private equity? Evidence from buyout and venture capital funds, NBER working paper 28109. Abstract read. <https://doi.org/10.3386/w28109>
- Korteweg and Sorensen (2017), Skill and luck in private equity performance, *Journal of Financial Economics* 124(3), 535-562. Record only. <https://doi.org/10.1016/j.jfineco.2017.03.006>
- Cochrane (2005), The risk and return of venture capital, *Journal of Financial Economics* 75(1), 3-52. Abstract read (NBER version). <https://doi.org/10.1016/j.jfineco.2004.03.006>
- Gupta and Van Nieuwerburgh (2021), Valuing private equity investments strip by strip, *Journal of Finance* 76(6), 3255-3307. Abstract read (NBER version). <https://doi.org/10.1111/jofi.13073>
- Stafford (2022), Replicating private equity with value investing, homemade leverage, and hold-to-maturity accounting, *Review of Financial Studies* 35(1), 299-342. Abstract read. <https://doi.org/10.1093/rfs/hhab020>
- Jegadeesh, Kräussl and Pollet (2015), Risk and expected returns of private equity investments: evidence based on market prices, *Review of Financial Studies* 28(12), 3269-3302. Abstract read (NBER version). <https://doi.org/10.1093/rfs/hhv046>
- Barber and Yasuda (2017), Interim fund performance and fundraising in private equity, *Journal of Financial Economics* 124(1), 172-194. Record only. <https://doi.org/10.1016/j.jfineco.2017.01.001>
- Brown, Ghysels and Gredil (2023), Nowcasting net asset values: the case of private equity, *Review of Financial Studies* 36(3), 945-986. Abstract read. <https://doi.org/10.1093/rfs/hhac045>

Smoothing and stale prices:

- Geltner (1991), Smoothing in appraisal-based returns, *Journal of Real Estate Finance and Economics* 4(3), 327-345. Record only. <https://doi.org/10.1007/bf00161933>
- Geltner (1993), Estimating market values from appraised values without assuming an efficient market, *Journal of Real Estate Research* 8(3), 325-345. Abstract read. <https://doi.org/10.1080/10835547.1993.12090713>
- Fisher, Geltner and Webb (1994), Value indices of commercial real estate: a comparison of index construction methods, *Journal of Real Estate Finance and Economics* 9(2), 137-164. Record only. <https://doi.org/10.1007/bf01099972>
- Getmansky, Lo and Makarov (2004), An econometric model of serial correlation and illiquidity in hedge fund returns, *Journal of Financial Economics* 74(3), 529-609. Abstract read (NBER version). <https://doi.org/10.1016/j.jfineco.2004.04.001>
- Asness, Krail and Liew (2001), Do hedge funds hedge?, *Journal of Portfolio Management* 28(1), 6-19. Abstract read. <https://doi.org/10.3905/jpm.2001.319819>
- Ang, Chen, Goetzmann and Phalippou (2018), Estimating private equity returns from limited partner cash flows, *Journal of Finance* 73(4), 1751-1783. Abstract read. <https://doi.org/10.1111/jofi.12688>
- Couts, Gonçalves and Rossi (2024), Unsmoothing returns of illiquid funds, *Review of Financial Studies* 37(7), 2110-2155. Abstract read. <https://doi.org/10.1093/rfs/hhae006>
- Ilmanen (2020), The impact of smoothness on private equity expected returns, *Journal of Investing* 30(1), 63-66. Abstract read. <https://doi.org/10.3905/joi.2020.1.151>

Fees:

- Metrick and Yasuda (2010), The economics of private equity funds, *Review of Financial Studies* 23(6), 2303-2341. Abstract read. <https://doi.org/10.1093/rfs/hhq020>
- Robinson and Sensoy (2013), Do private equity fund managers earn their fees? Compensation, ownership, and cash flow performance, *Review of Financial Studies* 26(11), 2760-2797. Record only. <https://doi.org/10.1093/rfs/hht055>
- Begenau and Siriwardane (2024), Fee variation in private equity, *Journal of Finance* 79(2), 1199-1247. Abstract read. <https://doi.org/10.1111/jofi.13319>
- Lerner, Mao, Schoar and Zhang (2022), Investing outside the box: evidence from alternative vehicles in private equity, *Journal of Financial Economics* 143(1), 359-380. Abstract read (NBER version). <https://doi.org/10.1016/j.jfineco.2021.05.034>

Illiquidity:

- Franzoni, Nowak and Phalippou (2012), Private equity performance and liquidity risk, *Journal of Finance* 67(6), 2341-2373. Abstract read. <https://doi.org/10.1111/j.1540-6261.2012.01788.x>
- Pástor and Stambaugh (2003), Liquidity risk and expected stock returns, *Journal of Political Economy* 111(3), 642-685. Abstract read. <https://doi.org/10.1086/374184>
- Sorensen, Wang and Yang (2014), Valuing private equity, *Review of Financial Studies* 27(7), 1977-2021. Abstract read (NBER version). <https://doi.org/10.1093/rfs/hhu013>
- Ilmanen, Chandra and McQuinn (2019), Demystifying illiquid assets: expected returns for private equity, *Journal of Alternative Investments* 22(3), 8-22. Abstract read. <https://doi.org/10.3905/jai.2019.1.086>
- Nadauld, Sensoy, Vorkink and Weisbach (2019), The liquidity cost of private equity investments: evidence from secondary market transactions, *Journal of Financial Economics* 132(3), 158-181. Abstract read (NBER version). <https://doi.org/10.1016/j.jfineco.2018.11.007>

Private credit, real estate and infrastructure:

- Munday, Hu, True and Zhang (2018), Performance of private credit funds: a first look, *Journal of Alternative Investments* 21(2), 31-51. Abstract read. <https://doi.org/10.3905/jai.2018.21.2.031>
- Chernenko, Erel and Prilmeier (2022), Why do firms borrow directly from nonbanks?, *Review of Financial Studies* 35(11), 4902-4947. Abstract read. <https://doi.org/10.1093/rfs/hhac016>
- Block, Jang, Kaplan and Schulze (2024), A survey of private debt funds, *Review of Corporate Finance Studies* 13(2), 335-383. Abstract read. <https://doi.org/10.1093/rcfs/cfae001>
- Erel, Flanagan and Weisbach (2024), Risk-adjusting the returns to private debt funds, NBER working paper 32278. Abstract read. <https://doi.org/10.3386/w32278>
- Pagliari, Scherer and Monopoli (2005), Public versus private real estate equities: a more refined, long-term comparison, *Real Estate Economics* 33(1), 147-187. Abstract read. <https://doi.org/10.1111/j.1080-8620.2005.00115.x>
- Ang, Nabar and Wald (2013), Searching for a common factor in public and private real estate returns, *Journal of Portfolio Management* 39(5), 120-133. Abstract read. <https://doi.org/10.3905/jpm.2013.39.5.120>
- Andonov, Kräussl and Rauh (2021), Institutional investors and infrastructure investing, *Review of Financial Studies* 34(8), 3880-3934. Abstract read. <https://doi.org/10.1093/rfs/hhab048>
- Harris, Jenkinson, Kaplan and Stucke (2017), Financial intermediation in private equity: how well do funds of funds perform?, NBER working paper 23428. Abstract read. <https://doi.org/10.3386/w23428>

Rules, filings and providers (opened on 2026-10-23 unless marked):

- SEC, Accredited investors. <https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/accredited-investors>
- SEC, Filing a Form D notice. <https://www.sec.gov/resources-small-businesses/exempt-offerings/filing-form-d-notice>
- SEC, Form D data sets. <https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets>
- Rule 23c-3, periodic repurchases by closed-end funds (interval funds), 17 CFR 270.23c-3. <https://www.law.cornell.edu/cfr/text/17/270.23c-3>
- Business development company assets, 15 U.S.C. 80a-54. <https://www.law.cornell.edu/uscode/text/15/80a-54>
- Business development company capital structure, 15 U.S.C. 80a-60. <https://www.law.cornell.edu/uscode/text/15/80a-60>
- Blackstone Real Estate Income Trust, prospectus supplement filed 2022-12-15 (November 2022 NAV and repurchases). <https://www.sec.gov/Archives/edgar/data/1662972/000166297222000143/breitnavnovember2022.htm>
- Financial Stability Board (2024), The financial stability implications of tokenisation. <https://www.fsb.org/2024/10/the-financial-stability-implications-of-tokenisation/>
- Cambridge Associates, Private investment benchmarks. <https://www.cambridgeassociates.com/private-investment-benchmarks/>
- Preqin. <https://www.preqin.com/>
- NCREIF, index returns. <https://www.ncreif.org/indices/index-returns/>
- Hamilton Lane. <https://www.hamiltonlane.com/>
- PitchBook (refused our request, unverified). <https://pitchbook.com/>
- Cliffwater Direct Lending Index (page loaded with no readable content, unverified). <https://www.cliffwaterdirectlendingindex.com/>

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@kaplan2005](../REFERENCES.md#kaplan2005): Kaplan and Schoar (2005), Private Equity Performance: Returns, Persistence, and Capital Flows
- [@sorensen2015](../REFERENCES.md#sorensen2015): Sorensen and Jagannathan (2015), The Public Market Equivalent and Private Equity Performance
- [@harris2014](../REFERENCES.md#harris2014): Harris et al. (2014), Private Equity Performance: What Do We Know?
- [@phalippou2020](../REFERENCES.md#phalippou2020): Phalippou (2020), An Inconvenient Fact: Private Equity Returns and the Billionaire Factory
- [@phalippou2008](../REFERENCES.md#phalippou2008): Phalippou and Gottschalg (2008), The Performance of Private Equity Funds
- [@stafford2021](../REFERENCES.md#stafford2021): Stafford (2021), Replicating Private Equity with Value Investing, Homemade Leverage, and Hold-to-Maturity Accounting
- [@ilmanen2019](../REFERENCES.md#ilmanen2019): Ilmanen et al. (2019), Demystifying Illiquid Assets: Expected Returns for Private Equity
- [@getmansky2004](../REFERENCES.md#getmansky2004): Getmansky et al. (2004), An econometric model of serial correlation and illiquidity in hedge fund returns
- [@geltner1993](../REFERENCES.md#geltner1993): Geltner (1993), Estimating Market Values from Appraised Values without Assuming an Efficient Market
- [@brown2022](../REFERENCES.md#brown2022): Brown et al. (2022), Nowcasting Net Asset Values: The Case of Private Equity
- [@metrick2010](../REFERENCES.md#metrick2010): Metrick and Yasuda (2010), The Economics of Private Equity Funds
- [@begenau2024](../REFERENCES.md#begenau2024): Begenau and Siriwardane (2024), Fee Variation in Private Equity
- [@franzoni2012](../REFERENCES.md#franzoni2012): Franzoni et al. (2012), Private Equity Performance and Liquidity Risk
- [@sorensen2014](../REFERENCES.md#sorensen2014): Sorensen et al. (2014), Valuing Private Equity
- [@ilmanen2020](../REFERENCES.md#ilmanen2020): Ilmanen (2020), The Impact of Smoothness on Private Equity Expected Returns
- [@url-a4070279](../REFERENCES.md#url-a4070279): 17 CFR 270.23c-3, Repurchase of securities of closed-end companies (interval funds) (n.d.)
- [@url-7414523f](../REFERENCES.md#url-7414523f): Blackstone Real Estate Income Trust, prospectus supplement, November 2022 NAV and share repurchases (424B3, filed 2022-12-15) (2022)
- [@albertus2026](../REFERENCES.md#albertus2026): Albertus and Denes (2026), Private Equity Fund Debt: Agency Costs and Cash Flow Management
- [@gredil2023](../REFERENCES.md#gredil2023): Gredil et al. (2023), Benchmarking private equity: The direct alpha method
- [@korteweg2016](../REFERENCES.md#korteweg2016): Korteweg and Nagel (2016), Risk-Adjusting the Returns to Venture Capital
- [@gupta2021](../REFERENCES.md#gupta2021): Gupta and Van Nieuwerburgh (2021), Valuing Private Equity Investments Strip by Strip
- [@ang2018](../REFERENCES.md#ang2018): Ang et al. (2018), Estimating Private Equity Returns from Limited Partner Cash Flows
- [@geltner1991](../REFERENCES.md#geltner1991): Geltner (1991), Smoothing in appraisal-based returns
- [@fisher1994](../REFERENCES.md#fisher1994): Fisher et al. (1994), Value indices of commercial real estate: A comparison of index construction methods
- [@pagliari2005](../REFERENCES.md#pagliari2005): Pagliari et al. (2005), Public Versus Private Real Estate Equities: A More Refined, Long-Term Comparison
- [@ang2013](../REFERENCES.md#ang2013): Ang et al. (2013), Searching for a Common Factor in Public and Private Real Estate Returns
- [@asness2001](../REFERENCES.md#asness2001): Asness et al. (2001), Do Hedge Funds Hedge?
- [@couts2024](../REFERENCES.md#couts2024): Couts et al. (2024), Unsmoothing Returns of Illiquid Funds
- [@barber2017](../REFERENCES.md#barber2017): Barber and Yasuda (2017), Interim fund performance and fundraising in private equity
- [@jegadeesh2015](../REFERENCES.md#jegadeesh2015): Jegadeesh et al. (2015), Risk and Expected Returns of Private Equity Investments: Evidence Based on Market Prices
- [@robinson2013](../REFERENCES.md#robinson2013): Robinson and Sensoy (2013), Do Private Equity Fund Managers Earn Their Fees? Compensation, Ownership, and Cash Flow Performance
- [@lerner2022](../REFERENCES.md#lerner2022): Lerner et al. (2022), Investing outside the box: Evidence from alternative vehicles in private equity
- [@kaplan2015](../REFERENCES.md#kaplan2015): Kaplan and Sensoy (2015), Private Equity Performance: A Survey
- [@cochrane2005a](../REFERENCES.md#cochrane2005a): Cochrane (2005), The risk and return of venture capital
- [@harris2020](../REFERENCES.md#harris2020): Harris et al. (2020), Has Persistence Persisted in Private Equity? Evidence from Buyout and Venture Capital Funds
- [@korteweg2017](../REFERENCES.md#korteweg2017): Korteweg and Sorensen (2017), Skill and luck in private equity performance
- [@harris2017](../REFERENCES.md#harris2017): Harris et al. (2017), Financial Intermediation in Private Equity: How Well Do Funds of Funds Perform?
- [@pastor2003](../REFERENCES.md#pastor2003): Pástor and Stambaugh (2003), Liquidity Risk and Expected Stock Returns
- [@nadauld2019](../REFERENCES.md#nadauld2019): Nadauld et al. (2019), The liquidity cost of private equity investments: Evidence from secondary market transactions
- [@chernenko2022](../REFERENCES.md#chernenko2022): Chernenko et al. (2022), Why Do Firms Borrow Directly from Nonbanks?
- [@block2024](../REFERENCES.md#block2024): Block et al. (2024), A Survey of Private Debt Funds
- [@munday2018](../REFERENCES.md#munday2018): Munday et al. (2018), Performance of Private Credit Funds: A First Look
- [@erel2024](../REFERENCES.md#erel2024): Erel et al. (2024), Risk-Adjusting the Returns to Private Debt Funds
- [@andonov2021](../REFERENCES.md#andonov2021): Andonov et al. (2021), Institutional Investors and Infrastructure Investing
- [@url-57a0d836](../REFERENCES.md#url-57a0d836): Accredited investors (n.d.)
- [@url-98351ef7](../REFERENCES.md#url-98351ef7): Filing a Form D notice (n.d.)
- [@url-52604426](../REFERENCES.md#url-52604426): 15 U.S. Code 80a-54, Functions and activities of business development companies (n.d.)
- [@url-f388c471](../REFERENCES.md#url-f388c471): 15 U.S. Code 80a-60, Capital structure of business development companies (n.d.)
- [@url-7be4cd1d](../REFERENCES.md#url-7be4cd1d): Hamilton Lane (n.d.)
- [@url-1b07e2c5](../REFERENCES.md#url-1b07e2c5): The financial stability implications of tokenisation (2024)
- [@url-7ac3dc51](../REFERENCES.md#url-7ac3dc51): Preqin (n.d.)
- [@url-6ec5737a](../REFERENCES.md#url-6ec5737a): PitchBook (n.d.)
- [@url-1094f4ac](../REFERENCES.md#url-1094f4ac): Private investment benchmarks (n.d.)
- [@url-8648340c](../REFERENCES.md#url-8648340c): NCREIF index returns (n.d.)
- [@url-6601c4f7](../REFERENCES.md#url-6601c4f7): Cliffwater Direct Lending Index (n.d.)
- [@url-5e096a75](../REFERENCES.md#url-5e096a75): Form D data sets (n.d.)

## Referenced by

- [DEC-0029: Private markets, free proxies, an unsmoothing study and plain pages](../decisions/0029-private-markets-free-proxies-an-unsmoothing-study-and-plain-pages.md)
<!-- backlinks:end -->
