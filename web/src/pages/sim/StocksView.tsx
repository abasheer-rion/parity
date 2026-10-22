// Stocks and sectors: the 12 US industries and the research factors (Kenneth French's
// data library) racing through a window, with the whole US market as the reference.
import { useMemo, useState } from "react";
import { Segmented } from "../../ui";
import type { WorldData } from "../../lib/world";
import { WindowSelect } from "./play/Controls";
import { colorAt, windowRange } from "./play/data";
import { lastCommon, SeriesRace, type RaceItem } from "./play/SeriesRace";

type Group = "industries" | "factors";

export function StocksView({ data, win, setWin }: { data: WorldData; win: string; setWin: (w: string) => void }) {
  const [group, setGroup] = useState<Group>("industries");
  const keys = data.assets.filter((x) => x.group === group).map((x) => x.key);
  const last = useMemo(() => lastCommon(data, keys.length ? keys : ["stocks"]), [data, keys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, win, last), [data, win, last]);
  const items: RaceItem[] = useMemo(() => [
    ...data.assets.filter((x) => x.group === group).map((x, i) => ({ key: x.key, label: x.label, color: colorAt(i), dashed: i >= 8 })),
    ...(group === "industries" && data.weekly.series.stocks ? [{ key: "stocks", label: "Whole US market", color: "var(--text-2)", dashed: true, bench: true }] : []),
  ], [data, group]);

  return (
    <SeriesRace data={data} items={items} a={a} b={b} mode="growth" name={group === "industries" ? "Industry" : "Factor"}
      valueFmt={(_, __, r) => (r == null ? "n/a" : r.toFixed(0))}
      eyebrow={group === "industries" ? "US industries race · each starts at 100, dividends included" : "Research factors race · each starts at 100"}
      controls={<>
        <Segmented<Group> label="Group" size="sm" value={group} onChange={setGroup} options={[["industries", "Industries"], ["factors", "Factors"]]} />
        <WindowSelect value={win} onChange={setWin} />
      </>}
      honest={group === "industries"
        ? <>History replayed, not a forecast. Value-weighted US industry indexes with dividends, from Kenneth French's data library, which is updated about two months late, so the race ends earlier than the currency tabs.</>
        : <>History replayed, not a forecast. Each factor is a long-short portfolio that costs nothing to set up on paper, before trading costs and borrowing fees, from Kenneth French's data library (about two months late). Value is the index level, not a price.</>}
    />
  );
}
