"""Verify's claim arithmetic (REF-0016, DEC-0082) in Python, for the local MCP server.

The same five rules as web/src/lib/verify/checks/claims.ts, word for word, so `parity mcp`
and the hosted server at /mcp answer a claim the same way. The full record checks (the
five cards for a trade list or equity curve) run only on the hosted server and the API;
they are not ported here. Rates are fractions: 0.92 means 92%.
"""

from __future__ import annotations

import math

METHOD_VERSION = "verify-1.0"
SP500_LONG_RUN = 0.1
FIELDS = ("winRate", "monthlyReturn", "maxDrawdown", "takeProfit", "stopLoss", "avgLoss",
          "maxLoss", "tradesPerMonth", "trades", "months", "leverage", "grid", "martingale",
          "maxLossCapped")


def _pct(v: float, d: int = 1) -> str:
    s = f"{v * 100:.{d}f}"
    return (s[:-2] if s.endswith(".0") else s) + "%"


def _round(v: float) -> int:
    """Math.round: halves go up, as in the TypeScript."""
    return int(math.floor(v + 0.5))


def break_even_loss(take_profit: float, win_rate: float) -> float:
    return math.inf if win_rate >= 1 else take_profit * win_rate / (1 - win_rate)


def _breakeven(c: dict) -> dict | None:
    tp, wr, sl = c.get("takeProfit"), c.get("winRate"), c.get("stopLoss")
    if tp is None or wr is None:
        return None
    be = break_even_loss(tp, wr)
    if sl is not None:
        if sl > be:
            return {"id": "breakeven", "status": "fail", "text": (
                f"A {_pct(wr)} win rate with a {_pct(tp)} take-profit breaks even only if losses "
                f"average under {_pct(be)} of a position. The stated {_pct(sl)} stop-loss is "
                "wider, so if most losers hit it, the average trade loses money before costs.")}
        return {"id": "breakeven", "status": "info", "text": (
            f"A {_pct(wr)} win rate with a {_pct(tp)} take-profit breaks even if losses average "
            f"under {_pct(be)} of a position. The stated {_pct(sl)} stop-loss is inside that, "
            "so the claim adds up before costs.")}
    return {"id": "breakeven", "status": "warn", "text": (
        f"A {_pct(wr)} win rate with a {_pct(tp)} take-profit and no stop needs the average "
        f"loss to stay under {_pct(be)} of a position to break even ({_pct(tp)} x {wr:.2f} / "
        f"{1 - wr:.2f}). With no stop, nothing keeps it there.")}


def _drawdown(c: dict) -> dict | None:
    dd, ml = c.get("maxDrawdown"), c.get("maxLoss")
    if dd is None or ml is None or dd >= ml:
        return None
    return {"id": "drawdown", "status": "fail", "text": (
        f"The claimed largest fall of {_pct(dd)} is smaller than the claimed single loss of "
        f"{_pct(ml)}. One loss alone is a fall at least that big, so both cannot be true.")}


def _monthly(c: dict) -> dict | None:
    m, months = c.get("monthlyReturn"), c.get("months")
    if m is None or m <= 0.1 or (months is not None and months <= 12):
        return None
    yearly = (1 + m) ** 12 - 1
    grow = (1 + m) ** 24
    return {"id": "monthly", "status": "warn", "text": (
        f"{_pct(m)} a month compounds to {_round(yearly * 100):,}% a year, against about "
        f"{_pct(SP500_LONG_RUN, 0)} a year for the S&P 500 over the long run. Kept up for two "
        f"years it would turn $1,000 into ${_round(1000 * grow):,}.")}


def _uncapped(c: dict) -> dict | None:
    if not (c.get("grid") or c.get("martingale")) or c.get("maxLossCapped") \
            or c.get("maxLoss") is not None or c.get("stopLoss") is not None:
        return None
    kind = "martingale" if c.get("martingale") else "grid"
    return {"id": "uncapped", "status": "fail", "text": (
        f"Loss is not capped. A {kind} bot adds to losing positions, and with no stated "
        "maximum loss one long move against it can take the whole account.")}


def _win_rate_alone(c: dict) -> dict | None:
    wr = c.get("winRate")
    if wr is None or wr <= 0.9 or c.get("avgLoss") is not None or c.get("stopLoss") is not None:
        return None
    return {"id": "winrate", "status": "warn", "text": (
        f"The win rate alone says nothing about profit. At {_pct(wr)}, the record loses money "
        f"if the average loss is more than {wr / (1 - wr):.1f} times the average win, and the "
        "claim does not say how big losses are.")}


def claim_rows(claim: dict) -> list[dict]:
    rules = (_breakeven, _drawdown, _monthly, _uncapped, _win_rate_alone)
    return [r for r in (rule(claim) for rule in rules) if r is not None]


def _word(row: dict) -> str:
    if row["status"] == "fail":
        return "loss_not_capped" if row["id"] == "uncapped" else "impossible"
    return "needs_more_data" if row["status"] == "warn" else "adds_up"


def check_claim(claim: dict, settings: int | None = None, trades: int | None = None) -> dict:
    """The verdict, the sentence and each claim marked impossible, needs_more_data,
    loss_not_capped or adds_up, as the hosted verify_claim gives them."""
    unknown = sorted(set(claim) - set(FIELDS))
    if unknown:
        raise ValueError(f"unknown claim fields {unknown}; known: {', '.join(FIELDS)}")
    for k, v in claim.items():
        if not isinstance(v, (int, float, bool)):
            raise ValueError(f"claim.{k} must be a number or true/false")
    rows = claim_rows(claim)
    settings_fail = settings is not None and trades is not None and settings > trades / 20
    contra = [r for r in rows if r["status"] == "fail" and r["id"] != "uncapped"]
    uncapped = next((r for r in rows if r["id"] == "uncapped"), None)
    if contra:
        verdict = ("does_not_hold_up", "Does not hold up",
                   f"{contra[0]['text']} Verify checked the description only.")
    elif uncapped or settings_fail:
        why = uncapped["text"] if uncapped else (
            f"{settings} adjustable settings for {trades} trades: more than one setting per 20 "
            "trades, so the rules can be fitted to almost any past data.")
        verdict = ("fragile", "Fragile", f"{why} Verify checked the description only.")
    else:
        tail = "A description cannot show an edge. Upload the bot's trade log to check it."
        sentence = (f"Nothing in the description fails on arithmetic, but "
                    f"{rows[0]['text'][0].lower()}{rows[0]['text'][1:]} {tail}" if rows
                    else f"Nothing in the description fails on arithmetic. {tail}")
        verdict = ("not_enough_data", "Not enough data", sentence)
    claims = [{"id": r["id"], "status": _word(r), "text": r["text"]} for r in rows]
    return {
        "verdict": {"id": verdict[0], "label": verdict[1], "sentence": verdict[2]},
        "sentence": verdict[2],
        "claims": claims,
        "impossible": sum(c["status"] == "impossible" for c in claims),
        "needs_more_data": sum(c["status"] == "needs_more_data" for c in claims),
        "claim_used": claim,
        "method_version": METHOD_VERSION,
        "could_not_check": [{"check": "Whether the claimed results happened",
                             "why": "A claim is not a record. Send the trade list or equity "
                                    "curve to verify_trades on the hosted server."}],
    }
