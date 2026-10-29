// ECHO (DEC-0066): recent days whose moves pointed the same way as the first day after a
// past event, from the engine's scenario export (rebuilt every sims cycle). When a live
// feed is up, the euro (our on-chain EURC price, public) and, for the team, Kraken's fiat
// pairs replace the last close, and today's pattern is checked again as prices move. A
// resemblance is one day's pattern, not a cause, and never a forecast.
import { useEffect, useMemo, useState } from "react";
import { subscribeTicks } from "../../lib/live/client";
import { useTeam } from "../../lib/live/team";
import { fmtChange, humanize, resemblance, type EchoDay, type ScenarioData } from "../../lib/scenarios";
import { useAsOf, useLoad, useOpt, useTerm } from "../context";
import { getScen } from "../data";
import { shortDate, tone } from "../fmt";
import { Empty, Loading, TTable, type TCol } from "../tui";
import { currencyOf, divergingFill } from "../../lib/world";
import { MapLegend, WorldMap } from "../../pages/sim/WorldMap";

/** Live symbols per scenario market: [source, symbol, invert] (USD-JPY is yen per dollar). */
const LIVE: Record<string, [string, string, boolean][]> = {
  eur: [["onchain", "EURC-USDC", false], ["kraken", "EUR-USD", false]],
  gbp: [["kraken", "GBP-USD", false]], jpy: [["kraken", "USD-JPY", true]], chf: [["kraken", "USD-CHF", true]],
  aud: [["kraken", "AUD-USD", false]], cad: [["kraken", "USD-CAD", true]],
};

export function EchoPanel() {
  const scen = useLoad(getScen);
  useAsOf(scen.status === "ok" ? scen.data.echoes?.days.at(-1)?.date ?? scen.data.data_through : null);
  if (scen.status === "loading") return <Loading what="Loading past events" />;
  if (scen.status !== "ok") return <Empty title={scen.status === "missing" ? "No scenario data yet" : "Could not load past events"}>{scen.message}</Empty>;
  if (!scen.data.echoes?.days.length) return <Empty title="No echoes in this file yet">They appear after the next `parity scenario export`.</Empty>;
  return <Echo data={scen.data} />;
}

/** Live prices for the markets we can stream, and when each last ticked. */
function useLivePrices(): Record<string, { price: number; src: string; at: number }> {
  const team = useTeam();
  const [px, setPx] = useState<Record<string, { price: number; src: string; at: number }>>({});
  useEffect(() => {
    const offs: (() => void)[] = [];
    for (const [key, feeds] of Object.entries(LIVE)) {
      for (const [src, sym, inv] of feeds) {
        if (src !== "onchain" && !(team?.team && team.sources.includes(src))) continue;
        offs.push(subscribeTicks(src, sym, (t) => {
          if (!(t.p > 0)) return;
          setPx((m) => (m[key] && m[key].src !== src && src === "onchain" ? m : { ...m, [key]: { price: inv ? 1 / t.p : t.p, src, at: Date.now() } }));
        }));
      }
    }
    return () => offs.forEach((f) => f());
  }, [team]);
  return px;
}

function Echo({ data }: { data: ScenarioData }) {
  const t = useTerm();
  const ech = data.echoes!;
  const days = useMemo(() => [...ech.days].reverse(), [ech]);
  const [pick, setPick] = useOpt("day", "");
  const live = useLivePrices();
  const byId = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data]);
  const firsts = useMemo(() => data.events.map((e) => ({ id: e.id, z: Object.fromEntries(Object.entries(e.reactions).map(([k, r]) => [k, r["1d"]?.z ?? null])) })), [data]);
  const label = useMemo(() => Object.fromEntries(data.assets.map((a) => [a.key, a.label])), [data]);
  const measure = useMemo(() => Object.fromEntries(data.assets.map((a) => [a.key, a.measure])), [data]);

  // Today, live: the last close of each streamed market against the newest price.
  const liveDay: EchoDay | null = useMemo(() => {
    const keys = Object.keys(live);
    if (!keys.length) return null;
    const lastClose = (k: string) => { for (const d of ech.days.slice().reverse()) if (d.moves[k]) return d.moves[k]; return null; };
    const moves: EchoDay["moves"] = {};
    for (const k of keys) {
      const m = lastClose(k);
      if (!m) continue;
      const change = (live[k].price / m.close - 1) * 100;
      moves[k] = { close: live[k].price, change, vol: m.vol, z: change / m.vol };
    }
    const z = Object.fromEntries(Object.entries(moves).map(([k, m]) => [k, m.z]));
    // Live markets are few, so the bar for a match is the markets streamed, at least 2.
    const need = Math.max(2, Math.min(ech.min_assets, Object.keys(z).length));
    const matches = firsts.map((f) => ({ id: f.id, r: resemblance(z, f.z, need) })).filter((x) => x.r && x.r.sim >= ech.min_sim)
      .map((x) => ({ id: x.id, sim: Math.round(x.r!.sim * 1000) / 1000, shared: x.r!.shared })).sort((a, b) => b.sim - a.sim).slice(0, 5);
    const size = Math.sqrt(Object.values(z).reduce((s, v) => s + v * v, 0) / Math.max(1, Object.keys(z).length));
    return { date: "live", moves, size, matches };
  }, [live, ech, firsts]);

  const rows: EchoDay[] = liveDay ? [liveDay, ...days] : days;
  // By default, the newest day with a match and most markets (currencies often close later).
  const sel = rows.find((d) => d.date === pick) ?? rows.find((d) => d.matches.length && Object.keys(d.moves).length >= 10) ?? rows.find((d) => d.matches.length) ?? rows[0];
  const rule = ech.alert ?? { min_size: 1.5, min_sim: 0.8 };
  const alerts = days.filter((d) => d.size >= rule.min_size && (d.matches[0]?.sim ?? 0) >= rule.min_sim);

  const dayCols: TCol<EchoDay>[] = [
    { key: "d", label: "Day", align: "left", render: (d) => (d.date === "live" ? <span className="term-live-tag">LIVE</span> : shortDate(d.date)) },
    { key: "s", className: "c-vol", label: "Size", title: "Root mean square of the day's moves, in daily volatilities", sort: (d) => d.size, render: (d) => d.size.toFixed(1) },
    { key: "m", label: "Looked most like day 1 of", align: "left", render: (d) => (d.matches[0] ? <span className="term-name">{byId.get(d.matches[0].id)?.name ?? d.matches[0].id}</span> : <span className="muted">nothing close</span>) },
    { key: "x", label: "Alike", sort: (d) => d.matches[0]?.sim ?? null, render: (d) => (d.matches[0] ? `${Math.round(d.matches[0].sim * 100)}%` : "n/a") },
  ];

  return (
    <div className="term-col term-echo">
      <div className="term-honest-strip">A day that looks like the start of a past event is a pattern in prices, not a cause and not a forecast.</div>
      {alerts[0] && (
        <div className="term-echo-alert" role="status">
          {shortDate(alerts[0].date)}: moves {alerts[0].size.toFixed(1)} daily volatilities in size, {Math.round(alerts[0].matches[0].sim * 100)}% alike day 1 of {byId.get(alerts[0].matches[0].id)?.name}.
        </div>
      )}
      <div className="term-lib-grid">
        <div className="term-lib-kinds">
          <TTable rows={rows} cols={dayCols} rowKey={(d) => d.date} onPick={(d) => setPick(d.date)} picked={sel?.date} caption="Recent days and the past event each looked like" />
        </div>
        <div className="term-lib-detail term-scroll">
          {sel && (
            <>
              <div className="term-lib-head">
                <span className="term-sym big">{sel.date === "live" ? "Now, live" : shortDate(sel.date)}</span>
                <span className="term-bar-note">{Object.keys(sel.moves).length} markets{sel.date === "live" ? ` streamed (${[...new Set(Object.values(live).map((l) => l.src))].join(", ")}), against the last close` : ""}</span>
              </div>
              <div className="term-echo-moves">
                {Object.entries(sel.moves).map(([k, m]) => (
                  <span key={k} className="term-echo-move" title={`${label[k]}: ${fmtChange(m.change, measure[k] ?? "pct", 2)}`}>
                    <span className="term-faint">{label[k] ?? k}</span> <span className={tone(m.z)}>{m.z > 0 ? "+" : m.z < 0 ? "−" : ""}{Math.abs(m.z).toFixed(1)}σ</span>
                  </span>
                ))}
              </div>
              <div className="sw2 term-echo-map">
                <WorldMap label={`Currency moves against the dollar, ${sel.date === "live" ? "live" : shortDate(sel.date)}, in daily volatilities`}
                  fill={(id) => { const c = currencyOf(id)?.toLowerCase(); const m = c ? sel.moves[c] : undefined; return divergingFill(m ? m.z : null, 3); }}
                  card={(id, name) => { const c = currencyOf(id); const m = c ? sel.moves[c.toLowerCase()] : undefined; return <><div className="wm-card-title">{name}</div><div className="wm-card-sub">{c && m ? `${c} ${fmtChange(m.change, "pct", 2)}, ${m.z.toFixed(1)} daily volatilities` : "No move for this currency on this day"}</div></>; }}
                  onSelect={() => {}}
                  legend={<MapLegend title={sel.date === "live" ? "Live move against the last close" : "Move that day"} low="−3 vol" high="+3 vol" none="No move" />} />
              </div>
              {sel.matches.length === 0 ? <p className="term-lib-note">No past event's first day pointed the same way closely enough ({Math.round(ech.min_sim * 100)}% alike, on at least {ech.min_assets} shared markets).</p> : (
                <ol className="term-lib-events" aria-label="Past events this day looked like">
                  {sel.matches.map((m) => {
                    const e = byId.get(m.id);
                    if (!e) return null;
                    const m1 = (k: string) => e.reactions[k]?.["1m"]?.change;
                    return (
                      <li key={m.id}>
                        <span className="term-lib-date">{shortDate(e.date)}</span>
                        <span className="term-lib-name">{e.name} <span className="term-tag">{humanize(e.type)}</span> <span className="term-faint">{Math.round(m.sim * 100)}% alike on {m.shared} markets</span></span>
                        <span className="term-lib-desc">A month after: US stocks {fmtChange(m1("sp500"), "pct")}, oil {fmtChange(m1("oil"), "pct")}, US dollar {fmtChange(m1("usd"), "pct")}, 10-year yield {fmtChange(m1("ust10y"), "bp")}.</span>
                        <button type="button" className="term-mini term-lib-src" onClick={() => { t.setSpec((s) => ({ ...s, title: e.name, type: e.type, regions: e.regions, actors: e.actors, severity: e.severity, commodities: e.commodities })); t.open("SCEN"); }}>Play</button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="term-lib-note">σ: the day's move in daily volatilities over the year before. Alike: how closely the day's moves point the same way as the first day after each past event, over the markets both have.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
