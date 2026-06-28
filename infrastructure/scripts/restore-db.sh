#!/bin/bash
# Restores a database + uploads pair produced by backup-db.sh.
# DESTRUCTIVE: replaces all current data. Always confirms before running.
#
# Usage: ./infrastructure/scripts/restore-db.sh db-TIMESTAMP.sql.gz uploads-TIMESTAMP.tar.gz
#
# pg_dump's plain-SQL output already includes the schema (tables, indexes,
# triggers) along with the data, so restoring it recreates the append-only
# triggers too — no separate step needed for that.
set -euo pipefail

DB_DUMP="${1:?Usage: $0 <db-TIMESTAMP.sql.gz> <uploads-TIMESTAMP.tar.gz>}"
UPLOADS_DUMP="${2:?Usage: $0 <db-TIMESTAMP.sql.gz> <uploads-TIMESTAMP.tar.gz>}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

[ -f "$DB_DUMP" ] || { echo "No such file: $DB_DUMP" >&2; exit 1; }
[ -f "$UPLOADS_DUMP" ] || { echo "No such file: $UPLOADS_DUMP" >&2; exit 1; }

echo "This REPLACES all current data (database + uploaded files) with:"
echo "  $DB_DUMP"
echo "  $UPLOADS_DUMP"
read -r -p "Type 'restore' to continue: " CONFIRM
[ "$CONFIRM" = "restore" ] || { echo "Aborted."; exit 1; }

echo "==> Stopping backend so nothing writes during restore..."
$COMPOSE stop backend

echo "==> Dropping and recreating the database..."
$COMPOSE exec -T postgres psql -U vdr_user -d postgres -c "DROP DATABASE IF EXISTS insolvency_vdr;"
$COMPOSE exec -T postgres psql -U vdr_user -d postgres -c "CREATE DATABASE insolvency_vdr;"

echo "==> Restoring database..."
gunzip -c "$DB_DUMP" | $COMPOSE exec -T postgres psql -U vdr_user -d insolvency_vdr

echo "==> Restoring uploaded files..."
$COMPOSE run --rm -T backend sh -c "rm -rf /app/uploads/* && tar xzf - -C /app/uploads" < "$UPLOADS_DUMP"

echo "==> Restarting backend..."
$COMPOSE start backend

echo "==> Restore complete."
