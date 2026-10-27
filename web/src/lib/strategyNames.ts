// The one place a strategy gets the name and one-line tagline people see. Ids never change
// and stay in URLs, data files and tests; only what is shown comes from here. A strategy
// with no entry falls back to the engine's display name, then to a cleaned-up id, never
// the raw id. The test in tests/strategyNames.test.ts checks every engine strategy has one.

export interface StrategyLabel { name: string; tagline: string }

export const STRATEGY_NAMES: Record<string, StrategyLabel> = {
  // Benchmarks and simple mixes
  us_market_buy_hold: { name: "US Market", tagline: "Owns the whole US stock market and never trades." },
  sixty_forty: { name: "Sixty Forty", tagline: "Holds 60% US stocks and 40% 10-year Treasuries, rebalanced monthly." },
  thirds: { name: "Even Thirds", tagline: "Holds a third each in US stocks, 10-year Treasuries and T-bills." },
  risk_parity_stocks_bonds: { name: "Risk Parity", tagline: "Splits stocks and Treasuries so each carries the same risk." },
  market_plus_factors: { name: "Market Plus", tagline: "The US stock market with half a unit of the five-factor mix on top." },

  // Bonds
  bonds_curve_butterfly: { name: "Butterfly", tagline: "Trades 5-year Treasuries against 2- and 10-year ones when out of line." },
  bonds_steep_curve: { name: "Steep Curve", tagline: "Holds 10-year Treasuries while the yield curve is steeper than usual." },
  bonds_term_premium: { name: "Term Premium", tagline: "Holds 10-year Treasuries when they pay a point more than 2-year notes." },
  bonds_trend: { name: "Bond Trend", tagline: "Holds 10-year Treasuries while above their 10-month average." },
  cot_bonds_not_crowded: { name: "Bond Crowd Check", tagline: "Holds 10-year Treasuries, or 2-year notes when speculators pile in." },

  // Commodities
  commodity_tsmom: { name: "Crude Momentum", tagline: "Buys oil after a rising year and bets against it after a falling one." },
  oil_trend: { name: "Oil Trend", tagline: "Owns Brent crude while it is up over six months, otherwise cash." },
  oil_reversal: { name: "Oil Snapback", tagline: "Buys oil after a down month and bets against it after an up month." },
  oil_brent_wti: { name: "Brent vs WTI", tagline: "Trades the gap between the two main oil prices when it stretches." },

  // Positioning
  cot_fx_contrarian: { name: "Against the Crowd", tagline: "Buys the currencies speculators shun and sells the ones they favour." },
  cot_fx_extremes: { name: "Crowd Extremes", tagline: "Bets against a currency only when speculators are at an extreme." },
  cot_stocks_not_crowded: { name: "Stock Crowd Check", tagline: "Holds US stocks unless speculators pile into futures, then cash." },

  // Stock factors
  factor_cma: { name: "Thrifty Firms", tagline: "Buys companies that invest carefully over those growing assets fast." },
  factor_five_equal: { name: "Factor Five", tagline: "Equal parts size, value, momentum, profitability and investment." },
  factor_hml: { name: "Deep Value", tagline: "Buys cheap companies by book value and sells expensive ones." },
  factor_january_size: { name: "January Small Caps", tagline: "Buys small companies over large ones, in January only." },
  factor_ltrev: { name: "Long Comeback", tagline: "Buys the biggest five-year stock losers and sells the biggest winners." },
  factor_mom: { name: "Momentum Push", tagline: "Buys last year's winning stocks and sells the losers." },
  factor_momentum: { name: "Factor Momentum", tagline: "Holds each of five stock factors only while it is up over the year." },
  factor_momentum_crash_guard: { name: "Crash Guard", tagline: "Stock momentum, switched off after the market falls over two years." },
  factor_momentum_vol_managed: { name: "Steady Momentum", tagline: "Stock momentum, scaled down when volatile and up when calm." },
  factor_quality: { name: "Quality Firms", tagline: "Buys companies that earn well and do not overspend." },
  factor_risk_parity: { name: "Balanced Factors", tagline: "Weights five stock factors so each carries the same risk." },
  factor_rmw: { name: "Profit Makers", tagline: "Buys highly profitable companies and sells weak ones." },
  factor_smb: { name: "Small Caps", tagline: "Buys small companies and sells large ones." },
  factor_strev: { name: "Monthly Rebound", tagline: "Buys last month's losing stocks and sells last month's winners." },
  factor_value_momentum: { name: "Value Meets Momentum", tagline: "Half the value factor, half the momentum factor." },
  factor_value_vol_managed: { name: "Steady Value", tagline: "The value factor, scaled to keep volatility near 10% a year." },

  // Currencies: carry
  fx_carry: { name: "Classic Carry", tagline: "Buys high interest rate currencies, funded by low rate ones." },
  fx_carry_calm: { name: "Calm Carry", tagline: "Currency carry that steps aside when market fear runs high." },
  fx_carry_momentum: { name: "Carry Momentum", tagline: "Buys currencies with high rates and rising prices, sells the opposite." },
  fx_carry_top1: { name: "The Gambit", tagline: "Buys the single highest-rate currency against the single lowest." },
  fx_carry_top2: { name: "Double Carry", tagline: "Buys the two highest-rate currencies against the two lowest." },
  fx_carry_trend_value: { name: "Currency Trio", tagline: "Splits money equally between currency carry, trend and value." },
  fx_dollar_carry: { name: "Dollar Carry", tagline: "Buys major currencies against the dollar when they pay more interest." },
  xfx_policy_carry_g10: { name: "G10 Policy Carry", tagline: "Buys the G10 currencies with the highest central bank rates." },
  xfx_policy_carry_wide: { name: "Wide Policy Carry", tagline: "Buys the five highest-rate of 27 currencies, sells the five lowest." },
  xfx_policy_carry_calm: { name: "Stress-Safe Carry", tagline: "Wide policy-rate carry that moves to cash in financial stress." },
  xfx_policy_momentum_wide: { name: "Rate Hikers", tagline: "Buys currencies whose central banks raised rates most in six months." },
  fx_rate_momentum: { name: "Rising Rates", tagline: "Buys currencies whose interest rates rose most over six months." },

  // Currencies: trend and momentum
  fx_tsmom: { name: "Currency Trend", tagline: "Buys currencies that rose over the year and sells those that fell." },
  fx_trend_3m: { name: "Quarter Trend", tagline: "Buys currencies that rose over three months and sells those that fell." },
  fx_trend_1m: { name: "Fast Trend", tagline: "Follows each currency's move over the last month." },
  fx_xs_momentum: { name: "Currency Winners", tagline: "Buys the three strongest currencies of the year, sells the weakest." },
  fx_momentum_1m: { name: "Monthly Winners", tagline: "Buys the three currencies that rose most last month, sells the worst." },
  fx_wide_momentum: { name: "Wide Winners", tagline: "Buys the strongest of 21 currencies, emerging ones included." },
  fx_wide_trend: { name: "Wide Trend", tagline: "Follows the one-year trend in each of 21 currencies." },
  fx_dollar_trend: { name: "Dollar Trend", tagline: "Bets on or against the dollar, following its three-month trend." },
  fx_short_dollar: { name: "Short the Dollar", tagline: "Owns every major currency against the dollar in equal parts." },
  fx_near_high: { name: "Near the High", tagline: "Buys currencies near their one-year high, sells those far below it." },
  fx_ma_cross: { name: "Currency Golden Cross", tagline: "Owns a currency while its 50-day average is above its 200-day." },
  fx_donchian: { name: "Turtle Breakout", tagline: "Buys currencies at 55-day highs and sells them at 55-day lows." },
  fx_macd: { name: "MACD Currencies", tagline: "Buys a currency when its MACD is above its signal line, sells below." },
  fx_ichimoku: { name: "Cloud Signal", tagline: "Buys a currency above its Ichimoku cloud and sells it below." },
  fx_calm_currencies: { name: "Calm Currencies", tagline: "Buys the three steadiest currencies and sells the three most volatile." },

  // Currencies: value and reversal
  fx_value_reer: { name: "Currency Value", tagline: "Buys currencies that look cheap against their long-run average." },
  fx_value_5y: { name: "Five-Year Value", tagline: "Buys currencies that fell most over five years, sells the top risers." },
  fx_reversal_1w: { name: "Weekly Bounce", tagline: "Buys last week's three weakest currencies, sells the three strongest." },
  fx_wide_reversal: { name: "Wide Bounce", tagline: "Buys last month's weakest of 21 currencies, sells the strongest." },
  fx_rsi_reversion: { name: "RSI Bounce", tagline: "Buys a currency after a sharp fall and sells after a sharp rise." },
  fx_bollinger_fade: { name: "Band Fade", tagline: "Bets a currency snaps back after a big move from its 20-day average." },

  // Currencies: links, pairs and havens
  fx_commodity_gap: { name: "Oil Catch-Up", tagline: "Buys the Canadian dollar or krone when it lags a move in oil." },
  fx_oil_cad: { name: "Oil Loonie", tagline: "Owns the Canadian dollar while oil is up over three months." },
  fx_oil_nok: { name: "Oil Krone", tagline: "Owns the Norwegian krone while oil is up over three months." },
  fx_copper_aud: { name: "Copper Aussie", tagline: "Owns the Australian dollar while copper is up over six months." },
  fx_euro_vs_us_curve: { name: "Euro Rate Gap", tagline: "Owns the euro while euro 2-year yields gain on US ones." },
  fx_pair_aud_nzd: { name: "Aussie Kiwi", tagline: "Trades the Australian against the New Zealand dollar when stretched." },
  fx_pair_eur_chf: { name: "Euro Franc", tagline: "Trades the euro against the Swiss franc when their ratio stretches." },
  fx_pair_nok_sek: { name: "Krone Krona", tagline: "Trades the Norwegian krone against the Swedish krona when stretched." },
  fx_safe_haven: { name: "Safe Haven", tagline: "Buys the yen and franc against the Aussie and Kiwi when fear spikes." },

  // US industries
  industry_equal: { name: "Equal Industries", tagline: "Puts an equal share in each of 12 US industries." },
  industry_momentum: { name: "Industry Leaders", tagline: "Owns the three US industries that rose most over the past year." },
  industry_momentum_ls: { name: "Leaders and Laggards", tagline: "Buys the three strongest US industries and shorts the three weakest." },
  industry_near_high: { name: "Industry Highs", tagline: "Owns the three US industries closest to their 52-week high." },
  industry_reversal: { name: "Industry Bounce", tagline: "Buys last month's three weakest US industries, shorts the strongest." },
  industry_long_reversal: { name: "Industry Comeback", tagline: "Owns the three US industries that lagged most over five years." },
  industry_low_vol: { name: "Calm Industries", tagline: "Owns the four US industries with the steadiest prices last year." },
  industry_risk_parity: { name: "Balanced Industries", tagline: "Weights 12 US industries so the steadier ones get more money." },
  industry_seasonal: { name: "Industry Seasons", tagline: "Owns the three US industries that usually do best in the coming month." },
  industry_trend: { name: "Industry Trend", tagline: "Holds 12 US industries, each moving to cash while down on the year." },
  industry_curve_rotation: { name: "Curve Rotation", tagline: "Owns cyclical industries when the yield curve is steep, else defensive." },
  industry_defensive_in_fear: { name: "Defensive Shift", tagline: "Holds the US market, moving to defensive industries in a panic." },
  industry_energy_on_oil: { name: "Energy Tilt", tagline: "Holds the US market, moving half into energy while oil is rising." },

  // US stocks: trend and timing
  stocks_trend_10m: { name: "Ten-Month Trend", tagline: "Holds US stocks while above their 10-month average, otherwise cash." },
  stocks_trend_100d_daily: { name: "Daily Trend", tagline: "Holds US stocks while above their 100-day average, checked daily." },
  stocks_trend_leveraged: { name: "Geared Trend", tagline: "Holds US stocks at 1.5 times while above their 10-month average." },
  stocks_trend_or_bonds: { name: "Trend or Bonds", tagline: "Holds US stocks while above their 10-month average, else Treasuries." },
  stocks_golden_cross: { name: "Golden Cross", tagline: "Holds US stocks while the 50-day average is above the 200-day." },
  stocks_donchian: { name: "Stock Turtle", tagline: "Buys US stocks after a 55-day high, moves to cash after a 20-day low." },
  stocks_macd: { name: "Stock MACD", tagline: "Holds US stocks when MACD is above its signal line, otherwise cash." },
  stocks_absolute_momentum: { name: "Absolute Momentum", tagline: "Holds US stocks while they beat T-bills over the year, else cash." },
  stocks_dual_momentum: { name: "Dual Momentum", tagline: "Holds US stocks while they beat T-bills over a year, else bonds." },
  stocks_bonds_trend: { name: "Trend Pair", tagline: "Half stocks, half Treasuries, each going to cash when down a year." },
  stocks_plus_fx_trend: { name: "Stocks Plus Trend", tagline: "Holds US stocks plus a currency trend book that may soften crashes." },
  stocks_drawdown_stop: { name: "Stop Loss", tagline: "Holds US stocks but sells after a 15% fall from the one-year high." },
  stocks_rsi2_dip: { name: "Dip Buyer", tagline: "Buys short, sharp dips in US stocks during an uptrend." },
  stocks_vol_managed: { name: "Volatility Dial", tagline: "Holds more stock when markets are calm and less when they are wild." },

  // US stocks: risk and macro switches
  stocks_vix_below_30: { name: "Panic Exit", tagline: "Holds US stocks unless the VIX fear gauge is above 30." },
  stocks_vix_calm: { name: "Calm Markets", tagline: "Holds US stocks while the VIX is below its one-year average." },
  stocks_flight_to_bonds: { name: "Flight to Bonds", tagline: "Holds US stocks, switching to Treasuries when the VIX tops 25." },
  stocks_low_stress: { name: "Low Stress", tagline: "Holds US stocks while the St. Louis Fed stress index is low." },
  stocks_conditions_easing: { name: "Easy Money", tagline: "Holds US stocks while financial conditions are easing, else cash." },
  stocks_claims_calm: { name: "Layoff Watch", tagline: "Holds US stocks unless jobless claims climb 20% above their low." },
  stocks_copper_up: { name: "Doctor Copper", tagline: "Holds US stocks while copper is up over six months." },
  stocks_oil_shock: { name: "Oil Shock", tagline: "Holds US stocks unless oil rises more than 50% in three months." },
  stocks_falling_rates: { name: "Falling Rates", tagline: "Holds US stocks while the 10-year yield is below its one-year average." },
  stocks_yield_curve: { name: "Curve Warning", tagline: "Holds US stocks unless 2-year yields rise above 10-year yields." },
  stocks_yield_curve_3m: { name: "T-Bill Warning", tagline: "Holds US stocks unless the 10-year yield falls below the 3-month bill." },

  // US stocks: calendar
  stocks_sell_in_may: { name: "Sell in May", tagline: "Holds US stocks from November to April, cash the rest of the year." },
  stocks_turn_of_month: { name: "Month Turn", tagline: "Holds US stocks only for a few days around each month's turn." },
  stocks_turn_of_year: { name: "Year Turn", tagline: "Holds US stocks over the last days of December and first of January." },
  stocks_skip_weekend: { name: "Weekend Off", tagline: "Holds US stocks every night except over the weekend." },
  stocks_pre_fomc: { name: "Fed Day Drift", tagline: "Holds US stocks only over scheduled Fed announcement days." },
  stocks_fomc_even_weeks: { name: "Fed Cycle", tagline: "Holds US stocks in the even weeks of the Fed meeting cycle." },
};

// Short id parts that read better spelled out or in capitals.
const WORDS: Record<string, string> = {
  fx: "currency", xfx: "currency", us: "US", g10: "G10", ma: "MA", rsi: "RSI", macd: "MACD", vix: "VIX",
  cot: "positioning", fomc: "Fed", tsmom: "trend", xs: "ranked", ls: "long-short", vol: "volatility",
  reer: "value", strev: "short-term reversal", ltrev: "long-term reversal", eur: "euro", usd: "dollar",
  aud: "Aussie", nzd: "Kiwi", cad: "Canadian dollar", nok: "krone", sek: "krona", chf: "franc", jpy: "yen",
  wti: "WTI", top1: "top 1", top2: "top 2",
};
const SPAN: Record<string, string> = { d: "day", w: "week", m: "month", y: "year" };

/** "fx_trend_3m" -> "Currency trend 3-month": readable when there is no name. Never the raw id. */
export function humanizeId(id: string): string {
  const words = id.split(/[_\s-]+/).filter(Boolean).map((w) => {
    const lw = w.toLowerCase();
    if (WORDS[lw]) return WORDS[lw];
    const span = lw.match(/^(\d+)([dwmy])$/);
    return span ? `${span[1]}-${SPAN[span[2]]}` : lw;
  });
  const s = words.join(" ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "Unnamed strategy";
}

/** The name people see for a strategy id. `fallback` is a name the data already carries. */
export function displayName(id: string, fallback?: string | null): string {
  return STRATEGY_NAMES[id]?.name ?? (fallback && fallback.trim() && fallback !== id ? fallback : humanizeId(id));
}

/** One plain sentence on what the strategy does, or "" when there is none. */
export function tagline(id: string): string {
  return STRATEGY_NAMES[id]?.tagline ?? "";
}

/**
 * The words a search should match for a strategy: its name, tagline and id, plus the
 * engine's older name (`alias`) so people who learned that one still find it.
 */
export function strategySearchText(id: string, alias?: string | null): string {
  return [displayName(id, alias), alias ?? "", tagline(id), id, id.replace(/_/g, " ")].filter(Boolean).join(" ");
}
