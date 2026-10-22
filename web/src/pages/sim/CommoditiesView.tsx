// Commodities: oil (WTI and Brent), US natural gas and copper racing through a window,
// with a map of the big producers of whichever one you follow.
import { useMemo } from "react";
import { COMMODITY_LABEL, PRODUCERS, producerOf, type Commodity, type WorldData } from "../../lib/world";
import { WindowSelect } from "./play/Controls";
import { colorAt, windowRange } from "./play/data";
import { lastCommon, SeriesRace, type RaceItem } from "./play/SeriesRace";
import { WorldMap } from "./WorldMap";

const ITEMS: (RaceItem & { commodity: Commodity })[] = [
  { key: "oil", label: "Oil (WTI)", color: colorAt(1), commodity: "oil", note: "US crude, dollars a barrel, daily close" },
  { key: "brent", label: "Oil (Brent)", color: colorAt(3), commodity: "oil", note: "North Sea crude, dollars a barrel, daily close" },
  { key: "gas", label: "US gas (spot)", color: colorAt(0), commodity: "gas", note: "Henry Hub spot price. Spot gas has short spikes nobody could have traded at; futures are smoother." },
  { key: "copper", label: "Copper (monthly avg)", color: colorAt(2), commodity: "copper", note: "IMF monthly average price, shown from a week after each month ends, when it could be read" },
];

export function CommoditiesView({ data, win, setWin }: { data: WorldData; win: string; setWin: (w: string) => void }) {
  const last = useMemo(() => lastCommon(data, ["oil", "brent", "gas"]), [data]);
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, win, last), [data, win, last]);
  const items = ITEMS.filter((it) => data.weekly.series[it.key] || data.monthly[it.key]);
  const money = (v: number, key: string) => key === "copper" ? `$${Math.round(v).toLocaleString("en-US")}` : `$${v.toFixed(2)}`;

  return (
    <SeriesRace data={data} items={items} a={a} b={b} mode="growth" valueFmt={money} name="Commodity"
      eyebrow="Commodities race · each starts at 100"
      controls={<WindowSelect value={win} onChange={setWin} />}
      honest={<>History replayed, not a forecast. Gas is the <strong>spot</strong> price, whose short spikes nobody could have traded; copper is a <strong>monthly average</strong>, carried forward between months. Prices in US dollars.</>}
      above={(_, focus) => {
        const c: Commodity = ITEMS.find((it) => it.key === focus)?.commodity ?? "oil";
        const color = ITEMS.find((it) => it.commodity === c)?.color ?? colorAt(1);
        return (
          <div className="pb-map-small">
            <WorldMap label={`Big ${COMMODITY_LABEL[c].toLowerCase()} producers`} producers={[c]}
              fill={(id) => (PRODUCERS[c].includes(id) ? `color-mix(in oklab, ${color} 70%, var(--map-mid))` : "var(--map-none)")}
              card={(id, name) => {
                const p = producerOf(id);
                return <><div className="wm-card-title">{name}</div><div className="wm-card-sub">{p.length ? `Big ${p.map((x) => COMMODITY_LABEL[x].toLowerCase()).join(", ")} producer` : "Not a big producer of these"}</div></>;
              }}
              onSelect={() => {}}
              legend={<div className="wm-scale"><span className="wm-scale-title">Big {COMMODITY_LABEL[c].toLowerCase()} producers (EIA, IEA, USGS). Click a row to switch.</span></div>} />
          </div>
        );
      }}
    />
  );
}
