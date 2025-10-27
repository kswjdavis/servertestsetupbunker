#!/usr/bin/env bash
#
# Deprecated wrapper kept for backward compatibility.
# Use scripts/build-web.sh directly.
#
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "WARNING: scripts/deploy-web.sh is deprecated. Use scripts/build-web.sh instead."
exec "${SCRIPT_DIR}/build-web.sh" "$@"
