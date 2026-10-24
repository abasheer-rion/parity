// Trade: charts, trackers and a demo account on delayed, end-of-day data (DEC-0031).
// Nothing here places a real order or touches real money; real trading is a future
// decision for the owner (DEC-0019).
import { Title } from "../../components/Shell";
import { Tabs } from "../../ui";
import { ChartView } from "./ChartView";
import "../markets/markets.css";
import "./trade.css";

const VIEWS = [["", "Chart"]] as const;
type View = (typeof VIEWS)[number][0];

export function Trade({ view: raw }: { view?: string }) {
  const view = (VIEWS.some(([v]) => v === raw) ? raw : "") as View;
  const go = (v: View) => { window.location.hash = v ? `#/trade/${v}` : "#/trade"; };
  return (
    <div className="tr">
      <div className="page-head tr-head">
        <Title label="Trade">Trade</Title>
        <p>Charts with indicators and drawing tools on delayed, end-of-day prices. For learning and testing ideas, not live trading.</p>
      </div>
      {VIEWS.length > 1 && <div className="mk-tabs"><Tabs label="Trade view" value={view} onChange={go} tabs={VIEWS.map(([v, l]) => [v, l] as [View, string])} /></div>}
      {view === "" && <ChartView />}
    </div>
  );
}

export default Trade;
