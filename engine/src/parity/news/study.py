"""The news impact engine: which news came before big moves, and event studies by topic.

Three questions, for any series in the data catalog and any date range:

1. **Which headlines were followed by the biggest unusual moves?** For each day with
   news about the asset, the move 1, 5 and 20 trading days later divided by the asset's
   own normal move (its daily volatility over the year before, times the square root of
   the days). Headlines on the same day share one move, so days are ranked, not items.
2. **What usually happens after a kind of news?** An event study: every day with a
   matching headline is one event. We line the events up on day 0 and report the
   average and median path, a 95% band, the hit rate (share of events where the asset
   rose) and N, next to the same numbers for random days from the same years.
3. **Which assets react most to a topic, and which topics move an asset most?** The
   event study run across many pairs, ranked by evidence (a p-value against random
   days, corrected for the number of pairs tried), never by the size of the move alone.

Honest by construction:
- Every number comes with N. Fewer than 20 events gets a warning.
- Events whose windows overlap (another event within 20 trading days before) are
  marked, and the averages are also given for non-overlapping events only.
- p-values come from random days, not a normal table, so fat tails and drift are in the
  baseline. Rankings report Benjamini-Hochberg q-values across every pair tried.
- Volatility uses only data up to the day before the event. Paths after day 0 are what
  happened, not a forecast. This describes the past; it is never a prediction.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..data import catalog
from ..data import store as data_store
from . import archive, impact, tagging

HORIZONS = {"1d": 1, "5d": 5, "20d": 20}
PRE, POST = 5, 20
VOL_WINDOW, MIN_VOL_OBS = 250, 60
RANDOM_DRAWS = 500
MIN_EVENTS = 20
SEED = 7

PCT, PP, PT = "pct", "pp", "pt"
RATE_PREFIXES = ("rate", "curve", "policy", "money", "spread", "infl", "credit")

# The assets the site shows by default: broad, daily and long.
DEFAULT_ASSETS = ["eq.US_TOTAL", "risk.VIX", "bond.UST10Y", "curve.UST_2Y", "usd.BASKET",
                  "fx.EUR", "fx.JPY", "fx.GBP", "cmd.WTI", "cmd.BRENT", "cmd.HH_GAS",
                  "ind.Money", "ind.Enrgy"]


def unit_for(key: str) -> str:
    if key in impact.TARGETS:
        return impact.TARGETS[key].unit
    head = key.split(".")[0]
    if head in RATE_PREFIXES or key.startswith(("bond.UST", "bond.TIPS")):
        return PP
    if head in ("risk", "cot", "macro", "eia"):
        return PT
    return PCT


def label_for(key: str) -> str:
    if key in impact.TARGETS:
        return impact.TARGETS[key].label
    names = {"curve.UST_2Y": "US 2 year yield", "ind.Money": "US bank and finance stocks",
             "ind.Enrgy": "US energy stocks", "usd.BROAD": "US dollar, broad index"}
    if key in names:
        return names[key]
    try:
        d = catalog.get(key).description
    except KeyError:
        return key
    return d.split(",")[0].split(" (")[0]


# ------------------------------------------------------------------ series


def load_series(key: str, root: Path = data_store.DEFAULT_DIR) -> pd.Series:
    """One series on its own trading days, never forward filled. Monthly and weekly
    series are moved to the day they were first published, as the strategy panel does."""
    if key == "usd.BASKET":
        fx = {}
        for c in impact.G10:
            try:
                fx[f"fx.{c}"] = load_series(f"fx.{c}", root)
            except FileNotFoundError:
                pass
        if len(fx) < 3:
            raise FileNotFoundError("Not enough cached currencies for the dollar basket")
        idx = pd.bdate_range(min(s.index.min() for s in fx.values()),
                             max(s.index.max() for s in fx.values()))
        panel = impact.add_usd_basket(pd.DataFrame({k: s.reindex(idx) for k, s in fx.items()}))
        s = panel["usd.BASKET"]
        have = panel[list(fx)].notna().sum(axis=1) >= len(fx) / 2
        return s[have].dropna()
    spec = catalog.get(key)
    s = data_store.load(key, root).dropna()
    s = s[~s.index.duplicated(keep="last")].sort_index()
    if spec.published_after is not None:
        s.index = s.index + pd.offsets.MonthEnd(0) + pd.offsets.BDay(spec.published_after)
    if spec.lag_days:
        s.index = s.index + pd.offsets.BDay(spec.lag_days)
    return s[~s.index.duplicated(keep="last")]


@dataclass
class Prepared:
    key: str
    unit: str
    dates: pd.DatetimeIndex
    values: np.ndarray
    sigma: np.ndarray  # normal daily move using data up to and including each day
    label: str = ""
    _all_z: dict = field(default_factory=dict)


def prepare(key: str, s: pd.Series | None = None, root: Path = data_store.DEFAULT_DIR) -> Prepared:
    s = load_series(key, root) if s is None else s.dropna().sort_index()
    unit = unit_for(key)
    ch = impact.daily_changes(s, unit)
    sigma = ch.rolling(VOL_WINDOW, min_periods=MIN_VOL_OBS).std().to_numpy()
    return Prepared(key, unit, pd.DatetimeIndex(s.index), s.to_numpy(dtype=float), sigma,
                    label_for(key))


def base_positions(p: Prepared, published_at) -> np.ndarray:
    """For each publication time, the position of the last close before it.

    After 4pm New York the item counts for the next day, so the base is that day's close.
    -1 when there is no earlier price."""
    ts = pd.to_datetime(pd.Series(published_at), utc=True).dt.tz_convert("America/New_York")
    day = ts.dt.tz_localize(None).dt.normalize()
    day = day + pd.to_timedelta((ts.dt.hour >= impact.CLOSE_HOUR_NY).astype(int), unit="D")
    return np.searchsorted(p.dates.values, day.values.astype("datetime64[ns]"), side="left") - 1


def _change(base: np.ndarray, end: np.ndarray, unit: str) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        if unit == PCT:
            ok = (base > 0) & (end > 0)
            return np.where(ok, (end / base - 1) * 100, np.nan)
        return end - base


def moves_after(p: Prepared, bases: np.ndarray, ks) -> tuple[np.ndarray, np.ndarray]:
    """Raw moves and moves in units of the normal daily move, from each base to base+k.
    NaN where the price is not there yet or volatility has too little history."""
    ks = np.asarray(ks)
    idx = bases[:, None] + ks[None, :]
    ok = (idx >= 0) & (idx < len(p.values)) & (bases[:, None] >= 0)
    safe = np.clip(idx, 0, len(p.values) - 1)
    b = p.values[np.clip(bases, 0, len(p.values) - 1)]
    raw = np.where(ok, _change(b[:, None], p.values[safe], p.unit), np.nan)
    sig = p.sigma[np.clip(bases, 0, len(p.values) - 1)]
    sig = np.where((bases >= 0) & (sig > 0), sig, np.nan)
    return raw, raw / sig[:, None]


def horizon_z(p: Prepared, bases: np.ndarray) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Per horizon: raw move and z, where z = move / (normal daily move x sqrt(days))."""
    raw, zd = moves_after(p, bases, list(HORIZONS.values()))
    return {h: (raw[:, i], zd[:, i] / math.sqrt(n)) for i, (h, n) in enumerate(HORIZONS.items())}


def all_day_z(p: Prepared, horizon: str = "1d") -> np.ndarray:
    """z for every day of the series, for how-often-is-this-big comparisons."""
    if horizon not in p._all_z:
        bases = np.arange(len(p.values))
        p._all_z[horizon] = horizon_z(p, bases)[horizon][1]
    return p._all_z[horizon]


# ------------------------------------------------------------------ statistics


def bh(pvals) -> np.ndarray:
    """Benjamini-Hochberg q-values: the false discovery rate if you call everything up to
    this p-value a finding."""
    p = np.asarray(pvals, dtype=float)
    q = np.full_like(p, np.nan)
    ok = ~np.isnan(p)
    m = int(ok.sum())
    if not m:
        return q
    order = np.argsort(p[ok])
    ranked = p[ok][order] * m / np.arange(1, m + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(m)
    out[order] = np.minimum(ranked, 1.0)
    q[ok] = out
    return q


def overlap_flags(bases: np.ndarray, window: int = POST) -> np.ndarray:
    """True for an event that starts within `window` trading days after an earlier one,
    so the two share part of their after-paths. `bases` must be sorted."""
    flags = np.zeros(len(bases), dtype=bool)
    if len(bases) > 1:
        flags[1:] = np.diff(bases) <= window
    return flags


def non_overlapping(bases: np.ndarray, window: int = POST) -> np.ndarray:
    """Greedy subset with no two events closer than `window` trading days."""
    keep, last = [], -10**9
    for i, b in enumerate(bases):
        if b - last > window:
            keep.append(i)
            last = b
    return np.array(keep, dtype=int)


def _ci(x: np.ndarray) -> tuple[float | None, float | None]:
    x = x[~np.isnan(x)]
    if len(x) < 2:
        return None, None
    se = x.std(ddof=1) / math.sqrt(len(x))
    return float(x.mean() - 1.96 * se), float(x.mean() + 1.96 * se)


def _date(v) -> str | None:
    """A date string, or None for the latest day whose next session has not happened."""
    return v if isinstance(v, str) else None


def _r(v, d: int = 3):
    return impact._r(v, d)


# ------------------------------------------------------------------ 1. biggest moves


def headline_days(p: Prepared, items: pd.DataFrame) -> pd.DataFrame:
    """Group items by the close they are measured from: one row per day."""
    if items.empty:
        return pd.DataFrame()
    bases = base_positions(p, items["published_at"])
    it = items.assign(_base=bases)
    it = it[(it["_base"] >= 0) & (it["_base"] < len(p.values))]
    if it.empty:
        return pd.DataFrame()
    hz = horizon_z(p, it["_base"].to_numpy())
    for h, (raw, z) in hz.items():
        it[f"move_{h}"], it[f"z_{h}"] = raw, z
    agg = it.sort_values("published_at").groupby("_base")
    out = agg.agg(**{f"{c}_{h}": (f"{c}_{h}", "first") for h in HORIZONS for c in ("move", "z")},
                  n_headlines=("id", "size"))
    out["items"] = agg.apply(lambda g: [_brief(r) for r in
                                        g.drop_duplicates("title").head(5).to_dict("records")],
                             include_groups=False)
    out["base_date"] = [p.dates[b].date().isoformat() for b in out.index]
    out["event_date"] = [p.dates[b + 1].date().isoformat() if b + 1 < len(p.dates) else None
                         for b in out.index]
    return out.reset_index(names="base")


def top_moves(key: str, items: pd.DataFrame, start=None, end=None, horizon: str = "1d",
              n: int = 25, p: Prepared | None = None, relevant: bool = True,
              root: Path = data_store.DEFAULT_DIR) -> dict:
    """The days with news about `key` that were followed by the biggest unusual moves."""
    p = p or prepare(key, root=root)
    sub = _in_range(items, start, end)
    if relevant and "assets" in sub and len(sub):
        sub = sub[sub["assets"].apply(lambda a: key in a)]
    days = headline_days(p, sub)
    col = f"z_{horizon}"
    res = {"asset": key, "label": p.label, "unit": p.unit, "horizon": horizon,
           "n_items": int(len(sub)), "n_days": int(len(days)), "days": [], "warnings": []}
    if days.empty:
        res["warnings"].append("No headlines about this asset in this range.")
        return res
    allz = np.abs(all_day_z(p, horizon))
    allz = allz[~np.isnan(allz)]
    scored = days.dropna(subset=[col])
    ranked = scored.reindex(scored[col].abs().sort_values(ascending=False).index).head(n)
    # How rare is each move across every day of the series, news or not.
    for r in ranked.to_dict("records"):
        share = float((allz >= abs(r[col])).mean()) if len(allz) else None
        res["days"].append({
            "base_date": r["base_date"], "event_date": _date(r["event_date"]),
            "n_headlines": int(r["n_headlines"]), "share_of_days_as_big": _r(share, 4),
            **{f"z_{h}": _r(r[f"z_{h}"]) for h in HORIZONS},
            **{f"move_{h}": _r(r[f"move_{h}"], 4) for h in HORIZONS},
            "items": r["items"]})
    big2 = float((allz >= 2).mean()) if len(allz) else 0.0
    res["checked"] = int(len(scored))
    res["share_all_days_z2"] = _r(big2, 4)
    res["expected_z2_by_chance"] = _r(len(scored) * big2, 1)
    res["observed_z2"] = int((scored[col].abs() >= 2).sum())
    res["warnings"].append(
        f"We checked {len(scored)} news days. On this asset {big2:.1%} of all days move by "
        f"2 normal moves or more, so about {len(scored) * big2:.0f} such days would show up "
        "by chance alone. The top of this list is partly luck.")
    crowded = sum(1 for d in res["days"] if d["n_headlines"] > 3)
    if crowded:
        res["warnings"].append(f"{crowded} of these days had more than three headlines; any of "
                               "them, or something else, may be behind the move.")
    return res


# ------------------------------------------------------------------ 2. event study


def event_study(key: str, items: pd.DataFrame, start=None, end=None, p: Prepared | None = None,
                draws: int = RANDOM_DRAWS, seed: int = SEED, keep_events: int = 40,
                root: Path = data_store.DEFAULT_DIR) -> dict:
    """Average path of `key` after every day with a matching headline, against random days."""
    p = p or prepare(key, root=root)
    sub = _in_range(items, start, end)
    res = {"asset": key, "label": p.label, "unit": p.unit, "n_headlines": int(len(sub)),
           "n_events": 0, "warnings": [], "horizons": {}, "path": None, "events": []}
    if sub.empty:
        res["warnings"].append("No matching headlines in this range.")
        return res
    raw_b = base_positions(p, sub["published_at"])
    valid = (raw_b >= 0) & (raw_b < len(p.values))
    bases = np.unique(raw_b[valid])
    sig_ok = ~np.isnan(p.sigma[bases]) if len(bases) else np.array([], bool)
    bases = bases[sig_ok]
    n = len(bases)
    res["n_events"] = int(n)
    if not n:
        res["warnings"].append("No events with enough price history.")
        return res
    flags = overlap_flags(bases)
    keep = non_overlapping(bases)
    res.update(first=p.dates[bases[0]].date().isoformat(),
               last=p.dates[bases[-1]].date().isoformat(),
               n_overlapping=int(flags.sum()), n_non_overlapping=int(len(keep)))

    ks = np.arange(-PRE, POST + 1)
    raw, zd = moves_after(p, bases, ks)
    hz = horizon_z(p, bases)

    # Random days from the same span, with the same history rules.
    rng = np.random.default_rng(seed)
    lo = max(int(bases.min()) - 250, 0)
    hi = min(int(bases.max()) + 250, len(p.values) - 1)
    pool = np.arange(lo, hi + 1)
    pool = pool[~np.isnan(p.sigma[pool])]
    m = min(n, 5000)
    draws = max(100, min(draws, 200_000 // m))  # keep memory bounded for very common topics
    rand = rng.choice(pool, size=(draws, m), replace=True)
    rand_flat = rand.ravel()
    _, rzd = moves_after(p, rand_flat, ks)
    rzd = rzd.reshape(draws, m, len(ks))
    rand_path_mean = np.nanmean(rzd, axis=1)  # draws x ks
    rhz = horizon_z(p, rand_flat)

    res["path"] = {
        "k": ks.tolist(),
        "mean_z": [_r(v) for v in np.nanmean(zd, axis=0)],
        "median_z": [_r(v) for v in np.nanmedian(zd, axis=0)],
        "lo_z": [_r(_ci(zd[:, j])[0]) for j in range(len(ks))],
        "hi_z": [_r(_ci(zd[:, j])[1]) for j in range(len(ks))],
        "mean_move": [_r(v, 4) for v in np.nanmean(raw, axis=0)],
        "median_move": [_r(v, 4) for v in np.nanmedian(raw, axis=0)],
        "random_mean_z": [_r(v) for v in np.nanmean(rand_path_mean, axis=0)],
        "random_lo_z": [_r(v) for v in np.nanpercentile(rand_path_mean, 2.5, axis=0)],
        "random_hi_z": [_r(v) for v in np.nanpercentile(rand_path_mean, 97.5, axis=0)],
        "n": [int(np.sum(~np.isnan(zd[:, j]))) for j in range(len(ks))],
    }
    for h in HORIZONS:
        mv, z = hz[h]
        have = ~np.isnan(z)
        nh = int(have.sum())
        rz = rhz[h][1].reshape(draws, m)
        rmeans = np.nanmean(rz, axis=1)
        centre = float(np.nanmean(rmeans))
        obs = float(np.nanmean(z)) if nh else float("nan")
        p_val = (1 + np.sum(np.abs(rmeans - centre) >= abs(obs - centre))) / (draws + 1) \
            if nh >= 5 else float("nan")  # below 5 events a p-value means nothing
        rmv = rhz[h][0]
        zk = z[keep]
        lo_ci, hi_ci = _ci(z)
        res["horizons"][h] = {
            "n": nh, "mean_z": _r(obs), "median_z": _r(np.nanmedian(z) if nh else None),
            "ci_lo": _r(lo_ci), "ci_hi": _r(hi_ci),
            "mean_move": _r(np.nanmean(mv) if nh else None, 4),
            "median_move": _r(np.nanmedian(mv) if nh else None, 4),
            "hit_rate": _r(float(np.mean(mv[have] > 0)) if nh else None),
            "random_mean_z": _r(centre),
            "random_hit_rate": _r(float(np.nanmean(rmv[~np.isnan(rmv)] > 0))),
            "p_random": _r(p_val, 4),
            "n_non_overlapping": int(np.sum(~np.isnan(zk))),
            "mean_z_non_overlapping": _r(np.nanmean(zk) if np.any(~np.isnan(zk)) else None),
        }
    # q-values across the three horizons of this one study
    qs = bh([res["horizons"][h]["p_random"] for h in HORIZONS])
    for h, q in zip(HORIZONS, qs, strict=True):
        res["horizons"][h]["q"] = _r(q, 4)

    # The events themselves, biggest 5 day move first, with their headlines.
    days = headline_days(p, sub)
    if not days.empty:
        days = days[days["base"].isin(bases)]
        flag_of = dict(zip(bases.tolist(), flags.tolist(), strict=True))
        days = days.reindex(days["z_5d"].abs().sort_values(ascending=False).index)
        for r in days.head(keep_events).to_dict("records"):
            res["events"].append({"base_date": r["base_date"], "event_date": _date(r["event_date"]),
                                  "overlaps": bool(flag_of.get(r["base"], False)),
                                  "n_headlines": int(r["n_headlines"]),
                                  **{f"z_{h}": _r(r[f"z_{h}"]) for h in HORIZONS},
                                  **{f"move_{h}": _r(r[f"move_{h}"], 4) for h in HORIZONS},
                                  "items": r["items"][:3]})
    res["warnings"] += _warnings(res)
    return res


def _warnings(res: dict) -> list[str]:
    w = []
    n = res["n_events"]
    if n < MIN_EVENTS:
        w.append(f"Only {n} events. Too few to tell a pattern from luck.")
    if n and res.get("n_overlapping", 0) / n > 0.3:
        w.append(f"{res['n_overlapping']} of {n} events start within 20 trading days of "
                 "another, so their paths overlap and the band is too narrow. Compare the "
                 "non-overlapping average.")
    w.append("This describes what happened after past headlines. It is not a prediction.")
    return w


# ------------------------------------------------------------------ 3. rankings


POLICY_BANKS = {"USD": "fed", "EUR": "ecb", "JPY": "boj"}
_POLICY_CACHE: dict = {}


def policy_changes(root: Path = data_store.DEFAULT_DIR) -> dict[tuple[str, str], int]:
    """(source, date) -> +1 or -1 for days a central bank's policy rate moved (BIS daily
    policy rates). Lets "rate hike" find decision days whose headline only says
    "FOMC statement" or "Monetary policy decisions"."""
    key = str(root)
    if key not in _POLICY_CACHE:
        out = {}
        for ccy, src in POLICY_BANKS.items():
            try:
                s = data_store.load(f"policy.{ccy}", root).dropna()
            except (FileNotFoundError, KeyError):
                continue
            d = s[~s.index.duplicated(keep="last")].sort_index().diff()
            for day, v in d[d != 0].dropna().items():
                out[(src, day.date().isoformat())] = 1 if v > 0 else -1
        _POLICY_CACHE[key] = out
    return _POLICY_CACHE[key]


def matching(items: pd.DataFrame, query: str,
             root: Path | None = data_store.DEFAULT_DIR) -> pd.DataFrame:
    """Items a topic or keyword query matches. For "rate hike" and "rate cut" this also
    takes a central bank decision whose policy rate moved that way on the day or the
    next day, so it does not depend on how the headline was worded."""
    if items.empty:
        return items
    hit = archive.matches(items, query)
    ids = archive.topic_ids(query)
    sign = 1 if "rate-hike" in ids else -1 if "rate-cut" in ids else 0
    if sign and root is not None and "topics" in items:
        moves = policy_changes(root)
        if moves:
            dec = items["topics"].apply(lambda t: "policy-decision" in t)
            day = pd.to_datetime(items["published_at"], utc=True).dt.tz_convert(
                "America/New_York").dt.date
            nxt = day + pd.Timedelta(days=1)
            moved = [ok and sign in (moves.get((s, d0.isoformat())), moves.get((s, d1.isoformat())))
                     for ok, s, d0, d1 in zip(dec, items["source"], day, nxt, strict=True)]
            hit = hit | pd.Series(moved, index=items.index)
    return items[hit]


def rank_assets(query: str, items: pd.DataFrame, assets: list[str] | None = None,
                horizon: str = "5d", start=None, end=None, prepared: dict | None = None,
                draws: int = RANDOM_DRAWS, root: Path = data_store.DEFAULT_DIR) -> dict:
    """Which assets moved most unusually after a topic, ranked by evidence."""
    sub = matching(items, query)
    rows = []
    for key in assets or DEFAULT_ASSETS:
        try:
            p = (prepared or {}).get(key) or prepare(key, root=root)
        except (FileNotFoundError, KeyError):
            continue
        st = event_study(key, sub, start, end, p=p, draws=draws, keep_events=0)
        rows.append(_rank_row(st, horizon, asset=key, label=p.label))
    return _ranked(rows, f"assets after '{query}'", horizon)


def rank_topics(key: str, items: pd.DataFrame, topics: list[str] | None = None,
                horizon: str = "5d", start=None, end=None, p: Prepared | None = None,
                draws: int = RANDOM_DRAWS, root: Path = data_store.DEFAULT_DIR) -> dict:
    """Which topics were followed by the most unusual moves in one asset."""
    p = p or prepare(key, root=root)
    rows = []
    for t in topics or list(tagging.TOPICS):
        st = event_study(key, matching(items, t), start, end, p=p, draws=draws, keep_events=0)
        rows.append(_rank_row(st, horizon, topic=t, label=tagging.TOPIC_LABEL.get(t, t)))
    return _ranked(rows, f"topics for {p.label}", horizon)


def _rank_row(st: dict, horizon: str, **ids) -> dict:
    h = st["horizons"].get(horizon, {})
    return {**ids, "n_events": st["n_events"], "n_overlapping": st.get("n_overlapping", 0),
            "mean_z": h.get("mean_z"), "median_z": h.get("median_z"),
            "ci_lo": h.get("ci_lo"), "ci_hi": h.get("ci_hi"), "hit_rate": h.get("hit_rate"),
            "random_hit_rate": h.get("random_hit_rate"), "mean_move": h.get("mean_move"),
            "p_random": h.get("p_random") if st["n_events"] >= 5 else None}


def _ranked(rows: list[dict], what: str, horizon: str) -> dict:
    qs = bh([r["p_random"] if r["p_random"] is not None else np.nan for r in rows])
    for r, q in zip(rows, qs, strict=True):
        r["q"] = _r(q, 4)
        r["thin"] = r["n_events"] < MIN_EVENTS
    rows.sort(key=lambda r: (r["q"] is None, r["q"] if r["q"] is not None else 1,
                             -abs(r["mean_z"] or 0)))
    tried = sum(1 for r in rows if r["p_random"] is not None)
    return {"what": what, "horizon": horizon, "tried": tried, "rows": rows,
            "warnings": [f"{tried} comparisons were tried. q is the p-value corrected for "
                         "that (Benjamini-Hochberg); treat q above 0.10 as noise." if tried else
                         "No pair has enough events to test yet (5 or more), so nothing here "
                         "is evidence.",
                         "Ranked by strength of evidence, not by size of move. Not a "
                         "prediction."]}


# ------------------------------------------------------------------ helpers


def _in_range(items: pd.DataFrame, start, end) -> pd.DataFrame:
    if items.empty or (start is None and end is None):
        return items
    lo, hi = archive._bounds(start, end)
    ts = pd.to_datetime(items["published_at"], utc=True)
    keep = pd.Series(True, index=items.index)
    if lo is not None:
        keep &= ts >= lo
    if hi is not None:
        keep &= ts < hi
    return items[keep]


def _brief(r: dict) -> dict:
    ts = pd.Timestamp(r["published_at"])
    return {"id": r.get("id", ""), "title": r.get("title", ""), "url": r.get("url", ""),
            "source": r.get("source", ""), "publisher": r.get("publisher") or "",
            "published_at": ts.isoformat()}
