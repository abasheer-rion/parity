"""Enrolled Base pools go live by themselves (DEC-0078): registry/feed.py. No network."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from parity.registry import discover, feed

NOW = datetime(2026, 10, 27, 12, tzinfo=UTC)
CBBTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"


def reg(base_pools: int = 1) -> dict:
    pools = [{"chain": "base", "pool": f"0x{i:040x}", "base": CBBTC, "decimals": 8,
              "quote": "WETH", "dex": "Uniswap v3 0.05%", "fee": 0.0005, "liq": 1e6,
              "swaps": None, "topic": feed.SWAP_UNI, "via": "cbBTC"} for i in range(base_pools)]
    return {"at": "x", "minLiqUsd": 50_000,
            "tokens": [{"key": "bitcoin", "sym": "BTC-USD", "name": "Bitcoin", "rank": 1,
                        "pools": pools}]}


def row(n: int, venue: str = "Aerodrome CL100", quote: str = "USDC", status: str = "enrolled",
        base: str = "CBBTC") -> dict:
    pool = f"0x{0xab00 + n:040x}"
    return {"id": f"onchain.{pool}", "code": pool, "status": status, "intended_use": "feed",
            "name": f"{base}/{quote} {venue} pool on Base, 900k USD deep"}


def deep(_pool, _quote):
    return 900_000.0


EMPTY = {"at": None, "pools": []}


def test_an_enrolled_pool_is_added_with_its_asset_and_fresh_depth():
    out, report = feed.promote([row(1)], reg(), EMPTY, NOW, depth=deep)
    assert len(out["pools"]) == 1
    p = out["pools"][0]
    assert p["token"] == "bitcoin" and p["base"] == CBBTC and p["decimals"] == 8
    assert p["dex"] == "Aerodrome CL100" and p["fee"] == 0.0005 and p["liq"] == 900_000
    assert p["via"] == "cbBTC" and p["enrolledAt"] == "2026-10-27T12:00:00Z"
    assert report[-1]["action"] == "added"


def test_fees_follow_the_venue():
    assert feed.fee_of("Uniswap v3 0.3%") == 0.003
    assert feed.fee_of("Uniswap v3 1%") == 0.01
    assert feed.fee_of("Aerodrome CL200") == 0.003
    assert feed.fee_of("Aerodrome CL7") is None


def test_a_shallow_pool_is_left_out_even_if_it_was_deep_at_discovery():
    out, report = feed.promote([row(1)], reg(), EMPTY, NOW, depth=lambda *_: 20_000.0)
    assert out is EMPTY and report[0]["action"] == "skipped" and "bar" in report[0]["why"]


def test_the_per_chain_cap_binds_before_the_daily_cap():
    rows = [row(i) for i in range(5)]
    out, report = feed.promote(rows, reg(1), EMPTY, NOW, depth=deep, max_new=3)
    added = [x for x in report if x["action"] == "added"]
    # One Base pool already listed, so two more fit under the 3-per-chain cap.
    assert len(added) == 2 and len(out["pools"]) == 2
    assert {x["why"] for x in report if x["action"] == "skipped"} == {"asset has its pools"}


def test_at_most_max_new_pools_a_day():
    rows = [row(i) for i in range(5)]
    out, report = feed.promote(rows, reg(1), EMPTY, NOW, depth=deep, max_new=1)
    assert len(out["pools"]) == 1
    assert [x["action"] for x in report].count("waits") == 4


def test_the_daily_cap_counts_pools_added_in_the_last_24_hours():
    earlier = {"at": "x", "pools": [dict(feed.entry_for(row(90), feed.token_index(reg()))[0],
                                         liq=1, enrolledAt="2026-10-27T01:00:00Z")]}
    out, report = feed.promote([row(1)], reg(), earlier, NOW, depth=deep, max_new=1)
    assert out is earlier and report[-1] == {"id": row(1)["id"], "action": "waits",
                                             "why": "daily cap reached"}
    out, _ = feed.promote([row(1)], reg(), earlier, NOW.replace(day=28, hour=2), depth=deep,
                          max_new=1)
    assert len(out["pools"]) == 2


def test_listed_unknown_and_retired_pools():
    listed = reg()
    listed["tokens"][0]["pools"][0]["pool"] = row(1)["code"]
    out, report = feed.promote([row(1)], listed, EMPTY, NOW, depth=deep)
    assert out is EMPTY and report == []
    out, report = feed.promote([row(2, base="DOGE")], reg(), EMPTY, NOW, depth=deep)
    assert out is EMPTY and "not an asset the feed prices" in report[0]["why"]
    have, _ = feed.promote([row(3)], reg(), EMPTY, NOW, depth=deep)
    out, report = feed.promote([row(3, status="retired")], reg(), have, NOW, depth=deep)
    assert out["pools"] == [] and report[0]["action"] == "removed"


def test_a_failed_depth_read_waits_for_tomorrow():
    def boom(*_):
        raise TimeoutError
    out, report = feed.promote([row(1)], reg(), EMPTY, NOW, depth=boom)
    assert out is EMPTY and report[0]["action"] == "waits"


def test_kill_switch_writes_nothing(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("POOL_AUTO_ENROL", "off")
    rows = tmp_path / "rows.json"
    rows.write_text(json.dumps([row(1)]))
    assert feed.main(["--rows", str(rows)]) == 0
    assert "off" in capsys.readouterr().out


def test_the_enrolled_list_ships_with_the_feed_and_discovery_knows_its_pools():
    data = json.loads(feed.ENROLLED.read_text())
    assert set(data) == {"at", "pools"}
    _, pools = discover.onchain_config()
    assert all(p["pool"].lower() in pools for p in data["pools"])
    assert feed.ENROLLED.parent == discover.ONCHAIN_REGISTRY.parent
