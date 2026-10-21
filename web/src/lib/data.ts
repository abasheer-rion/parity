import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { BatchSummary, Report, StrategyRun } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** Where results come from: Supabase when configured, the engine's output folder in dev. */
export type Source = "supabase" | "local" | "none";
export const source: Source = supabase ? "supabase" : import.meta.env.DEV ? "local" : "none";

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function sendSignInLink(email: string): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
  });
  return error ? error.message : null;
}

export async function listBatches(): Promise<BatchSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("research_batches")
    .select("id, generated_at, git_sha")
    .order("generated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadReport(batchId?: string): Promise<Report> {
  if (source === "local") {
    const res = await fetch("/local/latest.json");
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as Report;
  }
  if (!supabase) throw new Error("No data source is configured.");

  let query = supabase.from("research_batches").select("*");
  query = batchId ? query.eq("id", batchId) : query.order("generated_at", { ascending: false });
  const { data: batches, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  const batch = batches?.[0];
  if (!batch) throw new Error("No research runs have been published yet.");

  const { data: runs, error: runError } = await supabase
    .from("strategy_runs")
    .select("*")
    .eq("batch_id", batch.id);
  if (runError) throw new Error(runError.message);

  return {
    schema_version: batch.schema_version,
    generated_at: batch.generated_at,
    git_sha: batch.git_sha,
    n_trials: batch.n_trials,
    config: batch.config,
    coverage: batch.coverage,
    runs: (runs ?? []) as StrategyRun[],
  };
}
