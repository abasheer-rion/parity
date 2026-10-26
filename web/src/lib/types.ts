// Shape of the report written by engine/src/parity/report.py (schema_version 1).
// Keep in step with that file.

export type Point = [string, number];

export interface Metrics {
  start: string | null;
  end: string | null;
  years: number;
  cagr: number | null;
  ann_vol: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown: number | null;
  calmar: number | null;
  hit_rate: number | null;
  deflated_sharpe: number | null;
  turnover_per_year?: number | null;
  breakeven_cost_bps?: number | null;
  excess_cagr?: number | null;
  information_ratio?: number | null;
  beta?: number | null;
  correlation?: number | null;
  benchmark_cagr?: number | null;
  benchmark_sharpe?: number | null;
}

export interface IcRow {
  horizon_days: number;
  mean_ic: number | null;
  ic_tstat: number | null;
  observations: number;
}

export interface StrategyTags {
  family: string;
  asset: string;
  style: string;
  horizon: string;
}

export interface StrategyRun {
  strategy: string;
  /** Human name, description and tags, written by the engine from schema 1 onward; older runs fall back to lib/strategyMeta.ts. */
  display_name?: string;
  description?: string;
  tags?: StrategyTags;
  summary: string;
  reference: string;
  is_benchmark: boolean;
  params: Record<string, unknown>;
  config: Record<string, unknown>;
  metrics: Metrics;
  yearly: Record<string, number>;
  equity: Point[];
  drawdown: Point[];
  ic_decay: IcRow[];
  exposure: Record<string, number>;
  gauntlet: Gauntlet | null;
  /** "How it holds up" numbers (engine/src/parity/metrics/holdup.py). Older runs leave it out; lib/holdup.ts rebuilds it from returns. */
  holdup?: Holdup | null;
}

export interface CoverageRow {
  key: string;
  source: string;
  code: string;
  ok: boolean;
  first?: string;
  last?: string;
  rows?: number;
  error?: string;
  frequency?: string; // "D", "W", "M" or "Q"; older runs leave it out
}

export interface Report {
  schema_version: number;
  generated_at: string;
  git_sha: string | null;
  n_trials: number;
  config: Record<string, unknown>;
  coverage: { fetched_at: string | null; series: CoverageRow[] };
  runs: StrategyRun[];
  kind?: string;
  run_id?: string | null;
  series?: Record<string, SeriesBlock>;
  comparison?: Comparison;
  source_checks?: SourceCheck[];
}

export interface BatchSummary {
  id: string;
  generated_at: string;
  git_sha: string | null;
}

export interface GauntletTest {
  id: string;
  group: "beat" | "real";
  name: string;
  plain: string;
  passed: boolean | null;
  value: string;
  bar: string;
}

export interface Gauntlet {
  verdict: string;
  beats_sp500: boolean;
  passed: number;
  total: number;
  tests: GauntletTest[];
  trials_including_gauntlet: number;
  bootstrap?: GauntletBootstrap;
  placebo?: GauntletPlacebo;
}

export interface GauntletBootstrap {
  sharpe_ci: [number, number];
  prob_sharpe_above_zero: number;
  prob_beats_benchmark: number;
}

export interface GauntletPlacebo {
  actual: number;
  p_value: number;
  null_median: number;
  null_p95: number;
}

// ---------------------------------------------------------------- how it holds up
// Same field names as engine/src/parity/metrics/holdup.py and web/src/lib/holdup.ts.

export type Range = [number | null, number | null];

export interface HoldupEstimate {
  point: number | null;
  median: number | null;
  ci95: Range | null;
  ci80: Range | null;
}

export interface HoldupRegimeItem {
  key: string;
  label: string;
  start?: string;
  end?: string;
  days: number;
  share: number | null;
  strategy_total: number | null;
  benchmark_total: number | null;
  strategy_ann: number | null;
  benchmark_ann: number | null;
  strategy_hit: number | null;
  benchmark_hit: number | null;
  /** Strategy beat the benchmark over these days; null without a benchmark. */
  wins: boolean | null;
}

export interface HoldupRegimeFamily {
  family: "rates" | "volatility" | "crises" | "decades";
  available: boolean;
  /** Why the family is missing: no_rate_series, no_benchmark, too_short, no_overlap. */
  reason: string | null;
  items: HoldupRegimeItem[];
  lookback_days?: number;
  window_days?: number;
  median_vol?: number | null;
  source?: string | null;
}

export interface HoldupDrawdown {
  start: string;
  trough: string;
  recovery: string | null;
  depth: number | null;
  days: number;
  days_to_trough: number;
}

export type HoldupMustKey =
  | "costs_below_breakeven"
  | "correlation_to_stocks_persists"
  | "correlation_to_bonds_persists"
  | "not_reliant_on_crises"
  | "not_one_lucky_year"
  | "enough_history"
  | "survives_trial_count";

export interface HoldupMust {
  key: HoldupMustKey;
  /** Whether it holds on the data so far; null when it is a condition to watch, not a test. */
  holds: boolean | null;
  values: Record<string, number | null>;
}

export interface HoldupSource {
  name: string | null;
  available: boolean;
  reason?: string;
  start?: string;
  end?: string;
  n?: number;
}

export interface Holdup {
  equity_vs_benchmark: { dates: string[]; strategy: (number | null)[]; benchmark: (number | null)[] | null };
  luck: {
    sharpe: number | null;
    n_trials: number;
    probability: number | null;
    probability_one_try: number | null;
    line: number;
    verdict: "unlikely_luck" | "borderline" | "could_be_luck" | "not_enough_data";
  };
  bootstrap: {
    n: number;
    block_days: number;
    seed: number;
    days: number;
    sharpe: HoldupEstimate;
    cagr: HoldupEstimate;
    prob_sharpe_above_zero: number | null;
    histogram: { edges: (number | null)[]; counts: number[] };
  } | null;
  p_values: {
    method: "psr_t";
    t_stat: number | null;
    raw: number | null;
    n_trials: number;
    bonferroni: number | null;
    sidak: number | null;
    holm: { name: string; raw: number | null; adjusted: number | null }[] | null;
    significant: { raw: boolean | null; bonferroni: boolean | null; sidak: boolean | null };
  };
  rolling_correlation: {
    window_days: number;
    dates: string[];
    series: { stocks?: (number | null)[]; bonds?: (number | null)[] };
    full_period: { stocks?: number | null; bonds?: number | null };
    latest: { stocks?: number | null; bonds?: number | null };
  } | null;
  regimes: HoldupRegimeFamily[];
  worst_periods: {
    drawdowns: HoldupDrawdown[];
    worst_year: { year: number; return: number | null; benchmark: number | null } | null;
    worst_12m: { start: string; end: string; return: number | null } | null;
  };
  must_be_true: HoldupMust[];
  sources: {
    strategy: HoldupSource;
    benchmark: HoldupSource;
    stocks: HoldupSource;
    bonds: HoldupSource;
    rates: HoldupSource;
    crises: { name: "given" | "built_in"; n: number };
  };
}

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  simple: string;
  analogy: string;
  precise: string;
  /** What can go wrong, for terms about products people spend money on. */
  risk?: string;
  related?: string[];
}

export interface ReportedResult {
  source: string;
  source_url: string;
  period: string;
  market: string;
  sharpe: number | null;
  annual_return: number | null;
  volatility: number | null;
  max_drawdown: number | null;
  evidence_type: string;
  costs_included: boolean | null;
  verified_on_page: boolean;
  notes?: string;
}

export interface Algorithm {
  id: string;
  slug: string;
  name: string;
  family: string;
  markets: string[];
  horizon: string;
  tags: string[];
  origin: { type: string; first_published: number | null; authors: string; source_title: string; source_url: string };
  how_it_works: { simple: string; analogy: string; precise: string };
  rule: string;
  data_needed: string[];
  economic_rationale: string;
  why_it_might_fail: string;
  reported_results: ReportedResult[];
  post_publication_evidence: string;
  implementations: { url: string; language?: string; license?: string; notes?: string }[];
  relevance: { score: number; reason: string };
  testable_with_free_data: boolean;
  last_reviewed: string;
  research: { stage: number; hypothesis: string | null; strategy: string | null; registrations: string[]; runs: string[]; verdict: string | null; notes: string };
}

export interface Dataset {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  url: string;
  api_docs_url: string | null;
  access: string;
  rate_limits: string;
  history_start: string;
  frequency: string[];
  what_it_has: string;
  simple: string;
  point_in_time: boolean | null;
  license_terms: string;
  quality_notes: string;
  in_use_by_parity: boolean;
  parity_keys: string[];
  relevance: { score: number; reason: string };
  sources: string[];
  verified: boolean;
  last_checked: string;
}

export interface LedgerEntry {
  seq: number;
  run_id: string;
  recorded_at: string;
  prev: string;
  hash: string;
  details_sha256: string;
  kind: string;
  registration: string;
  git_sha: string;
  data_snapshot: string;
  trials_counted: number;
  results: Record<string, {
    sharpe: number | null; cagr: number | null; max_drawdown: number | null; deflated_sharpe: number | null;
    gauntlet: string; tests: Record<string, boolean>; verdict: string; meets_registered_criteria: boolean | null;
  }>;
}

export interface Registration {
  id: string;
  title: string;
  created: string;
  hypotheses: string[];
  question: string;
  strategies: { name: string; params: Record<string, unknown> }[];
  pass_criteria: Record<string, unknown>;
  prior_trials: number;
  already_seen?: string;
}

export interface SeriesBlock {
  description: string;
  source: string;
  code: string;
  frequency: string;
  points: Point[];
}

export interface Comparison {
  names: string[];
  correlation: number[][];
  crises: { name: string; start: string; end: string; returns: Record<string, number> }[];
}

export interface SourceCheck { a: string; b: string; label: string; days: number; from: string; daily_correlation: number; annual_return_gap: number }
