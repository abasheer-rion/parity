"""Every currency code ever issued under ISO 4217.

SIX Group maintains the ISO 4217 lists for ISO and publishes them as free XML files:

    List One    current currencies and funds
    List Three  historic, withdrawn currencies and funds

Both are static files on six-group.com (robots.txt allows /dam). We download them
with an honest user agent, keep the raw XML, and build one table cached as parquet
at data/reference/iso4217.parquet. Sources and terms: catalog/datasets/iso-4217-six.json.

Columns: code, numeric, name, countries, minor_units, is_fund, status, withdrawn,
list_published. `countries` is a "; " separated list. `withdrawn` is the text the list
gives (usually YYYY-MM, sometimes a range like "1989 to 1990"), empty when current.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd

from . import store

BASE = "https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists"
LIST_ONE_URL = f"{BASE}/list-one.xml"
LIST_THREE_URL = f"{BASE}/list-three.xml"

COLUMNS = ["code", "numeric", "name", "countries", "minor_units", "is_fund", "status",
           "withdrawn", "list_published"]


def _text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    return (child.text or "").strip() if child is not None else ""


def _parse(xml: bytes, entry_tag: str, status: str) -> pd.DataFrame:
    root = ET.fromstring(xml)
    published = root.get("Pblshd", "")
    rows = []
    for e in root.iter(entry_tag):
        code = _text(e, "Ccy")
        if not code:  # e.g. Antarctica, "No universal currency"
            continue
        name_node = e.find("CcyNm")
        units = _text(e, "CcyMnrUnts")
        rows.append({
            "code": code,
            "numeric": _text(e, "CcyNbr"),
            "name": _text(e, "CcyNm"),
            "country": _text(e, "CtryNm"),
            "minor_units": int(units) if units.isdigit() else None,
            "is_fund": name_node is not None and name_node.get("IsFund") == "true",
            "status": status,
            "withdrawn": _text(e, "WthdrwlDt"),
            "list_published": published,
        })
    if not rows:
        return pd.DataFrame(columns=COLUMNS)
    df = pd.DataFrame(rows)
    keys = ["code", "numeric", "name", "is_fund", "status", "withdrawn", "list_published"]
    out = (df.groupby(keys, dropna=False, sort=False)
             .agg(countries=("country", lambda s: "; ".join(dict.fromkeys(s))),
                  minor_units=("minor_units", "first"))
             .reset_index())
    out["minor_units"] = out["minor_units"].astype("Int64")
    return out[COLUMNS]


def parse_list_one(xml: bytes) -> pd.DataFrame:
    """Current currencies (SIX List One)."""
    return _parse(xml, "CcyNtry", "current")


def parse_list_three(xml: bytes) -> pd.DataFrame:
    """Withdrawn currencies (SIX List Three). One row per code, name and withdrawal date,
    so a code reused over time (VEF was withdrawn three times) shows up more than once."""
    return _parse(xml, "HstrcCcyNtry", "withdrawn")


def build_table(list_one: bytes, list_three: bytes) -> pd.DataFrame:
    df = pd.concat([parse_list_one(list_one), parse_list_three(list_three)], ignore_index=True)
    return df.sort_values(["status", "code", "withdrawn"], kind="stable").reset_index(drop=True)


def _path(root: Path) -> Path:
    return root / "reference" / "iso4217.parquet"


def refresh(root: Path = store.DEFAULT_DIR) -> pd.DataFrame:
    """Download both lists, keep the raw XML next to the table, and rebuild the cache."""
    from .sources import _get

    one = _get(LIST_ONE_URL).content
    three = _get(LIST_THREE_URL).content
    folder = root / "reference"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "iso4217-list-one.xml").write_bytes(one)
    (folder / "iso4217-list-three.xml").write_bytes(three)
    table = build_table(one, three)
    table.to_parquet(_path(root), index=False)
    return table


def load(root: Path = store.DEFAULT_DIR, include_withdrawn: bool = False,
         refresh_cache: bool = False) -> pd.DataFrame:
    """The currency table, downloading it once if there is no cache yet."""
    path = _path(root)
    table = refresh(root) if refresh_cache or not path.exists() else pd.read_parquet(path)
    if not include_withdrawn:
        table = table[table["status"] == "current"]
    return table.reset_index(drop=True)
