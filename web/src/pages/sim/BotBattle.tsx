// Bot Battle (DEC-0035): seven trading-bot archetypes race on the same prices, on the
// shared stage (a big date, Play at 1x, 4x or 16x, a leaderboard that re-ranks). The
// point is one lesson: a high win rate is not profit. The board shows each bot's account,
// win rate and worst fall; the table under it shows every number behind them, and the
// formula card works out expectancy for the bot you follow. Everything is hypothetical.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, FilterChip, Select } from "../../ui";
import { loadBotRun, loadBotsIndex, type BotsLoaded } from "../../lib/bots";
import { expectancyLine, money, pctText, statsAt, weeksText, type BotRunFile, type BotsIndex, type LiveStats } from "../../lib/botStats";
import { RaceLines, type Lane } from "./play/RaceLines";
import { Board, leaderOf, Stage, type Band, type BoardRow } from "./play/Stage";
import { crisisBands, dayMonthYear, monthYear, yearTicks } from "./play/data";
import { usePlayback, WEEKLY } from "./play/usePlayback";
import { useWidth } from "./shared";

/** One colour per bot, fixed so a bot keeps its colour across markets and clips. */
export const BOT_COLORS: Record<string, string> = {
  martingale: "var(--series-4)", short_vol: "var(--series-3)", scalper: "var(--series-6)", trend: "var(--series-2)",
  grid: "var(--series-5)", mean_reversion: "var(--series-7)", buy_hold: "var(--series-1)",
};

const MARKET_LABEL: Record<string, string> = { stocks: "US stocks", EUR: "Euro", oil: "Oil" };

function useLoaded<T>(fn: () => Promise<BotsLoaded<T>>, key: string): BotsLoaded<T> | null {
  const [v, setV] = useState<BotsLoaded<T> | null>(null);
  useEffect(() => {
    let live = true;
    setV(null);
    fn().then((r) => { if (live) setV(r); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export function BotBattle() {
  const index = useLoaded(loadBotsIndex, "index");
  if (!index) return <p className="muted">Loading the bots</p>;
  if (index.status === "missing") return <EmptyState title="No Bot Battle data yet" icon="database">{index.message}</EmptyState>;
  if (index.status === "error") return <div className="error">{index.message}</div>;
  return <Battle index={index.data} />;
}

function Battle({ index }: { index: BotsIndex }) {
  const markets = index.runs.filter((r) => r.kind === "market");
  const paths = index.runs.filter((r) => r.kind === "synthetic");
  const [id, setId] = useState(() => markets.find((r) => r.id === "stocks-1928")?.id ?? index.runs[0]?.id ?? "");
  const brief = index.runs.find((r) => r.id === id);
  const synthetic = brief?.kind === "synthetic";
  const run = useLoaded(() => loadBotRun(id), id);

  return (
    <>
      <div className="sw2-card pb-picker">
        <div className="pb-picker-row">
          <span className="ui-field-label">Prices</span>
          <div className="chips" style={{ marginBottom: 0 }}>
            {markets.map((r) => <FilterChip key={r.id} label={`${MARKET_LABEL[r.market ?? ""] ?? r.label} from ${r.start.slice(0, 4)}`} active={r.id === id} onClick={() => setId(r.id)} />)}
            {paths.length > 0 && <FilterChip label="Made-up paths with crashes" active={synthetic} onClick={() => setId(paths[0].id)} />}
          </div>
        </div>
        {synthetic && (
          <div className="pb-picker-row">
            <Select<string> label="Made-up path" value={id} onChange={setId} options={paths.map((p) => [p.id, p.label] as [string, string])} />
            <Button size="sm" variant="secondary" icon="restart" onClick={() => setId(paths[(paths.findIndex((p) => p.id === id) + 1) % paths.length].id)}>Next path</Button>
            <span className="small muted">{brief?.crashes?.length ? `${brief.crashes.length} crash${brief.crashes.length === 1 ? "" : "es"} on this path` : "No crash on this path"}</span>
          </div>
        )}
        <p className="small" style={{ margin: 0 }}>
          <strong>Win rate is not profit.</strong> Seven simple bots start with the same hypothetical $10,000 on the same prices. Some win almost every trade and still lose; one wins less than half its trades and comes out ahead. Press Play and watch the leaderboard.
        </p>
      </div>
      {!run ? <div className="sw2-card bb-loading" aria-busy="true"><p className="muted">Loading the replay</p></div>
        : run.status !== "ok" ? <EmptyState title="This replay is missing" icon="database">{run.message}</EmptyState>
        : <Race key={id} index={index} run={run.data} />}
    </>
  );
}

function Race({ index, run }: { index: BotsIndex; run: BotRunFile }) {
  const synthetic = run.kind === "synthetic";
  const n = run.labels.length;
  const pb = usePlayback(n, WEEKLY, run.id);
  const [focus, setFocus] = useState<string | null>("martingale");
  const start = index.assumptions.start_cash;
  const bots = index.bots.filter((b) => run.runs[b.id]);

  const lanes: Lane[] = useMemo(() => bots.map((b) => ({
    key: b.id, label: b.name, color: BOT_COLORS[b.id] ?? "var(--series-8)",
    // Log scale: an account that hit zero is drawn along the floor at $10.
    values: run.runs[b.id].equity.map((v) => Math.max(10, v)),
  })), [bots, run]);

  const stats: Record<string, LiveStats> = Object.fromEntries(bots.map((b) => [b.id, statsAt(run.runs[b.id], pb.i, start)]));
  const rows: BoardRow[] = bots.map((b) => {
    const s = stats[b.id];
    return {
      key: b.id, label: b.name, color: BOT_COLORS[b.id], sort: s.equity, title: `${b.name}: ${b.style}`, bench: b.id === "buy_hold",
      cells: [
        <span className={s.stopped ? "down" : ""}>{s.stopped ? "stopped" : money(s.equity)}</span>,
        <span>{pctText(s.winRate)}</span>,
        <span className="down">{s.worst.toFixed(0)}%</span>,
      ],
    };
  });

  const [ref, width] = useWidth<HTMLDivElement>(240);
  const ticks = useMemo(() => synthetic
    ? Array.from({ length: Math.floor(Number(run.end)) }, (_, y) => ({ k: Math.round(((y + 1) * 252) / 5) - 1, label: `Yr ${y + 1}` })).filter((t) => t.k < n)
    : yearTicks(run.labels, width), [synthetic, run, width, n]);
  const bands: Band[] = useMemo(() => synthetic
    ? (run.crashes ?? []).map((c) => ({ label: `−${Math.round(c.depth * 100)}%`, a: c.frame, b: c.frame, title: `A made-up crash of ${Math.round(c.depth * 100)}%` }))
    : crisisBands(run.labels), [synthetic, run]);

  const label = run.labels[pb.i] ?? "";
  const big = synthetic ? `Year ${Number(label).toFixed(1)}` : monthYear(label);
  const sub = synthetic ? [run.label, "made-up prices"] : [dayMonthYear(label), `${run.label}`];
  const followed = focus ? bots.find((b) => b.id === focus) : undefined;

  return (
    <>
      <Stage pb={pb} label="Bot Battle" eyebrow="Bot Battle · $10,000 each · hypothetical" big={big} sub={sub}
        leading={leaderOf(rows)} bands={bands}
        startLabel={synthetic ? "Year 0" : monthYear(run.start)} endLabel={synthetic ? `Year ${run.end}` : monthYear(run.end)}
        valueText={(i) => (synthetic ? `Year ${Number(run.labels[i] ?? 0).toFixed(1)}` : dayMonthYear(run.labels[i] ?? ""))}
        honest={<>Hypothetical and educational, not investment advice. {synthetic ? "Made-up daily prices with calm spells, stressed spells and sudden crashes." : `Past daily prices: ${run.source}, ${run.start} to ${run.end}.`} Each bot trades daily on a plain rule, shown weekly here; $10,000 start, costs of 2 bp a side, no interest, a margin call past 10 times the account, and trades still open on the last day closed at the last close.</>}
        visual={
          <div ref={ref}>
            <RaceLines lanes={lanes} pos={pb.pos} end={pb.end} focus={focus} log baseline={start} format={(v) => money(v)} xTicks={ticks} bands={bands}
              label="Each bot's account, starting at $10,000, log scale" />
          </div>
        }
        board={<Board rows={rows} name="Bot" headers={["Account", "Win rate", "Worst fall"]} picked={focus} onPick={(k) => setFocus(focus === k ? null : k)} playing={pb.playing}
          caption="Win rate: share of closed trades that made money. Worst fall: the biggest drop from a high so far. Click a bot to follow it." />}
      />
      <div className="bb-grid">
        <Formula name={followed?.name ?? "Pick a bot"} s={focus ? stats[focus] : null} />
        <div className="sw2-card">
          <h2>Every number, as of {synthetic ? big.toLowerCase() : dayMonthYear(label)}</h2>
          <StatsTable bots={bots} stats={stats} focus={focus} onPick={setFocus} />
        </div>
      </div>
      <div className="sw2-card">
        <h2>The rules, in full</h2>
        <ul className="bb-rules">
          {bots.map((b) => (
            <li key={b.id}><span className="sw-dot" style={{ background: BOT_COLORS[b.id] }} /> <strong>{b.name}</strong> <span className="muted">({b.style})</span>. {b.rule}</li>
          ))}
        </ul>
      </div>
      {synthetic && <SyntheticSummary index={index} />}
    </>
  );
}

function Formula({ name, s }: { name: string; s: LiveStats | null }) {
  return (
    <div className="sw2-card bb-formula">
      <h2>Expectancy: what a trade is worth on average</h2>
      <p className="bb-eq"><span>Expectancy</span> = <span>win rate</span> × <span>average win</span> − <span>loss rate</span> × <span>average loss</span></p>
      <p className="small"><strong>{name}</strong>: {s ? expectancyLine(s) : "click a bot on the leaderboard."}</p>
      {s && s.winRate != null && (
        <p className="small muted">
          {s.expectancy != null && s.expectancy < 0
            ? `It wins ${pctText(s.winRate)} of its trades, but the average loss is ${s.avgWin > 0 ? `${(s.avgLoss / s.avgWin).toFixed(0)} times` : "far"} the average win, so each trade loses money on average.`
            : s.winRate < 0.5
              ? `It loses more often than it wins, but the average win is ${s.avgLoss > 0 ? `${(s.avgWin / s.avgLoss).toFixed(1)} times` : "far above"} the average loss.`
              : "A positive number means the wins have paid for the losses so far. One more large loss can change that."}
        </p>
      )}
    </div>
  );
}

function StatsTable({ bots, stats, focus, onPick }: { bots: BotsIndex["bots"]; stats: Record<string, LiveStats>; focus: string | null; onPick: (k: string) => void }) {
  const head: [string, string][] = [["Bot", ""], ["Trades", "Closed trades so far"], ["Win rate", "Share of closed trades that made money"], ["Avg win", "Average profit of a winning trade"], ["Avg loss", "Average loss of a losing trade"], ["Profit factor", "All wins divided by all losses; under 1 loses money"], ["Expectancy", "Average profit per trade"], ["Profit", "Account now minus the $10,000 start"], ["Worst fall", "Biggest drop from a high so far"], ["Under water", "Longest time below a previous high so far"]];
  const cell = (v: ReactNode, cls = "") => <td className={`num ${cls}`}>{v}</td>;
  return (
    <div className="ui-table-box bb-table">
      <table className="mtable dense">
        <thead><tr>{head.map(([h, t]) => <th key={h} title={t || undefined} className={h === "Bot" ? "" : "num"}>{h}</th>)}</tr></thead>
        <tbody>
          {bots.map((b) => {
            const s = stats[b.id];
            return (
              <tr key={b.id} className={focus === b.id ? "pinned" : ""} onClick={() => onPick(b.id)}>
                <td><span className="sw-dot" style={{ background: BOT_COLORS[b.id] }} /> {b.name}</td>
                {cell(s.trades.toLocaleString("en-US"))}
                {cell(pctText(s.winRate, 1))}
                {cell(money(s.avgWin))}
                {cell(money(s.avgLoss))}
                {cell(s.profitFactor == null ? "n/a" : s.profitFactor.toFixed(2), s.profitFactor != null && s.profitFactor < 1 ? "down" : "")}
                {cell(s.expectancy == null ? "n/a" : money(s.expectancy), s.expectancy != null && s.expectancy < 0 ? "down" : "up")}
                {cell(s.stopped ? "stopped" : money(s.pnl), s.pnl < 0 ? "down" : "up")}
                {cell(`${s.worst.toFixed(0)}%`, "down")}
                {cell(`${weeksText(s.underwaterWeeks)}${s.stillUnder && s.underwaterWeeks > 0 ? "*" : ""}`)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted bb-foot">* still below its high. Trades still open on the last day count only on the last frame. Figures are hypothetical.</p>
    </div>
  );
}

function SyntheticSummary({ index }: { index: BotsIndex }) {
  const s = index.synthetic;
  return (
    <div className="sw2-card">
      <h2>Across {s.paths} made-up paths of {s.years} years</h2>
      <p className="small muted">The same rules on {s.paths} different made-up futures, each starting at $10,000. A bot that looks safe on one path can fail on another.</p>
      <div className="ui-table-box bb-table">
        <table className="mtable dense">
          <thead><tr><th>Bot</th><th className="num">Typical win rate</th><th className="num">Ended ahead</th><th className="num">Stopped out</th><th className="num">Typical end</th><th className="num">Typical worst fall</th></tr></thead>
          <tbody>
            {index.bots.map((b) => {
              const r = s.summary[b.id];
              if (!r) return null;
              return (
                <tr key={b.id}>
                  <td><span className="sw-dot" style={{ background: BOT_COLORS[b.id] }} /> {b.name}</td>
                  <td className="num">{pctText(r.median_win_rate)}</td>
                  <td className="num">{r.ahead} of {r.paths}</td>
                  <td className={`num ${r.blown ? "down" : ""}`}>{r.blown}</td>
                  <td className="num">{money(r.median_final)}</td>
                  <td className="num down">{(r.median_max_drawdown * 100).toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">Typical means the median path. Simulated, not a forecast.</p>
    </div>
  );
}
