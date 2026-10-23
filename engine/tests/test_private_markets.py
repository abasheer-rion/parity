"""Private markets (DEC-0029): Form D counts, BDC net asset values, the FRED proxies,
unsmoothing and the private.json export. No network: SEC responses are trimmed real ones
saved under fixtures/markets, and the unsmoothing tests use made-up series with known
answers."""

from __future__ import annotations

import io
import json
import math
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from parity import unsmooth
from parity.data import catalog
from parity.data import store as data_store
from parity.markets import export, private, private_export, sources, store

FIX = Path(__file__).parent / "fixtures" / "markets"
T0 = datetime(2026, 10, 23, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*_a, **_k):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr("parity.markets.sources._request", refuse)
    monkeypatch.setattr("parity.data.sources._get", refuse)
    monkeypatch.setattr("parity.data.sources._curl", refuse)


def _formd() -> pd.DataFrame:
    return private.parse_formd_tables((FIX / "formd_submission.tsv").read_text(),
                                      (FIX / "formd_offering.tsv").read_text(), "2026Q1")


# ------------------------------------------------------------------ catalog


def test_private_proxies_are_optional_fred_series_with_release_lags():
    pm = [s for s in catalog.CATALOG.values() if s.key.startswith("pm.")]
    assert len(pm) == 9
    for s in pm:
        assert not s.required and s.source == "fred"
        if s.frequency in ("M", "Q"):
            assert s.published_after is not None, f"{s.key} needs a release lag"
        if s.frequency == "W":
            assert s.lag_days > 0
    # The Fed's index is chained to CoStar's: numbers only, never charted on the site.
    assert not catalog.get("pm.CRE_PRICE").site


def test_no_licensed_index_sneaks_in():
    """No S&P, NCREIF, Case-Shiller or ICE index among the proxies (REF-0015)."""
    codes = {s.code for s in catalog.CATALOG.values() if s.key.startswith("pm.")}
    for banned in ("CSUSHPINSA", "CSUSHPISA", "SPCS20RSA", "BAMLH0A0HYM2", "SP500"):
        assert banned not in codes


def test_quarterly_values_wait_for_the_quarter_end_plus_the_lag(tmp_path):
    spec = catalog.get("pm.HOUSE_FHFA")
    raw = pd.Series([100.0, 101.0], index=pd.to_datetime(["2025-01-01", "2025-04-01"]),
                    name=spec.key)
    path = tmp_path / "raw" / spec.source / f"{spec.code}.parquet"
    path.parent.mkdir(parents=True)
    raw.to_frame().to_parquet(path)
    daily = catalog.get("fx.EUR")  # the panel's calendar comes from its daily series
    days = pd.bdate_range("2025-01-01", "2025-12-31")
    dpath = tmp_path / "raw" / daily.source / f"{daily.code}.parquet"
    dpath.parent.mkdir(parents=True, exist_ok=True)
    pd.Series(1.1, index=days, name=daily.key).to_frame().to_parquet(dpath)
    p = data_store.panel([spec.key, daily.key], tmp_path)
    first = p[spec.key].first_valid_index()
    # Q1 2025 ends on 31 March; FHFA comes out about 43 business days later.
    assert first == pd.Timestamp("2025-03-31") + pd.offsets.BDay(spec.published_after)


# ------------------------------------------------------------------ Form D


def test_formd_page_links_are_read_newest_first():
    listed = private.parse_formd_page((FIX / "sec_formd_page.html").read_text())
    assert [q for q, _ in listed][:3] == ["2026Q3", "2026Q2", "2026Q1"]
    assert all(u.startswith("https://www.sec.gov/files/") and u.endswith("_d.zip")
               for _, u in listed)
    # The SEC moved newer files to another folder; both must be found.
    assert {"datastandardsinnovation", "structureddata"} <= {u.split("/")[4] for _, u in listed}


def test_pick_quarters_fetches_only_new_ones_and_the_newest_again():
    listed = [("2026Q3", "a"), ("2026Q2", "b"), ("2026Q1", "c"), ("2025Q4", "d")]
    assert private.pick_quarters(listed, set(), 3) == listed[:3]
    assert private.pick_quarters(listed, {"2026Q3", "2026Q2", "2026Q1"}, 3) == [listed[0]]
    assert private.pick_quarters(listed, {"2026Q3"}, 3) == listed[:3]


def test_formd_counts_new_notices_only_and_keeps_no_names():
    df = _formd()
    sub = pd.read_csv(FIX / "formd_submission.tsv", sep="\t", dtype=str)
    new = (sub["SUBMISSIONTYPE"] == "D").sum()
    assert df["filings"].sum() == new  # D/A amendments are not counted again
    assert set(df["kind"]) <= set(private.KINDS)
    assert set(df["size"]) <= {s for s, *_ in private.SIZES}
    assert set(df["exemption"]) <= set(private.EXEMPTIONS)
    assert {"Private equity fund", "Venture capital fund", "Hedge fund"} <= set(df["kind"])
    assert not any("NAME" in c.upper() for c in df.columns)
    assert (df["amount_sold_usd"] >= 0).all()


def test_formd_classifiers():
    assert private.kind_of("Pooled Investment Fund", "Venture Capital Fund") == \
        "Venture capital fund"
    assert private.kind_of("Pooled Investment Fund", "") == "Other pooled fund"
    assert private.kind_of("Commercial", "") == "Real estate"
    assert private.kind_of("Restaurants", "") == "Other company"
    assert private.size_of(None) == "none" and private.size_of(0) == "none"
    assert private.size_of(999_999) == "lt1m" and private.size_of(1e6) == "1m-10m"
    assert private.size_of(2.5e9) == "1b+"
    assert private.exemption_of("06b, 3C, 3C.7") == "506b"
    assert private.exemption_of("06c") == "506c"
    assert private.exemption_of("04") == "504"
    assert private.exemption_of("3C.1") == "other"


def test_formd_zip_reads_the_two_tables():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("2026Q1_d/FORMDSUBMISSION.tsv", (FIX / "formd_submission.tsv").read_text())
        z.writestr("2026Q1_d/OFFERING.tsv", (FIX / "formd_offering.tsv").read_text())
    df = private.parse_formd_zip(buf.getvalue(), "2026Q1")
    pd.testing.assert_frame_equal(df, _formd())


def test_quarters_policy_replaces_a_quarter_and_keeps_the_rest(tmp_path):
    a = _formd()
    b = a.assign(quarter="2025Q4")
    store.merge("formd", pd.concat([a, b]), tmp_path)
    store.merge("formd", a.head(2), tmp_path)
    out = store.load("formd", tmp_path)
    assert len(out[out["quarter"] == "2026Q1"]) == 2
    assert len(out[out["quarter"] == "2025Q4"]) == len(b)


def test_sec_sources_skip_without_a_contact(monkeypatch):
    monkeypatch.delenv("PARITY_CONTACT", raising=False)
    for sid in ("sec-formd", "sec-bdc"):
        src = sources.BY_ID[sid]
        assert src.needs_contact and not src.required
        with pytest.raises(sources.Skipped):
            sources.fetch(src)


# ------------------------------------------------------------------ BDC NAVs


def test_bdc_nav_keeps_one_value_per_period_from_periodic_reports():
    payload = json.loads((FIX / "sec_bdc_arcc_nav.json").read_text())
    df = private.parse_nav_concept(payload, "0001287750", "Ares Capital", "ARCC", True, T0)
    assert df["end"].is_unique and df["end"].is_monotonic_increasing
    assert set(df["form"]) <= private.NAV_FORMS  # the 424B2 prospectus value is dropped
    assert (df["nav"] > 5).all() and (df["ticker"] == "ARCC").all()


def test_nav_stats_measure_falls_not_gains():
    idx = pd.to_datetime(["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31",
                          "2025-03-31", "2025-06-30"])
    s = private_export.nav_stats(pd.Series([10.0, 10.0, 9.0, 9.5, 9.9, 10.1], index=idx))
    assert s["worst_quarter_pct"] == pytest.approx(-10.0)
    assert s["max_drawdown_pct"] == pytest.approx(-10.0)
    assert s["change_1y_pct"] == pytest.approx((10.1 / 10.0 - 1) * 100, abs=0.01)
    assert s["last_date"] == "2025-06-30"


def test_nav_stats_skip_year_gaps_and_split_like_jumps():
    idx = pd.to_datetime(["2020-12-31", "2021-12-31", "2022-03-31", "2022-06-30",
                          "2022-09-30", "2022-12-31"])
    # A yearly gap (2020 to 2021) is not a quarter; a 4-for-1 reverse split is not a gain.
    s = private_export.nav_stats(pd.Series([10.0, 7.0, 28.0, 27.0, 27.5, 26.0], index=idx))
    assert s["quarterly_changes"] == 3
    assert s["split_like_jumps"] == ["2022-03-31"]
    assert s["worst_quarter_pct"] == pytest.approx((26.0 / 27.5 - 1) * 100, abs=0.01)
    assert s["max_drawdown_pct"] == pytest.approx((26.0 / 28.0 - 1) * 100, abs=0.01)


# ------------------------------------------------------------------ unsmoothing


def _smoothed(phi: float, n: int = 4000, seed: int = 1) -> tuple[pd.Series, pd.Series]:
    rng = np.random.default_rng(seed)
    true = rng.normal(0.01, 0.05, n)
    obs = np.zeros(n)
    for t in range(n):
        obs[t] = (1 - phi) * true[t] + phi * (obs[t - 1] if t else true[0])
    idx = pd.period_range("1000Q1", periods=n, freq="Q").to_timestamp(how="end")
    return pd.Series(true, index=idx), pd.Series(obs, index=idx)


def test_geltner_recovers_the_true_volatility_of_an_ar1_smoothed_series():
    true, obs = _smoothed(0.6)
    assert unsmooth.ac(obs, 1) == pytest.approx(0.6, abs=0.05)
    out, phi = unsmooth.geltner(obs)
    assert phi == pytest.approx(0.6, abs=0.05)
    assert out.std() == pytest.approx(true.std(), rel=0.05)
    assert obs.std() < 0.6 * true.std()  # smoothing hid most of the risk
    assert abs(unsmooth.ac(out, 1)) < 0.05


def test_geltner_leaves_an_unsmoothed_series_alone():
    true, _ = _smoothed(0.0)
    out, phi = unsmooth.geltner(true)
    assert phi < 0.05
    assert out.std() == pytest.approx(true.std(), rel=0.06)


def test_glm_finds_the_moving_average_weights():
    rng = np.random.default_rng(7)
    true = rng.normal(0.0, 0.05, 20000)
    theta = [0.6, 0.3, 0.1]
    obs = theta[0] * true[2:] + theta[1] * true[1:-1] + theta[2] * true[:-2]
    idx = pd.period_range("1000Q1", periods=len(obs), freq="Q").to_timestamp(how="end")
    est, xi = unsmooth.glm_theta(pd.Series(obs, index=idx))
    assert est == pytest.approx(theta, abs=0.05)
    assert xi == pytest.approx(sum(t * t for t in theta), abs=0.03)
    back = unsmooth.glm_unsmooth(pd.Series(obs, index=idx), est)
    assert back is not None and back.std() == pytest.approx(true.std(), rel=0.08)


def test_glm_refuses_to_invert_a_moving_average_with_a_unit_root():
    r = pd.Series([0.01, 0.02, -0.01, 0.0, 0.03])
    assert unsmooth.glm_unsmooth(r, [0.36, 0.28, 0.36]) is None
    assert unsmooth.glm_unsmooth(r, [1.0, 0.0, 0.0]) is not None


def test_summed_beta_finds_exposure_a_same_quarter_regression_misses():
    rng = np.random.default_rng(3)
    m = rng.normal(0.02, 0.08, 400)
    y = 0.5 * np.r_[0.0, m[:-1]] + rng.normal(0, 0.01, 400)  # reacts one quarter late
    idx = pd.period_range("1900Q1", periods=400, freq="Q").to_timestamp(how="end")
    b = unsmooth.summed_beta(pd.Series(y, index=idx), pd.Series(m, index=idx))
    assert abs(b["same_quarter"]) < 0.1
    assert b["summed"] == pytest.approx(0.5, abs=0.08)


def test_deseason_removes_a_repeating_quarter_pattern():
    idx = pd.period_range("2000Q1", periods=80, freq="Q").to_timestamp(how="end")
    r = pd.Series([0.03, 0.0, -0.01, 0.0] * 20, index=idx)
    out = unsmooth.deseason(r)
    assert out.std() == pytest.approx(0.0, abs=1e-12)
    assert out.mean() == pytest.approx(r.mean())


def test_study_reports_raw_and_unsmoothed_numbers():
    _, obs = _smoothed(0.7, n=200)
    level = 100 * (1 + obs).cumprod()
    res = unsmooth.study(level, level * 0 + 100 * (1 + obs.shift(1).fillna(0)).cumprod())
    assert res["geltner"]["vol"] > res["raw"]["vol"]
    assert res["glm"]["smoothing_index"] <= 1
    assert "fit_error" in res["glm"]


# ------------------------------------------------------------------ export


def _seed(tmp_path: Path) -> None:
    store.merge("formd", pd.concat([_formd(), _formd().assign(quarter="2025Q4")]), tmp_path)
    payload = json.loads((FIX / "sec_bdc_arcc_nav.json").read_text())
    store.merge("bdc_nav", private.parse_nav_concept(payload, "0001287750", "Ares Capital",
                                                     "ARCC", True, T0), tmp_path)
    store.record("sec-formd", {"ok_at": T0.isoformat(), "error": None}, tmp_path)
    _, obs = _smoothed(0.6, n=240)
    idx = pd.period_range("1966Q1", periods=240, freq="Q").to_timestamp(how="start")
    for key in ("pm.CRE_PRICE", "pm.HOUSE_FHFA", "eq.US_MKT", "pm.SLOOS_CI"):
        spec = catalog.get(key)
        s = pd.Series((100 * (1 + obs).cumprod()).to_numpy(), index=idx, name=key)
        path = tmp_path / "raw" / spec.source / f"{spec.code}.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        s.to_frame().to_parquet(path)


def test_private_json_has_every_part_and_no_nan(tmp_path):
    _seed(tmp_path)
    export.build(tmp_path / "out", tmp_path)
    text = (tmp_path / "out" / "markets" / "private.json").read_text()
    assert "NaN" not in text and "Infinity" not in text
    doc = json.loads(text)
    assert doc["formd"]["quarters"] == ["2025Q4", "2026Q1"]
    assert doc["formd"]["latest"]["quarter"] == "2026Q1"
    q = doc["formd"]["by_quarter"][-1]
    assert sum(q["by_kind"].values()) == q["filings"] == sum(q["by_size"].values())
    assert doc["bdc"]["funds"][0]["ticker"] == "ARCC"
    fund = doc["bdc"]["funds"][0]
    assert isinstance(fund["points"], list) and len(fund["points"]) == fund["point_count"]
    keys = {s["key"] for s in doc["series"]}
    assert "pm.SLOOS_CI" in keys and "pm.CRE_PRICE" not in keys  # off the site
    studies = {u["id"]: u for u in doc["unsmoothing"]}
    assert {"cre-appraisal", "cre-sales", "houses"} <= set(studies)
    assert "chart" not in studies["cre-appraisal"]  # CoStar based: numbers only
    assert studies["houses"]["chart"] and studies["houses"]["site"]
    assert studies["houses"]["geltner"]["vol"] > studies["houses"]["raw"]["vol"]
    ids = {s["id"] for s in doc["sources"]}
    assert {"sec-formd", "sec-bdc", "fred-private"} <= ids


def test_private_json_without_any_data_still_writes(tmp_path):
    export.build(tmp_path / "out", tmp_path)
    doc = json.loads((tmp_path / "out" / "markets" / "private.json").read_text())
    assert doc["formd"] is None and doc["bdc"] is None
    assert doc["series"] == [] and doc["unsmoothing"] == []
    assert not math.isnan(len(doc["sources"]))
