// Every live or near-live source we considered (DEC-0049), with what its terms let us do.
// Only "display" sources are switched on in the fan-out (web/live/src/adapters.ts). The
// same list, with the daily sources, is printed by `parity data sources` (engine
// providers.py) and explained in REF-0014. Terms were read on the date given.
import type { FeedType } from "./protocol";

/** display: terms allow showing the data on our site; ask: terms are silent or unclear,
 *  so it waits for the owner; no: terms forbid it or the source blocks us. */
export type Licence = "display" | "ask" | "no";

export interface SourceMeta {
  id: string;
  name: string;
  short: string;
  feed: FeedType;
  delayMin?: number;
  /** What it covers, in words. */
  covers: string;
  licence: Licence;
  terms: string;
  read: string;
  /** Why it is on or off, in one line. */
  note: string;
  /** Live symbols offered (sources with a short fixed list). */
  symbols?: string[];
  /** Streams through our fan-out (otherwise fetched on a schedule). */
  streams: boolean;
}

export const SOURCES: SourceMeta[] = [];

export const sourceById = (id: string): SourceMeta | undefined => SOURCES.find((s) => s.id === id);
export const liveSources = () => SOURCES.filter((s) => s.streams && s.licence === "display");
