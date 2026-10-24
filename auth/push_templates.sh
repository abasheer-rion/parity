#!/usr/bin/env bash
# Pushes Parity's auth emails, and optionally the sign-in settings and the Resend email
# sender, to the hosted Supabase project through the Management API.
#
#   auth/push_templates.sh                            show what would be sent, send nothing
#   auth/push_templates.sh --apply                    send the six templates and subjects
#   auth/push_templates.sh --apply --smtp             also connect Resend as the email sender
#   auth/push_templates.sh --apply --settings         also send site URL, redirects, rules,
#                                                     and turn email confirmation ON
#   auth/push_templates.sh --apply --smtp --settings  everything (the order auth/CHECKLIST.md uses)
#
# Needs a Supabase personal access token in the macOS Keychain under the name
# vault:supabase-access-token, and for --smtp the Resend key under resend-api-key
# (see auth/CHECKLIST.md). Both are read into memory by Python and sent over HTTPS. They
# are never printed, logged, written to disk or put on a command line.
set -euo pipefail

apply=0
settings=0
smtp=0
for arg in "$@"; do
  case "$arg" in
    --apply) apply=1 ;;
    --settings) settings=1 ;;
    --smtp) smtp=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/build.py" --check >/dev/null || {
  echo "auth/dist is out of date. Run: python3 auth/build.py" >&2
  exit 1
}

APPLY="$apply" SETTINGS="$settings" SMTP="$smtp" exec python3 - "$here" <<'PY'
import json, os, subprocess, sys, urllib.error, urllib.request
from pathlib import Path

here = Path(sys.argv[1])
project = os.environ.get("SUPABASE_PROJECT_REF", "ttqvpxvctnomfbeoqbbs")
api = f"https://api.supabase.com/v1/projects/{project}/config/auth"
apply, settings, smtp = (os.environ[k] == "1" for k in ("APPLY", "SETTINGS", "SMTP"))

# The production address. Every email link starts here ({{ .SiteURL }}).
SITE_URL = os.environ.get("PARITY_SITE_URL", "https://parity.endyland.com")
# Resend sends from the verified domain parity.endyland.com (LOG-0006).
SMTP_FROM = os.environ.get("PARITY_SMTP_FROM", "no-reply@parity.endyland.com")

subjects = json.loads((here / "dist" / "subjects.json").read_text())
body = {}
for key, subject in subjects.items():
    body[f"mailer_subjects_{key}"] = subject
    body[f"mailer_templates_{key}_content"] = (here / "dist" / f"{key}.html").read_text()

if settings:
    body.update({
        "site_url": SITE_URL,
        # Where sign-in may send people back to: the site, Sim World, Parity Trade, any endyland.com
        # subdomain we add later, the old pages.dev address while it still works, and
        # local development. Supabase falls back to the site URL for anything else.
        "uri_allow_list": ",".join([
            "https://parity.endyland.com/**",
            "https://sim.endyland.com/**",
            "https://trade.endyland.com/**",
            "https://*.endyland.com/**",
            "https://parity-research.pages.dev/**",
            "https://*.parity-research.pages.dev/**",
            "http://127.0.0.1:5173/**",
            "http://localhost:5173/**",
        ]),
        "disable_signup": False,                          # anyone can make an account
        "external_email_enabled": True,
        "mailer_autoconfirm": False,                      # email confirmation ON: needs a sender (--smtp)
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

if smtp:
    body.update({
        "smtp_host": "smtp.resend.com",
        "smtp_port": "465",
        "smtp_user": "resend",
        "smtp_pass": "<from Keychain: resend-api-key>",
        "smtp_admin_email": SMTP_FROM,
        "smtp_sender_name": "Parity",
        "rate_limit_email_sent": 100,                     # per hour; Supabase starts custom SMTP at 30
    })

for k, v in body.items():
    shown = f"{len(v)} characters" if isinstance(v, str) and len(v) > 80 else json.dumps(v)
    print(f"  {k}: {shown}")

if settings and not smtp:
    print("\nNote: --settings turns email confirmation ON. Only do that once Resend is connected"
          " (--smtp now, or earlier), or new people cannot finish signing up.")

if not apply:
    print(f"\nDry run: nothing was sent. Add --apply to send these fields to project {project}.")
    sys.exit(0)


def keychain(name: str) -> str:
    out = subprocess.run(["security", "find-generic-password", "-s", name, "-w"],
                         capture_output=True, text=True)
    if out.returncode != 0 or not out.stdout.strip():
        sys.exit(f"No Keychain item named {name}. See auth/CHECKLIST.md.")
    return out.stdout.strip()


token = keychain("vault:supabase-access-token")
if smtp:
    body["smtp_pass"] = keychain("vault:resend-api-key")

# Save the current settings first, so any change can be undone (mode 600, outside the
# repo, with the SMTP password left out).
try:
    with urllib.request.urlopen(urllib.request.Request(api, headers={"Authorization": f"Bearer {token}"}), timeout=30) as res:
        before = json.loads(res.read())
    before.pop("smtp_pass", None)
    backups = Path.home() / ".config" / "parity" / "supabase-auth-backups"
    backups.mkdir(parents=True, exist_ok=True)
    import datetime, stat
    path = backups / f"auth-config-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(json.dumps(before, indent=2))
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    print(f"Saved the current settings to {path}")
except (urllib.error.URLError, ValueError) as e:
    sys.exit(f"Could not read the current settings ({e}), so nothing was sent.")

req = urllib.request.Request(api, method="PATCH", data=json.dumps(body).encode(),
                             headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as res:
        status = res.status
except urllib.error.HTTPError as e:
    status = e.code
except urllib.error.URLError as e:
    sys.exit(f"Could not reach Supabase ({e.reason}). Nothing is confirmed as changed.")
finally:
    token = ""
    body.pop("smtp_pass", None)

if status == 200:
    print("Sent. Check Authentication > Emails (and SMTP Settings) in the Supabase dashboard.")
else:
    sys.exit(f"Supabase answered HTTP {status}. Nothing is confirmed as changed.")
PY
