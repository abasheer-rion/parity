"""Catalog entries ALG-0096 to ALG-0098 from RES-0015, and updates to ALG-0009, ALG-0044, ALG-0054.
Usage: new_catalog3.py REPO_ROOT"""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
NOTE = "Added from RES-0015 on 2026-10-22."
GHR = "https://www.sba.hub.hit-u.ac.jp/assets/files/research/fs_wp/FS-2012-E-002.pdf"
LRV = "https://www.nber.org/system/files/working_papers/w16427/revisions/w16427.rev1.pdf"
FFM = "https://openaccess.city.ac.uk/id/eprint/22246/1/JBF_Integration%20for%20CRO.pdf"
VME = "https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf"
NGD = "https://centaur.reading.ac.uk/90003/1/NG_paper_final_round.pdf"
FIX = "https://ecb.eu/events/pdf/conferences/131216/Third_FX_Workshop_MELVIN_PRINS_Equity%20hedging%20and%20exchange%20rates%20Nov%202013.pdf"
MAN = "https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf"


def rr(source, url, period, market, sharpe, ret=None, notes="", costs=None):
    return {"source": source, "source_url": url, "period": period, "market": market,
            "sharpe": sharpe, "annual_return": ret, "volatility": None, "max_drawdown": None,
            "evidence_type": "backtest", "costs_included": costs, "verified_on_page": True,
            "notes": notes}


def entry(id_, slug, name, family, markets, horizon, tags, origin, simple, analogy, precise,
          rule, data, rationale, fail, results, post, score, reason, free):
    return {"id": id_, "slug": slug, "name": name, "family": family, "markets": markets,
            "horizon": horizon, "tags": tags, "origin": origin,
            "how_it_works": {"simple": simple, "analogy": analogy, "precise": precise},
            "rule": rule, "data_needed": data, "economic_rationale": rationale,
            "why_it_might_fail": fail, "reported_results": results,
            "post_publication_evidence": post, "implementations": [],
            "relevance": {"score": score, "reason": reason},
            "testable_with_free_data": free, "last_reviewed": "2026-10-22",
            "research": {"stage": 2, "hypothesis": None, "strategy": None, "registrations": [],
                         "runs": [], "verdict": None, "notes": NOTE}}


entries = [
    entry("ALG-0096", "commodity-inventory-level", "Commodity inventory level", "macro-fundamental",
          ["commodities"], "monthly", ["inventories", "futures", "fundamentals"],
          {"type": "academic", "first_published": 2007,
           "authors": "Gorton, Hayashi, Rouwenhorst",
           "source_title": "The Fundamentals of Commodity Futures Returns (Review of Finance 17(1), 35-105, 2013)",
           "source_url": "https://www.nber.org/papers/w13249"},
          "Buy the energy futures whose stockpiles are low compared with normal, and sell those whose stockpiles are high.",
          "Like umbrellas in a shop: when the shelves are nearly empty, sellers can charge more and buyers pay up to be sure of getting one.",
          "Sort commodities each month on inventory relative to a slow-moving normal level (the paper uses a Hodrick-Prescott trend). The low-inventory half beat the high-inventory half; the long-short t-statistic is 2.78, 31 commodities, January 1971 to December 2010. Low-inventory commodities also had a basis 7.39 percentage points higher and prior 12-month futures returns 7.6 points higher, so the signal overlaps with carry and momentum.",
          "Monthly, per energy contract: inventory = latest EIA weekly stocks published before month end (crude, gasoline, distillate for heating oil, working gas for natural gas) divided by the average for the same calendar week over the previous five years. Long the rolled future when the ratio is below 1, short when above, inverse volatility weights. Use each weekly figure only from its release date (Wednesday for petroleum, Thursday for gas).",
          ["EIA weekly petroleum stocks (WCESTUS1 from 1982, WGTSTUS1 from 1990, WDISTUS1 from 1982)",
           "EIA weekly working gas in storage (Lower 48 series from 2010; older series not checked)",
           "Daily NYMEX contract 1 and 2 prices (EIA, to April 2024)"],
          "The theory of storage: low inventories raise the risk of a shortage, so the futures price must offer a higher expected return to whoever carries the risk.",
          "Overlaps with carry and momentum, so it adds little to a book that holds both. US stocks are only part of world inventories, and gasoline and gas stocks are strongly seasonal, so the normal level must be measured by calendar week.",
          [rr("Gorton, Hayashi and Rouwenhorst (2012 working paper version), Table 5 Panel A", GHR,
              "1971-01 to 2010-12", "31 commodity futures", None,
              notes="Long-short (high minus low inventory) t-statistic -2.78; the low-inventory portfolio beat the equal-weight index in 56% of months. Sharpe ratio not reported in the text we read.")],
          "We found no test after 2010.",
          3, "Free weekly data from 1982 and a clear theory, but it overlaps with carry and momentum; useful as a check on them more than as a new ingredient.",
          True),
    entry("ALG-0097", "fx-developed-rate-gap-times-em-basket",
          "Developed-market rate gap times the EM currency basket", "carry",
          ["fx"], "monthly", ["emerging-markets", "carry", "dollar", "timing"],
          {"type": "academic", "first_published": 2010,
           "authors": "Lustig, Roussanov, Verdelhan",
           "source_title": "Countercyclical Currency Risk Premia (Journal of Financial Economics 111(3), 527-553, 2014)",
           "source_url": "https://www.nber.org/papers/w16427"},
          "Own a basket of emerging market currencies against the dollar when rich-country interest rates are well above US rates, and less of it, or none, when they are not.",
          "Like checking whether the whole neighbourhood pays more rent than you before deciding to move: the average across rich countries says more about the dollar than any one country does.",
          "The average forward discount (average interest rate gap over the US) of developed currencies forecasts the excess return of an equal-weight basket of emerging market currencies: about 180 basis points a year more for each 100 basis point rise. The emerging basket's own average gap does not forecast its returns this way: its slope is small and indistinguishable from zero. Sample November 1983 to June 2010.",
          "Monthly: AFD = average of (rate.<G10> - rate.USD) over the nine G10 currencies. Hold the equal-weight basket of EM_RATED currencies against USD with weight AFD / (its 5-year average absolute value), capped at 1 and floored at 0 for a long-only version, or -1 for a long-short version.",
          ["G10 and US short-term interest rates (FRED, OECD)", "EM spot rates (Fed H.10, ECB)"],
          "The developed-market gap measures the price of US-specific risk, which is highest in US recessions; emerging currencies are exposed to the same dollar risk.",
          "A regression slope is not a trading result; the effect may be smaller after costs. The G10 rates are monthly averages, which must be used only after the month ends.",
          [rr("Lustig, Roussanov and Verdelhan (NBER w16427 revision), introduction and Table III", LRV,
              "1983-11 to 2010-06", "Basket of emerging market currencies against USD", None,
              notes="Slope of about 180 basis points of excess return per 100 basis points of developed-market average forward discount. A regression, not a strategy.")],
          "Untested after 2010.",
          4, "Uses only data we already have, is a timing rule for the EM basket we registered, and comes from a different signal than the basket itself.",
          True),
    entry("ALG-0098", "equal-weight-style-combination", "Equal-weight combination of styles",
          "portfolio-construction", ["fx", "commodities"], "monthly",
          ["combination", "diversification", "carry", "momentum", "value"],
          {"type": "academic", "first_published": 2013,
           "authors": "Asness, Moskowitz, Pedersen; Fernandez-Perez, Fuertes, Miffre",
           "source_title": "Value and Momentum Everywhere (Journal of Finance 68(3), 2013); their appraisal of style-integration methods (Journal of Banking and Finance 105, 134-150, 2019)",
           "source_url": "https://doi.org/10.1016/j.jbankfin.2019.05.016"},
          "Run several weak trading signals at once, each with the same weight, instead of picking the one that looked best.",
          "Like a panel of judges: each one is often wrong, but they are wrong about different things, so the average verdict is better than any single judge.",
          "Standardise each signal across assets every month and average the scores with equal weights, then hold assets in proportion to the average. In commodity futures 1989 to 2017, five signals with Sharpe ratios 0.16 to 0.59 combined to 0.97; six methods that chose weights from past data did no better (mean-variance: 0.74). In AQR's data, currency value and momentum (0.34 each, correlation -0.42) mixed 50/50 to 0.63, and commodity value and momentum (0.26 and 0.53) to 0.71.",
          "Monthly, per book: z-score each ingredient signal across the book's assets, average with weights 1/K over the K ingredients chosen in advance, scale the book to a fixed volatility. No weight is estimated from our data.",
          ["The ingredient signals' own data"],
          "Ideas that win at different times average out each other's bad years. Equal weights avoid estimation error, which is large when Sharpe ratios are small.",
          "Only helps if the ingredients are not highly correlated and each still has some return after publication and costs. It also adds choices (which ingredients), each a hidden trial unless fixed in advance.",
          [rr("Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel D", FFM,
              "1989-07 to 2017-12", "Commodity futures, 5 signals", 0.97,
              notes="Single signals: momentum 0.59, value 0.27, carry 0.35, liquidity 0.16, skewness 0.45. Optimised (mean-variance) 0.74; best alternative 0.85."),
           rr("Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel C", FFM,
              "1989-08 to 2017-12", "Currency futures, 5 signals", 0.40,
              notes="Single signals: momentum 0.11, value 0.67, carry 0.41, liquidity 0.29, skewness -0.04. Volatility timing 0.45, not significantly better (p = 0.27)."),
           rr("Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1", VME,
              "1979-01 to 2011-07", "Currencies", 0.63,
              notes="Value 0.34, momentum 0.34, correlation -0.42."),
           rr("Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1", VME,
              "1972-01 to 2011-07", "Commodities", 0.71,
              notes="Value 0.26, momentum 0.53, correlation -0.39.")],
          "Fernandez-Perez et al. find equal weights unsurpassed in sub-periods and across asset classes; AQR's century study reports a commodity multi-style Sharpe of 0.77 after publication (RES-0014).",
          5, "The method behind both combined books proposed in RES-0015; no data of its own needed.",
          True),
]

for e in entries:
    path = root / "catalog" / "algorithms" / f"{e['slug']}.json"
    assert not path.exists(), path
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(e, indent=2, ensure_ascii=False) + "\n")
    print("wrote", path.name)


def update(slug, results=(), post=None, note=None):
    p = root / "catalog" / "algorithms" / f"{slug}.json"
    e = json.loads(p.read_text(encoding="utf-8"))
    e["reported_results"].extend(results)
    if post:
        e["post_publication_evidence"] = ((e.get("post_publication_evidence") or "").rstrip() + " " + post).strip()
    if note:
        e["research"]["notes"] = ((e["research"].get("notes") or "").rstrip() + " " + note).strip()
    e["last_reviewed"] = "2026-10-22"
    with open(p, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(e, indent=2, ensure_ascii=False) + "\n")
    print("updated", p.name)


update("natural-gas-storage-report",
       [rr("Prokopczuk, Wese Simen and Wichmann (2021), accepted version, Table 8", NGD,
           "2003-03 to 2018-12", "Henry Hub natural gas futures, front contract", 1.76, ret=0.1201, costs=True,
           notes="Short from 90 minutes before to 30 minutes after each EIA storage report, after bid-ask and funding costs. Settlement-price version 17.86% a year, Sharpe 2.57. Early sub-period 25% a year, Sharpe 3.26; recent sub-period about 3% and Sharpe 0.5, not enough to cover costs.")],
       post="Prokopczuk et al. (2021) find the announcement-day effect absent in 2014 to 2018 and conclude the anomaly has been arbitraged away.",
       note="RES-0015: decayed, and the paper's version needs intraday prices.")
update("fx-london-4pm-fix",
       [rr("Melvin and Prins (2015), ECB workshop version (BlackRock authors)", FIX,
           "About 2004 to 2012-12 (8.66 years)", "G10 currencies, 15:00 to 16:00 London on the last day of the month", None,
           notes="Equity returns over the month predict currency depreciation before the month-end fix; the authors call the effect statistically significant but small, a few basis points. They cite Rizeanu and Zhang (2013), who find no such link for 23 emerging market currencies.")],
       note="RES-0015: not useful for emerging markets, and needs intraday prices.")
update("volatility-managed-portfolios",
       [rr("Harvey, Hoyle, Korgaonkar, Rattray, Sargaison and Van Hemert (2018), Man Group", MAN,
           "From as early as 1926 to 2017", "More than 60 assets", None,
           notes="Volatility targeting raises Sharpe ratios for equities and credit, has a negligible effect for bonds, currencies and commodities, and reduces extreme returns in all asset classes.")],
       note="RES-0015: use as a risk control for combined FX and energy books, not as a source of return.")
