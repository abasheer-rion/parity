// Settings > Broker connections (DEC-0091): the connections kept in sync, with a way to
// revoke each, and the log of every read and change. The list and the log come straight from
// Supabase, where the row rules show only your own rows and never the sealed credential.
// Revoking deletes the sealed credential at once; the row and the log stay.
import { useCallback, useEffect, useState } from "react";
import { requireClient } from "../auth/client";
import { useSession } from "../auth/session";
import { VENUES } from "../lib/connect/venues";
import type { VenueId } from "../lib/connect/types";
import { Badge, Button, SettingsRow, toast } from "../ui";

interface Conn { id: string; venue: VenueId; env: "live" | "paper"; label: string; account_code: string | null; created_at: string; last_synced_at: string | null; last_result: string | null; revoked_at: string | null }
interface Event { id: number; connection_id: string | null; venue: VenueId; event: string; detail: string | null; at: string }

const COLS = "id, venue, env, label, account_code, created_at, last_synced_at, last_result, revoked_at";
const when = (iso: string | null) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "never");

/** What each log entry means, in words. */
export const EVENT_WORDS: Record<string, string> = {
  fetch: "read asked for", fetched: "read", refused: "key refused (it could do more than read)", failed: "read failed",
  saved: "kept in sync", opened: "kept key used", synced: "read again", sync_failed: "read again failed", revoked: "revoked",
};

export function BrokerConnectionsSettings() {
  const { session } = useSession();
  const [rows, setRows] = useState<Conn[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const c = requireClient();
      const [k, e] = await Promise.all([
        c.from("broker_connections").select(COLS).order("created_at", { ascending: false }),
        c.from("broker_events").select("id, connection_id, venue, event, detail, at").order("at", { ascending: false }).limit(30),
      ]);
      if (k.error) throw k.error;
      setRows((k.data ?? []) as Conn[]);
      setEvents((e.data ?? []) as Event[]);
      setError(null);
    } catch {
      setError("Could not load your connections. Reload to try again.");
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (r: Conn) => {
    if (!window.confirm(`Revoke "${r.label}"? Parity deletes the stored key at once. To stop the key at ${VENUES[r.venue]?.name ?? "the venue"} too, delete it there.`)) return;
    const { data, error: e } = await requireClient().rpc("broker_connection_revoke", { p_id: r.id });
    if (e || data === false) toast("Could not revoke that connection.", { tone: "bad" });
    else toast("Connection revoked.");
    await load();
  };

  const labels = new Map((rows ?? []).map((r) => [r.id, r.label]));
  return (
    <section aria-labelledby="set-broker" data-testid="broker-connections">
      <SettingsRow
        label={<span id="set-broker">Broker connections</span>}
        help={<>Connections you chose to keep in sync, so a record can be read again without pasting the key. The key is stored sealed and used only when you ask for a read. Every read is in the log below. Make a new read on <a href="/verify/">Verify</a>.</>}
      >
        <span className="settings-note">{rows ? `${rows.filter((r) => !r.revoked_at).length} kept` : ""}</span>
      </SettingsRow>
      {error && <p role="alert" className="settings-note">{error}</p>}
      {rows && rows.length === 0 && <p className="settings-note">No kept connections. A read without "keep in sync" uses the key once and drops it.</p>}
      {rows && rows.length > 0 && (
        <ul className="api-keys" aria-label="Your broker connections">
          {rows.map((r) => (
            <li key={r.id} className="srow">
              <div className="srow-l">
                <div className="srow-label">{r.label} {r.revoked_at ? <Badge tone="bad">Revoked</Badge> : <Badge tone="good">Kept</Badge>}</div>
                <div className="srow-help">
                  {VENUES[r.venue]?.name ?? r.venue}{r.env === "paper" ? ", paper account" : ""} · account <code>{r.account_code ?? "unknown"}</code> · kept since {when(r.created_at)} · last read {when(r.last_synced_at)}
                  {r.revoked_at && <> · revoked {when(r.revoked_at)}</>}
                  {r.last_result && <> · {r.last_result}</>}
                </div>
              </div>
              <div className="srow-r">
                {!r.revoked_at && <Button size="sm" variant="danger" onClick={() => void revoke(r)}>Revoke</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <SettingsRow label="Broker log" help="The last 30 reads and changes, with or without a kept connection. No key is ever written here.">
          <ul className="api-key-log" aria-label="Broker log">
            {events.map((e) => (
              <li key={e.id}>{when(e.at)} · {VENUES[e.venue]?.name ?? e.venue}{e.connection_id && labels.get(e.connection_id) ? ` (${labels.get(e.connection_id)})` : ""} · {EVENT_WORDS[e.event] ?? e.event}{e.detail ? `: ${e.detail}` : ""}</li>
            ))}
          </ul>
        </SettingsRow>
      )}
    </section>
  );
}
