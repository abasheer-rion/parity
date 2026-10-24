// Sim World (DEC-0016, DEC-0020): history replayed and reshuffled, never a forecast. Every
// tab plays the same way as the strategy race: a big date, Play and the speed, event
// bands on the timeline and a leaderboard that re-ranks as time moves. It runs full
// screen on its own site (/sim/, sim.endyland.com); the research side links there.
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Icon } from "../ui";
import { loadScenarios, selectAnalogues, specFromQuery, specToQuery, EMPTY_SPEC, type Loaded, type Spec } from "../lib/scenarios";
import { loadWorld, type WorldLoaded } from "../lib/world";
import type { Report } from "../lib/types";
import { MapView } from "./sim/MapView";
import { PathsView } from "./sim/PathsView";
import { ScenarioView } from "./sim/ScenarioView";
import { StrategyRace } from "./sim/StrategyRace";
import { CrisesView } from "./sim/CrisesView";
import { CommoditiesView } from "./sim/CommoditiesView";
import { RatesView } from "./sim/RatesView";
import { StocksView } from "./sim/StocksView";
import { ConnectionsView } from "./sim/ConnectionsView";
import { StressView } from "./sim/StressView";
import { BotBattle } from "./sim/BotBattle";
import "./SimWorld.css";
import "./sim/world.css";

export type Tab = "map" | "crises" | "commodities" | "rates" | "stocks" | "connections" | "scenario" | "paths" | "stress" | "race" | "bots";

const GROUPS: { name: string; tabs: { id: Tab; label: string; icon: string; what: string }[] }[] = [
  { name: "Play", tabs: [
    { id: "map", label: "Map", icon: "compass", what: "Currencies on a world map through time" },
    { id: "crises", label: "Crises", icon: "pulse", what: "Replay a past crisis across every market" },
    { id: "commodities", label: "Commodities", icon: "chart", what: "Oil, gas and copper racing, with the producers" },
    { id: "rates", label: "Rates", icon: "graph", what: "The US yield curve and interest rate gaps" },
    { id: "stocks", label: "Stocks", icon: "signal", what: "US industries and research factors racing" },
    { id: "connections", label: "Connections", icon: "table", what: "Which markets move together, through time" },
  ] },
  { name: "Analyse", tabs: [
    { id: "scenario", label: "Scenario", icon: "sparkle", what: "What followed past events like yours" },
    { id: "paths", label: "Paths", icon: "graph", what: "Simulated ranges and risks" },
    { id: "stress", label: "Stress test", icon: "flask", what: "A mix of assets through every past crisis" },
    { id: "race", label: "Strategy race", icon: "chart", what: "Every strategy replayed" },
    { id: "bots", label: "Bot battle", icon: "pulse", what: "Seven trading bots compared on win rate and profit" },
  ] },
];

export const TAB_IDS: string[] = GROUPS.flatMap((g) => g.tabs.map((t) => t.id));

export const DEFAULT_BASKET = ["EUR", "JPY", "oil", "stocks"];

export function SimWorld({ report, tab: rawTab, base = "#/sim" }: { report: Report | null; tab?: string; base?: string }) {
  const tab: Tab = TAB_IDS.includes(rawTab ?? "") ? (rawTab as Tab) : "map";
  const [world, setWorld] = useState<WorldLoaded | null>(null);
  const [scen, setScen] = useState<Loaded | null>(null);
  useEffect(() => { loadWorld().then(setWorld); loadScenarios().then(setScen); }, []);

  // Shared by the tabs: the scenario (kept in the address), the basket and the window.
  const [spec, setSpec] = useState<Spec>(() => specFromQuery(window.location.hash.split("?")[1] ?? "") ?? EMPTY_SPEC);
  const [basket, setBasket] = useState<string[]>(DEFAULT_BASKET);
  const [win, setWin] = useState("10y");
  const query = specToQuery(spec);
  const href = (t: Tab) => `${base}/${t}${query ? `?${query}` : ""}`;
  useEffect(() => {
    const next = href(tab);
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [tab, query, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const scenData = scen?.status === "ok" ? scen.data : null;
  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;
  const matches = useMemo(() => (scenData && !empty ? selectAnalogues(scenData, spec) : []), [scenData, spec, empty]);
  const go = (t: Tab) => { window.location.hash = href(t); };

  const data = world?.status === "ok" ? world.data : null;
  const problem = world && world.status !== "ok" ? (
    world.status === "missing"
      ? <EmptyState title="No world data yet" icon="database">The file of prices behind Sim World has not been built. {world.message}</EmptyState>
      : <div className="error">{world.message}</div>
  ) : null;

  return (
    <div className="sw2">
      <header className="sw2-head">
        <div>
          <h1>Sim World</h1>
          <p>Each tab replays or reshuffles past prices. None of it is a forecast.</p>
        </div>
      </header>
      <nav className="sw2-tabs" aria-label="Sim World">
        {GROUPS.map((g) => (
          <div key={g.name} className="sw2-tabgroup" role="group" aria-label={g.name}>
            <span className="sw2-tabgroup-name">{g.name}</span>
            {g.tabs.map((t) => (
              <a key={t.id} href={href(t.id)} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined} title={t.what}>
                <Icon name={t.icon} size={13} /><span>{t.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      {tab === "bots" ? <BotBattle /> : tab === "race" ? (
        report ? <StrategyRace report={report} /> : <p className="muted">Loading results</p>
      ) : !world ? (
        <p className="muted">Loading the world</p>
      ) : problem ?? (data && (
        tab === "map" ? <MapView data={data} win={win} setWin={setWin} onScenario={(patch) => { setSpec((s) => ({ ...s, ...patch })); go("scenario"); }} onPaths={(keys) => { setBasket(keys); go("paths"); }} />
        : tab === "crises" ? <CrisesView data={data} />
        : tab === "commodities" ? <CommoditiesView data={data} win={win} setWin={setWin} />
        : tab === "rates" ? <RatesView data={data} win={win} setWin={setWin} />
        : tab === "stocks" ? <StocksView data={data} win={win} setWin={setWin} />
        : tab === "connections" ? <ConnectionsView data={data} win={win} setWin={setWin} />
        : tab === "stress" ? <StressView data={data} />
        : tab === "scenario" ? (
          scen?.status === "missing" ? <EmptyState title="No scenario data yet" icon="database">The list of past events has not been built. {scen.message}</EmptyState>
            : scen?.status === "error" ? <div className="error">{scen.message}</div>
            : !scenData ? <p className="muted">Loading past events</p>
            : <ScenarioView data={data} scen={scenData} spec={spec} setSpec={setSpec} matches={matches} onPaths={() => go("paths")} />
        ) : (
          <PathsView data={data} basket={basket} setBasket={setBasket} spec={spec} matches={matches} hasScenario={!empty} onScenario={() => go("scenario")} />
        )
      ))}
    </div>
  );
}
