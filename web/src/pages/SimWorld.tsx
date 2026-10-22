// Sim World (DEC-0016): a world map of currencies through history, a scenario builder that
// lines up what followed similar past events, simulated paths built from real weekly
// returns, and the strategy race. Everything here is history replayed or reshuffled; none
// of it is a forecast.
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Icon } from "../ui";
import { loadScenarios, selectAnalogues, specFromQuery, specToQuery, EMPTY_SPEC, type Loaded, type Spec } from "../lib/scenarios";
import { loadWorld, type WorldLoaded } from "../lib/world";
import type { Report } from "../lib/types";
import { MapView } from "./sim/MapView";
import { PathsView } from "./sim/PathsView";
import { ScenarioView } from "./sim/ScenarioView";
import { StrategyRace } from "./sim/StrategyRace";
import "./SimWorld.css";
import "./sim/world.css";

export type Tab = "map" | "scenario" | "paths" | "race";

const TABS: { id: Tab; label: string; icon: string; what: string }[] = [
  { id: "map", label: "World map", icon: "compass", what: "Currencies through history" },
  { id: "scenario", label: "Scenario", icon: "sparkle", what: "What followed similar events" },
  { id: "paths", label: "Paths", icon: "graph", what: "Simulated ranges and risks" },
  { id: "race", label: "Strategy race", icon: "chart", what: "Every strategy replayed" },
];

export const DEFAULT_BASKET = ["EUR", "JPY", "oil", "stocks"];

export function SimWorld({ report, tab: rawTab }: { report: Report | null; tab?: string }) {
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "map";
  const [world, setWorld] = useState<WorldLoaded | null>(null);
  const [scen, setScen] = useState<Loaded | null>(null);
  useEffect(() => { loadWorld().then(setWorld); loadScenarios().then(setScen); }, []);

  // The scenario is shared by every tab: the map can colour by it and the paths can draw
  // from the weeks after its past events. It lives in the address so a link reopens it.
  const [spec, setSpec] = useState<Spec>(() => specFromQuery(window.location.hash.split("?")[1] ?? "") ?? EMPTY_SPEC);
  const [basket, setBasket] = useState<string[]>(DEFAULT_BASKET);
  const query = specToQuery(spec);
  useEffect(() => {
    const next = `#/sim${tab === "map" ? "" : `/${tab}`}${query ? `?${query}` : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [tab, query]);

  const scenData = scen?.status === "ok" ? scen.data : null;
  const empty = !spec.type && !spec.regions.length && !spec.actors.length && !spec.severity && !spec.commodities.length;
  const matches = useMemo(() => (scenData && !empty ? selectAnalogues(scenData, spec) : []), [scenData, spec, empty]);
  const go = (t: Tab) => { window.location.hash = `#/sim${t === "map" ? "" : `/${t}`}${query ? `?${query}` : ""}`; };

  const worldData = world?.status === "ok" ? world.data : null;
  const worldProblem = world && world.status !== "ok" ? (
    world.status === "missing"
      ? <EmptyState title="No world data yet" icon="database">The file of currency prices behind the map has not been built. {world.message}</EmptyState>
      : <div className="error">{world.message}</div>
  ) : null;

  return (
    <div className="sw2">
      <header className="sw2-head">
        <div>
          <h1>Sim World</h1>
          <p>Play out events on a map of the world, see the range of what followed similar moments in history, and simulate paths to measure risk. History replayed, never a forecast.</p>
        </div>
        <nav className="sw2-tabs" aria-label="Sim World">
          {TABS.map((t) => (
            <a key={t.id} href={`#/sim${t.id === "map" ? "" : `/${t.id}`}${query ? `?${query}` : ""}`} className={tab === t.id ? "on" : ""}
              aria-current={tab === t.id ? "page" : undefined} title={t.what}>
              <Icon name={t.icon} size={14} /><span>{t.label}</span>
            </a>
          ))}
        </nav>
      </header>

      {tab === "race" ? (
        report ? <StrategyRace report={report} /> : <p className="muted">Loading results</p>
      ) : !world ? (
        <p className="muted">Loading the world</p>
      ) : worldProblem ?? (worldData && (
        tab === "map" ? (
          <MapView data={worldData} spec={spec} matches={matches}
            onScenario={(patch) => { setSpec((s) => ({ ...s, ...patch })); go("scenario"); }}
            onPaths={(keys) => { setBasket(keys); go("paths"); }} />
        ) : tab === "scenario" ? (
          scen?.status === "missing" ? <EmptyState title="No scenario data yet" icon="database">The list of past events has not been built. {scen.message}</EmptyState>
            : scen?.status === "error" ? <div className="error">{scen.message}</div>
            : !scenData ? <p className="muted">Loading past events</p>
            : <ScenarioView data={worldData} scen={scenData} spec={spec} setSpec={setSpec} matches={matches}
                onPaths={() => go("paths")} />
        ) : (
          <PathsView data={worldData} basket={basket} setBasket={setBasket} spec={spec} matches={matches}
            hasScenario={!empty} onScenario={() => go("scenario")} />
        )
      ))}
    </div>
  );
}
