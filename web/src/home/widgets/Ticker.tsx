// Ticker tape (DEC-0075): coins from CoinGecko, about a minute behind and allowed on the site
// with its credit, then daily markets from the Terminal export (FX, rates, oil, the VIX), each
// marked with how late it is. It scrolls, and a Pause button stops it (WCAG 2.2.2); with
// reduced motion it does not move at all and can be scrolled by hand.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../ui";
import { subscribeBoard } from "../../lib/live/client";
import { useResource } from "../../ui/resource";
import { loadIndex, type TermSeries } from "../../terminal/data";
import { loadCrypto } from "../../lib/markets";
import { delayText, priceText } from "../../lib/tradeData";
import { useMotionLevel } from "../../ui/motionPref";
import { Chg } from "./common";

interface Item { key: string; sym: string; price: number; chg: number | null; late: string }

const DAILY = ["fx", "commodities", "rates", "equities"];

export default function Ticker() {
  const crypto = useResource("home:crypto", loadCrypto, { maxAge: 60_000 });
  const index = useResource("home:term-index", loadIndex, { maxAge: 10 * 60_000 });
  const [live, setLive] = useState<Record<string, [number, number | null]>>({});
  const [paused, setPaused] = useState(false);
  const reduced = useMotionLevel() === "reduced";

  // CoinGecko's live board, when the edge has it: the same terms as the export, fresher.
  useEffect(() => subscribeBoard("coingecko", (rows) => {
    setLive((old) => { const n = { ...old }; for (const [sym, p, chg] of rows) n[sym] = [p, chg ?? old[sym]?.[1] ?? null]; return n; });
  }), []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of (crypto.data?.coins ?? []).filter((c) => c.major).slice(0, 10)) {
      const l = live[`${c.symbol.toUpperCase()}-USD`];
      if (c.price_usd == null && !l) continue;
      out.push({ key: `c:${c.id}`, sym: c.symbol.toUpperCase(), price: l?.[0] ?? c.price_usd!, chg: l?.[1] ?? c.change_24h_pct, late: l ? "about 1 min late" : "CoinGecko export" });
    }
    const idx = index.data?.status === "ok" ? index.data.data.series : [];
    // For price series chg.d1 is already a percent (level series such as rates are left out).
    const daily = idx.filter((s: TermSeries) => DAILY.includes(String(s.class)) && s.kind === "price" && s.freq === "D" && s.last != null && s.chg.d1 != null);
    for (const s of daily.slice(0, 14)) out.push({ key: `t:${s.key}`, sym: s.short, price: s.last!, chg: s.chg.d1!, late: delayText(s) });
    return out;
  }, [crypto.data, index.data, live]);

  if (!items.length) return <div className="tape-empty muted small">Prices load here: coins about a minute behind, other markets at the last daily close.</div>;
  const moving = !paused && !reduced;
  const row = items.map((i) => (
    <span key={i.key} className="tape-item" title={i.late}>
      <b>{i.sym}</b> {priceText(i.price)} <Chg v={i.chg} digits={2} />
    </span>
  ));
  return (
    <div className="tape">
      <button type="button" className="w-btn tape-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused} disabled={reduced}
        title={reduced ? "Not moving, because your device asks for less motion" : paused ? "Play the ticker" : "Pause the ticker"}>
        <Icon name={moving ? "pause" : "play"} size={13} /><span className="sr-only">{paused ? "Play the ticker" : "Pause the ticker"}</span>
      </button>
      <div data-layout-ignore className={`tape-track ${moving ? "is-moving" : "is-still"}`} {...(moving ? {} : { tabIndex: 0, role: "region", "aria-label": "Prices, scroll sideways" })} style={{ ["--tape-s" as string]: `${Math.max(30, items.length * 4)}s` }}>
        <div className="tape-row">{row}</div>
        {moving && <div className="tape-row" aria-hidden>{row}</div>}
      </div>
      <span className="tape-late">Coins: about 1 min late, data by <a href="https://www.coingecko.com" target="_blank" rel="noopener">CoinGecko</a>. Others: last daily close.</span>
    </div>
  );
}
