#!/bin/bash
# Renews the Let's Encrypt certificate if it's within its renewal window
# (certbot's own default: last 30 days of a 90-day cert) and reloads Nginx
# to pick up the renewed files. A no-op exits 0 either way, so this is safe
# to run from cron on a fixed schedule rather than tracking expiry dates.
#
# Intended to run from cron twice daily (Let's Encrypt's own recommendation
# for catching transient failures before the cert actually expires) -- see
# DEPLOYMENT.md for the crontab entry.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> $(date -Is) checking for certificate renewal..."
$COMPOSE run --rm certbot renew

echo "==> Reloading Nginx (harmless no-op if nothing renewed)..."
$COMPOSE exec nginx nginx -s reload

echo "==> $(date -Is) renewal check complete."
