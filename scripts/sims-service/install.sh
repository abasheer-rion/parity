#!/bin/zsh
# Installs the always-on sims (DEC-0037) as a launchd agent for this user: starts at login,
# restarts if it stops, logs to ~/Library/Logs/parity-sims.log. Run from the
# checkout the service should use (a clean worktree on main is best).
#   scripts/sims-service/install.sh          install and start
#   scripts/sims-service/install.sh remove   stop and uninstall
set -eu
LABEL=com.endyland.parity-sims
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${1:-}" == remove ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL"
  exit 0
fi
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$ROOT/scripts/sims-service/run.sh</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/parity-sims.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/parity-sims.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed $LABEL from $ROOT; log: ~/Library/Logs/parity-sims.log"
