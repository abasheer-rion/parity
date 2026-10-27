// Your account (DEC-0075): the demo account in Trade (virtual money), its positions at cost,
// realised profit and loss, and the person's watchlists and followed strategies.
import { useMemo } from "react";
import { accountsTable, positionsTable, STARTING_CASH } from "../../lib/paper/account";
import { table, useRows, type Row } from "../../lib/userStore";
import { usePrefs } from "../../lib/prefs";
import { usd } from "../../lib/markets";
import { tradeUrl } from "../../lib/space";
import { Empty, Src } from "./common";

interface WatchlistRow extends Row { name: string; items: string[]; position: number }
const watchlistsTable = table<WatchlistRow>("trade_watchlists");

export default function Account() {
  const accounts = useRows(accountsTable, "paper_accounts");
  const positions = useRows(positionsTable, "paper_positions");
  const lists = useRows(watchlistsTable, "trade_watchlists");
  const prefs = usePrefs();
  const acct = accounts.rows[0];
  const mine = useMemo(() => positions.rows.filter((p) => !acct || p.account_id === acct.id), [positions.rows, acct]);
  const open = mine.filter((p) => p.qty !== 0);
  const atCost = open.reduce((s, p) => s + p.qty * p.avg_cost, 0);
  const realised = mine.reduce((s, p) => s + (p.realized ?? 0), 0);
  const start = acct?.starting_cash ?? STARTING_CASH;
  const value = acct ? acct.cash + atCost : null;
  const followed = prefs.bookmarks.filter((b) => b.href.startsWith("#/strategy/"));
  const symbols = [...new Set(lists.rows.flatMap((l) => l.items))];

  return (
    <>
      {!acct ? (
        <Empty>No demo account yet. <a href={tradeUrl("portfolio")} target="_blank" rel="noopener">Open Trade</a> to get one with {usd(STARTING_CASH)} of virtual money.</Empty>
      ) : (
        <div className="acct-stats">
          <div><span className="wl-sub">Value at cost</span><b>{usd(value)}</b></div>
          <div><span className="wl-sub">Change since start</span><b className={(value ?? start) - start >= 0 ? "good" : "bad"}>{value != null ? `${value - start >= 0 ? "+" : "-"}${usd(Math.abs(value - start))}` : "n/a"}</b></div>
          <div><span className="wl-sub">Realised P&amp;L</span><b className={realised >= 0 ? "good" : "bad"}>{`${realised >= 0 ? "+" : "-"}${usd(Math.abs(realised))}`}</b></div>
          <div><span className="wl-sub">Open positions</span><b>{open.length}</b></div>
        </div>
      )}
      {open.length > 0 && (
        <ul className="wl">
          {open.slice(0, 4).map((p) => (
            <li key={p.id} className="wl-row mv-row">
              <a href={tradeUrl(`chart?s=${encodeURIComponent(p.symbol)}`)} target="_blank" rel="noopener"><b>{p.symbol}</b></a>
              <span className="wl-sub">{p.qty} at {usd(p.avg_cost)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="acct-watch">
        <span className="wl-sub">Watchlist</span>
        {symbols.length || followed.length ? (
          <div className="chips">
            {symbols.slice(0, 8).map((s) => <a key={s} className="chip" href={tradeUrl(`chart?s=${encodeURIComponent(s)}`)} target="_blank" rel="noopener">{s}</a>)}
            {followed.slice(0, 4).map((b) => <a key={b.href} className="chip" href={b.href}>{b.label}</a>)}
          </div>
        ) : <p className="w-empty">Add symbols in Trade or follow a strategy, and they show here.</p>}
      </div>
      <Src>Demo account, virtual money. Positions are shown at what they cost; Trade shows them at delayed prices.</Src>
    </>
  );
}
