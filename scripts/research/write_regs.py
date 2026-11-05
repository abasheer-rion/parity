"""Write REG-0004 to REG-0008. Usage: write_regs.py REPO_ROOT"""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]) / "registrations"
reg3 = json.loads((root / "REG-0003-all-strategies-1999.json").read_text(encoding="utf-8"))

BASE = {"start": "1999-01-04", "end": None, "cost_bps": 1.0, "include_carry": True,
        "target_vol": None, "vol_lookback": 60, "max_leverage": 4.0}

regs = [
    ("REG-0004-rerun-with-corrected-scoring.json", {
        "id": "REG-0004",
        "title": "All sixteen strategies of REG-0003 again, scored with excess returns and financed leverage",
        "created": "2026-10-21",
        "authors": ["amanda"],
        "hypotheses": reg3["hypotheses"],
        "experiment": "EXP-0005",
        "question": "With the two critical audit findings fixed (Sharpe on returns above the T-bill, and borrowing paid for; DEC-0009), does any of the sixteen strategies of REG-0003, with the same settings, pass all six A tests of the gauntlet?",
        "strategies": reg3["strategies"],
        "backtest": dict(BASE),
        "pass_criteria": {"beats_sp500": True},
        "prior_trials": 188,
        "prior_trials_note": "The 188 trials counted by RUN-000003. We found no record of exploratory runs after the DEC-0009 fix; if there were any, add them when running.",
        "what_would_change_our_mind": "A strategy passing all six A tests would be the first; it would get its own forward-test registration before we believe it.",
        "already_seen": "Results under the old scoring were seen (RUN-000003). Under the corrected scoring the registrant has computed no results. This makes official the numbers the audit said were wrong, so it is a correction, not a new test.",
    }),
    ("REG-0005-stocks-plus-fx-trend-on-its-own.json", {
        "id": "REG-0005",
        "title": "Stocks plus currency trend on its own, judged on HYP-0007's claim",
        "created": "2026-10-21",
        "authors": ["amanda"],
        "hypotheses": ["HYP-0007"],
        "experiment": "EXP-0006",
        "question": "Does holding US stocks with a currency trend book (half the risk each, the idle half in T-bills since the M1 fix) earn a higher Sharpe ratio than the market, more money at the market's volatility, and hold up in the market's worst months?",
        "strategies": [{"name": "stocks_plus_fx_trend", "params": {}}],
        "backtest": dict(BASE),
        "pass_criteria": {"required_tests": ["A1", "A2", "B5"]},
        "prior_trials": 204,
        "prior_trials_note": "188 counted by RUN-000003 plus the 16 of REG-0004. If REG-0004 has not run first, the ledger floor applies.",
        "what_would_change_our_mind": "Failing A1 or A2 means the overlay does not improve on stocks at equal risk. Failing B5 means its crisis cushion was a few lucky episodes.",
        "already_seen": "The overlay's results under the old scoring and without the M1 fix were seen in RUN-000003 (6 of 11 tests). Its crisis behaviour, which motivates this plan, was seen on the Compare page. Not seen under the corrected code.",
    }),
    ("REG-0006-emerging-market-currencies-since-2010.json", {
        "id": "REG-0006",
        "title": "Emerging market carry, basket and momentum since February 2010, at 10 bp costs",
        "created": "2026-10-21",
        "authors": ["amanda"],
        "hypotheses": ["HYP-0009", "HYP-0010", "HYP-0011"],
        "experiment": "EXP-0007",
        "question": "On data after every published study's sample ended, do emerging market carry, a passive EM basket and EM momentum each have a positive Sharpe ratio that passes at least four of the five reality tests, after 10 bp per unit traded?",
        "strategies": [
            {"name": "em_fx_carry", "params": {"fraction": 1 / 3, "min_carry": 1.0, "rebalance": "M", "min_currencies": 6}},
            {"name": "em_fx_basket", "params": {"rebalance": "M", "min_currencies": 6}},
            {"name": "em_fx_momentum", "params": {"lookback": 63, "fraction": 1 / 3, "rebalance": "M", "min_currencies": 6}},
        ],
        "backtest": {**BASE, "start": "2010-02-01", "cost_bps": 10.0},
        "pass_criteria": {"min_real_tests": 4},
        "prior_trials": 205,
        "prior_trials_note": "205 = 188 (RUN-000003) + 16 (REG-0004) + 1 (REG-0005), counted across all families as the project has so far (the audit's H2 questions this; see RES-0008). No exploratory evaluation of these strategies was run.",
        "what_would_change_our_mind": "Passing 4 of 5 reality tests would make EM carry the first real effect in the project since 2010 and earn a forward test. Failing would mean the published EM results did not survive their own decade.",
        "already_seen": "No. Before registering, only data checks were run (coverage dates, missing values, size of daily price moves); no return, Sharpe ratio or other performance number was computed for these strategies.",
    }),
    ("REG-0007-energy-futures-trend-and-carry.json", {
        "id": "REG-0007",
        "title": "Energy futures trend and carry on rolled NYMEX contracts, 1999 to April 2024",
        "created": "2026-10-21",
        "authors": ["amanda"],
        "hypotheses": ["HYP-0012", "HYP-0013"],
        "experiment": "EXP-0008",
        "question": "On rolled NYMEX crude oil, heating oil, gasoline and natural gas futures, do 12-month trend and cross-sectional carry each have a positive Sharpe ratio that passes at least four of the five reality tests, after 3 bp per unit traded and 2 bp per roll?",
        "strategies": [
            {"name": "energy_tsmom", "params": {"lookback": 252, "rebalance": "M"}},
            {"name": "energy_carry", "params": {"smooth": 1, "rebalance": "M"}},
        ],
        "backtest": {**BASE, "end": "2024-04-05", "cost_bps": 3.0},
        "pass_criteria": {"min_real_tests": 4},
        "prior_trials": 208,
        "prior_trials_note": "205 + 3 (REG-0006). Includes the commodity_tsmom trials on spot prices, the same idea on worse data. No exploratory evaluation of these strategies was run.",
        "what_would_change_our_mind": "A pass for trend would show the spot-price failure in EXP-0004 was a data problem. A pass for carry with four contracts would be strong evidence, since the papers use 20 or more.",
        "already_seen": "No. Before registering, only data checks were run on the futures indices (roll days found, size of the largest daily moves, coverage); no strategy return or performance number was computed.",
    }),
    ("REG-0008-oil-volatility-and-commodity-currencies.json", {
        "id": "REG-0008",
        "title": "Selling crude oil variance, and commodity currencies leading energy futures, April 2008 to April 2024",
        "created": "2026-10-21",
        "authors": ["amanda"],
        "hypotheses": ["HYP-0014", "HYP-0015"],
        "experiment": "EXP-0009",
        "question": "From after Chen, Rogoff and Rossi's sample to the end of the free futures data, do selling crude oil variance (before swap costs) and trading energy futures on commodity currencies' 3-month moves each pass at least four of the five reality tests?",
        "strategies": [
            {"name": "oil_variance_short", "params": {"max_ovx": None}},
            {"name": "commodity_fx_leads_energy", "params": {"lookback": 63, "rebalance": "M"}},
        ],
        "backtest": {**BASE, "start": "2008-04-01", "end": "2024-04-05", "cost_bps": 3.0},
        "pass_criteria": {"min_real_tests": 4},
        "prior_trials": 210,
        "prior_trials_note": "208 + 2 (REG-0007). Includes the commodity gap trials (HYP-0003, HYP-0008) on the opposite direction of the commodity and currency link. No exploratory evaluation of these strategies was run.",
        "what_would_change_our_mind": "Selling oil variance passing would still only be an upper bound, because swap costs are missing; failing would mean even the best case does not hold. A pass for the currency signal would turn our failed oil idea into a working one, pointing the other way.",
        "already_seen": "No. Before registering, only data checks were run (OVX coverage, the variance index never falling to zero, roll days); no strategy return or performance number was computed.",
    }),
]

for fname, data in regs:
    with open(root / fname, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("wrote", fname)
