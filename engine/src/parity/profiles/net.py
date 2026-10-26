"""Polite HTTP for the feedback collector: one user agent that says who we are, a pause
between requests to the same host, and robots.txt read and obeyed before any request.

robots.txt is matched the way the major crawlers read it: the longest matching rule
wins, `*` matches any run of characters and `$` anchors the end. Python's own
robotparser ignores wildcards, which would read Apple's `Disallow: /*/rss/*` as
allowing everything, so we do not use it. As Google documents for its own crawler, a
4xx answer other than 429 means there is no robots.txt and everything is allowed (API
hosts answer 400 or 404); a robots.txt we cannot read (timeout, 5xx, 429) means
nothing is.
"""

from __future__ import annotations

import re
import time
from urllib.parse import urlsplit

import requests

USER_AGENT = ("parity-research/0.1 (private research project; feedback collector; "
              "+https://github.com/abasheer-rion/parity)")
TIMEOUT = 30
MIN_GAP = 1.5  # seconds between requests to one host


class Blocked(RuntimeError):
    """robots.txt or the source's terms do not allow this request."""


class Session:
    def __init__(self, user_agent: str = USER_AGENT, min_gap: float = MIN_GAP):
        self.http = requests.Session()
        self.http.headers["User-Agent"] = user_agent
        self.min_gap = min_gap
        self._last: dict[str, float] = {}
        self._robots: dict[str, list[tuple[str, bool]] | None] = {}
        self._delay: dict[str, float] = {}  # Crawl-delay a host's robots.txt asks for
        self.requests = 0

    # -------------------------------------------------------------- robots.txt

    def _rules(self, scheme: str, host: str) -> list[tuple[str, bool]] | None:
        key = f"{scheme}://{host}"
        if key not in self._robots:
            try:
                self._wait(host)
                r = self.http.get(f"{key}/robots.txt", timeout=TIMEOUT)
                self.requests += 1
                if r.ok:
                    self._robots[key] = parse_robots(r.text, "parity-research")
                    self._delay[host] = crawl_delay(r.text, "parity-research")
                elif 400 <= r.status_code < 500 and r.status_code != 429:
                    self._robots[key] = []
                else:
                    self._robots[key] = None
            except requests.RequestException:
                self._robots[key] = None
        return self._robots[key]

    def allowed(self, url: str) -> bool:
        u = urlsplit(url)
        rules = self._rules(u.scheme, u.netloc)
        if rules is None:
            return False
        path = (u.path or "/") + (f"?{u.query}" if u.query else "")
        return robots_allows(rules, path)

    # -------------------------------------------------------------- requests

    def _wait(self, host: str) -> None:
        need = max(self.min_gap, min(self._delay.get(host, 0.0), 30.0))
        gap = time.time() - self._last.get(host, 0.0)
        if gap < need:
            time.sleep(need - gap)
        self._last[host] = time.time()

    def get(self, url: str, *, params: dict | None = None, headers: dict | None = None,
            check_robots: bool = True) -> requests.Response:
        """GET with the pause and the robots check. Raises Blocked when not allowed."""
        full = requests.Request("GET", url, params=params).prepare().url or url
        if check_robots and not self.allowed(full):
            raise Blocked(f"robots.txt disallows {urlsplit(full).path}")
        self._wait(urlsplit(full).netloc)
        r = self.http.get(url, params=params, headers=headers, timeout=TIMEOUT)
        self.requests += 1
        if r.status_code == 429 or (r.status_code == 403
                                    and r.headers.get("X-RateLimit-Remaining") == "0"):
            raise Blocked(f"rate limited (HTTP {r.status_code}); trying again next pass")
        r.raise_for_status()
        return r


def parse_robots(text: str, agent: str) -> list[tuple[str, bool]]:
    """The Allow and Disallow rules that apply to `agent`: its own group if one names
    it, otherwise the `*` group."""
    groups: list[tuple[list[str], list[tuple[str, bool]]]] = []
    agents: list[str] = []
    rules: list[tuple[str, bool]] = []
    last_was_agent = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, value = (x.strip() for x in line.split(":", 1))
        field = field.lower()
        if field == "user-agent":
            if not last_was_agent and (agents or rules):
                groups.append((agents, rules))
                agents, rules = [], []
            agents.append(value.lower())
            last_was_agent = True
        elif field in ("allow", "disallow"):
            last_was_agent = False
            if value or field == "allow":
                rules.append((value, field == "allow"))
        else:
            last_was_agent = False
    if agents or rules:
        groups.append((agents, rules))
    mine = [r for a, r in groups if any(x != "*" and x in agent.lower() for x in a)]
    if mine:
        return [x for r in mine for x in r]
    return [x for a, r in groups if "*" in a for x in r]


def crawl_delay(text: str, agent: str) -> float:
    """The largest Crawl-delay in a group for `agent` or `*`, in seconds (0 if none)."""
    delay, applies, last_was_agent = 0.0, False, False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, value = (x.strip() for x in line.split(":", 1))
        field = field.lower()
        if field == "user-agent":
            v = value.lower()
            hit = v == "*" or v in agent.lower()
            applies = (applies and last_was_agent) or hit
            last_was_agent = True
            continue
        last_was_agent = False
        if field == "crawl-delay" and applies:
            try:
                delay = max(delay, float(value))
            except ValueError:
                pass
    return delay


def _pattern(rule: str) -> re.Pattern:
    anchored = rule.endswith("$")
    body = re.escape(rule[:-1] if anchored else rule).replace(r"\*", ".*")
    return re.compile("^" + body + ("$" if anchored else ""))


def robots_allows(rules: list[tuple[str, bool]], path: str) -> bool:
    """Longest matching rule wins; on a tie, Allow wins; no match means allowed."""
    best_len, best = -1, True
    for rule, allow in rules:
        if not rule:
            continue
        if _pattern(rule).match(path):
            n = len(rule)
            if n > best_len or (n == best_len and allow):
                best_len, best = n, allow
    return best
