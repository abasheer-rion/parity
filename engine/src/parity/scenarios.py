"""Historical analogues for made-up scenarios ("what if Iran strikes X?").

This does not forecast. It answers a narrower question: after past events that look
like the scenario, what did markets do over the next day, week, month and quarter,
and how much did that vary? The method is a standard event study (MacKinlay 1997):

* each event in catalog/events/*.json gets a base close, the last close strictly
  before the event date, so news that broke during a trading day is not half priced
  in at the base;
* the reaction over h trading days is the change from that base to the h-th close
  of the series' own trading days after it (so a market shut after 9/11 is measured
  from its next real close, not a forward filled copy);
* each reaction is also scaled by the asset's daily volatility over the year before
  the event, times sqrt(h), so a 3% oil move in a calm year and in a wild year can
  be compared (a z-score).

The matcher scores every event against a scenario spec and aggregates the closest
ones: median, interquartile range, share of events with a rise, and the count. The
web page repeats the same scoring from the `matcher` block in the exported JSON.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .data import store

ROOT = Path(__file__).resolve().parents[3]
EVENTS_DIR = ROOT / "catalog" / "events"

TYPES = ["war", "military_strike", "terrorist_attack", "oil_supply_shock", "sanctions",
         "trade_war", "supply_chain_shock", "pandemic", "financial_crisis", "sovereign_default",
         "currency_crisis", "bank_run", "rate_shock", "central_bank_surprise", "crypto_crash",
         "election", "political_crisis", "natural_disaster"]
REGIONS = ["middle_east", "europe", "russia_cis", "east_asia", "south_asia", "north_america",
           "latin_america", "africa", "oceania", "global"]
COMMODITIES = ["oil", "gas", "metals", "grains"]

# Event types that tend to move markets through the same channel share a family.
FAMILIES = {
    "war": "conflict", "military_strike": "conflict", "terrorist_attack": "conflict",
    "oil_supply_shock": "supply", "sanctions": "supply", "trade_war": "supply",
    "supply_chain_shock": "supply",
    "pandemic": "pandemic", "natural_disaster": "disaster",
    "financial_crisis": "financial", "central_bank_surprise": "financial",
    "sovereign_default": "financial", "currency_crisis": "financial", "bank_run": "financial",
    "rate_shock": "financial", "crypto_crash": "crypto",
    "election": "political", "political_crisis": "political",
}
WEIGHTS = {"type": 3.0, "family": 1.5, "region": 2.0, "global_region": 0.5,
           "actors_each": 1.0, "actors_cap": 2.0, "severity": 1.0, "commodity": 1.0}
MIN_SCORE = 0.35
MAX_ANALOGUES = 12

HORIZONS = [("1d", 1, "1 day"), ("1w", 5, "1 week"), ("1m", 21, "1 month"),
            ("3m", 63, "3 months")]
PATH_DAYS = 63
VOL_WINDOW = 252


@dataclass(frozen=True)
class Asset:
    key: str
    label: str
    series: str          # catalog key, or "basket" for the dollar index we build
    measure: str         # pct: percent change; points: level change; bp: basis points
    group: str
    note: str = ""


FX_NOTE = "value of the currency in US dollars; up means it gained on the dollar"
ASSETS = [
    Asset("oil", "Oil (WTI)", "cmd.WTI", "pct", "commodities", "US crude, USD per barrel"),
    Asset("brent", "Oil (Brent)", "cmd.BRENT", "pct", "commodities", "North Sea crude"),
    Asset("gas", "US natural gas", "cmd.HH_GAS", "pct", "commodities", "Henry Hub spot"),
    Asset("sp500", "US stocks", "eq.US_TOTAL", "pct", "stocks",
          "US market total return (S&P 500 proxy)"),
    Asset("vix", "VIX (fear gauge)", "risk.VIX", "points", "risk", "change in index points"),
    Asset("ust10y", "US 10-year yield", "bond.UST10Y", "bp", "rates",
          "change in basis points; down means bond prices rose"),
    Asset("tbill3m", "US 3-month bill", "rate.TBILL3M", "bp", "rates", "change in basis points"),
    Asset("usd", "US dollar", "basket", "pct", "currencies",
          "equal weight against the G10 currencies we track; up means a stronger dollar"),
    Asset("jpy", "Japanese yen", "fx.JPY", "pct", "currencies", FX_NOTE),
    Asset("chf", "Swiss franc", "fx.CHF", "pct", "currencies", FX_NOTE),
    Asset("eur", "Euro", "fx.EUR", "pct", "currencies", FX_NOTE),
    Asset("gbp", "British pound", "fx.GBP", "pct", "currencies", FX_NOTE),
    Asset("cad", "Canadian dollar", "fx.CAD", "pct", "currencies", FX_NOTE),
    Asset("aud", "Australian dollar", "fx.AUD", "pct", "currencies", FX_NOTE),
    Asset("nok", "Norwegian krone", "fx.NOK", "pct", "currencies", FX_NOTE),
]
BASKET = ["fx.EUR", "fx.GBP", "fx.JPY", "fx.CHF", "fx.CAD", "fx.AUD", "fx.NZD", "fx.NOK",
          "fx.SEK"]


# ---------------------------------------------------------------- events

def load_events(directory: Path = EVENTS_DIR) -> list[dict]:
    """Every catalog event, oldest first."""
    events = [json.loads(p.read_text()) for p in sorted(directory.glob("*.json"))]
    return sorted(events, key=lambda e: e["date"])


# ---------------------------------------------------------------- prices

def dollar_basket(fx: pd.DataFrame, min_ccy: int = 5) -> pd.Series:
    """An equal weight US dollar index from USD-per-foreign-unit rates.

    The dollar's daily log change is minus the average log change of the foreign
    currencies present that day. Days with fewer than `min_ccy` quotes are dropped.
    """
    dlog = -np.log(fx).diff()
    count = dlog.notna().sum(axis=1)
    mean = dlog.mean(axis=1).where(count >= min_ccy)
    first = fx.dropna(how="all").index.min()
    mean = mean.loc[first:]
    mean.iloc[0] = 0.0
    mean = mean.dropna()
    return np.exp(mean.cumsum()).rename("basket")


def _dedup(s: pd.Series) -> pd.Series:
    return s[~s.index.duplicated(keep="last")].sort_index()


def load_prices(root: Path = store.DEFAULT_DIR) -> dict[str, pd.Series]:
    """Each asset as its own series of real closes (no forward fill), by asset key.

    Assets whose cache file is missing are skipped, so a partial fetch still works.
    """
    out: dict[str, pd.Series] = {}
    for a in ASSETS:
        try:
            if a.series == "basket":
                fx = pd.concat([_dedup(store.load(k, root)) for k in BASKET], axis=1)
                s = dollar_basket(fx)
            else:
                s = store.load(a.series, root)
        except FileNotFoundError:
            continue
        out[a.key] = _dedup(s).dropna()
    return out


def _change(values: np.ndarray, base: float, measure: str) -> np.ndarray:
    if measure == "pct":
        return (values / base - 1.0) * 100.0
    if measure == "bp":
        return (values - base) * 100.0
    return values - base


def event_reaction(series: pd.Series, date: str | pd.Timestamp, measure: str,
                   path_days: int = PATH_DAYS) -> dict | None:
    """Reaction of one series to one event.

    Returns {"horizons": {key: {"change", "z"}}, "path": [...]} or None when the
    series has no close before the event. Horizons beyond the end of the data are
    left out, so a recent event simply has fewer of them.
    """
    when = pd.Timestamp(date)
    s = series.dropna()
    before = s.loc[s.index < when]
    if before.empty or (when - before.index[-1]).days > 10:
        return None  # series had not started, or a long gap: no fair base
    base = float(before.iloc[-1])
    if measure == "pct" and base <= 0:
        return None
    after = s.loc[s.index >= when].iloc[:path_days]
    path = np.concatenate([[0.0], _change(after.to_numpy(float), base, measure)])

    window = before.iloc[-(VOL_WINDOW + 1):]
    if measure == "pct":
        window = window[window > 0]  # WTI closed below zero in April 2020
        daily = np.diff(np.log(window.to_numpy(float))) * 100.0
    else:
        daily = _change(np.diff(window.to_numpy(float)), 0.0, measure)
    vol = float(np.std(daily, ddof=1)) if daily.size > 60 else float("nan")

    horizons = {}
    for key, days, _ in HORIZONS:
        if days < len(path):
            change = float(path[days])
            z = change / (vol * math.sqrt(days)) if vol and vol > 0 else None
            horizons[key] = {"change": round(change, 3),
                             "z": None if z is None or not math.isfinite(z) else round(z, 2)}
    return {"horizons": horizons, "path": [round(float(v), 3) for v in path]}


def event_study(events: list[dict], prices: dict[str, pd.Series]) -> list[dict]:
    """Each event with `reactions` and `paths` for every asset that covers its date."""
    measures = {a.key: a.measure for a in ASSETS}
    out = []
    for ev in events:
        reactions, paths = {}, {}
        for key, series in prices.items():
            r = event_reaction(series, ev["date"], measures[key])
            if r and r["horizons"]:
                reactions[key] = r["horizons"]
                paths[key] = r["path"]
        out.append({**ev, "reactions": reactions, "paths": paths})
    return out


# ---------------------------------------------------------------- matching

@dataclass
class Spec:
    """A made-up scenario. Empty fields are ignored by the matcher."""
    type: str | None = None
    regions: list[str] = field(default_factory=list)
    actors: list[str] = field(default_factory=list)
    severity: int | None = None
    commodities: list[str] = field(default_factory=list)
    title: str = ""


def score(ev: dict, spec: Spec, weights: dict = WEIGHTS, require_family: bool = True
          ) -> float | None:
    """Similarity in [0, 1], or None when the event's family differs from the spec's."""
    pts = top = 0.0
    if spec.type:
        same_family = FAMILIES.get(ev["type"]) == FAMILIES.get(spec.type)
        if require_family and not same_family:
            return None
        top += weights["type"]
        pts += weights["type"] if ev["type"] == spec.type else (
            weights["family"] if same_family else 0.0)
    if spec.regions:
        top += weights["region"]
        if set(ev["regions"]) & set(spec.regions):
            pts += weights["region"]
        elif "global" in ev["regions"] or "global" in spec.regions:
            pts += weights["global_region"]
    if spec.actors:
        # full marks once every named actor (up to the cap) appears in the event
        top += min(weights["actors_cap"], weights["actors_each"] * len(set(spec.actors)))
        shared = len(set(ev["actors"]) & {a.lower() for a in spec.actors})
        pts += min(weights["actors_cap"], weights["actors_each"] * shared)
    if spec.severity:
        top += weights["severity"]
        pts += weights["severity"] * max(0.0, 1 - abs(ev["severity"] - spec.severity) / 4)
    if spec.commodities:
        top += weights["commodity"]
        if set(ev.get("commodities", [])) & set(spec.commodities):
            pts += weights["commodity"]
    return pts / top if top else 0.0


def match(events: list[dict], spec: Spec, min_score: float = MIN_SCORE,
          limit: int = MAX_ANALOGUES) -> list[tuple[float, dict]]:
    """Closest events first (ties go to the more recent), at most `limit`."""
    scored = [(s, ev) for ev in events if (s := score(ev, spec)) is not None and s >= min_score]
    scored.sort(key=lambda t: (t[0], t[1]["date"]), reverse=True)
    return scored[:limit]


def summarise(values: list[float]) -> dict | None:
    """Median, quartiles, range, share up and count of a list of reactions."""
    v = np.array([x for x in values if x is not None and math.isfinite(x)], float)
    if v.size == 0:
        return None
    q25, med, q75 = np.quantile(v, [0.25, 0.5, 0.75])
    return {"n": int(v.size), "median": float(med), "q25": float(q25), "q75": float(q75),
            "min": float(v.min()), "max": float(v.max()), "up": float((v > 0).mean())}


def aggregate(analogues: list[dict], assets: list[str] | None = None) -> dict:
    """{asset: {horizon: summary plus median_z}} over events that carry reactions."""
    keys = assets or [a.key for a in ASSETS]
    out: dict[str, dict] = {}
    for key in keys:
        per = {}
        for h, _, _ in HORIZONS:
            cells = [ev["reactions"][key][h] for ev in analogues
                     if h in ev.get("reactions", {}).get(key, {})]
            s = summarise([c["change"] for c in cells])
            if s:
                zs = [c["z"] for c in cells if c["z"] is not None]
                s["median_z"] = float(np.median(zs)) if zs else None
                per[h] = s
        if per:
            out[key] = per
    return out


# ---------------------------------------------------------------- library

# How many past events a summary rests on, in words. The thresholds are a plain reading
# aid, not a statistical test; the page always shows the count itself.
CONFIDENCE = [(20, "solid"), (10, "fair"), (5, "thin"), (0, "too few")]
CI_LEVEL = 0.90


def median_interval(values: list[float], level: float = CI_LEVEL) -> tuple[float, float] | None:
    """A distribution-free interval for the median (order statistics, binomial).

    With n sorted values, the median lies between the j-th and k-th of them with at least
    `level` probability, where j and k are the narrowest symmetric pair the binomial
    (n, 1/2) allows. Returns None when n is too small for any pair to reach the level
    (fewer than 5 values at 90%), which the page shows as "too few to say".
    """
    v = sorted(x for x in values if x is not None and math.isfinite(x))
    n = len(v)
    if n < 2:
        return None
    pmf = [math.comb(n, i) / 2 ** n for i in range(n + 1)]
    for j in range(n // 2, -1, -1):  # widen until the coverage is reached
        k = n - 1 - j
        cover = sum(pmf[j + 1:k + 1])
        if j < k and cover >= level:
            return v[j], v[k]
    return None


def confidence_word(n: int) -> str:
    return next(word for floor, word in CONFIDENCE if n >= floor)


def library(studied: list[dict]) -> dict:
    """What markets did after every kind of event, from the event study.

    For each type, and for each type's family, every asset and horizon gets the count,
    median, middle half, share up, a 90% interval for the median and a word for how many
    events it rests on. The direction "held" when the whole interval is on one side of
    zero; otherwise past cases were mixed.
    """
    def block(evs: list[dict]) -> dict:
        out: dict[str, dict] = {}
        for a in ASSETS:
            per = {}
            for h, _, _ in HORIZONS:
                vals = [ev["reactions"][a.key][h]["change"] for ev in evs
                        if h in ev.get("reactions", {}).get(a.key, {})]
                s = summarise(vals)
                if not s:
                    continue
                ci = median_interval(vals)
                held = None if ci is None else ("up" if ci[0] > 0 else "down" if ci[1] < 0
                                                else "mixed")
                per[h] = {"n": s["n"], "median": round(s["median"], 3),
                          "q25": round(s["q25"], 3), "q75": round(s["q75"], 3),
                          "up": round(s["up"], 3),
                          "ci": None if ci is None else [round(ci[0], 3), round(ci[1], 3)],
                          "held": held, "confidence": confidence_word(s["n"])}
            if per:
                out[a.key] = per
        return out

    def entry(evs: list[dict]) -> dict:
        regions: dict[str, int] = {}
        for ev in evs:
            for r in ev["regions"]:
                regions[r] = regions.get(r, 0) + 1
        dates = sorted(ev["date"] for ev in evs)
        return {"count": len(evs), "first": dates[0] if dates else None,
                "last": dates[-1] if dates else None, "regions": regions,
                "events": [ev["id"] for ev in sorted(evs, key=lambda e: e["date"])],
                "assets": block(evs)}

    by_type = {t: entry([ev for ev in studied if ev["type"] == t]) for t in TYPES}
    families = sorted(set(FAMILIES.values()))
    by_family = {f: entry([ev for ev in studied if FAMILIES.get(ev["type"]) == f])
                 for f in families}
    return {"level": CI_LEVEL, "confidence": [{"min": m, "word": w} for m, w in CONFIDENCE],
            "types": {t: e for t, e in by_type.items() if e["count"]},
            "families": {f: e for f, e in by_family.items() if e["count"]}}


# ---------------------------------------------------------------- export

def export(events: list[dict], prices: dict[str, pd.Series]) -> dict:
    """The static document the web page reads (see web/src/lib/scenarios.ts)."""
    studied = event_study(events, prices)
    lasts = [s.index.max() for s in prices.values()]
    actors = sorted({a for ev in events for a in ev["actors"]})
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_through": max(lasts).date().isoformat() if lasts else None,
        "horizons": [{"key": k, "days": d, "label": label} for k, d, label in HORIZONS],
        "assets": [{"key": a.key, "label": a.label, "series": a.series, "measure": a.measure,
                    "group": a.group, "note": a.note,
                    "first": prices[a.key].index.min().date().isoformat()
                    if a.key in prices else None} for a in ASSETS],
        "vocab": {"types": TYPES, "regions": REGIONS, "commodities": COMMODITIES,
                  "actors": actors},
        "matcher": {"weights": WEIGHTS, "families": FAMILIES, "require_family": True,
                    "min_score": MIN_SCORE, "max_analogues": MAX_ANALOGUES},
        "events": studied,
        "library": library(studied),
    }


def validate(events: list[dict]) -> list[str]:
    """Problems with catalog entries: unknown vocabulary, bad dates, duplicate ids."""
    problems, seen = [], set()
    for ev in events:
        eid = ev.get("id", "?")
        if eid in seen:
            problems.append(f"{eid}: duplicate id")
        seen.add(eid)
        try:
            pd.Timestamp(ev["date"])
        except (KeyError, ValueError):
            problems.append(f"{eid}: bad date")
        if ev.get("type") not in TYPES:
            problems.append(f"{eid}: unknown type {ev.get('type')}")
        problems += [f"{eid}: unknown region {r}" for r in ev.get("regions", [])
                     if r not in REGIONS]
        problems += [f"{eid}: unknown commodity {c}" for c in ev.get("commodities", [])
                     if c not in COMMODITIES]
        if ev.get("severity") not in range(1, 6):
            problems.append(f"{eid}: severity must be 1 to 5")
        if not ev.get("sources"):
            problems.append(f"{eid}: no sources")
    return problems
