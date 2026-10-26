// Feeds the desktop app's menu bar ticker (DEC-0049): the active watchlist's symbols, last
// delayed close and day change, the same numbers the watchlist panel shows. Rendered only
// inside the desktop app; it draws nothing.
import { useEffect } from "react";
import { desktopTicker } from "../desktop/bridge";
import { priceText, type Instrument } from "../lib/tradeData";
import { chgText, useWatchlists } from "./WatchlistsView";

export function DesktopTicker({ list }: { list: Instrument[] }) {
  const { rows } = useWatchlists(list);
  const key = rows.map((s) => `${s.key}:${s.last}:${s.chg.d1}`).join("|");
  useEffect(() => {
    if (!rows.length) return;
    desktopTicker(rows.map((s) => {
      const d = s.chg.d1;
      return { symbol: s.short || s.label, last: priceText(s.last), change: chgText(s, d), up: d == null || !Number.isFinite(d) || d === 0 ? null : d > 0 };
    }));
  }, [key]);
  return null;
}
