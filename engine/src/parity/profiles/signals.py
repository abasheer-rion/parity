"""Simple signals from one piece of feedback: is it praise or a complaint, and what about.

Rule based on purpose: no model to download, no paid API, and every label can be traced
to the words that produced it. The word lists are ours. A star rating, when an item has
one, decides the sentiment on its own (1 or 2 stars is a complaint, 4 or 5 is praise).
"""

from __future__ import annotations

import re

POSITIVE = {
    "love", "loved", "loving", "great", "excellent", "best", "easy", "easier", "fast",
    "faster", "intuitive", "smooth", "reliable", "helpful", "clean", "powerful", "awesome",
    "amazing", "good", "nice", "perfect", "recommend", "recommended", "solid", "responsive",
    "stable", "favorite", "favourite", "useful", "impressive", "clear", "simple", "superb",
    "fantastic", "wonderful", "quick", "snappy", "polished", "elegant", "flexible", "cheap",
    "accurate", "trustworthy", "brilliant", "happy", "pleased", "worth",
}
NEGATIVE = {
    "crash", "crashes", "crashed", "crashing", "bug", "bugs", "buggy", "slow", "slower",
    "lag", "laggy", "lags", "freeze", "freezes", "frozen", "terrible", "awful", "worst",
    "hate", "hated", "broken", "scam", "fraud", "useless", "horrible", "poor", "confusing",
    "clunky", "annoying", "frustrating", "glitch", "glitches", "glitchy", "error", "errors",
    "fail", "fails", "failed", "failure", "disappointed", "disappointing", "outage",
    "locked", "stuck", "missing", "expensive", "overpriced", "unreliable", "unresponsive",
    "delay", "delayed", "refuse", "refused", "ripoff", "garbage", "trash", "nightmare",
    "unusable", "steal", "stole", "stolen", "worse", "ugly", "cluttered", "outdated",
    "dated", "complicated", "difficult", "hard", "pain", "problem", "problems", "issue",
    "issues", "wrong", "suspended", "banned", "hidden", "hassle",
}
NEGATORS = {"not", "no", "never", "don't", "dont", "doesn't", "doesnt", "isn't", "isnt",
            "wasn't", "wasnt", "can't", "cant", "cannot", "won't", "wont", "didn't", "didnt",
            "hardly", "without"}

# Each theme: a plain label and the words or phrases that put an item in it. Phrases
# are matched on word boundaries, lower case.
THEMES: dict[str, tuple[str, tuple[str, ...]]] = {
    "charting": ("Charts and indicators", (
        "chart", "charts", "charting", "indicator", "indicators", "candlestick", "drawing",
        "drawings", "pine script", "timeframe", "technical analysis")),
    "order_entry": ("Placing orders", (
        "order entry", "place an order", "placing orders", "limit order", "stop loss",
        "stop-loss", "order ticket", "one click", "one-click", "bracket order", "fill",
        "fills", "filled", "execution", "slippage")),
    "speed": ("Speed and lag", (
        "lag", "laggy", "latency", "slow", "fast", "speed", "loading", "load time",
        "responsive", "snappy", "real-time", "real time", "delay", "delayed")),
    "stability": ("Crashes and bugs", (
        "crash", "crashes", "crashed", "bug", "bugs", "buggy", "glitch", "glitches",
        "freeze", "freezes", "frozen", "error", "errors", "broken", "doesn't work",
        "not working", "stopped working")),
    "outages": ("Outages and downtime", (
        "outage", "outages", "downtime", "went down", "is down", "was down", "maintenance",
        "degraded", "unavailable", "incident")),
    "account": ("Sign-up, login and verification", (
        "login", "log in", "sign in", "sign up", "signup", "verification", "verify my",
        "kyc", "identity", "two-factor", "2fa", "password", "locked out", "account locked",
        "onboarding")),
    "fees": ("Fees and pricing", (
        "fee", "fees", "commission", "commissions", "spread", "spreads", "pricing",
        "price plan", "subscription", "expensive", "cheap", "free", "premium", "paywall",
        "pay for")),
    "funds": ("Deposits and withdrawals", (
        "withdraw", "withdrawal", "withdrawals", "deposit", "deposits", "transfer",
        "transfers", "funds", "payout", "bank account", "wire")),
    "support": ("Customer support", (
        "support", "customer service", "help desk", "live chat", "agent", "ticket",
        "response time", "no response", "contact them")),
    "design": ("Look and layout", (
        "ui", "ux", "interface", "design", "layout", "layouts", "clean", "cluttered",
        "intuitive", "confusing", "dark mode", "theme", "workspace", "widgets", "font")),
    "mobile": ("Mobile app", (
        "iphone", "ipad", "android", "mobile", "phone", "tablet", "widget", "face id")),
    "data": ("Market data and quotes", (
        "data", "quote", "quotes", "level 2", "level ii", "market depth", "order book",
        "news", "feed", "tick", "ticks", "historical data", "fundamentals")),
    "tools": ("Scanners, alerts and tools", (
        "alert", "alerts", "notification", "notifications", "screener", "scanner",
        "watchlist", "watchlists", "backtest", "backtesting", "options chain", "calendar")),
    "automation": ("API and automation", (
        "api", "sdk", "bot", "bots", "algo", "algorithmic", "automated", "expert advisor",
        "websocket", "python", "script", "scripts", "webhook")),
    "learning": ("Learning and paper trading", (
        "paper trading", "paper trade", "demo account", "demo", "simulator", "learn",
        "learning", "education", "tutorial", "beginner", "beginners")),
    "social": ("Community and copy trading", (
        "community", "copy trading", "copytrader", "copy trader", "social", "followers",
        "ideas", "leaderboard", "signal provider", "signals")),
    "trust": ("Trust and safety", (
        "scam", "fraud", "trust", "trusted", "regulated", "regulation", "security",
        "hacked", "stolen", "safe", "insured", "insurance", "transparent", "transparency")),
    "customisation": ("Customisation and shortcuts", (
        "customize", "customise", "customizable", "customisable", "hotkey", "hotkeys",
        "shortcut", "shortcuts", "keyboard", "configurable", "settings")),
}

_WORD = re.compile(r"[a-z0-9][a-z0-9'+\-]*")
_PATTERNS = {k: re.compile(r"\b(" + "|".join(re.escape(p) for p in words) + r")\b")
             for k, (_, words) in THEMES.items()}
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def clean(text: str | None) -> str:
    """Plain text: tags stripped, common entities decoded, spaces collapsed."""
    if not text:
        return ""
    import html

    return _SPACE.sub(" ", html.unescape(_TAG.sub(" ", text))).strip()


def sentiment(text: str, rating: int | None = None) -> tuple[float, str]:
    """A score from -1 to 1 and a label: 'positive', 'negative' or 'neutral'."""
    if rating is not None:
        label = "negative" if rating <= 2 else "positive" if rating >= 4 else "neutral"
        return (rating - 3) / 2, label
    words = _WORD.findall(text.lower())
    pos = neg = 0
    for i, w in enumerate(words):
        hit = 1 if w in POSITIVE else -1 if w in NEGATIVE else 0
        if not hit:
            continue
        if any(x in NEGATORS for x in words[max(0, i - 3):i]):
            hit = -hit
        pos += hit > 0
        neg += hit < 0
    if pos == neg == 0:
        return 0.0, "neutral"
    score = (pos - neg) / (pos + neg)
    label = "positive" if score >= 0.34 else "negative" if score <= -0.34 else "neutral"
    return round(score, 3), label


def themes(text: str) -> list[str]:
    """Theme ids whose words appear in the text, in a fixed order."""
    low = text.lower()
    return [k for k, pat in _PATTERNS.items() if pat.search(low)]


def label(theme: str) -> str:
    return THEMES[theme][0] if theme in THEMES else theme
