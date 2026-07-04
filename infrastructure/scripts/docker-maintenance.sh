#!/bin/bash
# Weekly Docker build cache maintenance. Every build without cache reuse
# leaves its old layers behind -- BuildKit's cache only grows unless
# something prunes it. One session of repeated --no-cache rebuilds took this
# VPS from 17GB free to needing a manual 62.97GB prune. This automates that
# going forward so it never accumulates that far again.
#
# Deliberately scoped to ONLY `docker builder prune` -- by definition this
# touches build cache exclusively and cannot remove running containers,
# images still in use, named volumes (uploads, postgres data), or anything
# else. --filter "until=168h" (7 days) keeps the current week's cache so
# routine cached builds stay fast; only cache older than a week gets swept.
#
# Intended to run from cron (see DEPLOYMENT.md). Exits non-zero on failure
# so cron's own failure handling surfaces it, and logs every run -- success,
# failure, and how much was reclaimed -- to LOG_FILE regardless.
#
# Env overrides: LOG_FILE (default /var/log/vdr/docker-maintenance.log),
# NOTABLE_RECLAIM_GB (default 5)
set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/vdr/docker-maintenance.log}"
NOTABLE_RECLAIM_GB="${NOTABLE_RECLAIM_GB:-5}"
NOTABLE_RECLAIM_BYTES=$((NOTABLE_RECLAIM_GB * 1024 * 1024 * 1024))

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "$(date -Is) $1" >> "$LOG_FILE"
}

# Converts Docker's human-readable size ("62.97GB", "140MB", "512kB", "0B")
# into bytes so it can be compared numerically against the notable threshold.
to_bytes() {
  local value unit
  value="$(echo "$1" | grep -oE '^[0-9.]+')"
  unit="$(echo "$1" | grep -oE '[A-Za-z]+$')"
  case "$unit" in
    B) awk "BEGIN { printf \"%d\", ${value:-0} }" ;;
    kB|KB) awk "BEGIN { printf \"%d\", ${value:-0} * 1024 }" ;;
    MB) awk "BEGIN { printf \"%d\", ${value:-0} * 1024 * 1024 }" ;;
    GB) awk "BEGIN { printf \"%d\", ${value:-0} * 1024 * 1024 * 1024 }" ;;
    TB) awk "BEGIN { printf \"%d\", ${value:-0} * 1024 * 1024 * 1024 * 1024 }" ;;
    *) echo 0 ;;
  esac
}

log "Starting Docker build cache maintenance (pruning cache older than 168h)"

if ! OUTPUT="$(docker builder prune -af --filter "until=168h" 2>&1)"; then
  log "FAILED: docker builder prune exited with an error:"
  log "$OUTPUT"
  exit 1
fi

RECLAIMED_HUMAN="$(echo "$OUTPUT" | grep -E '^Total:' | grep -oE '[0-9.]+[A-Za-z]+$' || echo "0B")"
RECLAIMED_BYTES="$(to_bytes "$RECLAIMED_HUMAN")"

log "Completed successfully. Reclaimed: ${RECLAIMED_HUMAN}"

if [ "$RECLAIMED_BYTES" -gt "$NOTABLE_RECLAIM_BYTES" ]; then
  log "NOTABLE: reclaimed ${RECLAIMED_HUMAN}, over the ${NOTABLE_RECLAIM_GB}GB notable threshold -- build cache had grown larger than usual."
fi
