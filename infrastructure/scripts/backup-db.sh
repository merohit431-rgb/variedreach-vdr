#!/bin/bash
# Backs up both the Postgres database and the uploaded-file volume — the
# documents themselves live in backend_uploads, not in Postgres, so a backup
# strategy that only dumps the database loses every actual file. Intended to
# run from cron; see DEPLOYMENT.md for the crontab entry.
#
# Usage: ./infrastructure/scripts/backup-db.sh
# Env overrides: BACKUP_DIR (default /var/backups/insolvency-vdr), RETENTION_DAYS (default 14)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/insolvency-vdr}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

mkdir -p "$BACKUP_DIR"

echo "==> Dumping database..."
$COMPOSE exec -T postgres pg_dump -U vdr_user insolvency_vdr \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

echo "==> Archiving uploaded files..."
# Runs tar inside the already-running backend container, which has the
# backend_uploads volume mounted at /app/uploads — avoids needing to know
# Compose's project-prefixed volume name.
$COMPOSE exec -T backend tar czf - -C /app/uploads . \
  > "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"

echo "==> Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "$(date -Is) backup complete: $BACKUP_DIR/{db,uploads}-$TIMESTAMP.{sql.gz,tar.gz}"
