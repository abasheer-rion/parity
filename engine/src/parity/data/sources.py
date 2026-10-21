"""Downloaders. Each returns a pandas Series indexed by date, named by the catalog key.

We only use sources that are free and allow scripted access. Stooq was tried and
now sits behind a browser check, so it is not used. Yahoo's chart endpoint is
unofficial; treat it as a convenience that can break without notice.
"""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import time

import pandas as pd
import requests

from .catalog import Series

USER_AGENT = "parity-research/0.1 (private research project)"
TIMEOUT = 30


def _get(url: str, params: dict | None = None, retries: int = 3) -> requests.Response:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=TIMEOUT,
                                headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:  # network blips are common on free endpoints
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last}")


def fetch_fred(series: Series) -> pd.Series:
    """FRED data, through the official API when FRED_API_KEY is set.

    Without a key we use the public CSV download link. That endpoint stalls for
    Python HTTP clients but answers the curl command line tool, so we call curl
    itself rather than pretend to be it. A free key from
    https://fred.stlouisfed.org/docs/api/api_key.html is the better long-term
    route; see docs/reference/0003-data-sources.md#fred.
    """
    key = os.environ.get("FRED_API_KEY")
    if key:
        resp = _get("https://api.stlouisfed.org/fred/series/observations",
                    {"series_id": series.code, "api_key": key, "file_type": "json"})
        obs = resp.json()["observations"]
        text = "date,value\n" + "\n".join(f"{o['date']},{o['value']}" for o in obs)
        return parse_fred_csv(text, series)
    return parse_fred_csv(_curl(
        f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series.code}"), series)


def _curl(url: str, retries: int = 3) -> str:
    if not shutil.which("curl"):
        raise RuntimeError("curl is not installed; set FRED_API_KEY instead")
    last = ""
    for attempt in range(retries):
        proc = subprocess.run(["curl", "-sSf", "--max-time", str(TIMEOUT), url],
                              capture_output=True, text=True)
        if proc.returncode == 0:
            return proc.stdout
        last = proc.stderr.strip()
        time.sleep(2 ** attempt)
    raise RuntimeError(f"curl failed for {url}: {last}")


def parse_fred_csv(text: str, series: Series) -> pd.Series:
    df = pd.read_csv(io.StringIO(text), na_values=["."])
    date_col = df.columns[0]  # "observation_date" today, "DATE" in older files
    out = pd.Series(df.iloc[:, 1].astype(float).values,
                    index=pd.to_datetime(df[date_col]), name=series.key).dropna()
    if series.invert:
        out = 1.0 / out
    return out


def fetch_yahoo(series: Series) -> pd.Series:
    """Daily adjusted close from Yahoo's chart endpoint."""
    resp = _get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{series.code}",
        {"period1": 0, "period2": int(time.time()), "interval": "1d", "events": "div,split"},
    )
    return parse_yahoo_json(resp.json(), series)


def parse_yahoo_json(payload: dict, series: Series) -> pd.Series:
    result = payload["chart"]["result"][0]
    stamps = pd.to_datetime(result["timestamp"], unit="s").normalize()
    adj = result["indicators"].get("adjclose")
    values = adj[0]["adjclose"] if adj else result["indicators"]["quote"][0]["close"]
    out = pd.Series(values, index=stamps, name=series.key, dtype=float).dropna()
    return out[~out.index.duplicated(keep="last")]


def fetch_french(series: Series) -> pd.Series:
    """Kenneth French's data library: daily US market excess return plus the T-bill
    rate, turned into a total return index starting at 1. Free for research use,
    https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html"""
    import zipfile

    url = ("https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/"
           f"{series.code}_CSV.zip")
    resp = _get(url)
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        text = z.read(z.namelist()[0]).decode("latin-1")
    return parse_french_daily(text, series)


def parse_french_daily(text: str, series: Series) -> pd.Series:
    rows = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 5 and parts[0].isdigit() and len(parts[0]) == 8:
            rows.append((parts[0], float(parts[1]) + float(parts[4])))
    dates = pd.to_datetime([r[0] for r in rows], format="%Y%m%d")
    total = pd.Series([r[1] / 100 for r in rows], index=dates)
    return (1 + total).cumprod().rename(series.key)


FETCHERS = {"fred": fetch_fred, "yahoo": fetch_yahoo, "french": fetch_french}


def fetch(series: Series) -> pd.Series:
    return FETCHERS[series.source](series)
