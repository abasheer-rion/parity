"""Sanity checks, the quality score and the default look-ahead lag (DEC-0064).

The enrolment gate runs these on a candidate's full history; the health check runs the
same checks on the newest stretch of every enrolled series. Each check returns a plain
reason when it fails, so the Candidates page can say why a series waits.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

#: Fewest values a history must have, by frequency.
MIN_HISTORY = {"D": 500, "W": 150, "M": 60, "Q": 24, "A": 10}
#: Longest gap in calendar days that is normal for each frequency (holidays, late releases).
MAX_GAP_DAYS = {"D": 10, "W": 21, "M": 75, "Q": 200, "A": 800}
#: Below this score a candidate waits.
MIN_QUALITY = 0.6
#: A move beyond this many robust standard deviations counts as an outlier.
OUTLIER_Z = 12.0
#: Prices: the longest run of one repeated value that is still normal, in observations.
MAX_FLAT = {"D": 20, "W": 8, "M": 6, "Q": 4, "A": 3}
#: Asset classes whose values are prices, so zero or negative values are errors.
PRICE_LIKE = ("fx", "equity", "commodity", "crypto", "factor", "property")


def default_lag(frequency: str) -> dict:
    """The conservative look-ahead rule (DEC-0027) for a series with none of its own: daily
    values a business day late, weekly ones 5, monthly ones a month after the month ends
    (22 business days, as with the corporate bond yield), quarterly ones 65."""
    return {"D": {"lag_days": 1, "published_after": None},
            "W": {"lag_days": 5, "published_after": None},
            "M": {"lag_days": 0, "published_after": 22},
            "Q": {"lag_days": 0, "published_after": 65},
            "A": {"lag_days": 0, "published_after": 120}}.get(frequency, {"lag_days": 1,
                                                                        "published_after": None})


@dataclass
class Result:
    ok: bool
    quality: float
    reason: str = ""
    checks: dict = field(default_factory=dict)


def _robust_z(x: pd.Series) -> pd.Series:
    med = x.median()
    mad = (x - med).abs().median() * 1.4826
    if not np.isfinite(mad) or mad == 0:
        sd = x.std()
        mad = sd if sd and np.isfinite(sd) else 1.0
    return (x - med).abs() / mad


def longest_run(values: pd.Series) -> int:
    if values.empty:
        return 0
    same = values.ne(values.shift()).cumsum()
    return int(same.value_counts().max())


def sanity(data: pd.Series, frequency: str, asset_class: str, crypto: bool = False,
           today: pd.Timestamp | None = None, full: bool = True) -> Result:
    """Every check on one series. `full` is the enrolment gate (history length included);
    the health check passes False and a recent window."""
    t = pd.Timestamp(today) if today is not None else pd.Timestamp.now(tz="UTC")
    today = (t.tz_convert(None) if t.tzinfo else t).normalize()
    checks: dict = {}
    hard: list[str] = []
    s = data.dropna()
    idx = pd.DatetimeIndex(s.index)
    if idx.tz is not None:
        hard.append("dates carry a time zone; expected plain dates")
    checks["values"] = int(len(s))
    if full and len(s) < MIN_HISTORY.get(frequency, 500):
        hard.append(f"history: {len(s)} values, at least {MIN_HISTORY.get(frequency, 500)} "
                    "needed")
    if len(s) == 0:
        return Result(False, 0.0, hard[0] if hard else "no values", checks)
    future = int((idx > today + pd.Timedelta(days=1)).sum())
    checks["future_dates"] = future
    if future:
        hard.append(f"{future} values dated in the future")
    dups = int(idx.duplicated().sum())
    checks["duplicates"] = dups
    if dups:
        hard.append(f"{dups} duplicate dates")
    if not idx.is_monotonic_increasing:
        hard.append("dates out of order")
    price = asset_class in PRICE_LIKE
    nonpos = int((s <= 0).sum()) if price else 0
    checks["non_positive"] = nonpos
    if nonpos:
        hard.append(f"{nonpos} zero or negative prices")
    # Exchange prices have no weekend values; central banks often publish every calendar day.
    if frequency == "D" and not crypto and price:
        weekend = float((idx.day_of_week >= 5).mean())
        checks["weekend_share"] = round(weekend, 4)
        if weekend > 0.05:
            hard.append(f"{weekend:.0%} of values fall on weekends; the calendar looks wrong")

    penalty = 0.0
    recent = s[s.index >= s.index.max() - pd.DateOffset(years=5)]
    gaps = pd.Series(recent.index).diff().dt.days.dropna()
    allowed = MAX_GAP_DAYS.get(frequency, 10) if not (crypto and frequency == "D") else 3
    long_gaps = int((gaps > allowed).sum())
    checks["long_gaps"] = long_gaps
    checks["longest_gap_days"] = int(gaps.max()) if len(gaps) else 0
    if long_gaps > 2:
        penalty += min(0.3, 0.05 * long_gaps)
    moves = np.log(s[s > 0]).diff().dropna() if price else s.diff().dropna()
    outliers = int((_robust_z(moves) > OUTLIER_Z).sum()) if len(moves) > 20 else 0
    share = outliers / max(len(moves), 1)
    checks["outliers"] = outliers
    if share > 0.005:
        penalty += min(0.4, share * 40)
    flat = longest_run(s) if price else 0
    checks["longest_flat_run"] = flat
    if price and flat > MAX_FLAT.get(frequency, 20):
        penalty += 0.25
    age = (today - idx.max()).days
    checks["last_value_age_days"] = int(age)
    cadence = {"D": 7, "W": 21, "M": 100, "Q": 200, "A": 500}.get(frequency, 7)
    if age > 3 * cadence:
        penalty += 0.5
        checks["stale"] = True
    quality = 0.0 if hard else round(max(0.0, 1.0 - penalty), 3)
    if hard:
        return Result(False, 0.0, hard[0], checks)
    if quality < MIN_QUALITY:
        why = (f"no value for {age} days" if checks.get("stale") else
               f"{outliers} outliers" if share > 0.005 else
               f"{long_gaps} long gaps" if long_gaps > 2 else f"flat for {flat} values")
        return Result(False, quality, f"quality {quality:.2f} below {MIN_QUALITY}: {why}",
                      checks)
    return Result(True, quality, "", checks)


def preview(data: pd.Series, points: int = 260) -> list[list]:
    """A short chart: weekly closes (monthly for long histories), at most `points` values."""
    s = data.dropna()
    if s.empty:
        return []
    rule = "W-FRI" if (s.index.max() - s.index.min()).days < 365 * 6 else "ME"
    w = s.resample(rule).last().dropna().tail(points)
    return [[d.date().isoformat(), float(f"{v:.6g}")] for d, v in w.items()]
