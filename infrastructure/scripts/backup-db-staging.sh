#!/bin/bash
# Staging's counterpart to backup-db.sh -- same dump+archive approach, scoped
# to the staging Compose project/database/volume so it can never touch
# production's backups or vice versa. Intended to run from cron on the
# staging checkout (/opt/variedreach-vdr-staging); see STAGING.md.
#
# Usage: ./infrastructure/scripts/backup-db-staging.sh
# Env overrides: BACKUP_DIR (default /var/backups/insolvency-vdr-staging),
#   BACKUP_KEEP (default 1) — how many of the most-recent backups to keep.
# Count-based retention (see backup-db.sh for the rationale).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/insolvency-vdr-staging}"
BACKUP_KEEP="${BACKUP_KEEP:-1}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -p variedreach-vdr-staging -f docker-compose.yml -f docker-compose.staging.yml"

mkdir -p "$BACKUP_DIR"

echo "==> Dumping staging database..."
$COMPOSE exec -T postgres pg_dump -U vdr_staging_user insolvency_vdr_staging \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

echo "==> Archiving staging uploaded files..."
$COMPOSE exec -T backend tar czf - -C /app/uploads . \
  > "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"

echo "==> Pruning old backups (keeping the newest $BACKUP_KEEP)..."
# Runs only after the new dump+archive above succeeded (set -e), so the
# current backup is always kept and we can never prune down to zero.
prune_keep_newest() {
  local glob="$1"
  ls -1t "$BACKUP_DIR"/$glob 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while IFS= read -r old; do
    rm -f -- "$old" && echo "    pruned $(basename "$old")"
  done
}
prune_keep_newest 'db-*.sql.gz'
prune_keep_newest 'uploads-*.tar.gz'

echo "$(date -Is) staging backup complete: $BACKUP_DIR/{db,uploads}-$TIMESTAMP.{sql.gz,tar.gz}"
