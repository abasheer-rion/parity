"""ETF themes, matched by words in the fund's name.

A name rule is rough: a fund called "Income" may hold anything. The ETFs page says so,
and every theme carries a plain "what to check" line, because a theme is a story, not a
reason to buy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Theme:
    id: str
    label: str
    what: str
    check: str
    pattern: str
    glossary: str | None = None


THEMES: list[Theme] = [
    Theme("crypto", "Bitcoin and crypto", "Funds holding coins directly, crypto futures, or "
          "crypto companies.", "Swings of 50% or more are normal. Check whether it holds the "
          "coin itself or futures, which cost extra to roll.",
          r"BITCOIN|\bBTC\b|ETHER|\bETH\b|CRYPTO|SOLANA|\bXRP\b|BLOCKCHAIN|DIGITAL ASSET|"
          r"LITECOIN|DOGECOIN|\bSOL\b", "spot-bitcoin-etf"),
    Theme("leveraged", "Leveraged and inverse", "Funds that aim for two or three times, or the "
          "opposite of, one day's move.", "They reset daily and can lose money over months "
          "even when the index is flat.",
          r"\bULTRA|\b[23]X\b|\b-?[123](\.\d+)?X\b|\bBULL\b|\bBEAR\b|LEVERAGED|INVERSE|"
          r"DAILY TARGET|\bSHORT\b", "leveraged-etf-decay"),
    Theme("income", "Option income and covered calls", "Funds that sell options to pay out a "
          "high income.", "A high payout is not a high return. Check total return including "
          "price, and how much of the payout is your own money back.",
          r"PREMIUM INCOME|COVERED CALL|BUY-?WRITE|OPTION INCOME|YIELDMAX|\bINCOME OPTION|"
          r"ENHANCED INCOME|WEEKLYPAY|0DTE", "covered-call-etf"),
    Theme("buffer", "Buffer and defined outcome", "Funds that cushion part of a loss over a "
          "set period in exchange for a cap on gains.", "Buying mid-period can leave little "
          "buffer and little upside. Check the outcome period dates.",
          r"BUFFER|DEFINED OUTCOME|DEFINED PROTECTION|\bFLOOR\b|STRUCTURED OUTCOME|"
          r"MAX BUFFER|ACCELERATED", "buffer-etf"),
    Theme("ai", "AI, chips and robots", "Funds built around artificial intelligence, "
          "semiconductors, robotics and similar stories.", "Themes often launch after the "
          "stocks have already run up. Check fees and how few stocks dominate.",
          r"ARTIFICIAL INTELLIGENCE|\bAI\b|ROBOTIC|SEMICONDUCTOR|\bCHIP|MACHINE LEARNING|"
          r"AUTOMATION|QUANTUM|CLOUD COMPUTING|CYBERSECURITY|DATA CENTER", "thematic-etf"),
    Theme("energy-transition", "Clean energy, uranium and nuclear", "Funds around solar, "
          "wind, batteries, uranium and nuclear power.", "Narrow and volatile; several such "
          "funds fell more than half from their peaks. Check concentration.",
          r"CLEAN ENERGY|SOLAR|\bWIND\b|URANIUM|NUCLEAR|LITHIUM|BATTERY|HYDROGEN|"
          r"ELECTRIC VEHICLE|\bEV\b", "thematic-etf"),
    Theme("defense", "Defense and space", "Funds holding weapons makers, aerospace and space "
          "companies.", "A few large contractors usually dominate. Check the top holdings.",
          r"DEFENSE|DEFENCE|AEROSPACE|\bSPACE\b", "thematic-etf"),
    Theme("single-stock", "Single stock funds", "Funds that track, lever or sell options on "
          "one company's shares.", "All the risk of one stock, often with leverage or option "
          "selling on top. Check what exactly it promises.",
          r"\bDAILY [A-Z]{1,5} (BULL|BEAR)|SINGLE STOCK|\b(TSLA|NVDA|AAPL|AMZN|MSFT|META|GOOGL|"
          r"COIN|MSTR|PLTR|AMD)\b", "leveraged-etf-decay"),
    Theme("commodities", "Gold, silver and commodities", "Funds holding metals, oil or "
          "commodity futures.", "Futures-based funds can trail the spot price because of "
          "roll costs. Check what it holds.",
          r"\bGOLD\b|SILVER|PLATINUM|COMMODIT|\bOIL\b|NATURAL GAS|COPPER|AGRICULTUR", None),
    Theme("broad", "Broad stock market", "Funds tracking a wide index such as the S&P 500 or "
          "the whole market.", "Usually the cheapest and most diversified choice. Compare "
          "fees, which differ several times over for the same index.",
          r"S&P 500|\b500 INDEX|TOTAL (STOCK )?MARKET|TOTAL WORLD|RUSSELL 1000|\bQQQ\b|"
          r"NASDAQ[- ]100|DOW JONES INDUSTRIAL|MSCI (ACWI|WORLD|EAFE)", "expense-ratio"),
    Theme("bonds", "Bonds and cash", "Funds holding government or company bonds, or short "
          "term cash-like debt.", "Longer bonds fall when rates rise. Check duration and "
          "credit quality.", r"TREASURY|\bBOND|FIXED INCOME|\bT-BILL|MUNICIPAL|CREDIT|"
          r"\bLOAN|AGGREGATE|MORTGAGE", None),
]
BY_ID = {t.id: t for t in THEMES}
_COMPILED = [(t.id, re.compile(t.pattern, re.I)) for t in THEMES]


def classify(name: str | None) -> list[str]:
    """Every theme whose words appear in the fund's name."""
    if not name:
        return []
    return [tid for tid, rx in _COMPILED if rx.search(name)]
