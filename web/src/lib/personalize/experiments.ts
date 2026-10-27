// A/B tests and feature flags (DEC-0068). Assignment is by hashed user id, the same in the
// database (experiment_assign) and here:
//
//   bucket = first 8 hex characters of sha256("<key>:<user id>") as a whole number / 2^32
//
// and the first variant whose running share of the weights passes the bucket wins. The
// database is the authority (it also logs the exposure); bucket() here lets tests and the
// lead check that both sides agree. People with personalization off always get "control"
// and are never logged.
import { sha256 } from "@noble/hashes/sha2.js";
import { useEffect, useState } from "react";
import { assignExperiments, trackExperiment, type Metric } from "./api";
import { readSession, writeSession } from "./session";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** A number in [0, 1) fixed for one person and one experiment. */
export function bucket(key: string, userId: string): number {
  const h = hex(sha256(new TextEncoder().encode(`${key}:${userId}`)));
  return parseInt(h.slice(0, 8), 16) / 2 ** 32;
}

/** The variant a bucket falls in, given variants and their weights in order. */
export function pickVariant(variants: { key: string; weight: number }[], b: number): string {
  const total = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (!variants.length || total <= 0) return "control";
  let run = 0;
  for (const v of variants) {
    run += Math.max(0, v.weight) / total;
    if (b < run) return v.key;
  }
  return variants[variants.length - 1].key;
}

/** The experiments the app runs now, and their arms. The database holds the same list. */
export const EXPERIMENTS = {
  whats_new_order: ["control", "personal"],
  whats_new_hook: ["control", "hook"],
  widget_defaults: ["control", "collapse5"],
} as const;
export type ExperimentKey = keyof typeof EXPERIMENTS;

let pending: Promise<void> | null = null;

/** Fetches every experiment's variant once per session (one call), then answers from the session. */
async function ensureAssigned(): Promise<void> {
  const known = readSession().variants ?? {};
  const missing = (Object.keys(EXPERIMENTS) as ExperimentKey[]).filter((k) => !known[k]);
  if (!missing.length) return;
  if (!pending) {
    pending = assignExperiments(missing).then((rows) => {
      if (!rows.length) return; // signed out or offline: ask again next time
      const variants = { ...(readSession().variants ?? {}) };
      for (const r of rows) variants[r.key] = { variant: r.variant, exposed: r.exposed };
      writeSession({ variants });
    }).finally(() => { pending = null; });
  }
  await pending;
}

/** This person's variant for an experiment: "control" until known, or when not in it. */
export function useVariant(key: ExperimentKey): { variant: string; ready: boolean } {
  const cached = readSession().variants?.[key];
  const [v, setV] = useState<{ variant: string; ready: boolean }>(cached ? { variant: cached.variant, ready: true } : { variant: "control", ready: false });
  useEffect(() => {
    if (v.ready) return;
    let live = true;
    void ensureAssigned().then(() => {
      if (live) setV({ variant: readSession().variants?.[key]?.variant ?? "control", ready: true });
    });
    return () => { live = false; };
  }, [key, v.ready]);
  return v;
}

/** Records an outcome for every running experiment the person is in. Fails quietly. */
export function trackOutcome(metric: Metric): void {
  const variants = readSession().variants ?? {};
  if (!Object.values(variants).some((x) => x.exposed)) return; // in no experiment: nothing to record
  void trackExperiment(metric);
}
