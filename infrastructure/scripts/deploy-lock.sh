#!/bin/bash
# Wraps a deploy command in a flock-based lock keyed by project name, so two
# concurrent deploy commands against the SAME project can never run at once
# -- the real incident this closes: two overlapping deploy commands raced
# earlier in this engagement (caught and fixed within about a minute, but
# only because someone was watching). Projects are independent: a staging
# deploy and a production deploy never block each other, only two deploys
# of the SAME project do. Intended as a drop-in prefix around the exact
# commands already documented in the Operations Runbook / STAGING.md /
# DEPLOYMENT.md -- it does not change what gets run, only serializes it.
#
# Usage: ./infrastructure/scripts/deploy-lock.sh <project-name> -- <command...>
# Example:
#   ./infrastructure/scripts/deploy-lock.sh variedreach-vdr-staging -- \
#     docker compose -p variedreach-vdr-staging -f docker-compose.yml -f docker-compose.staging.yml \
#     up -d --build --no-deps backend
#
# Fails fast (does not wait) if the lock is already held -- a second deploy
# landing while one is in flight should stop and tell the operator, not
# silently queue up and run later against a possibly-different checkout.
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$2" != "--" ]; then
  echo "Usage: $0 <project-name> -- <command...>" >&2
  exit 64
fi

PROJECT_NAME="$1"
shift 2 # drop <project-name> and the -- separator; "$@" is now the command to run

LOCK_DIR="/tmp/vdr-deploy-locks"
mkdir -p "$LOCK_DIR"
LOCK_FILE="$LOCK_DIR/${PROJECT_NAME}.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "REFUSED: a deploy for '$PROJECT_NAME' is already in progress (lock held on $LOCK_FILE)." >&2
  echo "Wait for it to finish, or confirm it's actually stuck before removing the lock file by hand." >&2
  exit 1
fi

echo "==> Lock acquired for '$PROJECT_NAME' ($LOCK_FILE). Running: $*"
"$@"
STATUS=$?
echo "==> Deploy command for '$PROJECT_NAME' exited $STATUS. Releasing lock."
exit "$STATUS"
