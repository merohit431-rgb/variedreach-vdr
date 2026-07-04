#!/bin/bash
# Backs up both the Postgres database and the uploaded-file volume — the
# documents themselves live in backend_uploads, not in Postgres, so a backup
# strategy that only dumps the database loses every actual file. Intended to
# run from cron; see DEPLOYMENT.md for the crontab entry.
#
# Usage: ./infrastructure/scripts/backup-db.sh
# Env overrides: BACKUP_DIR (default /var/backups/insolvency-vdr),
#   BACKUP_KEEP (default 1) — how many of the most-recent backups to keep.
# Retention is count-based, not age-based: with a weekly schedule and a
# single ~7GB full uploads copy, an age window (e.g. 14 days) would try to
# stack more full copies than a 96GB disk can hold. Keeping the newest N is
# predictable regardless of how often the backup runs.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/insolvency-vdr}"
BACKUP_KEEP="${BACKUP_KEEP:-1}"
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

echo "$(date -Is) backup complete: $BACKUP_DIR/{db,uploads}-$TIMESTAMP.{sql.gz,tar.gz}"
