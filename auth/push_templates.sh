#!/usr/bin/env bash
# Pushes Parity's auth emails (and, with --settings, the sign-in settings) to the hosted
# Supabase project through the Management API.
#
#   auth/push_templates.sh                     show what would be sent, send nothing
#   auth/push_templates.sh --apply             send the six templates and subjects
#   auth/push_templates.sh --apply --settings  also send site URL, redirects, password rules
#
# Needs a Supabase personal access token in the macOS Keychain under the name
# vault:supabase-access-token (see auth/README.md, "Deploying"). The token is read
# straight into the request and never printed, logged or written to disk.
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-ttqvpxvctnomfbeoqbbs}"
KEYCHAIN_NAME="vault:supabase-access-token"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

apply=0
settings=0
for arg in "$@"; do
  case "$arg" in
    --apply) apply=1 ;;
    --settings) settings=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/build.py" --check >/dev/null || {
  echo "auth/dist is out of date. Run: python3 auth/build.py" >&2
  exit 1
}

payload="$(mktemp)"
chmod 600 "$payload"
trap 'rm -f "$payload"' EXIT

SETTINGS="$settings" python3 - "$here" "$payload" <<'PY'
import json, os, sys
from pathlib import Path

here, out = Path(sys.argv[1]), Path(sys.argv[2])
subjects = json.loads((here / "dist" / "subjects.json").read_text())
body = {}
for key, subject in subjects.items():
    body[f"mailer_subjects_{key}"] = subject
    body[f"mailer_templates_{key}_content"] = (here / "dist" / f"{key}.html").read_text()

if os.environ["SETTINGS"] == "1":
    body.update({
        "site_url": "https://parity-research.pages.dev",
        "uri_allow_list": ",".join([
            "https://parity-research.pages.dev/**",
            "https://*.parity-research.pages.dev/**",
            "http://127.0.0.1:5173/**",
            "http://localhost:5173/**",
        ]),
        "disable_signup": False,                          # anyone can make an account
        "external_email_enabled": True,
        # Email confirmation OFF until an email provider is connected (README).
        # Set to False then, and push again.
        "mailer_autoconfirm": True,
        "mfa_totp_enroll_enabled": True,                  # authenticator apps
        "mfa_totp_verify_enabled": True,
        "mailer_secure_email_change_enabled": True,       # old and new address both confirm
        "security_update_password_require_reauthentication": True,
        "password_min_length": 10,
        "password_required_characters": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
        "mailer_otp_exp": 3600,
        "mailer_otp_length": 6,
        "smtp_max_frequency": 60,
    })

out.write_text(json.dumps(body))
for k, v in body.items():
    shown = f"{len(v)} characters" if isinstance(v, str) and len(v) > 80 else json.dumps(v)
    print(f"  {k}: {shown}")
PY

if [ "$apply" -ne 1 ]; then
  echo
  echo "Dry run: nothing was sent. Add --apply to send these fields to project ${PROJECT_REF}."
  exit 0
fi

if ! security find-generic-password -s "$KEYCHAIN_NAME" >/dev/null 2>&1; then
  echo "No Keychain item named ${KEYCHAIN_NAME}. Create the token first (auth/README.md, Deploying)." >&2
  exit 1
fi

# The header goes to curl on stdin, so the token never appears in the process list.
status="$(
  printf 'Authorization: Bearer %s\n' "$(security find-generic-password -s "$KEYCHAIN_NAME" -w)" |
    curl -sS -o /dev/null -w '%{http_code}' -X PATCH "$API" \
      -H @- -H 'Content-Type: application/json' --data-binary @"$payload"
)"

if [ "$status" = "200" ]; then
  echo "Sent. Check Authentication > Emails in the Supabase dashboard."
else
  echo "Supabase answered HTTP ${status}. Nothing is confirmed as changed." >&2
  exit 1
fi
