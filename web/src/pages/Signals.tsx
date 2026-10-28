import { Title } from "../components/Shell";
import { BarChart } from "../ui/charts";
import { Card } from "../ui/layout";
import { colorMap } from "../lib/colors";
import { num } from "../lib/format";
import type { Report } from "../lib/types";
import { nameOf, taglineOf } from "../lib/strategyMeta";
import { TableScroll } from "../ui";

export function Signals({ report }: { report: Report }) {
  const colors = colorMap(report.runs);
  const withSignal = report.runs.filter((r) => r.ic_decay.length);
  const horizons = withSignal[0]?.ic_decay.map((r) => r.horizon_days) ?? [];

  return (
    <>
      <div className="page-head">
        <Title>Signals</Title>
        <p>
          Does each signal predict returns before portfolio rules and costs are applied? If a signal predicts well but
          its backtest is poor, the trading rule usually needs work.
        </p>
      </div>

      <Card title="Information coefficient by horizon" help="Mean rank correlation between signal and forward return. Around 0.02 to 0.03 is meaningful for daily FX.">
        <BarChart
          label="Information coefficient by horizon for every strategy"
          format={(v) => v.toFixed(2)}
          groups={horizons.map((h) => ({
            label: `${h} days`,
            values: withSignal.map((r) => ({
              name: nameOf(r),
              color: colors[r.strategy],
              value: r.ic_decay.find((x) => x.horizon_days === h)?.mean_ic ?? null,
            })),
          }))}
        />
      </Card>

      <Card title="Table view" help="t-stats use overlapping returns for horizons above one day, so they overstate confidence.">
        <TableScroll>
          <table>
            <thead>
              <tr><th>Strategy</th>{horizons.map((h) => <th key={h}>IC {h}d</th>)}{horizons.map((h) => <th key={`t${h}`}>t-stat {h}d</th>)}</tr>
            </thead>
            <tbody>
              {withSignal.map((r) => (
                <tr key={r.strategy}>
                  <td><span className="swatch" style={{ background: colors[r.strategy] }} /><a href={`#/strategy/${r.strategy}`} title={taglineOf(r) || undefined}>{nameOf(r)}</a></td>
                  {r.ic_decay.map((x) => <td key={x.horizon_days}>{num(x.mean_ic, 3)}</td>)}
                  {r.ic_decay.map((x) => <td key={`t${x.horizon_days}`}>{num(x.ic_tstat, 1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </>
  );
}
