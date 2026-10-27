// "How it holds up" (DEC-0067): the same section on every strategy page, under a Verify
// result and in the Workbench comparison. It asks of one record what a careful reader
// would: did it beat the market, could it be luck, how wide are the error bars, what does
// it move with, where does it win and lose, how bad did it get, and what has to stay true.
// Every chart has a data table beside it (WCAG 1.1.1), and a missing input says why.
import { useId, useMemo, useState, type ReactNode } from "react";
import type { Holdup, HoldupRegimeFamily } from "../../lib/types";
import { Badge, Disclosure } from "../../ui";
import { SignaturePlayer, type SigVisual } from "../../ui/signature";
import { corrVisual, curves, equityVisual, rangeVisual, regimeVisual, underwaterVisual } from "./visuals";
import {
  corrSentence, dec, FAMILY_HELP, FAMILY_TITLE, int, luckSentence, mustText, pct, pSentence, pText, rangeSentence,
  reasonText, regimeSentence, signedPct, tries, verdictLine,
} from "./text";
import "./holdup.css";

export interface HoldupSectionProps {
  holdup: Holdup | null | undefined;
  /** The strategy or record's name, for chart labels. */
  name: string;
  bench?: string;
  /** The heading level of the section title (2 on a page, 3 inside a panel). */
  level?: 2 | 3;
  /** Short intro under the title; the default explains what the section does. */
  intro?: ReactNode;
  id?: string;
  /** What to say when there are no numbers (default: the record is too short). */
  missing?: string;
}

export function HoldupSection({ holdup: h, name, bench = "US stock market", level = 2, intro, id, missing }: HoldupSectionProps) {
  const titleId = useId();
  const benchName = h?.sources.benchmark.available ? bench : "";
  // One set of pictures per record: a new object would restart each player.
  const pics = useMemo(() => (h ? {
    equity: equityVisual(h, name, benchName), range: rangeVisual(h), corr: corrVisual(h),
    regimes: regimeVisual(h), under: underwaterVisual(h, name),
  } : null), [h, name, benchName]);
  const H = level === 2 ? "h2" : "h3";
  const Sub = level === 2 ? "h3" : "h4";
  if (!h) {
    return (
      <section className="hu" aria-labelledby={titleId} id={id}>
        <H id={titleId} className="hu-title">How it holds up</H>
        <p className="hu-empty">{missing ?? "These checks need at least 30 days of daily returns, and this record has fewer."}</p>
      </section>
    );
  }
  const v = verdictLine(h);
  return (
    <section className="hu" aria-labelledby={titleId} id={id}>
      <H id={titleId} className="hu-title">How it holds up</H>
      <p className="hu-intro">{intro ?? <>Seven checks on the same daily returns: the market, luck, error bars, what it moves with, where it wins and loses, its worst stretches and what has to stay true. {int(h.sources.strategy.n)} days from {h.sources.strategy.start} to {h.sources.strategy.end}.</>}</p>

      <div className={`hu-verdict hu-tone-${v.tone}`} role="note" aria-label="Summary">
        <strong>{v.title}</strong>
        <span>{v.text}</span>
      </div>

      <Block title="Against the market" Sub={Sub} lead={equitySentence(h, name, benchName)}>
        <Pic visual={pics?.equity} />
        <DataTable caption={`Growth of 1 dollar, ${name}${benchName ? ` and ${benchName}` : ""}, at the end of each year`}
          head={["Year end", name, ...(benchName ? [benchName] : [])]}
          rows={yearEnds(h).map((r) => [r.date, `${dec(r.s)}x`, ...(benchName ? [r.b == null ? "n/a" : `${dec(r.b)}x`] : [])])} />
      </Block>

      <Block title="Could it be luck?" Sub={Sub} lead={luckSentence(h)}>
        <dl className="hu-stats">
          <Stat label={`Luck check at ${tries(h.luck.n_trials)}`} value={h.luck.probability == null ? "n/a" : pct(h.luck.probability, 0)} note="95% needed" good={h.luck.probability == null ? null : h.luck.probability >= h.luck.line} />
          <Stat label="Luck check as the only try" value={h.luck.probability_one_try == null ? "n/a" : pct(h.luck.probability_one_try, 0)} />
          <Stat label="Sharpe ratio" value={dec(h.luck.sharpe)} />
          <Stat label={`p-value corrected for ${tries(h.p_values.n_trials)}`} value={pText(h.p_values.bonferroni)} note="under 0.05 needed" good={h.p_values.significant.bonferroni} />
        </dl>
        <p className="hu-text">{pSentence(h)}</p>
        <DataTable caption="The chance of a Sharpe this high from a strategy with no edge, before and after correcting for the number of tries"
          head={["Test", "p-value", "Below 0.05"]}
          rows={[
            ["On its own", pText(h.p_values.raw), yes(h.p_values.significant.raw)],
            [`Bonferroni, ${tries(h.p_values.n_trials)}`, pText(h.p_values.bonferroni), yes(h.p_values.significant.bonferroni)],
            [`Sidak, ${tries(h.p_values.n_trials)}`, pText(h.p_values.sidak), yes(h.p_values.significant.sidak)],
            ...(h.p_values.holm ?? []).map((x) => [`Holm across tests: ${HOLM_NAME[x.name] ?? x.name.replace(/_/g, " ")}`, pText(x.adjusted), yes(x.adjusted == null ? null : x.adjusted < 0.05)]),
          ]} />
      </Block>

      <Block title="How sure are the numbers?" Sub={Sub} lead={rangeSentence(h)}>
        {h.bootstrap ? (
          <>
            <Pic visual={pics?.range} />
            <DataTable caption={`Ranges from ${int(h.bootstrap.n)} reshuffles of the record in ${h.bootstrap.block_days}-day blocks`}
              head={["Number", "This record", "Middle", "80% range", "95% range"]}
              rows={[
                ["Sharpe ratio", dec(h.bootstrap.sharpe.point), dec(h.bootstrap.sharpe.median), range(h.bootstrap.sharpe.ci80, dec), range(h.bootstrap.sharpe.ci95, dec)],
                ["Return per year", pct(h.bootstrap.cagr.point), pct(h.bootstrap.cagr.median), range(h.bootstrap.cagr.ci80, pct), range(h.bootstrap.cagr.ci95, pct)],
                ["Share of reshuffles with a Sharpe above zero", pct(h.bootstrap.prob_sharpe_above_zero, 0), "", "", ""],
              ]} />
          </>
        ) : null}
      </Block>

      <Block title="What it moves with" Sub={Sub} lead={corrSentence(h)}>
        {h.rolling_correlation?.dates.length ? (
          <>
            <Pic visual={pics?.corr} />
            <DataTable caption="Correlation of daily returns over the past year, at the end of each year"
              head={["Year end", ...(["stocks", "bonds"] as const).filter((k) => h.rolling_correlation!.series[k]).map((k) => (k === "stocks" ? "With stocks" : "With bonds"))]}
              rows={corrYearEnds(h)} />
          </>
        ) : <Missing what="stock and bond series" codes={[h.sources.stocks, h.sources.bonds]} />}
      </Block>

      <Block title="Where it wins and where it loses" Sub={Sub} lead={regimeSentence(h)}>
        <Pic visual={pics?.regimes} />
        <RegimeFamilies h={h} name={name} bench={benchName} Sub={Sub} />
      </Block>

      <Block title="Worst stretches" Sub={Sub} lead={worstSentence(h)}>
        <Pic visual={pics?.under} />
        <DataTable caption="The five deepest falls from a high"
          head={["Fall", "From the high on", "Low on", "Back to the high on", "Days"]}
          rows={h.worst_periods.drawdowns.map((d) => [pct(d.depth), d.start, d.trough, d.recovery ?? "not yet", int(d.days)])} visible />
      </Block>

      <Block title="What has to stay true" Sub={Sub} lead="The result holds only while each of these does. A check that fails on past data is marked; the rest are conditions to watch.">
        <ul className="hu-must">
          {h.must_be_true.map((m) => (
            <li key={m.key}>
              <Badge tone={m.holds == null ? "neutral" : m.holds ? "good" : "bad"}>{m.holds == null ? "Watch" : m.holds ? "Holds" : "Fails"}</Badge>
              <span>{mustText(m)}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Disclosure summary="Where these numbers come from">
        <ul className="hu-sources">
          {(["strategy", "benchmark", "stocks", "bonds", "rates"] as const).map((k) => {
            const s = h.sources[k];
            return <li key={k}><strong>{SOURCE_LABEL[k]}:</strong> {s.available ? `${s.name ?? "given"}, ${s.start} to ${s.end}, ${int(s.n)} values.` : reasonText(s.reason)}</li>;
          })}
          <li><strong>Crises:</strong> {h.sources.crises.name === "built_in" ? `the ${h.sources.crises.n} named falls of the S&P 500 used across Parity.` : `${h.sources.crises.n} given periods.`}</li>
          <li>Every window and setting is fixed before any result is seen: one-year correlation windows, three-month volatility, one-month bootstrap blocks with a fixed seed.</li>
        </ul>
      </Disclosure>
    </section>
  );
}

const SOURCE_LABEL = { strategy: "Returns", benchmark: "Benchmark", stocks: "Stocks", bonds: "Bonds", rates: "Interest rate" } as const;
const HOLM_NAME: Record<string, string> = {
  sharpe_above_zero: "Sharpe above zero",
  placebo_timing: "random timing does worse",
  bootstrap_sharpe_above_zero: "reshuffled Sharpe above zero",
};

const yes = (b: boolean | null | undefined) => (b == null ? "n/a" : b ? "Yes" : "No");
const range = (r: [number | null, number | null] | null, fmt: (v: number | null) => string) => (r ? `${fmt(r[0])} to ${fmt(r[1])}` : "n/a");

function Block({ title, lead, children, Sub }: { title: string; lead: string; children?: ReactNode; Sub: "h3" | "h4" }) {
  return (
    <div className="hu-block">
      <Sub className="hu-block-title">{title}</Sub>
      <p className="hu-lead">{lead}</p>
      {children}
    </div>
  );
}

/** A signature chart (DEC-0067); the block's own data table is its text alternative. */
function Pic({ visual }: { visual: SigVisual | null | undefined }) {
  return visual ? <SignaturePlayer visual={visual} table={false} className="hu-pic" /> : null;
}

function Stat({ label, value, note, good }: { label: string; value: string; note?: string; good?: boolean | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={good == null ? "" : good ? "good" : "bad"}>{value}{note && <span className="hu-note"> {note}</span>}</dd>
    </div>
  );
}

/** A data table: shown under "Show the numbers" unless `visible`, always in the page for screen readers. */
export function DataTable({ caption, head, rows, visible }: { caption: string; head: string[]; rows: string[][]; visible?: boolean }) {
  const [open, setOpen] = useState(!!visible);
  const tableId = useId();
  if (!rows.length) return null;
  return (
    <div className="hu-table">
      {!visible && (
        <button type="button" className="hu-toggle" aria-expanded={open} aria-controls={tableId} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide the numbers" : "Show the numbers"}
        </button>
      )}
      {/* A wide table scrolls sideways inside its box; the box takes focus so keys can scroll it. */}
      <div id={tableId} className={open ? "hu-table-wrap" : "hu-table-wrap sr-only"} tabIndex={open ? 0 : undefined} role={open ? "region" : undefined} aria-label={open ? caption : undefined}>
        <table className="mtable">
          <caption className={visible ? "hu-caption" : "sr-only"}>{caption}</caption>
          <thead><tr>{head.map((x, i) => <th key={i} scope="col" className={i ? "" : "left"}>{x}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((x, j) => (j ? <td key={j}>{x}</td> : <th key={j} scope="row" className="left">{x}</th>))}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Missing({ what, codes }: { what: string; codes: { available: boolean; reason?: string }[] }) {
  const reasons = [...new Set(codes.filter((c) => !c.available).map((c) => reasonText(c.reason)))];
  return <p className="hu-empty">No {what} for this record. {reasons.join(" ")}</p>;
}

function RegimeFamilies({ h, name, bench, Sub }: { h: Holdup; name: string; bench: string; Sub: "h3" | "h4" }) {
  const Fam = Sub === "h3" ? "h4" : "h5";
  return (
    <div className="hu-families">
      {h.regimes.map((f) => (
        <div key={f.family} className="hu-family">
          <Fam className="hu-family-title">{FAMILY_TITLE[f.family]}</Fam>
          <p className="hu-small">{FAMILY_HELP[f.family]}</p>
          {f.available && f.items.length ? (
            <>
              <DataTable caption={`${FAMILY_TITLE[f.family]}: return per year in each period`} head={regimeHead(f, name, bench)} rows={regimeRows(f, bench)} />
            </>
          ) : <p className="hu-empty">{reasonText(f.reason)}</p>}
        </div>
      ))}
    </div>
  );
}

function regimeHead(f: HoldupRegimeFamily, name: string, bench: string): string[] {
  return ["Period", "Share of days", `${name} per year`, ...(bench ? [`${bench} per year`, "Beat it"] : []), ...(f.family === "crises" ? ["Total over the fall"] : [])];
}

function regimeRows(f: HoldupRegimeFamily, bench: string): string[][] {
  return f.items.map((i) => [
    i.start ? `${i.label} (${i.start} to ${i.end})` : i.label, pct(i.share, 0), pct(i.strategy_ann),
    ...(bench ? [pct(i.benchmark_ann), yes(i.wins)] : []),
    ...(f.family === "crises" ? [`${signedPct(i.strategy_total)}${bench && i.benchmark_total != null ? ` against ${signedPct(i.benchmark_total)}` : ""}`] : []),
  ]);
}

function equitySentence(h: Holdup, name: string, bench: string): string {
  const c = curves(h);
  const s = c.strategy.at(-1)?.[1], b = c.benchmark.at(-1)?.[1];
  if (s == null) return "No growth curve.";
  const start = c.strategy[0]?.[0]?.slice(0, 4);
  if (b == null || !bench) return `1 dollar in ${name} from ${start} grew to ${dec(s)} dollars. There is no benchmark to compare against.`;
  return `1 dollar in ${name} from ${start} grew to ${dec(s)} dollars, against ${dec(b)} in the ${bench}. It ${s > b ? "ended ahead" : "ended behind"}.`;
}

function worstSentence(h: Holdup): string {
  const w = h.worst_periods, d = w.drawdowns[0];
  const parts: string[] = [];
  if (d) parts.push(`The deepest fall was ${pct(d.depth)}, from ${d.start} to ${d.trough}, and ${d.recovery ? `took until ${d.recovery} to recover` : "it has not recovered yet"}.`);
  if (w.worst_year) parts.push(`The worst calendar year was ${w.worst_year.year} at ${pct(w.worst_year.return)}${w.worst_year.benchmark != null ? `, when the benchmark made ${pct(w.worst_year.benchmark)}` : ""}.`);
  if (w.worst_12m) parts.push(`The worst 12 months returned ${pct(w.worst_12m.return)}, ending ${w.worst_12m.end}.`);
  return parts.join(" ") || "Too short to measure.";
}

function yearEnds(h: Holdup): { date: string; s: number | null; b: number | null }[] {
  const e = h.equity_vs_benchmark;
  const out: { date: string; s: number | null; b: number | null }[] = [];
  e.dates.forEach((d, i) => {
    const last = i === e.dates.length - 1 || e.dates[i + 1].slice(0, 4) !== d.slice(0, 4);
    if (last) out.push({ date: d, s: e.strategy[i], b: e.benchmark?.[i] ?? null });
  });
  return out;
}

function corrYearEnds(h: Holdup): string[][] {
  const c = h.rolling_correlation!;
  const keys = (["stocks", "bonds"] as const).filter((k) => c.series[k]);
  return c.dates.flatMap((d, i) => {
    const last = i === c.dates.length - 1 || c.dates[i + 1].slice(0, 4) !== d.slice(0, 4);
    return last ? [[d, ...keys.map((k) => dec(c.series[k]![i]))]] : [];
  });
}
