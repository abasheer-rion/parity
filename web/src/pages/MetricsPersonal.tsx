// The Personalization section of the Metrics page (DEC-0068): how many people fall in each
// segment, demo trading style and use band, What's new click-through by kind, and the
// experiments with a 95% interval for each arm and for the difference against control.
// Team only, like the rest of the page. Counts from 1 to 4 come back empty and show "under 5".
import { useEffect, useState } from "react";
import { loadExperiments, loadTeamPersonalization, type ExperimentRow, type TeamPersonalization } from "../lib/personalize/api";
import { diffInterval, diffText, pctText, wilson } from "../lib/personalize/stats";
import { Card, StatTile, TableScroll } from "../ui";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

function useOnce<T>(fn: () => Promise<T>): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    fn().then((data) => live && setV({ state: "ok", data })).catch((e: Error) => live && setV({ state: "error", message: e.message || "Could not load." }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

const count = (x: number | null | undefined) => (x == null ? "under 5" : x.toLocaleString("en-US"));
const SEGMENT: Record<string, string> = { new: "New", learner: "Mostly learning", trader: "Mostly trading", both: "Both", browser: "Looking around" };
const METRIC: Record<string, string> = {
  whats_new_click: "Opened a What's new item", whats_new_dismiss: "Hid a What's new item", widget_used: "Used a home widget",
  widget_restore: "Restored a folded widget", personalization_off: "Switched personalization off", lesson_done: "Finished a lesson", demo_order: "Placed a demo order",
};

function Bands({ rows, label }: { rows: { key: string; users: number | null }[]; label: string }) {
  if (!rows.length) return <p className="muted small">No profiles yet.</p>;
  return (
    <table className="lat-table">
      <thead><tr><th>{label}</th><th className="num">People</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className="num">{count(r.users)}</td></tr>)}</tbody>
    </table>
  );
}

function Experiment({ e }: { e: ExperimentRow }) {
  const metrics = [e.primary_metric, ...e.guardrails];
  const control = e.arms[0];
  return (
    <Card title={e.name} help={e.hypothesis}>
      <p className="muted small">
        {e.status === "running" ? `Running since ${e.started_at?.slice(0, 10) ?? "n/a"}.` : e.status === "stopped" ? `Stopped ${e.stopped_at?.slice(0, 10) ?? ""}: ${e.stop_reason ?? "no reason recorded"}.` : "Not started."}
        {" "}Planned {e.min_per_arm.toLocaleString("en-US")} people per version, at most {e.max_days} days. It stops by itself if a guardrail gets worse.
      </p>
      <TableScroll>
        <table className="lat-table">
          <thead><tr><th>Measure</th><th>Version</th><th className="num">People</th><th className="num">Did it</th><th className="num">Rate (95% range)</th><th className="num">Against control</th></tr></thead>
          <tbody>
            {metrics.flatMap((m) => e.arms.map((a, i) => {
              const n = a.exposed ?? 0, k = a.metrics[m] ?? 0;
              const w = wilson(k, n);
              const d = i === 0 || !control ? null : diffInterval(k, n, control.metrics[m] ?? 0, control.exposed ?? 0);
              return (
                <tr key={`${m}${a.variant}`}>
                  <td>{i === 0 ? `${METRIC[m] ?? m}${m === e.primary_metric ? " (main)" : " (guardrail)"}` : ""}</td>
                  <td>{a.variant}</td>
                  <td className="num">{count(a.exposed)}</td>
                  <td className="num">{count(a.metrics[m] ?? 0)}</td>
                  <td className="num">{w ? `${pctText(w.estimate)} (${pctText(w.lo)} to ${pctText(w.hi)})` : "n/a"}</td>
                  <td className="num">{i === 0 ? "control" : diffText(d)}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </TableScroll>
    </Card>
  );
}

export function PersonalMetrics() {
  const team = useOnce<TeamPersonalization>(loadTeamPersonalization);
  const exps = useOnce<ExperimentRow[]>(loadExperiments);
  return (
    <>
      <h2 className="mx-section">Personalization</h2>
      {team.state !== "ok" ? <p className="muted small mx-pending" style={{ minHeight: 120 }}>{team.state === "error" ? `Not available: ${team.message}` : "Loading."}</p> : (
        <>
          <div className="tiles">
            <StatTile label="Profiles" value={count(team.data.profiles)} />
            <StatTile label="Personalization on" value={count(team.data.enabled)} />
            <StatTile label="Switched off" value={count(team.data.disabled)} />
            <StatTile label="On, with analytics" value={count(team.data.analytics_ok)} />
          </div>
          <div className="mx-two">
            <Card title="Segments" help="From each person's own use. Counts under 5 are hidden.">
              <Bands label="Segment" rows={team.data.segments.map((s) => ({ key: SEGMENT[s.segment] ?? s.segment, users: s.users }))} />
            </Card>
            <Card title="Demo trading style and use" help="Style comes from demo orders only. Use is days active in the last 30.">
              <Bands label="Demo style" rows={team.data.risk.map((s) => ({ key: s.band, users: s.users }))} />
              <Bands label="Use" rows={team.data.engagement.map((s) => ({ key: s.band, users: s.users }))} />
            </Card>
          </div>
          <Card title="What's new click-through" help={`Last ${team.data.days} days. A show counts once an hour per person and item, a click once per person and item.`}>
            {team.data.reco.length === 0 ? <p className="muted small">Nothing shown yet.</p> : (
              <table className="lat-table">
                <thead><tr><th>Kind</th><th className="num">Shows</th><th className="num">Clicks</th><th className="num">Click-through (95% range)</th></tr></thead>
                <tbody>{team.data.reco.map((r) => {
                  const w = wilson(r.clicks ?? 0, r.shows ?? 0);
                  return <tr key={r.kind}><td>{r.kind}</td><td className="num">{count(r.shows)}</td><td className="num">{count(r.clicks)}</td><td className="num">{w ? `${pctText(w.estimate)} (${pctText(w.lo)} to ${pctText(w.hi)})` : "n/a"}</td></tr>;
                })}</tbody>
              </table>
            )}
          </Card>
        </>
      )}
      {exps.state !== "ok" ? <p className="muted small mx-pending" style={{ minHeight: 120 }}>{exps.state === "error" ? `Not available: ${exps.message}` : "Loading."}</p>
        : exps.data.length === 0 ? <p className="muted small">No experiments yet.</p>
          : exps.data.map((e) => <Experiment key={e.key} e={e} />)}
    </>
  );
}
