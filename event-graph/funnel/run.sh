#!/bin/zsh
# launchd entry point (com.parity.funnel.plist): make sure the engine's Postgres is up, then poll
# forever. Keys for keyed feeds (SEC_USER_AGENT, ALPACA_*) go in ~/event-graph/funnel/.env, one
# `export NAME=value` per line.
PG=$HOME/Applications/Postgres.app/Contents/Versions/17/bin
DATA=$HOME/event-graph/.pgdata
if ! $PG/pg_ctl -D $DATA status >/dev/null 2>&1; then
  $PG/pg_ctl -D $DATA -l $DATA/server.log -o "-p 5499 -k $DATA -c listen_addresses=" start
fi
[ -f "${0:A:h}/.env" ] && source "${0:A:h}/.env"
cd "${0:A:h}" && exec /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -u funnel.py run
