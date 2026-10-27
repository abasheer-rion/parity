// Every strategy shows a short, distinct name and a one-line tagline, never its code id.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { displayName, humanizeId, STRATEGY_NAMES, strategySearchText, tagline } from "../src/lib/strategyNames";
import { nameById, nameOf } from "../src/lib/strategyMeta";
import type { StrategyRun } from "../src/lib/types";

// Engine strategy ids on 2026-10-26 (engine/src/parity/strategies). The parse below also
// catches ids added later that are declared with a literal name.
const KNOWN_IDS = "bonds_curve_butterfly bonds_steep_curve bonds_term_premium bonds_trend commodity_tsmom cot_bonds_not_crowded cot_fx_contrarian cot_fx_extremes cot_stocks_not_crowded factor_cma factor_five_equal factor_hml factor_january_size factor_ltrev factor_mom factor_momentum factor_momentum_crash_guard factor_momentum_vol_managed factor_quality factor_risk_parity factor_rmw factor_smb factor_strev factor_value_momentum factor_value_vol_managed fx_bollinger_fade fx_calm_currencies fx_carry fx_carry_calm fx_carry_momentum fx_carry_top1 fx_carry_top2 fx_carry_trend_value fx_commodity_gap fx_copper_aud fx_dollar_carry fx_dollar_trend fx_donchian fx_euro_vs_us_curve fx_ichimoku fx_ma_cross fx_macd fx_momentum_1m fx_near_high fx_oil_cad fx_oil_nok fx_pair_aud_nzd fx_pair_eur_chf fx_pair_nok_sek fx_rate_momentum fx_reversal_1w fx_rsi_reversion fx_safe_haven fx_short_dollar fx_trend_1m fx_trend_3m fx_tsmom fx_value_5y fx_value_reer fx_wide_momentum fx_wide_reversal fx_wide_trend fx_xs_momentum industry_curve_rotation industry_defensive_in_fear industry_energy_on_oil industry_equal industry_long_reversal industry_low_vol industry_momentum industry_momentum_ls industry_near_high industry_reversal industry_risk_parity industry_seasonal industry_trend market_plus_factors oil_brent_wti oil_reversal oil_trend risk_parity_stocks_bonds sixty_forty stocks_absolute_momentum stocks_bonds_trend stocks_claims_calm stocks_conditions_easing stocks_copper_up stocks_donchian stocks_drawdown_stop stocks_dual_momentum stocks_falling_rates stocks_flight_to_bonds stocks_fomc_even_weeks stocks_golden_cross stocks_low_stress stocks_macd stocks_oil_shock stocks_plus_fx_trend stocks_pre_fomc stocks_rsi2_dip stocks_sell_in_may stocks_skip_weekend stocks_trend_100d_daily stocks_trend_10m stocks_trend_leveraged stocks_trend_or_bonds stocks_turn_of_month stocks_turn_of_year stocks_vix_below_30 stocks_vix_calm stocks_vol_managed stocks_yield_curve stocks_yield_curve_3m thirds us_market_buy_hold xfx_policy_carry_calm xfx_policy_carry_g10 xfx_policy_carry_wide xfx_policy_momentum_wide".trim().split(/\s+/);

function engineIds(): string[] {
  const dir = join(__dirname, "../../engine/src/parity/strategies");
  const ids = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".py"))) {
    const s = readFileSync(join(dir, f), "utf8");
    for (const m of s.matchAll(/^\s+name = "([a-z0-9_]+)"/gm)) ids.add(m[1]);
    for (const m of s.matchAll(/^_?[a-z_]+\(\s*(?:[A-Za-z_]+,\s*)?"([a-z0-9_]+)",/gm)) ids.add(m[1]);
  }
  return [...ids];
}

describe("strategy names", () => {
  it("names every known strategy with a unique, short name and a tagline of at most 80 characters", () => {
    expect(KNOWN_IDS.length).toBeGreaterThan(100);
    const seen = new Map<string, string>();
    for (const id of KNOWN_IDS) {
      const label = STRATEGY_NAMES[id];
      expect(label, id).toBeDefined();
      expect(label.name.split(/\s+/).length, id).toBeLessThanOrEqual(3);
      expect(label.name).not.toBe(id);
      expect(label.tagline.length, id).toBeGreaterThan(10);
      expect(label.tagline.length, id).toBeLessThanOrEqual(80);
      expect(label.tagline, id).toMatch(/\.$/);
      expect(label.name + label.tagline, id).not.toMatch(/[–—]/);
      const key = label.name.toLowerCase();
      expect(seen.get(key), `${id} reuses the name of ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("has no names for ids the engine does not know", () => {
    const known = new Set([...KNOWN_IDS, ...engineIds()]);
    expect(Object.keys(STRATEGY_NAMES).filter((id) => !known.has(id))).toEqual([]);
  });

  it("covers every strategy the engine declares by a literal id", () => {
    const ids = engineIds();
    expect(ids.length).toBeGreaterThan(100);
    expect(ids.filter((id) => !STRATEGY_NAMES[id])).toEqual([]);
  });

  it("falls back to the engine name, then a readable id, never the raw id", () => {
    expect(displayName("fx_carry", "Currency carry")).toBe("Classic Carry");
    expect(displayName("brand_new_idea", "A new idea")).toBe("A new idea");
    expect(displayName("brand_new_idea")).toBe("Brand new idea");
    expect(displayName("fx_trend_6m")).toBe("Currency trend 6-month");
    expect(humanizeId("")).toBe("Unnamed strategy");
    expect(nameById("stocks_vix_spike")).toBe("Stocks VIX spike");
    expect(tagline("brand_new_idea")).toBe("");
  });

  it("uses the table ahead of the run's own display name", () => {
    const run = { strategy: "fx_carry_top1", display_name: "Currency carry, one pair" } as StrategyRun;
    expect(nameOf(run)).toBe("The Gambit");
  });

  it("lets search match the name, the id and the older engine name", () => {
    const text = strategySearchText("fx_carry", "Currency carry").toLowerCase();
    for (const q of ["classic carry", "fx_carry", "fx carry", "currency carry", "interest rate"]) expect(text).toContain(q);
  });
});
