#!/bin/bash
# Alerts when disk usage crosses a threshold. Worth watching specifically on
# this app because uploaded files accumulate on local disk indefinitely —
# there's no S3/object-storage migration in V1.0, so this VPS's disk is the
# only place documents live until that changes.
#
# Intended to run from cron (see DEPLOYMENT.md). Exits non-zero when over
# threshold so cron's own failure handling (mail/journal, depending on the
# system) surfaces it; redirect stdout/stderr to a log file you actually
# check, or pipe to a webhook/notification command if you have one.
#
# Env override: DISK_THRESHOLD_PERCENT (default 85)
set -euo pipefail

THRESHOLD="${DISK_THRESHOLD_PERCENT:-85}"
USAGE="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"

if [ "$USAGE" -ge "$THRESHOLD" ]; then
  echo "WARNING: disk usage at ${USAGE}% (threshold ${THRESHOLD}%) on $(hostname) at $(date -Is)" >&2
  exit 1
fi

echo "$(date -Is) disk usage OK at ${USAGE}%"
