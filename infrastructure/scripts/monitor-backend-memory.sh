#!/bin/bash
# Samples the production backend container's memory usage and appends it to
# a log, so actual peak usage can be checked after the fact instead of
# relying on someone watching `docker stats` live. Written after the
# backend's 512MB limit OOM-killed it -- this is how to tell, once the limit
# is raised, whether the new ceiling has real headroom under it or whether
# usage is still climbing close to the edge.
#
# Intended to run from cron every few minutes (see DEPLOYMENT.md). Each line
# is timestamp, current usage, percent of the configured limit, and the
# limit itself, so the log is self-contained -- no need to cross-reference
# docker-compose.prod.yml to know whether a given reading was close to the
# ceiling at the time.
#
# Usage: ./infrastructure/scripts/monitor-backend-memory.sh [container_name]
# Env override: LOG_FILE (default /var/log/vdr/backend-memory.log)
set -euo pipefail

CONTAINER="${1:-vdr_backend}"
LOG_FILE="${LOG_FILE:-/var/log/vdr/backend-memory.log}"

mkdir -p "$(dirname "$LOG_FILE")"

STATS="$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}\t{{.MemPerc}}" 2>&1)" || {
  echo "$(date -Is) ERROR: could not read stats for $CONTAINER: $STATS" >> "$LOG_FILE"
  exit 1
}

echo "$(date -Is) $STATS" >> "$LOG_FILE"
