"""Pairs and statistical arbitrage recipes on US industries (DEC-0070).

These run in every nightly report and the gauntlet. They trade French's 49 industry
portfolios, which have a public licence and history back to 1926. The same methods on
single stocks (research only, needing the team's Alpaca key) are built in
parity/pairs/research.py when that data is on the machine; they are not registered here
so a run without the key never fails.

Costs: an industry portfolio is a basket of stocks, so every trade pays at least 10 basis
points one way and short legs pay 50 basis points a year to borrow, more than the 25 to 30
a large stock costs, because the baskets hold small companies too.
"""

from __future__ import annotations

from ..data.catalog import INDUSTRIES49
from ..pairs.universe import INDUSTRY_PAIRS, industry_candidates
from . import register
from ._pairs import PairsBook, PCABook

ALGO_DISTANCE = "algorithms/0045-pairs-trading-distance.md"
ALGO_PCA = "algorithms/0050-stat-arb-pca-residuals.md"
LINKED = [(p.a, p.b) for p in INDUSTRY_PAIRS]
GROUPED = [(p.a, p.b) for p in industry_candidates()]
IND49 = [f"ind49.{k}" for k in INDUSTRIES49 if k != "Other"]


def make_pairs(block, name, display_name, description, reference, grid=None, **attrs):
    """Build (and, with register=True, register) one pairs strategy."""
    reg = attrs.pop("register", True)
    params = {k: attrs.pop(k) for k in list(attrs) if k in block.defaults}
    cls = type(name, (block,), {
        "name": name, "display_name": display_name, "description": description,
        "summary": description, "reference": reference, "param_grid": grid or {},
        "tags": {"family": "value", "asset": "stocks", "style": "pairs", "horizon": "daily"},
        "defaults": {**block.defaults, **params}, "__module__": __name__, **attrs,
    })
    return register(cls) if reg else cls


make_pairs(PairsBook, "pairs_distance_ind49", "Industry pairs, closest prices",
           "Every six months, picks the five industry pairs within the same sector whose "
           "prices moved closest over the past year, and bets on any gap of two standard "
           "deviations closing, as Gatev, Goetzmann and Rouwenhorst did with stocks. Their "
           "profits shrank after the 1990s.", ALGO_DISTANCE, method="distance",
           candidates=GROUPED, exit=0.0, grid={"entry": [1.5, 2.0, 2.5]})

make_pairs(PairsBook, "pairs_coint_ind49", "Industry pairs, cointegrated",
           "Every six months, tests every same-sector industry pair for a stable gap "
           "(Engle and Granger), keeps those whose gaps halve within 60 days, and trades "
           "the five strongest. A pair can stop being one; a gap past four standard "
           "deviations closes the trade.", ALGO_DISTANCE, method="cointegration",
           candidates=GROUPED, grid={"pmax": [0.01, 0.05], "entry": [1.5, 2.0]})

make_pairs(PairsBook, "pairs_coint_linked_ind49", "Linked industries, cointegrated",
           "The same test on 25 industry pairs chosen by hand for a business link, such as "
           "soft drinks against beer. Fewer pairs, so fewer chances to find one by luck, "
           "and fewer trades.", ALGO_DISTANCE, method="cointegration", candidates=LINKED,
           grid={"entry": [1.5, 2.0, 2.5]})

make_pairs(PairsBook, "pairs_kalman_linked_ind49", "Linked industries, moving hedge",
           "Hand-picked industry pairs that pass the cointegration test, traded on a hedge "
           "ratio that a Kalman filter updates every day. Adapts to slow drift; can also "
           "chase noise.", ALGO_DISTANCE, method="kalman", candidates=LINKED,
           grid={"delta": [1e-7, 1e-6, 1e-5]})

make_pairs(PCABook, "pairs_pca_ind49", "Industry leftovers (PCA)",
           "Explains each industry's daily moves by the three main market-wide forces, then "
           "bets that the part left over snaps back, as Avellaneda and Lee did with stocks. "
           "Hedged against those forces. Their profits fell after 2003 and it lost hard in "
           "August 2007.", ALGO_PCA, universe=IND49,
           grid={"factors": [2, 3, 5], "entry": [1.0, 1.25, 1.5]})
