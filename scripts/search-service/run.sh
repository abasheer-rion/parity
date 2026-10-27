#!/bin/zsh
# The always-on strategy search (DEC-0014), as launchd runs it. Updates the checkout,
# then searches for 12 hours and exits; launchd starts it again with fresh code.
# The writer database URL is read from the macOS Keychain at start, never stored on disk.
set -u

# Everything sits in one function so zsh reads the whole script before git can
# change this file underneath it.
HERE="${0:A:h}"  # outside the function: inside it, zsh sets $0 to the function name

main() {
  cd "$HERE/../.."
  # Fetch and fast-forward to main explicitly. A bare pull fails with "Cannot fast-forward
  # to multiple branches" when the checkout tracks more than one ref.
  { git fetch --quiet origin main && git merge --ff-only --quiet origin/main; } \
    || echo "git update failed, running the code already here"
  # The environment is not in git. If it is missing (a pull once removed a tracked symlink to
  # it), make it again here, so the service heals itself instead of failing every minute.
  if [[ ! -x engine/.venv/bin/python ]]; then
    echo "engine/.venv missing; creating it"
    rm -rf engine/.venv
    /usr/bin/env python3 -m venv engine/.venv || echo "could not create engine/.venv"
  fi
  engine/.venv/bin/pip install --quiet -e "engine[publish]" >/dev/null 2>&1 || true
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
}

main "$@"
