// The strategies you follow: anything bookmarked from a strategy page.
import { Title } from "../components/Shell";
import { Sparkline } from "../ui/charts";
import { Badge, Button, EmptyState, TableScroll, TextButton } from "../ui";
import { colorMap } from "../lib/colors";
import { num, pct } from "../lib/format";
import { toggleBookmark, usePrefs } from "../lib/prefs";
import { nameOf, verdictOf } from "../lib/strategyMeta";
import type { Report } from "../lib/types";

export function Watchlist({ report }: { report: Report }) {
  const prefs = usePrefs();
  const colors = colorMap(report.runs);
  const ids = prefs.bookmarks.filter((b) => b.href.startsWith("#/strategy/")).map((b) => decodeURIComponent(b.href.slice(11)));
  const runs = report.runs.filter((r) => ids.includes(r.strategy));
  return (
    <>
      <div className="page-head">
        <Title>Watchlist</Title>
        <p className="page-purpose">The strategies you follow. Add one with the bookmark button next to its name.</p>
      </div>
      {runs.length === 0 ? (
        <EmptyState title="Nothing followed yet" icon="bookmark"
          action={<Button variant="accent" href="#/strategies">Find a strategy to follow</Button>}>
          Open a strategy and press the bookmark beside its name. It shows up here with its verdict and its worst fall.
        </EmptyState>
      ) : (
        <TableScroll>
          <table className="mtable">
            <thead><tr><th className="left">Strategy</th><th className="left">Since 1999</th><th>Per year</th><th>Sharpe</th><th>Worst fall</th><th className="left">Verdict</th><th /></tr></thead>
            <tbody>
              {runs.map((r) => {
                const v = verdictOf(r);
                return (
                  <tr key={r.strategy}>
                    <td className="left"><span className="acct-dot" style={{ background: colors[r.strategy] }} /> <a href={`#/strategy/${r.strategy}`}>{nameOf(r)}</a></td>
                    <td className="left"><Sparkline points={r.equity} /></td>
                    <td>{pct(r.metrics.cagr)}</td>
                    <td>{num(r.metrics.sharpe)}</td>
                    <td>{pct(r.metrics.max_drawdown)}</td>
                    <td className="left"><Badge tone={v.tone}>{v.label}</Badge></td>
                    <td><TextButton tone="muted" onClick={() => toggleBookmark(`#/strategy/${r.strategy}`, nameOf(r))}>Unfollow</TextButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </>
  );
}
