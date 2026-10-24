// Sim World's tabs as terminal panels. They keep their own playback (a big date, Play,
// speeds, event bands, a leaderboard); terminal.css fits them into a panel. They share
// the scenario, the basket and the window through the terminal's context.
import { useMemo, type ReactNode } from "react";
import { selectAnalogues } from "../../lib/scenarios";
import type { WorldData } from "../../lib/world";
import { CommoditiesView } from "../../pages/sim/CommoditiesView";
import { ConnectionsView } from "../../pages/sim/ConnectionsView";
import { CrisesView } from "../../pages/sim/CrisesView";
import { MapView } from "../../pages/sim/MapView";
import { PathsView } from "../../pages/sim/PathsView";
import { RatesView } from "../../pages/sim/RatesView";
import { ScenarioView } from "../../pages/sim/ScenarioView";
import { StocksView } from "../../pages/sim/StocksView";
import { StrategyRace } from "../../pages/sim/StrategyRace";
import { StressView } from "../../pages/sim/StressView";
import { BotBattle } from "../../pages/sim/BotBattle";
import { useAsOf, useLoad, useTerm } from "../context";
import { getBots, getScen, getWorld } from "../data";
import { HONEST } from "../functions";
import { Empty, Loading } from "../tui";

function SimFrame({ children }: { children: ReactNode }) {
  return (
    <div className="term-scroll term-sim">
      <div className="term-honest-strip">{HONEST}</div>
      <div className="sw2 term-sw">{children}</div>
    </div>
  );
}

function WithWorld({ children }: { children: (d: WorldData) => ReactNode }) {
  const w = useLoad(getWorld);
  useAsOf(w.status === "ok" ? w.data.data_through : null);
  if (w.status === "loading") return <Loading what="Loading the world file" />;
  if (w.status !== "ok") return <Empty title={w.status === "missing" ? "No world data yet" : "Could not load the world data"}>{w.message}</Empty>;
  return <SimFrame>{children(w.data)}</SimFrame>;
}

export function SimPanel({ fn }: { fn: string }) {
  const t = useTerm();
  if (fn === "RACE") return <RacePanel />;
  if (fn === "SCEN" || fn === "PATH") return <ScenPanel fn={fn} />;
  return (
    <WithWorld>
      {(data) => {
        const w = { data, win: t.win, setWin: t.setWin };
        switch (fn) {
          case "WMAP": return (
            <MapView {...w}
              onScenario={(patch) => { t.setSpec((s) => ({ ...s, ...patch })); t.open("SCEN"); }}
              onPaths={(keys) => { t.setBasket(keys); t.open("PATH"); }}
              onPick={(code) => {
                const s = t.index.status === "ok" ? t.index.data.series.find((x) => x.class === "fx" && x.short === code) : undefined;
                t.setLink({ ccy: code, ...(s ? { series: s.key } : {}) });
              }} />
          );
          case "CORR": return <ConnectionsView {...w} />;
          case "STRS": return <StressView data={data} />;
          case "CRIS": return <CrisesView data={data} />;
          case "CMDY": return <CommoditiesView {...w} />;
          case "EQTY": return <StocksView {...w} />;
          case "RATES": return <RatesView {...w} />;
          default: return <Empty title={`Unknown panel ${fn}`} />;
        }
      }}
    </WithWorld>
  );
}

export function BotsPanel() {
  const ix = useLoad(getBots);
  useAsOf(ix.status === "ok" ? ix.data.data_through : null);
  return (
    <div className="term-scroll term-sim">
      <div className="term-honest-strip">Hypothetical and educational. Not investment advice.</div>
      <div className="sw2 term-sw"><BotBattle /></div>
    </div>
  );
}

function RacePanel() {
  const t = useTerm();
  useAsOf(t.report.status === "ok" ? t.report.data.generated_at?.slice(0, 10) : null);
  if (t.report.status === "loading") return <Loading what="Loading strategy results" />;
  if (t.report.status !== "ok") return <Empty title="No strategy results yet">{t.report.message}</Empty>;
  return <SimFrame><StrategyRace report={t.report.data} /></SimFrame>;
}

function ScenPanel({ fn }: { fn: "SCEN" | "PATH" }) {
  const t = useTerm();
  const scen = useLoad(getScen);
  const scenData = scen.status === "ok" ? scen.data : null;
  const s = t.spec;
  const empty = !s.type && !s.regions.length && !s.actors.length && !s.severity && !s.commodities.length;
  const matches = useMemo(() => (scenData && !empty ? selectAnalogues(scenData, s) : []), [scenData, s, empty]);
  return (
    <WithWorld>
      {(data) => fn === "PATH"
        ? <PathsView data={data} basket={t.basket} setBasket={t.setBasket} spec={s} matches={matches} hasScenario={!empty} onScenario={() => t.open("SCEN")} />
        : scen.status === "loading" ? <Loading what="Loading past events" />
        : scen.status !== "ok" ? <Empty title={scen.status === "missing" ? "No scenario data yet" : "Could not load past events"}>{scen.message}</Empty>
        : <ScenarioView data={data} scen={scen.data} spec={s} setSpec={t.setSpec} matches={matches} onPaths={() => t.open("PATH")} />}
    </WithWorld>
  );
}
