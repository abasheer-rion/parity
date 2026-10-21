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

export interface StrategyRun {
  strategy: string;
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
}

export interface Report {
  schema_version: number;
  generated_at: string;
  git_sha: string | null;
  n_trials: number;
  config: Record<string, unknown>;
  coverage: { fetched_at: string | null; series: CoverageRow[] };
  runs: StrategyRun[];
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
}

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  simple: string;
  analogy: string;
  precise: string;
  related?: string[];
}
