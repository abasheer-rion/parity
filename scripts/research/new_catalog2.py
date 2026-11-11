"""Catalog entries ALG-0088 to ALG-0095 from RES-0014, and an update to ALG-0016.
Usage: new_catalog2.py REPO_ROOT"""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
NOTE = "Added from RES-0014 on 2026-10-22."


def rr(source, url, period, market, sharpe, ret=None, vol=None, notes="", costs=None, checked=True):
    return {"source": source, "source_url": url, "period": period, "market": market,
            "sharpe": sharpe, "annual_return": ret, "volatility": vol, "max_drawdown": None,
            "evidence_type": "backtest", "costs_included": costs, "verified_on_page": checked,
            "notes": notes}


def research(stage=2):
    return {"stage": stage, "hypothesis": None, "strategy": None, "registrations": [],
            "runs": [], "verdict": None, "notes": NOTE}


def entry(id_, slug, name, family, markets, horizon, tags, origin, simple, analogy, precise,
          rule, data, rationale, fail, results, post, score, reason, free, stage=2):
    return {"id": id_, "slug": slug, "name": name, "family": family, "markets": markets,
            "horizon": horizon, "tags": tags, "origin": origin,
            "how_it_works": {"simple": simple, "analogy": analogy, "precise": precise},
            "rule": rule, "data_needed": data, "economic_rationale": rationale,
            "why_it_might_fail": fail, "reported_results": results,
            "post_publication_evidence": post, "implementations": [],
            "relevance": {"score": score, "reason": reason},
            "testable_with_free_data": free, "last_reviewed": "2026-10-22",
            "research": research(stage)}


BOONS = "https://4nations.albertjmenkveld.com/papers/boonsprado17.pdf"
ILMANEN = "https://www.aqr.com/-/media/AQR/Documents/Journal-Articles/JOIM_How-Do-Factor-Premia-Vary-Over-Time.pdf"

entries = [
    entry("ALG-0088", "commodity-basis-momentum", "Commodity basis-momentum", "momentum-trend",
          ["commodities"], "monthly", ["term-structure", "momentum", "futures", "spread"],
          {"type": "academic", "first_published": 2019, "authors": "Boons, Prado",
           "source_title": "Basis-Momentum (Journal of Finance 74(1), 239-279)",
           "source_url": "https://doi.org/10.1111/jofi.12738"},
          "Compare how much the nearest oil or gas contract has gained over the past year with the next contract out. If the near one has gained more, buy; if less, sell.",
          "Like noticing that this week's concert tickets are selling faster than next month's: the pressure is at the front, and it tends to keep pushing.",
          "Basis-momentum is the 12-month cumulative return of a first-nearby futures position minus that of a second-nearby position. Sorting 21 commodities on it (top four minus bottom four) earned 18.38% a year, Sharpe 0.92, over 1960-08 to 2014-02; the calendar-spread version (nearby minus second-nearby returns) earned 4.08% a year, Sharpe 0.88, and 1.06 after 1986.",
          "Monthly, per energy contract: BM = prod(1 + r_C1 over 12 months) - prod(1 + r_C2 over 12 months). Time-series version: long the rolled future if BM > 0, short if BM < 0, inverse volatility weights. Spread version: long contract 1 and short contract 2 when BM > 0, the reverse when BM < 0.",
          ["Daily NYMEX contract 1 and 2 prices (EIA, to April 2024)"],
          "Maturity-specific price pressure that builds when rising volatility limits speculators' capacity to take the other side of hedgers; distinct from storage, inventories and hedging pressure according to the authors.",
          "Our version has four correlated energy contracts, not 21; the per-commodity time-series and spread versions are our adaptation; spread returns are small, so costs bite.",
          [rr("Boons and Prado (2019), working paper, Table 1 Panel A, High4-minus-Low4 nearby returns", BOONS,
              "1960-08 to 2014-02", "21 commodity futures", 0.92, ret=0.1838, costs=False,
              notes="Sample from 1986-02 to 2014-02: 16.77% a year, Sharpe 0.80. Basis alone -10.61% (Sharpe -0.53), momentum alone 15.02% (Sharpe 0.63) over the full sample."),
           rr("Boons and Prado (2019), working paper, Table 1 Panel B, High4-minus-Low4 spreading returns", BOONS,
              "1986-02 to 2014-02", "21 commodity futures, nearby minus second-nearby", 1.06, ret=0.0517, costs=False,
              notes="Full sample 1960-08 to 2014-02: 4.08% a year, Sharpe 0.88.")],
          "Kwon, Kang and Yun (2021, Finance Research Letters) split the ranking period and find its parts behave differently; we found no test on data after February 2014.",
          4, "Strongest commodity signal we found, and our EIA data from 2014-03 to 2024-04 lies entirely after the paper's sample.", True),
    entry("ALG-0089", "commodity-value-reversal", "Commodity value (5-year price reversal)", "value-mean-reversion",
          ["commodities"], "monthly", ["value", "reversal", "futures"],
          {"type": "academic", "first_published": 2013, "authors": "Asness, Moskowitz, Pedersen",
           "source_title": "Value and Momentum Everywhere (Journal of Finance 68(3), 2013)",
           "source_url": "https://doi.org/10.1111/jofi.12021"},
          "Buy the commodities whose prices have fallen most over the past five years and sell those that rose most, betting that extremes partly undo themselves.",
          "Like buying winter coats in summer: what is out of favour for long enough tends to come back.",
          "Value signal: minus the log change in spot price over five years (average price 4.5 to 5.5 years ago over today). AQR's century study reports a Sharpe ratio of 0.38 for commodity value over 1926 to 2020, 0.50 in the original sample and 0.44 after publication.",
          "Monthly: rank energy contracts by -ln(P_t / average price 54 to 66 months ago); long the cheapest, short the dearest, inverse volatility weights.",
          ["Daily NYMEX contract 1 and 2 prices (EIA)"],
          "Supply responds slowly to prices: high prices bring new supply and low prices close mines and wells, so extremes partly revert over several years.",
          "Four energy contracts give a thin cross-section; the signal needs five years of history; commodity value has long dry spells.",
          [rr("Ilmanen, Israel, Lee, Moskowitz and Thapar (2021), JOIM, Table 1", ILMANEN, "1926-07 to 2020-11",
              "Commodity futures", 0.38, ret=0.077, vol=0.20, costs=False,
              notes="Table 2: Sharpe 0.22 before, 0.50 during and 0.44 after the original sample. AQR's own backtest.")],
          "AQR's post-publication Sharpe ratio of 0.44 (Ilmanen et al., 2021).",
          3, "Supported after publication; most useful as part of a combined carry, value and momentum commodity strategy.", True),
    entry("ALG-0090", "commodity-skewness", "Commodity skewness factor", "volatility",
          ["commodities"], "monthly", ["skewness", "lottery-preference", "cross-sectional"],
          {"type": "academic", "first_published": 2018, "authors": "Fernandez-Perez, Frijns, Fuertes, Miffre",
           "source_title": "The skewness of commodity futures returns (Journal of Banking and Finance 86, 143-158)",
           "source_url": "https://openaccess.city.ac.uk/id/eprint/17843/"},
          "Buy the commodities whose past year had more sudden drops than jumps, and sell those with more sudden jumps, because people overpay for lottery-like jumps.",
          "Like selling lottery tickets: buyers pay extra for the small chance of a big win.",
          "Each month, compute the skewness of the past 12 months of daily returns per commodity; long the fifth with the most negative skew, short the fifth with the most positive. 27 commodities, 1987 to 2014: 8.01% a year, Sharpe 0.78, alpha 6.21% after standard commodity factors.",
          "Monthly: skewness of 252 daily returns; long the lowest-skew fifth, short the highest-skew fifth, equal weights.",
          ["Daily futures returns for 20 or more commodities"],
          "Investors with a taste for positive skew (cumulative prospect theory) overpay for right-skewed commodities; selective hedging adds to it.",
          "Needs a broad cross-section we do not have for free; skewness estimates are noisy.",
          [rr("Fernandez-Perez, Frijns, Fuertes and Miffre (2018), accepted manuscript, Table IV",
              "https://openaccess.city.ac.uk/id/eprint/17843/1/SSRN-id2671165_July2017.pdf", "1987-01 to 2014-11",
              "27 commodity futures", 0.78, ret=0.0801, costs=False,
              notes="Quote: \"a mean excess return of 8.01% a year (Newey-West t-statistic of 3.83), a Sharpe ratio of 0.7848\".")],
          "None found by us.", 2, "Good record, but not testable with four energy contracts.", False),
    entry("ALG-0091", "commodity-hedging-pressure", "Commodity hedging pressure (CFTC positions)", "macro-fundamental",
          ["commodities"], "monthly", ["positioning", "cftc", "hedging-pressure"],
          {"type": "academic", "first_published": 2013, "authors": "Basu, Miffre",
           "source_title": "Capturing the risk premium of commodity futures: the role of hedging pressure (Journal of Banking and Finance 37(7), 2013)",
           "source_url": "https://climateinstitute.edhec.edu/publications/capturing-risk-premium-commodity-futures-role-hedging-pressure"},
          "Use the weekly government report of who holds commodity futures. Buy where producers are hedging heavily (they pay others to take the risk), sell where consumers are.",
          "Like an insurer charging more when many people want cover at once.",
          "Hedging pressure = hedgers' net short positions over their total positions (CFTC Commitments of Traders). Long the commodities with the most net-short hedgers, short those with the most net-long; single and double sorts with speculators' positions.",
          "Monthly: from CFTC legacy reports, hedging pressure = (commercial short - commercial long) / (commercial short + long), averaged over 52 weeks; long top third, short bottom third.",
          ["CFTC Commitments of Traders, weekly, free", "Futures returns"],
          "Keynesian normal backwardation: hedgers pay a premium to speculators who take the other side.",
          "Gorton, Hayashi and Rouwenhorst (2013) reject hedging pressure as a determinant of premia; results vary across studies; the reported Sharpe ratio is gross.",
          [rr("Miffre's literature review, as summarised by CXO Advisory", "https://www.cxoadvisory.com/?p=27949",
              "1992 to 2011", "Commodity futures", 0.51, costs=False, checked=False,
              notes="Average gross Sharpe ratio of hedging-pressure portfolios in the review; we did not read the review itself.")],
          "Mixed.", 2, "Free data, but mixed evidence; low priority.", True),
    entry("ALG-0092", "commodity-open-interest-growth", "Commodity open interest growth", "macro-fundamental",
          ["commodities"], "monthly", ["open-interest", "cftc", "market-timing"],
          {"type": "academic", "first_published": 2012, "authors": "Hong, Yogo",
           "source_title": "What does futures market interest tell us about the macroeconomy and asset prices? (Journal of Financial Economics 105(3), 2012)",
           "source_url": "https://www.nber.org/papers/w16712"},
          "When the number of open commodity futures contracts grows fast, commodity prices tend to rise over the following months.",
          "Like a busy car park outside a shop: more people turning up is a sign of demand before it shows in the price.",
          "Aggregate 12-month growth in commodity futures open interest predicts commodity returns, bond returns and the short rate, beyond other known predictors; open interest is pro-cyclical.",
          "Monthly: 12-month growth in total open interest across energy contracts; long energy futures when growth is above its 5-year median, otherwise flat.",
          ["Open interest by contract (CFTC Commitments of Traders, free)", "Futures returns"],
          "With hedging demand and limited risk-bearing capacity, quantities (open interest) carry information that prices do not.",
          "A timing signal on one asset class gives few independent bets; the magnitude comes from a secondary summary.",
          [rr("Hong and Yogo (2012), as summarised by CXO Advisory", "https://www.cxoadvisory.com/commodity-futures/futures-market-open-interest-as-return-predictor",
              "To 2008", "30 commodity futures", None, costs=False, checked=False,
              notes="A one standard deviation increase in 12-month open interest growth raises expected monthly commodity returns by about 0.63% (summary figure, not checked in the paper's tables).")],
          "None found by us.", 2, "Free data and a plausible story, but weak as a stand-alone strategy.", True),
    entry("ALG-0093", "commodity-same-month-seasonality", "Commodity same-calendar-month seasonality", "seasonality-calendar",
          ["commodities"], "monthly", ["seasonality", "calendar"],
          {"type": "academic", "first_published": 2016, "authors": "Keloharju, Linnainmaa, Nyberg",
           "source_title": "Return Seasonalities (Journal of Finance 71(4), 1557-1590)",
           "source_url": "https://www.nber.org/papers/w20815"},
          "Buy the commodities that have historically done best in the coming calendar month and sell those that have done worst.",
          "Like knowing that ice cream sells better in July every year.",
          "Rank commodities on their average return in the same calendar month over past years (at least five); long the top, short the bottom. Commodities, 1970 to 2011: 0.93% a month, t-statistic 1.93; choosing on other months' returns earns -0.22%.",
          "Monthly: for each energy contract, average return in the same calendar month over the past 5 to 20 years; long the highest, short the lowest.",
          ["Futures returns with at least five years of history"],
          "Recurring seasonal demand and supply (heating, driving, harvests) and seasonal risk.",
          "The commodity result is only marginally significant; energy seasonality is well known to physical traders.",
          [rr("Keloharju, Linnainmaa and Nyberg (2016), NBER w20815, Table 8 Panel C", "https://www.nber.org/papers/w20815.pdf",
              "1970-01 to 2011-07", "24 commodity futures", None, costs=False,
              notes="Long-short on same-calendar-month returns: 0.93% a month (t = 1.93).")],
          "None found by us.", 2, "Weak statistics; low priority.", True),
    entry("ALG-0094", "commodity-index-roll-front-running", "Front-running commodity index rolls (the Goldman roll)", "event-news",
          ["commodities"], "monthly", ["index-flows", "roll", "front-running"],
          {"type": "academic", "first_published": 2010, "authors": "Mou",
           "source_title": "Limits to Arbitrage and Commodity Index Investment: Front-Running the Goldman Roll (SSRN 1716841)",
           "source_url": "https://papers.ssrn.com/abstract=1716841"},
          "Big commodity index funds sell the expiring contract and buy the next one on known days each month. Trade ahead of them.",
          "Like buying concert tickets the day before a big group is known to buy them all.",
          "The S&P GSCI rolls from the 5th to 9th business day each month. Mou reports strategies front-running it earned Sharpe ratios up to 4.39 over 2000 to March 2010. Dubois and Marechal find positive price pressure before 2004, reversed from 2004 to 2010, and no abnormal profit after transaction costs.",
          "Before the 5th business day: short the nearby, long the first deferred contract; close after the 9th.",
          ["Daily futures prices for index commodities"],
          "Predictable, price-insensitive index flows push calendar spreads.",
          "Widely known since about 2010; reversed after index money grew; small and costly to trade.",
          [rr("Mou (2010), abstract via search summaries", "https://papers.ssrn.com/abstract=1716841", "2000-01 to 2010-03",
              "S&P GSCI commodities", 4.39, costs=None, checked=False,
              notes="We could not open the paper (SSRN and Columbia blocked our reader)."),
           rr("Dubois and Marechal, poster", "https://business.ucdenver.edu/jpmorgancenter/content/poster-loic-marechal",
              "1999 to 2010", "S&P GSCI commodities", None, costs=True,
              notes="Roll-period abnormal price changes of 115 bp (nearby) before 2004 and -60 bp from 2004 to 2010; \"A strategy that front-runs the roll does not generate abnormal profits after transaction costs.\"")],
          "Dubois and Marechal: the effect reversed after 2004 and is not profitable after costs.",
          1, "A famous 'hidden' edge that disappeared once known; kept as a cautionary example.", True),
    entry("ALG-0095", "fx-sovereign-credit-risk", "Currencies sorted on sovereign credit risk", "macro-fundamental",
          ["fx"], "monthly", ["sovereign-risk", "cds", "emerging-markets"],
          {"type": "academic", "first_published": 2013, "authors": "Della Corte, Sarno, Schmeling, Wagner",
           "source_title": "Exchange Rates and Sovereign Risk (working paper; published in Management Science 2022)",
           "source_url": "https://openaccess.city.ac.uk/id/eprint/16863/"},
          "Use the price of insurance against a country defaulting to choose currencies: riskier countries pay more interest but their currencies tend to fall.",
          "Like a lender charging a riskier borrower more: the extra interest may or may not cover the chance of losing out.",
          "Della Corte et al.: buying high and selling low sovereign-risk currencies (by exposure to global CDS spreads) earns 6.25% a year, Sharpe 0.71, 2003 to 2013, with forward returns including carry. Calice and Lin: currencies of countries with the highest past CDS spreads have the lowest future spot returns; low-minus-high spread up to 9.4% a year in spot terms, 2007 to 2021.",
          "Monthly: rank currencies by 5-year sovereign CDS spread; the sign of the trade depends on whether carry is included (see the two papers).",
          ["Sovereign CDS spreads (Markit, paid)", "Spot and forward rates"],
          "Sovereign risk is a priced global risk in currencies and accounts for a large share of carry returns.",
          "Data is paid; the two papers point in opposite directions once interest is included, so the signal mostly re-labels carry.",
          [rr("Della Corte, Sarno, Schmeling and Wagner (2013), working paper, Table 6",
              "https://openaccess.city.ac.uk/id/eprint/16863/1/Exchange%20Rates%20and%20Sovereign%20Risk.pdf",
              "2003-01 to 2013-11", "Developed and EM currencies", 0.71, ret=0.0625, costs=None,
              notes="Quote: \"Investors earn 6.25% p.a. for buying high and selling low sovereign risk currencies and the corresponding Sharpe ratio is 0.71.\""),
           rr("Calice and Lin (2022), EFMA paper, Table 2",
              "https://www.efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2022-Rome/papers/EFMA%202022_stage-3032_question-Full%20Paper_id-99.pdf",
              "2007-01 to 2021-03", "About 30 currencies", None, ret=0.094, costs=False,
              notes="Spot returns only; low-minus-high CDS portfolio spread between 3.6% and 5% a year for one-month holding, up to 9.4% in the abstract.")],
          "Calice and Lin (2022) confirm the spot effect over 2007 to 2021.",
          2, "Interesting for EM, but needs paid data.", False),
]

for e in entries:
    path = root / "catalog" / "algorithms" / f"{e['slug']}.json"
    assert not path.exists(), path
    path.write_text(json.dumps(e, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n") \
        if False else open(path, "w", encoding="utf-8", newline="\n").write(
            json.dumps(e, indent=2, ensure_ascii=False) + "\n")
    print("wrote", path.name)

p = root / "catalog" / "algorithms" / "fx-value-adjusted.json"
e = json.loads(p.read_text(encoding="utf-8"))
e["post_publication_evidence"] = (e.get("post_publication_evidence") or "").rstrip() + (
    " AQR's century study (Ilmanen et al., 2021) reports a currency value Sharpe ratio of 0.69 after "
    "publication against 0.72 in the original sample, the best post-publication record of any "
    "currency style it tests (carry: -0.17). The BIS publishes free monthly real effective exchange "
    "rates for emerging markets, so a simplified EM version is testable (RES-0014).")
e["research"]["notes"] = (e["research"].get("notes") or "") + " RES-0014 ranks an EM version second among candidates."
e["last_reviewed"] = "2026-10-22"
open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(e, indent=2, ensure_ascii=False) + "\n")
print("updated", p.name)
