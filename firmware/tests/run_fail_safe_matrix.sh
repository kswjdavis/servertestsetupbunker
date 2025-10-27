#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="${PROJECT_ROOT}/firmware/tests"
LOG_DIR="${TEST_DIR}/logs"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="${LOG_DIR}/fail-safe-matrix-${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"

echo "Running firmware fail-safe host simulations..."
echo "Log: ${LOG_FILE}"

(
    cd "${TEST_DIR}"
    make run
) | tee "${LOG_FILE}"

echo "Fail-safe host simulation complete."
