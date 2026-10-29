#!/usr/bin/env bash
# Switches Parity's own email sender (the Supabase Send Email hook, Edge Function send-email)
# on or off. Off, Supabase sends through its SMTP settings again (Resend SMTP), which stay
# configured as the fallback.
#
#   auth/send_email_hook.sh            show whether the hook is on
#   auth/send_email_hook.sh --on       send auth emails through the send-email function
#   auth/send_email_hook.sh --off      send them through Supabase SMTP again
#
# Reads vault:supabase-access-token and, for --on, vault:parity-send-email-hook-secret from
# the Keychain into memory. Neither is printed or written anywhere.
set -euo pipefail
mode="${1:-status}"
case "$mode" in status|--on|--off) ;; -h|--help) sed -n '2,11p' "$0"; exit 0 ;; *) echo "unknown option: $mode" >&2; exit 2 ;; esac
MODE="$mode" exec python3 - <<'PY'
import json, os, subprocess, urllib.request
project = os.environ.get("SUPABASE_PROJECT_REF", "ttqvpxvctnomfbeoqbbs")
url = f"https://api.supabase.com/v1/projects/{project}/config/auth"
get = lambda n: subprocess.run(["security", "find-generic-password", "-s", f"vault:{n}", "-w"], capture_output=True, text=True, check=True).stdout.strip()
H = {"Authorization": f"Bearer {get('supabase-access-token')}", "Content-Type": "application/json", "User-Agent": "parity-auth"}
mode = os.environ["MODE"]
if mode != "status":
    body = {"hook_send_email_enabled": mode == "--on"}
    if mode == "--on":
        body["hook_send_email_uri"] = f"https://{project}.supabase.co/functions/v1/send-email"
        body["hook_send_email_secrets"] = get("parity-send-email-hook-secret")
    urllib.request.urlopen(urllib.request.Request(url, method="PATCH", data=json.dumps(body).encode(), headers=H))
cfg = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H)))
on = cfg.get("hook_send_email_enabled")
print(f"send-email hook: {'ON (our sender, Resend API)' if on else 'OFF (Supabase SMTP)'}; SMTP host kept: {cfg.get('smtp_host')}")
PY
