"""Pairs trading (DEC-0070): the statistics, no look-ahead on prices that really are
linked, costs including borrow, the universe and the research-only stock source."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity.backtest.engine import BacktestConfig, run
from parity.data import catalog, sources
from parity.pairs import stats, universe
from parity.registry import rights
from parity.strategies import available
from parity.strategies._pairs import PairsBook, PCABook
from parity.strategies.pairs import make_pairs


def linked_panel(n: int = 1600, seed: int = 3) -> pd.DataFrame:
    """Three prices sharing one random walk plus mean-reverting gaps, and one loner."""
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2001-01-01", periods=n)
    common = np.cumsum(rng.normal(0, 0.01, n))
    gaps = np.zeros((n, 3))
    for t in range(1, n):
        gaps[t] = 0.9 * gaps[t - 1] + rng.normal(0, 0.006, 3)
    data = {f"ind49.{k}": 100 * np.exp(common * b + gaps[:, i])
            for i, (k, b) in enumerate([("Soda", 1.0), ("Beer", 0.8), ("Food", 1.2)])}
    data["ind49.Gold"] = 100 * np.exp(np.cumsum(rng.normal(0, 0.012, n)))
    data["rate.USD"] = 2.0
    data["rate.TBILL3M"] = 2.0
    data["eq.US_TOTAL"] = 100 * np.exp(np.cumsum(rng.normal(0.0003, 0.01, n)))
    return pd.DataFrame(data, index=idx)


PANEL = linked_panel()


def wide_panel(n: int = 1200, k: int = 12, seed: int = 5) -> pd.DataFrame:
    """Twelve industries on one market factor, each with its own mean-reverting part."""
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2001-01-01", periods=n)
    mkt = np.cumsum(rng.normal(0, 0.01, n))
    gaps = np.zeros((n, k))
    for t in range(1, n):
        gaps[t] = 0.85 * gaps[t - 1] + rng.normal(0, 0.006, k)
    names = sorted(catalog.INDUSTRIES49)[:k]
    return pd.DataFrame({f"ind49.{c}": 100 * np.exp(mkt * (0.8 + 0.04 * i) + gaps[:, i])
                         for i, c in enumerate(names)}, index=idx)


WIDE = wide_panel()
CANDS = [("ind49.Soda", "ind49.Beer"), ("ind49.Soda", "ind49.Food"),
         ("ind49.Beer", "ind49.Food"), ("ind49.Soda", "ind49.Gold")]


def book(method: str):
    if method == "pca":
        cls = make_pairs(PCABook, f"t_{method}", "t", "t", "", register=False,
                         universe=list(WIDE), factors=1,
                         corr_window=120, ou_window=40)
        return cls()
    cls = make_pairs(PairsBook, f"t_{method}", "t", "t", "", register=False, method=method,
                     candidates=CANDS, formation=120, trading=60, top=2)
    return cls()


def test_engle_granger_finds_the_linked_pair_and_not_the_loner():
    lp = np.log(PANEL)
    linked = stats.engle_granger(lp["ind49.Soda"].values, lp["ind49.Beer"].values)
    loner = stats.engle_granger(lp["ind49.Soda"].values, lp["ind49.Gold"].values)
    assert linked["p"] < 0.01 and loner["p"] > 0.05
    assert 0.6 < linked["beta"] < 1.6
    assert 2 < stats.half_life(linked["spread"]) < 20
    j = stats.johansen_trace(lp["ind49.Soda"].values, lp["ind49.Beer"].values)
    assert j["trace0"] > j["crit0"]


def test_eg_table_matches_mackinnon_critical_values():
    # MacKinnon (2010), two variables with a constant, large samples: 1% -3.90, 5% -3.34.
    assert stats.eg_pvalue(-3.90, 1000) == pytest.approx(0.01, abs=0.002)
    assert stats.eg_pvalue(-3.34, 1000) == pytest.approx(0.05, abs=0.005)
    assert stats.half_life(np.cumsum(np.ones(100))) == float("inf")


def test_kalman_tracks_a_drifting_hedge_ratio_from_past_data_only():
    rng = np.random.default_rng(0)
    x = np.cumsum(rng.normal(0, 0.01, 800)) + 4
    beta = np.linspace(0.5, 1.5, 800)
    y = beta * x + rng.normal(0, 0.01, 800)
    k = stats.kalman_hedge(y, x, delta=1e-4, ve=1e-4)
    assert abs(k["beta"][-1] - 1.5) < 0.25
    cut = stats.kalman_hedge(y[:500], x[:500], delta=1e-4, ve=1e-4)
    assert np.allclose(cut["beta"], k["beta"][:500])


@pytest.mark.parametrize("method", ["distance", "cointegration", "kalman", "pca"])
def test_no_look_ahead_on_linked_prices(method):
    """Real trades happen on these prices, so truncation would show any peek ahead."""
    panel = WIDE if method == "pca" else PANEL
    full = book(method).weights(panel)
    assert (full.abs().sum(axis=1) > 0).mean() > 0.05, "the method never traded"
    for cut in panel.index[[400, 777, 1111]]:
        part = book(method).weights(panel.loc[:cut])
        assert np.allclose(full.loc[:cut].values, part.values, atol=1e-12), \
            f"{method} weights before {cut.date()} change when later data is removed"


def test_pairs_book_is_market_neutral_and_within_gross():
    b = book("cointegration")
    out = b.run_book(PANEL)
    w = out["weights"]
    assert w.abs().sum(axis=1).max() <= 1 + 1e-9
    assert out["trades"] and {t["kind"] for t in out["trades"]} <= {
        "converged", "stop-out", "time stop", "window end"}
    # Every open day holds a long leg and a short leg.
    open_days = w.abs().sum(axis=1) > 0
    assert ((w[open_days] > 0).any(axis=1) & (w[open_days] < 0).any(axis=1)).all()


def test_short_legs_pay_borrow_and_trades_pay_the_cost_floor():
    b = book("cointegration")
    cfg = BacktestConfig(start=None, cost_bps=0.0)
    paid = run(b, PANEL, cfg).returns.sum()
    b.borrow_bps, b.min_cost_bps = 0.0, 0.0
    free = run(b, PANEL, cfg).returns.sum()
    assert free > paid


def test_every_registered_pairs_recipe_is_counted_and_small():
    names = [n for n in available() if n.startswith("pairs_")]
    assert len(names) >= 5
    for n in names:
        grid = available()[n].param_grid
        assert 1 < int(np.prod([len(v) for v in grid.values()])) <= 9


def test_universe_covers_every_industry_and_the_named_stock_pairs():
    named = {k for v in universe.INDUSTRY_GROUPS.values() for k in v}
    assert named == set(catalog.INDUSTRIES49) - {"Other"}
    ids = {p.id for p in universe.STOCK_PAIRS}
    for a, b in [("KO", "PEP"), ("XOM", "CVX"), ("V", "MA"), ("BRK.A", "BRK.B"),
                 ("GLD", "GDX"), ("GOOGL", "GOOG")]:
        assert f"stk.{a}~stk.{b}" in ids
    for p in universe.STOCK_PAIRS + universe.INDUSTRY_PAIRS:
        assert p.a in catalog.CATALOG and p.b in catalog.CATALOG


def test_stocks_are_research_only_and_skipped_without_a_key(monkeypatch):
    s = catalog.CATALOG["stk.KO"]
    assert s.source == "alpaca" and not s.required and not s.site
    assert rights.catalog_rights(s) == "research"
    assert not rights.may_show("research", "public") and not rights.may_show("research", "team")
    monkeypatch.delenv("ALPACA_KEY_ID", raising=False)
    with pytest.raises(sources.MissingKey):
        sources.fetch_alpaca(s)


def test_alpaca_parser_reads_pages_and_drops_repeats():
    s = catalog.CATALOG["stk.KO"]
    pages = [{"bars": {"KO": [{"t": "2016-01-04T05:00:00Z", "c": 42.5},
                              {"t": "2016-01-05T05:00:00Z", "c": 42.9}]},
              "next_page_token": "x"},
             {"bars": {"KO": [{"t": "2016-01-05T05:00:00Z", "c": 43.0}]}}]
    out = sources.parse_alpaca_bars(pages, s)
    assert list(out.values) == [42.5, 43.0] and out.name == "stk.KO"


def test_search_pairs_space_builds_describes_and_keeps_its_budget():
    import random

    from parity import search

    r = random.Random(4)
    specs = [search._pairsbook(r) for _ in range(40)]
    assert {s["method"] for s in specs} == {"distance", "cointegration", "kalman", "pca"}
    for s in specs:
        d = search.describe(s)
        assert d["style"] == "pairs" and d["asset"] == "stocks" and d["name"]
        assert search.build(s).instruments()
    assert 0 < search.PAIRS_BUDGET <= 0.2
    # Outside SAMPLERS, so the original space draws exactly what it always drew.
    assert search._pairsbook not in {fn for fn, _ in search.SAMPLERS}


def test_report_refuses_any_price_field():
    from parity.pairs import research

    research._no_prices({"pairs": [{"series": {"z": [1.0], "hedge": [0.9]}}]})
    for bad in ({"close": 1}, {"pairs": [{"series": {"adj_close": [1]}}]}, {"price": 2}):
        with pytest.raises(ValueError):
            research._no_prices(bad)
