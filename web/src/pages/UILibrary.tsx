// The UI library gallery (#/ui). Every building block, live, with how to use it
// and the rules that go with it. Chart demos use made-up sample data, labelled so.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animate, Badge, BarChart, DrawIn, HeroGlow, LIFT, PageTransition, Reveal, Tilt, Button, ButtonGroup, Checkbox, CountUp, DataTable, Delta, Dialog, Divider, EmptyState, FilterBar, FilterChip,
  FanChart, Grid, Heading, HeroChart, Icon, ICON_NAMES, IconButton, Input, KeyValues, Kbd, Label, LineChart, Menu, Meter, Money, PageHeader, Panel,
  RollingNumber, SearchInput, Section, Segmented, Select, Separator, SettingsRow, ShareBar, Skeleton, Sparkline, Stat, Status, Tabs, Text,
  Toggle, Tooltip, fmt, toast, useFilters, type Column, type RangeKey,
  Accordion, AnimatedNumber, Collapse, Disclosure, Drawer, PageSkeleton, Popover, SkeletonCard, SkeletonChart, SkeletonStat, SkeletonTable,
  SkeletonText, Stagger, VirtualList,
} from "../ui";
import { usePrefs } from "../lib/prefs";
import type { Point } from "../lib/types";
import { RAW } from "../ui/tokens";

const SECTIONS: { group: string; items: [string, string][] }[] = [
  { group: "Foundations", items: [["overview", "Overview"], ["colors", "Colour"], ["type", "Type"], ["space", "Space, radius, depth"], ["motion", "Motion"], ["icons", "Icons"]] },
  { group: "Components", items: [["text", "Text and numbers"], ["buttons", "Buttons"], ["inputs", "Inputs"], ["filters", "Filters and sorting"], ["tables", "Tables"], ["lists", "Long lists"], ["expand", "Expand and collapse"], ["cards", "Cards and stats"], ["overlays", "Overlays"], ["feedback", "Empty and loading"]] },
  { group: "Charts", items: [["charts", "How charts work"], ["hero", "Headline chart"], ["line", "Line and bar"], ["chartcolor", "Chart colour"]] },
  { group: "Patterns", items: [["pages", "Page layouts"], ["steady", "Nothing jumps"], ["data", "Data that is ready"]] },
];

export function UILibrary({ section = "overview" }: { section?: string }) {
  return (
    <div className="gal">
      <nav className="gal-nav" aria-label="UI library">
        {SECTIONS.map((g) => (
          <div key={g.group}>
            <div className="side-label">{g.group}</div>
            {g.items.map(([id, label]) => <a key={id} href={`#/ui/${id}`} className={section === id ? "on" : ""}>{label}</a>)}
          </div>
        ))}
      </nav>
      <div>
        {section === "overview" && <Overview />}
        {section === "colors" && <Colors />}
        {section === "type" && <Type />}
        {section === "space" && <Space />}
        {section === "motion" && <Motion />}
        {section === "icons" && <Icons />}
        {section === "text" && <TextNumbers />}
        {section === "buttons" && <Buttons />}
        {section === "inputs" && <Inputs />}
        {section === "filters" && <Filters />}
        {section === "tables" && <Tables />}
        {section === "lists" && <Lists />}
        {section === "expand" && <Expand />}
        {section === "steady" && <Steady />}
        {section === "data" && <DataReady />}
        {section === "cards" && <Cards />}
        {section === "overlays" && <Overlays />}
        {section === "feedback" && <Feedback />}
        {section === "charts" && <HowCharts />}
        {section === "hero" && <Hero />}
        {section === "line" && <LineBar />}
        {section === "chartcolor" && <ChartColor />}
        {section === "pages" && <Pages />}
      </div>
    </div>
  );
}

function Item({ title, children, code, rules, intro, col }: { title: string; children: ReactNode; code?: string; rules?: string[]; intro?: ReactNode; col?: boolean }) {
  return (
    <section className="gal-item">
      <h2>{title}</h2>
      {intro && <p>{intro}</p>}
      <div className={`gal-demo ${col ? "col" : ""}`}>{children}</div>
      {code && <pre className="gal-code" tabIndex={0}>{code.trim()}</pre>}
      {rules && <ul className="gal-rules">{rules.map((r) => <li key={r}>{r}</li>)}</ul>}
    </section>
  );
}

// ---------- Sample data (not research results) ----------

function sample(seed: number, n = 1500, drift = 0.0003, vol = 0.011): Point[] {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: Point[] = [];
  let v = 1;
  const d = new Date("2020-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const z = Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
    v *= 1 + drift + vol * z;
    out.push([d.toISOString().slice(0, 10), v]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const SAMPLE_A = sample(7);
const SAMPLE_B = sample(11, 1500, 0.0002, 0.006);
const SAMPLE_C = sample(23, 1500, 0.00025, 0.008);

// ---------- Foundations ----------

function Overview() {
  return (
    <>
      <PageHeader eyebrow="Parity UI" title="UI library"
        description="Every piece the site is built from, shown live. Pages import from one place (web/src/ui), colours and sizes come from one file (tokens.css), and the rules below are the ones the site follows. The layout copies Mercury; the charts merge Mercury and Robinhood." />
      <Grid cols={3}>
        {SECTIONS.flatMap((g) => g.items).filter(([id]) => id !== "overview").map(([id, label]) => (
          <Panel key={id} title={label} actions={<IconButton icon="arrowUpRight" label={`Open ${label}`} href={`#/ui/${id}`} />}>
            <Text tone="secondary" size="sm">{BLURB[id]}</Text>
          </Panel>
        ))}
      </Grid>
    </>
  );
}

const BLURB: Record<string, string> = {
  colors: "Surfaces, text, accent, gain and loss, and the eight chart colours, read live from the site.",
  type: "Seven sizes on one scale. Numbers always line up.",
  space: "A 4px grid, five radii, three shadows.",
  motion: "Durations, curves, entrances, numbers, lift, tilt, draw-in, reveals, page transitions and the hero glow.",
  icons: "One 16px stroke set, drawn for this site.",
  text: "Headings, labels, money, percentages and signed changes.",
  buttons: "One primary per view; everything else stays quiet.",
  inputs: "Fields, search, selects, segmented choices, switches, tabs.",
  filters: "Mercury's chip toolbar and the hooks behind it.",
  tables: "One table component: sortable, linkable, rows that open in place, Mercury spacing.",
  lists: "Thousands of rows that scroll smoothly: a sticky header and only the visible rows drawn.",
  expand: "Collapse, Disclosure and Accordion: things that open in place without shoving the page.",
  steady: "The rules that keep a page from jumping while it loads, and how we measure it.",
  data: "Show the last copy at once and refresh it quietly; skeletons only on a first visit.",
  cards: "Cards, stats, key statistics, badges, status, meters.",
  overlays: "Tooltips, popovers, menus, dialogs, drawers, toasts and doc previews, each anchored to what opened it.",
  feedback: "What to show when there is nothing yet, and skeletons the size of what is coming.",
  charts: "The data shape, scales, hover and the rules every chart keeps.",
  hero: "The big value, coloured change, range tabs and scrubbing.",
  line: "Multi-series lines and grouped bars with a dotted background.",
  chartcolor: "The validator's results and what they oblige us to do.",
  pages: "Home, list, detail and settings layouts.",
};

function useVars(names: string[]) {
  const prefs = usePrefs();
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const t = window.setTimeout(() => {
      const cs = getComputedStyle(document.documentElement);
      setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()])));
    }, 30);
    return () => window.clearTimeout(t);
  }, [prefs.theme, names.join()]);
  return vals;
}

function toRgba(color: string): [number, number, number, number] | null {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return null;
  c.fillStyle = RAW["palette-black"]; c.fillStyle = color;
  const v = c.fillStyle;
  if (v.startsWith("#")) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1] : null;
}

function contrast(fg: string, bg: string): number | null {
  const a = toRgba(fg), b = toRgba(bg);
  if (!a || !b) return null;
  const mix = a.slice(0, 3).map((x, i) => x * a[3] + b[i] * (1 - a[3]));
  const lum = (rgb: number[]) => {
    const [r, g, bl] = rgb.map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const l1 = lum(mix), l2 = lum(b.slice(0, 3));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const COLOR_GROUPS: [string, [string, string][]][] = [
  ["Surfaces", [["--canvas", "Page background"], ["--bg", "Sunken areas, code"], ["--surface", "Cards"], ["--surface-solid", "Menus, dialogs"], ["--hover", "Hover and quiet fills"], ["--border", "Hairlines"], ["--border-2", "Control borders"]]],
  ["Text", [["--text", "Primary text and values"], ["--text-2", "Labels"], ["--muted", "Meta and hints"], ["--link", "Links"]]],
  ["Accent and state", [["--accent", "Primary action, selection"], ["--accent-soft", "Selected fills"], ["--good", "Gain, pass"], ["--bad", "Loss, fail"], ["--benchmark", "The market line"]]],
  ["Chart series (fixed order)", [1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`--series-${i}`, `Series ${i}`] as [string, string])],
];

function Colors() {
  const names = COLOR_GROUPS.flatMap(([, list]) => list.map(([n]) => n));
  const vals = useVars(names);
  return (
    <>
      <PageHeader title="Colour" description="Read live from the site. Parity is dark only, so these are the values every page uses. Contrast is measured against the page background." />
      {COLOR_GROUPS.map(([group, list]) => (
        <Item key={group} title={group}>
          <div className="swatches">
            {list.map(([n, label]) => {
              const c = vals[n] && vals["--canvas"] ? contrast(vals[n], vals["--canvas"]) : null;
              return (
                <div key={n} className="swatch-card">
                  <i style={{ background: `var(${n})` }} />
                  <div><div>{label}</div><code>{n}</code><br /><code>{vals[n]}</code>{c && group !== "Surfaces" && <><br /><code>{c.toFixed(1)}:1</code></>}</div>
                </div>
              );
            })}
          </div>
        </Item>
      ))}
      <ul className="gal-rules">
        <li>Accent is for the one primary action on a view and for selected states. Never for data.</li>
        <li>Gain and loss colours always come with a sign or an arrow (see Chart colour for why).</li>
        <li>Chart colours are given to strategies in a fixed order by name, so a strategy keeps its colour on every page.</li>
      </ul>
    </>
  );
}

function Type() {
  const sizes: [string, string][] = [["3xl", "36 / 42 headline values"], ["2xl", "28 / 36 page titles"], ["xl", "22 / 28 section titles"], ["lg", "16 / 26 lead text"], ["md", "15 / 24 body and tables"], ["sm", "13 / 20 labels"], ["xs", "12 / 18 meta, axis labels"]];
  return (
    <>
      <PageHeader title="Type" description="The system font, one scale, two weights in practice (400 and 500, 600 for emphasis). Numbers use tabular figures everywhere so columns line up." />
      <Item title="Scale" col>
        {sizes.map(([s, note]) => <div key={s} className="scale-row"><code>--fs-{s}</code><span className={`ui-fs-${s}`}>Currency carry beats cash</span><span className="muted small">{note}</span></div>)}
      </Item>
      <Item title="Headings" col code={`<Heading level={1}>Strategies</Heading>\n<Heading level={2}>Key statistics</Heading>`}>
        <Heading level={1}>Heading level 1</Heading>
        <Heading level={2}>Heading level 2</Heading>
        <Heading level={3}>Heading level 3</Heading>
        <Heading level={4}>Heading level 4</Heading>
      </Item>
      <Item title="Text tones" code={`<Text tone="secondary" size="sm">A label</Text>`}>
        {(["default", "secondary", "muted", "accent", "good", "bad"] as const).map((t) => <Text key={t} tone={t} as="span">{t}</Text>)}
        <Text as="span" mono>monospace</Text>
      </Item>
    </>
  );
}

function Space() {
  return (
    <>
      <PageHeader title="Space, radius, depth" description="Everything sits on a 4px grid. Corners get rounder as things get bigger: chips 8, cards 14, buttons fully round." />
      <Item title="Space" col>
        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <div key={n} className="scale-row"><code>--space-{n}</code><span className="space-bar" style={{ width: `var(--space-${n})` }} /><span className="muted small">{n * 4}px</span></div>)}
      </Item>
      <Item title="Radius">
        {["sm", "md", "lg", "xl", "pill"].map((r) => <div key={r} className="radius-box" style={{ borderRadius: `var(--radius-${r})` }}>{r}</div>)}
      </Item>
      <Item title="Depth">
        {[1, 2, 3].map((n) => <div key={n} className="radius-box" style={{ boxShadow: `var(--shadow-${n})`, background: "var(--surface-solid)" }}>shadow-{n}</div>)}
      </Item>
    </>
  );
}

function Motion() {
  const [k, setK] = useState(0);
  const [n, setN] = useState(27970.51);
  return (
    <>
      <PageHeader title="Motion" description="Short and quiet. Motion explains a change (something arriving, a number updating, a panel opening) or shows that something can be touched. The only loop in the app is the hero glow, slow and faint. Nothing flashes. Everything stops for people whose system asks for reduced motion (DEC-0017)." />
      <Item title="Durations and curves" col>
        {[["--dur-1", "90ms", "hover, press"], ["--dur-2", "160ms", "menus, toggles, fades"], ["--dur-3", "240ms", "entrances, dialogs"], ["--dur-4", "400ms", "rolling numbers, bars filling"]].map(([v, ms, use]) => (
          <div key={v} className="scale-row"><code>{v}</code><span>{ms}</span><span className="muted small">{use}</span></div>
        ))}
        {[["--ease-out", "most things"], ["--ease-in-out", "things that move and stop"], ["--ease-spring", "small pops: switches, menus"]].map(([v, use]) => (
          <div key={v} className="scale-row"><code>{v}</code><span className="muted small">{use}</span></div>
        ))}
      </Item>
      <Item title="Entrances" code={`<Animate type="rise" delay={40}>…</Animate>`}>
        <div key={k} style={{ display: "flex", gap: 12 }}>
          {(["fade", "rise", "pop", "slide"] as const).map((t, i) => <Animate key={t} type={t} delay={i * 60}><div className="motion-box">{t}</div></Animate>)}
        </div>
        <Button size="sm" onClick={() => setK((x) => x + 1)} icon="sparkle">Replay</Button>
      </Item>
      <Item title="Rolling number" intro="Mercury's digit roll, for a value that changes while you watch." code={`<RollingNumber text="$27,970.51" />`}>
        <span className="ui-fs-3xl"><RollingNumber text={`$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} /></span>
        <Button size="sm" onClick={() => setN(10000 + Math.random() * 90000)}>Change value</Button>
      </Item>
      <Item title="Count up" intro="Once, for a single headline number. Never in tables." code={`<CountUp value={0.43} format={(v) => v.toFixed(2)} />`}>
        <span className="ui-fs-3xl" key={k}><CountUp value={109525.6} format={(v) => `$${Math.round(v).toLocaleString()}`} /></span>
      </Item>
      <Item title="Animated number" intro="Glides from the old value to the new one when it changes, such as a total after a filter. Its width holds at the longer of the two values, so the words beside it never move."
        code={`<AnimatedNumber value={total} format={(v) => Math.round(v).toLocaleString()} />`}
        rules={["For a value that changes while someone watches. Not for the first paint (use the number) or tables (just change it).", "Under half a second. Reduced motion changes it at once."]}>
        <span className="ui-fs-2xl"><AnimatedNumber value={n} format={(v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} /></span>
        <span className="muted small">stays put</span>
        <Button size="sm" onClick={() => setN(Math.random() < 0.5 ? 900 + Math.random() * 90 : 10000 + Math.random() * 90000)}>Change value</Button>
      </Item>
      <Item title="Stagger" intro="A list's first paint: each child rises in 30ms after the one before, all started within 240ms."
        code={`<Stagger className="ui-grid ui-grid-3">{cards}</Stagger>\n// or on an element you already have: className={STAGGER}`}
        rules={["Only on a list's first appearance. Never when it re-sorts or filters (that is FLIP's job, see Tables).", "Children animate with transforms only, so the layout is final from the first frame."]}>
        <Stagger key={k} className="ui-grid ui-grid-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="motion-box" style={{ width: "100%" }}>{i}</div>)}</Stagger>
        <Button size="sm" onClick={() => setK((x) => x + 1)} icon="sparkle">Replay</Button>
      </Item>
      <Item title="Lift on hover" intro="A card rises 3px and gains a shadow, so it reads as something you can open." code={`<section className={\`pcard \${LIFT}\`}>…</section>`}
        rules={["For cards that open something. Not for cards that only hold text.", "Never combine with Tilt on the same element."]}>
        {["Watchlist", "Worth a look", "What if"].map((t) => <div key={t} className={`pcard ${LIFT}`} style={{ minWidth: 160 }}><strong>{t}</strong><p className="muted small" style={{ margin: "4px 0 0" }}>Hover me</p></div>)}
      </Item>
      <Item title="Tilt" intro="A strategy card leans a few degrees toward the pointer, with a soft light that follows it. Mouse and trackpad only." code={`<Tilt className="feat">…</Tilt>`}
        rules={["At most 6 degrees. Text must stay readable while it leans.", "Use for strategy cards and the two sides, not for lists or tables.", "Touch screens and reduced motion get a still card."]}>
        <div className="feat-row" style={{ width: "100%" }} tabIndex={0} role="region" aria-label="Sample strategy cards">
          {[{ name: "Sample trend", color: "var(--series-1)", points: SAMPLE_A }, { name: "Sample carry", color: "var(--series-2)", points: SAMPLE_B }, { name: "Sample value", color: "var(--series-3)", points: SAMPLE_C }].map((s) => (
            <Tilt key={s.name} className="feat">
              <div className="feat-in">
                <div className="feat-top"><span className="acct-dot" style={{ background: s.color }} /><span className="muted small">Sample</span><Badge tone="accent">Promising</Badge></div>
                <strong className="feat-name">{s.name}</strong>
                <Sparkline points={s.points} width={240} height={48} fluid />
              </div>
            </Tilt>
          ))}
        </div>
      </Item>
      <Item title="Charts draw in" intro="Lines draw from left to right once, when the chart first appears. The library's charts and sparklines do this already; DrawIn does it for hand-made SVG." code={`<DrawIn><svg>…</svg></DrawIn>`}
        rules={["Once, on arrival. Never again on hover or on a range change.", "Under a second. The numbers are readable before it ends."]}>
        <div key={k} style={{ width: "100%" }}>
          <DrawIn>
            <svg viewBox="0 0 300 80" width="100%" height="80" preserveAspectRatio="none" aria-hidden>
              <polyline fill="none" stroke="var(--benchmark)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" points="0,72 30,66 60,74 90,62 120,66 150,52 180,58 210,40 240,44 270,28 300,22" />
              <polyline fill="none" stroke="var(--series-1)" strokeWidth={2} vectorEffect="non-scaling-stroke" points="0,72 30,68 60,66 90,58 120,60 150,48 180,44 210,34 240,30 270,18 300,10" />
            </svg>
          </DrawIn>
        </div>
        <Button size="sm" onClick={() => setK((x) => x + 1)} icon="sparkle">Replay</Button>
      </Item>
      <Item title="Reveal on scroll" intro="Rises into place the first time it scrolls into view. Anything already on screen shows at once." code={`<Reveal as="section" delay={50} className="pcard">…</Reveal>`}
        rules={["Stagger a row by 50 to 80ms per card, never more than about 300ms in total.", "Use below the fold. Above it, the page transition is enough."]}>
        {[0, 1, 2].map((i) => <Reveal key={i} delay={i * 70}><div className="motion-box">card {i + 1}</div></Reveal>)}
      </Item>
      <Item title="Page transition" intro="A page eases up 8px and fades in when it opens. Wrap the page's outer element." code={`<PageTransition className="phome">…</PageTransition>`}>
        <PageTransition key={k}><div className="motion-box">page</div></PageTransition>
        <Button size="sm" onClick={() => setK((x) => x + 1)} icon="sparkle">Replay</Button>
      </Item>
      <Item title="Hero glow" intro="A slow wash of the brand blues behind a hero area. The only loop in the app: about a minute per drift, low contrast, still for reduced motion." code={`<section className="phome-hero">\n  <HeroGlow />\n  …\n</section>`}
        rules={["Only behind a page's first block. One per page.", "Text on top keeps its normal contrast; the glow stays faint."]}>
        <div className="phome-hero" style={{ width: "100%" }}>
          <HeroGlow />
          <div><h1 style={{ margin: 0 }}>Hi Sam</h1><p className="muted">102 strategies, each run through the same tests.</p></div>
        </div>
      </Item>
    </>
  );
}

function Icons() {
  return (
    <>
      <PageHeader title="Icons" description="16px on a 16 grid, 1.4px strokes, round ends, currentColor. Icons sit beside a word; an icon on its own needs a label for screen readers." />
      <Item title={`${ICON_NAMES.length} icons`} code={`<Icon name="chart" />\n<Icon name="bookmark" size={13} />`}>
        <div className="icon-grid">{ICON_NAMES.map((n) => <div key={n} className="icon-cell"><Icon name={n} size={18} />{n}</div>)}</div>
      </Item>
    </>
  );
}

// ---------- Components ----------

function TextNumbers() {
  return (
    <>
      <PageHeader title="Text and numbers" description="How every number is printed. A change is never shown by colour alone: it carries a + or a true minus sign, and an arrow where space allows." />
      <Item title="Money" intro="Separators, a true minus, small raised cents (Mercury). Compact form for tight spaces." code={`<Money value={27970.51} />\n<Money value={-430567.16} />\n<Money value={1716746.99} compact />`}>
        <span className="ui-fs-3xl"><Money value={27970.51} /></span>
        <span className="ui-fs-xl"><Money value={-430567.16} /></span>
        <Money value={1716746.99} compact />
      </Item>
      <Item title="Delta" code={`<Delta value={0.0233} arrow />\n<Delta value={-1234.5} kind="money" label="Past year" />`}>
        <Delta value={0.0233} arrow />
        <Delta value={-0.081} arrow />
        <Delta value={17970.51} kind="money" label="All time" />
        <Delta value={-1234.5} kind="money" label="Past year" />
      </Item>
      <Item title="Formatters" code={`fmt.pct(-0.546)   // ${fmt.pct(-0.546)}\nfmt.signedPct(0.1)  // ${fmt.signedPct(0.1)}\nfmt.num(0.4321)    // ${fmt.num(0.4321)}\nfmt.compact(1716746) // ${fmt.compact(1716746)}\nfmt.date("2026-10-21") // ${fmt.date("2026-10-21")}`}>
        <Label>Label</Label>
        <Label term="sharpe-ratio">Label linked to the glossary</Label>
        <Kbd>/</Kbd> <Kbd>⌘K</Kbd>
      </Item>
    </>
  );
}

function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title="Buttons" description="Pills. One primary per view in the accent colour; everything else sits near the surface tone, like Mercury, so the primary is obvious." />
      <Item title="Variants" code={`<Button variant="primary">Run backtest</Button>\n<Button>Compare</Button>\n<Button variant="tertiary">Cancel</Button>\n<Button variant="outline">Read the write-up</Button>\n<Button variant="danger">Remove</Button>`}
        rules={["Primary: the one thing the page is for. At most one per view.", "Secondary: the default. Tertiary: low-stakes actions next to others.", "Outline: a second call to action under a primary (Robinhood's pattern).", "Danger: only for removing something, and it asks first."]}>
        <Button variant="primary" icon="flask">Run backtest</Button>
        <Button icon="compare">Compare</Button>
        <Button variant="tertiary">Cancel</Button>
        <Button variant="outline">Read the write-up</Button>
        <Button variant="danger">Remove</Button>
      </Item>
      <Item title="Sizes and states" code={`<Button size="sm">Small</Button>\n<Button loading>Saving</Button>\n<Button disabled>Disabled</Button>\n<Button href="#/strategies">As a link</Button>`}>
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg" variant="primary">Large</Button>
        <Button loading={busy} onClick={() => { setBusy(true); window.setTimeout(() => setBusy(false), 1500); }}>{busy ? "Saving" : "Click to load"}</Button>
        <Button disabled>Disabled</Button>
        <Button href="#/strategies" iconRight="arrowUpRight" variant="tertiary">As a link</Button>
      </Item>
      <Item title="Icon buttons" code={`<IconButton icon="bookmark" label="Add to bookmarks" />`} rules={["Always round, always labelled (the label becomes the tooltip and the screen reader name)."]}>
        <IconButton icon="bookmark" label="Add to bookmarks" />
        <IconButton icon="bookmark" label="Remove from bookmarks" active />
        <IconButton icon="download" label="Export" />
        <IconButton icon="dots" label="More actions" variant="plain" />
      </Item>
      <Item title="Group">
        <ButtonGroup><Button variant="primary">Send</Button><Button>Transfer</Button><Button>Request</Button></ButtonGroup>
      </Item>
    </>
  );
}

function Inputs() {
  const [t, setT] = useState("");
  const [q, setQ] = useState("carry");
  const [sel, setSel] = useState<"month" | "quarter">("month");
  const [seg, setSeg] = useState<"dark" | "light" | "system">("dark");
  const [on, setOn] = useState(true);
  const [chk, setChk] = useState(true);
  const [tab, setTab] = useState<RangeKey>("1Y");
  return (
    <>
      <PageHeader title="Inputs" description="32 to 34px tall, quiet fill, 1px border, accent focus ring." />
      <Item title="Text and search" col code={`<Input label="Name" value={v} onChange={setV} />\n<SearchInput value={q} onChange={setQ} placeholder="Search strategies" />`}>
        <Input label="Registration title" value={t} onChange={setT} placeholder="All strategies, scored on excess returns" />
        <SearchInput value={q} onChange={setQ} placeholder="Search strategies" />
      </Item>
      <Item title="Choosing" code={`<Select label="Interval" value={v} onChange={setV} options={[["month","Month"],["quarter","Quarter"]]} />\n<Segmented value={v} onChange={setV} options={[["dark","Dark"],["light","Light"]]} />\n<Toggle on={on} onChange={setOn} />\n<Checkbox checked={c} onChange={setC} label="Include costs" />`}>
        <Select label="Interval" value={sel} onChange={setSel} options={[["month", "Month"], ["quarter", "Quarter"]]} />
        <Segmented value={seg} onChange={setSeg} options={[["dark", "Dark"], ["light", "Light"], ["system", "System"]]} />
        <Toggle on={on} onChange={setOn} label="Find on select" />
        <Checkbox checked={chk} onChange={setChk} label="Include costs" />
      </Item>
      <Item title="Tabs" intro="Robinhood's range tabs: small, bold, letter-spaced. One underline slides to the chosen tab (and the Segmented thumb above slides the same way). Arrow keys move between tabs." code={`<Tabs label="Range" value={r} onChange={setR} tabs={RANGES} />`}
        rules={["The tabs never change size when chosen, so nothing beside them moves.", "Too many tabs for the width: the row scrolls sideways instead of wrapping onto two lines."]}>
        <div style={{ width: "100%" }}><Tabs label="Range" value={tab} onChange={setTab} tabs={["1M", "3M", "YTD", "1Y", "5Y", "10Y", "ALL"] as const} /></div>
      </Item>
    </>
  );
}

interface Demo { name: string; family: string; sharpe: number; cagr: number; dd: number; benchmark?: boolean }
const DEMO_ROWS: Demo[] = [
  { name: "Market (sample)", family: "benchmark", sharpe: 0.43, cagr: 0.088, dd: -0.546, benchmark: true },
  { name: "Trend A", family: "trend", sharpe: 0.59, cagr: 0.091, dd: -0.218 },
  { name: "Carry B", family: "carry", sharpe: 0.41, cagr: 0.036, dd: -0.145 },
  { name: "Value C", family: "value", sharpe: 0.01, cagr: 0.002, dd: -0.186 },
  { name: "Momentum D", family: "trend", sharpe: -0.05, cagr: -0.003, dd: -0.181 },
];

function Filters() {
  const defs = useMemo(() => [
    { id: "trend", label: "Trend", test: (r: Demo) => r.family === "trend" },
    { id: "positive", label: "Positive Sharpe", test: (r: Demo) => r.sharpe > 0 },
  ], []);
  const f = useFilters(DEMO_ROWS, defs, (r) => r.name);
  return (
    <>
      <PageHeader title="Filters and sorting" description="Mercury's toolbar: chips in a row above the data. An idle chip is quiet; an applied one turns accent-tinted and gains a remove button; Reset appears once anything is applied." />
      <Item title="Filter bar" col code={`const f = useFilters(rows, defs, (r) => r.name);\n<FilterBar count={f.count} onReset={f.reset} right={<SearchInput … />}>\n  <FilterChip icon="filter" label={\`Filters\${f.count ? \` (\${f.count})\` : ""}\`} />\n  <FilterChip label="Trend" active={on} onClick={…} onRemove={…} />\n</FilterBar>`}
        rules={["Chips are 32px, radius 8. Applied chips show what is applied, not just that something is.", "Sorting lives in the table headers, not in the toolbar.", "Filters never hide the benchmark row."]}>
        <FilterBar count={f.count} onReset={f.reset} right={<SearchInput value={f.query} onChange={f.setQuery} placeholder="Search" />}>
          <FilterChip icon="filter" label={`Filters${f.count ? ` (${f.count})` : ""}`} />
          <Separator />
          {defs.map((d) => (
            <FilterChip key={d.id} label={d.label} active={f.active.includes(d.id)} onClick={() => f.toggle(d.id)} onRemove={() => f.toggle(d.id)} menu />
          ))}
          <FilterChip icon="calendar" label="1999 to today" menu />
        </FilterBar>
        <DemoTable rows={f.filtered} />
      </Item>
    </>
  );
}

const DEMO_COLS: Column<Demo>[] = [
  { key: "name", header: "Strategy", align: "left", sort: (r) => r.name, render: (r) => <>{r.name}{r.benchmark && <> <Badge>benchmark</Badge></>}</> },
  { key: "family", header: "Family", align: "left", render: (r) => r.family },
  { key: "sharpe", header: "Sharpe", sort: (r) => r.sharpe, render: (r) => fmt.num(r.sharpe) },
  { key: "cagr", header: "CAGR", sort: (r) => r.cagr, tone: (r) => r.cagr, render: (r) => fmt.signedPct(r.cagr) },
  { key: "dd", header: "Max drawdown", sort: (r) => r.dd, render: (r) => fmt.pct(r.dd) },
];

function DemoTable({ rows }: { rows: Demo[] }) {
  return <DataTable rows={rows} columns={DEMO_COLS} rowKey={(r) => r.name} pin={(r) => !!r.benchmark} initialSort={{ key: "sharpe", dir: "desc" }} empty="No strategy matches these filters." />;
}

// 3,000 made-up rows for the long-list demos (not research results).
interface LongRow { id: string; name: string; sharpe: number; cagr: number; years: number }
const LONG_ROWS: LongRow[] = (() => {
  let s = 99;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const kinds = ["Trend", "Carry", "Value", "Momentum", "Reversal", "Volatility", "Seasonal", "Breakout"];
  const assets = ["stocks", "bonds", "gold", "oil", "FX", "crypto", "sectors", "rates"];
  return Array.from({ length: 3000 }, (_, i) => ({
    id: `v${i}`, name: `${kinds[i % 8]} on ${assets[Math.floor(r() * 8)]} #${i + 1}`,
    sharpe: Math.round((r() * 1.6 - 0.4) * 100) / 100, cagr: Math.round((r() * 0.24 - 0.06) * 1000) / 1000, years: 5 + Math.floor(r() * 22),
  }));
})();

function Lists() {
  const [q, setQ] = useState("");
  const listBox = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => (q ? LONG_ROWS.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : LONG_ROWS), [q]);
  const cols: Column<LongRow>[] = [
    { key: "name", header: "Variation", align: "left", width: "46%", sort: (r) => r.name, render: (r) => r.name },
    { key: "sharpe", header: "Sharpe", width: "18%", sort: (r) => r.sharpe, render: (r) => fmt.num(r.sharpe) },
    { key: "cagr", header: "Per year", width: "18%", sort: (r) => r.cagr, tone: (r) => r.cagr, render: (r) => fmt.signedPct(r.cagr) },
    { key: "years", header: "Years", width: "18%", sort: (r) => r.years, render: (r) => r.years },
  ];
  return (
    <>
      <PageHeader title="Long lists" description="Thousands of rows that stay quick. Only the rows on screen are drawn; the space for the rest is held, so the scroll bar is right from the start and nothing jumps. Rows can still open in place." />
      <Item title="Sticky, virtual table" col intro={`${rows.length.toLocaleString()} sample rows. The header sticks to the top of the box, column widths are fixed (so sorting or scrolling never reflows a column), and a row opened in place pushes only the rows under it.`}
        code={`<DataTable rows={rows} columns={columns} rowKey={(r) => r.id}\n  maxHeight="min(70vh, 640px)" virtual\n  expand={(r) => …} />`}
        rules={["Use maxHeight plus virtual for anything over about 200 rows. Give each column a width.", "Search and filters sit above the box, outside it, so they never scroll away.", "Rows are 48px (38px dense); an opened row is measured and the rest move to make room before the next paint."]}>
        <SearchInput value={q} onChange={setQ} placeholder="Filter 3,000 rows" />
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} maxHeight="min(60vh, 560px)" virtual initialSort={{ key: "sharpe", dir: "desc" }}
          expand={(r) => <KeyValues cols={3} items={[["Sharpe", fmt.num(r.sharpe)], ["Per year", fmt.signedPct(r.cagr)], ["Years tested", String(r.years)]]} />} />
      </Item>
      <Item title="VirtualList" col intro="The same windowing for anything that is not a table: a list of cards, search results, log lines. It scrolls with the page, or inside a box you pass as scrollRef."
        code={`<VirtualList items={rows} rowHeight={44} getKey={(r) => r.id}\n  render={(r) => <Row {...r} />} />`}
        rules={["Rows of one usual height work best; rows that grow are measured.", "Keys must be stable (an id, not the index), or opened rows lose their place on a sort."]}>
        <div className="gal-vbox" data-lenis-prevent ref={listBox} tabIndex={0} role="region" aria-label="Sample variations, scrollable">
          <VirtualList items={rows} rowHeight={44} getKey={(r) => r.id} scrollRef={listBox} label="Sample variations"
            render={(r) => <div className="gal-vrow"><span>{r.name}</span><span className="ui-tab muted">{fmt.num(r.sharpe)}</span></div>} />
        </div>
      </Item>
    </>
  );
}

function Expand() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Expand and collapse" description="Anything that opens in place grows from its own top edge: the page below moves down smoothly instead of jumping, and the content fades in as it arrives. Closed content cannot be tabbed into." />
      <Item title="Collapse" col intro="The bare animated region. Height animates without measuring (a one-row grid whose row grows from 0fr to 1fr)."
        code={`<Button onClick={toggle}>Details</Button>\n<Collapse open={open}>…</Collapse>`}
        rules={["Use for a panel that a separate control opens. For a row with its own toggle, use Disclosure.", "Content stays mounted, so a form inside keeps what was typed. Pass lazy to mount it only once first opened."]}>
        <div><Button size="sm" iconRight="chevronDown" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"} how the score works</Button></div>
        <Collapse open={open}>
          <Text tone="secondary">The luck check discounts a Sharpe ratio for the number of variations tried. With 3,000 tries, a strategy needs a much higher Sharpe for its result to be unlikely to be luck.</Text>
        </Collapse>
        <Text size="sm" tone="muted">This line moves down smoothly when the text above opens.</Text>
      </Item>
      <Item title="Disclosure" col intro="A summary row with a chevron that turns as it opens. Controlled (open, onOpenChange) or left to keep its own state."
        code={`<Disclosure summary="What can go wrong" meta="3 risks">…</Disclosure>`}>
        <Disclosure summary="What can go wrong" meta="3 risks">Costs can eat a thin edge, a crowded trade can unwind fast, and a backtest can look good by luck.</Disclosure>
        <Disclosure summary="Where the data comes from" meta="2 sources">Daily prices from the public sources listed on the Data page.</Disclosure>
      </Item>
      <Item title="Accordion" col intro="A list of disclosures. With single, opening one closes the others, so the list keeps roughly its height."
        code={`<Accordion single items={[{ id, summary, meta, content }]} />`}>
        <Accordion single defaultOpen={["a"]} items={[
          { id: "a", summary: "Simple", meta: "1 of 3", content: "A strategy is a rule for when to buy and sell." },
          { id: "b", summary: "Analogy", meta: "2 of 3", content: "Like a recipe: the same steps every time, whatever the mood of the cook." },
          { id: "c", summary: "Precise", meta: "3 of 3", content: "A deterministic mapping from information available at time t to portfolio weights for t+1." },
        ]} />
      </Item>
    </>
  );
}

function Steady() {
  return (
    <>
      <PageHeader title="Nothing jumps" description="A page holds still while it loads, while its data arrives, on hover and when something opens. We measure it as cumulative layout shift (CLS), the browser's own score for how much a page jumps, and keep every page under 0.02." />
      <Item title="The rules" col>
        <ul className="gal-rules" style={{ margin: 0 }}>
          <li>Reserve the space: a skeleton the size of the content (Empty and loading), a chart box at its final height, an image with its width and height.</li>
          <li>Numbers use tabular figures, and a number that changes holds its width (AnimatedNumber). Badges, counters and sort arrows keep their space.</li>
          <li>Hover never changes size: colour, shadow and transforms only. No bold on hover, no border that appears and pushes.</li>
          <li>Animate transforms and opacity only. The one height animation is Collapse, which grows from its own top edge on purpose.</li>
          <li>Web fonts fall back to a copy of the system font stretched to the same measurements, so the swap moves nothing.</li>
          <li>The scroll bar's space is always kept (scrollbar-gutter), so short pages and open dialogs do not shift sideways.</li>
          <li>Things that float (tooltips, popovers, menus, dialogs, drawers, toasts) sit above the page and never push it.</li>
          <li>Coming back to a page shows the last data at once (Data that is ready); only a first visit shows skeletons.</li>
        </ul>
      </Item>
      <Item title="How to measure" col code={`VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1\nCLS_BASE=http://127.0.0.1:5199 npm run cls          # every page, 1440px and 390px\nCLS_SLOW=1 CLS_BASE=… npm run cls                   # slow network and late fonts`}
        rules={["The script loads each page, waits for its data, hovers its links and rows, and scrolls it, recording every shift.", "It names the elements that moved most, so a regression points at its cause.", "It fails if any page reaches 0.02."]}>
        <span className="muted small">web/scripts/cls.mjs</span>
      </Item>
    </>
  );
}

function DataReady() {
  return (
    <>
      <PageHeader title="Data that is ready" description="useResource keeps the last copy of each file in memory. Coming back to a page draws it at once from that copy and fetches a fresh one quietly behind it (stale-while-revalidate). Only the very first visit shows a skeleton." />
      <Item title="useResource" col code={`const { data, error, loading } = useResource("search", loadSearch);\nif (loading) return <PageSkeleton parts={["stats", "table"]} />;\nif (error) return <EmptyState title="Nothing yet">{error}</EmptyState>;\nreturn <Results doc={data} />;`}
        rules={["One fetch per key at a time, however many components ask.", "Data younger than 30 seconds is not fetched again; pass maxAge to change that.", "preload(key, loader) on a link's hover warms the cache before the page opens."]}>
        <PageSkeleton parts={["stats"]} />
      </Item>
      <Item title="Instant feedback" col
        rules={["Change the screen first, then save: a bookmark fills at once, a toast confirms, and an Undo puts it back.", "A button that waits keeps its width and shows a spinner over its label (Buttons, Sizes and states).", "Never clear what is on screen while a new copy loads; keep the old one until the new one is ready."]}>
        <Button onClick={() => toast("Added to your watchlist", { tone: "good", action: { label: "Undo", run: () => toast("Removed") } })} icon="bookmark">Follow (demo)</Button>
      </Item>
    </>
  );
}

function Tables() {
  return (
    <>
      <PageHeader title="Tables" description="One table component. Mercury spacing: 48px rows, 15px text, small grey headers, hairlines, numbers right-aligned in tabular figures." />
      <Item title="DataTable" col code={`const columns: Column<Row>[] = [\n  { key: "name", header: "Strategy", align: "left", sort: (r) => r.name, render: (r) => r.name },\n  { key: "sharpe", header: "Sharpe", sort: (r) => r.sharpe, render: (r) => fmt.num(r.sharpe) },\n  { key: "cagr", header: "CAGR", sort: (r) => r.cagr, tone: (r) => r.cagr, render: (r) => fmt.signedPct(r.cagr) },\n];\n<DataTable rows={rows} columns={columns} rowKey={(r) => r.name} pin={(r) => r.benchmark} href={(r) => \`#/strategy/\${r.name}\`} />`}
        rules={["Click a header to sort; click again to flip. A new column sorts biggest first.", "The benchmark row is pinned to the top whatever the sort.", "Rows that open something are whole-row links with a hover fill.", "Coloured cells (tone) still carry their sign."]}>
        <DemoTable rows={DEMO_ROWS} />
      </Item>
      <Item title="Rows that open in place" intro="Give the table an expand function and a click (or Enter) opens the row's details right under it. The details grow out of the row and the rows below glide down; closing reverses it."
        col code={`<DataTable rows={rows} columns={columns} rowKey={(r) => r.id}\n  expand={(r) => <KeyValues items={[["Volatility", fmt.pct(r.vol)], …]} />} />`}
        rules={["One row open at a time, so the list never turns into a wall.", "A sort glides rows to their new places (FLIP: transforms only) on tables up to 60 rows.", "Headers keep the space for their sort arrow, so sorting never shifts a column."]}>
        <DataTable rows={DEMO_ROWS} columns={DEMO_COLS} rowKey={(r) => r.name} pin={(r) => !!r.benchmark} initialSort={{ key: "sharpe", dir: "desc" }}
          expand={(r) => <KeyValues cols={3} items={[["Family", r.family], ["Sharpe", fmt.num(r.sharpe)], ["Max drawdown", fmt.pct(r.dd)]]} />} />
      </Item>
      <Item title="Share of total" intro="Mercury's staircase: each row's bar starts where the row above ended, so the bars tile the track." col code={`<ShareBar share={0.523} offset={0} />`}>
        {[0.523, 0.217, 0.183, 0.077].reduce<{ s: number; o: number }[]>((acc, s) => [...acc, { s, o: acc.reduce((a, x) => a + x.s, 0) }], []).map(({ s, o }, i) => <ShareBar key={i} share={s} offset={o} />)}
      </Item>
    </>
  );
}

function Cards() {
  return (
    <>
      <PageHeader title="Cards and stats" description="Mercury cards for summaries, Robinhood's key statistics grid for detail." />
      <Item title="Panel" col code={`<Panel title="Strategies" actions={<IconButton icon="list" label="All" />} footer={…}>…</Panel>`}>
        <Grid cols={3}>
          <Panel title="Beating the S&P 500" footer={<><span className="muted small">Best so far</span><span>Trend A</span></>}>
            <Stat label="Strategies" value={<>0 <span className="muted">of 16</span></>} size="lg" />
            <Meter value={0.68} marker={0.5} label="Best Sharpe against the market" />
          </Panel>
          <Panel title="Tests" actions={<IconButton icon="info" label="About" />}>
            <div className="stat-row"><Stat label="Passed" value={<span className="good">55</span>} /><Stat label="Failed" value={<span className="bad">118</span>} /></div>
          </Panel>
          <Panel title="Balance (sample)">
            <Stat label="Growth of $10,000" value={<Money value={27970.51} />} sub={<Delta value={17970.51} kind="money" label="All time" />} />
          </Panel>
        </Grid>
      </Item>
      <Item title="Key statistics" col code={`<KeyValues items={[["CAGR", "3.6%"], ["Sharpe", "0.41"], …]} />`}>
        <KeyValues items={[["CAGR", "3.6%"], ["Volatility", "3.9%"], ["Sharpe ratio", "0.41"], ["Max drawdown", fmt.pct(-0.145)], ["Calmar ratio", "0.25"], ["Hit rate", "52.4%"], ["Deflated Sharpe", "0.65"], ["Years", "27.8"]]} />
      </Item>
      <Item title="Badges and status" code={`<Badge tone="accent">new</Badge>\n<Status value="accepted" />`} rules={["Status always shows the word. The dot only helps."]}>
        <Badge>benchmark</Badge><Badge tone="accent">new</Badge><Badge tone="good">pass</Badge><Badge tone="bad">fail</Badge><Badge tone="dark">POC</Badge>
        <Divider vertical />
        <Status value="accepted" /><Status value="testing" /><Status value="rejected" /><Status value="draft" />
      </Item>
      <Item title="Section" col code={`<Section title="About">…</Section>`}>
        <Section title="About"><Text>Some countries pay more interest than others. This strategy holds the high-interest ones.</Text></Section>
      </Item>
    </>
  );
}

function Overlays() {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState<"right" | "left" | "bottom" | null>(null);
  const [range, setRange] = useState<"1y" | "5y" | "all">("5y");
  return (
    <>
      <PageHeader title="Overlays" description="Dark tooltips for a word or two, popovers for small controls, a centred dialog for decisions, a drawer for details, a toast to confirm. Each is anchored to what opened it, animates in and out, and never pushes the page." />
      <Item title="Popover" intro="A card that opens against its trigger on click and follows it if the page scrolls. It grows out of the side it is attached to; Escape or a click outside closes it and focus goes back to the trigger."
        code={`<Popover label="Range" trigger={() => <FilterChip label="Range" menu />}>\n  {(close) => <Segmented … onChange={(v) => { setRange(v); close(); }} />}\n</Popover>`}
        rules={["For small controls: a filter, a range, a short form. Anything long belongs in a drawer.", "Flips to the other side near the edge of the screen and never leaves it."]}>
        <Popover label="Range" trigger={() => <FilterChip icon="calendar" label={`Range: ${range}`} menu />}>
          {(close) => (
            <div style={{ display: "grid", gap: 10 }}>
              <Label>Show results for</Label>
              <Segmented value={range} onChange={(v) => { setRange(v); close(); }} options={[["1y", "1 year"], ["5y", "5 years"], ["all", "All"]]} />
            </div>
          )}
        </Popover>
      </Item>
      <Item title="Tooltip" code={`<Tooltip text="Add to bookmarks"><IconButton … /></Tooltip>`} intro="A short wait before the first one, then instant as you move along a row of them.">
        <Tooltip text="Annual return, compounded"><Label>CAGR</Label></Tooltip>
        <Tooltip text="Shown in dark, under 260px wide, plain text only"><Button size="sm">Hover me</Button></Tooltip>
      </Item>
      <Item title="Menu" code={`<Menu trigger={(open) => <Button iconRight="chevronDown">Export</Button>} items={[{ label: "CSV", icon: "download", onSelect }]} />`}>
        <Menu trigger={() => <Button iconRight="chevronDown">Export</Button>} items={[
          { label: "Download CSV", icon: "download", onSelect: () => toast("CSV ready (demo)", { tone: "good" }) },
          { label: "Copy link", icon: "external", onSelect: () => toast("Link copied (demo)") },
          { label: "Remove", icon: "close", danger: true, onSelect: () => toast("Removed (demo)", { action: { label: "Undo", run: () => toast("Restored") } }) },
        ]} />
      </Item>
      <Item title="Drawer" intro="A panel that slides in from an edge for details: an article, a row's full record. On phones a side drawer becomes a sheet from the bottom. It slides back out when closed."
        code={`<Drawer open={open} onClose={close} title="Headline" side="right" width={600}>…</Drawer>`}
        rules={["Right for details, left for navigation, bottom for a short choice on a phone.", "The page behind holds still, and its scroll bar's space is kept, so nothing shifts."]}>
        <Button onClick={() => setDrawer("right")}>From the right</Button>
        <Button onClick={() => setDrawer("left")}>From the left</Button>
        <Button onClick={() => setDrawer("bottom")}>From the bottom</Button>
        <Drawer open={!!drawer} onClose={() => setDrawer(null)} title="Trend A (sample)" side={drawer ?? "right"}>
          <KeyValues cols={2} items={[["CAGR", "9.1%"], ["Sharpe", "0.59"], ["Max drawdown", fmt.pct(-0.218)], ["Years", "27.8"]]} />
          <Text tone="secondary">Press Escape, click outside, or use the close button.</Text>
        </Drawer>
      </Item>
      <Item title="Dialog" intro="Grows out of the button that opened it and shrinks back into it. Focus stays inside while it is open." code={`<Dialog open={open} onClose={close} title="Register this test?" footer={…}>…</Dialog>`}>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Register this test?"
          footer={<><Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { setOpen(false); toast("Registered (demo)", { tone: "good" }); }}>Register</Button></>}>
          <Text tone="secondary">Once registered, the plan and the code it runs are frozen. Results count only from the official run.</Text>
        </Dialog>
      </Item>
      <Item title="Toast" code={`toast("Bookmark removed", { action: { label: "Undo", run: undo } });`}>
        <Button onClick={() => toast("Bookmark removed", { tone: "good", action: { label: "Undo", run: () => toast("Bookmark restored") } })}>Show toast</Button>
      </Item>
      <Item title="Doc previews" intro="Any link with data-term, data-doc or data-ref opens a preview card on hover; links inside it open another beside it. Select any word to list where it appears.">
        <a className="term-link" href="#/learn/sharpe-ratio" data-term="sharpe-ratio">Sharpe ratio</a>
        <a href="#/doc/DEC-0009" data-doc="DEC-0009">DEC-0009</a>
      </Item>
    </>
  );
}

function Feedback() {
  return (
    <>
      <PageHeader title="Empty and loading" description="Say what is missing and what to do next. Loading shows the shape of what is coming." />
      <Item title="Empty state" code={`<EmptyState title="No runs yet" action={<Button>Run one</Button>}>…</EmptyState>`}>
        <EmptyState title="No official runs yet" icon="ledger" action={<Button size="sm" href="#/doc/GDE-0004">How to register one</Button>}>Results only count once a registered plan has run on GitHub.</EmptyState>
      </Item>
      <Item title="Skeleton" col code={`<Skeleton width={180} height={28} />`}>
        <Skeleton width={180} height={28} /><Skeleton /><Skeleton width="70%" /><Skeleton width={40} height={40} round />
      </Item>
      <Item title="Skeleton variants" col intro="Each is the size of what it stands in for, so the real content lands without moving anything. Screen readers hear one Loading per block."
        code={`<SkeletonText lines={3} />\n<SkeletonStat size="lg" />\n<SkeletonChart height={300} />\n<SkeletonTable rows={6} cols={5} />\n<SkeletonCard lines={3} />\n<PageSkeleton parts={["stats", "chart", "table"]} />`}
        rules={["Match the final layout: the same grid, the same chart height, the same row height.", "Use PageSkeleton while a page's file loads, never a line of text that the page then replaces.", "No skeleton for data that is already in memory: show it."]}>
        <Grid cols={4}>{[0, 1, 2, 3].map((i) => <SkeletonStat key={i} />)}</Grid>
        <SkeletonText lines={3} />
        <SkeletonChart height={180} />
        <SkeletonTable rows={4} cols={5} />
        <Grid cols={3}>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</Grid>
      </Item>
    </>
  );
}

// ---------- Charts ----------

function HowCharts() {
  return (
    <>
      <PageHeader title="How charts work" description="Hand-written SVG, no chart library. Every chart is a function of a list of points, a scale and a few rules." />
      <Section title="The data">
        <Text>Every series is a list of <code>[date, value]</code> pairs, sorted by date (<code>Point[]</code>). Equity curves start at 1 and the headline chart rescales them to the starting amount you pick in Settings, so a value of 2.8 reads as $28,000 from $10,000.</Text>
      </Section>
      <Section title="The steps">
        <ol className="gal-rules" style={{ fontSize: "var(--type-lg)" }}>
          <li><b>Measure.</b> A ResizeObserver gives the width; the chart redraws when it changes.</li>
          <li><b>Slice.</b> The range tab (1M to ALL) keeps points from that far back from the last date.</li>
          <li><b>Thin.</b> Long series are cut to about 900 points so drawing and hovering stay instant.</li>
          <li><b>Scale.</b> Dates map to x by time, values to y between the lowest and highest point (log scale where growth is compared over decades).</li>
          <li><b>Draw.</b> A dotted background (Mercury), the lines, a soft gradient under the main line, a dotted line at the starting value (Robinhood).</li>
          <li><b>Hover.</b> A transparent layer finds the nearest date under the pointer (binary search), draws a crosshair and dots, and updates the header or tooltip.</li>
        </ol>
      </Section>
      <Section title="Rules every chart keeps">
        <ul className="gal-rules" style={{ fontSize: "var(--type-lg)" }}>
          <li>One y axis. Two measures on different scales get two charts.</li>
          <li>Colour follows the strategy by name, in the fixed series order; the market is always the neutral line.</li>
          <li>Two or more series get a legend; the headline chart's legend doubles as a show or hide switch.</li>
          <li>Gain and loss are green and red but always carry a sign, because the pair fails the colour-blind check.</li>
          <li>Every chart has a hover layer, and summary charts offer a table view.</li>
          <li>Text stays in text colours; only marks use series colours.</li>
        </ul>
      </Section>
    </>
  );
}

function Hero() {
  const [range, setRange] = useState<RangeKey>("ALL");
  return (
    <>
      <PageHeader title="Headline chart" description="Robinhood's layout drawn in Mercury's style. Move the pointer across it: the value and change follow. Sample data, not a result." />
      <Item title="HeroChart" col code={`<HeroChart\n  title="Growth of $10,000"\n  main={{ name: "Strategy", points }}\n  compare={{ name: "US stock market", points: market }}\n  amount={10000} range={range} onRange={setRange}\n/>`}
        rules={["Line colour follows the whole range: green if it ended above where it started, red if below.", "The dotted line marks the starting amount.", "The comparison line is muted and can be hidden from the legend.", "Range tabs sit under the chart, as on Robinhood."]}>
        <HeroChart title="Growth of $10,000 (sample)" main={{ name: "Sample strategy", points: SAMPLE_A }} compare={{ name: "Sample market", points: SAMPLE_B }} amount={10000} range={range} onRange={setRange} />
      </Item>
      <Item title="Sparkline" code={`<Sparkline points={points} />`} intro="For lists. Green if it ended higher, red if lower; the number beside it carries the sign.">
        <Sparkline points={SAMPLE_A} /><Sparkline points={SAMPLE_B} width={120} height={36} />
      </Item>
    </>
  );
}

// Sample fan data: five made-up random walks over 63 days, and their bands.
const FAN = (() => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const paths = [0, 1, 2, 3, 4].map((i) => {
    const values = [0];
    for (let d = 1; d < 64; d++) values.push(values[d - 1] + rnd() * 2 + 0.05 * (i - 1));
    return { name: `Sample ${i + 1}`, values };
  });
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p; const lo = Math.floor(k); return s[lo] + (s[Math.ceil(k)] - s[lo]) * (k - lo); };
  const bands = paths[0].values.map((_, d) => {
    const vs = paths.map((p) => p.values[d]);
    return { day: d, median: q(vs, 0.5), q25: q(vs, 0.25), q75: q(vs, 0.75), min: Math.min(...vs), max: Math.max(...vs), count: vs.length };
  });
  return { paths, bands };
})();

function LineBar() {
  const years = ["2020", "2021", "2022", "2023", "2024"];
  return (
    <>
      <PageHeader title="Line and bar" description="For comparisons and breakdowns. Sample data, not results." />
      <Item title="LineChart" col code={`<LineChart label="…" format={(v) => \`$\${v.toFixed(2)}\`} series={[{ name, color: "var(--series-1)", points }]} log />`}>
        <LineChart label="Two sample series" log format={(v) => `$${v.toFixed(2)}`} series={[
          { name: "Sample A", color: "var(--series-1)", points: SAMPLE_A, emphasis: true },
          { name: "Sample B", color: "var(--series-2)", points: SAMPLE_B },
        ]} />
      </Item>
      <Item title="FanChart" col code={`<FanChart label="…" color={color} bands={bands} paths={[{ name, values }]} markers={[{ day: 21, label: "1m" }]} format={(v) => \`\${v > 0 ? "+" : ""}\${v.toFixed(1)}%\`} />`}
        rules={["One market per chart, in that market's series colour.", "Faint lines are single cases, the dark band the middle half, the light band the full range, the bold line the median, the dotted line zero."]}>
        <FanChart label="Sample fan of outcomes" color="var(--series-1)" markers={[{ day: 5, label: "1w" }, { day: 21, label: "1m" }, { day: 63, label: "3m" }]}
          format={(v) => `${v > 0 ? "+" : v < 0 ? "\u2212" : ""}${Math.abs(v).toFixed(1)}%`} paths={FAN.paths} bands={FAN.bands} />
      </Item>
      <Item title="BarChart" col code={`<BarChart label="…" format={(v) => fmt.pct(v, 0)} groups={[{ label: "2024", values: [{ name, color, value }] }]} />`}
        rules={["Bars are rounded only at the data end and square on the zero line.", "Hovering a group fades the others."]}>
        <BarChart label="Sample yearly returns" format={(v) => `${Math.round(v * 100)}%`} groups={years.map((y, i) => ({
          label: y,
          values: [
            { name: "Sample A", color: "var(--series-1)", value: [0.12, -0.08, 0.21, 0.05, -0.03][i] },
            { name: "Sample B", color: "var(--benchmark)", value: [0.18, 0.27, -0.19, 0.24, 0.23][i] },
          ],
        }))} />
      </Item>
    </>
  );
}

function ChartColor() {
  return (
    <>
      <PageHeader title="Chart colour" description="Checked with a palette validator (lightness band, saturation floor, colour-blind separation, normal-vision separation, contrast against the background), not by eye. Results from 2026-10-21." />
      <Item title="Results" col>
        <DataTable rows={VALIDATION} rowKey={(r) => r.palette} columns={[
          { key: "palette", header: "Palette", align: "left", render: (r) => r.palette },
          { key: "result", header: "Result", align: "left", render: (r) => <Status value={r.ok ? "pass" : "fail"} /> },
          { key: "note", header: "What it means", align: "left", render: (r) => <span style={{ whiteSpace: "normal" }}>{r.note}</span> },
        ]} />
      </Item>
      <Item title="The eight series, in order" col>
        <div className="swatches">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="swatch-card"><i style={{ background: `var(--series-${i})` }} /><div>Series {i}</div></div>)}</div>
      </Item>
    </>
  );
}

const VALIDATION = [
  { palette: "Eight series, dark background", ok: true, note: "Passes every check. Worst colour-blind pair (series 3 and 4) is 8.4, just above the 8 target." },
  { palette: "Eight series, light background", ok: true, note: "Passes; series 3, 4 and 5 are below 3:1 contrast on white, so light-mode charts must keep labels or a table view." },
  { palette: "Gain and loss (green and red)", ok: false, note: "Indistinguishable for red-green colour blindness (difference 1.5). So every gain or loss carries a sign or an arrow, never colour alone." },
];

// ---------- Patterns ----------

function Pages() {
  return (
    <>
      <PageHeader title="Page layouts" description="Four layouts cover every page. Each is built from the pieces above." />
      <Grid cols={2}>
        {[
          ["Home (Mercury dashboard)", "Welcome line, a row of pill actions (one primary), then a 3-column grid of cards. The first card is the headline chart and spans two columns.", "#/"],
          ["List (Mercury table)", "Title with bookmark, a toolbar (range tabs or filter chips, a short summary on the right), then one DataTable with the benchmark pinned.", "#/strategies"],
          ["Detail (Robinhood stock page)", "Breadcrumb, title, headline chart, then About, Key statistics and detail sections; a sticky verdict panel on the right with one primary and outline buttons.", "#/strategy/fx_carry"],
          ["Settings (Mercury settings)", "The sidebar turns into a settings menu. Each page is a list of rows: label and help on the left, the value or control on the right.", "#/settings/appearance"],
          ["Reader (doc pages)", "Article with heading anchors, a right rail (on this page, tags, related, linked from, terms used) and hover previews.", "#/doc/DEC-0011"],
        ].map(([t, d, href]) => (
          <Panel key={t} title={t} actions={<IconButton icon="arrowUpRight" label={`Open ${t}`} href={href} />}><Text tone="secondary" size="sm">{d}</Text></Panel>
        ))}
      </Grid>
      <Section title="Settings row">
        <SettingsRow label="Starting amount" help="Used for the money figures on strategy pages."><Segmented value="10k" onChange={() => undefined} options={[["10k", "$10,000"], ["100k", "$100,000"]]} /></SettingsRow>
      </Section>
    </>
  );
}
