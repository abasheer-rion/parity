// Trade: charts, trackers and a demo account on delayed, end-of-day data (DEC-0031,
// DEC-0032). Nothing here places a real order or touches real money; real trading is a
// future decision for the owner (DEC-0019).
import { useEffect } from "react";
import { Title } from "../../components/Shell";
import { Tabs } from "../../ui";
import { SkeletonTable } from "../../ui/skeleton";
import { ChartView } from "./ChartView";
import { NotificationsBell } from "./Notifications";
import { ScreenerView } from "./ScreenerView";
import { WatchlistsView } from "./WatchlistsView";
import { useInstruments } from "./shared";
import { checkAlerts } from "./trackers";
import "../markets/markets.css";
import "./trade.css";

const VIEWS = [["", "Chart"], ["watchlists", "Watchlists"], ["screener", "Screener"]] as const;
type View = (typeof VIEWS)[number][0];

export function Trade({ view: raw }: { view?: string }) {
  const view = (VIEWS.some(([v]) => v === raw) ? raw : "") as View;
  const go = (v: View) => { window.location.hash = v ? `#/trade/${v}` : "#/trade"; };
  const insts = useInstruments();
  const list = insts.status === "ok" ? insts.data : [];
  // Alerts are checked when Trade opens and again whenever the watchlists tab opens.
  useEffect(() => { if (list.length) void checkAlerts(list); }, [list, view === "watchlists"]);
  const noData = insts.status === "missing" || insts.status === "error" ? <div className="mk-banner" role="note"><strong>No market data yet.</strong> {insts.message}</div> : null;
  return (
    <div className="tr">
      <div className="page-head tr-head">
        <Title label="Trade">Trade</Title>
        <p>Charts, watchlists, alerts and a screener on delayed, end-of-day prices. For learning and testing ideas, not live trading.</p>
      </div>
      <div className="mk-tabs tr-tabs">
        <Tabs label="Trade view" value={view} onChange={go} tabs={VIEWS.map(([v, l]) => [v, l] as [View, string])} />
        <NotificationsBell list={list} />
      </div>
      {view === "" && <ChartView />}
      {view !== "" && (noData ?? (list.length === 0 ? <SkeletonTable rows={6} cols={6} label="Loading instruments" /> : view === "watchlists" ? <WatchlistsView list={list} /> : <ScreenerView list={list} />))}
    </div>
  );
}

export default Trade;
