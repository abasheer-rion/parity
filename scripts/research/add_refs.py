"""Append records for new sources to docs/_system/references.json without rewriting the rest.

scripts/references.py rebuilds the whole file and, run today, drops hand-made fields
(verification, notes) from hundreds of records. This helper only adds what is missing.

Usage: add_refs.py REPO_ROOT FILE [FILE ...]   (files are docs or catalog JSON to scan)
"""
import datetime as dt
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(root / "scripts"))
import references as refs  # noqa: E402

OUT = root / "docs" / "_system" / "references.json"
TODAY = dt.date.today().isoformat()

# Papers we read in full for RES-0011 and RES-0012, with the metadata a reader needs.
PAPERS = {
    "https://www.nber.org/papers/w12916": dict(
        key="burnside2007", type="preprint", year=2007,
        authors=["Burnside, Craig", "Eichenbaum, Martin", "Rebelo, Sergio"],
        title="The Returns to Currency Speculation in Emerging Markets",
        venue="NBER Working Paper 12916", note="Read for RES-0011 (full text)",
        also_at=["https://www.nber.org/system/files/working_papers/w12916/w12916.pdf"]),
    "https://www.nber.org/papers/w14528": dict(
        key="gilmore2008", type="preprint", year=2008,
        authors=["Gilmore, Stephen", "Hayashi, Fumio"],
        title="Emerging Market Currency Excess Returns",
        venue="NBER Working Paper 14528; published in AEJ: Macroeconomics 3(4), 85-111 (2011)",
        note="Read for RES-0011 (full text)",
        also_at=["https://www.nber.org/system/files/working_papers/w14528/w14528.pdf"]),
    "https://www.nber.org/papers/w12496": dict(
        key="frankel2006", type="preprint", year=2006,
        authors=["Frankel, Jeffrey", "Poonawala, Jumana"],
        title="The Forward Market in Emerging Currencies: Less Biased Than in Major Currencies",
        venue="NBER Working Paper 12496; published in Journal of International Money and Finance 29(3) (2010)",
        note="Read for RES-0011 (full text)"),
    "https://www.nber.org/papers/w22793": dict(
        key="levine2016", type="preprint", year=2016,
        authors=["Levine, Ari", "Ooi, Yao Hua", "Richardson, Matthew", "Sasseville, Caroline"],
        title="Commodities for the Long Run",
        venue="NBER Working Paper 22793; published in Financial Analysts Journal 74(2), 55-68 (2018)",
        note="Read for RES-0012 (full text)"),
    "https://infoscience.epfl.ch/record/148475": dict(
        key="trolle2010", type="paper", year=2010,
        authors=["Trolle, Anders B.", "Schwartz, Eduardo S."],
        title="Variance Risk Premia in Energy Commodities", venue="Journal of Derivatives",
        note="Read for RES-0012 (full text, November 2009 working version)",
        also_at=["https://infosciences.epfl.ch/record/148475/files/TrolleSchwartz_Energy_Variance_Risk_Premia.pdf"]),
    "https://ueaeprints.uea.ac.uk/63547/": dict(
        key="prokopczuk2017", type="paper", year=2017,
        authors=["Prokopczuk, Marcel", "Symeonidis, Lazaros", "Wese Simen, Chardin"],
        title="Variance Risk in Commodity Markets", venue="Journal of Banking and Finance 81, 136-149",
        note="Read for RES-0012 (full text, accepted manuscript)",
        also_at=["https://ueaeprints.uea.ac.uk/63547/1/Variance_risk_in_Commodity_Markets.pdf"]),
    "https://swh.princeton.edu/~ceps/workingpapers/104malkiel.pdf": dict(
        key="malkiel2004", type="preprint", year=2004,
        authors=["Malkiel, Burton G.", "Saha, Atanu"],
        title="Hedge Funds: Risk and Return", venue="Princeton CEPS Working Paper 104",
        note="Read for RES-0013 (full text)"),
    "https://repub.eur.nl/pub/16035": dict(
        key="dezwart2009", type="paper", year=2009,
        authors=["de Zwart, Gerben", "Markwat, Thijs", "Swinkels, Laurens", "van Dijk, Dick"],
        title="The economic value of fundamental and technical information in emerging currency markets",
        venue="Journal of International Money and Finance 28(4), 581-604",
        note="Abstract only, for RES-0011"),
    "https://www.aqr.com/-/media/AQR/Documents/Journal-Articles/JOIM_How-Do-Factor-Premia-Vary-Over-Time.pdf": dict(
        key="ilmanen2021", type="paper", year=2021,
        authors=["Ilmanen, Antti", "Israel, Ronen", "Lee, Rachel", "Moskowitz, Tobias J.", "Thapar, Ashwin"],
        title="How Do Factor Premia Vary Over Time? A Century of Evidence",
        venue="Journal of Investment Management 19(4)", note="Read for RES-0014 (full text)"),
    "https://4nations.albertjmenkveld.com/papers/boonsprado17.pdf": dict(
        key="boons2019", type="paper", year=2019, authors=["Boons, Martijn", "Prado, Melissa Porras"],
        title="Basis-Momentum", venue="Journal of Finance 74(1), 239-279",
        note="Read for RES-0014 (full text, working paper version)"),
    "https://openaccess.city.ac.uk/id/eprint/17843/1/SSRN-id2671165_July2017.pdf": dict(
        key="fernandezperez2018", type="paper", year=2018,
        authors=["Fernandez-Perez, Adrian", "Frijns, Bart", "Fuertes, Ana-Maria", "Miffre, Joelle"],
        title="The skewness of commodity futures returns", venue="Journal of Banking and Finance 86, 143-158",
        note="Read for RES-0014 (full text, accepted manuscript)"),
    "https://business.ucdenver.edu/jpmorgancenter/content/poster-loic-marechal": dict(
        key="dubois-poster", type="web-page", year=None, authors=["Dubois, Michel", "Marechal, Loic"],
        title="The valuation effects of index investment in commodity futures (poster)", venue=None,
        note="Read for RES-0014 (poster text)"),
    "https://openaccess.city.ac.uk/id/eprint/16863/1/Exchange%20Rates%20and%20Sovereign%20Risk.pdf": dict(
        key="dellacorte2013", type="preprint", year=2013,
        authors=["Della Corte, Pasquale", "Sarno, Lucio", "Schmeling, Maik", "Wagner, Christian"],
        title="Exchange Rates and Sovereign Risk", venue="Working paper", note="Read for RES-0014 (full text)"),
    "https://www.efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2022-Rome/papers/EFMA%202022_stage-3032_question-Full%20Paper_id-99.pdf": dict(
        key="calice2022", type="preprint", year=2022, authors=["Calice, Giovanni", "Lin, Ming-Tsung"],
        title="Sovereign Momentum Currency Returns", venue="EFMA 2022 conference paper",
        note="Read for RES-0014 (full text)"),
    "https://www.twosigma.com/wp-content/uploads/SV_10_17.pdf": dict(
        key="twosigma2017", type="web-page", year=2017, authors=["Manzo, Gerardo", "Saret, Jeffrey N."],
        title="The Commodity Futures Roll Return 'Tax': Addressing a Recent Headwind (Two Sigma Street View)",
        venue=None, note="Read for RES-0014 (full text)"),
    "https://openaccess.city.ac.uk/id/eprint/22246/1/JBF_Integration%20for%20CRO.pdf": dict(
        key="fernandezperez2019", type="paper", year=2019,
        authors=["Fernandez-Perez, Adrian", "Fuertes, Ana-Maria", "Miffre, Joelle"],
        title="A Comprehensive Appraisal of Style-Integration Methods",
        venue="Journal of Banking and Finance 105, 134-150", note="Read for RES-0015 (full text, accepted version)"),
    "https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf": dict(
        key="harvey2018", type="paper", year=2018,
        authors=["Harvey, Campbell R.", "Hoyle, Edward", "Korgaonkar, Russell", "Rattray, Sandy",
                 "Sargaison, Matthew", "Van Hemert, Otto"],
        title="The Impact of Volatility Targeting", venue="Journal of Portfolio Management 45(1), 14-33",
        note="Read for RES-0015 (full text); authors at Man Group"),
    "https://centaur.reading.ac.uk/90003/1/NG_paper_final_round.pdf": dict(
        key="prokopczuk2021", type="paper", year=2021,
        authors=["Prokopczuk, Marcel", "Wese Simen, Chardin", "Wichmann, Robert"],
        title="The Natural Gas Announcement Day Puzzle", venue="Energy Journal 42(2)",
        note="Read for RES-0015 (full text, accepted version)"),
    "https://www.nber.org/system/files/working_papers/w20439/w20439.pdf": dict(
        key="daniel2016", type="paper", year=2016, authors=["Daniel, Kent", "Moskowitz, Tobias J."],
        title="Momentum Crashes", venue="Journal of Financial Economics 122(2), 221-247",
        note="Read for RES-0016 (NBER working paper 20439, first 12 pages)",
        also_at=["https://www.nber.org/papers/w20439"]),
    "https://www.frbsf.org/research-and-insights/publications/economic-letter/2014/03/federal-reserve-tapering-emerging-markets/": dict(
        key="nechio2014", type="web-page", year=2014, authors=["Nechio, Fernanda"],
        title="Fed Tapering News and Emerging Markets", venue="FRBSF Economic Letter 2014-06",
        note="Read for RES-0016 (full text)"),
}


def main() -> int:
    data = json.loads(OUT.read_text(encoding="utf-8"))
    records = data["references"]
    known = {refs.normalise_url(u) for r in records for u in [r.get("url")] + r.get("also_at", []) if u}
    keys = {r["key"] for r in records}
    added = []
    for name in sys.argv[2:]:
        text = (root / name).read_text(encoding="utf-8")
        for u in refs.extract_urls(text):
            if refs.ignored(u) or refs.normalise_url(u) in known:
                continue
            meta = PAPERS.get(u)
            if meta is None:
                rec = {"key": None, "type": refs.classify(u, None, False), "authors": [],
                       "year": None, "title": None, "venue": None, "doi": None, "arxiv": None,
                       "url": u, "also_at": []}
            else:
                rec = {"key": meta["key"], "type": meta["type"], "authors": meta["authors"],
                       "year": meta["year"], "title": meta["title"], "venue": meta["venue"],
                       "doi": None, "arxiv": None, "url": u, "also_at": meta.get("also_at", [])}
            if rec["key"] is None:
                rec["key"] = refs.key_for(rec)
            while rec["key"] in keys:
                rec["key"] += "a"
            rec.update({"accessed": TODAY, "verification": "not checked", "used_in": [name.replace("\\", "/")]})
            if meta and meta.get("note"):
                rec["note"] = meta["note"]
            rec["metadata"] = {"source": "manual", "doi_explicit": False}
            records.append(rec)
            keys.add(rec["key"])
            for x in [u] + rec["also_at"]:
                known.add(refs.normalise_url(x))
            added.append((rec["key"], u))
        # Record where already-known sources are used, as references.py would.
        for r in records:
            if any(refs.normalise_url(x) in {refs.normalise_url(v) for v in refs.extract_urls(text)}
                   for x in [r.get("url")] + r.get("also_at", []) if x):
                used = r.setdefault("used_in", [])
                n = name.replace("\\", "/")
                if n not in used:
                    used.append(n)
    records.sort(key=lambda r: r["key"])
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    for k, u in added:
        print(f"{k}\t{u}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
