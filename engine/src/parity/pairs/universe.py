"""The pairs universe (DEC-0070): linked pairs we name by hand, and groups the search may
pair up by itself.

Two kinds of asset:

- `ind49.*` French's 49 US industries, daily since 1926, public licence. Industry pairs
  (soft drinks against beer, banks against insurers) can be tested back to 1970 and shown
  in full.
- `stk.*` single US stocks and ETFs, daily bars from Alpaca since 2016. Alpaca's terms
  allow the account holder's own use only, so these are research-only: we publish derived
  statistics (z-scores, hedge ratios, p-values, returns), never the prices. They need the
  team's Alpaca key; without it they are skipped.

Survivorship: both stock lists below are today's names. A company that died or was
bought before today is missing, which flatters any test on them. Discovery inside a
group only ever uses data up to each formation date, but the group itself was chosen
today. The industry portfolios have no such gap: French rebuilds them each year from
every listed firm.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Pair:
    a: str
    b: str
    group: str
    why: str
    caveat: str = ""

    @property
    def id(self) -> str:
        return f"{self.a}~{self.b}"


def _i(k: str) -> str:
    return f"ind49.{k}"


# --- industries: public, long history ---------------------------------------------

INDUSTRY_GROUPS: dict[str, list[str]] = {
    "Consumer staples": ["Agric", "Food", "Soda", "Beer", "Smoke", "Hshld"],
    "Consumer goods and services": ["Toys", "Fun", "Books", "Clths", "Txtls", "Autos", "Rtail",
                                    "Meals", "PerSv"],
    "Health": ["Hlth", "MedEq", "Drugs"],
    "Energy and materials": ["Oil", "Coal", "Mines", "Gold", "Steel", "Chems", "Rubbr", "Paper",
                             "Boxes", "BldMt"],
    "Industrials": ["Cnstr", "FabPr", "Mach", "ElcEq", "Aero", "Ships", "Guns", "Trans",
                    "Whlsl", "BusSv", "LabEq"],
    "Technology and telecoms": ["Hardw", "Softw", "Chips", "Telcm"],
    "Finance": ["Banks", "Insur", "RlEst", "Fin"],
    "Utilities": ["Util"],
}

INDUSTRY_PAIRS: list[Pair] = [
    Pair(_i("Soda"), _i("Beer"), "Consumer staples",
         "Both sell drinks through the same shops; tastes and taxes move them apart."),
    Pair(_i("Food"), _i("Soda"), "Consumer staples", "Packaged food and drink share buyers "
         "and input costs."),
    Pair(_i("Food"), _i("Hshld"), "Consumer staples", "Supermarket staples, steady demand."),
    Pair(_i("Smoke"), _i("Beer"), "Consumer staples", "Taxed habits that hold up in "
         "recessions.", "Tobacco lawsuits in the 1990s moved one alone."),
    Pair(_i("Banks"), _i("Insur"), "Finance", "Both live on interest rates and credit."),
    Pair(_i("Banks"), _i("Fin"), "Finance", "Lenders and brokers share the credit cycle.",
         "2008 hit them at different speeds."),
    Pair(_i("Oil"), _i("Coal"), "Energy and materials", "Fuels priced off the same energy "
         "demand.", "Coal's long decline is a break, not noise."),
    Pair(_i("Gold"), _i("Mines"), "Energy and materials", "Miners of metal."),
    Pair(_i("Steel"), _i("Mines"), "Energy and materials", "Steel buys what miners dig."),
    Pair(_i("Chems"), _i("Rubbr"), "Energy and materials", "Plastics are chemicals."),
    Pair(_i("Paper"), _i("Boxes"), "Energy and materials", "Packaging is paper."),
    Pair(_i("BldMt"), _i("Cnstr"), "Industrials", "Builders buy building materials."),
    Pair(_i("Mach"), _i("ElcEq"), "Industrials", "Capital goods ordered in the same cycle."),
    Pair(_i("Aero"), _i("Guns"), "Industrials", "Defense budgets pay for both."),
    Pair(_i("Steel"), _i("FabPr"), "Industrials", "Fabricators shape steel."),
    Pair(_i("Hardw"), _i("Chips"), "Technology and telecoms", "Computers are built from "
         "chips.", "The 2000 bubble moved both, but not together."),
    Pair(_i("Softw"), _i("BusSv"), "Technology and telecoms", "Software is sold to "
         "businesses."),
    Pair(_i("Drugs"), _i("MedEq"), "Health", "Both are paid by the same health systems."),
    Pair(_i("Drugs"), _i("Hlth"), "Health", "Medicines and care."),
    Pair(_i("Rtail"), _i("Meals"), "Consumer goods and services", "Spending at shops and "
         "restaurants."),
    Pair(_i("Rtail"), _i("Whlsl"), "Consumer goods and services", "Wholesalers sell to "
         "retailers."),
    Pair(_i("Autos"), _i("Rubbr"), "Consumer goods and services", "Tyres go on cars."),
    Pair(_i("Clths"), _i("Txtls"), "Consumer goods and services", "Clothes are made of "
         "cloth.", "US textile making shrank for decades."),
    Pair(_i("Toys"), _i("Fun"), "Consumer goods and services", "Leisure spending."),
    Pair(_i("Util"), _i("Telcm"), "Utilities", "Regulated networks that trade like bonds."),
]

#: Every industry pair inside the same group: the candidates discovery may choose from.
def industry_candidates() -> list[Pair]:
    out = []
    for group, names in INDUSTRY_GROUPS.items():
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                out.append(Pair(_i(a), _i(b), group, "same group"))
    return out


# --- single stocks and ETFs: research only ----------------------------------------

def _s(t: str) -> str:
    return f"stk.{t}"


STOCK_PAIRS: list[Pair] = [
    Pair(_s("KO"), _s("PEP"), "Consumer staples", "The cola rivals: same shelves, same "
         "buyers, same sugar and aluminium costs.", "PepsiCo also sells snacks."),
    Pair(_s("XOM"), _s("CVX"), "Energy", "The two biggest US oil companies, both priced off "
         "crude."),
    Pair(_s("V"), _s("MA"), "Financials", "The two card networks, near copies of each other."),
    Pair(_s("HD"), _s("LOW"), "Consumer discretionary", "The two home improvement chains."),
    Pair(_s("MCD"), _s("YUM"), "Consumer discretionary", "Fast food franchisors.",
         "Yum spun off its China arm in 2016."),
    Pair(_s("UPS"), _s("FDX"), "Industrials", "Parcel carriers.", "FedEx is more exposed to "
         "air freight and trade."),
    Pair(_s("GM"), _s("F"), "Consumer discretionary", "Detroit car makers.", "Today's GM "
         "listed in 2010 after bankruptcy, a clean break."),
    Pair(_s("JPM"), _s("BAC"), "Financials", "The two largest US banks."),
    Pair(_s("WMT"), _s("TGT"), "Consumer staples", "Big box discount stores."),
    Pair(_s("BHP"), _s("RIO"), "Materials", "The two largest miners, iron ore above all.",
         "BHP merged its two share lines in 2022."),
    Pair(_s("GLD"), _s("GDX"), "Materials", "Gold against gold miners.", "Miners carry "
         "costs and stock market risk that gold does not."),
    Pair(_s("GOOGL"), _s("GOOG"), "Communication", "Two share classes of one company, voting "
         "and non-voting.", "So close that costs decide everything."),
    Pair(_s("BRK.A"), _s("BRK.B"), "Financials", "Two share classes, one A converts into "
         "1,500 B.", "Any gap is tiny and closes by conversion."),
    # A sector fund against its biggest holdings.
    Pair(_s("XLE"), _s("XOM"), "Energy", "Energy fund against its largest holding."),
    Pair(_s("XLE"), _s("CVX"), "Energy", "Energy fund against its second holding."),
    Pair(_s("XLF"), _s("JPM"), "Financials", "Financials fund against its largest bank."),
    Pair(_s("XLF"), _s("BAC"), "Financials", "Financials fund against a large bank."),
    Pair(_s("XLP"), _s("KO"), "Consumer staples", "Staples fund against Coca-Cola."),
    Pair(_s("XLP"), _s("PEP"), "Consumer staples", "Staples fund against PepsiCo."),
    Pair(_s("XLK"), _s("AAPL"), "Technology", "Tech fund against Apple."),
    Pair(_s("XLK"), _s("MSFT"), "Technology", "Tech fund against Microsoft."),
    Pair(_s("XLY"), _s("HD"), "Consumer discretionary", "Discretionary fund against Home "
         "Depot."),
    Pair(_s("XLV"), _s("JNJ"), "Health care", "Health care fund against Johnson and "
         "Johnson."),
    Pair(_s("XLU"), _s("NEE"), "Utilities", "Utilities fund against NextEra."),
]

#: Today's large companies by sector, for discovery inside a sector. Today's names, so
#: survivorship applies (see the module notes).
STOCK_SECTORS: dict[str, list[str]] = {
    "Consumer staples": ["KO", "PEP", "PG", "CL", "KMB", "MDLZ", "GIS", "WMT", "TGT", "COST"],
    "Energy": ["XOM", "CVX", "COP", "EOG", "OXY", "SLB", "HAL"],
    "Financials": ["JPM", "BAC", "C", "WFC", "GS", "MS", "V", "MA", "AXP"],
    "Consumer discretionary": ["HD", "LOW", "MCD", "YUM", "SBUX", "GM", "F", "NKE"],
    "Industrials": ["UPS", "FDX", "CAT", "DE", "HON", "GE", "LMT", "NOC", "GD", "RTX"],
    "Materials": ["BHP", "RIO", "FCX", "NEM", "DOW", "LYB"],
    "Technology": ["AAPL", "MSFT", "INTC", "AMD", "TXN", "QCOM", "ORCL", "IBM"],
    "Health care": ["JNJ", "PFE", "MRK", "ABT", "UNH", "CVS", "LLY", "BMY"],
    "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC"],
}

ETFS = ["XLE", "XLF", "XLP", "XLK", "XLY", "XLV", "XLU", "XLI", "XLB", "GLD", "GDX"]


def stock_tickers() -> list[str]:
    names = {t for p in STOCK_PAIRS for t in (p.a[4:], p.b[4:])}
    names |= {t for v in STOCK_SECTORS.values() for t in v} | set(ETFS)
    return sorted(names)


def stock_candidates() -> list[Pair]:
    out = []
    for group, names in STOCK_SECTORS.items():
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                out.append(Pair(_s(a), _s(b), group, "same sector"))
    return out


def label(key: str) -> str:
    """A short plain name for an asset key."""
    from ..data.catalog import INDUSTRIES49

    kind, _, code = key.partition(".")
    if kind == "ind49":
        return INDUSTRIES49.get(code, code)
    return code
