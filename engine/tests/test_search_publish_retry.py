"""A failed snapshot is retried within minutes, not after the full publish interval."""
import sqlite3

import pytest

from parity import search
from parity.publish import supabase


class OperationalError(Exception):
    """Stands in for psycopg's, which the engine CI does not install."""


def test_failed_publish_retries_soon(monkeypatch, capsys):
    clock = {"now": 1_000_000.0}
    calls: list[float] = []

    def fake_publish(doc):
        calls.append(clock["now"])
        if len(calls) == 1:
            raise OperationalError("connection failed")

    con = sqlite3.connect(":memory:")
    con.execute("create table trials (x)")
    monkeypatch.setattr(search, "connect", lambda: con)
    monkeypatch.setattr(search, "export", lambda con=None: {})
    monkeypatch.setattr(search, "run_batch", lambda n, con=None: {
        "tried": 0, "failed": 0, "repeats": 0, "widened": None})
    monkeypatch.setattr(search.store, "refresh", lambda: None)
    monkeypatch.setattr(search, "_beat", lambda summary, failed: False)
    monkeypatch.setattr(search, "widen_level", lambda con: 0)
    monkeypatch.setattr(search, "repeat_share", lambda con: None)
    monkeypatch.setattr(supabase, "publish_search", fake_publish)
    monkeypatch.setattr(search.time, "time", lambda: clock["now"])

    def tick(_):  # each loop pass moves the clock five minutes
        clock["now"] += 300
    monkeypatch.setattr(search.time, "sleep", tick)

    search.run_forever(max_hours=1.0)  # 12 passes, publish interval 6 hours
    assert len(calls) == 2
    assert calls[1] - calls[0] == pytest.approx(search.PUBLISH_RETRY_MINUTES * 60, abs=300)
    out = capsys.readouterr().out
    assert "publish failed: OperationalError" in out
    assert "connection failed" not in out  # never the message: it can quote the URL
