#!/bin/zsh
# The always-on strategy search (DEC-0014), as launchd runs it. Updates the checkout,
# then searches for 12 hours and exits; launchd starts it again with fresh code.
# The writer database URL is read from the macOS Keychain at start, never stored on disk.
set -u
cd "$(dirname "$0")/../.."
git pull --ff-only --quiet || echo "git pull failed, running the code already here"
engine/.venv/bin/pip install --quiet -e engine >/dev/null 2>&1 || true
# Publishing needs a full postgresql:// URL in the vault entry parity-supabase-writer-url.
# Anything else is ignored, so a bare password is never handed to the database driver.
url="$(vault get parity-supabase-writer-url 2>/dev/null || true)"
if [[ "$url" == postgres* ]]; then
  export PARITY_WRITER_DB_URL="$url"
else
  echo "no writer URL in the vault; searching without publishing to the site"
fi
unset url
exec nice -n 10 engine/.venv/bin/parity search run --forever --batch 50 --hours 12
