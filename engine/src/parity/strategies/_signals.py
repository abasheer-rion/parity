"""Signals from the wider data (DEC-0027), shared by the factory recipes in edges.py and
the always-on search.

Every function reads the panel up to each date only. Publication lags live in the
catalog (`lag_days`, `published_after`), so a value appears in the panel on the day it
could first be read. A few signals add one more business day where the release lands
after the price we trade at; each says why.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.catalog import XFX
from ..data.fomc import FOMC_DAYS
from ._util import zscore

#: Currencies with both a CFTC futures contract and a daily dollar price (fx.*).
COT_FX = ["EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD", "MXN", "BRL", "ZAR"]
#: Currencies crossed from ECB rates that have a BIS policy rate, and the G10 among them.
XWIDE = [f"xfx.{c}" for c in XFX]
XG10 = [f"xfx.{c}" for c in ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK"]]
TBILL = "rate.TBILL3M"


def cot_keys(names: list[str]) -> list[str]:
    return [f"cot.{n}_PCT" for n in names]


def cot_z(panel: pd.DataFrame, names: list[str], window: int) -> pd.DataFrame:
    """Speculators' net position (percent of open interest) as a z-score against its own
    past `window` business days, one column per name.

    The catalog already moves Tuesday's positions to Friday, the release day. The CFTC
    releases at 15:30 New York time, after the noon fixing behind our dollar prices, so
    this acts one business day later still."""
    pos = panel[cot_keys(names)]
    pos.columns = names
    return zscore(pos, window).shift(1)


def ccy(col: str) -> str:
    return col.split(".", 1)[1]


def policy_keys(universe: list[str]) -> list[str]:
    return [f"policy.{ccy(c)}" for c in universe] + ["policy.USD"]


def policy_gap(panel: pd.DataFrame, universe: list[str]) -> pd.DataFrame:
    """Policy rate minus the US policy rate, percentage points (BIS). Central banks
    announce before or on the day a new rate takes effect, so no lag is needed."""
    return pd.DataFrame({c: panel[f"policy.{ccy(c)}"] - panel["policy.USD"]
                         for c in universe})


def policy_change(panel: pd.DataFrame, universe: list[str], lookback: int) -> pd.DataFrame:
    """Change in each policy rate over `lookback` business days: hikers score high.
    Most banks do nothing in most windows, so the rate gap breaks ties (it is at most
    a few hundredths here, below the smallest real move of 0.25)."""
    move = pd.DataFrame({c: panel[f"policy.{ccy(c)}"].diff(lookback) for c in universe})
    return move + policy_gap(panel, universe) * 1e-3


def curve(panel: pd.DataFrame, tenor: str) -> pd.Series:
    return panel[f"curve.UST_{tenor}"]


def butterfly(panel: pd.DataFrame) -> pd.Series:
    """Curvature of the Treasury curve: how high the 5-year yield sits above the line
    between the 2-year and the 10-year."""
    return 2 * curve(panel, "5Y") - curve(panel, "2Y") - curve(panel, "10Y")


# --- the FOMC calendar ---------------------------------------------------------------
# The dates are a fixed, pre-announced schedule, so these are functions of the date
# alone. Weights at the close of day t are held over the next business day t+1, so
# each rule asks about t+1.

_BDAYS = pd.bdate_range("1993-01-01", "2028-12-31")
_POS = pd.Series(np.arange(len(_BDAYS)), index=_BDAYS)
_FOMC_POS = np.sort(_POS.reindex(FOMC_DAYS).dropna().astype(int).to_numpy())


def _next_bday_pos(index: pd.DatetimeIndex) -> np.ndarray:
    nxt = index + pd.offsets.BDay(1)
    return _POS.reindex(nxt).to_numpy()


def pre_fomc(index: pd.DatetimeIndex) -> pd.Series:
    """True on the day before a scheduled FOMC announcement, so the position is held
    over announcement day (close to close; Lucca and Moench measure 2pm to 2pm)."""
    nxt = index + pd.offsets.BDay(1)
    return pd.Series(nxt.isin(FOMC_DAYS), index=index)


def fomc_week(index: pd.DatetimeIndex) -> pd.Series:
    """FOMC cycle week of the next business day (Cieslak, Morse and Vissing-Jorgensen):
    week 0 runs from the day before an announcement to three days after, week 1 the
    five days after that, and so on. NaN outside the calendar."""
    pos = _next_bday_pos(index)
    out = np.full(len(index), np.nan)
    ok = ~np.isnan(pos)
    p = pos[ok].astype(int)
    last = np.searchsorted(_FOMC_POS, p, side="right") - 1
    nxt = np.minimum(last + 1, len(_FOMC_POS) - 1)
    since = np.where(last >= 0, p - _FOMC_POS[np.maximum(last, 0)], np.nan)
    week = np.floor((since + 1) / 5)
    week = np.where(_FOMC_POS[nxt] - p == 1, 0.0, week)  # the day before the next one
    out[ok] = week
    return pd.Series(out, index=index)


_YM = pd.Series(np.arange(len(_BDAYS)), index=_BDAYS)
_FIRST = _YM.groupby([_BDAYS.year, _BDAYS.month]).min()
_LAST = _YM.groupby([_BDAYS.year, _BDAYS.month]).max()


def turn_of_year(index: pd.DatetimeIndex, days: int) -> pd.Series:
    """True when the next business day is among the last `days` business days of
    December or the first `days` of January."""
    nxt = pd.DatetimeIndex(index + pd.offsets.BDay(1))
    pos = _POS.reindex(nxt).to_numpy()
    out = np.zeros(len(index), dtype=bool)
    for i, (p, d) in enumerate(zip(pos, nxt, strict=True)):
        if np.isnan(p) or d.month not in (1, 12):
            continue
        if d.month == 12:
            out[i] = _LAST[(d.year, 12)] - p < days
        else:
            out[i] = p - _FIRST[(d.year, 1)] < days
    return pd.Series(out, index=index)
