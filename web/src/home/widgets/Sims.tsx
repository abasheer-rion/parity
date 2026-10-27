// Sims running now (DEC-0075): the always-on sims service, which runs around the clock, and the
// sims and searches this person started (stress tests in Sim World), newest first.
import { loadSims } from "../../lib/sims";
import { useActivity } from "../../lib/activity";
import { useResource } from "../../ui/resource";
import { simUrl, labUrl } from "../../lib/space";
import { age, Empty, Src } from "./common";

export default function Sims() {
  const sims = useResource("home:sims", loadSims, { maxAge: 5 * 60_000 });
  const mine = useActivity();
  const s = sims.data;
  const recent = s?.last_cycle_at ? Date.now() - Date.parse(s.last_cycle_at) < 6 * 3600_000 : false;
  return (
    <>
      <div className="sim-svc">
        <span className={`dot ${recent ? "on" : ""}`} aria-hidden />
        <div>
          <b>Always-on sims</b>
          <span className="wl-sub">
            {s ? `${recent ? "Running" : "Paused"}: ${s.cycles.toLocaleString("en-US")} cycles, ${s.bots.paths.toLocaleString("en-US")} bot paths so far, last cycle ${age(s.last_cycle_at)}` : "Status loads here."}
          </span>
        </div>
        <a href={simUrl()} target="_blank" rel="noopener" className="w-link">Open</a>
      </div>
      <h3 className="w-sub">Started by you</h3>
      {mine.length ? (
        <ul className="wl">
          {mine.slice(0, 5).map((a) => (
            <li key={a.id + a.startedAt} className="wl-row">
              <a href={a.href} target="_blank" rel="noopener"><b>{a.label}</b></a>
              <span className="wl-sub">{a.detail}. {a.endedAt ? `Finished ${age(a.endedAt)}` : "Running"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing yet. Run a stress test in <a href={simUrl()} target="_blank" rel="noopener">Sim World</a> or a search in <a href={labUrl("search")} target="_blank" rel="noopener">Workbench</a>, and it shows here.</Empty>
      )}
      <Src>Sims replay made-up paths built from past markets. Nothing here is a forecast.</Src>
    </>
  );
}
