// #/sim on the research side: Parity Terminal (DEC-0023) runs full screen on its own site
// and opens in a new tab. This card keeps old links working.
import { Title } from "../components/Shell";
import { Button } from "../ui";
import { simUrl } from "../lib/space";

const PARTS = [
  ["Market monitor", "overview", "Every series by group: last, daily to yearly changes, volatility, how unusual the move is, the year's range"],
  ["Macro", "macro", "Macro, rates and inflation series, the yield curves and futures positioning"],
  ["FX", "fx", "Currencies on an interactive world map, with detail and a side-by-side compare"],
  ["Commodities", "commodities", "Oil, gas and metals with positioning and compare"],
  ["Sim lab", "simlab", "Crises, scenarios, simulated paths, stress tests and the strategy race, replayed from history"],
] as const;

export function SimLanding() {
  return (
    <>
      <div className="page-head">
        <Title>Parity Terminal</Title>
        <p>A keyboard-first market terminal on its own full-screen site: a command bar, workspaces of linked panels, every market series and every strategy KPI, and the simulations. Everything in it is history, not a forecast.</p>
      </div>
      <div className="mcard sim-landing">
        <Button variant="primary" icon="external" href={simUrl()} target="_blank">Open Parity Terminal</Button>
        <ul className="sim-landing-list">
          {PARTS.map(([name, ws, what]) => (
            <li key={ws}><a href={simUrl(ws)} target="_blank" rel="noopener"><strong>{name}</strong></a> <span className="muted">{what}</span></li>
          ))}
        </ul>
        <p className="muted">Type a function code (MON, CMP EUR JPY, SCEN) or a series (EUR, BRENT) in the command bar; press F1 for every code and shortcut. It can be installed as an app from the browser.</p>
      </div>
    </>
  );
}
