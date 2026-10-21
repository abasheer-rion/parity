from parity import strategies
from parity.backtest import BacktestConfig, run
from parity.gauntlet import run_gauntlet


def _bench(panel):
    cfg = BacktestConfig(start=None, cost_bps=0)
    return run(strategies.get("us_market_buy_hold"), panel, cfg).returns


def test_gauntlet_runs_and_is_reproducible(panel):
    bench = _bench(panel)
    cfg = BacktestConfig(start=None)
    first = run_gauntlet(strategies.get("fx_carry"), panel, bench, cfg, n_trials=3)
    second = run_gauntlet(strategies.get("fx_carry"), panel, bench, cfg, n_trials=3)
    assert first["total"] == 11
    assert [t["id"] for t in first["tests"]] == [
        "A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "B5"]
    assert first["tests"] == second["tests"], "same seed must give the same answer"
    assert first["beats_sp500"] == all(t["passed"] for t in first["tests"] if t["group"] == "beat")


def test_noise_strategy_does_not_pass_the_reality_checks(panel):
    """Random walk currencies hold no signal, so the placebo test should not pass."""
    bench = _bench(panel)
    g = run_gauntlet(strategies.get("fx_tsmom"), panel, bench, BacktestConfig(start=None), 3)
    placebo = next(t for t in g["tests"] if t["id"] == "B2")
    assert placebo["passed"] is False


def test_cash_only_control_fails_the_gauntlet(panel):
    from test_backtest import _CashOnly

    g = run_gauntlet(_CashOnly(), panel, _bench(panel), BacktestConfig(start=None), 3)
    tests = {t["id"]: t["passed"] for t in g["tests"]}
    assert not g["beats_sp500"]
    assert tests["A1"] is False and tests["B1"] is False
