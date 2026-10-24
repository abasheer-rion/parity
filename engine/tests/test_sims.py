"""The always-on sims service (DEC-0037): totals build up across cycles on seeds that
never repeat, the histograms give back the right percentiles, a broken step never stops
a cycle, and the health line reads both services."""

from __future__ import annotations

import json
import sqlite3

import numpy as np
import pandas as pd

from parity import bots, search, sims


def test_bot_totals_build_up_on_fresh_seeds(tmp_path):
    con = sims.connect(tmp_path / "s.db")
    a = sims.bot_paths(con, 6, years=3)
    b = sims.bot_paths(con, 4, years=3)
    assert a["seeds"] == [sims.FIRST_SEED, sims.FIRST_SEED + 5]
    assert b["seeds"][0] == a["seeds"][1] + 1
    doc = sims.summary(con)
    assert doc["bots"]["paths"] == 10
    assert set(doc["bots"]["by_bot"]) == {cls.id for cls in bots.BOTS}
    for row in doc["bots"]["by_bot"].values():
        assert row["paths"] == 10
        assert 0 <= row["blown_in_crash"] <= row["crash_paths"] <= 10
        assert row["final"] == sorted(row["final"])
    # The same ten paths run directly give the same totals.
    direct = bots.synthetic_summary(10, sims.FIRST_SEED, 3)
    for bid, row in doc["bots"]["by_bot"].items():
        assert row["blown"] == direct[bid]["blown"] and row["ahead"] == direct[bid]["ahead"]


def test_histogram_percentiles_match_the_raw_numbers():
    rng = np.random.default_rng(1)
    x = rng.normal(0.1, 0.3, 50_000)
    q = sims.quantiles(sims._bins(x, sims.FINAL_EDGES), sims.FINAL_EDGES)
    assert np.allclose(q, np.quantile(x, [0.05, 0.25, 0.5, 0.75, 0.95]), atol=0.02)
    assert sims.quantiles(np.zeros(10, int), sims.FINAL_EDGES) is None


def test_world_paths_add_up(tmp_path, monkeypatch):
    days = pd.bdate_range("2000-01-03", periods=3000)
    rng = np.random.default_rng(2)
    fake = {a: pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(days)))), index=days)
            for a in ("EUR", "oil")}
    from parity import world
    monkeypatch.setattr(world, "load_levels", lambda: fake)
    con = sims.connect(tmp_path / "s.db")
    first = sims.world_paths(con, 300)
    second = sims.world_paths(con, 200)
    assert first["seed"] != second["seed"]
    w = sims.summary(con)["world"]["assets"]
    assert set(w) == {"EUR", "oil", "basket"}
    assert all(v["paths"] == 500 and 0 <= v["p_loss"] <= 1 for v in w.values())


def test_a_broken_step_is_recorded_and_the_cycle_goes_on(tmp_path, monkeypatch):
    monkeypatch.setattr(sims, "world_paths", lambda con, n: (_ for _ in ()).throw(
        RuntimeError("no prices")))
    monkeypatch.setattr(sims, "EXPORTS", [("bad export", ("nonsense",))])

    def fake_cli(*argv):
        raise RuntimeError(f"parity {' '.join(argv)} exited 2")

    monkeypatch.setattr(sims, "_cli", fake_cli)
    con = sims.connect(tmp_path / "s.db")
    out = sims.cycle(con, paths=2, world_n=10)
    steps = {s["step"]: s for s in out["steps"]}
    assert steps["bot paths"]["ok"]
    assert not steps["world paths"]["ok"] and "no prices" in steps["world paths"]["error"]
    assert not steps["bad export"]["ok"]
    doc = sims.summary(con)
    assert doc["cycles"] == 1 and doc["last_cycle_at"] == out["finished_at"]
    sims.cycle(con, paths=1, world_n=10, exports=False)
    assert sims.summary(con)["cycles"] == 2


def test_the_summary_is_small_and_has_no_paths(tmp_path):
    con = sims.connect(tmp_path / "s.db")
    sims.bot_paths(con, 3, years=2)
    doc = sims.export(con, tmp_path / "sims.json")
    text = json.dumps(doc)
    assert len(text) < 20_000
    assert "postgres" not in text and "prices" not in text
    assert json.loads((tmp_path / "sims.json").read_text())["bots"]["paths"] == 3


def test_health_reads_both_services(tmp_path):
    sdb = tmp_path / "search.db"
    con = search.connect(sdb)
    con.execute("INSERT INTO trials (id, spec, tried_at) VALUES ('a', '{}', '2026-01-01')")
    con.execute("INSERT INTO batches VALUES ('2026-01-01T00:00:00+00:00', 1, 0, 0, 0)")
    con.commit()
    lines = sims.health(sdb, tmp_path / "none.db")
    assert lines[0].startswith("search: 1 tries, last batch ") and "hours ago" in lines[0]
    assert lines[1] == "sims: not run on this machine yet"
    old = tmp_path / "old.db"
    c = sqlite3.connect(old)
    c.execute(search.SCHEMA)
    c.commit()
    assert sims.health(old, tmp_path / "none.db")[0].startswith("search: 0 tries")
