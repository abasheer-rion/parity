// Where results come from. The site sits behind Cloudflare Access, so it no longer
// signs in to Supabase: the deploy job copies published runs into static files
// (scripts/export_site_data.py), and the browser reads those. In local development
// the engine's own output is served instead.
import { useEffect, useState } from "react";
import type { BatchSummary, Report } from "./types";

export type Source = "static" | "local";
export const source: Source = import.meta.env.DEV ? "local" : "static";

export interface BatchInfo extends BatchSummary { kind?: string; run_id?: string | null }

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status === 404 ? "No research runs have been published yet." : `Could not load ${url} (${res.status}).`);
  return (await res.json()) as T;
}

export async function listBatches(): Promise<BatchInfo[]> {
  if (source === "local") return [];
  return json<BatchInfo[]>("/data/batches.json");
}

export async function loadReport(batchId?: string): Promise<Report> {
  if (source === "local") return json<Report>("/local/latest.json");
  return json<Report>(batchId ? `/data/batch/${batchId}.json` : "/data/latest.json");
}

export async function listMembers(): Promise<{ email: string; added_at: string }[]> {
  if (source === "local") return [];
  return json("/data/members.json");
}

/** Who is signed in, from Cloudflare Access. Null in local development. */
export function useIdentity(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (source === "local") return;
    fetch("/cdn-cgi/access/get-identity", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmail(d?.email ?? null))
      .catch(() => setEmail(null));
  }, []);
  return email;
}

export function signOut() {
  window.location.href = "/cdn-cgi/access/logout";
}
