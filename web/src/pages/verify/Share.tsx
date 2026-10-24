// Publishing a badge, and the separate opt-in to the research dataset (REF-0016). Only
// on request, after the result is shown. The badge stores summary numbers and the file's
// SHA-256, never the file. Publishing needs sign-in (the app is behind it) and is capped
// at 20 a day by the database (supabase/migrations/*_verify_badges.sql).
import { useCallback, useEffect, useState } from "react";
import type { Result } from "../../lib/verify/checks";
import { badgeSvg, embedSnippet, NOT_ADVICE, newBadgeId, socialLine, TRUST_LINE, VERDICT_WORDS, type PublicBadge, type VerdictKey } from "../../lib/verify/badge";
import { badgeRecord, datasetRow } from "../../lib/verify/publish";
import { Button, Checkbox, Input, toast } from "../../ui";
import type { FileMeta } from "../Verify";

/** The few database calls this panel makes; tests pass a stand-in. */
export interface ShareDb {
  from(table: string): {
    insert(row: unknown): PromiseLike<{ error: { message?: string; code?: string } | null }>;
    select(cols: string): { order(col: string, o: { ascending: boolean }): { limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }> } };
    update(patch: Record<string, unknown>): { eq(col: string, v: string): PromiseLike<{ error: { message?: string; code?: string } | null }> };
  };
}

async function realDb(): Promise<ShareDb> {
  const { supabase } = await import("../../auth/client");
  return supabase as unknown as ShareDb;
}

/** Plain words for what the database said. */
function explainError(e: { message?: string; code?: string } | null): string {
  const m = e?.message ?? "";
  if (/20 (badges|results) a day/.test(m)) return m;
  if (/JWT|sign in|42501|permission/i.test(m + (e?.code ?? ""))) return "Sign in again to publish. Your session may have ended.";
  return "We could not save this. Check your connection and try again.";
}

/** The badge image as an <img> source, so no markup is ever injected into the page. */
export const badgeSrc = (b: PublicBadge | null) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(b))}`;

interface Own { id: string; name: string | null; created_at: string; withdrawn_at: string | null; verdict: VerdictKey | null }

export const DATASET_TEXT = "Add this result, without your name, to Parity's research dataset of tested strategies.";
export const DATASET_HELP = "We would keep the summary numbers, the kind of record, its asset classes and the number of tries, with dates rounded to the month. No name, no file, no trades and no link to your account. The dataset is used for research and may be sold to other companies in aggregate. This cannot be undone: nothing links the row back to you, so we could not find it to remove it.";

export function SharePanel({ r, file, db = realDb }: { r: Result; file: FileMeta | null; db?: () => Promise<ShareDb> }) {
  // Starts empty on purpose: a file name can hold an account number or a person's name.
  const [name, setName] = useState("");
  const [dataset, setDataset] = useState(false);
  const [busy, setBusy] = useState<"badge" | "data" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublicBadge | null>(null);
  const [contributed, setContributed] = useState(false);
  const origin = window.location.origin;
  const host = window.location.host;

  const contribute = async () => {
    const { error: e } = await (await db()).from("verify_dataset").insert(datasetRow(r));
    if (e) throw e;
    setContributed(true);
  };

  const publish = async () => {
    if (!file) return;
    setBusy("badge"); setError(null);
    try {
      const client = await db();
      let id = "";
      for (let n = 0; n < 3 && !id; n++) {
        const candidate = newBadgeId();
        const { error: e } = await client.from("verify_badges").insert(badgeRecord(r, { id: candidate, name: name || "My record", sha256: file.sha256 }));
        if (!e) id = candidate;
        else if (e.code !== "23505") throw e; // 23505: that id is taken; pick another
      }
      if (!id) throw new Error("no id");
      setPublished({ id, created_at: new Date().toISOString(), withdrawn_at: null, name, input_kind: r.kind, stated_tries: r.tries,
        date_from: r.dateFrom, date_to: r.dateTo, trade_count: r.trades, verdict: r.verdict.id, survives_tries: r.card3?.survives ?? null,
        cards: null, method_version: r.methodVersion, file_sha256: file.sha256 });
      if (dataset && !contributed) await contribute();
      toast("Badge published");
    } catch (e) {
      setError(explainError(e as { message?: string; code?: string }));
    } finally {
      setBusy(null);
    }
  };

  const onlyDataset = async () => {
    setBusy("data"); setError(null);
    try { await contribute(); toast("Added to the dataset"); } catch (e) { setError(explainError(e as { message?: string })); } finally { setBusy(null); }
  };

  if (r.source !== "file" || !file) return null;
  const link = published ? `${origin}/v/${published.id}` : "";
  return (
    <section className="mcard vf-share" aria-labelledby="vf-share-h">
      <div className="mcard-head"><h2 id="vf-share-h">Share this result</h2></div>
      {!published ? (
        <div className="vf-panel">
          <p className="vf-small">
            Publishing makes a public page and a badge that say exactly what was checked. We store the verdict, the five cards'
            numbers, the dates and the file's fingerprint (SHA-256), never the file or its trades. You can withdraw it at any
            time; its page then says it was withdrawn, and when.
          </p>
          <Input label="Name for the record, as it will show on the badge" value={name} onChange={(v) => setName(v.slice(0, 80))} placeholder="My EURUSD bot" />
          <div className="vf-optin">
            <Checkbox checked={dataset} onChange={setDataset} label={DATASET_TEXT} />
            <p className="vf-help">{DATASET_HELP}</p>
          </div>
          {error && <p className="vf-error" role="alert">{error}</p>}
          <div className="vf-row">
            <Button variant="primary" onClick={() => void publish()} loading={busy === "badge"} disabled={!name.trim() || busy != null}>Publish badge</Button>
            <Button variant="secondary" onClick={() => void onlyDataset()} loading={busy === "data"} disabled={!dataset || contributed || busy != null}>
              {contributed ? "Added to the dataset" : "Only add to the dataset"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="vf-panel">
          <img className="vf-badge-img" src={badgeSrc(published)} width={320} height={80} alt={`Parity Verify badge: ${published.verdict ? VERDICT_WORDS[published.verdict] : ""}`} />
          <p className="vf-small">{TRUST_LINE} {NOT_ADVICE}</p>
          <div className="ui-field"><span className="ui-field-label">Public page</span>
            <span className="vf-copy"><a href={link} target="_blank" rel="noopener">{link}</a><Button size="sm" onClick={() => void copy(link)}>Copy</Button></span>
          </div>
          <label className="ui-field"><span className="ui-field-label">Embed on a website</span>
            <textarea className="ui-input vf-textarea vf-code" readOnly value={embedSnippet(published.id, origin)} rows={3} />
          </label>
          <label className="ui-field"><span className="ui-field-label">For a social post</span>
            <textarea className="ui-input vf-textarea" readOnly value={socialLine(published, host)} rows={2} />
          </label>
          <div className="vf-row">
            <Button size="sm" onClick={() => void copy(embedSnippet(published.id, origin))}>Copy embed</Button>
            <Button size="sm" onClick={() => void copy(socialLine(published, host))}>Copy post</Button>
          </div>
          {contributed && <p className="vf-small">Also added to the research dataset, without your name.</p>}
        </div>
      )}
      <MyBadges refreshKey={published?.id ?? ""} db={db} />
    </section>
  );
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Select the text and copy it"); }
}

/** The person's own badges, with a way to withdraw each one. */
export function MyBadges({ refreshKey = "", db = realDb }: { refreshKey?: string; db?: () => Promise<ShareDb> }) {
  const [rows, setRows] = useState<Own[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const { data, error: e } = await (await db()).from("verify_badges").select("id,name,created_at,withdrawn_at,verdict").order("created_at", { ascending: false }).limit(50);
      if (e) throw e;
      setRows((data ?? []) as Own[]);
    } catch {
      setRows([]);
    }
  }, [db]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const withdraw = async (id: string) => {
    if (!window.confirm("Withdraw this badge? Its page will say it was withdrawn and when. Its numbers are deleted and this cannot be undone.")) return;
    const { error: e } = await (await db()).from("verify_badges").update({ withdrawn_at: new Date().toISOString() }).eq("id", id);
    if (e) { setError(explainError(e)); return; }
    toast("Badge withdrawn");
    void load();
  };
  if (!rows?.length) return null;
  return (
    <div className="vf-mine">
      <h3>Your badges</h3>
      {error && <p className="vf-error" role="alert">{error}</p>}
      <ul className="vf-checks">
        {rows.map((b) => (
          <li key={b.id} className="vf-mine-row">
            <span>
              <a href={`/v/${b.id}`} target="_blank" rel="noopener">{b.withdrawn_at ? `Withdrawn badge ${b.id}` : b.name}</a>
              <span className="vf-small"> {b.withdrawn_at ? `withdrawn on ${b.withdrawn_at.slice(0, 10)}` : `${b.verdict ? VERDICT_WORDS[b.verdict] : ""}, published ${b.created_at.slice(0, 10)}`}</span>
            </span>
            {!b.withdrawn_at && <Button size="sm" variant="tertiary" onClick={() => void withdraw(b.id)}>Withdraw</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
