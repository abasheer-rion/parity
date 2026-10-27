"""The market heatmap on the product home (DEC-0075): who is in the S&P 500 and the
Nasdaq-100, and how big each company is.

Two public sources, both free to show:

    wikipedia     the member lists ("List of S&P 500 companies" and "List of NASDAQ-100
                  companies"), with sector and the SEC's company number (CIK). Text is
                  CC BY-SA 4.0, so the page credits Wikipedia next to the map.
    sec           each company's public float: the market value of its shares held by
                  outside investors, as the company states it in its latest annual report
                  (the dei:EntityPublicFloat fact). Public information; cite the SEC.

The box size is that filed public float, not a live market value: no free source lets us
show single-stock prices on a public site (REF-0014), and market value needs a price. The
float is a dated, filed dollar amount, so the size is real and needs no price. Daily
moves are left empty here; the page colours boxes only from a source it may show (live
for team members, DEC-0056).

`parse_*` turns a response body into a DataFrame and is what the tests exercise.
"""

from __future__ import annotations

import re
from datetime import date, datetime

import pandas as pd

WIKI_API = "https://en.wikipedia.org/w/api.php"
PAGES = {"sp500": "List of S&P 500 companies", "ndx": "List of NASDAQ-100 companies"}
SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"
SEC_FRAME = "https://data.sec.gov/api/xbrl/frames/dei/EntityPublicFloat/USD/CY{y}Q{q}I.json"

_LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]")
_TPL_SYMBOL = re.compile(
    r"\{\{\s*(?:Nyse|Nasdaq|NYSE|NASDAQ|Cboe|BATS)\w*\s*\|\s*([A-Z0-9.\-]+)", re.I
)
_REF = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", re.S)


def _text(cell: str) -> str:
    """Plain text of one wikitext table cell: links unwrapped, refs and templates gone."""
    cell = _REF.sub("", cell)
    cell = _LINK.sub(lambda m: m.group(1), cell)
    cell = re.sub(r"\{\{[^{}]*\}\}", "", cell)
    cell = re.sub(r"'{2,}", "", cell)
    return re.sub(r"\s+", " ", cell).strip()


def _rows(wikitext: str) -> list[list[str]]:
    """The cells of each row in the table with id="constituents"."""
    start = wikitext.find('id="constituents"')
    if start < 0:
        raise ValueError("no constituents table on the page")
    end = wikitext.find("\n|}", start)
    body = wikitext[start : end if end > 0 else None]
    rows = []
    for chunk in body.split("\n|-")[1:]:
        lines = [ln for ln in chunk.strip().split("\n") if ln.startswith("|")]
        if not lines:
            continue
        cells: list[str] = []
        for ln in lines:
            cells.extend(c for c in re.split(r"\|\|", ln.lstrip("|")) if c.strip() or cells)
        rows.append([c.strip() for c in cells])
    return rows


def parse_members(wikitext: str, index: str) -> pd.DataFrame:
    """Members of one index: ticker, name, sector, cik (S&P 500 only) and index id."""
    out = []
    for cells in _rows(wikitext):
        if len(cells) < 3:
            continue
        sym = _TPL_SYMBOL.search(cells[0])
        ticker = (sym.group(1) if sym else _text(cells[0])).upper().replace(".", "-")
        if not re.fullmatch(r"[A-Z][A-Z0-9\-]{0,6}", ticker):
            continue
        name = _text(cells[1])
        if index == "sp500":
            sector = _text(cells[2])
            cik = next(
                (re.sub(r"\D", "", c) for c in cells if re.fullmatch(r"\s*\d{10}\s*", c)), ""
            )
        else:  # ticker, company, ISIN, ICB industry, ICB subsector
            sector = _text(cells[3]) if len(cells) > 3 else ""
            cik = ""
        out.append(
            {
                "index": index,
                "ticker": ticker,
                "name": re.sub(r"\s*\(Class [A-Z]\)", "", name),
                "sector": sector,
                "cik": str(int(cik)) if cik else "",
            }
        )
    if len(out) < 50:
        raise ValueError(
            f"{index}: only {len(out)} members parsed, the page layout may have changed"
        )
    return pd.DataFrame(out)


def parse_tickers(payload: dict) -> dict[str, str]:
    """Ticker to CIK from the SEC's company_tickers.json."""
    return {
        str(v["ticker"]).upper().replace(".", "-"): str(int(v["cik_str"])) for v in payload.values()
    }


def parse_float_frame(payload: dict) -> pd.DataFrame:
    """One quarter's public float facts: cik, value in dollars, the date it is measured on."""
    rows = [
        {
            "cik": str(int(d["cik"])),
            "float_usd": float(d["val"]),
            "float_date": d["end"],
            "accn": d.get("accn", ""),
        }
        for d in payload.get("data", [])
        if d.get("val")
    ]
    return pd.DataFrame(rows, columns=["cik", "float_usd", "float_date", "accn"])


def latest_floats(frames: list[pd.DataFrame]) -> pd.DataFrame:
    """The newest public float per company across several quarterly frames."""
    df = (
        pd.concat([f for f in frames if not f.empty], ignore_index=True)
        if frames
        else pd.DataFrame()
    )
    if df.empty:
        return pd.DataFrame(columns=["cik", "float_usd", "float_date", "accn"])
    return df.sort_values("float_date").drop_duplicates("cik", keep="last").reset_index(drop=True)


def recent_quarters(today: date, n: int = 8) -> list[tuple[int, int]]:
    """The last n calendar quarters that have ended, newest first."""
    y, q = today.year, (today.month - 1) // 3  # the quarter before the current one
    out = []
    for _ in range(n):
        if q == 0:
            y, q = y - 1, 4
        out.append((y, q))
        q -= 1
    return out


def heatmap_doc(
    members: pd.DataFrame,
    floats: pd.DataFrame,
    tickers_to_cik: dict[str, str] | None = None,
    fetched_at: datetime | None = None,
) -> dict:
    """The heatmap file: each index's members with size, largest first.

    Rows are [ticker, name, sector, public float in dollars, float date]. A company with two
    share classes in the list (GOOGL and GOOG) shows once, under its first ticker.
    """
    sizes = (
        {r.cik: (r.float_usd, r.float_date) for r in floats.itertuples()}
        if not floats.empty
        else {}
    )
    idx: dict[str, list] = {}
    missing: dict[str, int] = {}
    for index in ("sp500", "ndx"):
        rows, seen = [], set()
        sub = members[members["index"] == index] if not members.empty else members
        for r in sub.itertuples():
            cik = r.cik or (tickers_to_cik or {}).get(r.ticker, "")
            if cik and cik in seen:
                continue
            size = sizes.get(cik)
            if not size:
                missing[index] = missing.get(index, 0) + 1
                continue
            seen.add(cik)
            rows.append([r.ticker, r.name, r.sector, round(size[0]), size[1]])
        rows.sort(key=lambda x: -x[3])
        idx[index] = rows
    return {
        "fetched_at": fetched_at.isoformat(timespec="seconds") if fetched_at else None,
        "columns": ["ticker", "name", "sector", "float_usd", "float_date"],
        "indexes": {
            "sp500": {"label": "S&P 500", "rows": idx.get("sp500", [])},
            "ndx": {"label": "Nasdaq-100", "rows": idx.get("ndx", [])},
        },
        "missing": missing,
        "size": "Public float: the market value of shares held by outside investors, from each "
        "company's latest annual report to the SEC",
        "moves": None,
    }
