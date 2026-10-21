"""Local cache of raw series and the daily panel that strategies read.

Raw downloads are saved as parquet under data/raw/<source>/<code>.parquet so a
backtest never depends on the network once the cache is warm. The data folder is
ignored by git; the scheduled research run keeps its own copy in the Actions cache.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from . import catalog, sources

DEFAULT_DIR = Path(os.environ.get("PARITY_DATA_DIR", Path(__file__).resolve().parents[3] / "data"))


def _path(series: catalog.Series, root: Path) -> Path:
    return root / "raw" / series.source / f"{series.code}.parquet"


def refresh(keys: list[str] | None = None, root: Path = DEFAULT_DIR) -> list[dict]:
    """Download each series and overwrite its cache file. Returns a coverage report."""
    keys = keys or list(catalog.CATALOG)
    report = []
    for key in keys:
        series = catalog.get(key)
        entry = {"key": key, "source": series.source, "code": series.code}
        try:
            data = sources.fetch(series)
            path = _path(series, root)
            path.parent.mkdir(parents=True, exist_ok=True)
            data.to_frame().to_parquet(path)
            entry.update(_describe(data), ok=True)
        except Exception as exc:  # keep going; one dead source should not stop the run
            entry.update(ok=False, error=str(exc))
        report.append(entry)
    root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).isoformat(timespec="seconds")
    (root / "coverage.json").write_text(json.dumps({"fetched_at": stamp, "series": report},
                                                   indent=2))
    return report


def _describe(data: pd.Series) -> dict:
    return {
        "first": data.index.min().date().isoformat(),
        "last": data.index.max().date().isoformat(),
        "rows": int(data.size),
    }


def load(key: str, root: Path = DEFAULT_DIR) -> pd.Series:
    series = catalog.get(key)
    path = _path(series, root)
    if not path.exists():
        raise FileNotFoundError(f"No cached data for {key}. Run `parity fetch` first.")
    return pd.read_parquet(path).iloc[:, 0].rename(key)


def panel(keys: list[str], root: Path = DEFAULT_DIR, ffill_limit: int = 5) -> pd.DataFrame:
    """Align series on business days.

    Daily series are forward filled for a few days to cover holidays. Monthly series
    (rates, copper) are forward filled without limit because they only change once
    a month; their staleness shows up on the Data page instead.
    """
    frames = {k: load(k, root) for k in keys}
    start = min(s.index.min() for s in frames.values())
    end = max(s.index.max() for s in frames.values())
    index = pd.bdate_range(start, end)
    out = {}
    for key, s in frames.items():
        s = s[~s.index.duplicated(keep="last")].sort_index()
        aligned = s.reindex(index.union(s.index)).sort_index()
        limit = None if catalog.get(key).frequency == "M" else ffill_limit
        out[key] = aligned.ffill(limit=limit).reindex(index)
    return pd.DataFrame(out, index=index)


def coverage(root: Path = DEFAULT_DIR) -> dict:
    path = root / "coverage.json"
    return json.loads(path.read_text()) if path.exists() else {"fetched_at": None, "series": []}
