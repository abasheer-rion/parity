"""The MCP server (DEC-0025): every tool answers through a real MCP client session on
small synthetic data, tries are counted as trials, and nothing is written outside the
drafts folder, the log and the trial table. No network."""

from __future__ import annotations

import importlib.util
import json
import random
import sqlite3
from datetime import UTC, datetime

import anyio
import numpy as np
import pytest
from test_factory import PANEL

pytest.importorskip("mcp")

from mcp.shared.memory import create_connected_server_and_client_session  # noqa: E402

from parity import search  # noqa: E402
from parity.data import catalog  # noqa: E402
from parity.data import store as data_store  # noqa: E402
from parity.mcp_server import (  # noqa: E402
    DISCLAIMER,
    RECIPE_IMPORTS,
    ParityTools,
    Settings,
    ToolError,
    build_server,
    recipe_code,
    validate_spec,
)

CARRY = {"kind": "rank", "universe": "g10", "rank_on": "carry", "lookback": 63, "skip": 0,
         "k": 3, "long_short": True, "rebalance": "M"}


@pytest.fixture(scope="module")
def data_dir(tmp_path_factory):
    """Every catalog series as a parquet file, in the store's own layout, and one
    stored headline."""
    root = tmp_path_factory.mktemp("data")
    for key, spec in catalog.CATALOG.items():
        path = data_store._path(spec, root)
        path.parent.mkdir(parents=True, exist_ok=True)
        PANEL[[key]].to_parquet(path)
    from parity.news import store as news_store
    from parity.news.schema import Article
    news_store.merge([Article("test", datetime(2010, 5, 6, 15, tzinfo=UTC),
                              "Euro slides as debt fears spread", "https://example.org/a",
                              currencies=["EUR"])], root)
    return root


@pytest.fixture
def settings(data_dir, tmp_path):
    out = tmp_path / "output"
    out.mkdir()
    con = search.connect(out / "search.db")  # thirty search trials to rank against
    for i, sr in enumerate(np.random.default_rng(1).normal(0.01, 0.02, 30)):
        spec = {**CARRY, "lookback": 10 + i}
        con.execute("INSERT INTO trials (id, spec, name, family, asset, sharpe, sr_daily, "
                    "n_days, skew, kurt, tried_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (search.spec_id(spec), json.dumps(spec), "x", "carry", "fx",
                     float(sr) * 15.9, float(sr), 3000, 0.0, 3.0, "2026-10-01"))
    con.commit()
    con.close()
    return Settings(data_dir=data_dir, out_dir=out, timeout=60, specs_per_minute=50,
                    runs_per_minute=50)


async def _session_calls(settings, calls):
    server = build_server(settings)
    async with create_connected_server_and_client_session(server._mcp_server) as client:
        out = []
        for tool, args in calls:
            res = await client.call_tool(tool, args)
            out.append(json.loads(res.content[0].text))
        return out


def call(settings, tool: str, args: dict | None = None) -> dict:
    """One tool call through a real in-memory MCP client session."""
    return anyio.run(_session_calls, settings, [(tool, args or {})])[0]


def test_lists_tools_resources_and_the_refine_prompt(settings):
    server = build_server(settings)

    async def go():
        async with create_connected_server_and_client_session(server._mcp_server) as client:
            tools = {t.name for t in (await client.list_tools()).tools}
            resources = {str(r.uri) for r in (await client.list_resources()).resources}
            prompts = {p.name for p in (await client.list_prompts()).prompts}
            prompt = await client.get_prompt("refine-strategy", {"idea": "carry"})
            doc = await client.read_resource("parity://docs/DEC-0014")
            return tools, resources, prompts, prompt, doc

    tools, resources, prompts, prompt, doc = anyio.run(go)
    assert {"list_strategies", "get_strategy", "run_backtest", "run_gauntlet",
            "evaluate_spec", "search_leads", "list_series", "get_series",
            "scenario_analogues", "news_impact", "glossary", "search_docs",
            "draft_recipe", "spec_options"} <= tools
    assert "parity://docs/DEC-0014" in resources
    assert "refine-strategy" in prompts
    text = prompt.messages[0].content.text
    assert "luck_check" in text and "look_ahead" in text and "carry" in text
    assert "strategy factory" in doc.contents[0].text.lower()


def test_list_and_get_strategy_without_a_report(settings):
    out = call(settings, "list_strategies", {"family": "carry"})
    assert out["disclaimer"] == DISCLAIMER
    assert out["source"].startswith("fresh quick run")
    assert out["count"] >= 2 and all(r["family"] == "carry" for r in out["strategies"])
    assert all(r["sharpe"] is not None for r in out["strategies"])
    got = call(settings, "get_strategy", {"name": "fx_carry"})
    assert got["plain_name"] and got["params"] is not None and got["reference"]
    assert "run_gauntlet" in got["gauntlet"]
    assert "error" in call(settings, "get_strategy", {"name": "no_such_thing"})


def test_backtest_and_gauntlet(settings):
    out = call(settings, "run_backtest", {"name": "fx_trend_3m", "cost_bps": 2})
    assert out["metrics"]["sharpe"] is not None and out["config"]["cost_bps"] == 2
    assert 10 < len(out["equity_monthly"]) <= 400
    bad = call(settings, "run_backtest", {"name": "fx_trend_3m", "params": {"nope": 1}})
    assert "no settings" in bad["error"]
    g = call(settings, "run_gauntlet", {"name": "fx_trend_3m"})
    assert len(g["tests"]) == 11 and g["verdict"]
    assert "equity" not in json.dumps(g["sensitivity"])


def test_custom_params_count_as_a_trial(settings):
    call(settings, "run_backtest", {"name": "fx_trend_3m", "params": {"lookback": 84}})
    con = sqlite3.connect(settings.search_db)
    assert con.execute("SELECT COUNT(*) FROM mcp_trials").fetchone()[0] == 1


def test_evaluate_spec_counts_every_try_and_checks_look_ahead(settings):
    out = call(settings, "evaluate_spec", {"spec": CARRY, "hypothesis": "carry premium"})
    assert out["disclaimer"] == DISCLAIMER
    assert out["look_ahead"]["passed"] is True
    assert out["metrics"]["sharpe"] is not None
    assert "sharpe_at_double_cost" in out["metrics"]
    luck = out["luck_check"]
    assert luck["assistant_trials"] == 1 and luck["trials_counted"] == 31
    assert 0 <= luck["deflated_sharpe"] <= 1
    # The same spec again is not a new trial; a new one is.
    again = call(settings, "evaluate_spec", {"spec": CARRY})
    assert again["luck_check"]["assistant_trials"] == 1
    assert again["luck_check"]["assistant_calls"] == 2
    other = call(settings, "evaluate_spec", {"spec": {**CARRY, "k": 2}})
    assert other["luck_check"]["assistant_trials"] == 2
    assert other["luck_check"]["trials_counted"] == 32
    con = sqlite3.connect(settings.search_db)
    assert {r[0] for r in con.execute("SELECT source FROM mcp_trials")} == {"mcp"}
    assert con.execute("SELECT COUNT(*) FROM trials").fetchone()[0] == 30  # untouched


def test_more_assistant_trials_raise_the_bar(settings):
    tools = ParityTools(settings)
    before = tools.evaluate_spec(CARRY)["luck_check"]["deflated_sharpe"]
    for k in (1, 2, 4):
        tools.evaluate_spec({**CARRY, "k": k, "lookback": 126})
    after = tools._luck(search.spec_id(validate_spec(CARRY)))["deflated_sharpe"]
    assert after != before


def test_bad_specs_explain_themselves(settings):
    assert "kind" in call(settings, "evaluate_spec", {"spec": {"kind": "magic"}})["error"]
    out = call(settings, "evaluate_spec", {"spec": {**CARRY, "lookback": 99999}})
    assert "lookback" in out["error"]
    with pytest.raises(ToolError):
        validate_spec({**CARRY, "extra": 1})
    with pytest.raises(ToolError):
        validate_spec({"kind": "pair", "a": "fx.EUR", "b": "fx.EUR", "window": 60,
                       "entry": 2.0, "delay": 0})


def test_search_leads_rank_with_the_assistants_trials(settings):
    call(settings, "evaluate_spec", {"spec": CARRY})
    out = call(settings, "search_leads", {"top": 5})
    assert out["trials_counted"] == 31 and len(out["leads"]) == 5
    assert all("spec" in r and r["deflated_sharpe"] is not None for r in out["leads"])
    mine = call(settings, "search_leads", {"source": "mcp"})
    assert [r["source"] for r in mine["leads"]] == ["mcp"]


def test_series_tools(settings):
    found = call(settings, "list_series", {"query": "jpy"})
    assert any(r["key"] == "fx.JPY" for r in found["series"])
    assert all(r["licence"] for r in found["series"])
    s = call(settings, "get_series", {"key": "fx.JPY", "start": "2005-01-01", "freq": "M"})
    assert s["first"] >= "2005-01-01" and len(s["points"]) <= 500 and s["licence"]
    assert "error" in call(settings, "get_series", {"key": "fx.NOPE"})


def test_scenarios_news_glossary_and_docs(settings):
    sc = call(settings, "scenario_analogues", {"text": "war in europe, gas"})
    assert sc["read_as"]["type"] == "war" and sc["analogues"]
    news = call(settings, "news_impact", {"currency": "EUR"})
    assert news["articles_matched"] == 1 and news["items"][0]["series"]
    g = call(settings, "glossary", {"term": "sharpe"})
    assert g["matches"] and g["matches"][0]["simple"]
    d = call(settings, "search_docs", {"query": "deflated sharpe"})
    assert d["results"] and d["results"][0]["plain_words"]
    assert call(settings, "read_doc", {"doc_id": "DEC-0014"})["title"]


def test_draft_recipe_goes_to_the_drafts_folder_only(settings):
    out = call(settings, "draft_recipe", {"spec": CARRY, "name": "mcp_carry_try",
                                          "display_name": "Carry try",
                                          "description": "A test. Fails in carry crashes."})
    path = settings.drafts / "mcp_carry_try.py"
    assert out["path"] == str(path) and path.exists()
    assert "NOT registered" in path.read_text() and "how_to_promote" in out
    for name in ("../../ledger/x", "fx_carry"):  # a path, and an existing strategy
        assert "error" in call(settings, "draft_recipe", {
            "spec": CARRY, "name": name, "display_name": "x", "description": "x"})


SPECS = [search.sample(random.Random(i)) for i in range(40)]


@pytest.mark.parametrize("spec", SPECS, ids=[f"{s['kind']}{i}" for i, s in enumerate(SPECS)])
def test_recipe_code_matches_the_search_build(spec, monkeypatch, tmp_path):
    """The drafted make(...) call must build exactly the strategy the spec does."""
    from parity.strategies import factory
    monkeypatch.setattr(factory, "register", lambda cls: cls)
    code = recipe_code(validate_spec(spec), "draft_x", "Draft", "A test.")
    path = tmp_path / "draft_x.py"
    path.write_text(f"{RECIPE_IMPORTS}\n" + code.replace("make(", "_cls = make(", 1))
    mod_spec = importlib.util.spec_from_file_location("draft_x", path)
    mod = importlib.util.module_from_spec(mod_spec)
    mod_spec.loader.exec_module(mod)
    drafted, built = mod._cls(), search.build(spec)
    cols = sorted(set(built.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})
    a, b = drafted.weights(PANEL[cols]), built.weights(PANEL[cols])
    assert np.allclose(a.values, b.reindex(columns=a.columns).values, equal_nan=True)


def test_rate_limit_and_log(settings):
    settings.specs_per_minute = 1
    first, second = anyio.run(_session_calls, settings, [("evaluate_spec", {"spec": CARRY}),
                                                         ("evaluate_spec", {"spec": CARRY})])
    assert "error" not in first and "limit" in second["error"]
    lines = [json.loads(x) for x in settings.log.read_text().splitlines()]
    assert [x["tool"] for x in lines] == ["evaluate_spec", "evaluate_spec"]
    assert lines[0]["ok"] is True and lines[1]["ok"] is False


def test_timeout_returns_an_error(settings, monkeypatch):
    import time
    settings.timeout = 0.2
    monkeypatch.setattr(ParityTools, "run_backtest", lambda self, *a, **k: time.sleep(1))
    out = call(settings, "run_backtest", {"name": "fx_trend_3m"})
    assert "stopped after" in out["error"]


def test_writes_stay_in_the_output_folder(settings):
    tools = ParityTools(settings)
    for bad in (settings.repo / "ledger" / "x.py",
                settings.repo / "registrations" / "x.py",
                settings.repo / "engine" / "src" / "parity" / "strategies" / "x.py"):
        with pytest.raises(ToolError):
            tools._safe_path(bad)
