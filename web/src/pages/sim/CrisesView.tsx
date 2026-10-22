// Crises: pick a past crisis and replay it across markets: currencies on the map, and
// commodities, stocks, industries and bonds racing, with one leaderboard of the best and
// worst. A crisis window starts a little before the stress and ends a little after.
import { useMemo, useState } from "react";
import { FilterChip, Select } from "../../ui";
import { currencyOf, divergingFill, signed, type WorldData } from "../../lib/world";
import { at, colorAt, CRISES, rebase, weekly, windowRange } from "./play/data";
import { SeriesRace, type RaceItem } from "./play/SeriesRace";
import { MapLegend, WorldMap } from "./WorldMap";

type Group = "highlights" | "currencies" | "commodities" | "stocks" | "bonds" | "all";
const HIGHLIGHTS = ["stocks", "bonds10", "oil", "gas", "copper", "USD", "JPY", "CHF", "EUR", "AUD", "ind.Enrgy", "ind.Money", "ind.BusEq"];

export function CrisesView({ data }: { data: WorldData }) {
  const [id, setId] = useState("gfc");
  const [group, setGroup] = useState<Group>("highlights");
  const crisis = CRISES.find((c) => c.id === id)!;
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, id), [data, id]);
  const priced = useMemo(() => data.assets.filter((x) => x.kind !== "level" && x.group !== "factors"), [data]);
  const items: RaceItem[] = useMemo(() => {
    const pick = group === "highlights" ? priced.filter((x) => HIGHLIGHTS.includes(x.key))
      : group === "currencies" ? priced.filter((x) => x.group === "currencies")
      : group === "commodities" ? priced.filter((x) => x.group === "commodities")
      : group === "stocks" ? priced.filter((x) => x.group === "stocks" || x.group === "industries")
      : group === "bonds" ? priced.filter((x) => x.group === "bonds")
      : priced;
    return pick.map((x, i) => ({ key: x.key, label: x.group === "currencies" ? `${x.key} ${x.label}` : x.label, color: colorAt(i), dashed: i >= 8 && i < 16 }));
  }, [priced, group]);

  const currencies = useMemo(() => data.assets.filter((x) => x.group === "currencies").map((x) => ({ code: x.key, v: rebase(weekly(data, x.key), a, b) })), [data, a, b]);

  return (
    <>
      <div className="sw2-card pb-picker">
        <div className="pb-picker-row">
          <span className="ui-field-label">Crisis</span>
          <div className="chips" style={{ marginBottom: 0 }}>
            {CRISES.map((c) => <FilterChip key={c.id} label={c.label} active={c.id === id} onClick={() => setId(c.id)} />)}
          </div>
        </div>
        <p className="small" style={{ margin: 0 }}><strong>{crisis.label}.</strong> {crisis.note}</p>
      </div>
      <SeriesRace key={id} data={data} items={items} a={a} b={b} mode="growth" name="Asset"
        valueFmt={(_, __, r) => (r == null ? "n/a" : r.toFixed(1))}
        eyebrow={`${crisis.label} · every asset starts at 100`}
        controls={<Select<Group> label="Assets" value={group} onChange={setGroup} options={[["highlights", "Highlights"], ["currencies", "Currencies"], ["commodities", "Commodities"], ["stocks", "Stocks and industries"], ["bonds", "Bonds"], ["all", "Everything"]]} />}
        honest={<>History replayed, not a forecast. Weekly closes from {crisis.from} to {crisis.to}; the shaded band is the stress itself. Currencies are their value in US dollars (up means it gained on the dollar), bonds are Treasury total return, gas is the spot price, and copper a monthly average.</>}
        above={(k) => {
          const j = k - a;
          return (
            <div className="pb-map-small">
              <WorldMap label={`Currency moves since the start of the ${crisis.label} window`}
                fill={(cid) => { const c = currencyOf(cid); const v = c ? at(currencies.find((x) => x.code === c)?.v ?? [], j) : null; return divergingFill(v == null ? null : v - 100, 15); }}
                card={(cid, name) => {
                  const c = currencyOf(cid);
                  const v = c ? at(currencies.find((x) => x.code === c)?.v ?? [], j) : null;
                  return <><div className="wm-card-title">{name}</div><div className="wm-card-sub">{c ? `${c}: ${signed(v == null ? null : v - 100)} against the dollar since the window began` : "No currency data in Parity"}</div></>;
                }}
                onSelect={() => {}}
                legend={<MapLegend title="Currency vs USD since the start" low={signed(-15, 0)} high={signed(15, 0)} />} />
            </div>
          );
        }}
      />
    </>
  );
}
