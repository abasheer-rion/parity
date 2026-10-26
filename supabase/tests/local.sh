#!/usr/bin/env bash
# A throwaway local Postgres with every migration applied, for testing migrations before they
# reach main (where they apply to the hosted project by themselves).
#
#   supabase/tests/local.sh            fresh cluster, stand-ins, all migrations, then the tests
#   supabase/tests/local.sh --keep     same, and leave the server running (prints how to connect)
#   PARITY_BENCH=1 supabase/tests/local.sh   also run the bench_*.sql timings on made-up data
#   PGBIN=/path/to/pg17/bin supabase/tests/local.sh
#
# The cluster lives in a temporary folder and listens on a Unix socket only (no TCP port).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || true)}"
for c in /opt/homebrew/opt/postgresql@17/bin /usr/lib/postgresql/17/bin; do
  if [ -x "$c/initdb" ] && "$c/postgres" --version | grep -q " 17"; then PGBIN="$c"; break; fi
done
dir="$(mktemp -d "${TMPDIR:-/tmp}/parity-pg.XXXXXX")"
"$PGBIN/initdb" -D "$dir/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$dir/data" -l "$dir/log" -o "-k $dir -c listen_addresses='' -c shared_buffers=256MB -c max_wal_size=2GB" -w start >/dev/null
export PGHOST="$dir" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
stop() { "$PGBIN/pg_ctl" -D "$dir/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$dir"; }
if [ "${1:-}" != "--keep" ]; then trap stop EXIT; fi
psql() { "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 "$@"; }
psql -f "$here/standins.sql" >/dev/null
for f in "$root"/supabase/migrations/*.sql; do
  echo "apply $(basename "$f")"
  psql -f "$f" >/dev/null
done
# The new migrations must also apply a second time: the hosted runner can retry a push.
from="${PARITY_REAPPLY_FROM:-20261102000000}"
for f in "$root"/supabase/migrations/*.sql; do
  v="$(basename "$f" | cut -d_ -f1)"
  if [[ "$v" > "$from" || "$v" == "$from" ]]; then
    echo "re-apply $(basename "$f")"
    psql -f "$f" >/dev/null
  fi
done
for t in "$here"/test_*.sql; do
  [ -e "$t" ] || continue
  echo "test $(basename "$t")"
  psql -f "$t"
done
# Timings on made-up data at realistic volume (slow, so only when asked): PARITY_BENCH=1.
if [ "${PARITY_BENCH:-0}" = "1" ]; then
  for b in "$here"/bench_*.sql; do
    [ -e "$b" ] || continue
    echo "bench $(basename "$b")"
    psql -f "$b"
  done
fi
if [ "${1:-}" = "--keep" ]; then
  echo "running: PGHOST=$dir PGUSER=postgres psql   (stop: $PGBIN/pg_ctl -D $dir/data stop)"
fi
