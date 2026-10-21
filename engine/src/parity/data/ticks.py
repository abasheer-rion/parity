"""FX tick data with integer nanosecond timestamps.

No free tick source we checked clearly allows automated downloads (see
docs/reference/0010-fx-data-sources-licences-and-resolution.md):

  * Dukascopy's terms ban any "scraper, robot, bot, spider" and limit use to
    personal, non-commercial downloads.
  * TrueFX needs a login, and its terms are behind it.
  * HistData offers free files through its download pages but grants no licence
    for automated use and sells FTP access as a paid service.

So this module has a `TickSource` interface for a future licensed feed, plus an
importer for files a person downloaded by hand. Imported ticks are stored per pair
and per UTC day at data/ticks/<PAIR>/<YYYY-MM-DD>.parquet.

Schema (TICK_COLUMNS):

    ts_ns     int64    nanoseconds since 1970-01-01 UTC. Millisecond sources leave the
                       last six digits zero, so nanosecond feeds (CME via Databento)
                       fit later with no change.
    bid, ask  float64
    volume    float64  as the source reports it (often 0 for FX quotes), NaN if absent
    source    string   "histdata", "truefx" or "csv"
"""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Protocol

import pandas as pd

from . import store

TICK_COLUMNS = ["ts_ns", "bid", "ask", "volume", "source"]
NS_PER_MS = 1_000_000
HISTDATA_UTC_OFFSET = pd.Timedelta(hours=5)  # EST all year, no daylight saving


class TickSource(Protocol):
    """A feed that can return one UTC day of ticks for a pair."""

    name: str
    resolution_ns: int  # 1_000_000 for millisecond sources, 1 for nanosecond ones

    def fetch(self, pair: str, date: str) -> pd.DataFrame: ...


def normalise_pair(pair: str) -> str:
    """'eur/usd', 'EUR-USD' and 'EURUSD' all become 'EURUSD'. Anything that is not two
    three letter codes is refused, which also keeps file paths safe."""
    clean = re.sub(r"[/\-_ ]", "", pair).upper()
    if not re.fullmatch(r"[A-Z]{6}", clean):
        raise ValueError(f"Not a currency pair: {pair!r}. Use six letters like EURUSD.")
    return clean


def _to_ns(stamps: pd.Series) -> pd.Series:
    return stamps.dt.as_unit("ns").astype("int64")


def _frame(ts_ns, bid, ask, volume, source: str) -> pd.DataFrame:
    df = pd.DataFrame({"ts_ns": ts_ns.astype("int64").to_numpy(),
                       "bid": pd.to_numeric(bid).astype(float).to_numpy(),
                       "ask": pd.to_numeric(ask).astype(float).to_numpy(),
                       "volume": pd.to_numeric(volume).astype(float).to_numpy()})
    df["source"] = source
    return df.sort_values("ts_ns", kind="stable").reset_index(drop=True)[TICK_COLUMNS]


def parse_histdata(text: str) -> pd.DataFrame:
    """HistData Generic ASCII ticks: `20120201 000003660,1.306600,1.306770,0`
    (YYYYMMDD HHMMSSmmm in EST without daylight saving, bid, ask, volume)."""
    raw = pd.read_csv(io.StringIO(text), header=None, names=["dt", "bid", "ask", "volume"],
                      dtype={"dt": str})
    est = pd.to_datetime(raw["dt"], format="%Y%m%d %H%M%S%f")
    return _frame(_to_ns(est + HISTDATA_UTC_OFFSET), raw["bid"], raw["ask"], raw["volume"],
                  "histdata")


def parse_truefx(text: str) -> pd.DataFrame:
    """TrueFX monthly files: `EUR/USD,20240102 00:00:00.123,1.10432,1.10441`
    (pair, UTC timestamp in milliseconds, bid, ask)."""
    raw = pd.read_csv(io.StringIO(text), header=None, names=["pair", "dt", "bid", "ask"],
                      dtype={"dt": str})
    utc = pd.to_datetime(raw["dt"], format="%Y%m%d %H:%M:%S.%f")
    return _frame(_to_ns(utc), raw["bid"], raw["ask"], pd.Series([float("nan")] * len(raw)),
                  "truefx")


def parse_csv(text: str) -> pd.DataFrame:
    """Our own format, for anything else: a header row with ts_ns,bid,ask[,volume]."""
    raw = pd.read_csv(io.StringIO(text))
    vol = raw["volume"] if "volume" in raw else pd.Series([float("nan")] * len(raw))
    return _frame(raw["ts_ns"], raw["bid"], raw["ask"], vol, "csv")


PARSERS = {"histdata": parse_histdata, "truefx": parse_truefx, "csv": parse_csv}


def detect_format(text: str) -> str:
    first = text.lstrip().splitlines()[0] if text.strip() else ""
    if first.startswith("ts_ns"):
        return "csv"
    if re.match(r"^[A-Z]{3}/[A-Z]{3},\d{8} \d{2}:\d{2}:\d{2}", first):
        return "truefx"
    if re.match(r"^\d{8} \d{9},", first):
        return "histdata"
    raise ValueError("Could not tell the file format; pass --format histdata|truefx|csv")


def read_file(path: Path) -> str:
    """Plain text, or the first .csv/.txt inside a zip (HistData and TrueFX ship zips)."""
    path = Path(path)
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.lower().endswith((".csv", ".txt"))]
            if not names:
                raise ValueError(f"No .csv or .txt file inside {path}")
            return z.read(names[0]).decode("utf-8", errors="replace")
    return path.read_text(encoding="utf-8", errors="replace")


def _day_path(pair: str, day: str, root: Path) -> Path:
    return root / "ticks" / pair / f"{day}.parquet"


def import_file(path: Path, pair: str, fmt: str = "auto",
                root: Path = store.DEFAULT_DIR) -> list[dict]:
    """Parse a hand-downloaded file and store it as one parquet file per UTC day.
    Existing days are merged and de-duplicated, so importing twice is harmless."""
    pair = normalise_pair(pair)
    text = read_file(path)
    fmt = detect_format(text) if fmt == "auto" else fmt
    ticks = PARSERS[fmt](text)
    days = pd.to_datetime(ticks["ts_ns"], unit="ns").dt.strftime("%Y-%m-%d")
    report = []
    for day, part in ticks.groupby(days, sort=True):
        out = _day_path(pair, day, root)
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists():
            part = pd.concat([pd.read_parquet(out), part], ignore_index=True)
        part = part.drop_duplicates().sort_values("ts_ns", kind="stable")
        part.reset_index(drop=True).to_parquet(out, index=False)
        report.append({"pair": pair, "date": day, "rows": int(len(part)), "path": str(out)})
    return report


def load(pair: str, date: str, root: Path = store.DEFAULT_DIR,
         source: TickSource | None = None) -> pd.DataFrame:
    """One UTC day of ticks. Reads the local store; with a licensed `source` it fetches
    and stores the day first if it is missing."""
    pair = normalise_pair(pair)
    day = pd.Timestamp(date).strftime("%Y-%m-%d")
    path = _day_path(pair, day, root)
    if not path.exists() and source is not None:
        fetched = source.fetch(pair, day)
        path.parent.mkdir(parents=True, exist_ok=True)
        fetched[TICK_COLUMNS].to_parquet(path, index=False)
    if not path.exists():
        raise FileNotFoundError(
            f"No ticks stored for {pair} on {day}. Download the month by hand (for example "
            f"from histdata.com) and run: parity ticks {pair} --date {day} --import <file>")
    return pd.read_parquet(path)


def summary(ticks: pd.DataFrame) -> dict:
    if ticks.empty:
        return {"rows": 0}
    spread = ticks["ask"] - ticks["bid"]
    gaps = ticks["ts_ns"].diff().dropna()
    return {
        "rows": int(len(ticks)),
        "first": pd.Timestamp(int(ticks["ts_ns"].iloc[0]), unit="ns", tz="UTC").isoformat(),
        "last": pd.Timestamp(int(ticks["ts_ns"].iloc[-1]), unit="ns", tz="UTC").isoformat(),
        "median_spread": float(spread.median()),
        "median_gap_ms": float(gaps.median() / NS_PER_MS) if len(gaps) else None,
        "sources": sorted(ticks["source"].unique().tolist()),
    }
