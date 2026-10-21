"""How big the currency market is: BIS Triennial Central Bank Survey turnover.

Every three years (1989 on, latest April 2025) central banks count FX trading in April
and the BIS publishes the daily average. We read it from the official BIS SDMX API
(dataflow WS_DER_OTC_TOV, "OTC derivatives and FX spot - turnover"). The BIS terms
allow reuse when the BIS is cited as the source, the use is not misleading and does
not imply endorsement. See catalog/datasets/bis-triennial-fx.json.

The series key we ask for is fixed:

    A    annual (one value per survey year)
    U    turnover, notional amounts, daily average in April
    *    every instrument (spot, forwards, swaps, options, total)
    B    foreign exchange risk
    5J   all reporting countries
    A    all counterparties
    5J   all counterparty countries
    A    all underlying sectors
    *    every currency (leg 1), TO1 is the all-currency total
    TO1  against all currencies (leg 2)
    A    all maturities
    A    all settlement types
    3    all execution methods
    C    net-net (each trade counted once, the BIS headline basis)

Output columns: year, currency, instrument, instrument_name, turnover_usd_mn
(US dollars, millions, per day), share_pct. A trade has two currencies, so the shares
of all currencies add up to 200%, the same convention the BIS uses.
"""

from __future__ import annotations

import io
from pathlib import Path

import pandas as pd

from . import store

API = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_DER_OTC_TOV/1.0"
KEY = "A.U.*.B.5J.A.5J.A.*.TO1.A.A.3.C"
URL = f"{API}/{KEY}?format=csv"

INSTRUMENTS = {
    "A": "Total (all instruments)",
    "B": "Spot",
    "E": "Outright forwards",
    "G": "Non-deliverable forwards",
    "H": "FX swaps",
    "I": "Currency swaps",
    "R": "Options",
    "Z": "Other instruments",
}
TOTAL = "TO1"  # BIS code for "all currencies"
COLUMNS = ["year", "currency", "instrument", "instrument_name", "turnover_usd_mn", "share_pct"]


def parse_bis_csv(text: str) -> pd.DataFrame:
    raw = pd.read_csv(io.StringIO(text))
    raw = raw[raw["DER_INSTR"].isin(INSTRUMENTS)].dropna(subset=["OBS_VALUE"])
    for col, want in (("DER_RATING", "A"), ("DER_BASIS", "C"), ("DER_CURR_LEG2", TOTAL)):
        if col in raw:  # the API key already fixes these; this guards wider downloads
            raw = raw[raw[col].astype(str) == want]
    mult = 10.0 ** (raw["UNIT_MULT"].astype(int) - 6)  # BIS gives millions (UNIT_MULT 6)
    df = pd.DataFrame({
        "year": raw["TIME_PERIOD"].astype(int),
        "currency": raw["DER_CURR_LEG1"].astype(str),
        "instrument": raw["DER_INSTR"].astype(str),
        "turnover_usd_mn": raw["OBS_VALUE"].astype(float) * mult,
    })
    df["instrument_name"] = df["instrument"].map(INSTRUMENTS)
    totals = (df[df["currency"] == TOTAL].set_index(["year", "instrument"])["turnover_usd_mn"])
    idx = pd.MultiIndex.from_frame(df[["year", "instrument"]])
    df["share_pct"] = (df["turnover_usd_mn"].to_numpy() / totals.reindex(idx).to_numpy()) * 100
    df.loc[df["currency"] == TOTAL, "share_pct"] = 200.0
    df = df.sort_values(["year", "instrument", "turnover_usd_mn"],
                        ascending=[True, True, False], kind="stable")
    return df[COLUMNS].reset_index(drop=True)


def _path(root: Path) -> Path:
    return root / "reference" / "bis_fx_turnover.parquet"


def refresh(root: Path = store.DEFAULT_DIR) -> pd.DataFrame:
    from .sources import _get

    table = parse_bis_csv(_get(URL).text)
    _path(root).parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(_path(root), index=False)
    return table


def load(root: Path = store.DEFAULT_DIR, refresh_cache: bool = False) -> pd.DataFrame:
    path = _path(root)
    return refresh(root) if refresh_cache or not path.exists() else pd.read_parquet(path)


def query(table: pd.DataFrame, year: int | None = None, currency: str | None = None,
          instrument: str | None = "A") -> pd.DataFrame:
    """Filter the table. Defaults: latest survey year, all instruments combined."""
    out = table
    year = year or int(table["year"].max())
    out = out[out["year"] == year]
    if currency:
        out = out[out["currency"] == currency.upper()]
    if instrument:
        out = out[out["instrument"] == instrument.upper()]
    return out.reset_index(drop=True)
