// Product metrics for the team (DEC-0053): who is on the site now, which pages are used and
// for how long, what people click on each page, the sign-up funnel, weekly retention, named
// actions and errors, with the speed panels from the Latency page underneath. Only accounts
// on the team list (analytics.viewers) can read any of it; the numbers come only from people
// who switched analytics on.
import { useEffect, useMemo, useState } from "react";
import { Title } from "../components/Shell";
import {
  loadClicks, loadDaily, loadErrors, loadEvents, loadFunnel, loadLive, loadPages, loadRetention, metricsAllowed, share, visibleTime,
  type ClickRow, type DayRow, type Days, type EventRow, type ErrorRow, type FunnelRow, type Live, type PageRow, type RetentionRow,
} from "../lib/metrics";
import { Card, EmptyState, Segmented, StatTile, TableScroll } from "../ui";
import { SpeedPanels } from "./Latency";
import { PersonalMetrics } from "./MetricsPersonal";
import "./metrics.css";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

function useLoad<T>(fn: () => Promise<T>, deps: unknown[], everyMs?: number): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    const run = () => fn().then((data) => live && setV({ state: "ok", data })).catch((e: Error) => live && setV({ state: "error", message: e.message || "Could not load." }));
    setV({ state: "loading" });
    void run();
    const t = everyMs ? window.setInterval(run, everyMs) : 0;
    return () => { live = false; if (t) window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

function Pending<T>({ v, rows, children }: { v: Load<T>; rows: number; children: (d: T) => React.ReactNode }) {
  if (v.state === "ok") return <>{children(v.data)}</>;
  return <p className="muted small mx-pending" style={{ minHeight: `${rows * 30}px` }}>{v.state === "error" ? `Not available: ${v.message}` : "Loading."}</p>;
}

const n = (x: number) => x.toLocaleString("en-US");
const page = (r: { app: string; route: string }) => (r.route.startsWith("/") ? r.route : `${r.app} ${r.route}`);

export function Metrics() {
  const allowed = useLoad(metricsAllowed, []);
  if (allowed.state === "loading") return <p className="muted small mx-pending" style={{ minHeight: 300 }}>Loading.</p>;
  if (allowed.state === "error" || !allowed.data) {
    return (
      <>
        <div className="page-head"><Title>Metrics</Title></div>
        <EmptyState title="For the Parity team only" icon="team">
          This page shows how people use Parity. Ask the owner to add your account to the team list in the database.
        </EmptyState>
      </>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const [days, setDays] = useState<Days>(7);
  const live = useLoad(loadLive, [], 30_000);
  const daily = useLoad(() => loadDaily(days === 7 ? 30 : days), [days]);
  const pages = useLoad(() => loadPages(days), [days]);
  const funnel = useLoad(() => loadFunnel(days), [days]);
  const retention = useLoad(() => loadRetention(8), []);
  const events = useLoad(() => loadEvents(days), [days]);
  const errors = useLoad(() => loadErrors(days), [days]);

  return (
    <>
      <div className="page-head">
        <Title>Metrics</Title>
        <p>
          How people use Parity: pages, time on each, clicks, the sign-up funnel, retention and errors, from people who
          switched analytics on in the cookie preferences. Totals update every 15 minutes; people now updates every 30 seconds.
        </p>
      </div>
      <div className="mx-bar">
        <Segmented<string> label="Period" value={String(days)} onChange={(v) => setDays(Number(v) as Days)}
          options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]} />
      </div>
      <LiveNow live={live} daily={daily} pages={pages} days={days} />
      <Trend daily={daily} />
      <Pages pages={pages} />
      <ClickMap pages={pages} days={days} />
      <div className="mx-two">
        <Funnel funnel={funnel} />
        <Events events={events} />
      </div>
      <Retention retention={retention} />
      <Errors errors={errors} />
      <PersonalMetrics />
      <h2 className="mx-section">Speed</h2>
      <SpeedPanels />
    </>
  );
}

function LiveNow({ live, daily, pages, days }: { live: Load<Live>; daily: Load<DayRow[]>; pages: Load<PageRow[]>; days: Days }) {
  const totals = useMemo(() => {
    if (pages.state !== "ok") return null;
    const views = pages.data.reduce((a, r) => a + r.views, 0);
    const vis = pages.data.reduce((a, r) => a + r.views * (r.avg_visible_ms ?? 0), 0);
    return { views, avg: views ? vis / views : null };
  }, [pages]);
  const visitors = daily.state === "ok" ? daily.data.slice(-days).reduce((a, r) => a + r.visitors, 0) : null;
  return (
    <>
      <div className="tiles" style={{ minHeight: 96 }}>
        <StatTile label="People now" value={live.state === "ok" ? n(live.data.visitors) : "n/a"} note="active in the last 5 minutes" />
        <StatTile label={`Visitor days, ${days} days`} value={visitors == null ? "n/a" : n(visitors)} note="one per visitor per day" />
        <StatTile label={`Page views, ${days} days`} value={totals ? n(totals.views) : "n/a"} />
        <StatTile label="Time on a page" value={visibleTime(totals?.avg)} note="average, visible time only" />
      </div>
      {live.state === "ok" && live.data.pages.length > 0 && (
        <Card title="Pages open now">
          <TableScroll label="Speed">
            <table className="lat-table">
              <thead><tr><th>Page</th><th>App</th><th className="num">People</th></tr></thead>
              <tbody>{live.data.pages.map((p) => <tr key={`${p.app}${p.route}`}><td><code>{p.route}</code></td><td>{p.app}</td><td className="num">{n(p.visitors)}</td></tr>)}</tbody>
            </table>
          </TableScroll>
        </Card>
      )}
    </>
  );
}

function Trend({ daily }: { daily: Load<DayRow[]> }) {
  return (
    <Card title="Visitors per day" help="Each bar is one UTC day: distinct visitors. The label under the chart gives the busiest day.">
      <Pending v={daily} rows={4}>{(rows) => {
        if (!rows.length) return <p className="muted small">No visits recorded yet.</p>;
        const max = Math.max(...rows.map((r) => r.visitors), 1);
        const best = rows.reduce((a, r) => (r.visitors > a.visitors ? r : a), rows[0]);
        const w = 720, h = 90, bw = Math.max(2, w / rows.length - 2);
        return (
          <>
            <svg className="mx-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Visitors per day over ${rows.length} days, busiest ${best.day} with ${best.visitors}`}>
              {rows.map((r, i) => {
                const bh = Math.max(1, (r.visitors / max) * (h - 4));
                return <rect key={r.day} x={i * (bw + 2)} y={h - bh} width={bw} height={bh}><title>{`${r.day}: ${r.visitors} visitors, ${r.views} page views`}</title></rect>;
              })}
            </svg>
            <p className="muted small">Busiest: {best.day}, {n(best.visitors)} visitors, {n(best.views)} page views.</p>
          </>
        );
      }}</Pending>
    </Card>
  );
}

function Pages({ pages }: { pages: Load<PageRow[]> }) {
  return (
    <Card title="Top pages" help="Page views and distinct visitors per page. Time is how long the page was in front, averaged per view. Scroll is the deepest point reached, as a share of the page.">
      <Pending v={pages} rows={12}>{(rows) => rows.length === 0 ? <p className="muted small">No page views yet.</p> : (
        <TableScroll>
          <table className="lat-table">
            <thead><tr><th>Page</th><th>App</th><th className="num">Views</th><th className="num">Visitors</th><th className="num">Time</th><th className="num">Scroll</th></tr></thead>
            <tbody>{rows.slice(0, 40).map((r) => (
              <tr key={`${r.app}${r.route}`}>
                <td><code>{page(r)}</code></td><td>{r.app}</td><td className="num">{n(r.views)}</td><td className="num">{n(r.visitors)}</td>
                <td className="num">{visibleTime(r.avg_visible_ms)}</td><td className="num">{r.avg_scroll == null ? "n/a" : `${r.avg_scroll}%`}</td>
              </tr>
            ))}</tbody>
          </table>
        </TableScroll>
      )}</Pending>
    </Card>
  );
}

function ClickMap({ pages, days }: { pages: Load<PageRow[]>; days: Days }) {
  const options = pages.state === "ok" ? pages.data.slice(0, 40) : [];
  const [pick, setPick] = useState("");
  const chosen = options.find((p) => `${p.app}|${p.route}` === pick) ?? null;
  const clicks = useLoad<ClickRow[]>(() => loadClicks(days, chosen?.app ?? null, chosen?.route ?? null), [days, pick]);
  return (
    <Card title="Click map" help="The controls clicked most, by their role and label. Rage means three or more fast clicks on the same spot, which usually means something did not respond.">
      <label className="mx-pick">
        <span className="muted small">Page</span>
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Every page</option>
          {options.map((p) => <option key={`${p.app}|${p.route}`} value={`${p.app}|${p.route}`}>{page(p)}</option>)}
        </select>
      </label>
      <Pending v={clicks} rows={10}>{(rows) => {
        if (!rows.length) return <p className="muted small">No clicks recorded for this page yet.</p>;
        const max = Math.max(...rows.filter((r) => r.kind === "click").map((r) => r.clicks), 1);
        return (
          <TableScroll>
            <table className="lat-table">
              <thead><tr><th>Control</th>{!chosen && <th>Page</th>}<th className="num">Clicks</th><th className="num">Visitors</th><th aria-hidden="true" /></tr></thead>
              <tbody>{rows.slice(0, 30).map((r) => (
                <tr key={`${r.kind}${r.app}${r.route}${r.target}`}>
                  <td>{r.kind === "rage" && <span className="mx-rage">Rage</span>}{r.target}</td>
                  {!chosen && <td><code>{page(r)}</code></td>}
                  <td className="num">{n(r.clicks)}</td><td className="num">{n(r.visitors)}</td>
                  <td className="mx-barcell"><span className={`mx-hbar ${r.kind}`} style={{ width: `${Math.min(100, (r.clicks / max) * 100)}%` }} /></td>
                </tr>
              ))}</tbody>
            </table>
          </TableScroll>
        );
      }}</Pending>
    </Card>
  );
}

function Funnel({ funnel }: { funnel: Load<FunnelRow[]> }) {
  return (
    <Card title="Front page to first Verify" help="Visitors who did each step after the one before it, within the period. Sign-ups through Google or GitHub are not counted in step 3 yet.">
      <Pending v={funnel} rows={4}>{(rows) => {
        const first = rows[0]?.visitors ?? 0;
        return (
          <ol className="mx-funnel">
            {rows.map((r, i) => (
              <li key={r.step}>
                <div className="mx-funnel-row"><span>{r.label}</span><span className="num">{n(r.visitors)}</span></div>
                <span className="mx-hbar click" style={{ width: first ? `${Math.max(1, (r.visitors / first) * 100)}%` : "1%" }} />
                <span className="muted small">{i === 0 ? "start" : `${share(r.visitors, rows[i - 1].visitors)} of the step before`}</span>
              </li>
            ))}
          </ol>
        );
      }}</Pending>
    </Card>
  );
}

function Events({ events }: { events: Load<EventRow[]> }) {
  return (
    <Card title="Named actions" help="Actions pages report by name, such as verify_run, sign_up, order_placed and lesson_done.">
      <Pending v={events} rows={6}>{(rows) => rows.length === 0 ? <p className="muted small">None recorded yet.</p> : (
        <TableScroll>
          <table className="lat-table">
            <thead><tr><th>Action</th><th>App</th><th className="num">Times</th><th className="num">Visitors</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.app}${r.name}`}><td><code>{r.name}</code></td><td>{r.app}</td><td className="num">{n(r.events)}</td><td className="num">{n(r.visitors)}</td></tr>)}</tbody>
          </table>
        </TableScroll>
      )}</Pending>
    </Card>
  );
}

function Retention({ retention }: { retention: Load<RetentionRow[]> }) {
  return (
    <Card title="Weekly retention" help="Visitors grouped by the week they were first seen. Each column is the share who came back that many weeks later. Week 0 is always 100%.">
      <Pending v={retention} rows={8}>{(rows) => rows.length === 0 ? <p className="muted small">Not enough visits yet.</p> : (
        <TableScroll>
          <table className="lat-table mx-retention">
            <thead><tr><th>First week</th><th className="num">Visitors</th>{rows[0].weeks.map((_, i) => <th key={i} className="num">W{i}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.cohort}>
                <td>{r.cohort}</td><td className="num">{n(r.size)}</td>
                {r.weeks.map((w, i) => {
                  const p = r.size ? w / r.size : 0;
                  return <td key={i} className="num mx-cell" style={{ ["--p" as string]: String(p) }}>{w ? share(w, r.size) : ""}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </TableScroll>
      )}</Pending>
    </Card>
  );
}

function Errors({ errors }: { errors: Load<ErrorRow[]> }) {
  return (
    <Card title="Errors people hit" help="Uncaught errors in the browser, the message only, with addresses and numbers masked.">
      <Pending v={errors} rows={6}>{(rows) => rows.length === 0 ? <p className="muted small">No errors recorded.</p> : (
        <TableScroll>
          <table className="lat-table">
            <thead><tr><th>Message</th><th>Page</th><th className="num">Times</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.app}${r.route}${r.message}`}><td className="wrap">{r.message}</td><td><code>{page(r)}</code></td><td className="num">{n(r.errors)}</td></tr>)}</tbody>
          </table>
        </TableScroll>
      )}</Pending>
    </Card>
  );
}
