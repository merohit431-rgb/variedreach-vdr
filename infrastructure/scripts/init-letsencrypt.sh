#!/bin/bash
# One-time bootstrap for the first Let's Encrypt certificate. Run from the repo root:
#   ./infrastructure/scripts/init-letsencrypt.sh your-domain.com you@example.com
#
# Nginx's 443 server block (infrastructure/nginx/nginx.conf) points at a certificate
# that doesn't exist yet on a fresh deploy, so Nginx itself can't start — and without
# Nginx, port 80 isn't up for certbot's HTTP-01 challenge either. This script breaks
# that chicken-and-egg loop the standard way: generate a throwaway self-signed cert at
# the same path so Nginx can start, use that running Nginx to pass the real ACME
# challenge, then overwrite the dummy cert with the real one and reload.
#
# Safe to re-run: if a real certificate already exists for the domain, this exits
# without changing anything — use certbot renew (see DEPLOYMENT.md) for renewals.
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
LE_DIR="./infrastructure/nginx/letsencrypt"
LIVE_DIR="$LE_DIR/live/$DOMAIN"
WEBROOT_DIR="./infrastructure/nginx/certbot-webroot"

mkdir -p "$LIVE_DIR" "$WEBROOT_DIR"

if openssl x509 -in "$LIVE_DIR/fullchain.pem" -noout -issuer 2>/dev/null | grep -q "O = Let's Encrypt"; then
  echo "A real Let's Encrypt certificate for $DOMAIN already exists. Nothing to do — use certbot renew for renewals."
  exit 0
fi

echo "==> Generating a temporary self-signed certificate so Nginx can start..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$LIVE_DIR/privkey.pem" \
  -out "$LIVE_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN" >/dev/null 2>&1

echo "==> Building and starting the full stack with the temporary certificate..."
$COMPOSE up -d --build

echo "==> Waiting for Nginx to report healthy..."
for _ in $(seq 1 30); do
  if [ "$($COMPOSE ps -q nginx | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null)" = "true" ]; then
    break
  fi
  sleep 2
done

echo "==> Requesting the real certificate from Let's Encrypt..."
$COMPOSE run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  --cert-name "$DOMAIN" \
  -d "$DOMAIN"

echo "==> Reloading Nginx with the real certificate..."
$COMPOSE exec nginx nginx -s reload

echo "==> Done. https://$DOMAIN should now serve a trusted certificate."
