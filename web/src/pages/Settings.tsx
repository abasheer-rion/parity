// Settings, laid out like Mercury's: the sidebar becomes a settings menu, and each
// page is a list of rows with the label and a short description on the left and the
// value or control on the right.
import { useEffect, useState } from "react";
import { SETTINGS_SECTIONS } from "../components/Shell";
import { Button, Kbd, Segmented, SettingsRow, Toggle } from "../ui";
import { supabase, source } from "../lib/data";
import { date, REPO_URL } from "../lib/format";
import { setPrefs, usePrefs, type Range, type Theme } from "../lib/prefs";
import type { BatchSummary, Report } from "../lib/types";

export function Settings({
  section = "profile",
  email,
  onSignOut,
  report,
  batches,
  batchId,
  setBatchId,
}: {
  section?: string;
  email?: string | null;
  onSignOut?: () => void;
  report: Report | null;
  batches: BatchSummary[];
  batchId?: string;
  setBatchId: (id: string | undefined) => void;
}) {
  const prefs = usePrefs();
  const title = SETTINGS_SECTIONS.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? "Settings";

  return (
    <div className="settings">
      <h1 className="settings-title">{title}</h1>

      {section === "profile" && (
        <>
          <SettingsRow label="Email" help="The address you sign in with. Access is limited to the research team.">{email ?? "Local session, no sign-in"}</SettingsRow>
          <SettingsRow label="Data source" help="Where results are read from.">{source === "supabase" ? "Supabase (published runs)" : source === "local" ? "This computer (engine output)" : "None"}</SettingsRow>
          {onSignOut && <SettingsRow label="Sign out" help="Ends the session in this browser."><Button onClick={onSignOut} icon="external">Sign out</Button></SettingsRow>}
        </>
      )}

      {section === "appearance" && (
        <>
          <SettingsRow label="Theme" help="Dark is the default. System follows your computer.">
            <Segmented<Theme> value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[["dark", "Dark"], ["light", "Light"], ["system", "System"]]} />
          </SettingsRow>
          <SettingsRow label="Starting amount" help="The amount every growth chart starts from.">
            <Segmented<string> value={String(prefs.startingAmount)} onChange={(v) => setPrefs({ startingAmount: Number(v) })}
              options={[["1", "$1"], ["10000", "$10,000"], ["100000", "$100,000"], ["1000000", "$1M"]]} />
          </SettingsRow>
          <SettingsRow label="Default time range" help="The range charts open on.">
            <Segmented<Range> value={prefs.defaultRange} onChange={(defaultRange) => setPrefs({ defaultRange })}
              options={(["1Y", "5Y", "10Y", "ALL"] as Range[]).map((r) => [r, r])} />
          </SettingsRow>
        </>
      )}

      {section === "reading" && (
        <>
          <SettingsRow label="Preview delay" help="How long to rest on a link before its preview card opens.">
            <Segmented<string> value={String(prefs.previewDelay)} onChange={(v) => setPrefs({ previewDelay: Number(v) })}
              options={[["80", "Fast"], ["180", "Normal"], ["400", "Slow"]]} />
          </SettingsRow>
          <SettingsRow label="Find on select" help="Selecting a word or phrase opens a card listing every doc that mentions it.">
            <Toggle label="Find on select" on={prefs.findOnSelect} onChange={(findOnSelect) => setPrefs({ findOnSelect })} />
          </SettingsRow>
          <SettingsRow label="Bookmarks" help="Pages pinned to the sidebar. Use the bookmark button next to any page title.">
            {prefs.bookmarks.length ? (
              <ul className="plain-list">
                {prefs.bookmarks.map((b) => (
                  <li key={b.href}><a href={b.href}>{b.label}</a> <button className="linkish" onClick={() => setPrefs({ bookmarks: prefs.bookmarks.filter((x) => x.href !== b.href) })}>Remove</button></li>
                ))}
              </ul>
            ) : "None yet"}
          </SettingsRow>
        </>
      )}

      {section === "shortcuts" && (
        <>
          {[
            ["/ or ⌘K", "Search docs, terms and sources"],
            ["Esc", "Close the top preview card or the search box"],
            ["Arrow keys and Enter", "Move through search results and open one"],
            ["Hover a link", "Preview it; links inside a preview open another beside it"],
            ["Click a preview", "Pin it so it stays open"],
            ["Select text", "List every doc that mentions it"],
          ].map(([k, v]) => <SettingsRow key={k} label={v}><Kbd>{k}</Kbd></SettingsRow>)}
        </>
      )}

      {section === "runs" && (
        <>
          <SettingsRow label="Run shown" help="Every page reads from this research run. Official runs are recorded in the ledger.">
            {batches.length ? (
              <select value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || undefined)}>
                <option value="">Latest run</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{date(b.generated_at)} {b.git_sha ?? ""}</option>)}
              </select>
            ) : "Latest run"}
          </SettingsRow>
          <SettingsRow label="Kind" help="Official runs come from a frozen registration; nightly runs are exploratory.">{report ? (report.kind === "official" ? `Official, ${report.run_id ?? ""}` : "Exploratory") : "n/a"}</SettingsRow>
          <SettingsRow label="Generated">{report ? date(report.generated_at) : "n/a"}</SettingsRow>
          <SettingsRow label="Code version">{report?.git_sha ? <a href={`${REPO_URL}/commit/${report.git_sha}`} target="_blank" rel="noreferrer">{report.git_sha}</a> : "Local checkout"}</SettingsRow>
          <SettingsRow label="Trials counted" help="Used to deflate every Sharpe ratio.">{report?.n_trials ?? "n/a"}</SettingsRow>
          <SettingsRow label="Data fetched">{report?.coverage.fetched_at ? date(report.coverage.fetched_at) : "n/a"} · <a href="#/data">Data health</a></SettingsRow>
        </>
      )}

      {section === "team" && <Team />}

      {section === "about" && (
        <>
          <SettingsRow label="Parity" help="A research proof of concept: can a currency strategy beat the S&P 500? Not investment advice.">
            <a href="#/doc/INT-0001" data-doc="INT-0001">Initial intent</a>
          </SettingsRow>
          <SettingsRow label="Repository"><a href={REPO_URL} target="_blank" rel="noreferrer">abasheer-rion/parity</a></SettingsRow>
          <SettingsRow label="How results are kept" help="Pre-registered plans, a hash-chained ledger and a release per official run.">
            <a href="#/doc/REF-0008" data-doc="REF-0008">Where results live</a>
          </SettingsRow>
          <SettingsRow label="Design" help="Layout follows Mercury; charts merge Mercury and Robinhood. See the decision record.">
            <a href="#/doc/DEC-0011" data-doc="DEC-0011">DEC-0011</a>
          </SettingsRow>
        </>
      )}
    </div>
  );
}

function Team() {
  const [rows, setRows] = useState<{ email: string; added_at: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) { setErr("Team members are listed when signed in through Supabase."); return; }
    supabase.from("members").select("email, added_at").order("added_at").then(({ data, error }) => {
      if (error) setErr(error.message); else setRows(data ?? []);
    });
  }, []);
  return (
    <>
      <SettingsRow label="Members" help="Everyone who can sign in. Adding someone is done in Supabase by the owner.">
        {err ? <span className="muted">{err}</span> : !rows ? "Loading" : (
          <ul className="plain-list">{rows.map((r) => <li key={r.email}>{r.email} <span className="muted small">since {date(r.added_at)}</span></li>)}</ul>
        )}
      </SettingsRow>
    </>
  );
}
