"""Fill in EXP-0005 to EXP-0009. Usage: write_exps.py REPO_ROOT"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1]) / "docs" / "experiments"

PENDING = ("Not run yet. After the registration is merged to `main`, start it from GitHub "
           "Actions (Official run, with the registration id), then add a results block here "
           "with the new run id, as described in [GDE-0004](../guides/0004-the-research-routine.md#running-an-official-test).")

E = {
"0005-rerun-of-all-sixteen-strategies-with-corrected-scoring.md": dict(
    related="[DEC-0009, EXP-0004, RES-0008]",
    plain="Our independent audit found two mistakes in how we scored strategies, which made stock timing rules look better and currency strategies worse than they are. We fixed the code. This experiment reruns the same sixteen strategies, with the same settings, so the official record matches the fixed scoring.",
    question="With Sharpe ratios measured on returns above the T-bill and borrowing paid for ([DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)), does any of the sixteen strategies of [EXP-0004](0004-all-strategies-1999.md) pass all six A tests? Registered as [REG-0004](../../registrations/REG-0004-rerun-with-corrected-scoring.json).",
    setup="- The sixteen strategies and settings of `REG-0003`, unchanged.\n- 1999-01-04 to the latest data, 1 bp costs, carry credited.\n- 204 trials counted (188 before, plus these 16).",
    threats="- Every strategy here was seen under the old scoring, so this is a correction of the record, not a fresh test.\n- The audit's H1 and H2 findings (the gauntlet has little power, and one trial count across all families sets the luck bar) are still open. Results should be read with them in mind.\n- `commodity_tsmom` still uses spot prices; its fair retest is [EXP-0008](0008-energy-futures-trend-and-carry.md).",
    nxt="- Compare each strategy's change from `RUN-000003` and explain any that move a lot.\n- Update [RES-0007](../research/0007-comparing-every-algorithm.md), which carries a warning about the old scoring."),
"0006-stocks-plus-currency-trend-on-its-own.md": dict(
    related="[EXP-0004, HYP-0007]",
    plain="Currency trend made money in most stock market crashes since 1999. If you hold stocks and add some currency trend, the trend may soften the crashes. This experiment tests that combination on its own, with the exact claim from our hypothesis written down as the pass bar before the run.",
    question="Does `stocks_plus_fx_trend` beat the US market on Sharpe ratio (A1), make more money at the market's volatility (A2) and hold up in the market's worst months (B5)? Registered as [REG-0005](../../registrations/REG-0005-stocks-plus-fx-trend-on-its-own.json) for [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md).",
    setup="- Half the risk in US stocks, half in currency trend scaled to the stocks' volatility, the idle half in T-bills (the M1 fix in DEC-0009).\n- 1999-01-04 on, 1 bp costs.\n- Pass bar fixed in advance: tests A1, A2 and B5 all pass.",
    threats="- The crisis behaviour that motivated this test was seen before registering.\n- The gains depend on a handful of crises (2000 to 2002, 2008, 2020, 2022). Four or five episodes are a small sample.\n- The same strategy also runs in `REG-0004`; this run adds one trial.",
    nxt="- If it passes, register a forward test from the date of the run.\n- If it fails A2 but passes B5, test it as a hedge rather than as a way to beat the market."),
"0007-emerging-market-currencies-since-2010.md": dict(
    related="[HYP-0009, HYP-0010, HYP-0011, RES-0011]",
    plain="Research found that emerging market currencies paid well from the late 1990s to 2008, but every study stops by 2010. We test three simple versions (the highest-interest currencies, all of them equally, and the recent winners) only on the years since, with realistic trading costs, and wrote down the pass bar before computing any result.",
    question="Do emerging market carry, a passive EM basket and EM momentum each pass at least four of the five reality tests on February 2010 onward, after 10 bp per unit traded? Registered as [REG-0006](../../registrations/REG-0006-emerging-market-currencies-since-2010.json).",
    setup="- 17 EM currencies from ECB reference rates, turned into USD: BRL, CNY, CZK, HUF, IDR, ILS, INR, KRW, MXN, MYR, PHP, PLN, RON, RUB (to 1 March 2022), THB, TRY, ZAR.\n- Interest rates: OECD 3-month interbank rates dated at month end for CNY, CZK, HUF, ILS, KRW, MXN, PLN, RON, RUB and ZAR; BIS central bank policy rates for BRL, IDR, INR, MYR, PHP, THB and TRY.\n- `em_fx_carry`: top third by rate gap to USD, gap at least 1 point, equal weight, monthly. `em_fx_basket`: all currencies equal weight. `em_fx_momentum`: top third minus bottom third by past 63-day excess return.\n- 10 bp per unit traded (about ten times our G10 cost); the A4 test doubles it.\n- No performance number was computed before registering; only data coverage and missing values were checked.",
    threats="- **Ruble exit.** The ECB stopped quoting the ruble on 1 March 2022. Our backtester closes the position at that last price; real holders could not sell at all for a while. This flatters any strategy long the ruble in early 2022.\n- **Rates are not forward rates.** Policy and interbank rates differ from what forwards pay, most for currencies with capital controls (INR, KRW, BRL, CNY). Carry for those is approximate.\n- **ECB fixing time.** Rates are fixed at 14:15 CET, not at the US close used for the benchmark, which adds noise to daily comparisons.\n- **Currency list chosen today.** We include currencies the ECB still quotes; a currency that stopped being quoted before 2010 is missing (survivorship).\n- **The OECD monthly rates for the G10 are dated at the first of the month** (audit finding M3). The new EM series are dated at month end to avoid that look-ahead, so EM and USD rates are dated differently.",
    nxt="- If any strategy passes, register a forward test.\n- If carry fails, check how much of the loss comes from the crisis episodes listed in [RES-0011](../research/0011-emerging-market-currencies.md#what-happened-after-the-papers)."),
"0008-energy-futures-trend-and-carry.md": dict(
    related="[EXP-0004, HYP-0012, HYP-0013, RES-0012]",
    plain="Our commodity trend test failed, but it used gas prices nobody could trade. We rebuilt the data from real futures contracts for oil, heating oil, gasoline and gas, rolled the way a fund would, and test trend and carry on them. The free prices end in April 2024, so the test does too.",
    question="On rolled NYMEX energy futures from 1999-01-04 to 2024-04-05, do 12-month trend and cross-sectional carry each pass at least four of the five reality tests, after 3 bp per unit traded and 2 bp per roll? Registered as [REG-0007](../../registrations/REG-0007-energy-futures-trend-and-carry.json).",
    setup="- Prices: EIA copies of NYMEX settlements for contracts 1 to 3 of WTI crude (from 1983), heating oil (contract 2 from 1994), natural gas (1994) and RBOB gasoline (October 2005), all ending 5 April 2024.\n- Returns: hold contract 2; when it becomes contract 1 (found from each contract's expiry rule and confirmed from prices within three days), roll into the new contract 2 at that close, paying 2 bp. This never holds a contract in its last month, so the negative WTI settlement of 20 April 2020 is not in the index.\n- `energy_tsmom`: sign of the 12-month return, inverse 60-day volatility weights, monthly. `energy_carry`: sign of 12 * ln(C2 / C3) minus the cross-sectional median, inverse volatility weights, monthly.\n- No strategy return was computed before registering; only roll days and data coverage were checked.",
    threats="- **Four contracts.** All four are energy and move together, so neither strategy is diversified like the 20 to 58 contracts in the papers.\n- **Natural gas seasonality.** The gas curve slopes up and down with the seasons, so part of the carry signal is a calendar effect.\n- **Roll day errors.** Where the curve is flat, the roll day may be off by a day, which changes that day's return by about the spread between contracts.\n- **Data ends in April 2024.** No forward test is possible with this source.",
    nxt="- If trend passes, mark `commodity_tsmom` as superseded in the catalog notes.\n- Find a free, permitted source of futures prices after April 2024 before any forward test."),
"0009-oil-volatility-and-commodity-currency-signals.md": dict(
    related="[HYP-0014, HYP-0015, RES-0012, RES-0013]",
    plain="Two new ideas on oil. First, selling insurance against big oil price swings, which research says pays most of the time and loses badly in crashes. Second, using the currencies of commodity-exporting countries to predict energy prices, which turns our failed oil idea around. Both run from April 2008 to April 2024.",
    question="Do a short crude oil variance swap (before swap costs) and a commodity currency signal for energy futures each pass at least four of the five reality tests from 2008-04-01 to 2024-04-05? Registered as [REG-0008](../../registrations/REG-0008-oil-volatility-and-commodity-currencies.json).",
    setup="- `oil_variance_short`: each month, a short 30-day variance swap struck at OVX squared at the last close of the previous month; marked daily with realised variance of the rolled WTI index so far and OVX for the rest of the month; one volatility point at the strike costs about 0.2% of capital. No swap trading costs.\n- `commodity_fx_leads_energy`: average 3-month log change of AUD, CAD, NZD (FRED) and ZAR (ECB) against USD; long all energy futures when positive, short when negative, inverse volatility weights, monthly; 3 bp per unit traded and 2 bp per roll.\n- No strategy return was computed before registering; only coverage, roll days and that the variance index stays above zero were checked.",
    threats="- **Variance swap costs are missing.** Real swaps or option strips cost several volatility points; the result is an upper bound.\n- **OVX is built from options on USO**, which held near-month futures, while our realised variance uses a contract 2 index. The two are close but not the same.\n- **The commodity currency signal moves with the dollar**, so it may be a disguised dollar or risk-appetite bet.\n- **The two ideas share one registration** only because they share the dates; each is judged on its own.",
    nxt="- If selling variance passes, find a cost estimate for crude oil variance swaps before taking it further.\n- If the currency signal passes, test it on a broad commodity index, as the paper did."),
}

for fname, e in E.items():
    p = root / fname
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"related: \[\]", "related: " + e["related"], t, count=1)
    sections = {"In plain words": e["plain"], "Question": e["question"], "Setup": e["setup"],
                "Results": PENDING, "Threats to validity": e["threats"],
                "What we learned": "Nothing yet.", "Next": e["nxt"]}
    for head, body in sections.items():
        t = t.replace(f"## {head}\n\nTODO", f"## {head}\n\n{body}", 1)
    assert "TODO" not in t, fname
    with open(p, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(t)
    print("wrote", fname)
