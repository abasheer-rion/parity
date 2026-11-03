"""Labelled research rows from Open Source Asset Pricing (RES-0031, DAT-0048).

Downloads two files from the pinned Hugging Face release (about 1.6 MB), splits each
predictor's monthly long-short return into the paper's sample, the years between the
sample end and publication, and the years after publication, and runs the same
deflated Sharpe luck check as parity.metrics.performance on the in-sample months.

    python scripts/osap_labelled_rows.py OUT_DIR

Writes OUT_DIR/osap_labelled_rows.csv (one row per predictor) and prints the summary
quoted in RES-0031. The data are CC BY 4.0: credit Chen and Zimmermann (2022).
Needs pandas, pyarrow and scipy (all in engine[dev]).
"""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine" / "src"))
from parity.metrics.performance import deflated_sharpe  # noqa: E402

RELEASE = "Data-Release-2026.10"
BASE = f"https://huggingface.co/datasets/OpenSourceAP/CrossSection/resolve/{RELEASE}"
FILES = {"SignalDoc.csv": "SignalDoc.csv",
         "LSretWide.parquet": "Portfolios/Full%20Sets%20OP/PredictorLSretWide.parquet"}
TRIALS = (1, 212, 316)  # none; predictors in this release; Harvey, Liu and Zhu's count
PASS = 0.95


def fetch(out: Path) -> None:
    for name, path in FILES.items():
        if not (out / name).exists():
            urllib.request.urlretrieve(f"{BASE}/{path}", out / name)


def stats(r: pd.Series) -> dict:
    r = r.dropna()
    n, sd = len(r), r.std()
    if n < 2 or not sd:
        return {"n": n, "mean": np.nan, "sharpe": np.nan, "t": np.nan}
    return {"n": n, "mean": r.mean(), "sharpe": r.mean() / sd * math.sqrt(12),
            "t": r.mean() / sd * math.sqrt(n)}


def rows(ret: pd.DataFrame, doc: pd.DataFrame) -> pd.DataFrame:
    out = []
    for _, s in doc[doc["Cat.Signal"] == "Predictor"].iterrows():
        if s.Acronym not in ret:
            continue
        r = ret[s.Acronym].dropna()
        y = r.index.year
        ins = r[(y >= s.SampleStartYear) & (y <= s.SampleEndYear)]
        after = r[y > s.SampleEndYear]
        post = r[y > s.Year]
        row = {"id": f"osap-{s.Acronym}", "acronym": s.Acronym, "pub_year": int(s.Year),
               "sample": f"{int(s.SampleStartYear)}-{int(s.SampleEndYear)}",
               "predictability": s["Predictability in OP"], "category": s["Cat.Economic"],
               "op_tstat": s["T-Stat"]}
        parts = {"is": ins, "next6": after.iloc[:6], "oos": r[(y > s.SampleEndYear) & (y <= s.Year)],
                 "post": post, "post6": post.iloc[:6], "post60": post.iloc[:60]}
        for k, x in parts.items():
            for m, v in stats(x).items():
                row[f"{k}_{m}"] = v
        for n in TRIALS:
            row[f"is_dsr_{n}"] = deflated_sharpe(ins, n)
        out.append(row)
    return pd.DataFrame(out)


def share(x: pd.Series) -> dict:
    x = x.dropna() > 0
    boot = np.random.default_rng(0).choice(x.to_numpy(), (5000, len(x))).mean(axis=1)
    return {"n": len(x), "positive": round(float(x.mean()), 3),
            "ci95": [round(float(np.percentile(boot, q)), 3) for q in (2.5, 97.5)]}


def summary(t: pd.DataFrame) -> dict:
    s: dict = {"predictors": len(t)}
    for col in ("next6_mean", "post6_mean", "post_mean"):
        s[col] = {"all": share(t[col])}
        for n in TRIALS:
            ok = t[f"is_dsr_{n}"] >= PASS
            s[col][f"trials_{n}"] = {"holds_up": share(t.loc[ok, col]), "fails": share(t.loc[~ok, col])}
    full = t.dropna(subset=["is_mean", "oos_mean", "post_mean"])
    s["average_monthly_pct"] = {k: round(float(full[f"{k}_mean"].mean()), 3) for k in ("is", "oos", "post")}
    s["median_sharpe"] = {k: round(float(full[f"{k}_sharpe"].median()), 3) for k in ("is", "oos", "post")}
    return s


def pooled(ret: pd.DataFrame, doc: pd.DataFrame) -> dict:
    """McLean and Pontiff style: returns scaled by each signal's in-sample mean."""
    parts = []
    for _, s in doc[doc["Cat.Signal"] == "Predictor"].iterrows():
        if s.Acronym not in ret:
            continue
        r = ret[s.Acronym].dropna()
        r = r[r.index.year >= s.SampleStartYear]
        y = r.index.year
        m = r[y <= s.SampleEndYear].mean()
        if pd.notna(m) and m:
            parts.append(pd.DataFrame({"r": r.to_numpy() / m,
                                       "oos": ((y > s.SampleEndYear) & (y <= s.Year)).astype(int),
                                       "post": (y > s.Year).astype(int)}))
    p = pd.concat(parts)
    beta = np.linalg.lstsq(np.column_stack([np.ones(len(p)), p.oos, p.post]), p.r, rcond=None)[0]
    return {"oos_change": round(float(beta[1]), 3), "post_change": round(float(beta[2]), 3), "months": len(p)}


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    fetch(out)
    ret = pd.read_parquet(out / "LSretWide.parquet")
    ret = ret.set_index(pd.to_datetime(ret.pop("date")))
    doc = pd.read_csv(out / "SignalDoc.csv")
    t = rows(ret, doc)
    t.to_csv(out / "osap_labelled_rows.csv", index=False, float_format="%.4f")
    print(json.dumps({"release": RELEASE, "last_month": str(ret.index.max().date()),
                      **summary(t), "pooled": pooled(ret, doc)}, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "osap-out"))
