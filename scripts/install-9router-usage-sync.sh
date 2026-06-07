#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
SERVICE_USER="${SERVICE_USER:-root}"
SOURCE_USAGE_FILE="${SOURCE_USAGE_FILE:-/root/.9router/usage.json}"
SOURCE_ID="${SOURCE_ID:-9router-vps-36.50.26.247}"
TARGET_BASE_URL="${TARGET_BASE_URL:-http://127.0.0.1:1212}"
TARGET_USERNAME="${TARGET_USERNAME:-admin}"
TARGET_PASSWORD="${TARGET_PASSWORD:-}"
STATE_FILE="${STATE_FILE:-/var/lib/xlabrouter/9router-usage-sync-state.json}"
ENV_FILE="${ENV_FILE:-/etc/xlabrouter/9router-usage-sync.env}"
LOG_FILE="${LOG_FILE:-/var/log/xlabrouter-usage-sync.log}"
INSTALL_MODE="${INSTALL_MODE:-systemd}"

if [[ -z "$TARGET_PASSWORD" ]]; then
  echo "ERROR: TARGET_PASSWORD is required" >&2
  exit 1
fi

if [[ ! -f "$APP_DIR/scripts/sync-9router-usage.mjs" ]]; then
  echo "ERROR: APP_DIR does not look like XLab_Router: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_USAGE_FILE" ]]; then
  echo "WARN: SOURCE_USAGE_FILE not found yet: $SOURCE_USAGE_FILE" >&2
fi

mkdir -p "$(dirname "$ENV_FILE")" "$(dirname "$STATE_FILE")" "$(dirname "$LOG_FILE")"
cat > "$ENV_FILE" <<EOF
APP_DIR=$APP_DIR
SOURCE_USAGE_FILE=$SOURCE_USAGE_FILE
SOURCE_ID=$SOURCE_ID
TARGET_BASE_URL=$TARGET_BASE_URL
TARGET_USERNAME=$TARGET_USERNAME
TARGET_PASSWORD=$TARGET_PASSWORD
STATE_FILE=$STATE_FILE
EOF
chmod 600 "$ENV_FILE"

touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

run_line="cd \"$APP_DIR\" && /usr/bin/env bash -lc 'set -a; source \"$ENV_FILE\"; set +a; npm run usage:sync:9router -- --apply >> \"$LOG_FILE\" 2>&1'"

if [[ "$INSTALL_MODE" == "cron" || ! -d /run/systemd/system ]]; then
  cron_file="/etc/cron.d/xlabrouter-9router-usage-sync"
  cat > "$cron_file" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 * * * * $SERVICE_USER $run_line
EOF
  chmod 644 "$cron_file"
  echo "Installed cron job: $cron_file"
  exit 0
fi

cat > /etc/systemd/system/xlabrouter-9router-usage-sync.service <<EOF
[Unit]
Description=XLab Router hourly 9router usage DB sync
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm run usage:sync:9router -- --apply
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE
EOF

cat > /etc/systemd/system/xlabrouter-9router-usage-sync.timer <<EOF
[Unit]
Description=Run XLab Router 9router usage DB sync hourly

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=90
Unit=xlabrouter-9router-usage-sync.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now xlabrouter-9router-usage-sync.timer
systemctl start xlabrouter-9router-usage-sync.service || true
systemctl status xlabrouter-9router-usage-sync.timer --no-pager

echo "Installed systemd timer: xlabrouter-9router-usage-sync.timer"
