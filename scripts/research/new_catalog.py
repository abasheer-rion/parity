"""Write the five new catalog entries from RES-0011 and RES-0012. Usage: new_catalog.py REPO_ROOT"""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
NOTE = "Added from RES-0011 and RES-0012 on 2026-10-21."


def rr(source, url, period, market, sharpe, ret=None, vol=None, notes="", costs=None):
    return {"source": source, "source_url": url, "period": period, "market": market,
            "sharpe": sharpe, "annual_return": ret, "volatility": vol, "max_drawdown": None,
            "evidence_type": "backtest", "costs_included": costs, "verified_on_page": True,
            "notes": notes}


def research():
    return {"stage": 2, "hypothesis": None, "strategy": None, "registrations": [], "runs": [],
            "verdict": None, "notes": NOTE}


entries = [
    {
        "id": "ALG-0083", "slug": "em-fx-carry", "name": "Emerging market currency carry, cost aware",
        "family": "carry", "markets": ["fx"], "horizon": "monthly",
        "tags": ["carry", "emerging-markets", "cross-sectional", "transaction-costs"],
        "origin": {"type": "academic", "first_published": 2007,
                   "authors": "Burnside, Eichenbaum, Rebelo",
                   "source_title": "The Returns to Currency Speculation in Emerging Markets (NBER WP 12916, 2007)",
                   "source_url": "https://www.nber.org/papers/w12916"},
        "how_it_works": {
            "simple": "Countries like Brazil, Mexico and South Africa pay much higher interest than the US. Hold their money to collect that interest, spread over many countries, and only when the extra interest is bigger than the cost of trading.",
            "analogy": "Like lending to many small shops at a high rate: any one may go bust, but across many of them the interest usually more than covers the losses.",
            "precise": "Each month rank emerging market currencies by their interest rate gap to USD (or forward discount). Hold the high-carry group long, funded in USD, equal weight, and skip currencies whose gap does not exceed the bid and ask cost. Burnside et al. show that ignoring spreads turns the Sharpe ratio negative; a cost-aware rule earns a high Sharpe ratio before crises are added."},
        "rule": "Monthly: for each EM currency with data, carry = local short-term rate minus US 3-month rate. Long the top third by carry against USD, equal weights; drop any currency whose carry is below an assumed cost; close at a penalty if the currency stops being quoted.",
        "data_needed": ["Daily EM spot rates (ECB reference rates)",
                        "EM short-term interest rates (OECD IR3TIB or BIS policy rates)",
                        "US 3-month rate"],
        "economic_rationale": "High-rate EM currencies have not depreciated by enough to offset their interest gap on average (forward premium puzzle), and many EM currencies move independently, so a basket diversifies.",
        "why_it_might_fail": "Spreads are two to four times wider than in G10; devaluations of 20% to 56% in a week (Russia 1998, Argentina 2002); capital controls and sanctions can stop exit (RUB 2022); every published sample ends by 2010, before a weak decade for EM currencies.",
        "reported_results": [
            rr("Burnside, Eichenbaum and Rebelo (2007), Table 1, transaction-cost-based carry, 63 currencies",
               "https://www.nber.org/system/files/working_papers/w12916/w12916.pdf",
               "1997-10 to 2006-11", "63 developed and EM currencies, weekly", 1.32, costs=True,
               notes="Quote: \"the Sharpe ratio for this strategy is very high: 0.18 on a weekly basis and 1.32 on an annualized basis\". The naive rule with spreads charged is \"actually negative (-0.05)\". Adding five crises by hand cuts the weekly Sharpe from 0.183 to 0.097."),
            rr("Menkhoff, Sarno, Schmeling and Schrimpf (2012), Table I, all countries with bid-ask",
               "https://openaccess.city.ac.uk/id/eprint/3391/1/CTVOL_R3_v4_paper.pdf",
               "1983-12 to 2009-08", "48 developed and EM currencies", 0.74, ret=0.0723, vol=0.0981,
               costs=True,
               notes="High minus low carry portfolio, skewness -1.03. Developed only (15 countries): 5.72% a year, Sharpe 0.56."),
        ],
        "post_publication_evidence": "None found by us after 2010. Press reports (Bloomberg via BloombergQuint) put 2018 losses on dollar-funded carry at 22% (TRY) and 20% (ARS). See RES-0011.",
        "implementations": [],
        "relevance": {"score": 4, "reason": "Testable with free data on a period no published study covers (2009 on), and the clearest way to extend our G10 carry results."},
        "testable_with_free_data": True, "last_reviewed": "2026-10-21", "research": research(),
    },
    {
        "id": "ALG-0084", "slug": "em-fx-passive-basket", "name": "Passive emerging market currency basket",
        "family": "carry", "markets": ["fx"], "horizon": "monthly",
        "tags": ["carry", "emerging-markets", "long-only", "out-of-sample"],
        "origin": {"type": "academic", "first_published": 2008, "authors": "Gilmore, Hayashi",
                   "source_title": "Emerging Market Currency Excess Returns (NBER WP 14528, 2008; AEJ: Macroeconomics 3(4), 2011)",
                   "source_url": "https://www.nber.org/papers/w14528"},
        "how_it_works": {
            "simple": "Own a little of the money of about 20 emerging countries, equally, against the US dollar, and collect their higher interest.",
            "analogy": "Like an index fund, but for the currencies of fast-growing countries.",
            "precise": "Equal-weighted long position in one-month forwards (or spot plus interest gap) on about 20 EM currencies against USD, rebalanced monthly and rolled with FX swaps. Gilmore and Hayashi report a Sharpe ratio of 1.34 over January 1999 to September 2008 and estimate rolling costs of about 30 basis points a year."},
        "rule": "Monthly: equal weight long every EM currency with a price and a rate, funded in USD; total gross exposure 1.",
        "data_needed": ["Daily EM spot rates (ECB reference rates)", "EM short-term interest rates",
                        "US 3-month rate"],
        "economic_rationale": "EM currencies paid a large interest premium and, in the authors' sample, did not depreciate enough to offset it; diversification across regions kept volatility low.",
        "why_it_might_fail": "The sample (1999 to 2008) was an EM boom with a falling dollar and ends a month before the 2008 crash; the authors worked for or consulted for Banque AIG and used proprietary data.",
        "reported_results": [
            rr("Gilmore and Hayashi (2008 NBER version), Table 3, EM20 long-only in USD",
               "https://www.nber.org/system/files/working_papers/w14528/w14528.pdf",
               "1999-01 to 2008-09", "20 EM currencies", 1.34, ret=0.066, vol=0.049, costs=False,
               notes="Mid rates. Same table: G9 majors 2.8% a year, volatility 7.3%, Sharpe 0.38. The authors estimate rolling costs of about 30 bp a year for EM, doubled in autumn 2008."),
        ],
        "post_publication_evidence": "None found by us. Everything after September 2008 is outside the authors' sample.",
        "implementations": [],
        "relevance": {"score": 4, "reason": "Simple to rebuild with free data, and the whole post-2008 period is an untouched out-of-sample test of a well-known result."},
        "testable_with_free_data": True, "last_reviewed": "2026-10-21", "research": research(),
    },
    {
        "id": "ALG-0085", "slug": "em-fx-momentum", "name": "Emerging market currency momentum",
        "family": "momentum-trend", "markets": ["fx"], "horizon": "monthly",
        "tags": ["momentum", "emerging-markets", "cross-sectional", "limits-to-arbitrage"],
        "origin": {"type": "academic", "first_published": 2012,
                   "authors": "Menkhoff, Sarno, Schmeling, Schrimpf",
                   "source_title": "Currency momentum strategies (Journal of Financial Economics 106(3), 660-684)",
                   "source_url": "https://doi.org/10.1016/j.jfineco.2012.06.009"},
        "how_it_works": {
            "simple": "Among emerging market currencies, buy the ones that rose most over the past few months and sell the ones that fell most.",
            "analogy": "Like backing the players on a hot streak in a league where few scouts are watching.",
            "precise": "Rank currencies by past excess return over a formation window (1 to 12 months), long winners, short losers, hold one month. Menkhoff et al. find spreads up to about 10% a year before costs across up to 48 currencies, falling to about 4% after full spreads for the best version, and basically nothing among developed currencies after costs."},
        "rule": "Monthly: rank EM currencies by past 3-month return, long the top third, short the bottom third, equal weights, hold one month.",
        "data_needed": ["Daily EM spot rates (ECB reference rates)",
                        "EM short-term interest rates for carry credit"],
        "economic_rationale": "Limits to arbitrage: high costs and country risk in minor currencies keep slow-moving trends from being traded away.",
        "why_it_might_fail": "The return lives where costs are highest, so a realistic spread may consume it; the developed-market version already failed in our tests (EXP-0004).",
        "reported_results": [
            rr("Menkhoff, Sarno, Schmeling and Schrimpf (2012), JFE, best strategy after full spreads",
               "https://faculty.washington.edu/ss1110/IF/Sarno%20Currency%20Momentum%20JFE%20%281%29.pdf",
               "1976-01 to 2010-01", "Up to 48 currencies", None, ret=0.04, costs=True,
               notes="Quote: \"returns for the best strategy (with f, h=1) drop from nearly 10% to about 4% p.a.\" after full spreads. Developed only: \"basically non-existent after transaction costs\"."),
        ],
        "post_publication_evidence": "None found by us.",
        "implementations": [],
        "relevance": {"score": 3, "reason": "Tests directly why our G10 momentum failed; costs are the main risk."},
        "testable_with_free_data": True, "last_reviewed": "2026-10-21", "research": research(),
    },
    {
        "id": "ALG-0086", "slug": "commodity-variance-risk-premium",
        "name": "Selling commodity volatility (variance risk premium)",
        "family": "volatility", "markets": ["commodities"], "horizon": "monthly",
        "tags": ["volatility", "risk-premium", "options", "crash-risk"],
        "origin": {"type": "academic", "first_published": 2010, "authors": "Trolle, Schwartz",
                   "source_title": "Variance Risk Premia in Energy Commodities (Journal of Derivatives, 2010)",
                   "source_url": "https://infoscience.epfl.ch/record/148475"},
        "how_it_works": {
            "simple": "People who buy protection against big oil price swings usually pay more than the swings turn out to cost. Sell them that protection and keep the difference, as long as no huge swing comes.",
            "analogy": "Like selling storm insurance: most years you keep the premiums, and one bad storm can take years of them.",
            "precise": "Short a 30-day variance swap on crude oil each month: payoff = implied variance at entry minus realised variance over the month. Trolle and Schwartz find annualised Sharpe ratios of 0.59 (crude) and 0.35 (natural gas) for 1996 to 2006; Prokopczuk et al. find negative payoffs for variance buyers in 18 of 21 commodity markets. With free data, OVX squared approximates the variance swap rate and realised variance comes from WTI futures."},
        "rule": "Monthly: short variance at (OVX/100)^2; realised variance from daily log returns of the rolled WTI future over the next month; size to a fixed notional; no trading costs available, so results are upper bounds.",
        "data_needed": ["CBOE OVX (FRED OVXCLS), 2007 on", "WTI futures contracts 1 and 2 (EIA)"],
        "economic_rationale": "Investors pay to hedge price jumps; dealers who sell protection demand a premium.",
        "why_it_might_fail": "Short-volatility positions lose most in crises (2008, March and April 2020); variance swap and option strip costs are large and not in free data; OVX is an index, not a tradable price.",
        "reported_results": [
            rr("Trolle and Schwartz (2010), working paper, short variance swaps",
               "https://infosciences.epfl.ch/record/148475/files/TrolleSchwartz_Energy_Variance_Risk_Premia.pdf",
               "1996-01 to 2006-11", "NYMEX crude oil", 0.59,
               notes="Natural gas 0.35, S&P 500 1.02 over the same period. Variance swap returns are positively skewed for the buyer, so negatively skewed for the seller."),
            rr("Prokopczuk, Symeonidis and Wese Simen (2017), accepted manuscript, Table 1",
               "https://ueaeprints.uea.ac.uk/63547/1/Variance_risk_in_Commodity_Markets.pdf",
               "Varies by market", "21 commodity markets", None,
               notes="Long variance swap payoff negative in 18 of 21 markets, for example -8.985% on average in natural gas; payoffs more negative after 2000."),
        ],
        "post_publication_evidence": "Prokopczuk et al. (2017) extend the evidence to 21 markets and find it holds, more strongly after 2000.",
        "implementations": [],
        "relevance": {"score": 3, "reason": "A direct test of the volatility idea with free data, but only as an upper bound because costs are missing."},
        "testable_with_free_data": True, "last_reviewed": "2026-10-21", "research": research(),
    },
    {
        "id": "ALG-0087", "slug": "commodity-currencies-predict-commodities",
        "name": "Commodity currencies predict commodity prices",
        "family": "macro-fundamental", "markets": ["commodities", "fx"], "horizon": "monthly",
        "tags": ["commodity-currencies", "predictability", "lead-lag", "out-of-sample"],
        "origin": {"type": "academic", "first_published": 2008, "authors": "Chen, Rogoff, Rossi",
                   "source_title": "Can Exchange Rates Forecast Commodity Prices? (Quarterly Journal of Economics 125(3), 2010)",
                   "source_url": "https://doi.org/10.1162/qjec.2010.125.3.1145"},
        "how_it_works": {
            "simple": "When the Australian, Canadian and New Zealand dollars rise, commodity prices tend to rise in the following months. So use those currencies as a signal to own or sell commodities.",
            "analogy": "Like reading the odds to guess the result: the currency market prices in news about demand before commodity prices catch up.",
            "precise": "Regress next-quarter changes in commodity price indices on this quarter's changes in commodity-currency exchange rates. Chen et al. find robust out-of-sample predictability over samples ending in 2008, and that the reverse direction (commodities predicting currencies) is notably less robust, consistent with exchange rates being forward looking."},
        "rule": "Monthly: average the past 3-month returns of AUD, CAD and NZD against USD; hold energy futures long when positive and short when negative, volatility-scaled.",
        "data_needed": ["Daily AUD, CAD, NZD spot (FRED H.10)",
                        "Energy futures contracts 1 and 2 (EIA)"],
        "economic_rationale": "Exchange rates are asset prices that react to expected future commodity demand; spot commodity prices respond to current supply and demand imbalances.",
        "why_it_might_fail": "The paper's gains are statistical (lower forecast error), not trading returns; the link may have changed after 2008; energy futures are only part of the commodity indices the paper forecasts.",
        "reported_results": [
            rr("Chen, Rogoff and Rossi (2010), NBER w13901",
               "https://www.nber.org/system/files/working_papers/w13901/w13901.pdf",
               "Quarterly, start dates 1973 to 1989, ending 2008Q1",
               "AUD, CAD, NZD, ZAR, CLP and commodity price indices", None,
               notes="Abstract: commodity currency exchange rates \"have remarkably robust power in predicting global commodity prices, both in-sample and out-of-sample\"; the reverse is \"notably less robust\". No trading Sharpe ratio reported."),
        ],
        "post_publication_evidence": "Ferraro, Rogoff and Rossi (2015) find the oil and Canadian dollar link is mostly same-day and absent at monthly and quarterly frequency, consistent with this entry's direction.",
        "implementations": [],
        "relevance": {"score": 3, "reason": "Turns our failed oil-to-currency idea around in the direction the evidence supports; testable from 2008Q2, outside the paper's sample."},
        "testable_with_free_data": True, "last_reviewed": "2026-10-21", "research": research(),
    },
]

for e in entries:
    path = root / "catalog" / "algorithms" / f"{e['slug']}.json"
    path.write_text(json.dumps(e, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote", path.name)
