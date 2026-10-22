"""Parity Terminal export: stats maths, history shape, licences and clean JSON."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from parity import terminal as tm
from parity.data import catalog


def _write(root, key, s):
    spec = catalog.get(key)
    path = root / "raw" / spec.source / f"{spec.code}.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    s.rename(key).to_frame().to_parquet(path)


def _daily(start="2014-01-01", end="2026-10-16", seed=0, level=100.0):
    idx = pd.bdate_range(start, end)
    r = np.random.default_rng(seed).normal(0, 0.01, len(idx))
    return pd.Series(level * np.exp(np.cumsum(r)), index=idx)


def test_changes_for_a_price_are_percent():
    idx = pd.bdate_range("2025-12-01", "2026-03-31")
    s = pd.Series(np.arange(len(idx), dtype=float) + 100, index=idx)
    out = tm.stats(s, "price", "D")
    last = s.iloc[-1]
    assert out["last"] == pytest.approx(last)
    assert out["chg"]["d1"] == pytest.approx((last / s.iloc[-2] - 1) * 100, rel=1e-5)
    w_ref = s[s.index <= s.index[-1] - pd.Timedelta(days=7)].iloc[-1]
    assert out["chg"]["w1"] == pytest.approx((last / w_ref - 1) * 100, rel=1e-5)
    m_ref = s[s.index <= pd.Timestamp("2026-02-28")].iloc[-1]
    assert out["chg"]["m1"] == pytest.approx((last / m_ref - 1) * 100, rel=1e-5)
    y_ref = s[s.index <= pd.Timestamp("2025-12-31")].iloc[-1]
    assert out["chg"]["ytd"] == pytest.approx((last / y_ref - 1) * 100, rel=1e-5)
    assert out["asof"] == "2026-03-31"
    assert out["first"] == "2025-12-01"


def test_changes_for_a_level_are_differences_and_no_vol():
    s = _daily(seed=1, level=4.0)
    out = tm.stats(s, "level", "D")
    assert out["chg"]["d1"] == pytest.approx(s.iloc[-1] - s.iloc[-2], abs=1e-5)
    assert out["vol"] is None
    price = tm.stats(s, "price", "D")
    assert price["chg"]["d1"] != pytest.approx(out["chg"]["d1"])


def test_vol_is_annualised_from_daily_log_returns():
    s = _daily(seed=2)
    out = tm.stats(s, "price", "D")
    year = s[s.index > s.index[-1] - pd.Timedelta(days=365)]
    r = np.log(year).diff().dropna()
    expected = r.std(ddof=1) * math.sqrt(len(r)) * 100
    assert out["vol"] == pytest.approx(expected, rel=1e-3)
    assert 10 < out["vol"] < 22  # 1% a day is about 16% a year


def test_z_score_divides_the_week_by_three_years_of_weekly_moves():
    s = _daily(seed=3, level=2.0)
    out = tm.stats(s, "level", "D")
    asof = s.index[-1]
    weeks = s[s.index > asof - pd.Timedelta(days=3 * 365)].resample("W-FRI").last().dropna()
    sd = weeks.diff().dropna().std(ddof=1)
    assert out["z"] == pytest.approx(out["chg"]["w1"] / sd, rel=1e-3)


def test_percentile_and_spark():
    idx = pd.bdate_range("2025-01-01", "2026-10-16")
    s = pd.Series(np.linspace(1, 2, len(idx)), index=idx)
    out = tm.stats(s, "price", "D")
    assert out["pct1y"] == 100.0  # a rising line ends at its high
    s2 = s.copy()
    s2.iloc[-1] = 0.5
    assert tm.stats(s2, "price", "D")["pct1y"] < 1
    assert 50 <= len(out["spark"]) <= 52
    assert out["spark"][-1] == pytest.approx(2.0)


def test_monthly_series_have_no_daily_or_weekly_change():
    idx = pd.date_range("2020-01-01", "2026-09-01", freq="MS")
    s = pd.Series(np.arange(len(idx), dtype=float), index=idx)
    out = tm.stats(s, "level", "M")
    assert out["chg"]["d1"] is None and out["chg"]["w1"] is None and out["z"] is None
    assert out["chg"]["m1"] == pytest.approx(1.0)


def test_history_is_weekly_before_2016_and_daily_after():
    s = _daily("2010-01-01", "2017-12-29")
    pts = tm.points(s, "D")
    dates = pd.to_datetime([d for d, _ in pts])
    old = dates[dates < pd.Timestamp("2015-12-01")]
    assert (old.day_of_week == 4).all()  # Fridays
    assert (np.diff(old.values).astype("timedelta64[D]").astype(int) == 7).all()
    new = dates[dates >= tm.DAILY_FROM]
    assert len(new) == len(s[s.index >= tm.DAILY_FROM])
    assert dates.is_monotonic_increasing and dates.is_unique
    # A week's value is that week's last close
    assert dict(pts)["2012-06-08"] == pytest.approx(tm.sig(s.loc["2012-06-08"]))
    monthly = pd.Series([1.0, 2.0], index=pd.to_datetime(["2001-01-01", "2001-02-01"]))
    assert tm.points(monthly, "M") == [["2001-01-01", 1.0], ["2001-02-01", 2.0]]


def test_six_significant_digits_and_null_not_nan():
    assert tm.sig(1.23456789) == 1.23457
    assert tm.sig(123456789.0) == 123457000.0
    assert tm.sig(float("nan")) is None and tm.sig(float("inf")) is None and tm.sig(None) is None


def test_monthly_average_dated_when_first_readable():
    e = tm.Entry("credit.HQM10Y", "x", "X", "ust_curve", "rates", "s", "l", "level", "%", "M",
                 published_after=22)
    s = pd.Series([5.0], index=pd.to_datetime(["2026-01-01"]))
    out = tm.readable(s, e)
    assert out.index[0] == pd.Timestamp("2026-01-31") + pd.offsets.BDay(22)


def test_licence_filter_excludes_forbidden_sources():
    keep, dropped = tm.entries()
    keys = {e.key for e in keep}
    for bad in ("eq.SPY", "eq.SPX", "eq.US_TOTAL", "cmd.COPPER", "cmd.WHEAT", "cot.EUR"):
        assert bad not in keys
        assert bad in {d["key"] for d in dropped}
    for good in ("fx.EUR", "eq.US_MKT", "risk.VIX", "cot.EUR_PCT", "curve.UST_10Y",
                 "policy.USD", "ecb.USD", "ind.Enrgy", "factor.MOM"):
        assert good in keys
    assert all(tm.TERMS[tm.terms_for(catalog.get(k))][2] for k in keys)
    assert all(e.source and e.licence for e in keep)


def test_short_codes_unique_upper_case_and_groups_ordered():
    keep, _ = tm.entries()
    shorts = [e.short for e in keep] + [tm.crypto_entry(c).short for c in tm.COINS]
    assert len(shorts) == len(set(shorts))
    assert all(s == s.upper() for s in shorts)
    order = [g for g, _, _ in tm.GROUPS]
    pos = [order.index(e.group) for e in keep]
    assert pos == sorted(pos)
    by_key = {e.key: e.short for e in keep}
    assert by_key["fx.EUR"] == "EUR" and by_key["cmd.BRENT"] == "BRENT"
    assert by_key["bond.UST10Y"] == "UST10Y" and by_key["risk.VIX"] == "VIX"


def test_export_skips_missing_and_forbidden_and_writes_clean_json(tmp_path):
    root = tmp_path / "data"
    _write(root, "fx.EUR", _daily(seed=4, level=1.1))
    _write(root, "bond.UST10Y", _daily(seed=5, level=4.0))
    _write(root, "eq.SPY", _daily(seed=6, level=500.0))  # Yahoo: must never be exported
    _write(root, "eq.SPX", _daily(seed=7, level=5000.0))
    gappy = _daily(seed=8)
    gappy.iloc[5:15] = np.nan
    _write(root, "cmd.WTI", gappy)
    out = tmp_path / "out"
    summary = tm.export(out, root=root, markets=tmp_path / "no-markets")
    index = json.loads((out / "terminal" / "index.json").read_text())
    keys = [r["key"] for r in index["series"]]
    assert keys == ["fx.EUR", "bond.UST10Y", "cmd.WTI"]
    assert [g["id"] for g in index["groups"]] == ["fx_g10", "ust_curve", "commodities"]
    assert {"key": "fx.GBP", "reason": "no cached data"} in summary["dropped"]
    rows = {r["key"]: r for r in index["series"]}
    assert rows["bond.UST10Y"]["kind"] == "level" and rows["fx.EUR"]["kind"] == "price"
    assert rows["fx.EUR"]["file"] == "s/fx.EUR.json"
    files = sorted(p.name for p in (out / "terminal" / "s").iterdir())
    assert files == ["bond.UST10Y.json", "cmd.WTI.json", "fx.EUR.json"]
    for p in [out / "terminal" / "index.json", *(out / "terminal" / "s").iterdir()]:
        text = p.read_text()
        assert "NaN" not in text and "Infinity" not in text
        json.loads(text)
    wti = json.loads((out / "terminal" / "s" / "cmd.WTI.json").read_text())
    assert all(v is not None for _, v in wti["points"])


def test_crypto_from_markets_export_carries_attribution(tmp_path):
    days = pd.date_range("2025-10-17", "2026-10-16")
    prices = [[d.date().isoformat(), 60000 + i] for i, d in enumerate(days)]
    mk = tmp_path / "dist" / "markets"
    mk.mkdir(parents=True)
    (mk / "crypto.json").write_text(json.dumps(
        {"history": {"bitcoin": {"prices": prices}, "unknowncoin": {"prices": prices}}}))
    items, _ = tm.load(root=tmp_path / "empty", markets=tmp_path / "dist")
    assert [e.key for e, _ in items] == ["crypto.BTC"]
    index, _ = tm.build(items)
    row = index["series"][0]
    assert row["short"] == "BTC" and row["group"] == "crypto"
    assert row["attribution"] == "Data provided by CoinGecko"
    assert row["vol"] is not None
