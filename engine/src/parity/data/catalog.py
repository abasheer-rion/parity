"""Every series the engine knows how to fetch.

Keys follow a simple pattern so strategies can ask for data without knowing where
it comes from:

    fx.<CCY>     USD value of one unit of the foreign currency (higher = foreign stronger)
    rate.<CCY>   3-month interbank rate, percent per year (monthly, forward filled)
    cmd.<NAME>   commodity price in USD
    eq.<NAME>    equity index or ETF level
    risk.<NAME>  risk gauges such as the VIX
    curve.<X><n> NYMEX futures contract n settlement price
    fut.<X>      rolled futures excess return index (self-financing, like fx.)
    carry.<X>    futures curve slope, a signal rather than a price
    vrp.<NAME>   excess return index of a volatility selling position (self-financing)

Wider official data (REF-0015), all optional:

    ecb.<CCY>      units of the currency per euro, ECB reference rate
    curve.<NAME>   government yield curve points, percent (US Treasury, euro area AAA)
    policy.<CCY>   central bank policy rate, percent (BIS)
    money.<NAME>   overnight and short money market rates, percent
    spread.<NAME>  yield spreads, percentage points
    infl.<NAME>    market inflation expectations (breakevens), percent
    usd.<NAME>     trade-weighted dollar indexes (Federal Reserve)
    cot.<NAME>     CFTC Commitments of Traders, speculators' net futures position
    xfx.<CCY>      USD value of one unit of a currency, crossed from ECB reference rates
    eia.<NAME>     EIA weekly petroleum and gas stocks (needs EIA_API_KEY)
    macro.<NAME>   weekly economic gauges

To add a series, add one line here and note it in docs/reference/0003-data-sources.md.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Series:
    key: str
    source: str  # a provider id in providers.py, such as "fred", "ecb" or "derived"
    code: str
    description: str
    invert: bool = False  # True when the source quotes foreign units per USD
    frequency: str = "D"  # "D" daily, "M" monthly
    required: bool = True  # official runs fail if a required series cannot be fetched
    #: Monthly averages dated the 1st are only known after the month ends. When set, the
    #: panel moves each value to the month's end plus this many business days, the day it
    #: could first be read. None keeps the source's own dates.
    published_after: int | None = None
    #: Business days after its stamped date that a value is first known. COT positions
    #: are dated Tuesday and released Friday, so they use 3. The panel moves each value
    #: forward by this much. 0 keeps the source's own dates.
    lag_days: int = 0
    #: May the shared site chart it. Every source here allows display with attribution;
    #: False only keeps the dashboard file small for bulk optional series.
    site: bool = True


G10 = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK"]

_FX = [
    Series("fx.EUR", "fred", "DEXUSEU", "USD per EUR (Fed H.10)"),
    Series("fx.GBP", "fred", "DEXUSUK", "USD per GBP (Fed H.10)"),
    Series("fx.JPY", "fred", "DEXJPUS", "JPY per USD, inverted", invert=True),
    Series("fx.CHF", "fred", "DEXSZUS", "CHF per USD, inverted", invert=True),
    Series("fx.CAD", "fred", "DEXCAUS", "CAD per USD, inverted", invert=True),
    Series("fx.AUD", "fred", "DEXUSAL", "USD per AUD (Fed H.10)"),
    Series("fx.NZD", "fred", "DEXUSNZ", "USD per NZD (Fed H.10)"),
    Series("fx.NOK", "fred", "DEXNOUS", "NOK per USD, inverted", invert=True),
    Series("fx.SEK", "fred", "DEXSDUS", "SEK per USD, inverted", invert=True),
]

_RATE_CODES = {
    "USD": "US",
    "EUR": "EZ",
    "GBP": "GB",
    "JPY": "JP",
    "CHF": "CH",
    "CAD": "CA",
    "AUD": "AU",
    "NZD": "NZ",
    "NOK": "NO",
    "SEK": "SE",
}

_RATES = [
    Series(f"rate.{ccy}", "fred", f"IR3TIB01{cc}M156N", f"{ccy} 3-month interbank rate (OECD)",
           frequency="M")
    for ccy, cc in _RATE_CODES.items()
]

_OTHER = [
    Series("cmd.WTI", "fred", "DCOILWTICO", "WTI crude oil, USD per barrel"),
    Series("cmd.BRENT", "fred", "DCOILBRENTEU", "Brent crude oil, USD per barrel"),
    Series("cmd.HH_GAS", "fred", "DHHNGSP", "Henry Hub natural gas, USD per MMBtu"),
    Series("cmd.COPPER", "fred", "PCOPPUSDM", "Copper, USD per metric ton (IMF, monthly "
           "average, used from a week after the month ends)", frequency="M", published_after=5),
    Series("eq.US_MKT", "french", "F-F_Research_Data_Factors_daily",
           "US stock market total return index (Fama and French, all US stocks, dividends "
           "included), 1926 on, updated monthly with a lag of about two months"),
    Series("eq.SPX", "fred", "SP500", "S&P 500 price index, last 10 years only, no dividends"),
    Series("eq.US_TOTAL", "derived", "eq.US_MKT+eq.SPX",
           "Benchmark: Fama and French US market total return, extended to the latest day "
           "with S&P 500 price returns plus the recent dividend yield. See DEC-0008."),
    Series("eq.SPY", "yahoo", "SPY", "SPY ETF, adjusted close; cross-check only, not used in "
           "results (Yahoo's terms do not allow automated collection)", required=False),
    Series("risk.VIX", "fred", "VIXCLS", "CBOE VIX close"),
    Series("bond.UST10Y", "fred", "DGS10", "US 10-year Treasury yield, percent"),
    Series("rate.TBILL3M", "fred", "DTB3", "US 3-month Treasury bill rate, percent"),
]

_REER = [
    Series(f"reer.{ccy}", "fred", f"RB{cc}BIS", f"{ccy} real broad effective exchange rate (BIS), "
           "monthly, released with a lag of about six weeks", frequency="M")
    for ccy, cc in {"USD": "US", "EUR": "XM", "JPY": "JP", "GBP": "GB", "CHF": "CH",
                    "CAD": "CA", "AUD": "AU", "NZD": "NZ", "NOK": "NO", "SEK": "SE"}.items()
]

# More currencies from the Fed's H.10 release, for strategies that need a wider
# universe. The backtester books carry on those with a rate series below (EM_RATED); SGD,
# HKD, DKK and TWD have none, so they earn no carry.
# Optional: an official run does not fail if one is missing.
EM = ["MXN", "BRL", "KRW", "INR", "ZAR", "SGD", "CNY", "HKD", "DKK", "THB", "TWD", "MYR"]
_EM_CODES = {"MXN": "DEXMXUS", "BRL": "DEXBZUS", "KRW": "DEXKOUS", "INR": "DEXINUS",
             "ZAR": "DEXSFUS", "SGD": "DEXSIUS", "CNY": "DEXCHUS", "HKD": "DEXHKUS",
             "DKK": "DEXDNUS", "THB": "DEXTHUS", "TWD": "DEXTAUS", "MYR": "DEXMAUS"}
_FX_WIDE = [Series(f"fx.{c}", "fred", code, f"{c} per USD (Fed H.10), inverted", invert=True,
                   required=False) for c, code in _EM_CODES.items()]

_YIELDS = [
    Series("bond.UST2Y", "fred", "DGS2", "US 2-year Treasury yield, percent", required=False),
    Series("bond.UST30Y", "fred", "DGS30", "US 30-year Treasury yield, percent (gap 2002-2006)",
           required=False),
]

# Kenneth French's data library, free for research use. Each factor is a long-short,
# zero-cost portfolio turned into an index from its daily returns; each industry is a
# value-weighted total return index. The code is "<file>#<column>".
FACTORS = {"SMB": "F-F_Research_Data_Factors_daily", "HML": "F-F_Research_Data_Factors_daily",
           "MOM": "F-F_Momentum_Factor_daily", "RMW": "F-F_Research_Data_5_Factors_2x3_daily",
           "CMA": "F-F_Research_Data_5_Factors_2x3_daily", "STREV": "F-F_ST_Reversal_Factor_daily",
           "LTREV": "F-F_LT_Reversal_Factor_daily"}
_FACTOR_COLS = {"SMB": "SMB", "HML": "HML", "MOM": "Mom", "RMW": "RMW", "CMA": "CMA",
                "STREV": "ST_Rev", "LTREV": "LT_Rev"}
_FACTOR_NAMES = {"SMB": "small minus big (size)", "HML": "high minus low book to market (value)",
                 "MOM": "winners minus losers (momentum)", "RMW": "robust minus weak profitability",
                 "CMA": "conservative minus aggressive investment",
                 "STREV": "short-term reversal", "LTREV": "long-term reversal"}
_FACTORS = [Series(f"factor.{k}", "french", f"{FACTORS[k]}#{_FACTOR_COLS[k]}",
                   f"US {_FACTOR_NAMES[k]} factor, daily long-short return index (French)",
                   required=False) for k in FACTORS]

INDUSTRIES = ["NoDur", "Durbl", "Manuf", "Enrgy", "Chems", "BusEq", "Telcm", "Utils", "Shops",
              "Hlth", "Money", "Other"]
_INDUSTRIES = [Series(f"ind.{k}", "french", f"12_Industry_Portfolios_daily#{k}",
                      f"US {k} industry, value-weighted total return index (French 12 industries)",
                      required=False) for k in INDUSTRIES]

# Treasury total return indexes rebuilt from constant-maturity yields: each day earns
# the yield plus duration times the yield change. A standard approximation, good to a
# few tenths of a percent a year; real bond funds differ.
_BOND_TR = [
    Series("bond.TR10", "derived", "bond.UST10Y", "US 10-year Treasury total return index, "
           "approximated from the yield with a modified duration of 8", required=False),
    Series("bond.TR2", "derived", "bond.UST2Y", "US 2-year Treasury total return index, "
           "approximated from the yield with a modified duration of 1.9", required=False),
]
BOND_DURATION = {"bond.TR10": 8.0, "bond.TR2": 1.9}

# ---------------------------------------------------------------------------------------
# Wider official data (REF-0015). Free, no key unless noted, and licensed for reuse with
# the source named. Every one is optional, so an official run never fails on them, and
# nothing here feeds an existing strategy.

# ECB euro reference rates, published about 16:00 CET each TARGET working day. The ECB
# allows reuse with the source named. Quoted as units of the currency per euro.
ECB_CCYS = ["USD", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK", "DKK", "CZK",
            "HUF", "PLN", "RON", "ISK", "TRY", "BRL", "CNY", "HKD", "IDR", "ILS", "INR",
            "KRW", "MXN", "MYR", "PHP", "SGD", "THB", "ZAR"]
_ECB_FX = [Series(f"ecb.{c}", "ecb", f"EXR/D.{c}.EUR.SP00.A",
                  f"{c} per EUR, ECB euro reference rate", required=False,
                  site=c in ("USD", "JPY", "GBP", "CHF"))
           for c in ECB_CCYS]

# Euro area AAA government bond yield curve (ECB, spot rates, business days, 2004 on).
_EA_TENORS = ["3M", "1Y", "2Y", "5Y", "10Y", "30Y"]
# The ECB publishes each day's curve at noon the next TARGET day, so it is used a
# business day late (DEC-0027).
_EA_CURVE = [Series(f"curve.EA_AAA_{t}", "ecb", f"YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_{t}",
                    f"Euro area AAA government {t} spot yield, percent (ECB, published "
                    "the next day)", required=False, site=t in ("2Y", "10Y"), lag_days=1)
             for t in _EA_TENORS]
_ECB_MONEY = [
    Series("money.ESTR", "ecb", "EST/B.EU000A2X2A25.WT", "Euro short-term rate (euro "
           "overnight rate), percent, published the next morning (ECB)", required=False,
           lag_days=1),
]

# US Treasury daily par yield curve, all tenors, 1990 on (fewer tenors early on). US
# government work, public domain. The code is the column name in Treasury's CSV.
UST_TENORS = {"1M": "1 Mo", "2M": "2 Mo", "3M": "3 Mo", "4M": "4 Mo", "6M": "6 Mo",
              "1Y": "1 Yr", "2Y": "2 Yr", "3Y": "3 Yr", "5Y": "5 Yr", "7Y": "7 Yr",
              "10Y": "10 Yr", "20Y": "20 Yr", "30Y": "30 Yr"}
_UST_CURVE = [Series(f"curve.UST_{t}", "treasury", col,
                     f"US Treasury {t} par yield, percent (Treasury daily par yield curve)",
                     required=False, site=t in ("3M", "2Y", "10Y", "30Y"))
              for t, col in UST_TENORS.items()]

# Central bank policy rates from the BIS, daily, as far back as each bank's history goes.
# BIS terms: reuse allowed with the BIS named, not misleading, no endorsement implied.
POLICY_AREAS = {"USD": "US", "EUR": "XM", "GBP": "GB", "JPY": "JP", "CHF": "CH",
                "CAD": "CA", "AUD": "AU", "NZD": "NZ", "NOK": "NO", "SEK": "SE",
                "DKK": "DK", "CZK": "CZ", "HUF": "HU", "PLN": "PL", "RON": "RO",
                "ISK": "IS", "TRY": "TR", "ILS": "IL", "ZAR": "ZA", "MXN": "MX",
                "BRL": "BR", "CLP": "CL", "COP": "CO", "PEN": "PE", "CNY": "CN",
                "HKD": "HK", "INR": "IN", "IDR": "ID", "KRW": "KR", "MYR": "MY",
                "THB": "TH", "SAR": "SA"}
_POLICY = [Series(f"policy.{c}", "bis", f"WS_CBPOL/D.{area}",
                  f"{c} central bank policy rate, percent (BIS)", required=False,
                  site=c in G10 or c == "USD")
           for c, area in POLICY_AREAS.items()]

# CFTC Commitments of Traders, legacy futures-only report. Positions are as of Tuesday
# and released on Friday, so values move 3 business days forward in the panel. US
# government work, public domain. The code is the CFTC contract market code; "#pct"
# gives the net position as a percent of open interest instead of contracts.
COT_CONTRACTS = {
    "EUR": ("099741", "Euro FX (CME; the ECU before 1999)"),
    "JPY": ("097741", "Japanese yen (CME)"), "GBP": ("096742", "British pound (CME)"),
    "CHF": ("092741", "Swiss franc (CME)"), "CAD": ("090741", "Canadian dollar (CME)"),
    "AUD": ("232741", "Australian dollar (CME)"), "NZD": ("112741", "New Zealand dollar (CME)"),
    "MXN": ("095741", "Mexican peso (CME)"), "BRL": ("102741", "Brazilian real (CME)"),
    "ZAR": ("122741", "South African rand (CME)"),
    "USD_INDEX": ("098662", "US dollar index (ICE Futures US)"),
    "GOLD": ("088691", "Gold (COMEX)"), "SILVER": ("084691", "Silver (COMEX)"),
    "COPPER": ("085692", "Copper (COMEX)"), "PLATINUM": ("076651", "Platinum (NYMEX)"),
    "WTI": ("067651", "WTI crude oil (NYMEX)"), "NATGAS": ("023651", "Natural gas (NYMEX)"),
    "CORN": ("002602", "Corn (CBOT)"), "WHEAT": ("001602", "Wheat (CBOT)"),
    "SOYBEANS": ("005602", "Soybeans (CBOT)"),
    "SPX_EMINI": ("13874A", "E-mini S&P 500 (CME)"),
    "UST10Y": ("043602", "10-year Treasury note (CBOT)"),
    "UST_BOND": ("020601", "Treasury bond (CBOT)"),
}
_COT_SHOWN = {"EUR", "JPY", "GBP", "GOLD", "WTI"}
_COT = [s for name, (code, what) in COT_CONTRACTS.items() for s in (
    Series(f"cot.{name}", "cftc", code, f"{what}: speculators' (non-commercial) net "
           "position, contracts (CFTC COT, weekly)", frequency="W", required=False,
           lag_days=3, site=False),
    Series(f"cot.{name}_PCT", "cftc", f"{code}#pct", f"{what}: speculators' net position, "
           "percent of open interest (CFTC COT, weekly)", frequency="W", required=False,
           lag_days=3, site=name in _COT_SHOWN),
)]

# EIA weekly petroleum and gas stocks. Needs a free key in EIA_API_KEY; without it these
# are skipped. Weekly petroleum data cover the week to Friday and come out the next
# Wednesday (3 business days); gas storage comes out on Thursday (4). Public domain.
_EIA = [
    Series("eia.CRUDE_STOCKS", "eia", "PET.WCESTUS1.W", "US commercial crude oil stocks "
           "excluding the SPR, thousand barrels (EIA weekly)", frequency="W",
           required=False, lag_days=3),
    Series("eia.CUSHING", "eia", "PET.W_EPC0_SAX_YCUOK_MBBL.W", "Crude oil stocks at "
           "Cushing, Oklahoma, thousand barrels (EIA weekly)", frequency="W",
           required=False, lag_days=3, site=False),
    Series("eia.GASOLINE_STOCKS", "eia", "PET.WGTSTUS1.W", "US total motor gasoline "
           "stocks, thousand barrels (EIA weekly)", frequency="W", required=False,
           lag_days=3, site=False),
    Series("eia.DISTILLATE_STOCKS", "eia", "PET.WDISTUS1.W", "US distillate fuel oil "
           "stocks, thousand barrels (EIA weekly)", frequency="W", required=False,
           lag_days=3, site=False),
    Series("eia.SPR", "eia", "PET.WCSSTUS1.W", "US Strategic Petroleum Reserve stocks, "
           "thousand barrels (EIA weekly)", frequency="W", required=False, lag_days=3,
           site=False),
    Series("eia.REFINERY_UTIL", "eia", "PET.WPULEUS3.W", "US refinery utilisation, percent "
           "of operable capacity (EIA weekly)", frequency="W", required=False, lag_days=3,
           site=False),
    Series("eia.CRUDE_OUTPUT", "eia", "PET.WCRFPUS2.W", "US field production of crude oil, "
           "thousand barrels a day (EIA weekly)", frequency="W", required=False,
           lag_days=3, site=False),
    Series("eia.GAS_STORAGE", "eia", "NG.NW2_EPG0_SWO_R48_BCF.W", "US lower 48 working gas "
           "in storage, billion cubic feet (EIA weekly)", frequency="W", required=False,
           lag_days=4),
]

# More FRED series. FRED tags each series "public domain" or "citation required"; every
# one here has one of those tags and no third-party copyright note. Series tagged
# "pre-approval required", or whose note forbids redistribution (the ICE BofA credit
# spreads, Moody's bond yields), are left out, and so are EIA spot prices for refined
# products, which EIA sources from Refinitiv (REF-0015). The IMF commodity prices need
# IMF permission for commercial reuse, so they stay off the site.
_FRED_MORE = [
    Series("spread.UST_2S10S", "fred", "T10Y2Y", "US 10-year minus 2-year Treasury yield, "
           "percentage points", required=False),
    Series("spread.UST_3M10Y", "fred", "T10Y3M", "US 10-year minus 3-month Treasury yield, "
           "percentage points", required=False, site=False),
    Series("infl.BE5Y", "fred", "T5YIE", "US 5-year breakeven inflation, percent (Treasury "
           "minus TIPS yield)", required=False),
    Series("infl.BE10Y", "fred", "T10YIE", "US 10-year breakeven inflation, percent",
           required=False),
    Series("infl.FWD5Y5Y", "fred", "T5YIFR", "US 5-year, 5-year forward inflation "
           "expectation, percent", required=False, site=False),
    Series("bond.TIPS5Y", "fred", "DFII5", "US 5-year TIPS real yield, percent",
           required=False, site=False),
    Series("bond.TIPS10Y", "fred", "DFII10", "US 10-year TIPS real yield, percent",
           required=False),
    Series("usd.BROAD", "fred", "DTWEXBGS", "Nominal broad US dollar index (Federal "
           "Reserve), 2006 on", required=False),
    Series("usd.AFE", "fred", "DTWEXAFEGS", "Nominal US dollar index against advanced "
           "foreign economies (Federal Reserve)", required=False, site=False),
    Series("usd.EME", "fred", "DTWEXEMEGS", "Nominal US dollar index against emerging "
           "market economies (Federal Reserve)", required=False, site=False),
    Series("money.EFFR", "fred", "DFF", "Effective federal funds rate, percent (Federal "
           "Reserve, every calendar day)", required=False),
    Series("money.CP3M_FIN", "fred", "DCPF3M", "3-month AA financial commercial paper "
           "rate, percent (Federal Reserve)", required=False, site=False),
    Series("money.CP3M_NONFIN", "fred", "DCPN3M", "3-month AA nonfinancial commercial "
           "paper rate, percent (Federal Reserve)", required=False, site=False),
    Series("credit.HQM10Y", "fred", "HQMCB10YR", "10-year high quality corporate bond "
           "yield, percent (Treasury HQM curve, monthly average, used a month late)",
           frequency="M", required=False, published_after=22),
    Series("risk.NFCI", "fred", "NFCI", "Chicago Fed National Financial Conditions Index, "
           "weekly to Friday, released the next Wednesday", frequency="W", required=False,
           lag_days=3),
    Series("risk.STLFSI", "fred", "STLFSI4", "St. Louis Fed Financial Stress Index, weekly "
           "to Friday, released the next Thursday", frequency="W", required=False,
           lag_days=4, site=False),
    Series("macro.CLAIMS", "fred", "ICSA", "US initial jobless claims, weekly to "
           "Saturday, released the next Thursday (Labor Department)", frequency="W",
           required=False, lag_days=4),
    Series("macro.WEI", "fred", "WEI", "New York Fed Weekly Economic Index, week to "
           "Saturday, released the next Thursday", frequency="W", required=False,
           lag_days=4, site=False),
] + [
    Series(f"cmd.{name}", "fred", code, f"{what} (IMF, monthly average, used from a week "
           "after the month ends)", frequency="M", required=False, published_after=5,
           site=False)
    for name, code, what in [
        ("ALUMINIUM", "PALUMUSDM", "Aluminium, USD per metric ton"),
        ("NICKEL", "PNICKUSDM", "Nickel, USD per metric ton"),
        ("IRON_ORE", "PIORECRUSDM", "Iron ore, USD per dry metric ton"),
        ("WHEAT", "PWHEAMTUSDM", "Wheat, USD per metric ton"),
        ("CORN", "PMAIZMTUSDM", "Maize (corn), USD per metric ton"),
        ("SOYBEANS", "PSOYBUSDM", "Soybeans, USD per metric ton"),
    ]
]

# Currencies crossed to the dollar from ECB reference rates (USD per EUR divided by
# currency per EUR), for strategies on the wider set (DEC-0027). Only those with a BIS
# policy rate, so the backtester can book their carry. Built locally, no download.
XFX = ["EUR"] + [c for c in ECB_CCYS if c != "USD" and c in POLICY_AREAS]
_XFX = [Series(f"xfx.{c}", "derived", "ecb.USD" if c == "EUR" else f"ecb.USD/ecb.{c}",
               f"USD per {c}, crossed from ECB euro reference rates (about 16:00 CET)",
               required=False, site=False) for c in XFX]

# A 5-year Treasury total return index from the daily par curve, for curve trades.
_BOND_TR5 = [Series("bond.TR5", "derived", "curve.UST_5Y", "US 5-year Treasury total "
                    "return index, approximated from the par yield with a modified duration "
                    "of 4.5", required=False, site=False)]
BOND_DURATION["bond.TR5"] = 4.5

_WIDER = (_ECB_FX + _EA_CURVE + _ECB_MONEY + _UST_CURVE + _POLICY + _COT + _EIA
          + _FRED_MORE + _XFX + _BOND_TR5)

# Emerging market currencies that also have an interest rate series below, so carry can
# be booked on them (em_fx strategies). Prices come from the Fed H.10 series above where
# the factory already loads them, and from the ECB euro reference rate for the rest.
# RUB stops on 1 March 2022.
EM_RATED = ["BRL", "CNY", "CZK", "HUF", "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "PHP",
            "PLN", "RON", "RUB", "THB", "TRY", "ZAR"]

_EM_FX = [Series(f"fx.{ccy}", "ecb_usd", ccy, f"USD per {ccy}, through the ECB euro reference rate",
                 required=False) for ccy in EM_RATED if ccy not in EM]

# 3-month interbank rates from the OECD where it has a full history, central bank policy
# rates from the BIS otherwise. Policy rates are not what a forward pays, most of all under
# capital controls (BRL, INR, TRY at times); see docs/research/0012-emerging-market-currencies.md.
_EM_RATE_OECD = {"CNY": "CHN", "CZK": "CZE", "HUF": "HUN", "ILS": "ISR", "KRW": "KOR",
                 "MXN": "MEX", "PLN": "POL", "RON": "ROU", "RUB": "RUS", "ZAR": "ZAF"}
_EM_RATE_BIS = {"BRL": "BR", "IDR": "ID", "INR": "IN", "MYR": "MY", "PHP": "PH", "THB": "TH",
                "TRY": "TR"}

_EM_RATES = [
    Series(f"rate.{ccy}", "oecd", cc, f"{ccy} 3-month interbank rate (OECD), dated at month end",
           frequency="M", required=False) for ccy, cc in _EM_RATE_OECD.items()
] + [
    # Step series: a policy rate holds until the next decision, so forward fill it like a
    # monthly series rather than letting it go stale after five days.
    # The same BIS series as policy.<CCY> above, fetched once.
    Series(f"rate.{ccy}", "bis", f"WS_CBPOL/D.{cc}", f"{ccy} central bank policy rate (BIS)",
           frequency="M", required=False) for ccy, cc in _EM_RATE_BIS.items()
]

# NYMEX energy futures as published by the EIA, contracts 1 to 3, to 5 April 2024 only.
# fut.<X> is the excess return index of holding contract 2 and rolling when it becomes the
# front contract (data/futures.py); carry.<X> is 12 * ln(C2 / C3), positive in backwardation.
ENERGY = {"CL": ("pet", "RCLC{n}", "WTI crude oil, USD per barrel"),
          "HO": ("pet", "EER_EPD2F_PE{n}_Y35NY_DPG", "No. 2 heating oil, USD per gallon"),
          "RB": ("pet", "EER_EPMRR_PE{n}_Y35NY_DPG", "RBOB gasoline, USD per gallon"),
          "NG": ("ng", "RNGC{n}", "Henry Hub natural gas, USD per MMBtu")}

_CURVES = [
    Series(f"curve.{sym}{n}", "eia_web", f"{folder}/{pattern.format(n=n)}",
           f"{desc}, NYMEX contract {n} (EIA, ends 5 April 2024)", required=False)
    for sym, (folder, pattern, desc) in ENERGY.items() for n in (1, 2, 3)
]
_FUTURES = [
    Series(f"fut.{sym}", "derived", f"curve.{sym}1+curve.{sym}2",
           f"{desc}: excess return index of holding contract 2, rolled when it becomes the "
           "front contract", required=False) for sym, (_, _, desc) in ENERGY.items()
] + [
    Series(f"carry.{sym}", "derived", f"curve.{sym}2+curve.{sym}3",
           f"{desc}: annualised slope 12 * ln(C2 / C3), positive in backwardation",
           required=False) for sym, (_, _, desc) in ENERGY.items()
]

_VOL = [
    Series("risk.OVX", "fred", "OVXCLS", "CBOE crude oil volatility index (options on USO), "
           "May 2007 on", required=False),
    Series("vrp.OIL", "derived", "risk.OVX+fut.CL",
           "Excess return index of selling a 30-day crude oil variance swap each month, struck "
           "at OVX squared and marked daily (data/futures.py)", required=False),
]

CATALOG: dict[str, Series] = {
    s.key: s for s in _FX + _RATES + _OTHER + _REER + _FX_WIDE + _YIELDS + _FACTORS
    + _INDUSTRIES + _BOND_TR + _WIDER + _EM_FX + _EM_RATES + _CURVES + _FUTURES + _VOL
}


def get(key: str) -> Series:
    try:
        return CATALOG[key]
    except KeyError as exc:
        raise KeyError(f"Unknown series '{key}'. Add it to parity/data/catalog.py.") from exc
