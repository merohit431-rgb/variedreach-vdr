#!/bin/sh
set -e
# The uploads volume is mounted as root; chown it to appuser before dropping
# privileges so the process can write files without running as root.
chown -R appuser:appgroup /app/uploads 2>/dev/null || true
exec su-exec appuser "$@"
