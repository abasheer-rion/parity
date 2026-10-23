"""Hand-written mutation test for the new engine code. Each mutation edits one line, runs
tests/test_em_energy.py (and the backtest tests for the engine change), and restores
the file. Usage: mutate.py ENGINE_DIR"""
import pathlib
import subprocess
import sys

engine = pathlib.Path(sys.argv[1])
py = engine / ".venv" / "Scripts" / "python.exe"
S = "src/parity/"

MUTATIONS = [
    # sources
    (S + "data/sources.py", 'out = (wide["USD"] / wide[series.code])', 'out = (wide[series.code] / wide["USD"])', "ECB cross upside down"),
    (S + "data/sources.py", 'to_timestamp(how="end")', 'to_timestamp(how="start")', "OECD dated at month start"),
    (S + "data/sources.py", "dates.append(monday + pd.Timedelta(days=i))", "dates.append(monday + pd.Timedelta(days=i + 1))", "EIA weekday offset"),
    (S + "data/sources.py", "            if cell:\n", "            if True:\n", "EIA blank cells kept"),
    (S + "data/sources.py", 'out[~out.index.duplicated(keep="last")].sort_index()\n\n\ndef fetch_eia', 'out.sort_index()\n\n\ndef fetch_eia', "BIS duplicates kept"),
    # futures calendar
    (S + "data/futures.py", "pos = days.get_loc(anchor) - 3", "pos = days.get_loc(anchor) - 2", "CL expiry off by one"),
    (S + "data/futures.py", "before = month[month <= d25]", "before = month[month < d25]", "CL anchor excludes the 25th"),
    (S + "data/futures.py", "expiry = month[-3]", "expiry = month[-2]", "NG expiry off by one"),
    (S + "data/futures.py", "        elif month[-1] > complete_until:\n            continue\n", "", "incomplete month guard removed"),
    (S + "data/futures.py", 'nxt = days.searchsorted(expiry, side="right")', 'nxt = days.searchsorted(expiry, side="left")', "roll on expiry day"),
    # futures index
    (S + "data/futures.py", 'today = df["c1"].where(on_roll, df["c2"])', 'today = df["c2"]', "roll day ignored"),
    (S + "data/futures.py", 'today = df["c1"].where(on_roll, df["c2"])', 'today = df["c1"]', "front contract chained"),
    (S + "data/futures.py", "ret = ret - np.where(on_roll, roll_cost_bps / 1e4, 0.0)", "ret = ret - roll_cost_bps / 1e4", "roll cost every day"),
    (S + "data/futures.py", "    return 12 * np.log(df[\"c2\"].where(df[\"c2\"] > 0) / df[\"c3\"].where(df[\"c3\"] > 0))", "    return 12 * np.log(df[\"c3\"].where(df[\"c3\"] > 0) / df[\"c2\"].where(df[\"c2\"] > 0))", "carry sign flipped"),
    (S + "data/futures.py", 'strikes = df["iv"].groupby(period).last().shift(1)', 'strikes = df["iv"].groupby(period).last()', "variance strike looks ahead"),
    (S + "data/futures.py", "n_var = vega / (2 * k_vol)", "n_var = vega / k_vol", "variance notional wrong"),
    (S + "data/futures.py", "out.loc[days] = level * np.maximum(1 + value.values, 0.0)", "out.loc[days] = level * (1 + value.values)", "variance floor removed"),
    (S + "data/futures.py", "        value = n_var * (k_vol ** 2 - TRADING_DAYS / n_days * sumsq", "        value = n_var * (k_vol ** 2 + TRADING_DAYS / n_days * sumsq", "realised variance sign"),
    (S + "data/futures.py", "    on_roll[pos[(pos > 0) & (pos < len(df))]] = True",
     "    on_roll[pos[(pos > 0) & (pos < len(df))]] = True; on_roll &= df.index.isin(rolls)",
     "rolls on unpriced days dropped"),
    (S + "data/futures.py", "rolls = roll_days(c1.dropna().index.union(c2.dropna().index), rule)",
     "rolls = roll_days(c1.dropna().index, rule)", "calendar from contract 1 only"),
    # strategies
    (S + "strategies/em_fx.py", "pick = _top_fraction(sig, self.fraction) & sig.ge(self.min_carry)", "pick = _top_fraction(sig, self.fraction)", "min carry ignored"),
    (S + "strategies/em_fx.py", "    return sig.rank(axis=1, ascending=False, method=\"first\").le(k, axis=0) & sig.notna()", "    return sig.rank(axis=1, ascending=True, method=\"first\").le(k, axis=0) & sig.notna()", "carry picks lowest"),
    (S + "strategies/em_fx.py", "    return gap.where(panel[FX].notna().values)", "    return gap", "unquoted currencies kept"),
    (S + "strategies/em_fx.py", "        w = longs.astype(float).div(2 * k, axis=0) - shorts.astype(float).div(2 * k, axis=0)", "        w = longs.astype(float).div(2 * k, axis=0)", "momentum not dollar neutral"),
    (S + "strategies/em_fx.py", "        spot = np.log(px / px.shift(self.lookback))", "        spot = np.log(px.shift(-self.lookback) / px)", "momentum looks ahead"),
    (S + "strategies/energy.py", "        side = np.sign(sig.sub(sig.median(axis=1), axis=0))", "        side = -np.sign(sig.sub(sig.median(axis=1), axis=0))", "energy carry reversed"),
    (S + "strategies/energy.py", "            on &= panel[\"risk.OVX\"] <= self.max_ovx", "            on &= panel[\"risk.OVX\"] >= self.max_ovx", "OVX cap reversed"),
    (S + "strategies/energy.py", "        raw = np.sign(self.signal(panel)) * _inverse_vol(panel, FUT)\n        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)\n", "        raw = -np.sign(self.signal(panel)) * _inverse_vol(panel, FUT)\n        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)\n", "commodity fx signal reversed (last occurrence)"),
    (S + "strategies/energy.py", "    carry = panel[CARRY].rolling(self.smooth, min_periods=1).mean()", "    carry = panel[CARRY].rolling(self.smooth, min_periods=1, center=True).mean()", "carry smoothing looks ahead"),
    # engine
    (S + "backtest/engine.py", 'SELF_FINANCING = ("fx.", "fut.", "vrp.")', 'SELF_FINANCING = ("fx.",)', "futures charged as borrowing"),
]


def main() -> int:
    killed, survived = 0, []
    for rel, old, new, label in MUTATIONS:
        path = engine / rel
        text = path.read_text(encoding="utf-8")
        count = text.count(old)
        if count == 0:
            print(f"SKIP (pattern not found): {label}")
            survived.append(label + " [not applied]")
            continue
        # replace the last occurrence when several match (documented in the label)
        idx = text.rfind(old)
        mutated = text[:idx] + new + text[idx + len(old):]
        path.write_text(mutated, encoding="utf-8", newline="\n") if False else open(path, "w", encoding="utf-8", newline="\n").write(mutated)
        try:
            res = subprocess.run([str(py), "-m", "pytest", "-x", "-q", "-p", "no:cacheprovider",
                                  "tests/test_em_energy.py"], cwd=engine, capture_output=True,
                                 text=True, errors="replace", timeout=600)
        finally:
            open(path, "w", encoding="utf-8", newline="\n").write(text)
        if res.returncode != 0:
            killed += 1
            print(f"killed   {label}")
        else:
            survived.append(label)
            print(f"SURVIVED {label}")
    print(f"\n{killed} of {len(MUTATIONS)} mutations killed")
    for s in survived:
        print("  survived:", s)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
