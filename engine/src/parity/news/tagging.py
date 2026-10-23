"""Keyword tags: which currencies, commodities, regions and kind of news an item is about.

Deliberately simple word lists, so anyone can read why an item got a tag. It misses
things and sometimes tags wrongly (a story about "Japan's oil imports" gets both JPY
and oil). The list is the place to fix that.
"""

from __future__ import annotations

import re

_NOT_OTHER_DOLLAR = r"(?<!canadian )(?<!australian )(?<!aussie )(?<!kiwi )(?<!zealand )"

CURRENCY_WORDS: dict[str, list[str]] = {
    "USD": [r"\bUSD\b", _NOT_OTHER_DOLLAR + r"\bdollar\b", r"\bfederal reserve\b", r"\bthe fed\b",
            r"\bfomc\b", r"\bpowell\b", r"\btreasur(y|ies)\b", r"\bgreenback\b"],
    "EUR": [r"\bEUR\b", r"\beuro\b", r"\beurozone\b", r"\beuro area\b", r"\becb\b", r"\blagarde\b"],
    "GBP": [r"\bGBP\b", r"\bsterling\b", r"\bpound\b", r"\bbank of england\b", r"\bboe\b"],
    "JPY": [r"\bJPY\b", r"\byen\b", r"\bbank of japan\b", r"\bboj\b"],
    "CHF": [r"\bCHF\b", r"\bswiss franc\b", r"\bfranc\b", r"\bsnb\b", r"\bswiss national bank\b"],
    "CAD": [r"\bCAD\b", r"\bcanadian dollar\b", r"\bloonie\b", r"\bbank of canada\b"],
    "AUD": [r"\bAUD\b", r"\baussie dollar\b", r"\baustralian dollar\b",
            r"\breserve bank of australia\b", r"\brba\b"],
    "NZD": [r"\bNZD\b", r"\bkiwi dollar\b", r"\bnew zealand dollar\b", r"\brbnz\b"],
    "NOK": [r"\bNOK\b", r"\bkrone\b", r"\bnorges bank\b"],
    "SEK": [r"\bSEK\b", r"\bkrona\b", r"\briksbank\b"],
}

COMMODITY_WORDS: dict[str, list[str]] = {
    "oil": [r"\boil\b", r"\bcrude\b", r"\bbrent\b", r"\bwti\b", r"\bopec\b", r"\bpetroleum\b",
            r"\bgasoline\b"],
    "gas": [r"\bnatural gas\b", r"\blng\b", r"\bhenry hub\b"],
    "gold": [r"\bgold\b", r"\bbullion\b"],
    "copper": [r"\bcopper\b"],
}

REGION_WORDS: dict[str, list[str]] = {
    "US": [r"(?-i:\bU\.?S\.?\b)", r"\bunited states\b", r"\bamerica(n)?\b", r"\bwall street\b",
           r"\bfederal reserve\b", r"\bfomc\b", r"\bs&p\b", r"\bnasdaq\b", r"(?-i:\bDow\b)"],
    "Euro area": [r"\beuro ?zone\b", r"\beuro area\b", r"\becb\b", r"\bgermany\b", r"\bfrance\b",
                  r"\bitaly\b", r"\bspain\b"],
    "UK": [r"(?-i:\bU\.?K\.?\b)", r"\bbritain\b", r"\bbritish\b", r"\bengland\b", r"\blondon\b"],
    "Japan": [r"\bjapan(ese)?\b", r"\btokyo\b", r"\bboj\b"],
    "China": [r"\bchina\b", r"\bchinese\b", r"\bbeijing\b", r"\byuan\b", r"\brenminbi\b"],
    "Canada": [r"\bcanad(a|ian)\b"],
    "Australia": [r"\baustralia(n)?\b"],
    "Switzerland": [r"\bswiss\b", r"\bswitzerland\b"],
    "Nordics": [r"\bnorway\b", r"\bnorwegian\b", r"\bsweden\b", r"\bswedish\b"],
    "Middle East": [r"\bsaudi\b", r"\biran\b", r"\bisrael\b", r"\bopec\b", r"\bgulf\b"],
}

CATEGORY_WORDS: dict[str, list[str]] = {
    "central-bank": [r"\brate decision\b", r"\binterest rates?\b", r"\bmonetary policy\b",
                     r"\bfomc\b", r"\bfederal reserve\b", r"\becb\b",
                     r"\bbank of (england|japan|canada)\b",
                     r"\bcentral bank\b", r"\bpolicy rate\b", r"\bminutes\b"],
    "macro-data": [r"\binflation\b", r"\bcpi\b", r"\bpayrolls?\b", r"\bunemployment\b", r"\bgdp\b",
                   r"\bretail sales\b", r"\bpmi\b", r"\bjobs report\b", r"\bconsumer prices?\b",
                   r"\bemployment situation\b", r"\bpersonal income\b", r"\btrade balance\b"],
    "energy": [r"\boil\b", r"\bcrude\b", r"\bnatural gas\b", r"\bopec\b", r"\bpetroleum\b",
               r"\binventor(y|ies)\b", r"\bgasoline\b", r"\belectricity\b"],
    "regulation": [r"(?-i:\bSEC\b)", r"\bcftc\b", r"\benforcement\b", r"\bcharges?\b",
                   r"\bregulat\w*\b", r"\bsettle(s|d|ment)?\b"],
    "geopolitics": [r"\bwar\b", r"\bsanctions?\b", r"\btariffs?\b", r"\belection\b",
                    r"\binvasion\b", r"\battack\b", r"\bconflict\b"],
    "earnings": [r"\bearnings\b", r"\bquarterly results\b", r"\bprofit\b", r"\brevenue\b"],
}

CATEGORIES = ["central-bank", "macro-data", "energy", "markets", "regulation", "geopolitics",
              "earnings"]

# A currency follows from its region when no currency word appears.
REGION_CURRENCY = {"US": "USD", "Euro area": "EUR", "UK": "GBP", "Japan": "JPY", "Canada": "CAD",
                   "Australia": "AUD", "Switzerland": "CHF"}


def _compile(table: dict[str, list[str]]) -> dict[str, re.Pattern]:
    return {k: re.compile("|".join(v), re.IGNORECASE) for k, v in table.items()}


_CCY = _compile(CURRENCY_WORDS)
_CMD = _compile(COMMODITY_WORDS)
_REG = _compile(REGION_WORDS)
_CAT = _compile(CATEGORY_WORDS)
# Codes like USD must be upper case to count, so "usd" inside a URL or word does not.
_CODE = re.compile(r"\b(USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|NOK|SEK)\b")


def tag(text: str, *, default_category: str | None = None, regions: list[str] | None = None,
        currencies: list[str] | None = None) -> dict:
    """Return currencies, commodities, regions and one category for a piece of text.

    `regions`, `currencies` and `default_category` come from the source (for example the
    ECB feed is always Euro area and EUR) and are merged with what the words say.
    """
    ccy = {c for c, p in _CCY.items() if p.search(text)}
    ccy |= set(_CODE.findall(text))
    reg = {r for r, p in _REG.items() if p.search(text)} | set(regions or [])
    ccy |= set(currencies or [])
    if not ccy:
        ccy = {REGION_CURRENCY[r] for r in reg if r in REGION_CURRENCY}
    cmd = {c for c, p in _CMD.items() if p.search(text)}
    hits = {c: len(p.findall(text)) for c, p in _CAT.items()}
    best = max(hits, key=lambda c: (hits[c], -CATEGORIES.index(c)))
    category = best if hits[best] else (default_category or "markets")
    if default_category and hits.get(default_category):
        category = default_category  # the source's own kind wins a tie-ish call
    order = list(CURRENCY_WORDS)
    return {
        "currencies": sorted(ccy, key=order.index),
        "commodities": sorted(cmd),
        "regions": sorted(reg),
        "category": category,
    }


# ------------------------------------------------------------------ topics
# Topics are what an item is about in market terms, for the event studies in study.py.
# Same idea as the lists above: plain word lists anyone can read and fix. An item can
# have several topics or none.

TOPICS: dict[str, tuple[str, list[str]]] = {
    "rate-hike": ("Rate hike", [r"\braise[sd]? (its |the )?(key |policy |interest )*rates?\b",
                                r"\brate (hike|increase|rise)s?\b",
                                r"\bhikes? (interest )?rates?\b",
                                r"\bincrease[sd]? (the )?(policy |interest )*rates?\b",
                                r"\btighten(s|ed|ing)? (monetary )?policy\b"]),
    "rate-cut": ("Rate cut", [r"\bcuts? (its |the )?(key |policy |interest )*rates?\b",
                              r"\brate cuts?\b",
                              r"\blower(s|ed)? (the )?(policy |interest )*rates?\b",
                              r"\bemergency cut\b", r"\bnegative (interest )?rates?\b"]),
    "policy-decision": ("Central bank decision", [r"\bfomc statement\b",
                                                  r"\bmonetary policy (decision|statement)s?\b",
                                                  r"\bstatement on monetary policy\b",
                                                  r"\bfederal open market committee\b",
                                                  r"\bmonetary policy committee\b"]),
    "qe": ("Bond buying (QE)", [r"\bquantitative (and qualitative )?(monetary )?easing\b",
                                r"\basset purchases?\b", r"\bbond[- ]buying\b",
                                r"\bbalance sheet (runoff|reduction)\b", r"\btapering\b",
                                r"\byield curve control\b"]),
    "inflation": ("Inflation", [r"\binflation\b", r"\bcpi\b", r"\bconsumer prices?\b",
                                r"\bproducer prices?\b"]),
    "jobs": ("Jobs", [r"\bpayrolls?\b", r"\bunemployment\b", r"\bjobs report\b",
                      r"\bemployment situation\b", r"\bjobless\b"]),
    "growth": ("Growth and recession", [r"\brecession\b", r"\bgdp\b", r"\beconomic growth\b",
                                        r"\bslowdown\b", r"\bcontraction\b"]),
    "opec": ("OPEC", [r"\bopec\b", r"\boil cartel\b"]),
    "oil-supply": ("Oil supply", [r"\boil (supply|output|production|exports?)\b",
                                  r"\bcrude (supply|output|production|exports?)\b",
                                  r"\bproduction cuts?\b", r"\boil ?fields?\b",
                                  r"\brefiner(y|ies)\b", r"\bpipeline\b", r"\bprice war\b",
                                  r"\boil embargo\b"]),
    "war": ("War and conflict", [r"\bwar\b(?! on)", r"\binvasion\b", r"\binvade[sd]?\b",
                                 r"\bmilitary\b", r"\bmissiles?\b", r"\bair ?strikes?\b",
                                 r"\bdrones?\b", r"\btroops\b", r"\bstrikes? on\b"]),
    "sanctions": ("Sanctions", [r"\bsanctions?\b", r"\bembargo\b", r"\breserves? frozen\b",
                                r"\bfreez\w* (of )?(assets|reserves)\b"]),
    "trade": ("Tariffs and trade", [r"\btariffs?\b", r"\btrade war\b", r"\btrade deal\b",
                                    r"\bimport (duties|duty)\b"]),
    "bank-failure": ("Bank failure", [r"\bbank (failure|collapse|run)s?\b", r"\bfailed bank\b",
                                      r"\breceivership\b", r"\bbail ?out\b", r"\brescue\b",
                                      r"\bbankruptcy\b", r"\binsolven\w*\b",
                                      r"\bbank\w* (fail|collaps)\w*\b"]),
    "debt-crisis": ("Debt and default", [r"\bdefault(s|ed)?\b", r"\bdowngrade[sd]?\b",
                                         r"\bdebt crisis\b", r"\bjunk\b", r"\bdebt ceiling\b"]),
    "currency": ("Currency shocks", [r"\bcurrency intervention\b", r"\bdevalu\w*\b",
                                     r"\bpeg\b", r"\bexchange rate floor\b",
                                     r"\bcurrency crisis\b", r"\bintervene[sd]? in\b"]),
    "election": ("Elections and votes", [r"\belection\b", r"\breferendum\b"]),
    "pandemic": ("Pandemic", [r"\bpandemic\b", r"\bcovid\b", r"\bcoronavirus\b",
                              r"\boutbreak\b", r"\bepidemic\b"]),
    "disaster": ("Natural disaster", [r"\bhurricane\b", r"\bearthquake\b", r"\btsunami\b"]),
    "terror": ("Terror attack", [r"\bterror\w*\b", r"\bbombings?\b"]),
    "enforcement": ("Enforcement actions", [r"\benforcement actions?\b", r"\bcharges\b",
                                            r"\bcivil money penalt(y|ies)\b"]),
}

TOPIC_LABEL = {k: v[0] for k, v in TOPICS.items()}
_TOPIC = {k: re.compile("|".join(v[1]), re.IGNORECASE) for k, v in TOPICS.items()}


def topics(text: str) -> list[str]:
    """Every topic whose words appear in the text, in the order of TOPICS."""
    return [k for k, p in _TOPIC.items() if p.search(text or "")]
