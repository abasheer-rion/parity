// The report's pictures as signature chart visuals (DEC-0067, DEC-0089), built only from the
// report's own data, so a shared link, the PDF and the live page draw the same thing. Each
// picture is a few steps with a caption, ending on a verdict line from its numbers.
import { deflatedSharpeFrom, LUCK_LINE, MAX_TRIES } from "../dsr";
import type { SigStep, SigVisual } from "../../../ui/signature";
import type { ReportData } from "./model";
import type { GroupFamily } from "./series";

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const x2 = (v: number) => `${v.toFixed(Math.abs(v) >= 10 ? 0 : 2)}x`;
const pctT = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const money = (v: number) => `${v < 0 ? "-" : ""}${Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(2)}`;
const compact = (n: number) => (n >= 1e9 ? `${Math.round(n / 1e9)}bn` : n >= 1e6 ? `${Math.round(n / 1e6)}m` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

/** The record's value over time, next to the benchmark when there is one. */
export function growthVisual(d: ReportData): SigVisual | null {
  const c = d.curve;
  if (!c || c.dates.length < 2) return null;
  const labels = c.dates.map((x) => x.slice(0, 7));
  const growth = c.unit === "growth";
  const hasBench = growth && !!c.bench && c.bench.some((v) => v != null) && !!c.benchName;
  const end = c.values[c.values.length - 1];
  const bEnd = hasBench ? [...c.bench!].reverse().find((v) => v != null) ?? null : null;
  const fmt = growth ? "x" : "money";
  const name = d.source === "strategy" ? d.what : "This record";
  const steps: SigStep[] = [
    { caption: growth ? `1 dollar in ${name.toLowerCase() === "this record" ? "this record" : name} from ${c.dates[0]}${hasBench ? `, next to the ${c.benchName}` : ""}.` : `Profit so far, in the account's money, from ${c.dates[0]}.`, to: 0.35 },
    { caption: growth ? "The whole record, after fees." : "Every closed trade, added up.", to: 1 },
    {
      caption: growth ? `It ended at ${x2(end)}${bEnd != null ? `, against ${x2(bEnd)} for the ${c.benchName}` : ""}.` : `It ended ${end >= 0 ? "up" : "down"} ${money(Math.abs(end))}.`,
      verdict: growth ? (bEnd == null ? `${x2(end)} over the record.` : end > bEnd ? `Ahead of the ${c.benchName}: ${x2(end)} against ${x2(bEnd)}.` : `Behind the ${c.benchName}: ${x2(end)} against ${x2(bEnd)}.`)
        : `${end >= 0 ? "Made" : "Lost"} ${money(Math.abs(end))} in all.`,
      tone: growth ? (bEnd == null ? (end >= 1 ? "pos" : "neg") : end > bEnd ? "pos" : "neg") : end >= 0 ? "pos" : "neg",
    },
  ];
  return {
    kind: "equity",
    alt: growth ? `Growth of 1 dollar from ${c.dates[0]} to ${c.dates[c.dates.length - 1]}${hasBench ? `, against the ${c.benchName}` : ""}. It ended at ${x2(end)}${bEnd != null ? ` against ${x2(bEnd)}` : ""}.`
      : `Profit so far from ${c.dates[0]} to ${c.dates[c.dates.length - 1]}, ending at ${money(end)}.`,
    params: {
      fmt, labels,
      series: [{ label: name, values: c.values.map(r4) }, ...(hasBench ? [{ label: c.benchName!, values: c.bench!.map((v) => (v == null ? null : r4(v))), role: "benchmark" }] : [])],
      headline: { label: growth ? "Growth of 1 dollar" : "Profit so far" },
    },
    steps,
  };
}

/** How far it stood below its last high, from the growth curve. */
export function underwaterVisual(d: ReportData): SigVisual | null {
  const c = d.curve;
  if (!c || c.unit !== "growth" || c.dates.length < 2) return null;
  let peak = -Infinity, worst = 0, worstAt = 0;
  c.values.forEach((v, i) => { peak = Math.max(peak, v); const dd = v / peak - 1; if (dd < worst) { worst = dd; worstAt = i; } });
  const exact = d.c2?.maxDrawdown;
  return {
    kind: "underwater",
    alt: `How far the record stood below its last high, from ${c.dates[0]} to ${c.dates[c.dates.length - 1]}. The deepest fall was ${pctT(exact != null ? -exact : worst)}${worst < 0 ? `, around ${c.dates[worstAt]}` : ""}.`,
    params: { values: c.values.map(r4), labels: c.dates.map((x) => x.slice(0, 7)), fmt: "x" },
    steps: [
      { caption: "The red area is how far it stood below its last high.", to: 1 },
      {
        caption: worst < 0 ? `The deepest fall: ${pctT(exact != null ? -exact : worst)}.` : "It never fell below a high.", to: 1, worst: true,
        verdict: worst < 0 ? `${pctT(exact != null ? -exact : worst)} at worst${d.c2?.longestUnderwaterDays != null ? `, ${d.c2.longestUnderwaterDays.toLocaleString("en-US")} days at most below a high` : ""}.` : "No fall from a high.",
        tone: worst < -0.5 ? "neg" : worst < 0 ? "warn" : "pos",
      },
    ],
  };
}

/** Where the record's result sits when it is reshuffled, with the 95% range. */
export function spreadVisual(d: ReportData): SigVisual | null {
  const sp = d.spread;
  if (!sp) return null;
  const sharpe = sp.what === "sharpe";
  const lo = sp.ci95?.[0], hi = sp.ci95?.[1];
  const above = lo != null && lo > 0;
  const fmt = sharpe ? "num2" : "money";
  const f = (v: number | null | undefined) => (v == null ? "n/a" : sharpe ? v.toFixed(2) : money(v));
  const what = sharpe ? "Sharpe ratio" : "profit per trade";
  return {
    kind: "distribution",
    alt: `The ${what} in each of ${sp.n.toLocaleString("en-US")} reshuffles of the record. 95% fall between ${f(lo)} and ${f(hi)}; the record itself is ${f(sp.point)}.`,
    params: {
      edges: sp.edges, counts: sp.counts, fmt, par: 0, parLabel: "Zero",
      marker: sp.point == null ? undefined : { value: sp.point, label: "This record", tone: "accent" },
      band: lo != null && hi != null ? { lo, hi, label: "95% of reshuffles" } : undefined,
      countLabel: "Reshuffles", beatLabel: "Of reshuffles below it", ends: { low: "Worse", high: "Better" },
    },
    steps: [
      { caption: sharpe ? `The record reshuffled ${sp.n.toLocaleString("en-US")} times in ${sp.block}-day blocks. Each bar counts the Sharpe ratios that landed there.` : `The trades drawn again at random ${sp.n.toLocaleString("en-US")} times. Each bar counts the average profit per trade that came out.`, grow: 1 },
      { caption: "95 of every 100 reshuffles land inside the shaded range.", band: 1 },
      { caption: "The record's own result.", marker: 1 },
      { caption: above ? "The whole range sits above zero." : "The range reaches zero, so no edge at all is still possible.", verdict: above ? `${sharpe ? "Sharpe" : "Per trade"} between ${f(lo)} and ${f(hi)}: above zero.` : `${sharpe ? "Sharpe" : "Per trade"} between ${f(lo)} and ${f(hi)}: zero is inside.`, tone: above ? "pos" : "warn" },
    ],
  };
}

/** Points from 1 try to a billion, four a decade, for the luck check drawn against tries. */
export function triesGrid(max = MAX_TRIES): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const n = Math.round(10 ** (i / 4));
    if (n > max) break;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** The luck check at every number of tries, with the record's stated tries marked. */
export function luckVisual(d: ReportData): SigVisual | null {
  const m = d.c3?.moments;
  if (!m || !d.c3) return null;
  const grid = triesGrid();
  const values = grid.map((n) => r4(deflatedSharpeFrom(m, n)));
  const stated = Math.max(1, d.c3.tries);
  const at = (n: number) => Math.log10(Math.max(1, n)) / Math.log10(grid[grid.length - 1]);
  const surv = d.c3.survives ?? 0;
  const one = values[0];
  const pass = (d.c3.dsr ?? 0) >= LUCK_LINE;
  const triesWord = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "try" : "tries"}`;
  return {
    kind: "equity",
    alt: `The luck check against the number of tries, from 1 to 1 billion. As the only try it is ${pctT(one, 0)}. At the ${triesWord(stated)} counted it is ${pctT(d.c3.dsr ?? 0, 0)}; 95% is the line. ${surv >= MAX_TRIES ? "It stays above the line for over a billion tries" : surv > 0 ? `It stays above the line up to ${triesWord(surv)}` : "It is below the line even as the only try"}.`,
    params: {
      fmt: "pct", labels: grid.map(compact), par: LUCK_LINE,
      series: [{ label: "Luck check", values }],
      headline: { label: "Chance it is more than luck" },
    },
    steps: [
      { caption: `As the only thing tried, the luck check is ${pctT(one, 0)}.`, to: 0.02, par: LUCK_LINE, parLabel: "95% needed" },
      { caption: "Each extra try raises the bar a lucky result has to clear, so the check falls.", to: 1 },
      {
        caption: `At the ${triesWord(stated)} counted it is ${pctT(d.c3.dsr ?? 0, 0)}.`, to: 1,
        callouts: [{ at: at(stated), label: `${triesWord(stated)} counted` }],
        bands: surv > 0 ? [{ from: 0, to: Math.min(1, at(surv)), label: "Above the line", tone: "pos" }] : [],
        title: `${pctT(d.c3.dsr ?? 0, 0)} at ${triesWord(stated)}`, sub: "Chance it is more than luck, after the tries counted",
        verdict: surv >= MAX_TRIES ? "Survives more than 1 billion tries." : surv > 0 ? `Survives up to ${triesWord(surv)}.` : "Below the line even as the only try.",
        tone: pass ? "pos" : "neg",
      },
    ],
  };
}

const famVisual = (fams: GroupFamily[], unit: "return" | "money", hasBench: boolean): SigVisual | null => {
  const use = fams.filter((f) => f.unit === unit && f.items.length);
  if (!use.length) return null;
  const items = use.flatMap((f) => f.items.map((i) => ({ label: i.label, strategy: r4(i.value), ...(i.bench != null ? { benchmark: r4(i.bench) } : {}) })));
  const steps: SigStep[] = [];
  let n = 0;
  for (const f of use) { n += f.items.length; steps.push({ caption: `${f.title}${unit === "return" && f.family === "crises" ? ", as the total over each fall" : unit === "return" && f.family !== "years" ? ", as a return a year" : ""}.`, reveal: n }); }
  const wins = items.filter((i) => ("benchmark" in i ? i.strategy > (i.benchmark as number) : i.strategy > 0)).length;
  const best = items.reduce((a, b) => (b.strategy > a.strategy ? b : a));
  const worst = items.reduce((a, b) => (b.strategy < a.strategy ? b : a));
  const fm = unit === "money" ? money : (v: number) => `${v >= 0 ? "+" : ""}${pctT(v)}`;
  steps.push({ caption: `Best: ${best.label}, ${fm(best.strategy)}. Worst: ${worst.label}, ${fm(worst.strategy)}.`, highlight: items.indexOf(worst), verdict: `${hasBench ? "Beat the market" : "Made money"} in ${wins} of ${items.length}.`, tone: wins * 2 >= items.length ? "pos" : "neg" });
  return {
    kind: "regimes",
    alt: `${unit === "money" ? "Profit" : "Return"} in ${items.length} groups: ${use.map((f) => f.title.toLowerCase()).join(", ")}. It ${hasBench ? "beat the market" : "made money"} in ${wins} of ${items.length}.`,
    params: {
      fmt: unit === "money" ? "moneySigned" : "pctSigned", items,
      caption: unit === "money" ? "Profit in the account's money" : use.some((f) => f.family === "crises") ? "Return a year; crises show the total over the fall" : use.every((f) => f.family === "years") ? "Return each year" : "Return a year in each kind of market",
      label: hasBench ? "Groups where it beat the market" : "Groups where it made money",
    },
    steps,
  };
};

/** Where it made and lost money: one picture per unit (returns, then money). */
export function groupVisuals(d: ReportData): SigVisual[] {
  const fams = d.groups?.families ?? [];
  const hasBench = fams.some((f) => f.items.some((i) => i.bench != null));
  return [famVisual(fams, "return", hasBench), famVisual(fams, "money", false)].filter((v): v is SigVisual => !!v);
}

export interface ReportPictures {
  growth: SigVisual | null;
  underwater: SigVisual | null;
  spread: SigVisual | null;
  luck: SigVisual | null;
  groups: SigVisual[];
}

export function reportPictures(d: ReportData): ReportPictures {
  return { growth: growthVisual(d), underwater: underwaterVisual(d), spread: spreadVisual(d), luck: luckVisual(d), groups: groupVisuals(d) };
}
