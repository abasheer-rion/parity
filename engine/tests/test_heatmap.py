"""The home heatmap's member lists and sizes (DEC-0070)."""

from datetime import date

import pandas as pd

from parity.markets import heatmap

SP = (
    """== S&P 500 component stocks ==
{| class="wikitable sortable" id="constituents"
|-
! Symbol !! Security !! GICS Sector !! Sub !! HQ !! Added !! CIK !! Founded
"""
    + "".join(
        f"|-\n|| {{{{NyseSymbol|T{i}}}}}\n|| [[Company {i}]]\n|| Industrials \n"
        "|| Sub \n|| [[Town]] \n"
        f"|| 2000-01-01 \n|| {i:010d}\n|| 1900\n"
        for i in range(1, 61)
    )
    + "|}\n"
)

NDX = (
    """{| class="wikitable sortable" id="constituents"
|-
! Ticker !! Company !! ISIN !! ICB Industry !! ICB Subsector
"""
    + "".join(
        f"|-\n| N{i} || [[Firm {i}]] (Class A) || {{{{ISIN|sl=n|US0}}}} || Technology || Software\n"
        for i in range(1, 61)
    )
    + "|}\n"
)


def test_parse_members_reads_both_layouts():
    sp = heatmap.parse_members(SP, "sp500")
    nd = heatmap.parse_members(NDX, "ndx")
    assert len(sp) == 60 and len(nd) == 60
    assert sp.iloc[0].to_dict() == {
        "index": "sp500",
        "ticker": "T1",
        "name": "Company 1",
        "sector": "Industrials",
        "cik": "1",
    }
    assert nd.iloc[0]["name"] == "Firm 1" and nd.iloc[0]["sector"] == "Technology"


def test_latest_float_wins_and_doc_sorts_by_size():
    old = heatmap.parse_float_frame({"data": [{"cik": 1, "val": 5, "end": "2025-03-31"}]})
    new = heatmap.parse_float_frame(
        {
            "data": [
                {"cik": 1, "val": 9, "end": "2025-06-30"},
                {"cik": 2, "val": 20, "end": "2025-06-30"},
            ]
        }
    )
    floats = heatmap.latest_floats([old, new])
    assert dict(zip(floats["cik"], floats["float_usd"], strict=True)) == {"1": 9.0, "2": 20.0}
    members = pd.concat([heatmap.parse_members(SP, "sp500"), heatmap.parse_members(NDX, "ndx")])
    doc = heatmap.heatmap_doc(members, floats, {"N1": "2", "N2": "2"})
    rows = doc["indexes"]["sp500"]["rows"]
    assert [r[0] for r in rows] == ["T2", "T1"] and doc["missing"]["sp500"] == 58
    # Two share classes of one company show once.
    assert [r[0] for r in doc["indexes"]["ndx"]["rows"]] == ["N1"]
    assert doc["moves"] is None


def test_recent_quarters():
    assert heatmap.recent_quarters(date(2026, 10, 26), 3) == [(2026, 3), (2026, 2), (2026, 1)]
    assert heatmap.recent_quarters(date(2026, 2, 1), 2) == [(2025, 4), (2025, 3)]
