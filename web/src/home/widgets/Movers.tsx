// Biggest movers (DEC-0075): coins from CoinGecko for everyone. ETFs and single stocks need a
// price feed we may show, and no free one allows it on a public site (REF-0014), so those tabs
// fill only for team members, from the team-only stock feeds (DEC-0056).
import { useEffect, useMemo, useState } from "react";
import { loadCrypto, loadEtfs, usd } from "../../lib/markets";
import { useResource } from "../../ui/resource";
import { subscribeBoard } from "../../lib/live/client";
import { useTeam } from "../../lib/live/team";
import { tradeUrl } from "../../lib/space";
import { Chg, Empty, Src } from "./common";

type Tab = "coins" | "etfs" | "stocks";
interface Row { sym: string; name: string; price: number | null; chg: number | null; href: string }

export default function Movers() {
  const [tab, setTab] = useState<Tab>("coins");
  const crypto = useResource("home:crypto", loadCrypto, { maxAge: 60_000 });
  const etfs = useResource("home:etfs", loadEtfs, { maxAge: 60 * 60_000 });
  const team = useTeam();
  const [stocks, setStocks] = useState<Record<string, [number, number]>>({});
  const feeds = team?.team ? ["alpaca", "finnhub"].filter((f) => team.sources.includes(f)) : [];
  useEffect(() => {
    if (!feeds.length) return;
    const offs = feeds.map((src) => subscribeBoard(src, (rows) => {
      setStocks((old) => { const n = { ...old }; for (const [s, p, c] of rows) if (c != null) n[s] = [p, c]; return n; });
    }));
    return () => offs.forEach((f) => f());
  }, [feeds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const etfSet = useMemo(() => new Set((etfs.data?.etfs ?? []).map((e) => e.ticker)), [etfs.data]);
  const rows = useMemo<Row[]>(() => {
    if (tab === "coins") {
      return (crypto.data?.coins ?? []).filter((c) => c.change_24h_pct != null)
        .map((c) => ({ sym: c.symbol.toUpperCase(), name: c.name, price: c.price_usd, chg: c.change_24h_pct, href: "#/markets/crypto" }));
    }
    return Object.entries(stocks).filter(([s]) => (tab === "etfs") === etfSet.has(s))
      .map(([s, [p, c]]) => ({ sym: s, name: s, price: p, chg: c, href: tradeUrl(`chart?s=${encodeURIComponent(s)}`) }));
  }, [tab, crypto.data, stocks, etfSet]);
  const sorted = [...rows].sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0)).slice(0, 7);

  return (
    <>
      <div className="seg-mini" role="group" aria-label="Kind of market">
        {(["coins", "etfs", "stocks"] as Tab[]).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "coins" ? "Coins" : t === "etfs" ? "ETFs" : "Stocks"}</button>
        ))}
      </div>
      {tab !== "coins" && !feeds.length ? (
        <Empty>ETF and stock prices need a licensed feed before we can show them here. Team members see them live. Coins are public.</Empty>
      ) : (
        <ul className="wl">
          {sorted.map((r) => (
            <li key={r.sym} className="wl-row mv-row">
              <a href={r.href}><b>{r.sym}</b> <span className="wl-sub">{r.name !== r.sym ? r.name : ""}</span></a>
              <span className="mv-p">{usd(r.price)}</span>
              <Chg v={r.chg} />
            </li>
          ))}
          {!sorted.length && <li className="w-empty">Loading prices.</li>}
        </ul>
      )}
      <Src>{tab === "coins" ? <>24 hour change. Data provided by <a href="https://www.coingecko.com" target="_blank" rel="noopener">CoinGecko</a>.</> : "Change today, live, team only."} Sorted by size of move, up or down.</Src>
    </>
  );
}
