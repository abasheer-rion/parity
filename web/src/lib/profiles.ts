// Competitor profiles (DEC-0047): the products we study come from
// docs/_system/competitors.json, bundled, so the page lists them even before the collector
// has run. The feedback counts come from the collector: dev reads /local/profiles.json
// (`parity profiles export`), builds read /data/profiles.json, which the deploy job copies
// from the newest snapshot. Counts only; no review text reaches the site.
import registry from "../../../docs/_system/competitors.json";
import { source } from "./data";

export interface ProductEntry { id: string; name: string; doc: string; group: string }

export const GROUPS: Record<string, string> = registry.groups;
export const PRODUCTS: ProductEntry[] = registry.products.map((p) => ({ id: p.id, name: p.name, doc: p.doc, group: p.group }));

export interface ThemeCount { theme: string; label: string; count: number }
export interface TrendPoint { month: string; items: number; positive: number; negative: number }
export interface AppRating { app: number; rating: number | null; count: number | null; since: string; rating_then: number | null; count_then: number | null }

export interface ProductSignals {
  name: string; doc: string; group: string;
  feedback: number; positive: number; negative: number; neutral: number;
  by_source: Record<string, number>;
  praised: ThemeCount[]; complaints: ThemeCount[];
  mentions: Record<string, number>;
  trend: TrendPoint[];
  net_30d: number | null; net_prev_30d: number | null;
  releases_90d: number; incidents_90d: number;
  last_incident: { title: string; at: string } | null;
  apps: AppRating[];
}

export interface Pattern { theme: string; label: string; praise: number; complaints: number; products_praised: number }

export interface ProfilesDoc {
  generated_at: string;
  last_pass_at: string | null;
  sources: Record<string, { status: string; note: string | null; items: number }> | null;
  items: number;
  products: Record<string, ProductSignals>;
  patterns: Pattern[];
  method: string;
}

/** Plain names for the collector's sources, as the page shows them. */
export const SOURCE_LABELS: Record<string, string> = {
  hn: "Hacker News",
  stackexchange: "Stack Exchange",
  "github-issues": "GitHub issues",
  "appstore-reviews": "App Store reviews",
  "appstore-ratings": "App Store ratings",
  "github-releases": "GitHub releases",
  status: "Status pages",
  changelog: "Changelogs",
  googleplay: "Google Play",
  reddit: "Reddit",
};

let p: Promise<ProfilesDoc | null> | null = null;

/** The collector's counts, or null when none have been published yet. */
export function loadProfiles(): Promise<ProfilesDoc | null> {
  if (!p) {
    const url = source === "local" ? "/local/profiles.json" : "/data/profiles.json";
    p = fetch(url, { cache: "no-cache" })
      .then(async (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("json") ? ((await res.json()) as ProfilesDoc) : null))
      .catch(() => null)
      .then((d) => { if (!d) p = null; return d; });
  }
  return p;
}

/** Share of scored items that were praise, among praise and complaints. */
export function praiseShare(s: ProductSignals): number | null {
  const n = s.positive + s.negative;
  return n ? s.positive / n : null;
}
