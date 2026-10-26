#!/bin/zsh
# The always-on sims (DEC-0037), as launchd runs it. Updates the checkout, then runs a
# cycle of every sim, rests 20 minutes, and repeats for 12 hours before exiting; launchd
# starts it again with fresh code. Same pattern as scripts/search-service/run.sh.
# The writer database URL is read from the vault at start, never stored on disk.
set -u

# Everything sits in one function so zsh reads the whole script before git pull can
# change this file underneath it.
HERE="${0:A:h}"  # outside the function: inside it, zsh sets $0 to the function name

main() {
  cd "$HERE/../.."
  git pull --ff-only --quiet || echo "git pull failed, running the code already here"
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
    echo "no writer URL in the vault; running the sims without publishing to the site"
  fi
  unset url
  # The feedback collector's Reddit source (DEC-0047) runs only when both vault entries
  # exist; otherwise it is listed as needing a key and skipped. Values are never printed.
  rid="$(vault get parity-reddit-client-id 2>/dev/null || true)"
  rsec="$(vault get parity-reddit-client-secret 2>/dev/null || true)"
  if [[ -n "$rid" && -n "$rsec" ]]; then
    export REDDIT_CLIENT_ID="$rid" REDDIT_CLIENT_SECRET="$rsec"
  fi
  unset rid rsec
  # One core at most, so the strategy search keeps the rest of the machine.
  export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1
  exec nice -n 10 engine/.venv/bin/parity sims run --forever --hours 12 --sleep-minutes 20
}

main "$@"
