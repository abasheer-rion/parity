"""Polite HTTP for the registry (DEC-0064): our own user agent, a pause before each request,
retries with growing waits, a back-off on 429, and key values blanked from every error.

Tests replace `request` with their own function, so no test touches the network.
"""

from __future__ import annotations

import time

import requests

from ..data.sources import redact

#: The SEC asks for a contact in the user agent; the address is the site's public one.
CONTACT = "contact@paritytrading.ai"
USER_AGENT = f"parity-research/0.1 (private research project; {CONTACT})"
TIMEOUT = 30


def request(url: str, params: dict | None = None, json: dict | list | None = None,
            pause: float = 0.5, retries: int = 3) -> requests.Response:
    last: Exception | None = None
    for attempt in range(retries):
        time.sleep(pause)
        try:
            headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
            if json is not None:
                resp = requests.post(url, json=json, timeout=TIMEOUT, headers=headers)
            else:
                resp = requests.get(url, params=params, timeout=TIMEOUT, headers=headers)
            if resp.status_code == 429:
                time.sleep(min(60.0, 5.0 * 2 ** attempt))
                last = RuntimeError(f"429 from {url}")
                continue
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(redact(f"Failed to fetch {url}: {last}", params))


def get(url: str, params: dict | None = None, pause: float = 0.5) -> requests.Response:
    return request(url, params=params, pause=pause)


def post(url: str, body: dict | list, pause: float = 0.5) -> requests.Response:
    return request(url, json=body, pause=pause)
