"""Tags and labels for a series (DEC-0064): asset class, region, frequency, theme, units and
liquidity tier.

Rules come first: the key's prefix and a few words in the name decide most series. For a
series the rules cannot place (a new FRED code, a request from the competitor collector), a
small local classifier reads its name. It is a naive Bayes model over words, trained on the
curated catalog's names and the labels the rules give them. No paid API, no network.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache

G10 = ("USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK")
CCY_REGION = {"USD": "US", "EUR": "EU", "GBP": "GB", "JPY": "JP", "CHF": "CH", "CAD": "CA",
              "AUD": "AU", "NZD": "NZ", "NOK": "NO", "SEK": "SE"}
FREQ_WORD = {"T": "tick", "D": "daily", "W": "weekly", "M": "monthly", "Q": "quarterly",
             "A": "yearly"}

ENERGY = ("WTI", "BRENT", "HH_GAS", "NATGAS", "CRUDE", "GASOLINE", "DISTILLATE", "SPR",
          "CUSHING", "REFINERY", "GAS_STORAGE", "OIL")
METALS = ("COPPER", "ALUMINIUM", "NICKEL", "IRON_ORE", "GOLD", "SILVER", "PLATINUM")
AGRI = ("WHEAT", "CORN", "SOYBEANS")

# prefix: (asset class, theme, units)
PREFIX = {
    "fx": ("fx", "fx", "USD per unit"), "xfx": ("fx", "fx", "USD per unit"),
    "ecb": ("fx", "fx", "units per EUR"), "reer": ("fx", "fx", "index"),
    "usd": ("fx", "fx", "index"), "rate": ("rates", "rates", "percent"),
    "bond": ("rates", "rates", "percent"), "curve": ("rates", "rates", "percent"),
    "policy": ("rates", "rates", "percent"), "money": ("rates", "money", "percent"),
    "spread": ("rates", "rates", "percentage points"), "infl": ("rates", "inflation", "percent"),
    "credit": ("credit", "credit", "percent"), "eq": ("equity", "equity", "index"),
    "ind": ("equity", "equity", "index"), "factor": ("factor", "factor", "index"),
    "cmd": ("commodity", "energy", "USD"), "eia": ("commodity", "energy", "thousand barrels"),
    "cot": ("positioning", "positioning", "contracts"), "macro": ("macro", "macro", "index"),
    "pm": ("property", "property", "index"), "kraken": ("crypto", "crypto", "USD"),
    "coinbase": ("crypto", "crypto", "USD"), "gemini": ("crypto", "crypto", "USD"),
    "binanceus": ("crypto", "crypto", "USD"), "hyperliquid": ("crypto", "crypto", "USD"),
    "onchain": ("crypto", "crypto", "USDC"), "etf": ("equity", "funds", "USD"),
    "live": ("crypto", "crypto", "USD"), "fred": ("other", "other", ""),
    "request": ("other", "other", ""), "risk": ("volatility", "volatility", "index"),
}

#: Liquidity tier 1 (deepest) to 3. Series that are not tradable prices have none.
TIER1 = {"fx.EUR", "fx.JPY", "fx.GBP", "fx.CHF", "fx.CAD", "fx.AUD", "eq.SPX", "eq.US_TOTAL",
         "bond.TR10", "bond.TR2", "bond.TR5", "cmd.WTI", "cmd.BRENT"}


def _ccy(key: str) -> str | None:
    tail = key.split(".", 1)[1] if "." in key else key
    m = re.match(r"^([A-Z]{3})(?:_|$)", tail)
    return m.group(1) if m else None


def region_of(key: str, name: str = "") -> str:
    head = key.split(".", 1)[0]
    ccy = _ccy(key)
    if head in ("fx", "xfx", "rate", "reer", "policy") and ccy:
        return CCY_REGION.get(ccy, ccy[:2])
    if head == "ecb":
        return CCY_REGION.get(ccy, ccy[:2]) if ccy else "EU"
    if head == "curve":
        return "EU" if "EA_" in key else "US"
    if key in ("money.ESTR",):
        return "EU"
    if head in ("kraken", "coinbase", "gemini", "binanceus", "hyperliquid", "onchain", "live"):
        return "global"
    if head == "cot" and ccy and ccy in CCY_REGION:
        return CCY_REGION[ccy]
    if re.search(r"\beuro\b|\bECB\b", name):
        return "EU"
    return "US" if head not in ("request",) else ""


def rule_labels(key: str, name: str = "", frequency: str = "D",
                tradable: bool = False) -> dict | None:
    """Labels from the key's prefix, or None when the prefix says nothing."""
    head = key.split(".", 1)[0]
    if head not in PREFIX or PREFIX[head][0] == "other":
        return None
    asset, theme, units = PREFIX[head]
    tail = key.split(".", 1)[1].upper() if "." in key else ""
    if head == "cmd":
        theme = "metals" if tail in METALS else "agriculture" if tail in AGRI else "energy"
        if theme == "energy" and "GAS" in tail:
            units = "USD per MMBtu"
    if head == "cot":
        units = "percent of open interest" if tail.endswith("_PCT") else "contracts"
    if head == "eia" and "GAS" in tail:
        units = "billion cubic feet"
    if head == "risk" and tail in ("NFCI", "STLFSI"):
        asset, theme = "macro", "macro"
    if head == "pm" and tail.startswith(("LOANS", "SLOOS", "DELINQ")):
        asset, theme = "credit", "credit"
        units = "billion USD" if tail.startswith("LOANS") else "percent"
    return {"asset_class": asset, "theme": theme, "units": units,
            "region": region_of(key, name), "frequency": FREQ_WORD.get(frequency, frequency),
            "liquidity_tier": liquidity_tier(key, tradable)}


def liquidity_tier(key: str, tradable: bool, volume_usd: float | None = None) -> int | None:
    """1 for the deepest markets, 2 for liquid ones, 3 for thin ones; None when not a price
    anyone trades. Crypto pairs and pools use their daily volume or depth when known."""
    if volume_usd is not None:
        return 1 if volume_usd >= 50e6 else 2 if volume_usd >= 2e6 else 3
    if not tradable:
        return None
    if key in TIER1:
        return 1
    head = key.split(".", 1)[0]
    if head in ("fx", "xfx") and _ccy(key) in G10:
        return 1
    return 2 if head in ("fx", "xfx", "ind", "factor", "bond") else 3


# ------------------------------------------------------------------ the classifier

_WORD = re.compile(r"[a-z][a-z0-9]+")
STOP = {"the", "and", "of", "per", "in", "on", "a", "an", "to", "from", "by", "with", "at",
        "for", "is", "its", "usd", "percent", "index", "daily", "weekly", "monthly", "used",
        "after", "ends", "released", "next", "fred", "average"}


def words(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in STOP]


class NaiveBayes:
    """Multinomial naive Bayes with add-one smoothing. Small and exact."""

    def __init__(self, docs: list[tuple[str, str]]):
        self.prior = Counter(label for _, label in docs)
        self.counts: dict[str, Counter] = {c: Counter() for c in self.prior}
        for text, label in docs:
            self.counts[label].update(words(text))
        self.vocab = {w for c in self.counts.values() for w in c}
        self.totals = {c: sum(v.values()) for c, v in self.counts.items()}
        self.n = sum(self.prior.values())

    def predict(self, text: str) -> tuple[str, float]:
        """The likeliest label and its probability. Text with no known word gives the most
        common label at its prior share."""
        toks = [w for w in words(text) if w in self.vocab]
        v = len(self.vocab) or 1
        logp = {}
        for c in self.prior:
            lp = math.log(self.prior[c] / self.n)
            for w in toks:
                lp += math.log((self.counts[c][w] + 1) / (self.totals[c] + v))
            logp[c] = lp
        top = max(logp.values())
        z = sum(math.exp(x - top) for x in logp.values())
        best = max(logp, key=logp.get)
        return best, 1.0 / z


#: A few plain words per label, added to the training names, so words that official data
#: titles use but our short catalog names do not (yuan, unemployment) still point somewhere.
ANCHORS = {
    "fx": "currency exchange rate spot dollar euro yen pound franc yuan renminbi peso won rupee",
    "rates": "yield interest rate treasury bond bill note maturity constant overnight policy",
    "credit": "corporate spread loans lending credit delinquency default commercial paper",
    "equity": "stock stocks index shares equity market capitalization",
    "commodity": "price oil crude gas copper gold silver wheat corn barrel ton bushel",
    "macro": "employment unemployment claims payrolls production output gdp consumer retail "
             "sales housing starts survey activity",
    "positioning": "positions traders net long short open interest futures",
    "property": "house home property real estate residential commercial prices",
}
THEME_ANCHORS = {"fx": ANCHORS["fx"], "rates": ANCHORS["rates"], "credit": ANCHORS["credit"],
                 "equity": ANCHORS["equity"], "energy": "oil crude gas gasoline diesel barrel",
                 "metals": "copper gold silver aluminium nickel iron ore",
                 "agriculture": "wheat corn soybeans sugar coffee cotton cattle",
                 "inflation": "inflation consumer price index cpi pce breakeven deflator",
                 "macro": ANCHORS["macro"], "positioning": ANCHORS["positioning"],
                 "property": ANCHORS["property"]}


@lru_cache(maxsize=1)
def classifier() -> tuple[NaiveBayes, NaiveBayes]:
    """Two models trained on the curated catalog: one for asset class, one for theme."""
    from ..data import catalog

    asset = [(text, label) for label, text in ANCHORS.items()]
    theme = [(text, label) for label, text in THEME_ANCHORS.items()]
    for s in catalog.CATALOG.values():
        lab = rule_labels(s.key, s.description, s.frequency)
        if lab:
            asset.append((s.description, lab["asset_class"]))
            theme.append((s.description, lab["theme"]))
    return NaiveBayes(asset), NaiveBayes(theme)


#: The classifier's answer is used only above this probability; below it the label is other.
MIN_CONFIDENCE = 0.6


def label(key: str, name: str, frequency: str = "D", tradable: bool = False,
          volume_usd: float | None = None) -> dict:
    """Labels for any series. Says where each came from, so a page can show "by rule" or
    "by classifier, 0.83"."""
    lab = rule_labels(key, name, frequency, tradable)
    if lab is not None:
        lab["by"] = "rule"
    else:
        a_model, t_model = classifier()
        a, pa = a_model.predict(name)
        t, pt = t_model.predict(name)
        lab = {"asset_class": a if pa >= MIN_CONFIDENCE else "other",
               "theme": t if pt >= MIN_CONFIDENCE else "other",
               "units": "", "region": region_of(key, name),
               "frequency": FREQ_WORD.get(frequency, frequency),
               "liquidity_tier": liquidity_tier(key, tradable),
               "by": "classifier", "confidence": round(min(pa, pt), 2)}
    if volume_usd is not None:
        lab["liquidity_tier"] = liquidity_tier(key, True, volume_usd)
    return lab


def tags_for(key: str, lab: dict, extra: tuple[str, ...] = ()) -> list[str]:
    """A short tag list for search and filters."""
    out = [lab["asset_class"], lab["theme"], lab["frequency"]]
    if lab.get("region"):
        out.append(lab["region"].lower())
    ccy = _ccy(key)
    if ccy and key.split(".", 1)[0] in ("fx", "xfx", "rate", "policy", "ecb", "reer"):
        out.append("g10" if ccy in G10 else "em")
    if lab.get("liquidity_tier"):
        out.append(f"tier{lab['liquidity_tier']}")
    out += list(extra)
    return list(dict.fromkeys(t for t in out if t))[:20]
