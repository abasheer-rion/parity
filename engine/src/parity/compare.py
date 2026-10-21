"""Head-to-head comparisons between strategies, and cross-checks between data sources
that measure the same thing. Both run in every report so drift shows up on its own."""

from __future__ import annotations

import pandas as pd

CRISES = (
    ("Dot-com crash", "2000-03-24", "2002-10-09"),
    ("Global financial crisis", "2007-10-09", "2009-03-09"),
    ("Euro debt crisis", "2011-04-29", "2011-10-03"),
    ("Covid crash", "2020-02-19", "2020-03-23"),
    ("2022 inflation bear market", "2022-01-03", "2022-10-12"),
)

SOURCE_PAIRS = (
    ("eq.US_TOTAL", "eq.SPY", "Our benchmark against SPY from Yahoo (cross-check only)"),
    ("eq.US_MKT", "eq.SPX", "Fama and French market against the S&P 500 price index"),
    ("cmd.WTI", "cmd.BRENT", "The two crude oil benchmarks"),
)


def strategy_comparison(returns: dict[str, pd.Series]) -> dict:
    df = pd.DataFrame(returns).dropna(how="all").fillna(0.0)
    monthly = (1 + df).resample("ME").prod() - 1
    corr = monthly.corr().round(2)
    crises = []
    for name, start, end in CRISES:
        window = df.loc[start:end]
        if len(window) < 5:
            continue
        crises.append({"name": name, "start": start, "end": end,
                       "returns": {k: round(float((1 + window[k]).prod() - 1), 4)
                                   for k in df.columns}})
    return {"names": list(corr.columns), "correlation": corr.values.tolist(), "crises": crises}


def source_checks(panel: pd.DataFrame) -> list[dict]:
    out = []
    for a, b, label in SOURCE_PAIRS:
        if a not in panel or b not in panel:
            continue
        both = panel[[a, b]].pct_change(fill_method=None).dropna()
        both = both[(both.abs() < 0.5).all(axis=1)]  # ignore the negative oil price day
        if len(both) < 60:
            continue
        years = len(both) / 252
        growth = (1 + both).prod() ** (1 / years) - 1
        out.append({"a": a, "b": b, "label": label, "days": int(len(both)),
                    "from": both.index.min().date().isoformat(),
                    "daily_correlation": round(float(both.corr().iloc[0, 1]), 4),
                    "annual_return_gap": round(float(growth[a] - growth[b]), 4)})
    return out
