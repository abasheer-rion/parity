// The Pairs results (statistical arbitrage), shared by the research Pairs page and the
// Workbench's Pairs view: the recipes, best first, then the chosen recipe's wins and losses,
// costs, decay and breakdowns, then one pair's charts. Derived numbers only: a document with
// a price field is refused here too, not only when the file is read (src/lib/pairs.ts).
import { useMemo, type ReactNode } from "react";
import { useHashState } from "../../lib/deeplink";
import { date, num, pct, signedPct } from "../../lib/format";
import {
  costGrid, forRecipe, KIND_LABEL, pairName, points, positionSpans, priceFields, REGIME_LABEL, regimesOf, timeInMarket,
  valuesAllowed, VERDICT_LABEL, verdictTone, type Pair, type PairsDoc, type PairsRecipe,
} from "../../lib/pairs";
import { Badge, BarChart, DataTable, ErrorState, KeyValues, LineChart, Select, TableScroll, type Column, type RefLine } from "../../ui";
import "./pairs.css";

const RIGHTS_PLAIN: Record<string, string> = {
  public: "Values may be shown",
  internal: "Team only",
  research: "Research use only. Values are never shown",
  none: "Not used",
};

function NoData({ children = "Not enough data." }: { children?: ReactNode }) {
  return <p className="pr-none">{children}</p>;
}

/** A titled block with one plain line saying what it shows. */
function Block({ title, line, children, id, wide }: { title: string; line?: ReactNode; children: ReactNode; id?: string; wide?: boolean }) {
  return (
    <section className={`pr-card ${wide ? "pr-wide" : ""}`} aria-labelledby={id}>
      <h3 id={id} className="pr-h3">{title}</h3>
      {line && <p className="pr-line">{line}</p>}
      {children}
    </section>
  );
}

const chance = (v: number | null) => (v == null ? "n/a" : pct(v, 0));
const tests = (r: PairsRecipe) => (r.tests_passed == null || r.tests_total == null ? "n/a" : `${r.tests_passed} of ${r.tests_total}`);
const count = (v: number | null) => (v == null ? "n/a" : Math.round(v).toLocaleString("en-US"));

export function PairsReport({ doc, heading = 2 }: { doc: PairsDoc; heading?: 2 | 3 }) {
  // The no-prices rule, checked again on what is about to be drawn.
  const leaks = useMemo(() => priceFields(doc), [doc]);
  const [recipeId, setRecipe] = useHashState("recipe");
  const [pairId, setPair] = useHashState("pair");

  if (leaks.length) {
    return <ErrorState title="These results cannot be shown">They contain price fields ({leaks.slice(0, 3).join(", ")}). Parity shows only numbers computed from prices.</ErrorState>;
  }

  const recipe = doc.leaderboard.find((r) => r.id === recipeId) ?? doc.leaderboard[0] ?? null;
  const recipePairs = recipe ? doc.pairs.filter((p) => p.recipe === recipe.id) : doc.pairs;
  const pair = recipePairs.find((p) => p.id === pairId) ?? recipePairs[0] ?? null;
  const methodName = (id: string) => doc.methods.find((m) => m.id === id)?.name ?? id;
  const H = `h${heading}` as "h2" | "h3";

  const columns: Column<PairsRecipe>[] = [
    { key: "name", header: "Recipe", align: "left", sort: (r) => r.name, render: (r) => (
      <span className="pr-cell2">
        <button type="button" className="pr-pick" aria-current={recipe?.id === r.id ? "true" : undefined} onClick={() => { setRecipe(r.id); setPair(""); }}>{r.name}</button>
        <span className="pr-dim">{methodName(r.method)}{r.universe ? `, ${r.universe}` : ""}</span>
      </span>
    ) },
    { key: "sharpe", header: "Sharpe", sort: (r) => r.sharpe ?? -Infinity, render: (r) => num(r.sharpe) },
    { key: "dsr", header: "Chance it is not luck", sort: (r) => r.deflated_sharpe ?? -Infinity, render: (r) => chance(r.deflated_sharpe) },
    { key: "trials", header: "Tries counted", sort: (r) => r.trials ?? -Infinity, render: (r) => count(r.trials) },
    { key: "verdict", header: "Verdict", align: "left", sort: (r) => r.verdict ?? "", render: (r) => (
      <Badge tone={verdictTone(r.verdict)}>{r.verdict ? VERDICT_LABEL[r.verdict] ?? r.verdict : "Not judged"}</Badge>
    ) },
    { key: "tests", header: "Tests passed", sort: (r) => r.tests_passed ?? -Infinity, render: tests },
  ];

  return (
    <div className="pr">
      <section className="pr-card pr-intro" aria-labelledby="pr-intro-h">
        <H id="pr-intro-h" className="pr-h2">How pairs trading works here</H>
        <p className="pr-line">Two related markets usually move together. When the gap between them grows unusually wide, a pairs trade buys one and sells the other, and wins if the gap closes.</p>
        <dl className="pr-stats">
          <div><dt>Recipes</dt><dd>{doc.leaderboard.length}</dd></div>
          <div><dt>Tries counted</dt><dd>{count(doc.trials.total)}</dd></div>
          <div><dt>Pairs shown</dt><dd>{doc.pairs.length}</dd></div>
          <div><dt>Data</dt><dd className="pr-dd-sm">{doc.data.start && doc.data.end ? `${doc.data.start} to ${doc.data.end}` : "n/a"}</dd></div>
        </dl>
        {doc.methods.length > 0 && (
          <ul className="pr-methods">
            {doc.methods.map((m) => <li key={m.id}><strong>{m.name}.</strong> {m.plain ?? ""}</li>)}
          </ul>
        )}
      </section>

      <section className="pr-card" aria-labelledby="pr-board-h">
        <H id="pr-board-h" className="pr-h2">Recipes, best first</H>
        <p className="pr-line">Chance it is not luck is the deflated Sharpe ratio. It counts every try, so more tries make it harder to pass. Pick a recipe to see its details.</p>
        <DataTable rows={doc.leaderboard} columns={columns} rowKey={(r) => r.id} dense caption="Pairs recipes" initialSort={{ key: "dsr", dir: "desc" }} empty="No recipes have been tested yet." />
      </section>

      {recipe ? <RecipeDetail doc={doc} recipe={recipe} H={H} /> : <NoData>No recipe to show yet.</NoData>}

      <section className="pr-card" aria-labelledby="pr-pair-h">
        <div className="pr-head">
          <H id="pr-pair-h" className="pr-h2">{pair ? pairName(pair) : "Pairs"}</H>
          {recipePairs.length > 1 && (
            <Select label="Pair" value={pair?.id ?? ""} onChange={setPair} options={recipePairs.map((p) => [p.id, pairName(p)] as [string, string])} />
          )}
        </div>
        {pair ? <PairDetail pair={pair} /> : <NoData>{recipe ? "This recipe has no pairs to show." : "No pairs to show."}</NoData>}
      </section>

      <section className="pr-card" aria-labelledby="pr-src-h">
        <H id="pr-src-h" className="pr-h2">Data sources</H>
        <p className="pr-line">Every page here shows results computed from the data, never the prices themselves.</p>
        {doc.data.sources.length ? (
          <ul className="pr-sources">
            {doc.data.sources.map((s) => (
              <li key={s.id}>
                <strong>{s.terms_url ? <a href={s.terms_url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</strong>
                <span className="pr-dim">{RIGHTS_PLAIN[s.rights] ?? s.rights}. {s.licence ?? ""}</span>
              </li>
            ))}
          </ul>
        ) : <NoData />}
        <p className="pr-dim pr-foot">Generated {date(doc.generated_at)}{doc.git_sha ? ` from commit ${doc.git_sha.slice(0, 10)}` : ""}.</p>
      </section>
    </div>
  );
}

function RecipeDetail({ doc, recipe, H }: { doc: PairsDoc; recipe: PairsRecipe; H: "h2" | "h3" }) {
  const years = forRecipe(doc.by_year, recipe.id).sort((a, b) => a.year - b.year);
  const regimes = regimesOf(doc.by_regime, recipe.id);
  const breaks = forRecipe(doc.breakdowns, recipe.id).sort((a, b) => b.date.localeCompare(a.date));
  const decay = forRecipe(doc.decay, recipe.id);
  const grid = costGrid(doc.cost_sensitivity, recipe.id);
  const pairLabel = (id: string) => { const p = doc.pairs.find((x) => x.id === id); return p ? pairName(p) : id; };

  return (
    <section className="pr-recipe" aria-labelledby="pr-recipe-h">
      <div className="pr-card">
        <div className="pr-head">
          <H id="pr-recipe-h" className="pr-h2">{recipe.name}</H>
          <Badge tone={verdictTone(recipe.verdict)}>{recipe.verdict ? VERDICT_LABEL[recipe.verdict] ?? recipe.verdict : "Not judged"}</Badge>
        </div>
        {recipe.verdict_plain && <p className="pr-verdict">{recipe.verdict_plain}</p>}
        {recipe.description && <p className="pr-line">{recipe.description}</p>}
        <KeyValues cols={4} items={[
          ["Sharpe", num(recipe.sharpe)],
          ["Chance it is not luck", chance(recipe.deflated_sharpe)],
          ["Per year", signedPct(recipe.cagr)],
          ["Worst fall", pct(recipe.max_drawdown)],
          ["Trades", count(recipe.trades)],
          ["Trades that won", pct(recipe.win_rate, 0)],
          ["Average hold", recipe.avg_hold_days == null ? "n/a" : `${num(recipe.avg_hold_days, 1)} days`],
          ["Tests passed", tests(recipe)],
          ["Trading cost counted", recipe.cost_bps == null ? "n/a" : `${num(recipe.cost_bps, 0)} bp a trade`],
          ["Borrow fee counted", recipe.borrow_bps == null ? "n/a" : `${num(recipe.borrow_bps, 0)} bp a year`],
          ["Tries counted", count(recipe.trials)],
          ["Market", recipe.universe ?? "n/a"],
        ]} />
      </div>

      <div className="pr-grid">
        <Block title="Wins and losses by year" line="Return each calendar year after costs. Bars below zero are losing years.">
          {years.length ? (
            <>
              <BarChart groups={years.map((y) => ({ label: String(y.year), values: [{ name: "Return", color: "var(--series-1)", value: y.return }] }))}
                format={(v) => pct(v, 0)} label={`${recipe.name}: return by year`} height={200} />
              <details className="pr-details">
                <summary>Show the numbers</summary>
                <TableScroll label="Return, wins and losses by year">
                  <table className="mtable dense">
                    <caption className="sr-only">Return, wins and losses by year</caption>
                    <thead><tr><th scope="col" className="left">Year</th><th scope="col">Return</th><th scope="col">Wins</th><th scope="col">Losses</th></tr></thead>
                    <tbody>{years.map((y) => <tr key={y.year}><th scope="row" className="left">{y.year}</th><td>{signedPct(y.return)}</td><td>{count(y.wins)}</td><td>{count(y.losses)}</td></tr>)}</tbody>
                  </table>
                </TableScroll>
              </details>
            </>
          ) : <NoData />}
        </Block>

        <Block title="By market mood" line="Weeks sorted by how much markets swung: calm, nervous or stressed.">
          {regimes.length ? (
            <TableScroll label="Results by market mood">
              <table className="mtable dense">
                <caption className="sr-only">Results by market mood</caption>
                <thead><tr><th scope="col" className="left">Market</th><th scope="col">Return</th><th scope="col">Sharpe</th><th scope="col">Wins</th><th scope="col">Losses</th></tr></thead>
                <tbody>{regimes.map((r) => (
                  <tr key={r.regime}><th scope="row" className="left">{REGIME_LABEL[r.regime] ?? r.regime}</th><td>{signedPct(r.return)}</td><td>{num(r.sharpe)}</td><td>{count(r.wins)}</td><td>{count(r.losses)}</td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
          ) : <NoData />}
        </Block>

        <Block title="Decay" line="Sharpe ratio in each period. Shrinking bars mean the edge is fading.">
          {decay.length ? (
            <BarChart groups={decay.map((d) => ({ label: d.period, values: [{ name: "Sharpe", color: "var(--series-3)", value: d.sharpe }] }))}
              format={(v) => num(v, 1)} label={`${recipe.name}: Sharpe ratio by period`} height={200} />
          ) : <NoData />}
        </Block>
        <Block wide title="Costs" line="Sharpe ratio if trading or borrowing cost more. Down: cost per trade. Across: yearly fee to borrow the leg that is sold.">
          {grid.costs.length && grid.borrows.length ? (
            <TableScroll label="Sharpe ratio by trading cost and borrow fee">
              <table className="mtable dense pr-costs">
                <caption className="sr-only">Sharpe ratio by trading cost (rows) and borrow fee (columns)</caption>
                <thead><tr><th scope="col" className="left">Trade cost, borrow fee</th>{grid.borrows.map((b) => <th key={b} scope="col">{b} bp</th>)}</tr></thead>
                <tbody>{grid.costs.map((c) => (
                  <tr key={c}>
                    <th scope="row" className="left">{c} bp</th>
                    {grid.borrows.map((b) => {
                      const v = grid.at(c, b);
                      const used = c === recipe.cost_bps && b === recipe.borrow_bps;
                      return <td key={b} className={`${v == null ? "" : v >= 0 ? "good" : "bad"} ${used ? "pr-used" : ""}`}>{num(v)}{used && <span className="sr-only"> (the costs used above)</span>}</td>;
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </TableScroll>
          ) : <NoData />}
          {grid.costs.length > 0 && recipe.cost_bps != null && <p className="pr-dim pr-foot">The outlined cell is the cost used for the results above.</p>}
        </Block>

      </div>

      <Block title="Breakdowns" line="Trades closed early: a stop-out, the time limit, or the two stopped moving together.">
        {breaks.length ? (
          <TableScroll label="Breakdowns">
            <table className="mtable dense">
              <caption className="sr-only">Breakdowns, newest first</caption>
              <thead><tr><th scope="col" className="left">Date</th><th scope="col" className="left">Pair</th><th scope="col" className="left">What happened</th><th scope="col">Gap at exit</th><th scope="col">Return</th></tr></thead>
              <tbody>{breaks.map((b, i) => (
                <tr key={`${b.date}:${b.pair}:${i}`}>
                  <th scope="row" className="left">{b.date}</th>
                  <td className="left">{pairLabel(b.pair)}</td>
                  <td className="left">{KIND_LABEL[b.kind] ?? b.kind}</td>
                  <td>{b.z_at_exit == null ? "n/a" : `${num(b.z_at_exit, 1)} sd`}</td>
                  <td className={b.return == null ? "" : b.return >= 0 ? "good" : "bad"}>{signedPct(b.return)}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableScroll>
        ) : <NoData>No breakdowns recorded.</NoData>}
      </Block>
    </section>
  );
}

const BAND = { entry: "var(--color-warning)", exit: "var(--color-text-muted)", stop: "var(--color-negative)" };

function PairDetail({ pair }: { pair: Pair }) {
  const { dates } = pair.series;
  const z = points(dates, pair.series.z);
  const hedge = points(dates, pair.series.hedge);
  const pv = points(dates, pair.series.pvalue);
  const hl = points(dates, pair.series.halflife);
  const spans = positionSpans(dates, pair.series.position);
  const inMarket = timeInMarket(pair.series.position);
  const refs: RefLine[] = [];
  const band = (v: number | null, name: string, color: string, dashed: boolean) => {
    if (v == null) return;
    refs.push({ value: v, name: `${name} (upper)`, color, dashed }, { value: -v, name: `${name} (lower)`, color, dashed });
  };
  band(pair.entry, "Entry", BAND.entry, false);
  band(pair.exit, "Exit", BAND.exit, true);
  band(pair.stop, "Stop", BAND.stop, false);
  const r = pair.results;
  const st = pair.stats;

  return (
    <div className="pr-pair">
      <p className="pr-line">
        {pair.group ? `${pair.group}. ` : ""}
        {valuesAllowed(pair.rights) ? "Results computed from the two series." : "The source allows research use only, so only results computed from it are shown."}
      </p>
      <KeyValues cols={4} items={[
        ["Sharpe", num(r.sharpe)],
        ["Total return", signedPct(r.total_return)],
        ["Trades", count(r.trades)],
        ["Won and lost", r.wins == null || r.losses == null ? "n/a" : `${r.wins} won, ${r.losses} lost`],
        ["Fluke chance now", num(st.pvalue_now, 3)],
        ["Half-life now", st.halflife_now == null ? "n/a" : `${num(st.halflife_now, 1)} days`],
        ["Hedge ratio now", num(st.hedge_now)],
        ["Moves alike", num(st.correlation)],
        ["Johansen test", st.johansen_trace == null ? "n/a" : `${num(st.johansen_trace, 1)} (needs ${num(st.johansen_5pct, 1)})`],
        ["Weeks in a trade", pct(inMarket, 0)],
      ]} />

      <div className="pr-grid">
        <Block title="The gap, in standard deviations" line="A trade opens past the entry line, closes inside the exit line and gives up past the stop line. Shaded weeks had a trade open.">
          {z.length ? (
            <>
              <LineChart series={[{ name: "Gap (z-score)", color: "var(--series-1)", points: z, emphasis: true }]} refs={refs}
                shade={spans.map((s) => ({ from: s.from, to: s.to, color: s.side > 0 ? "var(--color-positive-soft)" : "var(--color-negative-soft)" }))}
                shadeNote="Weeks with a trade open" format={(v) => num(v, 1)} label={`${pairName(pair)}: the gap in standard deviations`} height={260} />
              <ul className="pr-key" aria-label="Chart key">
                {pair.entry != null && <li><i className="pr-k-line" style={{ borderColor: BAND.entry }} />Entry at {num(pair.entry, 1)}</li>}
                {pair.exit != null && <li><i className="pr-k-line pr-k-dash" style={{ borderColor: BAND.exit }} />Exit at {num(pair.exit, 1)}</li>}
                {pair.stop != null && <li><i className="pr-k-line" style={{ borderColor: BAND.stop }} />Stop at {num(pair.stop, 1)}</li>}
                <li><i className="pr-k-box pr-k-long" />Bought the gap</li>
                <li><i className="pr-k-box pr-k-short" />Sold the gap</li>
              </ul>
            </>
          ) : <NoData />}
        </Block>
        <Block title="Hedge ratio" line={`How much of ${pair.label_b} balances one unit of ${pair.label_a}.`}>
          {hedge.length ? <LineChart series={[{ name: "Hedge ratio", color: "var(--series-2)", points: hedge }]} format={(v) => num(v)} label={`${pairName(pair)}: hedge ratio over time`} height={220} /> : <NoData />}
        </Block>
        <Block title="Fluke chance (p-value)" line="The chance the tie between the two is a fluke. Under the 0.05 line the pair counts as tied.">
          {pv.length ? <LineChart series={[{ name: "p-value", color: "var(--series-7)", points: pv }]} refs={[{ value: 0.05, name: "0.05 line", color: "var(--color-warning)", dashed: true }]}
            format={(v) => num(v, 2)} label={`${pairName(pair)}: cointegration p-value over time`} height={220} /> : <NoData />}
        </Block>
        <Block title="Half-life" line="How many days a gap usually takes to close by half. Shorter means quicker trades.">
          {hl.length ? <LineChart series={[{ name: "Half-life in days", color: "var(--series-3)", points: hl }]} format={(v) => num(v, 0)} label={`${pairName(pair)}: half-life over time`} height={220} /> : <NoData />}
        </Block>
      </div>
    </div>
  );
}
