// Settings > Trade profile: the month view of daily demo P&L, your closed trades ranked
// best to worst, and the opt-in leaderboard of demo traders. Everything here is demo
// money from the paper account (DEC-0034); no real money or real order is involved.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../auth/session";
import { isMockStore } from "../lib/userStore";
import { tradeUrl } from "../lib/space";
import { loadInstruments } from "../lib/tradeData";
import { loadDemo } from "../lib/tradeProfile/data";
import {
  buildMonth, closedTrades, dailyPnl, dayLabel, inPeriod, isoDate, monthLabel, monthOf, pct, rankTrades, shiftMonth, streaks, usd,
  type ClosedTrade, type FillLike, type Month, type RankBy, type TradePeriod,
} from "../lib/tradeProfile/logic";
import type { AccountRow } from "../lib/paper/account";
import { Button, DataTable, Dialog, EmptyState, IconButton, KeyValues, Select, type Column } from "../ui";
import { MonthCalendar } from "./MonthCalendar";
import { Leaderboard } from "./Leaderboard";
import "./tradeProfile.css";

type Demo = { accounts: AccountRow[]; fills: FillLike[] };

const signed = (v: number) => <span className={v > 0.004 ? "good" : v < -0.004 ? "bad" : ""}>{usd(v)}</span>;

export function TradeProfileSettings() {
  const { session, loading } = useSession();
  const local = isMockStore();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState("all");
  const [labels, setLabels] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!session && !local) return;
    let live = true;
    loadDemo().then((d) => { if (live) { setDemo(d as Demo); setError(null); } }, () => { if (live) setError("Could not load your demo account. Reload to try again."); });
    loadInstruments().then((r) => { if (live && r.status === "ok") setLabels(new Map(r.data.map((s) => [s.key, s.short || s.label]))); }).catch(() => {});
    return () => { live = false; };
  }, [session, local]);

  if (!session && !local) {
    if (loading) return <p className="settings-note" aria-busy="true">Loading your trade profile.</p>;
    return <EmptyState title="Sign in to see your trade profile" icon="user">Your trade profile is built from your demo account, so it needs you to be signed in.</EmptyState>;
  }
  if (error) return <p role="alert" className="settings-note">{error}</p>;
  if (!demo) return <p className="settings-note" aria-busy="true">Loading your trade profile.</p>;
  if (!demo.accounts.length) {
    return (
      <>
        <EmptyState title="No demo account yet" icon="graph" action={<Button href={tradeUrl()} variant="primary">Open Parity Trade</Button>}>
          Your trade profile fills in once you place practice trades in a demo account in Parity Trade.
        </EmptyState>
        <Leaderboard />
      </>
    );
  }
  const fills = account === "all" ? demo.fills : demo.fills.filter((f) => f.account_id === account);
  return (
    <>
      {demo.accounts.length > 1 && (
        <div className="tp-account">
          <Select label="Demo account" value={account} onChange={setAccount}
            options={[["all", "All demo accounts"], ...demo.accounts.map((a): [string, string] => [a.id, a.name || "Demo account"])]} />
        </div>
      )}
      <Profile trades={closedTrades(fills)} label={(s) => labels.get(s) ?? s} />
      <Leaderboard />
    </>
  );
}

function Profile({ trades, label }: { trades: ClosedTrade[]; label: (symbol: string) => string }) {
  const today = isoDate(new Date());
  const daily = useMemo(() => dailyPnl(trades), [trades]);
  const latest = trades[0]?.date;
  const [month, setMonth] = useState<Month>(monthOf(latest ?? today));
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (latest) setMonth(monthOf(latest)); }, [latest]);

  if (!trades.length) {
    return (
      <section aria-labelledby="tp-month" className="tp-sec">
        <h2 id="tp-month" className="settings-sub">Month view</h2>
        <EmptyState title="No closed trades yet" icon="calendar" action={<Button href={tradeUrl()}>Open Parity Trade</Button>}>
          A trade counts here once you sell what you bought in your demo account. Each sale shows on the day it closed.
        </EmptyState>
      </section>
    );
  }

  const view = buildMonth(month, daily);
  const st = streaks(daily);
  const dayTrades = open ? trades.filter((t) => t.date === open) : [];
  return (
    <>
      <section aria-labelledby="tp-month" className="tp-sec" data-testid="trade-calendar">
        <div className="tp-head">
          <h2 id="tp-month" className="settings-sub">Month view</h2>
          <div className="tp-nav">
            <IconButton icon="chevronLeft" label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} />
            <span className="tp-nav-label" aria-live="polite">{monthLabel(month)}</span>
            <IconButton icon="chevronRight" label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} />
          </div>
        </div>
        <p className="settings-note">Daily P&L of closed demo trades, after fees. Green days made money, red days lost it. Select a day to see its trades.</p>
        <MonthCalendar view={view} onOpen={setOpen} />
        <KeyValues cols={4} items={[
          ["Month total", signed(view.pnl)],
          ["Win days", String(view.winDays)],
          ["Loss days", String(view.lossDays)],
          ["Closed trades", String(view.trades)],
          ["Best day", view.best ? <>{signed(view.best.pnl)} <span className="tp-dim">on {view.best.day}</span></> : "n/a"],
          ["Worst day", view.worst ? <>{signed(view.worst.pnl)} <span className="tp-dim">on {view.worst.day}</span></> : "n/a"],
          ["Current streak", st.current.kind ? `${st.current.days} ${st.current.kind} ${st.current.days === 1 ? "day" : "days"}` : "None"],
          ["Longest streaks", `${st.longestWin} win, ${st.longestLoss} loss`],
        ]} />
        <p className="settings-note">Streaks count days with closed trades, across all months. A day at exactly zero ends a streak.</p>
      </section>
      <Dialog open={open != null} onClose={() => setOpen(null)} title={open ? dayLabel(open) : ""} width={640}>
        {dayTrades.length ? (
          <>
            <p className="settings-note">{dayTrades.length} closed {dayTrades.length === 1 ? "trade" : "trades"}, {usd(dayTrades.reduce((s, t) => s + t.pnl, 0))} after fees.</p>
            <DataTable rows={dayTrades} rowKey={(t) => t.id} columns={tradeColumns(label)} caption="Trades closed on this day" dense initialSort={{ key: "pnl", dir: "desc" }} />
          </>
        ) : <p className="settings-note">No closed trades on this day.</p>}
      </Dialog>
      <RankedTrades trades={trades} label={label} today={today} />
    </>
  );
}

function tradeColumns(label: (s: string) => string, rank?: Map<string, number>): Column<ClosedTrade>[] {
  const cols: Column<ClosedTrade>[] = [
    { key: "symbol", header: "Market", align: "left", render: (t) => <><span className="tp-sym">{label(t.symbol)}</span><span className="tp-dim tp-sub">{t.market}</span></> },
    { key: "date", header: "Closed", align: "left", sort: (t) => t.date, render: (t) => t.date },
    { key: "qty", header: "Quantity", render: (t) => (+t.qty.toFixed(6)).toLocaleString("en-US") },
    { key: "price", header: "Sell price", render: (t) => t.price.toLocaleString("en-US", { maximumFractionDigits: 4 }) },
    { key: "pnl", header: "P&L", sort: (t) => t.pnl, render: (t) => signed(t.pnl) },
    { key: "ret", header: "Return", sort: (t) => t.ret, render: (t) => <span className={t.ret == null ? "" : t.ret > 0 ? "good" : t.ret < 0 ? "bad" : ""}>{pct(t.ret, 2)}</span> },
  ];
  if (rank) cols.unshift({ key: "rank", header: "Rank", align: "left", render: (t) => rank.get(t.id) ?? "n/a" });
  return cols;
}

const PERIODS: [TradePeriod, string][] = [["week", "Last 7 days"], ["month", "Last 30 days"], ["year", "Last 365 days"], ["all", "All time"]];

function RankedTrades({ trades, label, today }: { trades: ClosedTrade[]; label: (s: string) => string; today: string }) {
  const [period, setPeriod] = useState<TradePeriod>("all");
  const [market, setMarket] = useState("all");
  const [by, setBy] = useState<RankBy>("pnl");
  const markets = [...new Set(trades.map((t) => t.market))].sort();
  const rows = trades.filter((t) => inPeriod(t.date, period, today) && (market === "all" || t.market === market));
  const rank = rankTrades(rows, by);
  const onSort = useCallback((s: { key: string }) => { if (s.key === "pnl" || s.key === "ret") setBy(s.key); }, []);
  return (
    <section aria-labelledby="tp-ranked" className="tp-sec" data-testid="ranked-trades">
      <h2 id="tp-ranked" className="settings-sub">Your trades, ranked</h2>
      <p className="settings-note">Closed demo trades from best to worst. Select the P&L or Return heading to rank by it. Return is the P&L over what the shares cost, fees included.</p>
      <div className="tp-filters">
        <Select label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <Select label="Market" value={market} onChange={setMarket} options={[["all", "All markets"], ...markets.map((m): [string, string] => [m, m])]} />
      </div>
      <DataTable rows={rows} rowKey={(t) => t.id} columns={tradeColumns(label, rank)} caption="Your closed trades, ranked" initialSort={{ key: by, dir: "desc" }}
        onSortChange={onSort} empty="No closed trades in this period and market." />
    </section>
  );
}
