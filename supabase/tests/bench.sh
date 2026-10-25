#!/usr/bin/env bash
# Times the hot queries before and after the data model migration (DEC-0054) on made-up
# data at a realistic size: a throwaway local Postgres 17, every migration before
# 20261103000000, 1,000,000 orders (bench_data.sql), the timings, then the newer migrations
# and the timings again. Takes a few minutes.
#
#   supabase/tests/bench.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
PGBIN="${PGBIN:-}"
for c in /opt/homebrew/opt/postgresql@17/bin /usr/lib/postgresql/17/bin; do
  if [ -z "$PGBIN" ] && [ -x "$c/initdb" ]; then PGBIN="$c"; fi
done
cut="${PARITY_BENCH_CUT:-20261103000000}"
dir="$(mktemp -d "${TMPDIR:-/tmp}/parity-bench.XXXXXX")"
"$PGBIN/initdb" -D "$dir/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$dir/data" -l "$dir/log" -o "-k $dir -c listen_addresses='' -c shared_buffers=256MB -c max_wal_size=4GB -c work_mem=16MB" -w start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$dir/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT
export PGHOST="$dir" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
psql() { "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 "$@"; }
psql -f "$here/standins.sql" >/dev/null
for f in "$root"/supabase/migrations/*.sql; do
  v="$(basename "$f" | cut -d_ -f1)"
  if [[ "$v" < "$cut" ]]; then psql -f "$f" >/dev/null; fi
done
echo "loading made-up data..."
start=$(date +%s); psql -f "$here/bench_data.sql" >/dev/null; echo "loaded in $(( $(date +%s) - start )) s"
echo; echo "== before (migrations up to $cut)"
psql -f "$here/bench_queries.sql"
for f in "$root"/supabase/migrations/*.sql; do
  v="$(basename "$f" | cut -d_ -f1)"
  if [[ "$v" > "$cut" || "$v" == "$cut" ]]; then
    start=$(date +%s); psql -f "$f" >/dev/null; echo "applied $(basename "$f") to 1,000,000 orders in $(( $(date +%s) - start )) s"
  fi
done
psql -c "vacuum analyze" >/dev/null
psql -f "$here/bench_ledger.sql" >/dev/null
echo; echo "== after"
psql -v ledger=1 -f "$here/bench_queries.sql"
