"""fetch_fred_initial asks FRED for the whole real-time history, in windows FRED accepts.

The fake FRED below behaves like the real API on the points that matter: with no
real-time window it uses today's (which holds no vintage), it refuses a window holding
more than 2,000 vintages, and it pages vintage dates 10,000 at a time.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import pytest

from parity.data import sources
from parity.data.catalog import Series

TODAY = "2026-11-05"


class FakeFred:
    def __init__(self, n_vintages: int):
        start = date(1990, 1, 1)
        self.vintages = [(start + timedelta(days=i)).isoformat() for i in range(n_vintages)]
        # one observation per vintage, dated the business day before its release
        self.obs = [{"date": (date.fromisoformat(v) - timedelta(days=1)).isoformat(),
                     "realtime_start": v, "value": str(1.0 + i / 1000)}
                    for i, v in enumerate(self.vintages)]
        self.obs.append({"date": "1989-12-30", "realtime_start": self.vintages[0],
                         "value": "."})  # FRED's missing value marker
        self.calls: list[dict] = []

    def __call__(self, url, params=None, retries=3, pause=0.0):
        self.calls.append(dict(params))
        if url.endswith("/vintagedates"):
            off, lim = params.get("offset", 0), params.get("limit", 10000)
            return Response({"vintage_dates": self.vintages[off:off + lim]})
        assert url.endswith("/observations")
        start = params.get("realtime_start", TODAY)
        end = params.get("realtime_end", TODAY)
        inside = [v for v in self.vintages if start <= v <= end]
        if not inside:
            raise RuntimeError("400 No vintage dates exist for the specified real-time period")
        if len(inside) > 2000:
            raise RuntimeError("400 exceeds the maximum number of vintage dates (2000)")
        return Response({"observations": [o for o in self.obs
                                          if start <= o["realtime_start"] <= end]})


class Response:
    def __init__(self, body):
        self.body = body

    def json(self):
        return self.body


@pytest.fixture
def key(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", "testkey")


def series(invert=False):
    return Series(key="fx.TEST", source="fred", code="DEXTEST", description="test",
                  invert=invert)


def test_small_series_is_fetched_over_its_whole_history(monkeypatch, key):
    fred = FakeFred(660)
    monkeypatch.setattr(sources, "_get", fred)
    out = sources.fetch_fred_initial(series())
    assert len(out) == 660
    assert out["available_at"].min() == pd.Timestamp(fred.vintages[0])
    assert out["available_at"].max() == pd.Timestamp(fred.vintages[-1])
    obs_calls = [c for c in fred.calls if c.get("output_type") == 4]
    assert [(c["realtime_start"], c["realtime_end"]) for c in obs_calls] == \
        [(fred.vintages[0], fred.vintages[-1])]


def test_long_series_is_split_into_windows_fred_accepts(monkeypatch, key):
    fred = FakeFred(5144)  # DTB3 had 5,144 vintages on 2026-11-05
    monkeypatch.setattr(sources, "_get", fred)
    out = sources.fetch_fred_initial(series())
    assert len(out) == 5144
    assert not out.duplicated(["date", "available_at"]).any()
    windows = [(c["realtime_start"], c["realtime_end"])
               for c in fred.calls if c.get("output_type") == 4]
    assert len(windows) == 3
    assert windows[0][0] == fred.vintages[0] and windows[-1][1] == fred.vintages[-1]
    for (_, end), (start, _) in zip(windows, windows[1:], strict=False):
        assert end < start  # disjoint, so no release is fetched twice


def test_vintage_dates_are_paged(monkeypatch, key):
    fred = FakeFred(12001)
    monkeypatch.setattr(sources, "_get", fred)
    windows = sources._fred_realtime_windows("DEXTEST", "testkey")
    offsets = [c["offset"] for c in fred.calls]
    assert offsets == [0, 10000]
    assert windows[-1][1] == fred.vintages[-1]
    assert len(windows) == 7


def test_values_are_inverted_and_missing_markers_dropped(monkeypatch, key):
    fred = FakeFred(3)
    monkeypatch.setattr(sources, "_get", fred)
    out = sources.fetch_fred_initial(series(invert=True))
    assert len(out) == 3
    assert out["value"].iloc[0] == pytest.approx(1.0)
    assert out["value"].iloc[2] == pytest.approx(1 / 1.002)


def test_no_key_is_skipped_not_failed(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    with pytest.raises(sources.MissingKey):
        sources.fetch_fred_initial(series())
