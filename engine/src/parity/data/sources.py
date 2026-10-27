"""Downloaders. Each returns a pandas Series indexed by date, named by the catalog key.

We only use sources that are free and allow scripted access. Stooq was tried and
now sits behind a browser check, so it is not used. Yahoo's chart endpoint is
unofficial; treat it as a convenience that can break without notice.

The wider official sources (REF-0015) are the ECB, the BIS, the US Treasury, the CFTC
and the EIA. Each asks for one request per data set where it can, pauses between
requests and sends our own user agent. Keyed sources read their key with `api_key()`,
which raises `MissingKey` when it is not set; error messages never show a key.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import time

import pandas as pd
import requests

from .catalog import Series

USER_AGENT = "parity-research/0.1 (private research project)"
TIMEOUT = 30

#: Query parameters that carry a key. Their values are blanked in every error message.
SECRET_PARAMS = ("api_key", "apikey", "token", "api_token", "access_key", "key")


class MissingKey(Exception):
    """A keyed source whose key is not set. The series is skipped, not failed."""


def api_key(env: str) -> str:
    """Read a provider key from the environment, never from code or files in the repo.

    The owner fills these from the macOS Keychain, for example
    `export EIA_API_KEY=$(security find-generic-password -s EIA_API_KEY -w)`.
    The value is never printed or logged.
    """
    value = os.environ.get(env, "").strip()
    if not value:
        raise MissingKey(f"{env} is not set, so this keyed source was skipped")
    return value


def redact(text: str, params: dict | None = None) -> str:
    """Remove key values from a message, whether they came from params or a URL."""
    for name, value in (params or {}).items():
        if name.lower() in SECRET_PARAMS and value:
            text = text.replace(str(value), "***")
    pattern = "|".join(SECRET_PARAMS)
    return re.sub(rf"(?i)\b({pattern})=[^&\s'\"]+", r"\1=***", text)


def _get(url: str, params: dict | None = None, retries: int = 3,
         pause: float = 0.0) -> requests.Response:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            if pause:
                time.sleep(pause)  # stay well inside each provider's rate limit
            resp = requests.get(url, params=params, timeout=TIMEOUT,
                                headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:  # network blips are common on free endpoints
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(redact(f"Failed to fetch {url}: {last}", params))


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


ALPACA_BARS = "https://data.alpaca.markets/v2/stocks/bars"


def fetch_alpaca(series: Series) -> pd.Series:
    """Daily bars for one US stock or ETF from Alpaca's market data API, adjusted for
    splits and dividends, since 2016 (DEC-0075). Research only: the values feed
    statistics and backtests and are never shown. Needs the team's ALPACA_KEY_ID and
    ALPACA_SECRET_KEY; without them the series is skipped. The free plan allows 200 calls
    a minute; we pause between pages."""
    headers = {"APCA-API-KEY-ID": api_key("ALPACA_KEY_ID"),
               "APCA-API-SECRET-KEY": api_key("ALPACA_SECRET_KEY"),
               "User-Agent": USER_AGENT}
    params = {"symbols": series.code, "timeframe": "1Day", "start": "2016-01-01",
              "adjustment": "all", "feed": "sip", "limit": 10000}
    pages: list[dict] = []
    for _ in range(50):
        time.sleep(0.4)
        try:
            resp = requests.get(ALPACA_BARS, params=params, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as exc:  # never echo the headers
            raise RuntimeError(f"Alpaca bars for {series.code} failed: "
                               f"{type(exc).__name__}") from None
        payload = resp.json()
        pages.append(payload)
        token = payload.get("next_page_token")
        if not token:
            break
        params["page_token"] = token
    return parse_alpaca_bars(pages, series)


def parse_alpaca_bars(pages: list[dict], series: Series) -> pd.Series:
    """Closing prices from one or more pages of Alpaca's multi-symbol bars response."""
    rows = []
    for page in pages:
        for bar in (page.get("bars") or {}).get(series.code, []) or []:
            rows.append((bar["t"][:10], float(bar["c"])))
    if not rows:
        raise ValueError(f"No Alpaca bars for {series.code}")
    out = pd.Series([r[1] for r in rows], index=pd.to_datetime([r[0] for r in rows]))
    out = out[~out.index.duplicated(keep="last")].sort_index()
    return out.rename(series.key)


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
    file, _, column = series.code.partition("#")
    text = _french_file(file)
    return parse_french_column(text, series, column) if column else parse_french_daily(text, series)


_FRENCH_CACHE: dict[str, str] = {}


def _french_file(file: str) -> str:
    """Download one French zip once per process; several series share a file."""
    import zipfile

    if file not in _FRENCH_CACHE:
        url = f"https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/{file}_CSV.zip"
        with zipfile.ZipFile(io.BytesIO(_get(url).content)) as z:
            _FRENCH_CACHE[file] = z.read(z.namelist()[0]).decode("latin-1")
    return _FRENCH_CACHE[file]


def parse_french_column(text: str, series: Series, column: str) -> pd.Series:
    """One column of a daily French file, as an index starting at 1.

    French files hold several tables one after another (value-weighted first, then
    equal-weighted and others). Only the first table under the first header that names
    the column is read. Values are percent returns; -99.99 and -999 mean missing.
    """
    header: list[str] | None = None
    rows = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if header is None:
            if column in parts:
                header = parts
            continue
        if len(parts) >= 2 and parts[0].isdigit() and len(parts[0]) == 8:
            rows.append((parts[0], parts[header.index(column)]))
        elif rows:
            break  # end of the first table
    if header is None:
        raise ValueError(f"Column {column} not found")
    dates = pd.to_datetime([r[0] for r in rows], format="%Y%m%d")
    vals = pd.Series([float(r[1]) for r in rows], index=dates)
    vals = vals.where(vals > -99, 0.0) / 100
    return (1 + vals).cumprod().rename(series.key)


def parse_french_daily(text: str, series: Series) -> pd.Series:
    rows = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 5 and parts[0].isdigit() and len(parts[0]) == 8:
            rows.append((parts[0], float(parts[1]) + float(parts[4])))
    dates = pd.to_datetime([r[0] for r in rows], format="%Y%m%d")
    total = pd.Series([r[1] / 100 for r in rows], index=dates)
    return (1 + total).cumprod().rename(series.key)


# ---------------------------------------------------------------- SDMX: ECB and BIS
#
# Both publish SDMX CSV. One request per dataflow fetches every catalog series in it:
# the key asks for each dimension's values joined by "+", and the parser keeps only
# the exact keys we want. Results are cached for the life of the process.

ECB_API = "https://data-api.ecb.europa.eu/service/data"
BIS_API = "https://stats.bis.org/api/v2/data/dataflow/BIS"

_SDMX_CACHE: dict[tuple[str, str], dict[str, pd.Series]] = {}


def merged_key(keys: list[str]) -> str:
    """'D.USD.EUR.SP00.A' and 'D.JPY.EUR.SP00.A' give 'D.USD+JPY.EUR.SP00.A'."""
    parts = [k.split(".") for k in keys]
    width = len(parts[0])
    if any(len(p) != width for p in parts):
        raise ValueError(f"Keys of different shapes cannot share a request: {keys}")
    dims = []
    for i in range(width):
        seen = list(dict.fromkeys(p[i] for p in parts))
        dims.append("+".join(seen))
    return ".".join(dims)


def _sdmx_table(provider: str, flow: str) -> dict[str, pd.Series]:
    from .catalog import CATALOG

    if (provider, flow) not in _SDMX_CACHE:
        keys = [s.code.split("/", 1)[1] for s in CATALOG.values()
                if s.source == provider and s.code.split("/", 1)[0] == flow]
        key = merged_key(keys)
        if provider == "ecb":
            resp = _get(f"{ECB_API}/{flow}/{key}", {"format": "csvdata", "detail": "dataonly"})
        else:
            resp = _get(f"{BIS_API}/{flow}/1.0/{key}", {"format": "csv", "detail": "dataonly"})
        _SDMX_CACHE[(provider, flow)] = split_sdmx_csv(resp.text)
    return _SDMX_CACHE[(provider, flow)]


def split_sdmx_csv(text: str) -> dict[str, pd.Series]:
    """An SDMX CSV file (ECB 'csvdata' or BIS 'csv') as one series per key.

    The dimension columns are the ones before TIME_PERIOD, apart from the ECB's
    combined KEY column. Joined with dots they give the series key used in our codes,
    such as 'D.USD.EUR.SP00.A'.
    """
    df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    cols = list(df.columns)
    dims = [c for c in cols[:cols.index("TIME_PERIOD")] if c != "KEY"]
    keys = df[dims[0]].str.cat(df[dims[1:]], sep=".") if len(dims) > 1 else df[dims[0]]
    values = pd.to_numeric(df["OBS_VALUE"], errors="coerce")
    dates = pd.to_datetime(df["TIME_PERIOD"])
    out = {}
    for key, idx in keys.groupby(keys).groups.items():
        s = pd.Series(values[idx].to_numpy(), index=dates[idx].to_numpy()).dropna()
        s = s.sort_index()
        out[key] = s[~s.index.duplicated(keep="last")]
    return out


def sdmx_series(table: dict[str, pd.Series], series: Series) -> pd.Series:
    want = series.code.split("/", 1)[1]
    if want not in table or table[want].empty:
        raise ValueError(f"{series.code} has no values in the response")
    return table[want].rename(series.key)


def fetch_ecb(series: Series) -> pd.Series:
    """ECB Data Portal. Reuse is allowed with the ECB named as the source."""
    return sdmx_series(_sdmx_table("ecb", series.code.split("/", 1)[0]), series)


def fetch_bis(series: Series) -> pd.Series:
    """BIS data portal. Reuse is allowed with the BIS named as the source."""
    return sdmx_series(_sdmx_table("bis", series.code.split("/", 1)[0]), series)


# ---------------------------------------------------------------- US Treasury yield curve

TREASURY_CSV = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
                "daily-treasury-rates.csv/{year}/all")
TREASURY_FIRST_YEAR = 1990
_TREASURY_CACHE: dict[str, pd.DataFrame] = {}


def parse_treasury_csv(text: str) -> pd.DataFrame:
    """One year of the daily par yield curve: a date index and one column per tenor."""
    df = pd.read_csv(io.StringIO(text), na_values=["N/A", ""])
    df.index = pd.to_datetime(df.pop("Date"), format="%m/%d/%Y")
    return df.astype(float).sort_index()


def treasury_curve() -> pd.DataFrame:
    """Every year from 1990 to now, one polite request a second, cached per process.
    Treasury blocks a single request for all years, so we ask year by year."""
    if "curve" not in _TREASURY_CACHE:
        years = range(TREASURY_FIRST_YEAR, pd.Timestamp.now().year + 1)
        frames = [parse_treasury_csv(_get(
            TREASURY_CSV.format(year=y),
            {"type": "daily_treasury_yield_curve", "field_tdr_date_value": y, "page": "",
             "_format": "csv"}, pause=1.0).text) for y in years]
        _TREASURY_CACHE["curve"] = pd.concat(frames).sort_index()
    return _TREASURY_CACHE["curve"]


def curve_column(curve: pd.DataFrame, series: Series) -> pd.Series:
    if series.code not in curve:
        raise ValueError(f"Treasury column {series.code!r} not found")
    out = curve[series.code].dropna().rename(series.key)
    return out[~out.index.duplicated(keep="last")]


def fetch_treasury(series: Series) -> pd.Series:
    """US Treasury daily par yield curve. US government work, public domain."""
    return curve_column(treasury_curve(), series)


# ---------------------------------------------------------------- CFTC Commitments of Traders

COT_API = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"  # legacy, futures only
COT_FIELDS = ["report_date_as_yyyy_mm_dd", "open_interest_all", "noncomm_positions_long_all",
              "noncomm_positions_short_all"]
_COT_CACHE: dict[str, list[dict]] = {}


def parse_cot_json(rows: list[dict], series: Series) -> pd.Series:
    """Speculators' (non-commercial) net position, in contracts or as a percent of
    open interest when the code ends in '#pct'. Dated the Tuesday it describes."""
    _, _, kind = series.code.partition("#")
    df = pd.DataFrame(rows, columns=COT_FIELDS)
    date = pd.to_datetime(df["report_date_as_yyyy_mm_dd"].str[:10])
    num = df[COT_FIELDS[1:]].apply(pd.to_numeric, errors="coerce")
    net = num["noncomm_positions_long_all"] - num["noncomm_positions_short_all"]
    if kind == "pct":
        net = 100 * net / num["open_interest_all"].where(num["open_interest_all"] > 0)
    out = pd.Series(net.to_numpy(dtype=float), index=date, name=series.key).dropna()
    out = out.sort_index()
    return out[~out.index.duplicated(keep="last")]


def fetch_cftc(series: Series) -> pd.Series:
    """CFTC Public Reporting (Socrata). No token is needed for reasonable use; we pause
    between requests and fetch each contract once per process."""
    code = series.code.partition("#")[0]
    if code not in _COT_CACHE:
        if not re.fullmatch(r"[0-9A-Z]{6}", code):
            raise ValueError(f"Not a CFTC contract code: {code}")
        _COT_CACHE[code] = _get(COT_API, {
            "$select": ",".join(COT_FIELDS),
            "$where": f"cftc_contract_market_code='{code}'",
            "$order": "report_date_as_yyyy_mm_dd", "$limit": 50000}, pause=0.5).json()
    return parse_cot_json(_COT_CACHE[code], series)


# ---------------------------------------------------------------- EIA (free key)

EIA_API = "https://api.eia.gov/v2/seriesid/{code}"
EIA_KEY_ENV = "EIA_API_KEY"


def parse_eia_json(payload: dict, series: Series) -> pd.Series:
    data = payload.get("response", {}).get("data", [])
    if not data:
        raise ValueError(f"EIA returned no data for {series.code}")
    df = pd.DataFrame(data)
    out = pd.Series(pd.to_numeric(df["value"], errors="coerce").to_numpy(),
                    index=pd.to_datetime(df["period"]), name=series.key).dropna()
    out = out.sort_index()
    return out[~out.index.duplicated(keep="last")]


def fetch_eia(series: Series) -> pd.Series:
    """EIA API v2, through its route for the old series IDs. Needs EIA_API_KEY;
    skipped without it. Public domain."""
    key = api_key(EIA_KEY_ENV)
    resp = _get(EIA_API.format(code=series.code), {"api_key": key}, pause=0.5)
    return parse_eia_json(resp.json(), series)


FETCHERS = {"fred": fetch_fred, "yahoo": fetch_yahoo, "alpaca": fetch_alpaca,
            "french": fetch_french,
            "ecb": fetch_ecb, "bis": fetch_bis, "treasury": fetch_treasury,
            "cftc": fetch_cftc, "eia": fetch_eia}


def fetch(series: Series) -> pd.Series:
    return FETCHERS[series.source](series)
