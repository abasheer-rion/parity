// #/sim on the research side: Sim World now runs full screen on its own site and opens in a
// new tab (DEC-0020). This card keeps old links working.
import { Title } from "../components/Shell";
import { Button } from "../ui";
import { simUrl } from "../lib/space";

const TABS = [
  ["Map", "map", "Currencies on a world map, played through time"],
  ["Crises", "crises", "Dot-com, 2008, the euro crisis, the taper tantrum, the oil crash, Covid and 2022, across every market"],
  ["Commodities", "commodities", "Oil, gas and copper racing, with the big producers"],
  ["Rates", "rates", "The US yield curve changing shape, and interest rate gaps by currency"],
  ["Stocks", "stocks", "The 12 US industries and the research factors racing"],
  ["Connections", "connections", "Which markets move together, and how that changes in a crisis"],
  ["Scenario", "scenario", "What followed past events like the one you describe"],
  ["Paths", "paths", "Simulated futures from reshuffled history, with their risks, as CSV"],
  ["Stress test", "stress", "A mix of assets through every past crisis"],
  ["Strategy race", "race", "Every strategy we test, replayed"],
] as const;

export function SimLanding() {
  return (
    <>
      <div className="page-head">
        <Title>Sim World</Title>
        <p>Sim World has its own full-screen site, with nothing but the simulator and a Back button. Every tab replays or reshuffles history; none of it is a forecast.</p>
      </div>
      <div className="mcard sim-landing">
        <Button variant="primary" icon="external" href={simUrl()} target="_blank">Open Sim World</Button>
        <ul className="sim-landing-list">
          {TABS.map(([name, tab, what]) => (
            <li key={tab}><a href={simUrl(tab)} target="_blank" rel="noopener"><strong>{name}</strong></a> <span className="muted">{what}</span></li>
          ))}
        </ul>
      </div>
    </>
  );
}
