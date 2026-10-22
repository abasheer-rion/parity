#!/bin/zsh
# The always-on strategy search (DEC-0014), as launchd runs it. Updates the checkout,
# then searches for 12 hours and exits; launchd starts it again with fresh code.
# The writer database URL is read from the macOS Keychain at start, never stored on disk.
set -u
cd "$(dirname "$0")/../.."
git pull --ff-only --quiet || echo "git pull failed, running the code already here"
engine/.venv/bin/pip install --quiet -e engine >/dev/null 2>&1 || true
if command -v vault >/dev/null && vault get parity-supabase-writer-db >/dev/null 2>&1; then
  export PARITY_WRITER_DB_URL="$(vault get parity-supabase-writer-db)"
fi
exec nice -n 10 engine/.venv/bin/parity search run --forever --batch 50 --hours 12
