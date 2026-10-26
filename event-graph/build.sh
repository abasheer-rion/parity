#!/bin/zsh
# Rebuild the Parity event graph from scratch: schema, rules, then every case in cases.txt
# (graph + claims, its prices, its hindsight story). Benchmarks load once for every case's dates.
#   ./build.sh            (EDGAR is not reloaded; run edgar/edgar.py afterwards if you want it)
set -e
export PATH=~/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH
export PGHOST=${PGHOST:-$HOME/event-graph/.pgdata} PGPORT=${PGPORT:-5499} PGUSER=${PGUSER:-postgres}
cd "${0:A:h}"
BENCH="SPY:NYSEArca 1306:TSE 2800:HKEX 510300:SSE 069500:KRX 0050:TWSE EXSA:XETRA ISF:LSE STW:ASX"

psql -d postgres -qc "DROP DATABASE IF EXISTS eg" -c "CREATE DATABASE eg"
export PGDATABASE=eg
load() { psql -q -v ON_ERROR_STOP=1 -f $1 >/dev/null 2> >(grep -v NOTICE >&2) }
load schema.sql; load reason.sql

cases=(${(f)"$(grep -v '^#' cases.txt | grep -v '^$')"})
for c in $cases; do load $c.sql; done
for c in $cases; do
  [[ -f $c.prices ]] || continue
  while read -r from to tickers; do
    [[ -z $from || $from == \#* ]] && continue
    if [[ $from == polymarket ]]; then python3 prices/polymarket.py ${=to} ${=tickers}; continue; fi   # TOKEN TICKER NAME
    python3 prices/yahoo.py $from $to ${=tickers} ${=BENCH} | grep -v " days$" || true
  done < $c.prices
done
for c in $cases; do [[ -f ${c}_story.sql ]] && load ${c}_story.sql; done
# Stories insert rows with hand-picked ids; move every id counter past the highest id so later inserts (EDGAR) fit.
psql -qAt >/dev/null <<'SQL'
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.table_name, c.column_name, pg_get_serial_sequence(c.table_name, c.column_name) AS seq
           FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.column_default LIKE 'nextval%' LOOP
    EXECUTE format('SELECT setval(%L, coalesce((SELECT max(%I) FROM %I), 0) + 1, false)', r.seq, r.column_name, r.table_name);
  END LOOP; END $$;
SQL
echo "built: ${#cases} files"
psql -qAt -F" | " -c "SELECT * FROM tune_driver()"   # size-correction advice per driver class: apply via rule_param + rule_log
