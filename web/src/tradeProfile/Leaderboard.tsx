// The demo leaderboard. Opt in only: nobody is listed until they turn it on and choose a
// public handle. The board reads only the leaderboard_public view (handle, optional display
// name, country and numbers); your own row comes from my_trade_stats, so it shows pinned as
// "You" even before you qualify. Country is whatever you pick: never guessed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../auth/session";
import { isMockStore } from "../lib/userStore";
import { countries, countryName, regionOf, REGIONS, type Region } from "../lib/tradeProfile/countries";
import { EMPTY_PROFILE, loadBoard, loadMyStats, loadProfile, saveProfile, type MyStats, type Profile } from "../lib/tradeProfile/data";
import { boardFor, handleError, initials, luck, LUCK_TEXT, pct, share, type BoardPeriod, type BoardRow } from "../lib/tradeProfile/logic";
import { Badge, Button, DataTable, Field, Select, SettingsRow, Tabs, Toggle, toast, type Column } from "../ui";

const MIN_TRADES: Record<BoardPeriod, number> = { week: 5, month: 10, all: 20 };
const PERIODS: [BoardPeriod, string][] = [["week", "Week"], ["month", "Month"], ["all", "All time"]];

/** A board row for you, built from your own stats when you are not on the board. */
type Row = BoardRow & { you?: boolean; ranked: boolean; toGo: number };

export function Leaderboard() {
  const { session } = useSession();
  const local = isMockStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mine, setMine] = useState<MyStats[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [period, setPeriod] = useState<BoardPeriod>("all");
  const [region, setRegion] = useState<Region | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, m, b] = await Promise.all([loadProfile(), loadMyStats(), loadBoard(period)]);
      setProfile(p); setMine(m); setBoard(b); setError(null);
    } catch (e) {
      setProfile((p) => p ?? EMPTY_PROFILE);
      setError((e as Error).message);
    }
  }, [period]);

  useEffect(() => { if (session || local) void reload(); }, [reload, session, local]);

  const rows = useMemo<Row[]>(() => {
    const ranked: Row[] = boardFor(board, region).map((r) => ({ ...r, you: r.is_you, ranked: true, toGo: 0 }));
    if (ranked.some((r) => r.you) || !profile) return ranked;
    const s = mine.find((m) => m.period === period);
    const min = s?.min_trades || MIN_TRADES[period];
    const trades = s?.trades ?? 0;
    const handle = profile.handle ?? "";
    const country = profile.country;
    return [{
      period, rank: 0, handle, display_name: profile.display_name, initials: initials(profile.display_name, handle || "You"), country, region: regionOf(country),
      trades, active_days: s?.active_days ?? 0, total_return: s?.total_return ?? 0, risk_adjusted: s?.risk_adjusted ?? null, win_rate: s?.win_rate ?? null,
      max_drawdown: s?.max_drawdown ?? null, min_trades: min, is_you: true, you: true, ranked: false, toGo: Math.max(0, min - trades),
    }, ...ranked];
  }, [board, region, mine, profile, period]);

  if (!session && !local) return null;
  const others = rows.filter((r) => !r.you).length;

  return (
    <section aria-labelledby="tp-board" className="tp-sec tp-board" data-testid="leaderboard">
      <div className="tp-head">
        <h2 id="tp-board" className="settings-sub">Leaderboard</h2>
        <Badge tone="warning">Demo money</Badge>
      </div>
      <p className="settings-note">Demo traders who chose to be listed, ranked by return per unit of risk. Past demo results do not predict future results.</p>
      {profile && <OptIn profile={profile} onSaved={reload} />}
      {error && <p role="alert" className="settings-note">{error}</p>}
      <div className="tp-filters">
        <Tabs label="Leaderboard period" value={period} onChange={setPeriod} tabs={PERIODS} />
        <Select label="Region" value={region} onChange={setRegion} options={[["all", "All regions"], ...REGIONS.map((r): [Region, string] => [r, r])]} />
      </div>
      <DataTable rows={rows} rowKey={(r) => (r.you ? "you" : r.handle)} columns={COLUMNS} pin={(r) => !!r.you} caption="Demo leaderboard"
        initialSort={{ key: "rank", dir: "asc" }} empty="Nobody is on the board yet." />
      {!others && <p className="settings-note">Nobody else is on the board for this period{region === "all" ? "" : ` in ${region}`} yet.</p>}
      <p className="settings-note">The luck check uses the score: how far average daily P&L sits above zero, in units of its own day to day noise. A board needs at least {MIN_TRADES[period]} closed trades over 2 or more days for this period.</p>
    </section>
  );
}

function Trader({ r }: { r: Row }) {
  return (
    <span className="tp-trader">
      <span className="tp-avatar" aria-hidden>{r.initials || "?"}</span>
      <span className="tp-trader-text">
        <span className="tp-sym">
          {r.handle ? `@${r.handle}` : "No handle yet"}
          {r.you && <> <Badge tone="accent">You</Badge></>}
        </span>
        <span className="tp-dim tp-sub">{[r.display_name, r.country ? countryName(r.country) : null].filter(Boolean).join(", ") || "No country chosen"}</span>
      </span>
    </span>
  );
}

const COLUMNS: Column<Row>[] = [
  { key: "rank", header: "Rank", align: "left", sort: (r) => (r.ranked ? r.rank : null), render: (r) => (r.ranked ? r.rank : "Not ranked") },
  { key: "trader", header: "Trader", align: "left", render: (r) => <Trader r={r} /> },
  { key: "score", header: "Return per unit of risk", sort: (r) => r.risk_adjusted, render: (r) => (r.risk_adjusted == null ? "n/a" : r.risk_adjusted.toFixed(2)) },
  { key: "ret", header: "Return", sort: (r) => r.total_return, render: (r) => <span className={r.total_return > 0 ? "good" : r.total_return < 0 ? "bad" : ""}>{pct(r.total_return, 2)}</span> },
  { key: "win", header: "Win rate", sort: (r) => r.win_rate, render: (r) => share(r.win_rate) },
  { key: "dd", header: "Max drawdown", sort: (r) => r.max_drawdown, render: (r) => (r.max_drawdown == null ? "n/a" : `${(r.max_drawdown * 100).toFixed(1)}%`) },
  { key: "sample", header: "Sample", sort: (r) => r.trades, render: (r) => `${r.trades} ${r.trades === 1 ? "trade" : "trades"}, ${r.active_days} ${r.active_days === 1 ? "day" : "days"}` },
  {
    key: "luck", header: "Luck check", align: "left",
    render: (r) => {
      const l = luck(r.trades, r.min_trades, r.risk_adjusted);
      return (
        <span className="tp-luck">
          <Badge tone={l === "less-likely" ? "good" : l === "luck" ? "warning" : "neutral"}>{LUCK_TEXT[l]}</Badge>
          {r.you && r.toGo > 0 && <span className="tp-dim tp-sub">{r.toGo} more {r.toGo === 1 ? "trade" : "trades"} to qualify</span>}
        </span>
      );
    },
  },
];

function OptIn({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [on, setOn] = useState(profile.on_leaderboard);
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [name, setName] = useState(profile.display_name ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => countries(), []);
  const hErr = handle.trim() || on ? handleError(handle) : null;
  const nErr = name.trim().length > 60 ? "Use 60 characters or fewer." : null;

  const save = async () => {
    setTried(true);
    if (hErr || nErr) return;
    setBusy(true);
    try {
      await saveProfile({ handle: handle.trim() || null, display_name: name.trim() || null, country: country || null, on_leaderboard: on });
      setError(null);
      toast(on ? "You are on the leaderboard." : "Leaderboard settings saved.");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tp-optin">
      <SettingsRow label={<span id="tp-optin-label">Show me on the leaderboard</span>} help="Off until you turn it on. Other demo traders see only your handle, the display name if you add one, your country and your numbers. Never your email.">
        <Toggle on={on} onChange={setOn} label="Show me on the leaderboard" />
      </SettingsRow>
      <SettingsRow label="Public profile" help="Your initials in a circle stand in for a photo. Country is the one you choose here and sets your region.">
        <Field label="Public handle" help="3 to 20 letters, digits or underscores." error={tried || handle ? hErr : null} id="tp-handle">
          <input className="ui-input" value={handle} maxLength={20} autoComplete="off" spellCheck={false} onChange={(e) => setHandle(e.target.value)} aria-describedby="tp-handle-help" />
        </Field>
        <Field label="Display name (optional)" help="Shown next to your handle. Leave empty to show only the handle." error={nErr} id="tp-name">
          <input className="ui-input" value={name} maxLength={60} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-describedby="tp-name-help" />
        </Field>
        <label className="ui-field">
          <span className="ui-field-label">Country</span>
          <span className="ui-select">
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Not chosen</option>
              {list.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </span>
        </label>
        <Button variant="primary" onClick={() => void save()} loading={busy} disabled={busy}>Save leaderboard settings</Button>
        {error && <p role="alert" className="settings-note">{error}</p>}
      </SettingsRow>
    </div>
  );
}
