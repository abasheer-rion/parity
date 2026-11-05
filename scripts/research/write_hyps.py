"""Fill in HYP-0009 to HYP-0015. Usage: write_hyps.py REPO_ROOT"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1]) / "docs" / "hypotheses"

GAUNTLET = "[REF-0006](../reference/0006-the-gauntlet.md)"
EM_REG = "`REG-0006`"
EN_REG = "`REG-0007`"
LATE_REG = "`REG-0008`"

H = {
"0009-emerging-market-carry-pays-after-costs.md": dict(
    related="[EXP-0007, HYP-0001, RES-0011]",
    plain="Countries like Brazil, Turkey and South Africa pay much more interest than the US. If we hold their money, spread over many countries, and only when the extra interest is worth the trading cost, we should earn something after costs. Every study that says so stops by 2010, so we test only the years since.",
    claim="From February 2010, a long-only basket of the third of emerging market currencies with the highest interest rate gap to the dollar (at least 1 percentage point), equal weighted and rebalanced monthly, has a Sharpe ratio reliably above zero after 10 basis points of cost per unit traded, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- Adding EM currencies raised carry's Sharpe ratio from 0.56 to 0.74 after costs over 1983 to 2009 (Menkhoff et al., 2012), and a cost-aware rule earned 1.32 over 1997 to 2006 (Burnside et al., 2007); see [RES-0011](../research/0011-emerging-market-currencies.md).\n- EM currencies move less together than G10 currencies, so a basket diversifies.\n- Our G10 carry was small but consistent ([EXP-0004](../experiments/0004-all-strategies-1999.md)).",
    false="- The 2010s were bad for EM currencies: the 2013 taper scare, the 2014 to 2016 commodity slump, Turkey and Argentina in 2018, Covid in 2020, Russia in 2022.\n- In EM, high rates partly predict depreciation, as theory says (Frankel and Poonawala, 2010).\n- Our free rates are policy or interbank rates, not what forwards pay, and the ruble's 2022 exit is booked at its last ECB price, which flatters the result.",
    test=f"1. Pre-registered in {EM_REG} before any performance number was computed: start 2010-02-01 (after every paper's sample), 10 bp cost per unit traded, defaults as in the code.\n2. Pass bar: at least 4 of the 5 reality tests (B1 to B5). The six beat-the-market tests are reported too.\n3. Trials: counted with every earlier trial in the project, as in `REG-0003`.\n4. Results in [EXP-0007](../experiments/0007-emerging-market-currencies-since-2010.md)."),
"0010-emerging-market-basket-kept-paying-after-2008.md": dict(
    related="[EXP-0007, RES-0011]",
    plain="A well-known study found that simply owning 20 emerging market currencies against the dollar paid as much as stocks with a third of the risk, from 1999 to 2008. Its data stopped a month before the 2008 crash. We test whether the same simple basket kept paying afterwards.",
    claim="From February 2010, an equal-weighted long basket of every emerging market currency in our data against the dollar, rebalanced monthly, has a Sharpe ratio reliably above zero after 10 basis points of cost per unit traded, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- Gilmore and Hayashi (2011) report 6.6% a year at 4.9% volatility (Sharpe 1.34) for 1999 to 2008 ([RES-0011](../research/0011-emerging-market-currencies.md)).\n- The basket earns the average EM interest premium, which stayed large.",
    false="- Their sample was an EM boom with a falling dollar; the dollar rose for much of 2011 to 2022.\n- The authors had a commercial interest and proprietary data.\n- A long-only basket is a bet against the dollar and on global growth, which tends to lose when stocks fall.",
    test=f"1. Pre-registered in {EM_REG} with the other EM strategies, same start, costs and pass bar.\n2. The question is only whether the post-2008 basket earned anything, not whether it beat stocks.\n3. Results in [EXP-0007](../experiments/0007-emerging-market-currencies-since-2010.md)."),
"0011-emerging-market-momentum-survives-costs.md": dict(
    related="[EXP-0007, HYP-0002, RES-0011]",
    plain="Among the big currencies, buying the recent winners and selling the recent losers did not work for us. Researchers say this kind of momentum lives in smaller currencies, where fewer traders compete. We test it on emerging market currencies, after costs.",
    claim="From February 2010, a strategy long the third of emerging market currencies with the highest past 3-month excess return and short the lowest third, rebalanced monthly, has a Sharpe ratio reliably above zero after 10 basis points of cost per unit traded, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- Menkhoff et al. (2012) find currency momentum up to about 10% a year before costs and about 4% after for the best version, concentrated in minor currencies; among developed currencies it is \"basically non-existent after transaction costs\".\n- Our G10 cross-sectional momentum failed ([EXP-0004](../experiments/0004-all-strategies-1999.md)), which fits that account.",
    false="- The profit lives where costs are highest; 10 bp may still be too low for some EM currencies.\n- Short positions in high-rate EM currencies pay their carry, which momentum may not cover.",
    test=f"1. Pre-registered in {EM_REG}: lookback 63 trading days, top and bottom thirds, monthly.\n2. Same start, costs and pass bar as HYP-0009.\n3. Results in [EXP-0007](../experiments/0007-emerging-market-currencies-since-2010.md)."),
"0012-energy-futures-trend-pays-on-tradable-prices.md": dict(
    related="[EXP-0004, EXP-0008, RES-0012]",
    plain="Our commodity trend test lost almost everything, but it used gas prices nobody could actually trade. We rerun the same idea on real futures contracts for oil, heating oil, gasoline and gas, rolled the way a fund would roll them, to get a fair answer.",
    claim="From 1999-01-04 to 2024-04-05 (when the free futures prices end), a 12-month time series momentum rule on rolled NYMEX crude oil, heating oil, gasoline and natural gas futures, with inverse volatility weights and monthly rebalancing, has a Sharpe ratio reliably above zero after 3 basis points of cost per unit traded and 2 basis points per roll, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- Moskowitz, Ooi and Pedersen (2012) find 12-month momentum positive in every one of 58 futures markets, 1985 to 2009; AQR's long backtest reports a net Sharpe ratio of 0.62 for 2000 to 2013 ([RES-0012](../research/0012-commodity-futures-carry-trend-and-volatility.md)).\n- Trend's crisis gains (2008, 2022 in the industry indices) are what made our currency trend useful.",
    false="- Four energy contracts are highly correlated, so this is close to a single bet on oil.\n- Trend funds had a poor decade after 2009.\n- The earlier spot-price version is already a seen trial on the same idea.",
    test=f"1. Pre-registered in {EN_REG}. Ends on 2024-04-05 because the EIA stopped publishing futures prices then.\n2. Pass bar: at least 4 of 5 reality tests.\n3. Counts the earlier `commodity_tsmom` runs as prior trials.\n4. Results in [EXP-0008](../experiments/0008-energy-futures-trend-and-carry.md)."),
"0013-energy-futures-carry-pays.md": dict(
    related="[EXP-0008, RES-0012]",
    plain="Some commodities cost more for delivery now than for delivery later, usually because stocks are low. Owning those and selling the opposite ones has paid well in research that covers 20 to 30 commodities, even after it was published. We test a small version with the four energy futures we can get for free.",
    claim="From 1999-01-04 to 2024-04-05, long the energy futures whose curve slope 12 * ln(C2 / C3) is above the cross-sectional median and short those below, inverse volatility weighted and rebalanced monthly, has a Sharpe ratio reliably above zero after 3 basis points of cost per unit traded and 2 basis points per roll, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- High-minus-low basis earned 9.2% a year (Sharpe 0.68) in 1959 to 2004 and 10.4% (Sharpe 1.04) out of sample in 2005 to 2014 (Bhardwaj, Gorton and Rouwenhorst, 2015).\n- Koijen et al. (2018) find commodity carry Sharpe 0.60 on 24 commodities.",
    false="- Four contracts instead of 20 to 30, so far less diversification.\n- Natural gas curves are seasonal, so its slope is partly a calendar effect, not scarcity.\n- Carry strategies across asset classes lose together in global recessions.",
    test=f"1. Pre-registered in {EN_REG}, same dates, costs and pass bar as HYP-0012.\n2. Default uses today's slope (smooth = 1), as the papers do.\n3. Results in [EXP-0008](../experiments/0008-energy-futures-trend-and-carry.md)."),
"0014-selling-oil-volatility-pays-a-premium.md": dict(
    related="[EXP-0009, RES-0012, RES-0013]",
    plain="People pay to protect themselves from big oil price swings, and on average they pay more than the swings cost. Selling them that protection should earn money most months and lose a lot in a few. We test how much, before trading costs we cannot measure, so the answer is a best case.",
    claim="From 2008-04-01 to 2024-04-05, selling a 30-day crude oil variance swap each month at OVX squared, marked daily with realised variance from rolled WTI futures, has a Sharpe ratio reliably above zero and passes at least four of the five reality tests in " + GAUNTLET + ", before variance swap trading costs.",
    true="- Shorting crude oil variance had a Sharpe ratio of 0.59 in 1996 to 2006 (Trolle and Schwartz, 2010), and variance buyers lost in 18 of 21 commodity markets (Prokopczuk et al., 2017).\n- The S&P 500 version of the same trade is one of the best documented premia.",
    false="- It loses most in crashes: late 2008 and March and April 2020 are in the window.\n- OVX is built from options on USO, an ETF that held near-month futures, so it is not exactly a swap on our rolled index.\n- Real variance swaps cost several volatility points to trade, which could remove the premium.",
    test=f"1. Pre-registered in {LATE_REG}. Starts 2008-04-01 with the commodity currency test; OVX starts in May 2007.\n2. Pass bar: at least 4 of 5 reality tests. Test B5 (does not crash with stocks) is expected to fail and matters most for [RES-0013](../research/0013-famous-currency-and-commodity-traders-and-what-their-records-teach.md)'s warning.\n3. Results in [EXP-0009](../experiments/0009-oil-volatility-and-commodity-currency-signals.md)."),
"0015-commodity-currencies-lead-energy-futures.md": dict(
    related="[EXP-0009, HYP-0003, HYP-0008, RES-0012]",
    plain="We tried using oil prices to predict the Canadian dollar and it did not work. Research says the arrow points the other way: currencies of countries that export commodities move first, and commodity prices follow. So we flip the idea and use those currencies to decide whether to own energy futures.",
    claim="From 2008-04-01 (after the paper's sample) to 2024-04-05, holding all energy futures long when the average 3-month change of AUD, CAD, NZD and ZAR against the dollar is positive, and short when negative, inverse volatility weighted and rebalanced monthly, has a Sharpe ratio reliably above zero after 3 basis points of cost per unit traded and 2 basis points per roll, and passes at least four of the five reality tests in " + GAUNTLET + ".",
    true="- Chen, Rogoff and Rossi (2010) find commodity currency exchange rates forecast commodity prices out of sample, and the reverse is less robust.\n- Ferraro, Rogoff and Rossi (2015) find the oil and Canadian dollar link mostly same-day, which explains why our oil-first idea failed ([EXP-0003](../experiments/0003-monthly-commodity-gap.md)).",
    false="- The paper forecasts broad commodity indices quarterly; we trade four energy contracts monthly.\n- Better forecasts in a statistical sense need not make money after costs.\n- Commodity currencies and oil both move with the dollar and global risk appetite, so the signal may be a disguised trend rule.",
    test=f"1. Pre-registered in {LATE_REG}.\n2. Pass bar: at least 4 of 5 reality tests.\n3. Counts the earlier commodity gap trials (HYP-0003, HYP-0008) as prior trials on the commodity and currency link.\n4. Results in [EXP-0009](../experiments/0009-oil-volatility-and-commodity-currency-signals.md)."),
}

for fname, h in H.items():
    p = root / fname
    t = p.read_text(encoding="utf-8")
    t = t.replace("status: open", "status: testing", 1)
    t = re.sub(r"related: \[\]", "related: " + h["related"], t, count=1)
    sections = {"In plain words": h["plain"], "Claim": h["claim"],
                "Why it might be true": h["true"], "Why it might be false": h["false"],
                "How we test it": h["test"],
                "Result so far": "None yet. Registered on 2026-10-21; no performance number has been computed for this rule by anyone on the team."}
    for head, body in sections.items():
        t = t.replace(f"## {head}\n\nTODO", f"## {head}\n\n{body}", 1)
    assert "TODO" not in t, fname
    with open(p, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(t)
    print("wrote", fname)
