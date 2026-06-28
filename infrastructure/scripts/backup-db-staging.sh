#!/bin/bash
# Staging's counterpart to backup-db.sh -- same dump+archive approach, scoped
# to the staging Compose project/database/volume so it can never touch
# production's backups or vice versa. Intended to run from cron on the
# staging checkout (/opt/variedreach-vdr-staging); see STAGING.md.
#
# Usage: ./infrastructure/scripts/backup-db-staging.sh
# Env overrides: BACKUP_DIR (default /var/backups/insolvency-vdr-staging), RETENTION_DAYS (default 14)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/insolvency-vdr-staging}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -p variedreach-vdr-staging -f docker-compose.yml -f docker-compose.staging.yml"

mkdir -p "$BACKUP_DIR"

echo "==> Dumping staging database..."
$COMPOSE exec -T postgres pg_dump -U vdr_staging_user insolvency_vdr_staging \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

echo "==> Archiving staging uploaded files..."
$COMPOSE exec -T backend tar czf - -C /app/uploads . \
  > "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"

echo "==> Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "$(date -Is) staging backup complete: $BACKUP_DIR/{db,uploads}-$TIMESTAMP.{sql.gz,tar.gz}"
