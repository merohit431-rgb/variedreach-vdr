#!/bin/bash
# Removes orphaned files from the upload temp directory. Uploads stream to
# disk here before being moved into permanent storage (see
# LocalStorageProvider.saveFromPath) -- a successful upload always cleans up
# after itself, but an aborted one (client cancels, connection drops,
# browser tab closes mid-transfer) leaves a partial file behind with no
# code path that ever runs to delete it, since the request handler whose
# `finally` block would normally do that never gets invoked. With uploads
# now up to 2GB, a handful of these can add up fast on a VPS that's
# already tight on disk.
#
# Run from cron periodically (see DEPLOYMENT.md/STAGING.md). Only removes
# files older than RETENTION_MINUTES so an upload still genuinely in
# progress is never touched -- even a slow 2GB transfer finishes well
# inside the default window.
#
# Usage: cleanup-upload-temp.sh <container_name>
# Env override: RETENTION_MINUTES (default 120)
set -euo pipefail

CONTAINER="${1:?Usage: cleanup-upload-temp.sh <container_name>}"
RETENTION_MINUTES="${RETENTION_MINUTES:-120}"

REMOVED="$(docker exec "$CONTAINER" find /app/uploads/tmp -type f -mmin "+${RETENTION_MINUTES}" -print -delete 2>/dev/null | wc -l | tr -d ' ')"

echo "$(date -Is) cleaned up ${REMOVED} orphaned temp upload(s) older than ${RETENTION_MINUTES}m on ${CONTAINER}"
