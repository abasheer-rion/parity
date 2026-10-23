"""Private markets data from SEC EDGAR (DEC-0029): Form D counts and BDC net asset values.

    sec-formd   The SEC's quarterly Form D data sets. A Form D is the short notice a
                company or fund files after it starts selling securities privately (under
                Regulation D). We keep only counts and dollar totals per quarter, by kind of
                issuer, size and exemption. Names, addresses and the people listed in the
                filings are never stored.
    sec-bdc     Net asset value per share of large business development companies, from
                the XBRL facts in their 10-Q and 10-K filings. A BDC is a fund that lends
                to private companies; its NAV is the closest free public look at how private
                credit is marked.

Both are public information the SEC lets anyone copy, cited as "Source: SEC EDGAR". The SEC
asks scripts to name a contact in the user agent, so both skip cleanly unless
PARITY_CONTACT is set, and both stay under its limit of 10 requests a second.

Fetching and parsing are separate: `fetch_*` touches the network, `parse_*` turns a body
into a DataFrame and is what the tests exercise with saved fixtures.
"""

from __future__ import annotations

import io
import re
import zipfile
from datetime import datetime

import pandas as pd

FORMD_PAGE = "https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets"
FORMD_BASE = "https://www.sec.gov"
#: How many quarters the first fetch reads (each file is about 4 MB). Later fetches read
#: only quarters not stored yet, plus the newest one again.
FORMD_QUARTERS = 12
COMPANY_CONCEPT = "https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/us-gaap/{tag}.json"

#: Large listed BDCs, chosen for size. They trade on an exchange, so a market price exists
#: next to the NAV (we do not store prices: no free source allows showing them).
BDCS = [
    # (CIK, name, ticker or None, listed)
    ("0001287750", "Ares Capital", "ARCC", True),
    ("0001422183", "FS KKR Capital", "FSK", True),
    ("0001655888", "Blue Owl Capital Corporation", "OBDC", True),
    ("0001736035", "Blackstone Secured Lending Fund", "BXSL", True),
    ("0001396440", "Main Street Capital", "MAIN", True),
    ("0001476765", "Golub Capital BDC", "GBDC", True),
    ("0001287032", "Prospect Capital", "PSEC", True),
]
# Non-listed BDCs were tried (Blackstone Private Credit Fund) but tag NAV per share by
# share class, which the company concept API does not return, so too few points came back.
NAV_FORMS = {"10-Q", "10-K", "10-Q/A", "10-K/A"}

#: Broad kinds of issuer, from the industry group a filer picks on Form D (pooled funds are
#: split by the fund type they pick). Anything not listed falls under "Other company".
FUND_KINDS = {
    "Private Equity Fund": "Private equity fund",
    "Venture Capital Fund": "Venture capital fund",
    "Hedge Fund": "Hedge fund",
    "Other Investment Fund": "Other pooled fund",
}
INDUSTRY_KINDS = {
    "Commercial": "Real estate", "Residential": "Real estate", "Other Real Estate": "Real estate",
    "REITS and Finance": "Real estate", "Construction": "Real estate",
    "Other Technology": "Technology", "Computers": "Technology",
    "Telecommunications": "Technology",
    "Biotechnology": "Health care", "Other Health Care": "Health care",
    "Pharmaceuticals": "Health care", "Hospitals and Physicians": "Health care",
    "Health Insurance": "Health care",
    "Oil and Gas": "Energy", "Other Energy": "Energy", "Coal Mining": "Energy",
    "Electric Utilities": "Energy", "Energy Conservation": "Energy",
    "Environmental Services": "Energy",
    "Investing": "Finance", "Other Banking and Financial Services": "Finance",
    "Commercial Banking": "Finance", "Insurance": "Finance", "Investment Banking": "Finance",
}
KINDS = list(FUND_KINDS.values()) + ["Real estate", "Technology", "Health care", "Energy",
                                     "Finance", "Other company"]
SIZES = [
    ("none", "Nothing sold yet", 0, 0),
    ("lt1m", "Under 1 million USD", 0, 1e6),
    ("1m-10m", "1 to 10 million USD", 1e6, 1e7),
    ("10m-100m", "10 to 100 million USD", 1e7, 1e8),
    ("100m-1b", "100 million to 1 billion USD", 1e8, 1e9),
    ("1b+", "1 billion USD or more", 1e9, float("inf")),
]
EXEMPTIONS = {
    "506b": "Rule 506(b): no public advertising, up to 35 non-accredited buyers",
    "506c": "Rule 506(c): may advertise, accredited buyers only, checked",
    "504": "Rule 504: small offerings up to 10 million USD",
    "other": "Other exemptions only",
}


# ---------------------------------------------------------------- Form D


def parse_formd_page(html: str) -> list[tuple[str, str]]:
    """The quarterly zip links on the SEC's Form D data sets page, newest first.

    Returns [(quarter, absolute url)], quarter like '2026Q3'. The SEC has moved the files
    between folders over time, so the folder is read from the page, not assumed."""
    out: dict[str, str] = {}
    for href in re.findall(r'href="([^"]*form-d-data-sets/(\d{4})q([1-4])_d\.zip)"', html,
                           flags=re.I):
        path, year, q = href
        url = path if path.startswith("http") else FORMD_BASE + path
        out.setdefault(f"{year}Q{q}", url)
    return sorted(out.items(), reverse=True)


def kind_of(industry: str | None, fund_type: str | None) -> str:
    if industry == "Pooled Investment Fund":
        return FUND_KINDS.get(fund_type or "", "Other pooled fund")
    return INDUSTRY_KINDS.get(industry or "", "Other company")


def size_of(sold: float | None) -> str:
    if sold is None or sold != sold or sold <= 0:
        return "none"
    for sid, _, lo, hi in SIZES[1:]:
        if lo <= sold < hi:
            return sid
    return "1b+"


def exemption_of(items: str | None) -> str:
    parts = {p.strip() for p in (items or "").split(",")}
    if "06c" in parts:
        return "506c"
    if "06b" in parts:
        return "506b"
    if "04" in parts or any(p.startswith("04") for p in parts):
        return "504"
    return "other"


def _amount(v) -> float | None:
    try:
        x = float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None  # "Indefinite" and blanks
    return x if x == x else None


def parse_formd_tables(submission: str, offering: str, quarter: str) -> pd.DataFrame:
    """One quarter's FORMDSUBMISSION and OFFERING tables as counts.

    Only new notices count (form D, not D/A amendments), so a fund that files every year
    is counted once a year, in the quarter it files a new notice. Rows: quarter, kind,
    group (the SEC's industry group, or the fund type for pooled funds), size, exemption,
    filings, amount_sold_usd, indefinite (offering size given as "Indefinite"),
    nonaccredited (filings that sold to at least one non-accredited investor)."""
    sub = pd.read_csv(io.StringIO(submission), sep="\t", dtype=str, keep_default_na=False,
                      usecols=["ACCESSIONNUMBER", "SUBMISSIONTYPE", "FILING_DATE"])
    off = pd.read_csv(io.StringIO(offering), sep="\t", dtype=str, keep_default_na=False,
                      usecols=["ACCESSIONNUMBER", "INDUSTRYGROUPTYPE", "INVESTMENTFUNDTYPE",
                               "FEDERALEXEMPTIONS_ITEMS_LIST", "ISAMENDMENT",
                               "TOTALOFFERINGAMOUNT", "TOTALAMOUNTSOLD",
                               "HASNONACCREDITEDINVESTORS"])
    df = off.merge(sub, on="ACCESSIONNUMBER", how="inner")
    df = df[(df["SUBMISSIONTYPE"].str.strip() == "D")
            & (df["ISAMENDMENT"].str.lower() != "true")]
    df = df.drop_duplicates("ACCESSIONNUMBER")
    sold = df["TOTALAMOUNTSOLD"].map(_amount)
    rows = pd.DataFrame({
        "quarter": quarter,
        "kind": [kind_of(i, f) for i, f in zip(df["INDUSTRYGROUPTYPE"],
                                               df["INVESTMENTFUNDTYPE"], strict=True)],
        "group": [f if i == "Pooled Investment Fund" and f else (i or "Not given")
                  for i, f in zip(df["INDUSTRYGROUPTYPE"], df["INVESTMENTFUNDTYPE"],
                                  strict=True)],
        "size": sold.map(size_of).to_numpy(),
        "exemption": df["FEDERALEXEMPTIONS_ITEMS_LIST"].map(exemption_of).to_numpy(),
        "amount_sold_usd": sold.fillna(0.0).to_numpy(),
        "indefinite": (df["TOTALOFFERINGAMOUNT"].str.strip().str.lower()
                       == "indefinite").to_numpy(),
        "nonaccredited": (df["HASNONACCREDITEDINVESTORS"].str.lower() == "true").to_numpy(),
    })
    keys = ["quarter", "kind", "group", "size", "exemption"]
    out = rows.groupby(keys, as_index=False).agg(
        filings=("kind", "size"), amount_sold_usd=("amount_sold_usd", "sum"),
        indefinite=("indefinite", "sum"), nonaccredited=("nonaccredited", "sum"))
    for c in ("filings", "indefinite", "nonaccredited"):
        out[c] = out[c].astype(int)
    return out.sort_values(keys).reset_index(drop=True)


def parse_formd_zip(data: bytes, quarter: str) -> pd.DataFrame:
    """A quarterly zip as counts. Only the two tables we need are read."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = {n.rsplit("/", 1)[-1].upper(): n for n in z.namelist()}
        sub = z.read(names["FORMDSUBMISSION.TSV"]).decode("utf-8", errors="replace")
        off = z.read(names["OFFERING.TSV"]).decode("utf-8", errors="replace")
    return parse_formd_tables(sub, off, quarter)


def pick_quarters(listed: list[tuple[str, str]], have: set[str],
                  limit: int = FORMD_QUARTERS) -> list[tuple[str, str]]:
    """The newest `limit` quarters we do not have yet, plus the newest one again (the SEC
    can reissue a file)."""
    newest = listed[:limit]
    return [(q, u) for i, (q, u) in enumerate(newest) if q not in have or i == 0]


# ---------------------------------------------------------------- BDC net asset values


def parse_nav_concept(payload: dict, cik: str, name: str, ticker: str | None,
                      listed: bool, fetched_at: datetime) -> pd.DataFrame:
    """NAV per share from one company's XBRL facts: one row per period end, from the
    latest 10-Q or 10-K that reported it (later filings repeat and sometimes restate)."""
    facts = []
    for unit, rows in (payload.get("units") or {}).items():
        if unit != "USD/shares":
            continue
        facts += [r for r in rows if r.get("form") in NAV_FORMS and r.get("val") is not None]
    cols = ["cik", "name", "ticker", "listed", "end", "nav", "form", "filed", "fetched_at"]
    if not facts:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(facts)
    df = df.sort_values(["end", "filed"]).drop_duplicates("end", keep="last")
    return pd.DataFrame({
        "cik": cik, "name": name, "ticker": ticker, "listed": listed,
        "end": df["end"].to_numpy(), "nav": df["val"].astype(float).to_numpy(),
        "form": df["form"].to_numpy(), "filed": df["filed"].to_numpy(),
        "fetched_at": fetched_at.isoformat(),
    })[cols].reset_index(drop=True)
