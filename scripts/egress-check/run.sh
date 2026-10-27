#!/bin/zsh
# The daily egress check (REF-0028), as launchd runs it. Reads the Supabase token and the
# writer URL from the vault into the environment for this one run; neither is printed.
set -u
HERE="${0:A:h}"
cd "$HERE/../.."
token="$(vault get supabase-access-token 2>/dev/null || true)"
if [[ -z "$token" ]]; then echo "no supabase-access-token in the vault"; exit 1; fi
export SUPABASE_ACCESS_TOKEN="$token"
unset token
url="$(vault get parity-supabase-writer-url 2>/dev/null || true)"
[[ "$url" == postgres* ]] && export PARITY_WRITER_DB_URL="$url"
unset url
py=engine/.venv/bin/python
[[ -x "$py" ]] || py=python3
exec "$py" scripts/egress-check/check.py
