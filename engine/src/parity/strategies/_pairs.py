"""Pairs trading and statistical arbitrage blocks (DEC-0070, RES-0028).

Four ways to find two prices that should move together and bet on the gap closing:

- distance (Gatev, Goetzmann and Rouwenhorst 2006): the pairs whose normalised prices
  stayed closest over the formation window.
- cointegration (Engle and Granger 1987) with a half-life filter: pairs whose spread
  passed a unit root test and closes its gaps within `hl_max` days.
- Kalman: the cointegration choice, but a hedge ratio that drifts day by day.
- PCA residuals (Avellaneda and Lee 2010): each asset against the main common factors;
  trade the part those factors do not explain when it is stretched.

How a pair book runs: every `trading` days it looks back `formation` days, using only data
up to that day, and picks up to `top` pairs. For the next `trading` days it opens a pair
when its z-score passes `entry`, closes when it comes back inside `exit`, and stops out
when it passes `stop` (the pair may have broken; it is not reopened in that window). A
time stop closes a trade held more than `max_hold` half-lives. Everything still open is
closed at the end of the window.

Each open pair holds 1/`top` of capital: long one leg and short the other, sized by the
hedge ratio so the two legs net out. Short legs pay `borrow_bps` a year (the backtester
charges it); every trade pays at least `min_cost_bps`.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from ..pairs import stats
from ._blocks import Block

STATE_CLOSED, STATE_OPEN = 0, 1


def _usable(px: pd.DataFrame) -> pd.Series:
    """Columns with a full, moving history in this window. French files fill gaps with
    flat runs; a column flat for a tenth of the window is left out."""
    full = px.notna().all()
    flat = (px.diff().abs() < 1e-12).mean() > 0.1
    return full & ~flat


class PairsBook(Block):
    """Shared formation, trading and sizing for pair methods."""

    candidates: list[tuple[str, str]] = []
    method = "cointegration"
    funded = False
    max_gross = 1.0
    min_cost_bps = 10.0
    borrow_bps = 50.0
    defaults = {"formation": 252, "trading": 126, "top": 5, "entry": 2.0, "exit": 0.5,
                "stop": 4.0, "pmax": 0.05, "hl_max": 60, "max_hold": 3.0, "delta": 1e-6,
                "rebalance": "D"}

    def instruments(self):
        return sorted({k for p in self.candidates for k in p})

    # --- choosing pairs at a formation date ---------------------------------------

    def select(self, logp: pd.DataFrame) -> list[dict]:
        ok = _usable(logp)
        picks = []
        for a, b in self.candidates:
            if not (ok.get(a, False) and ok.get(b, False)):
                continue
            ya, yb = logp[a].values, logp[b].values
            if self.method == "distance":
                na, nb = ya - ya[0], yb - yb[0]
                gap = na - nb
                picks.append({"a": a, "b": b, "score": float((gap ** 2).sum()), "beta": 1.0,
                              "alpha": float(ya[0] - yb[0]), "mean": 0.0,
                              "sd": float(gap.std(ddof=1)), "hl": stats.half_life(gap),
                              "p": float("nan")})
                continue
            eg = stats.engle_granger(ya, yb)
            hl = stats.half_life(eg["spread"])
            if eg["p"] > self.pmax or not 1 <= hl <= self.hl_max or eg["beta"] <= 0:
                continue
            picks.append({"a": a, "b": b, "score": eg["p"], "beta": eg["beta"],
                          "alpha": eg["alpha"], "mean": eg["mean"], "sd": eg["sd"], "hl": hl,
                          "p": eg["p"]})
        picks = [p for p in picks if p["sd"] > 0]
        return sorted(picks, key=lambda p: (p["score"], p["a"], p["b"]))[: self.top]

    def zscore(self, pick: dict, logp: pd.DataFrame, rows: slice, kal: dict | None
               ) -> tuple[np.ndarray, np.ndarray]:
        """z-scores and hedge ratios for one pick over the trading rows."""
        ya, yb = logp[pick["a"]].values[rows], logp[pick["b"]].values[rows]
        if self.method == "distance":
            z = ((ya - yb) - pick["alpha"] - pick["mean"]) / pick["sd"]
            return z, np.ones_like(z)
        if self.method == "kalman" and kal is not None:
            return kal["z"][rows], kal["beta"][rows]
        z = (ya - pick["alpha"] - pick["beta"] * yb - pick["mean"]) / pick["sd"]
        return z, np.full_like(z, pick["beta"])

    # --- the trading loop -----------------------------------------------------------

    def run_book(self, panel: pd.DataFrame) -> dict:
        """Weights, the trade log and the picks, all decided from data up to each day."""
        cols = self.instruments()
        logp = np.log(panel[cols].where(panel[cols] > 0))
        n = len(logp)
        w = np.zeros((n, len(cols)))
        col_ix = {c: i for i, c in enumerate(cols)}
        trades, picks_log = [], []
        kalman: dict[tuple[str, str], dict] = {}
        if self.method == "kalman":
            for a, b in self.candidates:
                k = stats.kalman_hedge(logp[a].values, logp[b].values, delta=self.delta,
                                       ve=1e-3)
                # The filter's own error variance depends on a guess for the noise; the
                # spread's past spread does not. z = today's error over its sd in the
                # past formation window (data up to today only).
                e = pd.Series(k["e"])
                k["z"] = (e / e.rolling(self.formation, min_periods=60).std()).values
                kalman[(a, b)] = k
        size = 1.0 / self.top
        f = self.formation - 1
        while f < n:
            window = logp.iloc[f - self.formation + 1: f + 1]
            end = min(f + self.trading, n)
            picks = self.select(window)
            for pick in picks:
                picks_log.append({"date": logp.index[f], **{k: v for k, v in pick.items()}})
                rows = slice(f, end)
                z, beta = self.zscore(pick, logp, rows, kalman.get((pick["a"], pick["b"])))
                side, opened, blocked, hedge = 0, None, False, 1.0
                hl = pick["hl"] if np.isfinite(pick["hl"]) else self.formation
                for j in range(end - f):
                    t = f + j
                    zt = z[j]
                    # The window's last day comes from the schedule, never from where the
                    # data stops, so a shorter panel gives the same weights.
                    last = j == self.trading - 1
                    if side and (not np.isfinite(zt) or last):
                        trades.append(self._close(pick, opened, t, side, hedge, zt, "window end"))
                        side = 0
                    elif side and abs(zt) > self.stop:
                        trades.append(self._close(pick, opened, t, side, hedge, zt, "stop-out"))
                        side, blocked = 0, True
                    elif side and t - opened > self.max_hold * max(hl, 1):
                        trades.append(self._close(pick, opened, t, side, hedge, zt, "time stop"))
                        side, blocked = 0, True
                    elif side > 0 and zt > -self.exit or side < 0 and zt < self.exit:
                        trades.append(self._close(pick, opened, t, side, hedge, zt, "converged"))
                        side = 0
                    elif (not side and not blocked and not last and np.isfinite(zt)
                          and self.entry < abs(zt) < self.stop):
                        side, opened = -int(np.sign(zt)), t
                        hedge = float(beta[j]) if np.isfinite(beta[j]) and beta[j] > 0 else 1.0
                    if side:
                        wa = side / (1 + hedge)
                        w[t, col_ix[pick["a"]]] += wa * size
                        w[t, col_ix[pick["b"]]] += -wa * hedge * size
            f += self.trading
        weights = pd.DataFrame(w, index=logp.index, columns=cols)
        return {"weights": weights, "trades": trades, "picks": picks_log}

    def _close(self, pick, opened, t, side, hedge, zt, kind) -> dict:
        return {"a": pick["a"], "b": pick["b"], "open": opened, "close": t, "side": side,
                "hedge": hedge, "z": float(zt) if np.isfinite(zt) else None, "kind": kind}

    def weights(self, panel):
        return self.run_book(panel)["weights"]


class PCABook(Block):
    """Avellaneda and Lee (2010) residual reversion. Every `refit` days: the main
    `factors` principal components of the past `corr_window` days of returns, each
    asset's leftover over the past `ou_window` days fitted as a mean-reverting process,
    and its s-score (how stretched the leftover is). Long below -entry, short above
    entry, close inside `exit`, skip assets whose leftover takes more than `hl_max` days
    to halve. The book is hedged against the factors and reaches full size at `slots`
    open positions."""

    universe: list[str] = []
    method = "pca"
    funded = False
    max_gross = 1.0
    min_cost_bps = 10.0
    borrow_bps = 50.0
    defaults = {"corr_window": 252, "ou_window": 60, "factors": 3, "entry": 1.25, "exit": 0.5,
                "stop": 4.0, "hl_max": 20, "refit": 5, "slots": 10, "rebalance": "D"}

    def instruments(self):
        return list(self.universe)

    def scores(self, panel: pd.DataFrame, t: int, rets: pd.DataFrame
               ) -> tuple[pd.Series, pd.DataFrame, pd.DataFrame] | None:
        win = rets.iloc[t - self.corr_window + 1: t + 1]
        px = panel[self.universe].iloc[t - self.corr_window: t + 1]
        ok = _usable(px)
        cols = [c for c in self.universe if ok.get(c, False)]
        if len(cols) < self.factors + 5:
            return None
        r = win[cols].values
        sd = r.std(axis=0, ddof=1)
        if (sd <= 0).any():
            return None
        y = (r - r.mean(axis=0)) / sd
        corr = y.T @ y / (len(y) - 1)
        vals, vecs = np.linalg.eigh(corr)
        v = vecs[:, ::-1][:, : self.factors]
        q = v / sd[:, None]                       # eigenportfolio weights, one column each
        fac = r @ q                                # factor returns
        rr, ff = r[-self.ou_window:], fac[-self.ou_window:]
        x = np.column_stack([np.ones(len(ff)), ff])
        coef, *_ = np.linalg.lstsq(x, rr, rcond=None)
        eps = rr - x @ coef
        xs = np.cumsum(eps, axis=0)
        lag, now = xs[:-1], xs[1:]
        s = pd.Series(np.nan, index=cols)
        hl = pd.Series(np.nan, index=cols)
        m_all, sig = np.full(len(cols), np.nan), np.full(len(cols), np.nan)
        for i in range(len(cols)):
            a, b = stats.hedge_ratio(now[:, i], lag[:, i])
            if not 0 < b < 1:
                continue
            zeta = now[:, i] - a - b * lag[:, i]
            m_all[i] = a / (1 - b)
            sig[i] = math.sqrt(zeta.var(ddof=1) / (1 - b * b))
            hl[cols[i]] = math.log(2) / -math.log(b)
        good = np.isfinite(m_all) & (sig > 0)
        if good.sum() < 3:
            return None
        centred = m_all - np.nanmean(m_all[good])
        s[:] = np.where(good, -centred / np.where(sig > 0, sig, np.nan), np.nan)
        s[hl > self.hl_max] = np.nan
        betas = pd.DataFrame(coef[1:].T, index=cols)
        qdf = pd.DataFrame(q, index=cols)
        return s, betas, qdf

    def weights(self, panel):
        px = panel[self.universe].where(panel[self.universe] > 0)
        rets = np.log(px).diff()
        n = len(px)
        out = np.zeros((n, len(self.universe)))
        ix = {c: i for i, c in enumerate(self.universe)}
        state = dict.fromkeys(self.universe, 0)
        held = np.zeros(len(self.universe))
        start = self.corr_window
        for t in range(start, n):
            if (t - start) % self.refit == 0:
                got = self.scores(panel, t, rets)
                held = np.zeros(len(self.universe))
                if got is not None:
                    s, betas, q = got
                    for c in self.universe:
                        sc = s.get(c, np.nan)
                        side = state[c]
                        if not np.isfinite(sc) or abs(sc) > self.stop:
                            side = 0
                        elif side == 0 and sc < -self.entry:
                            side = 1
                        elif side == 0 and sc > self.entry:
                            side = -1
                        elif side == 1 and sc > -self.exit or side == -1 and sc < self.exit:
                            side = 0
                        state[c] = side
                    open_ = [c for c in s.index if state[c]]
                    if open_:
                        w = pd.Series({c: float(state[c]) for c in open_})
                        expo = betas.loc[open_].mul(w, axis=0).sum()
                        full = pd.Series(0.0, index=s.index)
                        full[open_] = w
                        full = full - q.mul(expo, axis=1).sum(axis=1)
                        gross = full.abs().sum()
                        scale = min(1.0, len(open_) / self.slots) / gross if gross > 0 else 0
                        for c, v in (full * scale).items():
                            held[ix[c]] = v
                else:
                    state = dict.fromkeys(self.universe, 0)
            out[t] = held
        return pd.DataFrame(out, index=px.index, columns=self.universe)
