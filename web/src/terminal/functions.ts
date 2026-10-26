// Every function the command bar knows: its code, a title and what it shows. A panel
// is one function with optional arguments (DES EUR, CMP EUR JPY).
export interface Fn { code: string; title: string; what: string; args?: string; sim?: boolean }

export const FUNCTIONS: Fn[] = [
  { code: "MON", title: "Market monitor", what: "Every series by group: last, changes, volatility, z-score, 1-year range", args: "[group]" },
  { code: "DES", title: "Series detail", what: "One series: chart, statistics, source and licence", args: "<series>" },
  { code: "CMP", title: "Compare", what: "Two series or strategies: rebased, spread and ratio, rolling correlation, beta, drawdowns", args: "<a> <b>" },
  { code: "HEAT", title: "Heat map", what: "Moves by group, coloured by how unusual they are" },
  { code: "MOV", title: "Top movers", what: "Biggest risers and fallers over a window" },
  { code: "LIVE", title: "Live prices", what: "Streamed prices with a live chart and how old each price is" },
  { code: "WMAP", title: "World map", what: "Currencies on the world map through time; click a country to link its currency", sim: true },
  { code: "CORR", title: "Correlations", what: "Which markets move together, through time", sim: true },
  { code: "SCEN", title: "Scenario", what: "What followed past events like the one you describe", sim: true },
  { code: "LIB", title: "Scenario library", what: "Every kind of past event and what markets did after it, with how many events each rests on", sim: true },
  { code: "PATH", title: "Paths", what: "Simulated ranges and risks from reshuffled history", sim: true },
  { code: "STRS", title: "Stress test", what: "A mix of assets through every past crisis", sim: true },
  { code: "CRIS", title: "Crises", what: "Replay a past crisis across every market", sim: true },
  { code: "RACE", title: "Strategy race", what: "Every strategy we test, replayed", sim: true },
  { code: "BOTS", title: "Bot battle", what: "Seven hypothetical trading bots on the same prices: win rate, profit and worst fall", sim: true },
  { code: "CRV", title: "Curves", what: "Treasury and euro yield curves now and a month and a year ago, plus the rates replay" },
  { code: "COT", title: "Positioning", what: "Net futures positioning (CFTC) by market" },
  { code: "ECO", title: "Macro", what: "Macro, rates, credit and inflation series" },
  { code: "NEWS", title: "Headlines", what: "Latest headlines and the market move that followed" },
  { code: "KPI", title: "Strategy KPIs", what: "Every strategy: Sharpe, growth, worst fall, luck check and test results" },
  { code: "HELP", title: "Help", what: "Every code and shortcut" },
  // Sim World tabs that are panels here too (old links open them).
  { code: "CMDY", title: "Commodities race", what: "Oil, gas and copper racing, with the producers", sim: true },
  { code: "EQTY", title: "Stocks race", what: "US industries and research factors racing", sim: true },
];

export const FN_BY_CODE: Record<string, Fn> = Object.fromEntries(FUNCTIONS.map((f) => [f.code, f]));

/** Old Sim World hashes (#/map, #/crises ...) and the panel each opens. */
export const LEGACY_TABS: Record<string, string> = {
  map: "WMAP", crises: "CRIS", scenario: "SCEN", paths: "PATH", stress: "STRS", race: "RACE",
  rates: "CRV", connections: "CORR", commodities: "CMDY", stocks: "EQTY", bots: "BOTS",
};

export const HONEST = "Past data. Not a forecast";
